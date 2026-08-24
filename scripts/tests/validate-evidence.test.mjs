import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateEvidence } from '../lib/validate-evidence.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const GOOD_SOURCE = `schema_version: 1
sources:
  - id: SRC-TEST-DOC
    title: 测试文档
    publisher: Test
    source_type: official_documentation
    url: https://example.com/doc
    accessed_at: 2026-08-24
    evidence_level: L1
`;

function makeTree({ sources = GOOD_SOURCE, claims = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'evidence-'));
  mkdirSync(join(root, 'references', 'claims'), { recursive: true });
  cpSync(join(repoRoot, 'references', 'schemas'), join(root, 'references', 'schemas'), { recursive: true });
  writeFileSync(join(root, 'references', 'sources.yaml'), sources);
  for (const [name, text] of Object.entries(claims)) {
    writeFileSync(join(root, 'references', 'claims', name), text);
  }
  return root;
}

const claimHeader = 'schema_version: 1\nchapter: 27\nclaims:\n';

test('正常证据树通过', () => {
  const root = makeTree({
    claims: {
      'chapter-27.yaml': claimHeader + `  - id: CLM-027-001
    section: "27.3"
    summary: 机制结论
    claim_type: mechanism
    evidence_level: L1
    sources: [SRC-TEST-DOC]
    status: verified
    reviewed_at: 2026-08-24
  - id: CLM-027-002
    section: 问题场景
    summary: 示意数字
    claim_type: illustrative
    evidence_level: L5
    sources: []
    status: illustrative_only
    disclosure: 合成案例,数字仅用于说明方法
`,
    },
  });
  const { errors } = validateEvidence(root);
  assert.deepEqual(errors, []);
});

test('source id 重复失败', () => {
  const root = makeTree({ sources: GOOD_SOURCE + GOOD_SOURCE.replace('schema_version: 1\nsources:\n', '') });
  const { errors } = validateEvidence(root);
  assert.ok(errors.some((e) => e.rule === 'source-id-duplicate'));
});

test('claim id 全局重复失败(跨文件)', () => {
  const dup = claimHeader + `  - id: CLM-027-001
    section: a
    summary: s
    claim_type: mechanism
    evidence_level: L1
    sources: []
    status: unverified
`;
  const root = makeTree({ claims: { 'chapter-27.yaml': dup, 'chapter-28.yaml': dup.replace('chapter: 27', 'chapter: 28') } });
  const { errors } = validateEvidence(root);
  assert.ok(errors.some((e) => e.rule === 'claim-id-duplicate'));
});

test('未知 source id 失败', () => {
  const root = makeTree({
    claims: {
      'chapter-27.yaml': claimHeader + `  - id: CLM-027-001
    section: a
    summary: s
    claim_type: mechanism
    evidence_level: L1
    sources: [SRC-NOT-EXIST]
    status: unverified
`,
    },
  });
  const { errors } = validateEvidence(root);
  assert.ok(errors.some((e) => e.rule === 'claim-unknown-source'));
});

test('来源缺少 accessed_at 失败(schema)', () => {
  const root = makeTree({ sources: GOOD_SOURCE.replace('    accessed_at: 2026-08-24\n', '') });
  const { errors } = validateEvidence(root);
  assert.ok(errors.some((e) => e.rule === 'source-schema' && e.message.includes('accessed_at')));
});

test('作者实测缺少环境字段不得 verified', () => {
  const root = makeTree({
    claims: {
      'chapter-27.yaml': claimHeader + `  - id: CLM-027-001
    section: a
    summary: 实测吞吐
    claim_type: measurement
    evidence_level: L3
    sources: []
    status: verified
    reviewed_at: 2026-08-24
`,
    },
  });
  const { errors } = validateEvidence(root);
  assert.ok(errors.some((e) => e.rule === 'measurement-fields'));
});

test('illustrative 误标 verified 失败', () => {
  const root = makeTree({
    claims: {
      'chapter-27.yaml': claimHeader + `  - id: CLM-027-001
    section: a
    summary: 示意
    claim_type: illustrative
    evidence_level: L5
    sources: []
    status: verified
    reviewed_at: 2026-08-24
`,
    },
  });
  const { errors } = validateEvidence(root);
  assert.ok(errors.some((e) => e.rule === 'illustrative-status'));
});

test('高时效 claim 缺少复核日期失败;过期只警告', () => {
  const root = makeTree({
    claims: {
      'chapter-27.yaml': claimHeader + `  - id: CLM-027-001
    section: a
    summary: 高时效
    claim_type: project_status
    evidence_level: L1
    sources: [SRC-TEST-DOC]
    status: needs_review
    review_after_days: 90
  - id: CLM-027-002
    section: a
    summary: 过期
    claim_type: project_status
    evidence_level: L1
    sources: [SRC-TEST-DOC]
    status: needs_review
    reviewed_at: 2020-01-01
    review_after_days: 90
`,
    },
  });
  const { errors, warnings } = validateEvidence(root);
  assert.ok(errors.some((e) => e.rule === 'volatile-needs-review-date' && e.id === 'CLM-027-001'));
  assert.ok(warnings.some((w) => w.rule === 'claim-stale' && w.id === 'CLM-027-002'));
});

test('过期来源输出 warning 而非 error', () => {
  const root = makeTree({
    sources: GOOD_SOURCE.replace('    evidence_level: L1\n', '    evidence_level: L1\n    review_after_days: 30\n').replace('2026-08-24', '2020-01-01'),
  });
  const { errors, warnings } = validateEvidence(root);
  assert.equal(errors.length, 0);
  assert.ok(warnings.some((w) => w.rule === 'source-stale'));
});

test('verified 的 quantitative 无来源失败', () => {
  const root = makeTree({
    claims: {
      'chapter-27.yaml': claimHeader + `  - id: CLM-027-001
    section: a
    summary: 数字
    claim_type: quantitative
    evidence_level: L1
    sources: []
    status: verified
    reviewed_at: 2026-08-24
`,
    },
  });
  const { errors } = validateEvidence(root);
  assert.ok(errors.some((e) => e.rule === 'verified-needs-source'));
});
