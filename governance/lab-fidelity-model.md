# 实验三路径与 F0–F5 保真度模型

环境门槛不应阻止读者学习机制与诊断方法;同时,模拟结果绝不能被误认为真实性能证据。本模型用「路径 × 保真度」两个维度把这两件事同时说清楚。

## 三条执行路径

| 路径 | 环境要求 | 训练的能力 |
|---|---|---|
| **Replay** | 无 Docker、无 Kubernetes、无 GPU,纯阅读与推演 | 分析、诊断、计算和决策能力 |
| **Local** | 普通电脑(Docker / kind 等) | 控制面、配置和功能行为验证 |
| **Cloud** | 真实 GPU、网络或集群环境 | 真实硬件行为与性能验证 |

与既有 Labs 的 **L0–L3 环境分层**(见 [labs/README.md](../labs/README.md))的关系:L 级描述「需要什么环境」,F 级描述「结论能有多真」。两者互补:例如 L0 kind 模拟对应 F1,L3 真集群对应 F3–F4。既有 Lab 的 L 级标注保持不变,新登记的实验路径在 `lab.yaml` 中同时声明 fidelity。

## F0–F5 保真度等级

| 等级 | 定义 | 允许支持的结论 |
|---|---|---|
| **F0** | 静态数据、日志、事件与状态快照回放 | 分析方法、证据链、决策流程 |
| **F1** | 模拟环境功能验证(kind、CPU 模拟资源等) | 控制面和功能行为 |
| **F2** | 单机真实组件验证 | 单机组件行为,不代表集群性能 |
| **F3** | 单节点真实 GPU 验证 | 单节点硬件与软件组合的结果 |
| **F4** | 多节点真实环境验证 | 指定拓扑下的扩展与通信结果 |
| **F5** | 生产或准生产规模验证 | 明确范围内的生产决策证据 |

## 强制元数据

每个登记进 Manifest 的实验必须在其 `lab.yaml` 中声明(Schema:[references/schemas/lab.schema.json](../references/schemas/lab.schema.json),由 `node scripts/validate-labs.mjs` 校验):

- `learning_objectives`:学习目标
- `paths.{replay,local,cloud}`:每条路径的 `status`(`available` / `pilot` / `planned`)、`environment`、`fidelity`、`entrypoint`
- `validates`:本实验**能**支持的结论列表
- `does_not_validate`:本实验**不能**支持的结论列表
- `data_nature`:所用数据性质(`synthetic` / `measured` / `derived`),合成教学数据必须标 `synthetic`
- `last_verified`:每条路径最近一次实际执行验证的日期与 commit;从未执行过的路径必须为 `null` 且 `status` 不得高于 `planned`
- `estimated_cost` 与 `risk`:预期成本与风险提示

**未实际运行过的 Local / Cloud 路径一律 `status: planned`,不得标记为已验证。**

## 性能数字的附加声明

任何实验产出的性能数字,引用时必须附带:硬件型号与数量、软件版本、模型与数据集、输入规模与并发、预热与样本数、误差或不确定性、测量日期。缺少这些要素的数字只能作为教学示意并标注 `synthetic` 或 `estimate`。

## Cloud 路径安全规则

任何会创建付费资源的脚本必须:默认 Dry Run(显式二次确认才执行)、限定资源类型与数量白名单、设置最大运行时长、给出预算提示、退出时销毁资源并检查残留、绝不在仓库保存凭证。当前仓库**未引入任何会创建云资源的脚本**;引入前必须先满足以上全部护栏。
