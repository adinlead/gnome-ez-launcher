// 读音检索框架：按语言/区域提供不同的"输入形式 → 应用名"检索能力。
//
// 例如：中文拼音（zh）、日语罗马字（ja）、韩语初声（ko）、越语去声调（vi）等，
// 它们的共同点是都需要为应用名的"存储形式"建立一层可检索的"输入形式"索引。
//
// ============================================================================
// 开发者接入说明
// ============================================================================
// 每个策略是一个纯 JS 对象，实现以下接口并通过 registerStrategy() 注册：
//
//   {
//     id: 'romaji',                // 唯一 id，存入 gsettings 的 reading-search 键
//     label: 'Romaji (ローマ字)',   // 设置界面展示名（作为 gettext 的 msgid）
//     locales: ['ja'],             // reading-search='auto' 时按语言主子标签自动选中
//     createIndex() {              // 每次调用返回一个全新索引实例
//       return {
//         add(id, names) {},       // 添加应用：id 为 .desktop id，names 为候选名列表
//         search(query) {},        // 查询：返回命中的 id 数组（按索引内顺序）
//         clear() {},              // 清空（应用列表变化时整体重建）
//       };
//     },
//     updateCache() {},            // 可选：手动"更新检索缓存"时调用，允许返回 Promise
//   }
//
// 接入步骤（无需改动 gschema 与 prefs 界面）：
//   1. 在 src/strategies/<语言-id>/（如 zh-pinyin）下新建策略目录：
//      index.js 为策略定义，引擎与词典等同目录自包含
//   2. 在本文件底部的"策略注册区"调用 registerStrategy()
//
// 注册后：设置界面的下拉框会自动出现该选项；用户选择该 id 后，
// extension.js 会在搜索时调用 createIndex() 建索引并按 search() 合并结果。
// 设置里的「更新检索缓存」按钮会调用策略的 updateCache()（可选实现，
// 用于更新词典等外部缓存），随后 extension 重建运行时索引。
//
// ============================================================================
// 🤖 AI 开发提示（给后续 Agent）
// ============================================================================
// 【何时介入】
//   - 用户说"加日语罗马字搜索"、"支持韩语初声"、"XX 语也按读音搜"时，
//     不要改本文件的框架代码——只需在 src/strategies/ 下新建目录并注册。
//   - 不要修改 extension.js 里的覆写逻辑，它对所有策略是通用的。
//
// 【最小可行策略骨架】
//   每个策略目录必须包含 index.js（导出策略对象），其余文件按需：
//     src/strategies/ja-romaji/
//       ├── index.js      ← 必须：策略定义 + 注册
//       ├── engine.js     ← 可选：匹配引擎（zh-pinyin 的 engine.js 可作参考）
//       └── data.js       ← 可选：静态词典（若不需要词典可省略，如 vi 去声调）
//
// 【接口契约红线】
//   - createIndex() 每次必须返回**全新**的索引实例，不能复用单例——extension.js
//     会在应用增删后 clear() + 重建，旧实例不能残留状态
//   - add(id, names) 中 names 是 .desktop 文件的候选名列表（含 Name/GenericName/
//     翻译条目），策略应全部建索引以最大化命中率
//   - search(query) 返回命中 id 数组即可，不需要排序；extension.js 会与原生
//     搜索合并后按使用频率排序，策略内排序是多余的
//   - updateCache() 允许返回 Promise——如果策略需要联网下载词典，这里是唯一
//     入口；拼音策略词典内置于扩展包，故只重置内存缓存
//
// 【locale 匹配规则】
//   locales 数组里填语言主子标签（如 ['ja']、['ko']、['vi']），框架对
//   GLib.get_language_names() 的每个值取 split(/[-_.@]/)[0] 后比对，
//   所以 ja_JP.UTF-8 也能命中 ['ja']。多语种环境下第一个匹配的策略胜出。
//
// 【词典数据来源建议】
//   - 中文：mozillazg/pinyin-data（已用，见 tools/gen-pinyin-data.py）
//   - 日语：github.com/kazuhikoarase/yomigana-dict 或 sudachidict
//   - 韩语：kaist-ucs/jamo 分解，或 koalanlp 语料
//   - 越南语/欧洲语言：直接在 engine.js 里做 Unicode 归一化 + 去变音符号，
//     不需要额外词典文件
// ============================================================================

const _strategies = new Map();

// 注册策略；id 冲突或接口不完整时直接抛错，便于开发期发现问题
export function registerStrategy(strategy) {
  const id = strategy && strategy.id;

  if (!id || typeof strategy.createIndex !== 'function' ||
      typeof strategy.label !== 'string' || !Array.isArray(strategy.locales))
    throw new Error(`Invalid search strategy: ${id}`);

  if (_strategies.has(id))
    throw new Error(`Duplicate search strategy id: ${id}`);

  _strategies.set(id, strategy);
}

export function getStrategy(id) {
  return _strategies.get(id) ?? null;
}

export function listStrategies() {
  return [..._strategies.values()];
}

// auto 模式检测：按语言名列表的"主子标签"（zh_CN.UTF-8 → zh）依次匹配策略 locales
export function detectStrategyId(languageNames) {
  for (const lang of languageNames ?? []) {
    const primary = String(lang).split(/[-_.@]/)[0].toLowerCase();

    if (!primary || primary === 'c')
      continue; // 跳过 'C'/'POSIX' 等非语言项

    for (const strategy of _strategies.values()) {
      if (strategy.locales.some(locale => locale.toLowerCase() === primary))
        return strategy.id;
    }
  }

  return null;
}

// 把设置值解析为策略实例；'off'、空值或未知 id（如策略被移除）返回 null
export function resolveStrategy(value, languageNames) {
  if (!value || value === 'off')
    return null;

  if (value === 'auto') {
    const id = detectStrategyId(languageNames);
    return id ? _strategies.get(id) : null;
  }

  return _strategies.get(value) ?? null;
}

// ============================================================================
// 策略注册区：新增策略后在此登记
// ============================================================================
import { pinyinStrategy } from './strategies/zh-pinyin/index.js';

registerStrategy(pinyinStrategy);
