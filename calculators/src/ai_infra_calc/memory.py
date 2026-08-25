"""模型显存估算(附录 B F4–F7;第 6/17 章)。"""
from .core import Result, Quantity, require_positive, require_fraction, bytes_per_element, GIB


def training_memory(n_params_b: float, layers: int, batch_seqs: int, seq_len: int, hidden: int,
                    heads: int, dp: int = 1, tp: int = 1, pp: int = 1, zero_stage: int = 0,
                    recompute: str = "none", allocator_margin: float = 0.12) -> Result:
    """每卡训练显存:模型状态(16N,按 ZeRO/TP/PP 切分)+ 激活值(F5,按重计算档位)+ 工程预留(F7)。"""
    require_positive(n_params_b=n_params_b, layers=layers, batch_seqs=batch_seqs,
                     seq_len=seq_len, hidden=hidden, heads=heads, dp=dp, tp=tp, pp=pp)
    require_fraction(allocator_margin=allocator_margin)
    if zero_stage not in (0, 1, 2, 3):
        raise ValueError(f"zero_stage 只能是 0/1/2/3,实际 {zero_stage}")
    if recompute not in ("none", "selective", "full"):
        raise ValueError("recompute 只能是 none/selective/full")

    n = n_params_b * 1e9
    shard = tp * pp                      # 模型并行先切参数
    n_local = n / shard
    if zero_stage == 0:
        states = 16 * n_local
    elif zero_stage == 1:
        states = (4 + 12 / dp) * n_local
    elif zero_stage == 2:
        states = (2 + 14 / dp) * n_local
    else:
        states = 16 * n_local / dp

    act_factor = {"none": 34 + 5 * heads * seq_len / hidden, "selective": 11, "full": 2}[recompute]
    act_per_layer = seq_len * batch_seqs * hidden * act_factor
    acts = act_per_layer * layers / (pp * tp)   # 层随 PP 切,序列/隐藏维随 TP 切(近似)

    subtotal = states + acts
    total = subtotal * (1 + allocator_margin)

    r = Result(name="每卡训练显存估算")
    r.inputs = dict(n_params_b=n_params_b, layers=layers, batch_seqs=batch_seqs, seq_len=seq_len,
                    hidden=hidden, heads=heads, dp=dp, tp=tp, pp=pp, zero_stage=zero_stage,
                    recompute=recompute, allocator_margin=allocator_margin)
    r.formulas = [
        "F4:混合精度 + Adam 模型状态 = 16N Byte(权重 2 + 梯度 2 + 优化器 12)",
        "第 17 章:ZeRO 三档每卡状态 4N+12N/d、2N+14N/d、16N/d",
        "F5:每层激活 ≈ s·b·h·(34 + 5·a·s/h) Byte(无重计算);selective≈11·sbh、full≈2·sbh",
        "F7:工程预留——碎片与通信缓冲按 allocator_margin 加成",
    ]
    r.outputs = {
        "模型状态/卡": Quantity(states / GIB, "GiB"),
        "激活值/卡": Quantity(acts / GIB, "GiB"),
        "合计(含预留)/卡": Quantity(total / GIB, "GiB"),
    }
    r.assumptions = [
        "BF16 计算 + FP32 主权重的混合精度;优化器为 Adam 系(12 字节/参数)",
        "激活估算取 Transformer 稠密结构近似;MoE/GQA 需按第 6 章修正",
        f"重计算档位 {recompute};TP 对激活的切分按理想线性近似",
    ]
    r.safety_margins = [f"分配器碎片与通信缓冲 +{allocator_margin:.0%}(F7)"]
    r.sensitivities = ["seq_len 进入激活二次项(注意力),长序列时误差最大", "zero_stage 与 dp 的组合决定状态项一个数量级的差异"]
    r.uncertainty = "±15% 量级:激活系数依实现(FlashAttention 已内置部分重算)与框架缓冲策略而异。"
    r.replace_with_measurement = "用目标框架跑 3 个 step 读取峰值并抓 memory snapshot(§17.4.8 排查路径),替换本估算再定卡型。"
    return r
