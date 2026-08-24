# 估算器使用示例

前置:`PYTHONPATH=calculators/src`(或 `pip install -e .`);Python ≥ 3.10,无第三方运行依赖。

```bash
# 第 6 章算例:70B、15T token、1024 卡(1 PFLOPS/卡)、MFU 40%
PYTHONPATH=calculators/src python3 -m ai_infra_calc training \
  --n-act-params-b 70 --tokens-t 15 --n-gpus 1024 --peak-tflops 1000

# KV 并发:第 22 章 8B 级示例(--json 机器可读)
PYTHONPATH=calculators/src python3 -m ai_infra_calc --json kv \
  --layers 32 --kv-heads 8 --head-dim 128 --kv-precision bf16 \
  --kv-pool-gib 60 --avg-context-tokens 2250

# 年化 TCO(电价、人月成本均需自填,不提供"典型值"背书)
PYTHONPATH=calculators/src python3 -m ai_infra_calc tco \
  --n-gpus 1000 --gpu-tdp-w 1000 --capex-per-gpu 200000 \
  --electricity-price-per-kwh 0.6 --ecosystem-person-months 50
```

每个结果都包含:公式出处(附录 B F 编号/章节)、假设、安全余量、敏感参数、不确定性、以及**该用什么实测替换默认值**。推理容量计算器刻意不提供单实例吞吐默认值——必须传入目标 SLO 下的实测 goodput。
