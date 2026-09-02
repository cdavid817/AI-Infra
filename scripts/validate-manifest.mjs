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
if (appendices.length !== 11) err(`附录应为 11 个,实际 ${appendices.length}`);
for (const a of appendices) {
  if (!existsSync(a.path)) err(`附录 ${a.id} 路径不存在: ${a.path}`);
  if (!readme.includes(a.path)) err(`README 目录缺少附录 ${a.id} 链接: ${a.path}`);
}

// ---- 任务型信息架构与治理登记(ADR-002/003/004):登记路径必须真实存在 ----
const mustExist = (path, label) => {
  if (typeof path !== 'string' || !path) err(`${label} 缺少路径`);
  else if (!existsSync(path)) err(`${label} 路径不存在: ${path}`);
};
const entries = doc.entries ?? [];
if (entries.length !== 5) err(`一级入口应为 5 个,实际 ${entries.length}`);
for (const e of entries) mustExist(e.path, `入口 ${e.id}`);
for (const [key, c] of Object.entries(doc.collections ?? {})) mustExist(c.path, `collections.${key}`);
for (const lab of doc.labs ?? []) {
  mustExist(lab.path, `lab ${lab.id}`);
  mustExist(lab.metadata, `lab ${lab.id} metadata`);
  for (const p of [...(lab.prerequisites ?? []), ...(lab.related ?? [])]) mustExist(p, `lab ${lab.id} 关联`);
  for (const track of ['technical', 'readability']) {
    const status = lab.review?.[track];
    const allowed = doc.governance?.review?.model ?? [];
    if (!allowed.includes(typeof status === 'string' ? status : status?.status)) {
      err(`lab ${lab.id} review.${track} 状态非法: ${JSON.stringify(status)}(允许: ${allowed.join('/')})`);
    }
  }
}
for (const p of doc.governance?.policies ?? []) mustExist(p, 'governance.policies');
for (const p of doc.governance?.decisions ?? []) mustExist(p, 'governance.decisions');
if (doc.repository?.metadata) mustExist(doc.repository.metadata, 'repository.metadata');
for (const m of doc.legacy_paths?.map ?? []) mustExist(m.new_path, `legacy_paths ${m.legacy_path} 的新路径`);

report(diagnostics, { okMessage: `manifest 检查通过:31 章 + ${appendices.length} 附录 + ${entries.length} 入口 + ${(doc.labs ?? []).length} 个登记实验,路径存在且 README 目录完整覆盖。` });
