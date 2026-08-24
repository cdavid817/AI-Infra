import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { findMarkdownFiles } from './files.mjs';
import { parseMarkdown, extractLinkTargets, extractHeadingSlugs, isLocalFileTarget, splitLocalTarget } from './markdown.mjs';

/**
 * 校验站内锚点:同文件 #anchor 与跨文件 path#anchor 必须命中目标文件的标题 slug
 * (GitHub slug 规则,含重复标题 -1/-2 后缀)。
 */
export function checkAnchors(rootDir, options = {}) {
  const files = findMarkdownFiles(rootDir, options);
  const slugCache = new Map();
  const slugsOf = (absPath) => {
    if (!slugCache.has(absPath)) {
      const ast = parseMarkdown(readFileSync(absPath, 'utf8'));
      slugCache.set(absPath, new Set(extractHeadingSlugs(ast).map((h) => h.slug)));
    }
    return slugCache.get(absPath);
  };

  const diagnostics = [];
  for (const file of files) {
    const ast = parseMarkdown(readFileSync(file, 'utf8'));
    for (const t of extractLinkTargets(ast)) {
      let targetFile = null;
      let anchor = null;
      if (t.url.startsWith('#')) {
        targetFile = file;
        anchor = t.url.slice(1);
      } else if (isLocalFileTarget(t.url)) {
        const { filePart, anchor: a } = splitLocalTarget(t.url);
        if (!a) continue;
        targetFile = resolve(dirname(file), filePart);
        anchor = a;
      } else {
        continue;
      }
      if (!existsSync(targetFile) || !targetFile.endsWith('.md')) continue; // 文件存在性由链接检查负责
      let decoded;
      try {
        decoded = decodeURIComponent(anchor);
      } catch {
        decoded = anchor;
      }
      if (!slugsOf(targetFile).has(decoded)) {
        diagnostics.push({
          file: relative(rootDir, file),
          line: t.line,
          rule: 'anchor-exists',
          message: `锚点不存在: ${t.url}(目标 ${relative(rootDir, targetFile)} 无 slug "${decoded}")`,
        });
      }
    }
  }
  return { diagnostics, fileCount: files.length };
}
