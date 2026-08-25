#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findMarkdownFiles } from './lib/files.mjs';
import { parseMarkdown, visit } from './lib/markdown.mjs';

export function analyzeVisuals(text, file = '') {
  const ast = parseMarkdown(text);
  const images = [];
  visit(ast, (node) => {
    if (node.type === 'image') images.push({ src: node.url, alt: node.alt ?? '', ext: extname(node.url).toLowerCase() });
  });
  const components = [...text.matchAll(/<BookFigure\b[\s\S]*?\/>/g)].map((m) => ({
    src: m[0].match(/\bsrc="([^"]+)"/)?.[1] ?? '',
    alt: m[0].match(/\balt="([^"]+)"/)?.[1] ?? '',
    caption: m[0].match(/\bcaption="([^"]+)"/)?.[1] ?? '',
  }));
  const mermaid = (text.match(/```mermaid\b/g) ?? []).length;
  const all = [...images, ...components];
  return {
    file,
    total_figures: all.length + mermaid,
    mermaid,
    svg: all.filter((i) => extname(i.src).toLowerCase() === '.svg').length,
    raster: all.filter((i) => /\.(png|jpe?g|gif|webp)$/i.test(i.src)).length,
    book_figures: components.length,
    missing_alt: all.filter((i) => !i.alt.trim()).length,
    missing_caption: components.filter((i) => !i.caption.trim()).length,
    tables: (text.match(/^\|.+\|\s*$/gm) ?? []).length,
    formulas: (text.match(/\$\$|```(?:text|math)/g) ?? []).length,
  };
}

function renderMarkdown(chapters) {
  const total = chapters.reduce((n, c) => n + c.total_figures, 0);
  const mermaid = chapters.reduce((n, c) => n + c.mermaid, 0);
  return [
    '# 视觉内容基线', '',
    '> 此报告统计视觉类型与元数据缺口；旧图片允许渐进迁移。', '',
    `扫描章节：${chapters.length}；图片/图表总数：${total}；Mermaid：${mermaid}（${total ? (mermaid / total * 100).toFixed(1) : '0.0'}%）。`, '',
    '| 章节 | 总数 | Mermaid | SVG | 位图 | BookFigure | 缺 alt | 缺组件图注 |',
    '|---|---:|---:|---:|---:|---:|---:|---:|',
    ...chapters.map((c) => `| ${c.file} | ${c.total_figures} | ${c.mermaid} | ${c.svg} | ${c.raster} | ${c.book_figures} | ${c.missing_alt} | ${c.missing_caption} |`), '',
    '## 解读', '',
    '- Mermaid 占比用于识别视觉类型单一，不代表图本身质量。',
    '- Markdown 图片的图注仍由旧校验器兼容检查；新图应使用 BookFigure，将 alt、结论型图注和来源放在一起。',
    '- 定量图是否标明单位、假设和数据日期仍需人工审阅。', '',
  ].join('\n');
}

export function runVisualAudit(rootDir = process.cwd()) {
  const files = findMarkdownFiles(rootDir).filter((f) => /第\d{2}章-/.test(f));
  const chapters = files.map((file) => analyzeVisuals(readFileSync(file, 'utf8'), relative(rootDir, file)));
  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/visual-audit.json', JSON.stringify({ version: 1, chapters }, null, 2) + '\n');
  writeFileSync('reports/visual-audit.md', renderMarkdown(chapters).replace('# 视觉内容基线', '# 视觉内容审计'));
  if (!existsSync('reports/visual-baseline.md')) writeFileSync('reports/visual-baseline.md', renderMarkdown(chapters));
  return chapters;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const chapters = runVisualAudit();
  console.log(`视觉内容审计已更新：${chapters.length} 章（warning 模式，基线文件不覆盖）。`);
}
