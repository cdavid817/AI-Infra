#!/usr/bin/env node
// book-manifest.yaml 校验:章节 1–31 齐全且不重复、路径存在、README 目录覆盖全部章节与附录。
import { readFileSync, existsSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { report } from './lib/diagnostics.mjs';

const doc = parseYaml(readFileSync('book-manifest.yaml', 'utf8'));
const readme = readFileSync('README.md', 'utf8');
const diagnostics = [];
const err = (message) => diagnostics.push({ file: 'book-manifest.yaml', line: 0, rule: 'manifest', message });

const seen = new Map();
for (const part of doc.parts ?? []) {
  for (const ch of part.chapters ?? []) {
    if (seen.has(ch.number)) err(`第 ${ch.number} 章重复出现`);
    seen.set(ch.number, ch.path);
    if (!existsSync(ch.path)) err(`第 ${ch.number} 章路径不存在: ${ch.path}`);
    if (!readme.includes(ch.path)) err(`README 目录缺少第 ${ch.number} 章链接: ${ch.path}`);
  }
}
for (let n = 1; n <= 31; n++) if (!seen.has(n)) err(`缺少第 ${n} 章`);
const appendices = doc.appendices ?? [];
if (appendices.length !== 6) err(`附录应为 6 个,实际 ${appendices.length}`);
for (const a of appendices) {
  if (!existsSync(a.path)) err(`附录 ${a.id} 路径不存在: ${a.path}`);
  if (!readme.includes(a.path)) err(`README 目录缺少附录 ${a.id} 链接: ${a.path}`);
}

report(diagnostics, { okMessage: `manifest 检查通过:31 章 + ${appendices.length} 附录,路径存在且 README 目录完整覆盖。` });
