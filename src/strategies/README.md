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
| `id` | string | ✅ | 唯一标识，存入 gsettings 的 `reading-search` 键；与目录名后缀对应（如 `zh-pinyin` 目录下 id 为 `pinyin`） |
| `label` | string | ✅ | 设置界面展示名，会被 gettext 扫描 |
| `locales` | string[] | ✅ | `auto` 模式下按语言主子标签自动选中的匹配列表（如 `['zh']`、`['ja']`） |
| `createIndex()` | fn → Index | ✅ | 每次调用返回**全新**的索引实例，不能复用单例 |
| `updateCache()` | fn → void/Promise | ❌ | 手动「更新检索缓存」时调用；拼音策略词典内置于扩展包故仅重置内存缓存 |

Index 对象必须提供三个方法：

| 方法 | 说明 |
|---|---|
| `add(id, names)` | 添加应用：`id` 为 `.desktop` id，`names` 为候选名列表（含 Name/GenericName/翻译条目），应全部建索引 |
| `search(query)` | 返回命中的 id 数组即可，**不需要排序**——extension 会与原生搜索合并后按使用频率排序 |
| `clear()` | 清空索引（应用增删后整体重建时调用） |

## 🚀 新增策略的三步走

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

## 🧪 测试建议

`zh-pinyin` 的单元测试用 GJS 独立跑（不依赖 GNOME Shell 运行时）：

```bash
gjs -m tools/test-pinyinSearch.js
```

新策略建议复用同样模式：测试文件放 `tools/` 下，纯 JS 逻辑便于 CI 校验。

## 📚 词典数据来源

| 语种 | 推荐数据源 |
|---|---|
| 中文 | [mozillazg/pinyin-data](https://github.com/mozillazg/pinyin-data)（已用 `tools/gen-pinyin-data.py` 提取 GB2312 常用字） |
| 日语 | [kazuhikoarase/yomigana-dict](https://github.com/kazuhikoarase/yomigana-dict) 或 [sudachidict](https://github.com/WorksApplications/SudachiDict) |
| 韩语 | [kaist-ucs/jamo](https://github.com/kaist-ucs/jamo) 分解，或 [koalanlp](https://github.com/koalanlp/koalanlp) 语料 |
| 越南语/欧洲语言 | 直接在 engine.js 里做 Unicode 归一化 + 去变音符号，**不需要**额外词典文件 |

## 🤖 AI 开发提示

当用户提出「给 XX 语也加读音搜索」时：

1. **不要改** `src/searchStrategies.js` 的框架代码和 `extension.js` 的覆写逻辑
2. 按上面三步走新建策略目录，最小骨架是 `index.js`（engine/data 可省略——比如欧洲语言的去变音归一化只需要一个 Index 类）
3. 接口契约的四个红线：`createIndex` 返回新实例、`add` 索引全部候选名、`search` 不排序、`updateCache` 允许异步
4. 参考 `zh-pinyin/` 的实现模式，但**不要直接复制** DP 匹配——越南语/欧洲语言只需要字符串归一化，逻辑更简单
5. 注册完成后跑一下 `gjs -m tools/test-pinyinSearch.js`（或写新测试）确认框架没被破坏
