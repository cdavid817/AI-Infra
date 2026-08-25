#!/usr/bin/env node
// 章节能力覆盖校验:上下文、机制/证据、边界和交付物;不约束读者可见标题顺序。
// 用法:node scripts/validate-chapters.mjs [--red-report]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { relative } from 'node:path';
import { findMarkdownFiles } from './lib/files.mjs';
import { report } from './lib/diagnostics.mjs';

const rootDir = process.cwd();
const chapterFiles = findMarkdownFiles(rootDir).filter((f) => /第\d{2}章-/.test(f));

const diagnostics = [];
const redReview = [];

for (const file of chapterFiles) {
  const rel = relative(rootDir, file);
  const text = readFileSync(file, 'utf8');
  const chapter = Number(rel.match(/第(\d{2})章/)[1]);
  const need = (cond, message) => {
    if (!cond) diagnostics.push({ file: rel, line: 0, rule: 'chapter-structure', message });
  };

  if (chapter === 3) {
    // 第 3 章保留编号知识地图,但与其他章节一样不套固定目录。
    for (const sec of ['3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7']) {
      need(text.includes(`${sec} `), `第 3 章缺少 §${sec} 小节(三段式例外结构)`);
    }
  }
  need(/<ChapterContext\b|链路定位|本章定位|主线 [AB]|主线 A\/B/.test(text), '缺少章节上下文(ChapterContext 或主线/定位说明)');
  need(/<ChapterDeliverables\b|读完本章,你应当能|本章交付物/.test(text), '缺少可验证交付物(ChapterDeliverables 或兼容旧句式)');
  need(/失效边界|适用边界|不适用|前提|约束/.test(text), '缺少适用条件或失效边界');
  need(/\$[^$]+\$|```(?:text|math|mermaid)|<EvidencePanel\b|\|[^\n]+\|[^\n]+\||来源:|来源：|复现/.test(text), '缺少机制图、公式、表格、来源或可复现证据');

  // mermaid 规范:init 块与图注
  const lines = text.split('\n');
  let inMermaid = false;
  let mermaidStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '```mermaid') {
      inMermaid = true;
      mermaidStart = i + 1;
      const initLine = lines[i + 1] ?? '';
      if (!initLine.includes("%%{init:")) {
        diagnostics.push({ file: rel, line: i + 1, rule: 'mermaid-init', message: 'mermaid 块缺少统一 init 主题声明' });
      }
      continue;
    }
    if (inMermaid && line.trim() === '```') {
      inMermaid = false;
      // 图注:结束后 6 行内应有「图 X-N:」
      const tail = lines.slice(i + 1, i + 7).join('\n');
      if (!/图 \d+-\d+[::]/.test(tail)) {
        diagnostics.push({ file: rel, line: mermaidStart, rule: 'mermaid-caption', message: 'mermaid 图后缺少「图 X-N:标题。结论。」图注' });
      }
      continue;
    }
    if (inMermaid && /#D64545|#FDECEC/i.test(line)) {
      redReview.push({ file: rel, line: i + 1, snippet: line.trim().slice(0, 90) });
    }
  }
  // 生成图(svg 引用)的图注
  for (let i = 0; i < lines.length; i++) {
    if (/!\[[^\]]*\]\([^)]*diagrams\/[^)]*\.svg\)/.test(lines[i])) {
      const tail = lines.slice(i + 1, i + 7).join('\n');
      if (!/图 \d+-\d+[::]/.test(tail)) {
        diagnostics.push({ file: rel, line: i + 1, rule: 'figure-caption', message: '生成图引用后缺少「图 X-N:」图注' });
      }
    }
  }
}

if (process.argv.includes('--red-report')) {
  mkdirSync('reports', { recursive: true });
  const out = ['# Mermaid 红色样式人工审查清单', '', '红色(#FDECEC/#D64545)只允许用于瓶颈与故障;以下位置定义或使用了红色,语义是否越界需人工确认。', ''];
  for (const r of redReview) out.push(`- ${r.file}:${r.line} \`${r.snippet}\``);
  writeFileSync('reports/mermaid-red-review.md', out.join('\n') + '\n');
  console.log(`红色审查清单已写入 reports/mermaid-red-review.md(${redReview.length} 处)`);
}

report(diagnostics, { okMessage: `章节能力检查通过:${chapterFiles.length} 章均覆盖上下文、证据/边界、交付物及图表元数据。` });
