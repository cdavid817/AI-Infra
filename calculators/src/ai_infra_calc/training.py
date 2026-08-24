"""训练算力与时长(附录 B F1–F3、F10;第 6/20 章)。"""
from .core import Result, Quantity, require_positive, require_fraction


def training_time(n_act_params_b: float, tokens_t: float, n_gpus: int, peak_tflops: float,
                  mfu: float = 0.4, availability: float = 0.9,
                  checkpoint_overhead: float = 0.01) -> Result:
    """C = 6·N_act·D(F1);T = C/(n·P·MFU)(F2),再除以有效训练时间占比与 checkpoint 开销。"""
    require_positive(n_act_params_b=n_act_params_b, tokens_t=tokens_t, n_gpus=n_gpus, peak_tflops=peak_tflops)
    require_fraction(mfu=mfu, availability=availability)
    if not (0 <= checkpoint_overhead < 0.5):
        raise ValueError("checkpoint_overhead 必须在 [0, 0.5)")

    c = 6 * n_act_params_b * 1e9 * tokens_t * 1e12
    ideal_s = c / (n_gpus * peak_tflops * 1e12 * mfu)
    wall_s = ideal_s / (availability * (1 - checkpoint_overhead))

    r = Result(name="训练算力与工期估算")
    r.inputs = dict(n_act_params_b=n_act_params_b, tokens_t=tokens_t, n_gpus=n_gpus,
                    peak_tflops=peak_tflops, mfu=mfu, availability=availability,
                    checkpoint_overhead=checkpoint_overhead)
    r.formulas = ["F1:C = 6·N_act·D FLOPs", "F2:T = C ÷ (n_卡·P_峰值·MFU)",
                  "第 20 章:有效训练时间占比(availability)与 checkpoint 停顿另计"]
    r.outputs = {
        "总算力需求": Quantity(c, "FLOPs"),
        "理想计算时长": Quantity(ideal_s / 86400, "天"),
        "含故障与 checkpoint 的墙钟工期": Quantity(wall_s / 86400, "天"),
    }
    r.assumptions = ["6N 系数适用于稠密 Transformer;MoE 用激活参数 N_act(第 6 章)",
                     "注意力修正项 s>2h 时不可忽略,此处未计(F1 适用条件)"]
    r.sensitivities = ["MFU 与工期成反比,35%→45% 即省 22% 卡时(第 31 章)",
                       "availability 千卡以上随规模下降(第 20 章失败率模型)"]
    r.uncertainty = "工期 ±20%:MFU 与故障率都要实测,本结果只用于预算量级。"
    r.replace_with_measurement = "小规模先跑出实测 MFU(F11)与中断频率,再回填重算(§12.5 对标口径)。"
    return r
