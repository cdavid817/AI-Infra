# 没有实验环境怎么办

没有 GPU、没有集群、甚至没有 Docker,也不该被挡在实验之外。本书把实验拆成三条路径(口径见 [governance/lab-fidelity-model.md](../governance/lab-fidelity-model.md)),按你手头的环境选择:

| 模式 | 需要什么 | 能练什么 | 当前状态 |
|---|---|---|---|
| **零环境 Replay 推演** | 只需要浏览器 | 读对象清单、状态快照和事件流,完成诊断与决策推演(F0) | **试点**:[Kueue 队列、配额与准入控制](replay/kueue-admission/README.md) |
| **普通电脑 Local 模拟** | 笔记本 + Docker(部分需 kind) | 控制面与功能行为验证(F1) | **已提供**:[Labs 索引](README.md) 中的 L0 实验(Lab 01/04/09/10/11) |
| **浏览器或 Notebook 实验** | 浏览器 / Jupyter | 公式复算与估算推演 | **部分提供**:[配套计算器](../calculators/examples/README.md) 可在本地 Python 运行;Web 化为规划中 |
| **短时真实 GPU 验证** | 单卡云主机或工作站(小时级租用) | 单卡真实行为(F2–F3):[Lab 02](lab-02-gpu-topology-discovery.md)、[Lab 06](lab-06-vllm-batching-kv-observation.md) 等 L1 实验 | 已提供(需自备环境与预算) |

## 什么可以通过模拟证明

- 控制面语义:队列、配额、准入、调度决策的因果链(如 Kueue Replay)
- 分析与诊断方法:从事件、日志、状态快照定位问题的流程
- 公式与估算:显存、并发、工期、TCO 等推导(计算器 + 附录 B)
- 配置与功能行为:对象定义是否正确、控制器如何响应(kind 模拟)

## 什么必须在真实环境中验证

- GPU 设备行为:Device Plugin、CUDA Runtime、显存隔离、GPU 拓扑与 NVLink/NVSwitch
- 一切性能结论:吞吐、延迟、有效带宽、扩展效率——模拟环境的性能数字没有效力
- 多节点行为:集合通信、网络拥塞、故障域放大
- 生产规模:调度扩展性、多租户公平性、长时间稳定性

每个实验的 `validates` / `does_not_validate` 声明了自己的结论边界;超出边界的判断,请换更高保真度路径或参考 [证据与更新](../entries/evidence.md) 中的来源登记。
