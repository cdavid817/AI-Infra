import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateData } from '../lib/validate-data.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const MIN_CLUSTER = `schema_version: 1
hbm_generations:
  rows: []
capacity_deductions:
  intro: i
  rows: []
supernodes:
  intro: i
  reading_guide: g
  rows: []
power_density:
  intro: i
  outro: o
  rows: []
`;
const MIN_FRAMEWORKS = `schema_version: 1
snapshot_date: "2026-08"
intro_notes: []
training: []
inference: []
tooling: []
recommendations:
  kind: author_judgment
  intro: i
  training_matrix: { scale_header: [], rows: [] }
  inference_matrix: { scale_header: [], rows: [] }
  veto_rules: []
shelf_life: []
`;

function makeTree({ device = {}, sources = '' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'data-'));
  mkdirSync(join(root, 'data', 'accelerators'), { recursive: true });
  mkdirSync(join(root, 'data', 'cluster-forms'), { recursive: true });
  mkdirSync(join(root, 'data', 'frameworks'), { recursive: true });
  mkdirSync(join(root, 'references'), { recursive: true });
  cpSync(join(repoRoot, 'data', 'schemas'), join(root, 'data', 'schemas'), { recursive: true });
  const d = {
    id: 'test-card', vendor: 'V', model: 'M', category: 'nvidia',
    memory: { capacity: '80 GB', type: 'HBM3' },
    interconnect: {}, compute: [], power: {},
    verification: 'unverified', sources: [],
    ...device,
  };
  const dev = `schema_version: 1
snapshot_date: "2026-08"
intro_notes: []
tendency_notes: []
devices:
  - ${JSON.stringify(d)}
`;
  writeFileSync(join(root, 'data', 'accelerators', 'accelerators.yaml'), dev);
  writeFileSync(join(root, 'data', 'cluster-forms', 'cluster-forms.yaml'), MIN_CLUSTER);
  writeFileSync(join(root, 'data', 'frameworks', 'frameworks.yaml'), MIN_FRAMEWORKS);
  writeFileSync(join(root, 'references', 'sources.yaml'), sources || 'schema_version: 1\nsources: []\n');
  return root;
}

test('最小合法数据树通过', () => {
  const { errors } = validateData(makeTree());
  assert.deepEqual(errors, []);
});

test('verified 设备无来源失败', () => {
  const { errors } = validateData(makeTree({ device: { verification: 'verified' } }));
  assert.ok(errors.some((e) => e.rule === 'data-verified-needs-source'));
});

test('引用未知 source id 失败', () => {
  const { errors } = validateData(makeTree({ device: { sources: ['SRC-NOPE'] } }));
  assert.ok(errors.some((e) => e.rule === 'data-unknown-source'));
});

test('schema 违规(非法 category)失败', () => {
  const { errors } = validateData(makeTree({ device: { category: 'other' } }));
  assert.ok(errors.some((e) => e.rule === 'data-schema'));
});

test('过期 review 输出 warning 与 stale 项', () => {
  const { errors, warnings, stale } = validateData(
    makeTree({ device: { review: { reviewed_at: '2020-01-01', review_after_days: 30 } } }),
  );
  assert.equal(errors.length, 0);
  assert.ok(warnings.some((w) => w.rule === 'data-stale'));
  assert.equal(stale.length, 1);
});

test('缺 reviewed_at 的 review_after_days 失败', () => {
  const { errors } = validateData(makeTree({ device: { review: { review_after_days: 30 } } }));
  assert.ok(errors.some((e) => e.rule === 'data-review-date-missing'));
});
