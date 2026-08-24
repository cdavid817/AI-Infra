import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { findMarkdownFiles } from './files.mjs';
import { parseMarkdown, extractLinkTargets, isLocalFileTarget, splitLocalTarget } from './markdown.mjs';

/**
 * 检查 rootDir 下所有 Markdown 的本地文件链接目标是否存在。
 * 返回诊断列表(空数组=全部有效)。
 */
export function checkLocalLinks(rootDir, options = {}) {
  const files = findMarkdownFiles(rootDir, options);
  const diagnostics = [];
  for (const file of files) {
    const ast = parseMarkdown(readFileSync(file, 'utf8'));
    for (const target of extractLinkTargets(ast)) {
      if (!isLocalFileTarget(target.url)) continue;
      const { filePart } = splitLocalTarget(target.url);
      if (!filePart) continue; // 纯锚点链接由锚点检查负责
      const destination = resolve(dirname(file), filePart);
      if (!existsSync(destination)) {
        diagnostics.push({
          file: relative(rootDir, file),
          line: target.line,
          rule: 'local-link-exists',
          message: `链接目标不存在: ${target.url}`,
        });
      }
    }
  }
  return { diagnostics, fileCount: files.length };
}
