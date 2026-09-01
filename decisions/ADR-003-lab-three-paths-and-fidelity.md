# ADR-003:实验三路径与 F0–F5 保真度模型

- 状态:已采纳(2026-09)
- 规范:[governance/lab-fidelity-model.md](../governance/lab-fidelity-model.md)

## 背景

既有 Labs 用 L0–L3 描述环境门槛,但两个问题没有解决:一是没有任何环境(连 Docker 都没有)的读者被挡在全部实验之外;二是「模拟环境里跑通了」和「真实 GPU 上验证过」在结论效力上完全不同,需要显式区分,避免模拟结果被误读为性能证据。

## 决策

实验统一按「路径 × 保真度」建模:路径为 Replay(零环境)/ Local(普通电脑)/ Cloud(真实 GPU/集群),保真度为 F0–F5。每个实验的 `lab.yaml` 必须声明 `validates` 与 `does_not_validate`,数据性质合成时必须标 `synthetic`;未实际运行过的路径 `status: planned`,不得标为已验证。既有 L0–L3 标注保持不变,两套口径并存互补。

## 后果

- 所有读者至少可以完成 Replay 路径,零环境完成分析与诊断训练。
- 每条路径只对自己声明的验证范围负责;引入 Cloud 脚本前必须满足预算与销毁护栏(当前未引入)。
- 新增 Schema 与校验(`references/schemas/lab.schema.json`、`scripts/validate-labs.mjs`)带来少量维护成本。

## 备选方案

- 只保留 L0–L3 环境分层:说不清结论效力,放弃。
- 全部实验强制三路径齐备后再发布:成本过高,采用「试点先行、其余 planned」渐进落地。
