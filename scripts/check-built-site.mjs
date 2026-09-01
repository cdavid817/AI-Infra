#!/usr/bin/env node
// 构建产物检查:扫描 .vitepress/dist 的 HTML,校验
// 1) 站内链接(含自定义 Renderer 动态生成的 URL)指向的产物文件存在;
// 2) Claim 角标链接(GitHub blob URL)映射回仓库内真实存在的 references/claims/chapter-XX.yaml。
// Markdown AST 检查覆盖不到动态渲染,这里兜底。用法:npm run site:build && node scripts/check-built-site.mjs
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, relative, resolve, posix } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { report } from './lib/diagnostics.mjs';

const rootDir = process.cwd();
const distDir = join(rootDir, '.vitepress/dist');
if (!existsSync(distDir)) {
  console.error('未找到 .vitepress/dist,请先运行 npm run site:build');
  process.exit(1);
}

const siteMeta = parseYaml(readFileSync('site-metadata.yaml', 'utf8'));
const base = process.env.DOCS_BASE ?? siteMeta.site.base;
const claimLinkRe = new RegExp(
  `^${siteMeta.project.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/blob/[^/]+/(references/claims/[^#?"]+\\.yaml)$`,
);

const htmlFiles = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.html')) htmlFiles.push(full);
  }
};
walk(distDir);
htmlFiles.sort();

const diagnostics = [];
let internalCount = 0;
let claimCount = 0;
let repoFileCount = 0;
// 站点未收录但仓库中真实存在的目标(LICENSE、*.yaml、srcExclude 的 references/reports 等):
// 在 GitHub 上有效,不算断链;是否转为站内资源是后续工作。
const existsInRepo = (urlPath) => {
  let clean = urlPath.split(/[#?]/)[0];
  try {
    clean = decodeURIComponent(clean);
  } catch {
    /* 保留原样 */
  }
  // .html 由渲染器附加:LICENSE-CONTENT → LICENSE-CONTENT.html、CITATION.cff → CITATION.cff.html
  const candidates = [clean, clean.replace(/\.html$/, '.md'), clean.replace(/\.html$/, '')];
  return candidates.some((c) => c && existsSync(join(rootDir, c)));
};
const existsInDist = (urlPath) => {
  let clean = urlPath.split(/[#?]/)[0];
  if (!clean) return true;
  try {
    clean = decodeURIComponent(clean);
  } catch {
    /* 保留原样 */
  }
  const candidates = clean.endsWith('/')
    ? [posix.join(clean, 'index.html')]
    : /\.[a-zA-Z0-9]+$/.test(clean)
      ? [clean]
      : [`${clean}.html`, posix.join(clean, 'index.html')];
  return candidates.some((c) => existsSync(join(distDir, c)));
};

for (const file of htmlFiles) {
  const rel = relative(rootDir, file);
  const html = readFileSync(file, 'utf8');
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const url = m[1];
    if (/^(mailto:|tel:|javascript:|data:|#)/.test(url)) continue;
    const claim = claimLinkRe.exec(url);
    if (claim) {
      claimCount++;
      if (!existsSync(join(rootDir, claim[1]))) {
        diagnostics.push({ file: rel, line: 0, rule: 'claim-link', message: `Claim 链接指向不存在的登记文件: ${claim[1]}` });
      }
      continue;
    }
    if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(url)) continue; // 其他外链由 nightly 外链检查负责
    internalCount++;
    let target;
    if (url.startsWith('/')) {
      if (!url.startsWith(base)) {
        diagnostics.push({ file: rel, line: 0, rule: 'base-prefix', message: `绝对站内链接未带 base ${base}: ${url}` });
        continue;
      }
      target = url.slice(base.length);
    } else {
      target = posix.join(posix.dirname(relative(distDir, file).split('\\').join('/')), url);
    }
    if (!existsInDist(target)) {
      if (existsInRepo(target)) repoFileCount++;
      else diagnostics.push({ file: rel, line: 0, rule: 'built-link', message: `构建产物与仓库中均不存在链接目标: ${url}` });
    }
  }
}

report(diagnostics, {
  okMessage: `构建产物检查通过:${htmlFiles.length} 个 HTML,${internalCount} 个站内引用有效(其中 ${repoFileCount} 个指向站点未收录但仓库存在的文件),${claimCount} 个 Claim 链接均映射到存在的登记文件。`,
});
