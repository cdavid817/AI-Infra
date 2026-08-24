"""共享结果结构:估算器不输出裸浮点——每个数带单位,每个结果带公式、假设与不确定性。"""
from __future__ import annotations
from dataclasses import dataclass, field, asdict
import json


@dataclass(frozen=True)
class Quantity:
    value: float
    unit: str

    def __str__(self) -> str:
        v = self.value
        s = f"{v:,.4g}" if abs(v) < 1e6 else f"{v:,.3e}"
        return f"{s} {self.unit}"


@dataclass
class Result:
    name: str
    inputs: dict = field(default_factory=dict)
    formulas: list = field(default_factory=list)      # ["F4: M=16N(附录 B)", ...]
    outputs: dict = field(default_factory=dict)       # name -> Quantity
    assumptions: list = field(default_factory=list)
    safety_margins: list = field(default_factory=list)
    sensitivities: list = field(default_factory=list)  # 哪些输入小变化引起大偏差
    uncertainty: str = ""
    replace_with_measurement: str = ""                 # 建议用什么实测替换默认值

    def to_json(self) -> str:
        d = asdict(self)
        d["outputs"] = {k: {"value": q.value, "unit": q.unit} for k, q in self.outputs.items()}
        return json.dumps(d, ensure_ascii=False, indent=2)

    def render(self) -> str:
        lines = [f"# {self.name}", "", "## 输入"]
        lines += [f"- {k} = {v}" for k, v in self.inputs.items()]
        lines += ["", "## 公式(与附录 B / 正文对齐)"] + [f"- {f}" for f in self.formulas]
        lines += ["", "## 结果"] + [f"- {k}:{q}" for k, q in self.outputs.items()]
        if self.assumptions:
            lines += ["", "## 假设"] + [f"- {a}" for a in self.assumptions]
        if self.safety_margins:
            lines += ["", "## 安全余量"] + [f"- {m}" for m in self.safety_margins]
        if self.sensitivities:
            lines += ["", "## 敏感参数"] + [f"- {s}" for s in self.sensitivities]
        if self.uncertainty:
            lines += ["", f"## 不确定性\n{self.uncertainty}"]
        if self.replace_with_measurement:
            lines += ["", f"## 用实测替换\n{self.replace_with_measurement}"]
        return "\n".join(lines)


def require_positive(**kwargs) -> None:
    for name, v in kwargs.items():
        if v is None or v <= 0:
            raise ValueError(f"参数 {name} 必须为正数,实际为 {v!r}")


def require_fraction(**kwargs) -> None:
    for name, v in kwargs.items():
        if not (0 < v <= 1):
            raise ValueError(f"参数 {name} 必须在 (0, 1] 区间,实际为 {v!r}")


PRECISION_BYTES = {"fp32": 4, "tf32": 4, "bf16": 2, "fp16": 2, "fp8": 1, "int8": 1, "fp4": 0.5, "int4": 0.5}


def bytes_per_element(precision: str) -> float:
    p = precision.lower()
    if p not in PRECISION_BYTES:
        raise ValueError(f"未知精度 {precision},可选:{sorted(PRECISION_BYTES)}")
    return PRECISION_BYTES[p]

GIB = 1024 ** 3
GB = 1e9
