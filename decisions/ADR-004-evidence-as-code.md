# ADR-004:Evidence as Code

- 状态:已采纳(2026-09)
- 规范:[governance/evidence-policy.md](../governance/evidence-policy.md)

## 背景

仓库已有 Claim 登记(`references/claims/chapter-XX.yaml`)、来源政策与新鲜度机制,但审计覆盖状态、证据等级口径和数据性质标注缺少统一的机器可读约定;「哪些章节审过、哪些只是还没登记」无法区分。

## 决策

把证据机制明文化为治理规范:Claim 分类与必填字段、L1–L5 证据等级、`measured` / `derived` / `estimate` / `synthetic` 四类数据性质、高风险 Claim 默认清单;章节证据审计状态(`pending` / `audited-no-claims` / `audited`)登记在 `book-manifest.yaml`,初始值一律 `pending`。

## 后果

- 发布门禁可以机械识别未审计与过期内容;读者可以区分数据性质。
- 维护者承担 Claim 元数据成本;为控制成本,只有高风险结论强制登记。
- 全章节审计是后续工作,本决策只建立口径与状态模型,不宣称审计已完成。

## 备选方案

靠正文脚注与人工记忆维护证据:无法机器检查、无法过期提醒,放弃。
