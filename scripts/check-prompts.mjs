#!/usr/bin/env node
// Prompt 包静态检查:确保 v3 的公共纪律段落齐全、31 章逐章 Prompt 完整且含图表要求。
import { readFileSync } from 'node:fs';
import { report } from './lib/diagnostics.mjs';

export function checkPrompts(text) {
  const diagnostics = [];
  const need = (cond, message) => {
    if (!cond) diagnostics.push({ file: 'ai-infra-book-prompts.md', line: 0, rule: 'prompt-structure', message });
  };

  for (const section of [
    '证据纪律(总则',
    'Research Pack 阶段(强制)',
    '章节骨架(严格遵守',
    '交付物制度',
    '单点定义原则',
    'Mermaid 图表规范(强制)',
    '事实与口径审查 Prompt',
    '语言与结构审查 Prompt',
  ]) {
    need(text.includes(section), `公共层缺少段落:${section}`);
  }

  need(text.includes('四类案例之一'), '问题场景规则未包含案例四分类');
  need(!text.includes('没有理由再用"),但立场必须有依据支撑'), '残留 v2 的年份断言式强观点模板');

  for (let n = 1; n <= 31; n++) {
    const heading = `撰写第 ${n} 章`;
    need(text.includes(heading), `缺少第 ${n} 章的逐章 Prompt(未找到「${heading}」)`);
    if (text.includes(heading)) {
      const start = text.indexOf(heading);
      const end = text.indexOf('撰写第', start + heading.length);
      const block = text.slice(start, end === -1 ? undefined : end);
      need(/Mermaid 图/.test(block), `第 ${n} 章 Prompt 缺少 Mermaid 图数量与内容要求`);
    }
  }
  need(text.includes('撰写附录'), '缺少附录写作 Prompt');
  return diagnostics;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const text = readFileSync('ai-infra-book-prompts.md', 'utf8');
  report(checkPrompts(text), { okMessage: 'Prompt 包结构检查通过:公共纪律段落齐全,31 章逐章 Prompt 与附录 Prompt 完整。' });
}
