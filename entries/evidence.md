# 证据与更新

**适用角色**:需要判断「这个结论还可信吗、过期了吗」的所有读者;内容维护者与审阅者。

**能解决的问题**:一个关键结论由什么证据支持、数据的口径日期是什么、哪些内容审过、哪些还没有。

## 证据机制

- **Claim 登记**:正文中的可核验结论渲染为 `[CLM-XXX-YYY]` 角标,点击跳转到 [references/claims/](https://github.com/cdavid817/AI-Infra-Tutorial/tree/main/references/claims) 下对应章节的登记文件(含来源、范围、限制)
- **来源政策与登记**:[references/source-policy.md](https://github.com/cdavid817/AI-Infra-Tutorial/blob/main/references/source-policy.md) 与 `references/sources.yaml`
- **规范**:[Evidence as Code](../governance/evidence-policy.md)——证据等级 L1–L5、数据性质四分类(measured / derived / estimate / synthetic)、高风险 Claim 清单

## 新鲜度与版本

- **数据快照口径**:[book-version.yaml](https://github.com/cdavid817/AI-Infra-Tutorial/blob/main/book-version.yaml) 的 `data_snapshot`;附录 A/B/C 的时效性数据以此为准
- **勘误与更新**:[ERRATA](../ERRATA.md) · 版本历史:[CHANGELOG](../CHANGELOG.md)
- nightly CI 生成来源新鲜度报告(Actions 产物)

## 审阅状态

审阅走 [技术 + 目标读者双轨流程](../governance/review-workflow.md),状态登记在 [book-manifest.yaml](https://github.com/cdavid817/AI-Infra-Tutorial/blob/main/book-manifest.yaml)。**当前状态如实说明**:全书处于 release-candidate 阶段,章节审阅与证据审计状态为 `pending`(按登记推进,未审计不等于已通过)。
