// zh-pinyin（中文拼音）检索策略。
// 汉字应用名 → 无声调读音（多音字保留全部读音，默认读音排最前）。
// 匹配引擎与词典见同目录 engine.js 与 data.js。
import { PinyinIndex, clearDictCache } from './engine.js';

export const pinyinStrategy = {
  id: 'pinyin',
  label: 'Pinyin (拼音)',
  locales: ['zh'],

  createIndex() {
    return new PinyinIndex();
  },

  // 手动「更新检索缓存」：拼音词典内置于扩展包、无外部数据需要下载，
  // 这里仅重置运行时解析缓存；索引重建由 extension 统一完成
  updateCache() {
    clearDictCache();
  },
};
