/*
读音检索框架：按语言/区域提供不同的"输入形式 → 应用名"检索能力。
例如：中文拼音（zh）、日语罗马字（ja）、韩语初声（ko）、越语去声调（vi）等，
它们的共同点是都需要为应用名的"存储形式"建立一层可检索的"输入形式"索引。
============================================================================
开发者接入说明
============================================================================
每个策略是一个纯 JS 对象，实现以下接口并通过 registerStrategy() 注册：
  {
    id: 'romaji',                // 唯一 id，存入 gsettings 的 reading-search 键
    label: 'Romaji (ローマ字)',   // 设置界面展示名（作为 gettext 的 msgid）
    locales: ['ja'],             // reading-search='auto' 时按语言主子标签自动选中
    createIndex() {              // 每次调用返回一个全新索引实例
      return {
        add(id, names) {},       // 添加应用：id 为 .desktop id，names 为候选名列表（当前传入 get_display_name()）
        search(query) {},        // 查询：返回命中的 id 数组（按索引内顺序）
        clear() {},              // 可选：清空索引；当前框架直接丢弃旧实例，不依赖它
      };
    },
    updateCache() {},            // 可选：手动"更新检索缓存"时调用，允许返回 Promise
  }
接入步骤（无需改动 gschema 与 prefs 界面）：
  1. 在 src/strategies/<语言-id>/（如 zh-pinyin）下新建策略目录：
      index.js 为策略定义，引擎与词典等同目录自包含
  2. 在本文件底部的"策略注册区"调用 registerStrategy()
注册后：设置界面的下拉框会自动出现该选项；用户选择该 id 后，
extension.js 会在搜索时按需调用 createIndex() 建索引并按 search() 合并结果，
应用增删后丢弃旧索引、下次搜索时重建。
设置里的「更新检索缓存」按钮会调用策略的 updateCache()（可选实现，
用于更新词典等外部缓存），随后 extension 重建运行时索引。
============================================================================
开发提示
============================================================================
【策略接入说明】
  - 要给某个语种加读音搜索时，不要改本文件的框架代码，
    只需要在 src/strategies/ 下新建目录，然后在文件底部注册就行。
  - extension.js 里的覆写逻辑是所有策略共用的，没事不要动它。
【策略目录结构】
  每个策略目录至少要有 index.js（导出策略对象），其它文件按需：
    src/strategies/ja-romaji/
      ├── index.js      ← 必须：策略定义
      ├── engine.js     ← 可选：匹配引擎，可以参考 zh-pinyin/engine.js
      └── data.js       ← 可选：静态词典，不需要词典的话就不用建
【接口说明】
  - createIndex() 每次都要返回全新的索引实例，不能复用单例；
    extension.js 在应用增删后会丢弃旧索引，下次搜索时重建，旧实例不能残留状态。
  - add(id, names) 里的 names 是候选应用名列表，策略因该全部建索引，
    这样命中率才高。
  - search(query) 返回命中的 id 数组就可以了，不需要排序；
    extension.js 会跟原生搜索合并后再按使用频率排。
  - updateCache() 可以返回 Promise，如果策略要联网下词典，
    这里是唯一的入口；拼音词典内置在扩展包里，所以只重置内存缓寸。
【locale 匹配】
  locales 里填语言主子标签（比如 ['ja']、['ko']），框架会把
  GLib.get_language_names() 的每一项按 split(/[-_.@]/)[0] 截断后比对，
  所以 ja_JP.UTF-8 也能命中 ['ja']。多语种环境下第一个匹配到的策略胜出。
【词典从哪来】
  - 中文：mozillazg/pinyin-data，已经用 tools/gen-pinyin-data.py 提过了
  - 日语：kazuhikoarase/yomigana-dict 或 sudachidict 都可以
  - 韩语：kaist-ucs/jamo 分解，或者用 koalanlp 的语料
  - 越南语/欧洲语言：直接在 engine.js 里做 Unicode 归一化和去变音符号，
    不的在需要额外词典文件
============================================================================
 */
const STRATEGIES = new Map();

/**
 * 注册检索策略。
 * id 冲突或接口不完整时直接抛错，便于开发期发现问提。
 */
export function registerStrategy(strategy) {
  const id = strategy && strategy.id;

  if (!id || typeof strategy.createIndex !== 'function' ||
      typeof strategy.label !== 'string' || !Array.isArray(strategy.locales)) {
    throw new Error(`Invalid search strategy: ${id}`);
  }

  if (STRATEGIES.has(id)) {
    throw new Error(`Duplicate search strategy id: ${id}`);
  }

  STRATEGIES.set(id, strategy);
}

/**
 * 按 id 获取策略，不存在时返回 null。
 */
export function getStrategy(id) {
  const strategy = STRATEGIES.get(id);

  return strategy == null ? null : strategy;
}

/**
 * 返回所有已注册的策略。
 */
export function listStrategies() {
  return [...STRATEGIES.values()];
}

/**
 * auto 模式下按语言名列表的主子标签（zh_CN.UTF-8 → zh）依次匹配策略 locales。
 */
export function detectStrategyId(languageNames) {
  if (languageNames == null) {
    return null;
  }

  for (const languageName of languageNames) {
    const primary = String(languageName).split(/[-_.@]/)[0].toLowerCase();

    if (primary.length === 0 || primary === 'c') {
      continue; // 跳过 'C'/'POSIX' 等非语言项
    }

    for (const strategy of STRATEGIES.values()) {
      for (const locale of strategy.locales) {
        if (locale.toLowerCase() === primary) {
          return strategy.id;
        }
      }
    }
  }

  return null;
}

/**
 * 把设置值解析为策略实例。
 * 'off'、空值或未知 id（如策略被移除）返回 null。
 */
export function resolveStrategy(value, languageNames) {
  if (value == null || value === '') {
    return null;
  }

  if (value === 'off') {
    return null;
  }

  if (value === 'auto') {
    const id = detectStrategyId(languageNames);

    if (id == null) {
      return null;
    }

    const strategy = STRATEGIES.get(id);

    return strategy == null ? null : strategy;
  }

  const strategy = STRATEGIES.get(value);

  return strategy == null ? null : strategy;
}

// ============================================================================
// 策略注册区：新增策略后在此登记
// ============================================================================
import { pinyinStrategy } from './strategies/zh-pinyin/index.js';

registerStrategy(pinyinStrategy);
