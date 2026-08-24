"""《AI Infra》配套估算器。公式与书中附录 B 编号对齐;所有输出显式带单位与假设。"""
from .core import Result, Quantity
from . import memory, kv, training, comm, checkpoint, inference, tco

__all__ = ["Result", "Quantity", "memory", "kv", "training", "comm", "checkpoint", "inference", "tco"]
__version__ = "0.1.0"
