#!/usr/bin/env node
// 兼容入口:node scripts/check-doc-links.mjs
// 内部实现已迁移到 scripts/lib/(AST 解析,无 rg 依赖)。
import { checkLocalLinks } from './lib/check-local-links.mjs';
import { report } from './lib/diagnostics.mjs';

const rootDir = process.cwd();
const { diagnostics, fileCount } = checkLocalLinks(rootDir);
report(diagnostics, { okMessage: `已检查 ${fileCount} 个 Markdown 文件:本地链接均有效。` });
