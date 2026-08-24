import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPrompts } from '../check-prompts.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const realText = readFileSync(join(repoRoot, 'ai-infra-book-prompts.md'), 'utf8');

test('当前 Prompt 包通过结构检查', () => {
  assert.deepEqual(checkPrompts(realText), []);
});

test('删除证据纪律段落被检出', () => {
  const broken = realText.replace('证据纪律(总则', '已被删除的段落');
  assert.ok(checkPrompts(broken).some((d) => d.message.includes('证据纪律')));
});

test('删除某章 Prompt 被检出', () => {
  const broken = realText.replace('撰写第 16 章', '撰写第 XX 章');
  assert.ok(checkPrompts(broken).some((d) => d.message.includes('第 16 章')));
});

test('恢复 v2 年份断言模板被检出', () => {
  const broken = realText + '\n没有理由再用"),但立场必须有依据支撑\n';
  assert.ok(checkPrompts(broken).some((d) => d.message.includes('年份断言')));
});
