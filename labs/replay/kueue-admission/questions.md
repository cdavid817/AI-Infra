# 分析问题

先只看 `manifests/` 下的三类对象与 [events.txt](events.txt),独立作答后再对照 [answers.md](answers.md)。

1. **预测**:只根据 `cluster-queue.yaml` 的配额和两个作业的资源请求,哪个 Workload 会 Pending?写出你的算式。
2. **归因**:`snapshots/01-pending.yaml` 里,判断 Pending 直接原因的字段是哪一个?它说明缺口是多少?
3. **转移**:events.txt 中哪**一个**事件改变了作业 B 的可准入条件?如果没有这次配额调整,还有什么事件也能让它被准入?
4. **状态语义**:`QuotaReserved=True` 与 `Admitted=True` 分别表示什么?为什么是两个独立条件?
5. **边界判断**:本实验验证的是控制面语义还是 GPU 性能?如果 09:40:07 之后 Pod 长时间 Pending,应该继续采集哪些证据?
6. **反证**:为什么这份材料不能证明「该集群的真实 GPU 调度性能没有问题」?至少列出三类材料中不存在的证据。
