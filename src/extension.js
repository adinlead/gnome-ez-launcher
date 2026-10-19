import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as AppMenu from 'resource:///org/gnome/shell/ui/appMenu.js';
import * as AppDisplay from 'resource:///org/gnome/shell/ui/appDisplay.js';
import * as OverviewControls from 'resource:///org/gnome/shell/ui/overviewControls.js';
import * as ParentalControlsManager from 'resource:///org/gnome/shell/misc/parentalControlsManager.js';

import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import { InjectionManager } from 'resource:///org/gnome/shell/extensions/extension.js';

import { VerticalAppDisplay } from './appDisplay.js';
import { resolveStrategy } from './searchStrategies.js';

export default class VerticalAppGridExtension extends Extension {
  enable() {
    const extension = this;
    const overviewControlsProto = OverviewControls.ControlsManager.prototype;

    this._settings = this.getSettings();
    this._vertAppDisplay = new VerticalAppDisplay(this._settings);
    this._injectionManager = new InjectionManager();

    // Add the vertical app display to the overview
    this._overviewControls = Main.overview._overview._controls;
    this._overviewLayoutManager = this._overviewControls.layout_manager;

    this._overviewControls.add_child(this._vertAppDisplay);

    // Steal the layout of the original app display
    this._overviewLayoutManager._appDisplay = this._vertAppDisplay;

    this._injectionManager.overrideMethod(overviewControlsProto, '_updateAppDisplayVisibility', () => function (params = null) {
      if (!params) {
        params = this._stateAdjustment.getStateTransitionParams();
      }

      const { initialState, finalState } = params;
      const state = Math.max(initialState, finalState);

      extension._vertAppDisplay.visible =
        state > OverviewControls.ControlsState.WINDOW_PICKER &&
        !this._searchController.searchActive;

      // Focus the vertical app display
      if (extension._vertAppDisplay.visible) {
        global.stage.set_key_focus(extension._vertAppDisplay);
      }

      // Disable drag and drop on the original app grid to prevent internal
      // errors when rearranging app icons in the dash
      extension._overviewControls.appDisplay._disconnectDnD();
    });

    // Fade out the app display when the search becomes active
    this._injectionManager.overrideMethod(overviewControlsProto, '_onSearchChanged', originalFn => function () {
      originalFn.call(this);

      const { searchActive } = this._searchController;

      extension._vertAppDisplay.ease({
        opacity: searchActive ? 0 : 255,
        duration: OverviewControls.SIDE_CONTROLS_ANIMATION_TIME,
        mode: Clutter.AnimationMode.EASE_OUT_QUAD
      });
    });

    // Rename the "Pin to Dash" item in the app menu
    this._injectionManager.overrideMethod(AppMenu.AppMenu.prototype, '_updateFavoriteItem', originalFn => function () {
      originalFn.call(this);

      if (this._toggleFavoriteItem.visible) {
        const text = this._appFavorites.isFavorite(this._app.id)
          ? _('Remove from Favorites')
          : _('Add to Favorites');

        this._toggleFavoriteItem.label.text = text;
      }
    });

    this._enableReadingSearch();
  }

  // 读音检索：覆写 Shell 内置 AppSearchProvider.getInitialResultSet，把按
  // 读音匹配到的应用并入原生搜索结果（子搜索 getSubsearchResultSet 内部
  // 转调本方法，无需重复覆写）。
  // 具体策略由 reading-search 设置决定（off / auto / 策略 id），
  // 策略接口与注册方式见 searchStrategies.js。
  // 兼容性：GNOME Shell 48/49/50 中该类的位置与方法签名一致（均已核对）。
  // TODO: Shell 大版本升级时需复核 getInitialResultSet 的参数与返回值形态（Promise<Array<id>>）。
  _enableReadingSearch() {
    const extension = this;
    this._appSystem = Shell.AppSystem.get_default();
    this._appUsage = Shell.AppUsage.get_default();
    this._parentalControls = ParentalControlsManager.getDefault();
    this._searchIndex = null;
    this._searchIndexStrategyId = null;
    this._searchIndexDirty = true;
    this._installedChangedId = this._appSystem.connect('installed-changed', () => {
      // 应用安装/卸载后索引整体失效，留待下次搜索时懒重建
      this._searchIndexDirty = true;
    });

    // prefs 的「更新检索缓存」按钮（跨进程信号，见 gschema 注释）
    this._cacheRefreshId = this._settings.connect('changed::search-cache-refresh',
      () => this._refreshSearchCache());

    this._injectionManager.overrideMethod(AppDisplay.AppSearchProvider.prototype,
      'getInitialResultSet', originalFn => function (terms, cancellable) {
        const promise = originalFn.call(this, terms, cancellable);

        return promise.then(results => extension._appendReadingSearchResults(results, terms));
      });
  }

  // 手动更新检索缓存：对当前策略执行 updateCache()（若实现，允许异步，
  // 如下载最新词典），随后作废并立即重建运行时索引。
  // 当前无策略（off / auto 且语言无匹配）时无事可做，静默返回。
  _refreshSearchCache() {
    const strategy = resolveStrategy(
      this._settings.get_string('reading-search'),
      GLib.get_language_names());

    if (!strategy)
      return;

    // 置空后立即重建，保证下一次搜索无需等待
    const rebuild = () => {
      this._searchIndex = null;
      this._searchIndexStrategyId = null;
      this._searchIndexDirty = true;
      this._resolveSearchIndex();
    };

    if (typeof strategy.updateCache === 'function') {
      Promise.resolve()
        .then(() => strategy.updateCache())
        .then(rebuild)
        .catch(e => logError(e, `updateCache failed for strategy '${strategy.id}'`));
    } else {
      rebuild();
    }
  }

  // 解析当前生效的检索策略并按需重建索引；策略未变时复用已有索引，
  // 避免每次按键都重扫应用列表
  _resolveSearchIndex() {
    const strategy = resolveStrategy(
      this._settings.get_string('reading-search'),
      GLib.get_language_names());

    if (!strategy) {
      this._searchIndex = null;
      this._searchIndexStrategyId = null;
      return null;
    }

    if (this._searchIndex && this._searchIndexStrategyId === strategy.id && !this._searchIndexDirty)
      return this._searchIndex;

    const index = strategy.createIndex();

    for (const app of this._appSystem.get_installed()) {
      if (!app.should_show())
        continue;

      // get_display_name() 返回当前 locale 的应用名（zh_CN 下为中文名）
      index.add(app.get_id(), [app.get_display_name()]);
    }

    this._searchIndex = index;
    this._searchIndexStrategyId = strategy.id;
    this._searchIndexDirty = false;
    return index;
  }

  _appendReadingSearchResults(results, terms) {
    const query = terms.join('');

    if (!query)
      return results;

    const index = this._resolveSearchIndex();

    if (!index)
      return results;

    const existing = new Set(results);
    const matchedIds = index.search(query)
      .filter(id => !existing.has(id))
      .map(id => this._appSystem.lookup_app(id))
      .filter(app => app && this._parentalControls.shouldShowApp(app.app_info))
      .map(app => app.get_id());

    // 与原生结果一致，按使用频率排序
    matchedIds.sort((a, b) => this._appUsage.compare(a, b));

    // 插入到末尾的系统动作（非 .desktop id）之前，保持原生结果优先
    let insertAt = results.length;
    while (insertAt > 0 && !results[insertAt - 1].endsWith('.desktop'))
      insertAt--;
    results.splice(insertAt, 0, ...matchedIds);

    return results;
  }

  disable() {
    if (this._installedChangedId) {
      this._appSystem.disconnect(this._installedChangedId);
      this._installedChangedId = 0;
    }

    if (this._cacheRefreshId) {
      this._settings.disconnect(this._cacheRefreshId);
      this._cacheRefreshId = 0;
    }

    this._overviewLayoutManager._appDisplay = this._overviewControls.appDisplay;

    this._overviewControls.remove_child(this._vertAppDisplay);
    this._injectionManager.clear();
    this._vertAppDisplay.destroy();

    this._overviewControls.appDisplay._disconnectDnD();
    this._overviewControls.appDisplay._connectDnD();

    this._settings = null;
    this._vertAppDisplay = null;
    this._injectionManager = null;
    this._overviewControls = null;
    this._overviewLayoutManager = null;

    this._appSystem = null;
    this._appUsage = null;
    this._parentalControls = null;
    this._searchIndex = null;
    this._searchIndexStrategyId = null;
    this._searchIndexDirty = true;
  }
}
