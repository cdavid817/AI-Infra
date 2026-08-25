"""固定测试向量:基准值来自书中算例(第 6/14/16/17/21/31 章),计算器与正文不得静默漂移。"""
import json
import subprocess
import sys
import pytest
sys.path.insert(0, "calculators/src")
from ai_infra_calc import memory, kv, training, comm, checkpoint, inference, tco  # noqa: E402


# ---- 正常向量(对齐书中算例) ----

def test_training_70b_matches_chapter6():
    # 第 6 章算例:70B、15T token → C=6.3e24;1024 卡 × 1 PFLOPS × MFU40% ≈ 178 天(理想)
    r = training.training_time(70, 15, 1024, 1000, mfu=0.4, availability=1.0, checkpoint_overhead=0.0)
    assert r.outputs["总算力需求"].value == pytest.approx(6.3e24, rel=1e-3)
    assert r.outputs["理想计算时长"].value == pytest.approx(178, rel=0.01)

def test_memory_states_16n():
    # F4:70B 无切分模型状态 = 1120 GB ≈ 1043 GiB
    r = memory.training_memory(70, 80, 1, 4096, 8192, 64, recompute="full")
    assert r.outputs["模型状态/卡"].value == pytest.approx(70e9 * 16 / 1024**3, rel=1e-6)

def test_memory_zero3_divides_by_dp():
    r0 = memory.training_memory(7, 32, 1, 4096, 4096, 32, dp=8, zero_stage=0, recompute="full")
    r3 = memory.training_memory(7, 32, 1, 4096, 4096, 32, dp=8, zero_stage=3, recompute="full")
    assert r3.outputs["模型状态/卡"].value == pytest.approx(r0.outputs["模型状态/卡"].value / 8, rel=1e-6)

def test_kv_per_token_matches_chapter6():
    # 第 6/22 章:L=80, a_kv=8, d_head=128, BF16 → 320 KiB/token
    r = kv.kv_capacity(80, 8, 128, "bf16", 60, 2250)
    assert r.outputs["每 token KV"].value == pytest.approx(320, rel=1e-6)

def test_kv_concurrency_chapter22_example():
    # 第 22 章算例:8B 级 128KB/token、60GB 池、驻留 2250 token/条、80% 水位 → ≈170 路
    r = kv.kv_capacity(32, 8, 128, "bf16", 60, 2250, usable_fraction=0.8)
    assert r.outputs["每 token KV"].value == pytest.approx(128, rel=1e-6)
    assert r.outputs["可支撑并发请求"].value == pytest.approx(170, rel=0.05)

def test_comm_allreduce_factor():
    # F15:AllReduce 每卡线上量 = 2(n-1)/n × payload
    r = comm.collective_time("allreduce", 10, 8, 100, latency_us=0, overlap_fraction=0)
    assert r.outputs["每卡线上字节"].value == pytest.approx(10 * 2 * 7 / 8, rel=1e-6)

def test_checkpoint_70b_size():
    # 第 14 章容量示例:S_ckpt = 70e9 × 16 B = 1120 GB；数据段下界为 S/min(B)
    r = checkpoint.checkpoint_window(70, 100, 50, 24)
    assert r.outputs["单次快照大小"].value == pytest.approx(1120, rel=1e-6)
    assert r.outputs["数据段物理下界"].value == pytest.approx(1120 / 50, rel=1e-6)
    assert r.outputs["训练停顿时长/次"].value == pytest.approx(1120 / 50, rel=1e-6)

def test_checkpoint_async_requires_measured_pause():
    with pytest.raises(ValueError):
        checkpoint.checkpoint_window(70, 100, 50, 24, async_upload=True)

def test_inference_instances():
    # 需求 1000 QPS × 300 token = 3e5 token/s;单实例 5000、水位 0.7 → ⌈85.7⌉+1 = 87
    r = inference.inference_capacity(1000, 2000, 300, 5000, waterline=0.7, redundancy_instances=1)
    assert r.outputs["所需实例数(含冗余)"].value == 87

def test_tco_power_chain():
    # 第 31 章口径:1000 卡 × 1000W × α1.4 = 1.4 MW IT;PUE 1.3 → 1.82 MW
    r = tco.power_tco(1000, 1000, host_overhead=1.4, pue=1.3, electricity_price_per_kwh=0.6)
    assert r.outputs["IT 功率"].value == pytest.approx(1400, rel=1e-6)
    assert r.outputs["设施功率(含 PUE)"].value == pytest.approx(1820, rel=1e-6)

def test_tco_carbon_optional():
    r = tco.power_tco(100, 700, carbon_intensity_g_per_kwh=500)
    assert "年运行碳排(估算)" in r.outputs
    assert any("审计" in a for a in r.assumptions)

# ---- 边界与错误向量 ----

@pytest.mark.parametrize("bad", [
    lambda: training.training_time(-1, 15, 1024, 1000),
    lambda: training.training_time(70, 15, 1024, 1000, mfu=0),
    lambda: comm.collective_time("allreduce", 10, 1, 100),
    lambda: comm.collective_time("broadcast", 10, 8, 100),
    lambda: kv.kv_capacity(80, 8, 128, "bf16", 60, 2250, prefix_hit_rate=1.0),
    lambda: kv.kv_capacity(80, 8, 128, "fp64", 60, 2250),
    lambda: memory.training_memory(70, 80, 1, 4096, 8192, 64, zero_stage=4),
    lambda: checkpoint.checkpoint_window(70, 0, 50, 24),
    lambda: inference.inference_capacity(1000, 2000, 300, 5000, surge_factor=0.5),
    lambda: tco.power_tco(100, 700, host_overhead=0.9),
])
def test_invalid_inputs_raise(bad):
    with pytest.raises(ValueError):
        bad()

# ---- 输出契约:每个结果必须带公式/假设/不确定性/实测替换建议 ----

@pytest.mark.parametrize("result", [
    memory.training_memory(70, 80, 1, 4096, 8192, 64),
    kv.kv_capacity(80, 8, 128, "bf16", 60, 2250),
    training.training_time(70, 15, 1024, 1000),
    comm.collective_time("allreduce", 10, 8, 100),
    checkpoint.checkpoint_window(70, 100, 50, 24),
    inference.inference_capacity(1000, 2000, 300, 5000),
    tco.power_tco(1000, 1000),
])
def test_result_contract(result):
    assert result.formulas and result.assumptions and result.uncertainty and result.replace_with_measurement
    assert all(q.unit for q in result.outputs.values())
    json.loads(result.to_json())

# ---- CLI smoke ----

def test_cli_json_and_error():
    env_cmd = [sys.executable, "-m", "ai_infra_calc", "--json", "training",
               "--n-act-params-b", "70", "--tokens-t", "15", "--n-gpus", "1024", "--peak-tflops", "1000"]
    out = subprocess.run(env_cmd, capture_output=True, text=True,
                         env={"PYTHONPATH": "calculators/src", "PATH": "/usr/bin:/bin"})
    assert out.returncode == 0 and json.loads(out.stdout)["name"]
    bad = subprocess.run([sys.executable, "-m", "ai_infra_calc", "training",
                          "--n-act-params-b", "-1", "--tokens-t", "15", "--n-gpus", "8", "--peak-tflops", "989"],
                         capture_output=True, text=True,
                         env={"PYTHONPATH": "calculators/src", "PATH": "/usr/bin:/bin"})
    assert bad.returncode == 2 and "输入错误" in bad.stderr
