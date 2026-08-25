# 故障 Runbooks 索引

统一九段结构(现象/影响范围/立即止损/证据采集/诊断决策树/修复/恢复验证/复盘数据/长期防复发);止损先于诊断,安全类只含防御与响应。模板见 [templates/runbook.md](../templates/runbook.md)。

**训练侧**

- [Runbook 01:训练 hang(任务不退出、不报错、不前进)](rb-01-training-hang.md)
- [Runbook 02:集合通信超时(NCCL/HCCL timeout)](rb-02-nccl-hccl-timeout.md)
- [Runbook 03:GPU XID/ECC 硬件错误](rb-03-gpu-xid-ecc.md)
- [Runbook 04:慢节点(straggler,不报错的降速)](rb-04-straggler.md)
- [Runbook 05:Checkpoint 卡住/拖慢训练](rb-05-checkpoint-stall.md)
- [Runbook 06:训练 OOM 与显存碎片](rb-06-oom-fragmentation.md)

**推理与平台侧**

- [Runbook 07:推理排队爆炸](rb-07-inference-queue-explosion.md)
- [Runbook 08:KV Cache 抖动与驱逐风暴](rb-08-kv-cache-thrashing.md)
- [Runbook 09:网关上游供应商故障](rb-09-gateway-provider-outage.md)
- [Runbook 10:模型质量回归](rb-10-model-quality-regression.md)
- [Runbook 11:Agent 凭据泄漏事件响应](rb-11-agent-credential-leak.md)
- [Runbook 12:沙箱逃逸或策略失效事件响应](rb-12-sandbox-escape-response.md)
