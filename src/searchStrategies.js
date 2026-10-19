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
