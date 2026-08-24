"""集合通信估算(附录 B F15–F20;第 7 章)。"""
from .core import Result, Quantity, require_positive, require_fraction, GB


def collective_time(collective: str, payload_gb: float, ranks: int, bus_bw_gbps: float,
                    latency_us: float = 20.0, overlap_fraction: float = 0.0) -> Result:
    """按原语算每卡线上字节量(F15–F19),T = V/B_eff + 启动延迟(F20),重叠部分从关键路径扣除。"""
    require_positive(payload_gb=payload_gb, ranks=ranks, bus_bw_gbps=bus_bw_gbps)
    if ranks < 2:
        raise ValueError("ranks 至少为 2")
    if not (0 <= overlap_fraction < 1):
        raise ValueError("overlap_fraction 必须在 [0,1)")
    factors = {
        "allreduce": 2 * (ranks - 1) / ranks,
        "allgather": (ranks - 1) / ranks,
        "reducescatter": (ranks - 1) / ranks,
        "all2all": (ranks - 1) / ranks,
    }
    if collective not in factors:
        raise ValueError(f"collective 只能是 {sorted(factors)}")
    wire_bytes = payload_gb * GB * factors[collective]
    t_bw = wire_bytes / (bus_bw_gbps * GB)
    t_lat = latency_us * 1e-6 * (ranks - 1)
    total = t_bw + t_lat
    exposed = total * (1 - overlap_fraction)

    r = Result(name=f"{collective} 通信耗时估算")
    r.inputs = dict(collective=collective, payload_gb=payload_gb, ranks=ranks,
                    bus_bw_gbps=bus_bw_gbps, latency_us=latency_us, overlap_fraction=overlap_fraction)
    r.formulas = [f"F15–F19:{collective} 每卡线上量系数 = {factors[collective]:.3f}(Ring 算法)",
                  "F20:T_comm ≈ V ÷ B_eff + 启动延迟项(每步 × (n−1))"]
    r.outputs = {
        "每卡线上字节": Quantity(wire_bytes / GB, "GB"),
        "总耗时": Quantity(total * 1000, "ms"),
        "暴露在关键路径的耗时": Quantity(exposed * 1000, "ms"),
    }
    r.assumptions = ["Ring 实现;B_eff 用域内或跨域的实测有效带宽,不是标称(第 7 章两套带宽参数)",
                     "小消息(延迟项占优)时应改用 Tree/延迟优化算法,本式偏保守"]
    r.sensitivities = ["跨域时 B_eff 掉一个数量级——ranks 是否跨域边界是第一敏感项(第 7 章)"]
    r.uncertainty = "±30%:拥塞、拓扑不对称与 NCCL 协议切换都不在此式内。"
    r.replace_with_measurement = "用 nccl-tests/hccl 等基准测出目标规模的 busbw 回填 bus_bw_gbps。"
    return r
