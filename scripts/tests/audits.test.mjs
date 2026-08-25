import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeProse } from '../audit-prose-style.mjs';
import { analyzeVisuals } from '../audit-visuals.mjs';

test('正文审计忽略代码块并统计模板句与案例风险', () => {
  const result = analyzeProse('## 问题场景\n\n某公司负责人管理 32 张卡。真正的风险在这里。\n\n```\n本质上\n```\n');
  assert.equal(result.phrase_counts['真正的'], 1);
  assert.equal(result.phrase_counts['本质上'], 0);
  assert.equal(result.numeric_case_signals, 1);
  assert.equal(result.has_case_metadata, false);
});

test('视觉审计同时识别 Markdown 图片、BookFigure 与 Mermaid', () => {
  const result = analyzeVisuals('![拓扑](a.svg)\n\n<BookFigure src="b.svg" alt="曲线" caption="结论" />\n\n```mermaid\ngraph LR\n```\n');
  assert.equal(result.total_figures, 3);
  assert.equal(result.svg, 2);
  assert.equal(result.mermaid, 1);
  assert.equal(result.missing_alt, 0);
});
