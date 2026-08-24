#!/usr/bin/env node
// 章节结构校验:七段骨架关键段、交付物句、mermaid init 块与图注;红色样式输出人工审查清单。
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
    // 第 3 章例外:三段式,校验编号小节与交付物
    for (const sec of ['3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7']) {
      need(text.includes(`${sec} `), `第 3 章缺少 §${sec} 小节(三段式例外结构)`);
    }
  } else {
    for (const seg of ['问题场景', '方案对比', '大数据对照', '决策树']) {
      need(text.includes(seg), `缺少骨架段:${seg}`);
    }
    need(/链路定位|主线 [AB]/.test(text), '缺少链路定位(主线 A/B 标注)');
    need(/依赖声明|建立在.{0,20}章/.test(text), '缺少依赖声明');
  }
  need(text.includes('读完本章,你应当能'), '缺少可验证交付物句「读完本章,你应当能……」');

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

report(diagnostics, { okMessage: `章节结构检查通过:${chapterFiles.length} 章骨架、交付物、mermaid init 与图注均符合规范。` });
