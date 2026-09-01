# Labs 索引

分层口径(计划 §16.1):**L0** 无 GPU 普通开发机 / **L1** 单 GPU / **L2** 单机多 GPU / **L3** K8s·Slurm 集群。每个 Lab 含等级、成本、安全风险、清理步骤与可验证成功判据;模板见 [templates/lab.md](../templates/lab.md)。

L 级描述「需要什么环境」;与之互补的 **Replay / Local / Cloud 三路径与 F0–F5 保真度**口径(描述「结论能有多真」)见 [governance/lab-fidelity-model.md](../governance/lab-fidelity-model.md)。**完全没有实验环境?** 从零环境路径开始:[没有实验环境怎么办](no-environment.md)。

## Replay(零环境)实验

| Replay | 保真度 | 状态 |
|---|---|---|
| [Kueue 队列、配额与准入控制](replay/kueue-admission/README.md)(配套 Lab 04) | F0 | 试点 |

| Lab | 等级 |
|---|---|
| [Lab 01:Roofline 与算术强度可视化](lab-01-roofline-arithmetic-intensity.md) | L0 无 GPU |
| [Lab 02:GPU 拓扑与互联域识别](lab-02-gpu-topology-discovery.md) | L1 单 GPU(可完成主体)/ L2 单机多 GPU(完整体验) |
| [Lab 03:AllReduce 有效带宽测量与对账](lab-03-allreduce-effective-bandwidth.md) | L2 单机多 GPU(主体)/ L3 集群(跨机对比,可选) |
| [Lab 04:Kueue 与 Gang 语义演示](lab-04-kueue-gang-scheduling.md) | L0(kind 模拟,无 GPU,笔记本可跑)/ L3(真集群,占用调度体系,须与集群管理员协调) |
| [Lab 05:Checkpoint 写入窗口基准](lab-05-checkpoint-write-window.md) | L1 单 GPU(实际只需一台能访问目标存储的训练节点,GPU 非必需) |
| [Lab 06:vLLM 批处理与 KV Cache 观测](lab-06-vllm-batching-kv-observation.md) | L1 单 GPU |
| [Lab 07:Prefix Cache 与请求亲和性——复现 P_路由 因子](lab-07-prefix-cache-affinity.md) | L1 单 GPU(单卡跑两实例的缩小版)/ L2 单机多 GPU(每实例独占一卡,推荐) |
| [Lab 08:InferencePool 与 EPP——模型感知的实例选择层](lab-08-inferencepool-epp-routing.md) | L3 集群(Kubernetes;至少 2 个 GPU 节点或单节点多卡跑多副本) |
| [Lab 09:Agent 沙箱、资源限制与审批钩子(防御演示)](lab-09-agent-sandbox-permissions.md) | L0 无 GPU(容器沙箱)/ L1 可选(若在带 GPU 的开发机上顺带验证 GPU 不可见) |
| [Lab 10:OTel GenAI Trace——给最小 Agent 循环打标准 span](lab-10-otel-genai-tracing.md) | L0 无 GPU(模型调用可打向任意托管 API 或桩服务)/ L1 可选(本地起一个小模型引擎作被调方) |
| [Lab 11:模型签名与 ML-BOM——验签失败即拒绝](lab-11-model-signing-bom.md) | L0 无 GPU(全程普通开发机,权重用小文件模拟) |
