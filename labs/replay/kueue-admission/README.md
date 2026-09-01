# Replay:Kueue 队列、配额与准入控制(F0)

> **零环境实验**:不需要 Kubernetes、Docker 或 GPU。所有材料是预置的对象清单、状态快照和事件流,你的任务是像值班工程师一样读懂它们。
>
> **数据性质:synthetic(教学构造)**。所有对象、事件与时间戳为教学示例,不是任何真实集群的测量记录。
>
> 元数据(validates / does_not_validate)见 [lab.yaml](lab.yaml);动手路径见 [Lab 04:Kueue 与 Gang 语义演示](../../lab-04-kueue-gang-scheduling.md)(kind 环境,L0/F1)。

## 场景

团队 team-a 共享一个配额为 8 卡的 ClusterQueue。已有一个 8 卡训练作业在跑,此时又提交了一个 4 卡作业;随后管理员把配额调到 12 卡。你需要根据材料回答:谁会等、为什么等、什么事件让它不等了。

## 材料

| 文件 | 内容 |
|---|---|
| [manifests/cluster-queue.yaml](manifests/cluster-queue.yaml) | ClusterQueue 与 ResourceFlavor 定义(8 卡配额) |
| [manifests/local-queue.yaml](manifests/local-queue.yaml) | LocalQueue → ClusterQueue 绑定 |
| [manifests/workload-a.yaml](manifests/workload-a.yaml) | 作业 A:train-llama-sft,8 卡 |
| [manifests/workload-b.yaml](manifests/workload-b.yaml) | 作业 B:train-reward-model,4 卡 |
| [snapshots/01-pending.yaml](snapshots/01-pending.yaml) | 作业 B 等待期的 Workload 状态快照 |
| [snapshots/02-admitted.yaml](snapshots/02-admitted.yaml) | 配额调整后作业 B 的状态快照 |
| [events.txt](events.txt) | 控制面事件流(kubectl get events 风格) |
| [timeline.md](timeline.md) | 配额变化时间线与关键状态转移 |

## 步骤

1. 读三个 manifests,画出 LocalQueue → ClusterQueue → 配额 的关系。
2. 只看 workload-a/b 的资源请求和 cluster-queue 配额,**先预测**谁会 Pending,再打开快照核对。
3. 对照 [events.txt](events.txt) 与 [timeline.md](timeline.md),找出让作业 B 从 Pending 变为 Admitted 的那一个事件。
4. 回答 [questions.md](questions.md) 的全部问题,再对照 [answers.md](answers.md)。

## 本实验能验证 / 不能验证

**能**:队列对象关系、配额推理、Workload 准入状态分析、Pending → Admitted 转移、基于事件的诊断方法(控制面语义,F0)。

**不能**:NVIDIA Device Plugin 行为、CUDA Runtime、GPU 拓扑、NVLink/NVSwitch、GPU 性能、生产规模调度扩展性——材料里根本没有节点侧和设备侧证据,详见 [answers.md](answers.md) 问题 6。
