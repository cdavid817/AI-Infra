#!/usr/bin/env node
// Prompt 包静态检查:确保 v4 的证据、编辑与视觉纪律齐全,31 章逐章 Prompt 完整。
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { report } from './lib/diagnostics.mjs';

export function checkPrompts(text) {
  const diagnostics = [];
  const need = (cond, message) => {
    if (!cond) diagnostics.push({ file: 'ai-infra-book-prompts.md', line: 0, rule: 'prompt-structure', message });
  };

  for (const section of [
    '证据纪律(总则',
    'Research Pack 阶段(强制)',
    '作者内部检查问题',
    '交付物制度',
    '单点定义原则',
    '视觉与 Mermaid 规范',
    '事实与口径审查 Prompt',
    '语言与结构审查 Prompt',
  ]) {
    need(text.includes(section), `公共层缺少段落:${section}`);
  }

  need(text.includes('public-case') && text.includes('synthetic-case'), '案例规则未包含六类机器可读类型');
  need(!text.includes('每章必须依次包含以下七段'), '仍在强制可见七段骨架');
  need(!text.includes('每一节结束前,回答"所以这对做平台的人意味着什么"'), '仍在强制统一收束问句');
  need(!text.includes('没有理由再用"),但立场必须有依据支撑'), '残留 v2 的年份断言式强观点模板');

  for (let n = 1; n <= 31; n++) {
    const heading = `撰写第 ${n} 章`;
    need(text.includes(heading), `缺少第 ${n} 章的逐章 Prompt(未找到「${heading}」)`);
    if (text.includes(heading)) {
      const start = text.indexOf(heading);
      const end = text.indexOf('撰写第', start + heading.length);
      const block = text.slice(start, end === -1 ? undefined : end);
      need(/(?:视觉规划|Mermaid 图)/.test(block), `第 ${n} 章 Prompt 缺少视觉规划`);
    }
  }
  need(text.includes('撰写附录'), '缺少附录写作 Prompt');
  return diagnostics;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const text = readFileSync('ai-infra-book-prompts.md', 'utf8');
  report(checkPrompts(text), { okMessage: 'Prompt v4 结构检查通过:证据、编辑与视觉纪律齐全,31 章逐章 Prompt 完整。' });
}
