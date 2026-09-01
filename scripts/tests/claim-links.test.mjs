import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { claimFilePath, resolveClaimHref } from '../lib/claim-links.mjs';

const REPO = 'https://github.com/cdavid817/AI-Infra-Tutorial';

test('Claim ID 章节段按数值解析并补零到两位', () => {
  assert.equal(claimFilePath('CLM-008-001'), 'references/claims/chapter-08.yaml');
  assert.equal(claimFilePath('CLM-009-001'), 'references/claims/chapter-09.yaml');
  assert.equal(claimFilePath('CLM-010-001'), 'references/claims/chapter-10.yaml');
  assert.equal(claimFilePath('CLM-024-001'), 'references/claims/chapter-24.yaml');
  assert.equal(claimFilePath('CLM-031-001'), 'references/claims/chapter-31.yaml');
});

test('不产生 chapter-024.yaml 这类保留前导零的文件名', () => {
  assert.notEqual(claimFilePath('CLM-024-001'), 'references/claims/chapter-024.yaml');
});

test('非法 Claim ID 返回 null', () => {
  for (const bad of ['CLM-24-001', 'CLM-0024-001', 'CLM-024-1', 'CLM-000-001', 'clm-024-001', 'CLM-024', 'XLM-024-001', '']) {
    assert.equal(claimFilePath(bad), null, `应拒绝: ${bad}`);
  }
});

test('resolveClaimHref 拼出仓库 blob URL', () => {
  assert.equal(
    resolveClaimHref('CLM-024-001', { repoUrl: REPO, branch: 'main', exists: () => true }),
    `${REPO}/blob/main/references/claims/chapter-24.yaml`,
  );
  // 尾部斜杠不产生双斜杠
  assert.equal(
    resolveClaimHref('CLM-008-001', { repoUrl: `${REPO}/`, branch: 'main', exists: () => true }),
    `${REPO}/blob/main/references/claims/chapter-08.yaml`,
  );
});

test('登记文件缺失或 ID 非法时返回 null(调用方降级为不渲染链接)', () => {
  assert.equal(resolveClaimHref('CLM-024-001', { repoUrl: REPO, exists: () => false }), null);
  assert.equal(resolveClaimHref('CLM-9999-001', { repoUrl: REPO, exists: () => true }), null);
  assert.equal(resolveClaimHref('CLM-024-001', { exists: () => true }), null, '缺少 repoUrl 时不产出半截链接');
});

test('对照真实仓库:已登记章节的 Claim 文件确实存在', () => {
  for (const id of ['CLM-008-001', 'CLM-009-001', 'CLM-024-001']) {
    const file = claimFilePath(id);
    assert.ok(existsSync(file), `${id} 映射到的 ${file} 应存在`);
  }
});
