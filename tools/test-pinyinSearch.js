// gjs -m tools/test-pinyinSearch.js
// zh-pinyin 检索策略的单元测试：覆盖全拼 / 首字母 / 混合 / 汉字直输 / 前缀 / 多音字，
// 以及 searchStrategies.js 的注册表与 auto 语言检测
import {matchPinyin, PinyinIndex} from '../src/strategies/zh-pinyin/engine.js';
import {resolveStrategy, detectStrategyId} from '../src/searchStrategies.js';

let failures = 0;

function check(name, query, expected) {
  const actual = matchPinyin(name, query);
  if (actual !== expected) {
    failures++;
    console.error(`FAIL  matchPinyin(${JSON.stringify(name)}, ${JSON.stringify(query)}) = ${actual}, expected ${expected}`);
  } else {
    console.log(`ok    ${JSON.stringify(name)} <- ${JSON.stringify(query)}`);
  }
}

function checkCond(desc, cond) {
  if (!cond) {
    failures++;
    console.error(`FAIL  ${desc}`);
  } else {
    console.log(`ok    ${desc}`);
  }
}

// 全拼
check('微信', 'weixin', true);
check('支付宝', 'zhifubao', true);
check('网易云音乐', 'wangyiyunyinyue', true);

// 首字母
check('微信', 'wx', true);
check('支付宝', 'zfb', true);
check('网易云音乐', 'wyyyy', true);

// 混合
check('微信', 'wxin', true);
check('微信', 'weix', true);

// 输入过程前缀
check('微信', 'w', true);
check('微信', 'we', true);
check('支付宝', 'zhi', true);

// 直接输入汉字
check('微信', '微', true);
check('微信', '微x', true);
check('微信', '微信', true);

// 多音字（重 zhong/chong、行 hang/xing、长 zhang/chang）
check('重庆银行', 'cqyh', true);
check('重庆银行', 'chongqingyinhang', true);
check('重庆银行', 'zhongqingyinhang', true);
check('长安汽车', 'changanqiche', true);
check('长安汽车', 'caqc', true);

// 名称含 ASCII / 符号
check('WPS Office', 'wps', true);
check('WPS Office', 'office', true);
check('腾讯QQ', 'tengxunqq', true);
check('腾讯QQ', 'txqq', true);

// 不应命中
check('微信', 'xx', false);
check('支付宝', 'wx', false);
check('微信', 'zhifubao', false);

// 查询串含空格与标点
check('微信', 'wei xin', true);

// PinyinIndex：add/search/clear
const index = new PinyinIndex();
index.add('wechat.desktop', ['微信']);
index.add('alipay.desktop', ['支付宝']);
index.add('wps.desktop', ['WPS Office']);

function checkIndex(query, expectedIds) {
  const actual = index.search(query);
  const same = actual.length === expectedIds.length &&
    expectedIds.every(id => actual.includes(id));
  if (!same) {
    failures++;
    console.error(`FAIL  index.search(${JSON.stringify(query)}) = ${JSON.stringify(actual)}, expected ${JSON.stringify(expectedIds)}`);
  } else {
    console.log(`ok    index.search(${JSON.stringify(query)})`);
  }
}

checkIndex('wx', ['wechat.desktop']);
checkIndex('zfb', ['alipay.desktop']);
checkIndex('office', ['wps.desktop']);
checkIndex('', []);
checkIndex('!!!', []);

index.clear();
if (index.search('wx').length !== 0) {
  failures++;
  console.error('FAIL  index.clear() 未清空索引');
} else {
  console.log('ok    index.clear()');
}

// searchStrategies：注册表与 auto 语言检测
checkCond('detect zh_CN.UTF-8 -> pinyin', detectStrategyId(['zh_CN.UTF-8', 'zh_CN', 'zh', 'C']) === 'pinyin');
checkCond('detect de_DE -> null', detectStrategyId(['de_DE.UTF-8', 'de_DE', 'de']) === null);
checkCond('resolve off -> null', resolveStrategy('off', ['zh_CN.UTF-8']) === null);
checkCond('resolve auto(zh) -> pinyin', resolveStrategy('auto', ['zh_CN.UTF-8'])?.id === 'pinyin');
checkCond('resolve auto(de) -> null', resolveStrategy('auto', ['de_DE.UTF-8']) === null);
checkCond('resolve pinyin -> pinyin', resolveStrategy('pinyin', ['de_DE.UTF-8'])?.id === 'pinyin');
checkCond('resolve unknown id -> null', resolveStrategy('romaji', ['zh_CN.UTF-8']) === null);

const pinyinStrategyIndex = resolveStrategy('pinyin', [])?.createIndex();
checkCond('createIndex returns usable index', pinyinStrategyIndex instanceof PinyinIndex);
checkCond('pinyin strategy supports updateCache', typeof resolveStrategy('pinyin', [])?.updateCache === 'function');

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  throw new Error('pinyinSearch tests failed');
}
console.log('\nAll tests passed');
