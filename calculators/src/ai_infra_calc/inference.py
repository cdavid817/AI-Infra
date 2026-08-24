"""推理容量(第 22/24/31 章)。刻意要求实测单实例吞吐作输入——不给"典型性能"默认值。"""
import math
from .core import Result, Quantity, require_positive, require_fraction


def inference_capacity(qps: float, avg_input_tokens: float, avg_output_tokens: float,
                       measured_instance_tokens_per_s: float, waterline: float = 0.7,
                       redundancy_instances: int = 1, cold_start_s: float = 0.0,
                       surge_factor: float = 1.0) -> Result:
    """decode 吞吐需求 = QPS × 输出长度;实例数 = 需求 ÷ (实测单实例吞吐 × 水位),加冗余;
    surge_factor 校验冷启动窗口内的突发承接能力(第 25 章)。"""
    require_positive(qps=qps, avg_input_tokens=avg_input_tokens, avg_output_tokens=avg_output_tokens,
                     measured_instance_tokens_per_s=measured_instance_tokens_per_s)
    require_fraction(waterline=waterline)
    if redundancy_instances < 0:
        raise ValueError("redundancy_instances 不能为负")
    if surge_factor < 1:
        raise ValueError("surge_factor ≥ 1")

    demand = qps * avg_output_tokens
    base = math.ceil(demand / (measured_instance_tokens_per_s * waterline))
    instances = base + redundancy_instances
    surge_ok = demand * surge_factor <= instances * measured_instance_tokens_per_s

    r = Result(name="推理容量(实例数)估算")
    r.inputs = dict(qps=qps, avg_input_tokens=avg_input_tokens, avg_output_tokens=avg_output_tokens,
                    measured_instance_tokens_per_s=measured_instance_tokens_per_s, waterline=waterline,
                    redundancy_instances=redundancy_instances, cold_start_s=cold_start_s,
                    surge_factor=surge_factor)
    r.formulas = ["第 31 章推导链:QPS × 输出长度 = decode token 吞吐需求",
                  "实例数 = ⌈需求 ÷ (单实例实测吞吐 × 容量水位)⌉ + 冗余(第 31 章 ρ 水位)",
                  "第 25 章:突发 × surge_factor 若超出现有实例上限,冷启动时长内将排队"]
    r.outputs = {
        "decode 吞吐需求": Quantity(demand, "token/s"),
        "所需实例数(含冗余)": Quantity(instances, "个"),
        "突发承接": Quantity(1.0 if surge_ok else 0.0, "1=可承接/0=冷启动窗口内将排队"),
    }
    r.assumptions = ["单实例吞吐必须是目标模型/精度/长度分布下的实测值(SLO 约束内的 goodput),本工具拒绝提供默认值",
                     "prefill 需求未单列——PD 分离部署时另按输入长度核 prefill 池(第 24 章)"]
    r.sensitivities = ["长度分布长尾使有效吞吐低于均值口径——waterline 就是为此留的", "surge_factor 与 cold_start_s 联合决定要不要预热池(第 25 章)"]
    r.uncertainty = "取决于输入的实测质量;若吞吐来自厂商宣传值,结果不可用于容量承诺。"
    r.replace_with_measurement = "用目标 SLO 下压测得到的 goodput(§29.1)作 measured_instance_tokens_per_s。"
    return r
