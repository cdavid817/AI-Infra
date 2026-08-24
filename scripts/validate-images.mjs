#!/usr/bin/env node
// 图片授权闭环校验:
//  - images/ 下未登记文件 → 错误
//  - 台账指向不存在文件 / SHA-256 不匹配 → 错误
//  - 正文引用 images/ 下图片但台账缺失 → 错误
//  - publish_status 非 approved → 普通模式警告;--release 模式错误(发布门禁)
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { findMarkdownFiles } from './lib/files.mjs';
import { parseMarkdown, extractLinkTargets } from './lib/markdown.mjs';
import { report } from './lib/diagnostics.mjs';

const releaseMode = process.argv.includes('--release');
const rootDir = process.cwd();
const ledger = parseYaml(readFileSync('images/sources.yaml', 'utf8'));
const registered = new Map(ledger.images.map((i) => [i.file, i]));

const errors = [];
const warnings = [];

// 1) 目录 ↔ 台账双向
const onDisk = readdirSync('images').filter((f) => !f.endsWith('.md') && !f.endsWith('.yaml'));
for (const f of onDisk) {
  if (!registered.has(f)) errors.push({ file: `images/${f}`, line: 0, rule: 'image-unregistered', message: '文件未登记进 images/sources.yaml' });
}
for (const [f, img] of registered) {
  let buf;
  try {
    buf = readFileSync(join('images', f));
  } catch {
    errors.push({ file: 'images/sources.yaml', line: 0, rule: 'image-missing-file', message: `台账记录指向不存在文件: ${f}` });
    continue;
  }
  const sha = createHash('sha256').update(buf).digest('hex');
  if (sha !== img.sha256) {
    errors.push({ file: `images/${f}`, line: 0, rule: 'image-sha-mismatch', message: 'SHA-256 与台账不符——文件被替换但台账未更新' });
  }
  if (img.publish_status !== 'approved') {
    const d = { file: 'images/sources.yaml', line: 0, rule: 'image-not-approved', message: `${f} 发布状态为 ${img.publish_status},正式发布前必须完成授权核验` };
    (releaseMode ? errors : warnings).push(d);
  }
}

// 2) 正文引用 ↔ 台账
for (const file of findMarkdownFiles(rootDir)) {
  const rel = relative(rootDir, file);
  if (rel === 'images/SOURCES.md') continue;
  for (const t of extractLinkTargets(parseMarkdown(readFileSync(file, 'utf8')))) {
    const m = t.url.match(/(?:^|\/)images\/([^/)]+\.(?:png|jpg|jpeg|gif|webp))$/i);
    if (m && !registered.has(decodeURIComponent(m[1]))) {
      errors.push({ file: rel, line: t.line, rule: 'image-ref-unregistered', message: `正文引用了未登记图片: ${m[1]}` });
    }
  }
}

for (const w of warnings) console.warn(`WARN  ${w.file} (${w.rule}) ${w.message}`);
report(errors, { okMessage: `图片台账检查通过:${registered.size} 条登记、${onDisk.length} 个文件、SHA 校验一致${releaseMode ? '(release 模式)' : ''}。` });
