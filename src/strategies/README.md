# 读音检索策略开发指南

本目录按语种组织各读音检索策略，每个子目录自包含一个策略的全部实现。

## 📁 目录约定

```
src/strategies/
├── zh-pinyin/           ← 中文拼音（当前唯一已实现的策略，可作参考模板）
│   ├── index.js         ← 策略定义（必须，导出策略对象）
│   ├── engine.js        ← 匹配引擎（可选）
│   └── data.js          ← 静态词典（可选，如不需要词典可省略）
├── ja-romaji/           ← 日语罗马字（待实现）
└── ko-jamo/             ← 韩语初声（待实现）
```

> **命名规则**：子目录名 = `<语言主子标签>-<策略类型>`，如 `zh-pinyin`、`ja-romaji`、`ko-jamo`。

## 🔌 接口契约

每个策略必须导出一个对象，包含以下字段：

| 字段 | 类型 | 必须 | 说明 |
|---|---|---|---|
| `id` | string | [✔] | 唯一标识，存入 gsettings 的 `reading-search` 键；与目录名后缀对应（如 `zh-pinyin` 目录下 id 为 `pinyin`） |
| `label` | string | [✔] | 设置界面展示名，会被 gettext 扫描 |
| `locales` | string[] | [✔] | `auto` 模式下按语言主子标签自动选中的匹配列表（如 `['zh']`、`['ja']`） |
| `createIndex()` | fn → Index | [✔] | 每次调用返回**全新**的索引实例，不能复用单例 |
| `updateCache()` | fn → void/Promise | [x] | 手动「更新检索缓存」时调用；拼音策略词典内置于扩展包故仅重置内存缓存 |

Index 对象需提供以下方法（`clear()` 为可选）：

| 方法 | 说明 |
|---|---|
| `add(id, names)` | 添加应用：`id` 为 `.desktop` id，`names` 为候选名列表（当前调用方传入 `get_display_name()`；策略应能处理多个名称） |
| `search(query)` | 返回命中的 id 数组即可，**不需要排序**——extension 会与原生搜索合并后按使用频率排序 |
| `clear()` | 可选：清空索引；当前框架通过丢弃旧实例重建，不依赖该方法 |

## 🚀 新增策略三步走

以「日语罗马字搜索」为例：

**第 1 步**：创建目录 `src/strategies/ja-romaji/`，编写 `index.js`：

```js
// src/strategies/ja-romaji/index.js
import { RomajiIndex } from './engine.js';

export const romajiStrategy = {
  id: 'romaji',
  label: 'Romaji (ローマ字)',
  locales: ['ja'],

  createIndex() {
    return new RomajiIndex();
  },

  // 可选：若词典需要联网更新，在此返回 Promise
  // async updateCache() { await downloadDict(); }
};
```

**第 2 步**：实现匹配引擎 `engine.js`（参考 `zh-pinyin/engine.js` 的 DP 消耗匹配模式）。

**第 3 步**：在 `src/searchStrategies.js` 底部注册：

```js
import { romajiStrategy } from './strategies/ja-romaji/index.js';
registerStrategy(romajiStrategy);
```

**完成**——设置下拉框自动多出该选项，`auto` 模式下 `ja_JP.UTF-8` 用户自动命中。

## 📚 词典数据来源

| 语种 | 推荐数据源 |
|---|---|
| 中文 | [mozillazg/pinyin-data](https://github.com/mozillazg/pinyin-data)（已用 `tools/gen-pinyin-data.py` 提取 GB2312 常用字） |
| 日语 | [kazuhikoarase/yomigana-dict](https://github.com/kazuhikoarase/yomigana-dict) 或 [sudachidict](https://github.com/WorksApplications/SudachiDict) |
| 韩语 | [kaist-ucs/jamo](https://github.com/kaist-ucs/jamo) 分解，或 [koalanlp](https://github.com/koalanlp/koalanlp) 语料 |
| 越南语/欧洲语言 | 直接在 engine.js 里做 Unicode 归一化 + 去变音符号，**不需要**额外词典文件 |

## 🧪 测试

```bash
gjs -m tools/test-pinyinSearch.js
```

新策略建议复用同样模式：测试文件放 `tools/` 下，纯 JS 逻辑便于 CI 校验。

---

## 开发提示

> 更完整的框架说明见 `src/searchStrategies.js` 头部注释。

### 策略接入说明

- 要给某个语种加读音搜索时，不要改 `src/searchStrategies.js` 的框架代码，只需要在 `src/strategies/` 下新建目录，然后在文件底部注册就行。
- `extension.js` 里的覆写逻辑是所有策略共用的，没事不要动它。

### 策略目录结构

每个策略目录至少要有 `index.js`（导出策略对象），其它文件按需：

```
src/strategies/ja-romaji/
  ├── index.js      ← 必须：策略定义
  ├── engine.js     ← 可选：匹配引擎，可以参考 zh-pinyin/engine.js
  └── data.js       ← 可选：静态词典，不需要词典的话就不用建
```

### 接口说明

- `createIndex()` 每次都要返回全新的索引实例，不能复用单例；extension.js 在应用增删后会丢弃旧索引，下次搜索时重建，旧实例不能残留状态。
- `add(id, names)` 里的 `names` 是候选应用名列表，策略应全部建索引，这样命中率才高。
- `search(query)` 返回命中的 id 数组就可以了，不需要排序；extension.js 会跟原生搜索合并后再按使用频率排。
- `updateCache()` 可以返回 Promise，如果策略要联网下词典，这里是唯一的入口；拼音词典内置在扩展包里，所以只重置内存缓存。

### locale 匹配

`locales` 里填语言主子标签（比如 `['ja']`、`['ko']`），框架会把 `GLib.get_language_names()` 的每一项按 `split(/[-_.@]/)[0]` 截断后比对，所以 `ja_JP.UTF-8` 也能命中 `['ja']`。多语种环境下第一个匹配到的策略胜出。

### 词典从哪来

- **中文**：mozillazg/pinyin-data，已经用 `tools/gen-pinyin-data.py` 提过了
- **日语**：kazuhikoarase/yomigana-dict 或 sudachidict 都可以
- **韩语**：kaist-ucs/jamo 分解，或者用 koalanlp 的语料
- **越南语/欧洲语言**：直接在 engine.js 里做 Unicode 归一化和去变音符号，不需要额外词典文件
