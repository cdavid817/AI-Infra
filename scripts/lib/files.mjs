import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const DEFAULT_EXCLUDES = new Set(['node_modules', '.git', 'fixtures']);

/**
 * 递归收集目录下的 Markdown 文件。
 * 不依赖任何外部命令(如 rg),纯 Node 实现,跨平台使用 Path API。
 */
export function findMarkdownFiles(rootDir, { excludes = DEFAULT_EXCLUDES } = {}) {
  const results = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (excludes.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(full);
      }
    }
  };
  walk(rootDir);
  return results.sort((a, b) => relative(rootDir, a).split(sep).join('/').localeCompare(relative(rootDir, b).split(sep).join('/')));
}

export function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
