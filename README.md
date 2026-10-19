# Ez Launcher

A GNOME Shell extension that turns the default horizontal app grid into a
vertical one. App icon size and spacing can be customized in the extension
preferences.

## About

This project is a fork of [Vertical App Grid](https://github.com/lublst/gnome-vertical-app-grid) by Lukas Bleisteiner. It has been enhanced with additional features while maintaining compatibility with the original codebase.

## Features

- Vertical app grid layout
- Customizable icon size and spacing
- Category grouping with configurable categories
- Smooth scrolling animation
- Favorites management
- Reading search (pinyin) for Chinese app names — search by full pinyin, initials, mixed input or prefix
- Reading search is extensible by locale — add romaji for Japanese, jamo for Korean, etc. via the strategy interface
- Built-in search cache refresh button in preferences
- Multilingual support (English, Chinese)

## Updates

**2026-10-19**
- Add reading search framework with pluggable strategy interface
- Implement zh-pinyin strategy supporting full pinyin, initials, mixed input and prefix matching
- Add preferences: reading-search selector (off/auto/策略 id) and cache refresh button
- Add unit tests for pinyin matching engine

**2026-06-25**
- Add category grouping feature
- Add category grouping configuration
- Add Chinese translation
- Improved favorites sync functionality

## License

This project is licensed under the GNU General Public License v3.0. See [LICENSE](LICENSE) for details.

## Default layout
![Screenshot](assets/vertical-app-grid.png)

## Group layout by category
![Screenshot](assets/vertical-app-grid-categorize.png)
