import test from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkLocalLinks } from '../lib/check-local-links.mjs';
import { parseMarkdown, extractLinkTargets, extractHeadingSlugs, isLocalFileTarget, splitLocalTarget } from '../lib/markdown.mjs';
import { findMarkdownFiles } from '../lib/files.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, 'fixtures');
const noExclude = { excludes: new Set(['node_modules', '.git']) };

test('有效用例:中文文件名、URL 编码、括号路径、图片、title、锚点、相对路径全部通过', () => {
  const { diagnostics, fileCount } = checkLocalLinks(join(fixtures, '有效用例'), noExclude);
  assert.equal(diagnostics.length, 0, JSON.stringify(diagnostics, null, 2));
  assert.ok(fileCount >= 4);
});

test('无效用例:缺失文件与缺失图片稳定失败,且行号正确', () => {
  const { diagnostics } = checkLocalLinks(join(fixtures, '无效用例'), noExclude);
  assert.equal(diagnostics.length, 2);
  const targets = diagnostics.map((d) => [d.message.includes('missing.md'), d.message.includes('img/nope.png')]);
  assert.ok(targets.flat().filter(Boolean).length === 2);
  assert.deepEqual(diagnostics.map((d) => d.line).sort((a, b) => a - b), [5, 7]);
  assert.ok(diagnostics.every((d) => d.rule === 'local-link-exists'));
});

test('行内代码与代码块中的伪链接不被提取', () => {
  const ast = parseMarkdown('`[伪](a.md)`\n\n```\n[伪](b.md)\n```\n\n[真](c.md)\n');
  const urls = extractLinkTargets(ast).map((t) => t.url);
  assert.deepEqual(urls, ['c.md']);
});

test('GitHub slug:中文标题、标点删除、重复标题后缀', () => {
  const ast = parseMarkdown('## 重复标题\n\n## 重复标题\n\n## 5.4 Profiling 方法论【全书唯一定义处】\n');
  const slugs = extractHeadingSlugs(ast).map((h) => h.slug);
  assert.deepEqual(slugs, ['重复标题', '重复标题-1', '54-profiling-方法论全书唯一定义处']);
});

test('本地目标判定:协议链接与纯锚点被跳过', () => {
  assert.equal(isLocalFileTarget('https://example.com'), false);
  assert.equal(isLocalFileTarget('mailto:a@b.c'), false);
  assert.equal(isLocalFileTarget('#锚点'), false);
  assert.equal(isLocalFileTarget('相对/路径.md'), true);
  assert.equal(isLocalFileTarget('../上级.md#节'), true);
});

test('本地目标拆分:URL 解码与锚点分离', () => {
  assert.deepEqual(splitLocalTarget('中文%20目标.md#目标文档'), { filePart: '中文 目标.md', anchor: '目标文档' });
  assert.deepEqual(splitLocalTarget('a.md'), { filePart: 'a.md', anchor: null });
});

test('文件发现:默认排除 fixtures/node_modules,输出稳定排序', () => {
  const repoRoot = join(here, '..', '..');
  const files = findMarkdownFiles(repoRoot);
  assert.ok(files.length > 0);
  assert.ok(files.every((f) => !f.includes('fixtures') && !f.includes('node_modules')));
  assert.deepEqual(files, [...files].sort((a, b) => a.localeCompare(b)));
});
