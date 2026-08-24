import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { Ajv } from 'ajv';

const DAY_MS = 24 * 60 * 60 * 1000;

const DATA_FILES = [
  { data: 'data/accelerators/accelerators.yaml', schema: 'data/schemas/accelerator.schema.json' },
  { data: 'data/cluster-forms/cluster-forms.yaml', schema: 'data/schemas/cluster-form.schema.json' },
  { data: 'data/frameworks/frameworks.yaml', schema: 'data/schemas/framework.schema.json' },
];

function loadSourceIds(rootDir) {
  const p = join(rootDir, 'references', 'sources.yaml');
  if (!existsSync(p)) return new Set();
  const doc = parseYaml(readFileSync(p, 'utf8'));
  return new Set((doc?.sources ?? []).map((s) => s.id));
}

/** 校验 data/ 下三个结构化数据文件:schema、来源引用、verified 规则、freshness。 */
export function validateData(rootDir, { today = new Date() } = {}) {
  const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
  const sourceIds = loadSourceIds(rootDir);
  const errors = [];
  const warnings = [];
  const stale = [];

  const checkEntry = (file, entry, label) => {
    for (const sid of entry.sources ?? []) {
      if (!sourceIds.has(sid)) errors.push({ file, id: label, rule: 'data-unknown-source', message: `引用未知 source id: ${sid}` });
    }
    if (entry.verification === 'verified' && (entry.sources ?? []).length === 0) {
      errors.push({ file, id: label, rule: 'data-verified-needs-source', message: 'verified 数据项至少需要一个来源' });
    }
    const r = entry.review;
    if (r?.review_after_days) {
      if (!r.reviewed_at) {
        errors.push({ file, id: label, rule: 'data-review-date-missing', message: '设置了 review_after_days 但缺 reviewed_at' });
      } else if (today.getTime() - Date.parse(r.reviewed_at) > r.review_after_days * DAY_MS) {
        warnings.push({ file, id: label, rule: 'data-stale', message: `超过 review_after_days=${r.review_after_days}` });
        stale.push({ file, id: label, reviewed_at: r.reviewed_at, review_after_days: r.review_after_days });
      }
    }
  };

  for (const { data, schema } of DATA_FILES) {
    const dataPath = join(rootDir, data);
    if (!existsSync(dataPath)) {
      errors.push({ file: data, id: null, rule: 'data-missing', message: '数据文件不存在' });
      continue;
    }
    const doc = parseYaml(readFileSync(dataPath, 'utf8'));
    const validate = ajv.compile(JSON.parse(readFileSync(join(rootDir, schema), 'utf8')));
    if (!validate(doc)) {
      for (const e of validate.errors) errors.push({ file: data, id: null, rule: 'data-schema', message: `${e.instancePath} ${e.message}` });
      continue;
    }
    for (const d of doc.devices ?? []) checkEntry(data, d, d.id);
    for (const list of [doc.training, doc.inference, doc.tooling]) {
      for (const p of list ?? []) checkEntry(data, p, p.name ?? p.purpose);
    }
  }
  return { errors, warnings, stale };
}
