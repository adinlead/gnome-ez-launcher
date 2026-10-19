import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { listStrategies } from './searchStrategies.js';

export default class EssentialTweaksPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings();
    const builder = new Gtk.Builder();

    // Load the UI file
    builder.add_from_file(`${this.path}/prefs.ui`);
    window.add(builder.get_object('preferences-page'));

    // Bind the UI to the settings
    const properties = [
      ['animate-scroll', 'active'],
      ['columns', 'value'],
      ['favorites-section', 'active'],
      ['show-favorites-in-app-grid', 'active'],
      ['category-grouping', 'active'],
      ['icon-size', 'value'],
      ['icon-spacing', 'value']
    ];

    properties.forEach(([key, property]) => {
      settings.bind(key, builder.get_object(key), property, Gio.SettingsBindFlags.DEFAULT);
    });

    this._bindReadingSearch(builder, settings);

    this._bindComboRow(builder, settings, 'app-sorting', ['usage', 'alphabetical']);
    this._bindComboRow(builder, settings, 'favorites-sorting', ['dash', 'usage', 'alphabetical']);

    const editCategoriesBtn = builder.get_object('edit-categories-btn');
    editCategoriesBtn.connect('clicked', () => {
      console.log('Editing categories profile...');
      console.log(`File path: ${this.path}/categories.js`);

      const filePath = Gio.File.new_for_path(`${this.path}/categories.js`);
      const uri = filePath.get_uri();

      console.log(`URI: ${uri}`);

      Gio.AppInfo.launch_default_for_uri_async(uri, null, null, null, (result, error) => {
        if (error) {
          console.error(`Failed to open file: ${error.message}`);
        } else {
          console.log('File opened successfully');
        }
      });
    });
  }

  // 读音检索策略下拉框：Off / Auto + 所有已注册策略，
  // 新策略在 searchStrategies.js 注册后无需改动这里即可出现
  _bindReadingSearch(builder, settings) {
    const strategies = listStrategies();
    const values = ['off', 'auto', ...strategies.map(strategy => strategy.id)];

    // 配置中残留已移除的策略 id 时回退为 auto，避免下拉框选中越界
    if (!values.includes(settings.get_string('reading-search')))
      settings.set_string('reading-search', 'auto');

    const model = builder.get_object('reading-search-model');
    [_('Off'), _('Auto'), ...strategies.map(strategy => strategy.label)]
      .forEach(label => model.append(label));

    this._bindComboRow(builder, settings, 'reading-search', values);

    // 「更新检索缓存」按钮：prefs 与 extension 是两个进程，这里通过写入
    // 时间戳信号键通知 extension 重建当前策略的缓存（见 gschema 注释）
    builder.get_object('refresh-search-cache').connect('activated', () => {
      settings.set_uint('search-cache-refresh', Math.floor(Date.now() / 1000));
    });
  }

  _bindComboRow(builder, settings, key, values) {
    const comboRow = builder.get_object(key);

    comboRow.connect('notify::selected', () => {
      settings.set_string(key, values[comboRow.selected]);
    });

    comboRow.set_selected(values.indexOf(settings.get_string(key)));
  }
}
