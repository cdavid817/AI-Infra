# 动手实验

**适用角色**:想亲手验证机制的工程师——从完全没有环境,到有真实 GPU 集群。

**能解决的问题**:把书中的公式与机制变成可复算、可观察的结果;训练故障分析与诊断的手感。

## 三条路径

实验按 **Replay(零环境)/ Local(普通电脑)/ Cloud(真实 GPU)** 三路径与 F0–F5 保真度组织,口径见 [governance/lab-fidelity-model.md](../governance/lab-fidelity-model.md):

- **没有实验环境?** 从 [零环境路径说明](../labs/no-environment.md) 开始;当前试点:[Replay:Kueue 队列、配额与准入控制](../labs/replay/kueue-admission/README.md)(F0)
- **有一台普通电脑**:[Labs 索引](../labs/README.md) 中的 L0 实验(Roofline、Kueue kind、Agent 沙箱、OTel Tracing、模型签名)
- **有 GPU / 集群**:L1–L3 实验(拓扑发现、AllReduce 带宽、vLLM 观测、InferencePool 路由等)

## 推荐顺序

1. 先读对应章节原理([学习原理](learn.md)),再做实验——每个 Lab 头部标注了关联章节
2. 每个实验先看 `validates` / `does_not_validate`,明确它**不能**证明什么
3. 做完实验遇到真实故障 → [生产运维](operate.md) 的 Runbooks

模拟与回放实验只验证控制面与方法论,**不代表真实 GPU 性能**;性能结论必须来自真实环境路径。
