# 参考答案

1. 作业 B(train-reward-model)会 Pending。ClusterQueue 名义配额 8 卡;作业 A 请求 8 × 1 = 8 卡先到先得,占满配额;作业 B 请求 4 × 1 = 4 卡,8(已用)+ 4(新请求)= 12 > 8,配额不足。
2. `status.conditions` 中 `type: QuotaReserved, status: "False", reason: Pending` 的 `message`:`insufficient unused quota for nvidia.com/gpu in flavor default-flavor, 4 more needed`——缺口是 4 卡。
3. `09:40:02 UpdatedClusterQueue`:nominalQuota 从 8 上调到 12,使未用配额从 0 变为 4,满足作业 B 的请求。替代路径:作业 A 完成(或被抢占/驱逐)释放 8 卡,同样会触发作业 B 重新评估并准入。
4. `QuotaReserved=True` 表示 ClusterQueue 已为该 Workload 保留了配额(记账层面占位);`Admitted=True` 表示全部准入条件(配额 + 可能存在的 AdmissionChecks)都已满足,作业控制器可以解除 suspend 并创建 Pod。分成两个条件,是因为配额保留之后还可能有额外准入检查(如 ProvisioningRequest、多集群调度),两者可以分别失败与回退。
5. 控制面语义(F0)。材料只包含 Kueue 对象、条件与事件,证明的是「配额记账允许它跑」。若 Pod 之后仍 Pending,应继续采集:Pod 的调度事件(`kubectl describe pod` 的 FailedScheduling 原因)、节点可分配资源与 Device Plugin 注册状态(`kubectl describe node` 的 `nvidia.com/gpu` Allocatable)、kube-scheduler / Kueue 控制器日志、AdmissionCheck 状态、命名空间配额(ResourceQuota)与权限。
6. 材料中不存在:① 节点侧证据(节点 GPU Allocatable、Device Plugin 注册、驱动/固件状态);② 运行时证据(容器内 CUDA 可见性、NVML/nvidia-smi 输出、NVLink/NVSwitch 拓扑);③ 性能证据(调度延迟分布、大规模并发下的准入吞吐、GPU 利用率或训练吞吐)。而且数据本身是 synthetic 教学构造,即使形态正确也不构成对任何真实集群的测量。因此它只能证明「读者会分析控制面语义」,不能证明「真实 GPU 调度性能没有问题」。
