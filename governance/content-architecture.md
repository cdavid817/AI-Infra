# 五入口信息架构

本仓库同时服务五类读者任务。站点在保留原有章节导航的前提下,提供五个任务型一级入口:

| 入口 | 定义 | 主要内容 | 读者任务 |
|---|---|---|---|
| [学习原理](../entries/learn.md) | 解释机制、边界与因果关系 | 31 章正文、附录、阅读路径 | 建立系统知识模型 |
| [动手实验](../entries/labs.md) | 通过回放、模拟或真实环境验证机制 | [labs/](../labs/README.md)(Replay / Local / Cloud 三路径) | 在不同环境条件下验证机制 |
| [生产运维](../entries/operate.md) | 面向事故处置的操作手册 | [runbooks/](../runbooks/README.md) | 定位故障、止损、恢复、复盘 |
| [架构决策](../entries/decide.md) | 选型、容量与成本权衡 | [reference-architectures/](../reference-architectures/README.md)、[calculators/](../calculators/examples/README.md) | 技术选型、容量规划、成本分析 |
| [证据与更新](../entries/evidence.md) | 结论可信度与时效性 | `references/claims/`、`references/sources.yaml`、[勘误](../ERRATA.md)、新鲜度报告 | 判断结论可核验性与时效性 |

## 页面类型职责

每种页面类型回答自己的核心问题,不越界承担其他类型的职责:

- **Chapter**:机制为什么存在、内部如何工作、边界在哪里;不承担长篇操作清单。
- **Lab**:如何观察、验证或反驳一个机制性判断;不得给出超出其保真度等级的性能结论(见 [lab-fidelity-model.md](lab-fidelity-model.md))。
- **Runbook**:事故发生后按什么顺序止损、采证、恢复;不承担系统化基础教学。
- **Reference Architecture**:给定目标与约束下如何组合系统;不做单一厂商宣传。
- **Calculator**:基于哪些假设得到什么估算结果;不得冒充真实压测结果。
- **Claim / Evidence**:一个关键结论由什么证据支持、何时需要复审;不替代正文解释。

## 关联要求

重点章节(有对应实验、Runbook 或计算器的章节)应在正文或 Manifest 中登记与相关资产的关联;新登记的关联统一维护在 [book-manifest.yaml](../book-manifest.yaml) 的 `collections` 与 `labs` 段,避免 README、侧边栏与正文关系漂移。

## URL 稳定性规则

- 现有章节、Lab、Runbook、参考架构与附录的文件路径即发布 URL,**不得在无兼容措施的情况下变更**。
- 任何文件移动必须先在 Manifest 的 `legacy_paths` 段登记旧路径 → 新路径映射,并提供站点侧兼容(重定向或兼容页),再执行移动。本次结构调整未移动任何既有文件。
