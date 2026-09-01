# 图表与数据来源规范

## 工具分工(现行约定)

- **D2**:架构图、分层图(生成物入 `diagrams/`)
- **Mermaid**:时序图、流程图、状态机(统一 init 主题;红色仅用于瓶颈与故障,由 `scripts/validate-chapters.mjs` 与 `scripts/check-mermaid.mjs` 检查)
- **Excalidraw**:原理示意图
- **数据图(性能曲线、分布等)**:由 `visuals/` 流水线从数据生成(`npm run visuals:build`),不得用 Mermaid 代替实测数据图

## 每张关键图必须可回答

- 用途:读者应从图中得出什么结论
- 数据性质:`measured` / `derived` / `estimate` / `synthetic`(口径见 [evidence-policy.md](evidence-policy.md))
- 坐标轴与单位(数据图)
- 数据来源或生成脚本(生成图必须可再生,由 `scripts/check-figure-regeneration.mjs` 检查)
- 环境与假设;不适用范围

## 第三方图片

授权与来源登记在 `images/sources.yaml`,台账见 [images/SOURCES.md](../images/SOURCES.md),由 `node scripts/validate-images.mjs` 校验;发布门禁要求授权状态为 approved。

## 图注

章节内 Mermaid 图与生成图后必须有「图 X-N:标题。结论。」式图注(由 `scripts/validate-chapters.mjs` 强制)。
