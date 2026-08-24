import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { Ajv } from 'ajv';

const DAY_MS = 24 * 60 * 60 * 1000;

function loadSchema(schemaDir, name) {
  return JSON.parse(readFileSync(join(schemaDir, name), 'utf8'));
}

/**
 * 校验证据体系:sources.yaml + claims/*.yaml。
 * 返回 { errors, warnings },均为 { file, id, rule, message }。
 */
export function validateEvidence(rootDir, { today = new Date() } = {}) {
  const refDir = join(rootDir, 'references');
  const schemaDir = join(refDir, 'schemas');
  const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
  const validateSource = ajv.compile(loadSchema(schemaDir, 'source.schema.json'));
  const validateClaim = ajv.compile(loadSchema(schemaDir, 'claim.schema.json'));

  const errors = [];
  const warnings = [];
  const err = (file, id, rule, message) => errors.push({ file, id, rule, message });
  const warn = (file, id, rule, message) => warnings.push({ file, id, rule, message });

  // --- sources ---
  const sourcesFile = join(refDir, 'sources.yaml');
  const sourceIds = new Set();
  if (!existsSync(sourcesFile)) {
    err('references/sources.yaml', null, 'sources-missing', '来源注册表不存在');
  } else {
    const doc = parseYaml(readFileSync(sourcesFile, 'utf8'));
    if (!validateSource(doc)) {
      for (const e of validateSource.errors) {
        err('references/sources.yaml', null, 'source-schema', `${e.instancePath} ${e.message}`);
      }
    }
    for (const s of doc?.sources ?? []) {
      if (!s?.id) continue;
      if (sourceIds.has(s.id)) err('references/sources.yaml', s.id, 'source-id-duplicate', 'source id 重复');
      sourceIds.add(s.id);
      const reviewBase = s.accessed_at ? Date.parse(s.accessed_at) : NaN;
      if (s.review_after_days && Number.isFinite(reviewBase)) {
        if (today.getTime() - reviewBase > s.review_after_days * DAY_MS) {
          warn('references/sources.yaml', s.id, 'source-stale', `超过 review_after_days=${s.review_after_days},需复核`);
        }
      }
      if (s.expires_at && Date.parse(s.expires_at) < today.getTime()) {
        err('references/sources.yaml', s.id, 'source-expired', `已过 expires_at=${s.expires_at}`);
      }
      if (s.status === 'retracted' || s.status === 'dead') {
        warn('references/sources.yaml', s.id, 'source-inactive', `status=${s.status},引用它的 claim 需要复查`);
      }
    }
  }

  // --- claims ---
  const claimsDir = join(refDir, 'claims');
  const claimIds = new Set();
  const claimFiles = existsSync(claimsDir)
    ? readdirSync(claimsDir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml')).sort()
    : [];
  for (const fileName of claimFiles) {
    const rel = `references/claims/${fileName}`;
    const doc = parseYaml(readFileSync(join(claimsDir, fileName), 'utf8'));
    if (!validateClaim(doc)) {
      for (const e of validateClaim.errors) err(rel, null, 'claim-schema', `${e.instancePath} ${e.message}`);
      continue;
    }
    for (const c of doc.claims ?? []) {
      if (claimIds.has(c.id)) err(rel, c.id, 'claim-id-duplicate', 'claim id 全局重复');
      claimIds.add(c.id);

      for (const sid of c.sources ?? []) {
        if (!sourceIds.has(sid)) err(rel, c.id, 'claim-unknown-source', `引用未知 source id: ${sid}`);
      }

      if (c.claim_type === 'illustrative') {
        if (c.status !== 'illustrative_only') {
          err(rel, c.id, 'illustrative-status', 'illustrative 类型只能是 illustrative_only 状态');
        }
        if (!c.disclosure) err(rel, c.id, 'illustrative-disclosure', 'illustrative 必须写明 disclosure');
        if (c.evidence_level !== 'L5') err(rel, c.id, 'illustrative-level', 'illustrative 的 evidence_level 应为 L5');
      }

      if (c.claim_type === 'estimate') {
        if (!c.estimate) err(rel, c.id, 'estimate-fields', 'estimate 类型必须提供 estimate{inputs,formula,assumptions,error_sources}');
        if (c.status === 'verified') err(rel, c.id, 'estimate-status', 'estimate 应为 estimate_only,不得标 verified');
      }

      if (c.claim_type === 'measurement') {
        if (!c.measurement && c.status === 'verified') {
          err(rel, c.id, 'measurement-fields', 'measurement 缺少环境口径字段,不得标 verified');
        }
      }

      if (c.status === 'verified') {
        const needsSource = ['quantitative', 'compatibility', 'project_status', 'incident'].includes(c.claim_type);
        if (needsSource && (c.sources ?? []).length === 0) {
          err(rel, c.id, 'verified-needs-source', `${c.claim_type} 类 verified 结论至少需要一个来源`);
        }
        if (!c.reviewed_at) err(rel, c.id, 'verified-needs-review-date', 'verified 结论必须有 reviewed_at');
      }

      if (c.review_after_days) {
        if (!c.reviewed_at) {
          err(rel, c.id, 'volatile-needs-review-date', '高时效 claim(设置了 review_after_days)必须有 reviewed_at');
        } else if (today.getTime() - Date.parse(c.reviewed_at) > c.review_after_days * DAY_MS) {
          warn(rel, c.id, 'claim-stale', `超过 review_after_days=${c.review_after_days},需复核`);
        }
      }
    }
  }

  return { errors, warnings, sourceCount: sourceIds.size, claimCount: claimIds.size };
}
