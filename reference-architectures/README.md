# 参考架构索引

十节结构(目标与非目标/组件图/数据流/容量模型/故障域/安全边界/可观测性/Runbook 索引/成本驱动项/失效边界);容量数字全部为公式代入并声明假设(附录 B 与 calculators/)。每个架构写明失效边界与升级去向,按规模递进选用。模板见 [templates/reference-architecture.md](../templates/reference-architecture.md)。

- [参考架构 01:单机 8 卡开发/微调平台](ra-01-single-node-dev-finetune.md)
- [参考架构 02:64–128 卡训练集群](ra-02-training-cluster-64-128.md)
- [参考架构 03:千卡训练集群](ra-03-kilocard-training-cluster.md)
- [参考架构 04:异构算力平台(NVIDIA + 国产双后端)](ra-04-heterogeneous-compute-platform.md)
- [参考架构 05:多模型在线推理平台](ra-05-multi-model-serving-platform.md)
- [参考架构 06:Agent 平台](ra-06-agent-platform.md)
- [参考架构 07:多集群 AI 平台](ra-07-multi-cluster-ai-platform.md)
