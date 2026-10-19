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

## 许可证

本项目基于 GNU General Public License v3.0 许可发布。详见 [LICENSE](LICENSE)。

This project is licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE) for details.

## 默认布局

![Screenshot](assets/vertical-app-grid.png)

## 按分类分组布局

![Screenshot](assets/vertical-app-grid-categorize.png)
