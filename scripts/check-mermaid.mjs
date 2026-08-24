#!/usr/bin/env node
// Mermaid 实渲染校验:每个 ```mermaid 块 POST 到 kroki 渲染,失败即语法错误。
// 需要网络;放 nightly/手动触发,不进 PR 确定性门禁。
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { findMarkdownFiles } from './lib/files.mjs';
import { report } from './lib/diagnostics.mjs';

const rootDir = process.cwd();
const blocks = [];
for (const file of findMarkdownFiles(rootDir)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  let start = -1;
  let buf = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '```mermaid') {
      start = i + 1;
      buf = [];
    } else if (start !== -1 && lines[i].trim() === '```') {
      blocks.push({ file: relative(rootDir, file), line: start + 1, code: buf.join('\n') });
      start = -1;
    } else if (start !== -1) {
      buf.push(lines[i]);
    }
  }
}

const diagnostics = [];
let done = 0;
const CONCURRENCY = 6;
async function renderOne(b) {
  try {
    const res = await fetch('https://kroki.io/mermaid/svg', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: b.code,
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 160).replace(/\n/g, ' ');
      diagnostics.push({ file: b.file, line: b.line, rule: 'mermaid-render', message: `kroki 渲染失败 HTTP ${res.status}: ${body}` });
    }
  } catch (e) {
    diagnostics.push({ file: b.file, line: b.line, rule: 'mermaid-network', message: `渲染请求失败(网络):${e.name}——不判语法错误,请重试` });
  }
  done++;
}
for (let i = 0; i < blocks.length; i += CONCURRENCY) {
  await Promise.all(blocks.slice(i, i + CONCURRENCY).map(renderOne));
}

const netOnly = diagnostics.every((d) => d.rule === 'mermaid-network');
if (diagnostics.length > 0 && netOnly) {
  diagnostics.forEach((d) => console.warn(`WARN  ${d.file}:${d.line} ${d.message}`));
  console.log(`Mermaid 校验:${blocks.length} 块,仅网络问题(不失败)`);
} else {
  report(diagnostics, { okMessage: `Mermaid 实渲染校验通过:${blocks.length} 个代码块全部渲染成功。` });
}
