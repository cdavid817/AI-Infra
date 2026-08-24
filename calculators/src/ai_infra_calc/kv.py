"""KV Cache 容量估算(附录 B F8–F9;第 22 章)。"""
from .core import Result, Quantity, require_positive, require_fraction, bytes_per_element, GIB


def kv_capacity(layers: int, kv_heads: int, head_dim: int, kv_precision: str,
                kv_pool_gib: float, avg_context_tokens: float,
                prefix_hit_rate: float = 0.0, usable_fraction: float = 0.8) -> Result:
    """由 KV 池预算反推可容纳并发:F8 每 token 字节 → F9 最大并发 token → 除以人均上下文。"""
    require_positive(layers=layers, kv_heads=kv_heads, head_dim=head_dim,
                     kv_pool_gib=kv_pool_gib, avg_context_tokens=avg_context_tokens)
    require_fraction(usable_fraction=usable_fraction)
    if not (0 <= prefix_hit_rate < 1):
        raise ValueError("prefix_hit_rate 必须在 [0,1) 区间")
    p = bytes_per_element(kv_precision)

    per_token = 2 * layers * kv_heads * head_dim * p
    usable = kv_pool_gib * GIB * usable_fraction
    max_tokens = usable / per_token
    effective_ctx = avg_context_tokens * (1 - prefix_hit_rate)
    concurrency = max_tokens / effective_ctx

    r = Result(name="KV Cache 容量与并发估算")
    r.inputs = dict(layers=layers, kv_heads=kv_heads, head_dim=head_dim, kv_precision=kv_precision,
                    kv_pool_gib=kv_pool_gib, avg_context_tokens=avg_context_tokens,
                    prefix_hit_rate=prefix_hit_rate, usable_fraction=usable_fraction)
    r.formulas = [
        "F8:M_KV/token = 2·L·a_kv·d_head·p Byte",
        "F9:最大并发 token 数 = KV 显存预算 ÷ M_KV/token",
        "第 24 章:前缀命中率折减人均驻留上下文",
    ]
    r.outputs = {
        "每 token KV": Quantity(per_token / 1024, "KiB"),
        "池内可驻留 token": Quantity(max_tokens, "token"),
        "可支撑并发请求": Quantity(concurrency, "路"),
    }
    r.assumptions = ["PagedAttention 类分页管理;usable_fraction 已含块内碎片与水位预留",
                     "prefix_hit_rate 只折减驻留,不改变计算量"]
    r.safety_margins = [f"分页碎片与调度水位:可用系数 {usable_fraction:.0%}(第 22 章)"]
    r.sensitivities = ["avg_context_tokens 与并发成反比——长上下文业务一票决定容量", "kv_precision 每降一档并发翻倍(第 22 章 KV 量化)"]
    r.uncertainty = "±20%:真实长度分布的长尾使人均驻留高于均值口径。"
    r.replace_with_measurement = "上线后以引擎的 kv cache usage 指标与实际并发回填 usable_fraction 与命中率(§29.1)。"
    return r
