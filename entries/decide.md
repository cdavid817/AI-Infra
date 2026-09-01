# 架构决策

**适用角色**:架构师、技术负责人、FAE / 解决方案与采购评估方。

**能解决的问题**:技术选型、容量规划、成本分析——给定目标与约束,如何组合系统并算清代价。

## 参考架构

[reference-architectures/](../reference-architectures/README.md) 从单机 8 卡到多集群平台共 7 档,容量模型全部公式代入,每档写明失效边界与升级去向。

## 计算器

[calculators/](../calculators/examples/README.md) 七个可执行估算器:训练显存、KV 并发、训练工期、集合通信、Checkpoint 窗口、推理容量、功率 TCO。公式与附录 B 双向对齐,输出含假设与不确定性——**估算不是压测结果**。

## 选型与容量的原理支撑

- 卡与集群选型:第 4、12 章 + 附录 A/C/E
- 容量、成本与 SLO 收口:第 31 章(QPS→卡数→功率推导链、TCO)
- 结构性取舍记录:[decisions/](../decisions/README.md)(仓库自身的 ADR 实践)

## 决策前后

- 输入的数字可信吗 → [证据与更新](evidence.md) 查数据快照与来源
- 方案能落地吗 → [动手实验](labs.md) 用最低成本路径先验证控制面语义
