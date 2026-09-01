#!/usr/bin/env node
// 外链检查:404/410 为错误;403/429/超时/网络故障为警告(不判死链)。
// 用法:node scripts/check-external-links.mjs [--timeout-ms=15000]
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { findMarkdownFiles } from './lib/files.mjs';
import { parseMarkdown, extractLinkTargets } from './lib/markdown.mjs';

const TIMEOUT = Number((process.argv.find((a) => a.startsWith('--timeout-ms=')) ?? '').split('=')[1] || 15000);
const UA = 'ai-infra-docs-link-checker/1.0 (+https://github.com/cdavid817/AI-Infra-Tutorial)';
// 已知对机器 UA 返回 403 但人类可访问的域,直接按 warning 处理
const SOFT_DOMAINS = ['openai.com'];

const rootDir = process.cwd();
const targets = new Map(); // url -> [{file, line}]
for (const file of findMarkdownFiles(rootDir)) {
  const rel = relative(rootDir, file);
  for (const t of extractLinkTargets(parseMarkdown(readFileSync(file, 'utf8')))) {
    if (/^https?:\/\//.test(t.url)) {
      if (!targets.has(t.url)) targets.set(t.url, []);
      targets.get(t.url).push({ file: rel, line: t.line });
    }
  }
}
try {
  const doc = parseYaml(readFileSync('references/sources.yaml', 'utf8'));
  for (const s of doc?.sources ?? []) {
    if (s.url && !targets.has(s.url)) targets.set(s.url, [{ file: 'references/sources.yaml', line: 0 }]);
  }
} catch { /* sources 可选 */ }

async function probe(url) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const res = await fetch(url, {
        method,
        redirect: 'follow',
        headers: { 'user-agent': UA, accept: '*/*' },
        signal: AbortSignal.timeout(TIMEOUT),
      });
      if (res.status === 405 && method === 'HEAD') continue; // 某些站点不支持 HEAD
      return { status: res.status };
    } catch (e) {
      if (method === 'GET') return { error: e.name === 'TimeoutError' ? 'timeout' : (e.cause?.code ?? e.message) };
    }
  }
  return { error: 'unreachable' };
}

const errors = [];
const warnings = [];
for (const [url, refs] of targets) {
  const r = await probe(url);
  const where = `${refs[0].file}:${refs[0].line}`;
  if (r.status === 404 || r.status === 410) {
    errors.push(`${where} [external-link-dead] ${url} → HTTP ${r.status}`);
  } else if (r.error) {
    warnings.push(`${where} [external-link-unstable] ${url} → ${r.error}(不判死链,人工复核)`);
  } else if (r.status >= 400) {
    const soft = r.status === 403 || r.status === 429 || SOFT_DOMAINS.some((d) => url.includes(d));
    (soft ? warnings : errors).push(`${where} [external-link-${soft ? 'blocked' : 'error'}] ${url} → HTTP ${r.status}`);
  }
}

for (const w of warnings) console.warn(`WARN  ${w}`);
for (const e of errors) console.error(`ERROR ${e}`);
console.log(`\n外链检查:${targets.size} 个唯一 URL;${errors.length} 个错误,${warnings.length} 个警告`);
if (errors.length > 0) process.exitCode = 1;
