/**
 * Claim ID → Claim 登记文件的唯一映射实现。
 * 规则:CLM-024-001 的章节段 "024" 按数值解析后重新补零到至少两位,
 * 得到 references/claims/chapter-24.yaml(而不是 chapter-024.yaml);
 * CLM-008-001 → chapter-08.yaml。
 */
const CLAIM_ID_RE = /^CLM-(\d{3})-(\d{3})$/;

/** 合法 Claim ID → 仓库内登记文件相对路径;非法 ID → null。 */
export function claimFilePath(claimId) {
  const m = CLAIM_ID_RE.exec(claimId);
  if (!m) return null;
  const chapter = Number(m[1]);
  if (chapter < 1) return null;
  return `references/claims/chapter-${String(chapter).padStart(2, '0')}.yaml`;
}

/**
 * 解析 Claim 角标的跳转 URL。
 * exists(relPath) 由调用方注入(通常为 existsSync),登记文件不存在时返回 null,
 * 调用方应降级为不渲染链接,避免产出 404。
 */
export function resolveClaimHref(claimId, { repoUrl, branch = 'main', exists = () => true } = {}) {
  const file = claimFilePath(claimId);
  if (!file || !repoUrl || !exists(file)) return null;
  return `${repoUrl.replace(/\/$/, '')}/blob/${branch}/${file}`;
}
