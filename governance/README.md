# 内容治理规范

本目录是仓库内容治理的规则单一来源,描述**当前实际执行**的规则;尚未落地的做法在文中一律标注「规划中」。重大取舍的背景与备选方案记录在 [decisions/](../decisions/README.md)。

| 文档 | 内容 |
|---|---|
| [content-architecture.md](content-architecture.md) | 五入口信息架构:页面类型职责与 URL 稳定性规则 |
| [lab-fidelity-model.md](lab-fidelity-model.md) | 实验三路径(Replay / Local / Cloud)与 F0–F5 保真度模型 |
| [evidence-policy.md](evidence-policy.md) | Evidence as Code:Claim 登记、证据等级、数据性质标注 |
| [review-workflow.md](review-workflow.md) | 技术审阅与目标读者审阅双轨流程 |
| [figure-and-data-policy.md](figure-and-data-policy.md) | 图表与数据来源规范 |
| [migration-policy.md](migration-policy.md) | 非破坏式结构迁移原则 |

内容关系与审阅状态的机器可读登记在仓库根的 [book-manifest.yaml](../book-manifest.yaml),由 `node scripts/validate-manifest.mjs` 校验。
