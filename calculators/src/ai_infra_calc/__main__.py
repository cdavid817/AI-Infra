"""CLI:python -m ai_infra_calc <子命令> [参数];--json 输出机器可读结果。"""
import argparse
import sys
from . import memory, kv, training, comm, checkpoint, inference, tco

COMMANDS = {
    "memory": (memory.training_memory, "每卡训练显存(F4/F5/F7 + ZeRO)"),
    "kv": (kv.kv_capacity, "KV Cache 容量与并发(F8/F9)"),
    "training": (training.training_time, "训练算力与工期(F1/F2)"),
    "comm": (comm.collective_time, "集合通信耗时(F15–F20)"),
    "checkpoint": (checkpoint.checkpoint_window, "Checkpoint 写入窗口与间隔(第 14 章)"),
    "inference": (inference.inference_capacity, "推理容量实例数(第 31 章推导链)"),
    "tco": (tco.power_tco, "功率与年化 TCO(第 31 章)"),
}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="ai_infra_calc",
                                     description="《AI Infra》配套估算器——输出含公式出处、假设与不确定性,不给无法核验的默认性能值")
    parser.add_argument("--json", action="store_true", help="以 JSON 输出")
    sub = parser.add_subparsers(dest="command", required=True)
    for name, (fn, help_text) in COMMANDS.items():
        p = sub.add_parser(name, help=help_text)
        ann = fn.__annotations__
        defaults = fn.__defaults__ or ()
        params = [a for a in ann if a != "return"]
        required_count = len(params) - len(defaults)
        for i, pname in enumerate(params):
            typ = ann[pname]
            kwargs = {}
            if typ is bool:
                kwargs = {"type": lambda s: s.lower() in ("1", "true", "yes"), "metavar": "BOOL"}
            elif typ is int:
                kwargs = {"type": int}
            elif typ is str:
                kwargs = {"type": str}
            else:
                kwargs = {"type": float}
            if i >= required_count:
                kwargs["default"] = defaults[i - required_count]
                kwargs["help"] = f"默认 {kwargs['default']}"
            else:
                kwargs["required"] = True
            p.add_argument(f"--{pname.replace('_', '-')}", dest=pname, **kwargs)
    return parser


def main(argv=None) -> int:
    args = vars(build_parser().parse_args(argv))
    as_json = args.pop("json")
    fn = COMMANDS[args.pop("command")][0]
    try:
        result = fn(**{k: v for k, v in args.items() if v is not None})
    except ValueError as e:
        print(f"输入错误:{e}", file=sys.stderr)
        return 2
    print(result.to_json() if as_json else result.render())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
