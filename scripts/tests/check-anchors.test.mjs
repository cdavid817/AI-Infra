import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkAnchors } from '../lib/check-anchors.mjs';

const noExclude = { excludes: new Set(['node_modules', '.git']) };

function makeTree(files) {
  const root = mkdtempSync(join(tmpdir(), 'anchors-'));
  for (const [name, text] of Object.entries(files)) writeFileSync(join(root, name), text);
  return root;
}

test('有效锚点通过:同文件、跨文件、URL 编码、重复标题后缀', () => {
  const root = makeTree({
    'a.md': '# 首节\n\n## 重复\n\n## 重复\n\n[同页](#首节) [跨页](b.md#目标节) [编码](b.md#%E7%9B%AE%E6%A0%87%E8%8A%82) [后缀](#重复-1)\n',
    'b.md': '# 目标节\n',
  });
  const { diagnostics } = checkAnchors(root, noExclude);
  assert.deepEqual(diagnostics, []);
});

test('失效锚点被检出且带行号', () => {
  const root = makeTree({
    'a.md': '# 首节\n\n第三行\n\n[坏的](#不存在) 与 [跨页坏的](b.md#也不存在)\n',
    'b.md': '# 目标节\n',
  });
  const { diagnostics } = checkAnchors(root, noExclude);
  assert.equal(diagnostics.length, 2);
  assert.ok(diagnostics.every((d) => d.rule === 'anchor-exists' && d.line === 5));
});

test('全角冒号标题的 slug 行为(ERRATA 场景回归)', () => {
  const root = makeTree({
    'a.md': '[对](b.md#附录-a加速卡)\n[错](b.md#附录-a-加速卡)\n',
    'b.md': '## 附录 A：加速卡\n',
  });
  const { diagnostics } = checkAnchors(root, noExclude);
  assert.equal(diagnostics.length, 1);
  assert.ok(diagnostics[0].message.includes('附录-a-加速卡'));
});
