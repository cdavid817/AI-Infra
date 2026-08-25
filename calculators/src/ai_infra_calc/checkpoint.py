"""Checkpoint 数据段下界与同步保存间隔初筛（第 14 章）。"""
import math
from .core import Result, Quantity, require_positive, GB


def checkpoint_window(n_params_b: float, client_bw_gbps: float, storage_bw_gbps: float,
                      mtbf_hours: float, stall_budget: float = 0.01,
                      async_upload: bool = False, bytes_per_param: float = 16.0,
                      async_pause_seconds: float = 0.0) -> Result:
    """用声明的每参数字节估算状态量，以 S/min(B) 给出数据段下界。

    同步模式用 Young 一阶近似与停顿预算初筛间隔；异步模式必须传入实测 pause。
    """
    require_positive(n_params_b=n_params_b, client_bw_gbps=client_bw_gbps,
                     storage_bw_gbps=storage_bw_gbps, mtbf_hours=mtbf_hours)
    if not (0 < stall_budget < 0.2):
        raise ValueError("stall_budget 必须在 (0, 0.2)")
    require_positive(bytes_per_param=bytes_per_param)
    if async_upload and async_pause_seconds <= 0:
        raise ValueError("异步模式必须提供实测 async_pause_seconds")
    if async_pause_seconds < 0:
        raise ValueError("async_pause_seconds 不能为负")

    s_ckpt = bytes_per_param * n_params_b * 1e9
    bw = min(client_bw_gbps, storage_bw_gbps) * GB
    t_write = s_ckpt / bw
    stall = async_pause_seconds if async_upload else t_write
    interval_budget = stall / stall_budget
    interval_young = math.sqrt(2 * stall * mtbf_hours * 3600) if not async_upload else None
    interval = max(interval_budget, interval_young) if interval_young is not None else interval_budget

    r = Result(name="Checkpoint 写入窗口与间隔估算")
    r.inputs = dict(n_params_b=n_params_b, client_bw_gbps=client_bw_gbps,
                    storage_bw_gbps=storage_bw_gbps, mtbf_hours=mtbf_hours,
                    stall_budget=stall_budget, async_upload=async_upload,
                    bytes_per_param=bytes_per_param, async_pause_seconds=async_pause_seconds)
    r.formulas = [
        "第 14 章:S_ckpt,estimate = 参数量 × 声明的每参数字节数",
        "第 14 章:T_data,lower = S_ckpt ÷ min(B_client, B_storage)",
        "同步模式:W_Young ≈ √(2·C·MTBF);初筛间隔同时不得短于 C/stall_budget",
    ]
    r.outputs = {
        "单次快照大小": Quantity(s_ckpt / GB, "GB"),
        "数据段物理下界": Quantity(t_write, "s"),
        "训练停顿时长/次": Quantity(stall, "s"),
        "初筛保存间隔": Quantity(interval / 60, "min"),
    }
    r.assumptions = ["默认 16 B/param 仅对应声明的 BF16+Adam 状态组成;实际 state dict、格式与冗余另测",
                     "S/min(B) 只给数据段下界,不含排队、元数据、最慢 writer、commit 与 verify",
                     "Young 初筛只用于同步、周期、近似 Poisson/fail-stop 故障;异步模式只按实测 pause 给停顿预算下界"]
    r.sensitivities = ["客户端与存储带宽改变数据段下界,端到端关键路径可能由其他阶段主导",
                       "故障相关性、检测/恢复时间与 RPO 会改变保存间隔"]
    r.uncertainty = "端到端误差不设固定比例:未建模阶段可能主导结果,必须用目标框架实测替换。"
    r.replace_with_measurement = "实测序列化字节、各 rank 分布、pause/durable 时间、commit 与 restore,再做间隔决策。"
    return r
