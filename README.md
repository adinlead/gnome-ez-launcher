# Ez Launcher

将 GNOME Shell 默认的横向应用网格改为纵向排列的扩展。图标大小与间距可在偏好设置中自定义。

A GNOME Shell extension that turns the default horizontal app grid into a
vertical one. App icon size and spacing can be customized in the extension
preferences.

## 关于

本项目是 [Vertical App Grid](https://github.com/lublst/gnome-vertical-app-grid)（作者 Lukas Bleisteiner）的分支，在保持与原代码库兼容的前提下增加了多项增强功能。

This project is a fork of [Vertical App Grid](https://github.com/lublst/gnome-vertical-app-grid) by Lukas Bleisteiner. It has been enhanced with additional features while maintaining compatibility with the original codebase.

## 功能

- 纵向应用网格布局
- 可自定义图标大小与间距
- 按分类分组，分组类别可配置
- 平滑滚动动画
- 收藏夹管理
- 中文应用名读音搜索（拼音）——支持全拼、首字母、混合输入与前缀匹配
- 读音检索可按语种扩展——通过策略接口即可加入日语罗马字、韩语初声等
- 偏好设置中内置「更新检索缓存」按钮
- 多语言支持（中文、英文）

## Features

- Vertical app grid layout
- Customizable icon size and spacing
- Category grouping with configurable categories
- Smooth scrolling animation
- Favorites management
- Reading search (pinyin) for Chinese app names — search by full pinyin, initials, mixed input or prefix
- Reading search is extensible by locale — add romaji for Japanese, jamo for Korean, etc. via the strategy interface
- Built-in search cache refresh button in preferences
- Multilingual support (Chinese, English)

## 更新日志

**2026-10-19**
- 新增读音检索框架，采用可插拔的策略接口
- 实现 zh-pinyin 策略，支持全拼、首字母、混合输入与前缀匹配
- 偏好设置新增读音检索选择器（关闭 / 自动 / 策略 id）与缓存刷新按钮
- 新增拼音匹配引擎单元测试

**2026-06-25**
- 新增按分类分组功能
- 新增分组配置
- 新增中文翻译
- 改进收藏夹同步功能

## Updates

**2026-10-19**
- Add reading search framework with pluggable strategy interface
- Implement zh-pinyin strategy supporting full pinyin, initials, mixed input and prefix matching
- Add preferences: reading-search selector (off/auto/strategy id) and cache refresh button
- Add unit tests for pinyin matching engine

**2026-06-25**
- Add category grouping feature
- Add category grouping configuration
- Add Chinese translation
- Improved favorites sync functionality

## 开发指南 / Development Guide

### 目录结构

```
src/
├── searchStrategies.js      ← 读音检索框架入口：注册表 + 接口文档 + AI 提示
├── extension.js             ← Shell 扩展主逻辑：覆写 AppSearchProvider
├── prefs.js / prefs.ui      ← 偏好设置界面（策略下拉框自动填充）
├── schemas/                 ← GSettings schema
└── strategies/              ← 各语种策略（每个语种一个子目录）
    └── zh-pinyin/           ← 中文拼音策略（当前唯一实现，可作模板）
        ├── index.js         ← 策略定义（导出策略对象 + 注册）
        ├── engine.js        ← 匹配引擎（DP 消耗匹配，纯 JS 便于单测）
        └── data.js          ← 词典（GB2312 常用字，tools/gen-pinyin-data.py 生成）
```

### 新增语种的读音检索

框架已为每个策略预留独立子目录，新增语种**无需改动 gschema 或 prefs 界面**，仅需三步走：

1. 在 `src/strategies/<语言-id>/` 下新建目录，编写 `index.js` 导出策略对象（必须实现 `id`、`label`、`locales`、`createIndex()`，可选 `updateCache()`）
2. 按需要编写匹配引擎 `engine.js` 和静态词典 `data.js`（欧洲语言去变音归一化甚至不需要词典文件）
3. 在 `src/searchStrategies.js` 底部注册：`import { newStrategy } from './strategies/<语言-id>/index.js'; registerStrategy(newStrategy);`

完成后设置下拉框自动出现该选项，`auto` 模式下按当前语言主子标签自动命中。详细接口契约与 AI 提示见 [src/searchStrategies.js](file:///home/adinlead/Projects/gnome/gnome-vertical-app-grid/src/searchStrategies.js) 头部注释与 [src/strategies/README.md](file:///home/adinlead/Projects/gnome/gnome-vertical-app-grid/src/strategies/README.md)。

### 常用命令

```bash
./install.sh                         # 安装扩展（支持 gnome-extensions install，失败自动兜底为 unzip）
gjs -m tools/test-pinyinSearch.js    # 运行拼音引擎单元测试
python3 tools/gen-pinyin-data.py     # 重新生成拼音词典 src/strategies/zh-pinyin/data.js
msgfmt -o src/locale/zh_CN/LC_MESSAGES/ez-launcher@linux.itez.cc.mo src/po/zh_CN.po
```

### Adding a New Language Strategy

The framework keeps each strategy in its own subdirectory — adding a new language requires **no changes to gschema or prefs UI**. Three steps only:

1. Create `src/strategies/<lang-id>/` and write `index.js` exporting a strategy object (must implement `id`, `label`, `locales`, `createIndex()`; optional `updateCache()`)
2. Add `engine.js` for the matcher and `data.js` for a static dictionary if needed (European-language accent folding needs no dictionary file at all)
3. Register at the bottom of `src/searchStrategies.js`: `import { newStrategy } from './strategies/<lang-id>/index.js'; registerStrategy(newStrategy);`

Done — the preferences dropdown automatically shows the new option, and `auto` mode picks it up by the current language's primary subtag. Full interface contract and AI hints in [src/searchStrategies.js](file:///home/adinlead/Projects/gnome/gnome-vertical-app-grid/src/searchStrategies.js) header and [src/strategies/README.md](file:///home/adinlead/Projects/gnome/gnome-vertical-app-grid/src/strategies/README.md).

### Useful Commands

```bash
./install.sh                         # Install extension (uses gnome-extensions install, falls back to unzip)
gjs -m tools/test-pinyinSearch.js    # Run pinyin engine unit tests
python3 tools/gen-pinyin-data.py     # Regenerate pinyin dictionary src/strategies/zh-pinyin/data.js
msgfmt -o src/locale/zh_CN/LC_MESSAGES/ez-launcher@linux.itez.cc.mo src/po/zh_CN.po
```

## 许可证

本项目基于 GNU General Public License v3.0 许可发布。详见 [LICENSE](LICENSE)。

This project is licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE) for details.

## 默认布局 / Default layout

![Screenshot](assets/vertical-app-grid.png)

## 按分类分组布局 / Group layout by category

![Screenshot](assets/vertical-app-grid-categorize.png)
