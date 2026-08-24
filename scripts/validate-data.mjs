#!/usr/bin/env node
// 用法:node scripts/validate-data.mjs [--freshness-report]
// 校验 data/ 结构化数据;--freshness-report 额外把过期项写入 reports/data-freshness.md。
import { writeFileSync, mkdirSync } from 'node:fs';
import { validateData } from './lib/validate-data.mjs';
import { report } from './lib/diagnostics.mjs';

const { errors, warnings, stale } = validateData(process.cwd());
for (const w of warnings) console.warn(`WARN  ${w.file}${w.id ? ` [${w.id}]` : ''} (${w.rule}) ${w.message}`);

if (process.argv.includes('--freshness-report')) {
  mkdirSync('reports', { recursive: true });
  const lines = ['# 数据 freshness 报告', '', `生成时间以 git 提交为准;共 ${stale.length} 个过期项。`, ''];
  for (const s of stale) lines.push(`- ${s.file} [${s.id}]:reviewed_at=${s.reviewed_at},review_after_days=${s.review_after_days},已过期待复核`);
  if (stale.length === 0) lines.push('无过期项。');
  writeFileSync('reports/data-freshness.md', lines.join('\n') + '\n');
  console.log(`freshness 报告已写入 reports/data-freshness.md(${stale.length} 项)`);
}

report(errors, { okMessage: '数据检查通过:三个数据文件符合 schema,来源引用与 freshness 规则无错误。' });
