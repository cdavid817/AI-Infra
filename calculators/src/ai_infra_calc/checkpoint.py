"""Checkpoint 写入窗口(第 14 章;间隔优化用 Young–Daly 近似)。"""
import math
from .core import Result, Quantity, require_positive, GB


def checkpoint_window(n_params_b: float, client_bw_gbps: float, storage_bw_gbps: float,
                      mtbf_hours: float, stall_budget: float = 0.01,
                      async_upload: bool = True) -> Result:
    """S_ckpt = 16N Byte(完整训练态);T_write = S ÷ min(客户端聚合带宽, 存储带宽);
    最优间隔 ≈ sqrt(2·δ·MTBF)(Young 近似,δ 为训练停顿时长)。"""
    require_positive(n_params_b=n_params_b, client_bw_gbps=client_bw_gbps,
                     storage_bw_gbps=storage_bw_gbps, mtbf_hours=mtbf_hours)
    if not (0 < stall_budget < 0.2):
        raise ValueError("stall_budget 必须在 (0, 0.2)")

    s_ckpt = 16 * n_params_b * 1e9
    bw = min(client_bw_gbps, storage_bw_gbps) * GB
    t_write = s_ckpt / bw
    stall = t_write * (0.15 if async_upload else 1.0)  # 异步:仅本地快照段停顿(第 14 章)
    interval_budget = stall / stall_budget
    interval_young = math.sqrt(2 * stall * mtbf_hours * 3600)
    interval = min(interval_budget, interval_young) if interval_young > 0 else interval_budget

    r = Result(name="Checkpoint 写入窗口与间隔估算")
    r.inputs = dict(n_params_b=n_params_b, client_bw_gbps=client_bw_gbps,
                    storage_bw_gbps=storage_bw_gbps, mtbf_hours=mtbf_hours,
                    stall_budget=stall_budget, async_upload=async_upload)
    r.formulas = [
        "第 14 章:S_ckpt ≈ 参数量 × 16 B(权重+梯度+优化器完整训练态)",
        "第 14 章:T_write = S_ckpt ÷ min(B_client, B_storage)",
        "第 14/20 章:最优间隔 ≈ √(2·δ·MTBF)(Young 近似);同时受停顿预算 δ/间隔 ≤ stall_budget 约束",
    ]
    r.outputs = {
        "单次快照大小": Quantity(s_ckpt / GB, "GB"),
        "全量写入时长": Quantity(t_write, "s"),
        "训练停顿时长/次": Quantity(stall, "s"),
        "建议保存间隔": Quantity(interval / 60, "min"),
    }
    r.assumptions = ["16N 为稠密 + Adam 全量态;ZeRO 分片保存时各卡写自己的分片,聚合带宽随卡数上升",
                     "异步模式停顿按写入时长 15% 近似(本地快照 + 后台上传,第 14 章)"]
    r.sensitivities = ["min(两带宽) 是唯一瓶颈项——存储侧突发写常是隐藏短板(第 14 章事故场景)",
                       "MTBF 随集群规模线性变差,间隔应随之缩短(第 20 章)"]
    r.uncertainty = "±30%:元数据开销、小文件形态与并发 writer 干扰未细化。"
    r.replace_with_measurement = "实测一次全量 checkpoint 的墙钟与训练停顿,回填 stall 后重算间隔。"
    return r
