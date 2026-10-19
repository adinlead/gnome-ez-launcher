// zh-pinyin（中文拼音）检索策略的匹配引擎。
//
// 匹配能力（对每个汉字可任选其一，自左向右消耗查询串）：
//   - 全拼：    weixin  -> 微信
//   - 首字母：  wx      -> 微信
//   - 混合：    微x     -> 微信（汉字直输 + 首字母任意组合）
//   - 直接汉字：微x     -> 微信
//   - 前缀：    weix    -> 微信（输入过程中实时匹配）
//
// 词典来自 ./data.js（tools/gen-pinyin-data.py 生成，GB2312 常用字，
// 多音字保留全部读音且默认读音排最前）。
// 本模块为纯 JS 实现（不依赖 GJS 的 gi 模块），便于用 gjs 独立做单元测试。
import PINYIN_DATA from './data.js';

// 词典缓存：字符 -> 读音数组，首次访问时解析，避免扩展加载时的开销
let _dict = null;

// 清空词典运行时缓存：供策略的 updateCache() 在词典数据可能已变化时调用，
// 下次 buildSequence 会重新解析 data.js
export function clearDictCache() {
  _dict = null;
}

function getDict() {
  if (!_dict) {
    _dict = new Map();
    for (const line of PINYIN_DATA.split('\n')) {
      if (line.length < 2)
        continue;
      _dict.set(line[0], line.slice(1).split(','));
    }
  }
  return _dict;
}

// 构造匹配序列：名称中的每个字符对应一个"单元"
//   Han 字符：  { pys: [全部读音], han: 字符本身 }
//   ASCII 字符：{ pys: [字符本身] }（按字面匹配，如 WPS -> 'wps'）
//   空白/符号： { skip: true }（匹配时可跳过）
function buildSequence(name) {
  const seq = [];

  for (const ch of name.toLowerCase()) {
    const readings = getDict().get(ch);

    if (readings) {
      seq.push({pys: readings, han: ch});
    } else if (/[a-z0-9]/.test(ch)) {
      seq.push({pys: [ch]});
    } else {
      // 空格、标点及未收录字符：允许匹配时跳过
      seq.push({skip: true});
    }
  }

  return seq;
}

// DP 匹配：判断 query 能否被序列按规则消耗完。
// 匹配允许从名称的任意单元开始（子串语义，如 'office' 命中 'WPS Office'），
// 记忆化避免多音字枚举的重复子问题。
function matchSequence(seq, rawQuery) {
  // 查询串统一小写并剔除空格/标点，仅保留字母数字与汉字
  const query = rawQuery.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');

  if (!query)
    return false;

  let memo = new Map();

  function dfs(unitIdx, pos) {
    // 查询已耗尽即匹配成功（前缀语义：允许名称尚未走完）
    if (pos === query.length)
      return true;
    if (unitIdx === seq.length)
      return false;

    const key = unitIdx * 512 + pos;
    const cached = memo.get(key);
    if (cached !== undefined)
      return cached;

    const unit = seq[unitIdx];
    let result = false;

    if (unit.skip) {
      result = dfs(unitIdx + 1, pos);
    } else {
      const tail = query.slice(pos);

      for (const reading of unit.pys) {
        // 汉字与查询字符直接相等（支持直接输入汉字）
        if (unit.han === query[pos] && dfs(unitIdx + 1, pos + 1)) {
          result = true;
          break;
        }
        // 完整读音匹配
        if (query.startsWith(reading, pos) && dfs(unitIdx + 1, pos + reading.length)) {
          result = true;
          break;
        }
        // 首字母匹配
        if (reading[0] === query[pos] && dfs(unitIdx + 1, pos + 1)) {
          result = true;
          break;
        }
        // 查询串尾部是某读音的前缀（支持输入中途的实时匹配，
        // 如 "weix" -> 微信：'wei' 匹配"微"，'x' 是"信"读音 'xin' 的前缀）
        if (tail.length > 0 && tail.length < reading.length && reading.startsWith(tail)) {
          result = true;
          break;
        }
      }
    }

    memo.set(key, result);
    return result;
  }

  // 尝试从名称的每个单元开始匹配（每个起点重置记忆化缓存）
  for (let start = 0; start < seq.length; start++) {
    memo = new Map();
    if (dfs(start, 0))
      return true;
  }
  return false;
}

// 单次匹配（测试与一次性场景使用）
export function matchPinyin(name, query) {
  return matchSequence(buildSequence(name), query);
}

// 应用搜索索引：按需添加 id + 名称，之后用 search() 查询
export class PinyinIndex {
  constructor() {
    this._entries = []; // {id, seq}
  }

  // names 可传入多个（如本地化名称与关键字），任一匹配即命中
  add(id, names) {
    for (const name of names) {
      if (!name)
        continue;
      const seq = buildSequence(name);
      if (seq.some(unit => !unit.skip))
        this._entries.push({id, seq});
    }
  }

  clear() {
    this._entries = [];
  }

  // 返回命中的 id 列表（按加入顺序）；查询串的归一化在 matchSequence 内完成
  search(query) {
    if (!query)
      return [];

    const out = [];
    for (const entry of this._entries) {
      if (matchSequence(entry.seq, query))
        out.push(entry.id);
    }
    return out;
  }
}
