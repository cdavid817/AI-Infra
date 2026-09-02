# 附录 J AReaL 详细教程:异步强化学习训练实践

> AReaL 的端到端实践教程:异步 RL 的算法与架构主线、安装与首个 GRPO 实验、配置系统、GPU 分配与共置、Agent Workflow 与奖励设计、Online RL、多节点调度与权重同步、Checkpoint 与评估、调试与 OOM 排查、生产治理。与正文的分工:RL 基础设施的机制与架构见第 21 章(异步谱系、colocate/disaggregated、环境层),本附录是绑定具体版本的操作层;训练技术栈全景见附录 H。
>
> 适用基线:AReaL v2.1.0 及附近版本,审校日期 2026-09-02。实际执行以本地检出版本的 `examples/`、`areal/api/cli_args.py` 与对应 Tag 文档为准;引用前先查[勘误与更新](../ERRATA.md)。

## 0. 本次审校结论

### 0.1 上一版已经覆盖的主干

上一版已经较完整地说明了以下内容：

- AReaL 的异步 Rollout 与训练解耦思想；
- Staleness、off-policy、Decoupled PPO 的基本原理；
- GRPO、PPO、DAPO 等算法概览；
- SGLang、vLLM、FSDP、Megatron 等后端；
- GSM8K 快速入门、核心 YAML 参数与 GPU 分配；
- 自定义数据集、奖励函数和 Agent Workflow；
- 多节点训练、OOM 排查与基础监控；
- AReaL 2.x 的训练、推理、Agent、权重更新服务化方向。

这些内容能够帮助读者“跑起来”，但不足以支撑 Agentic RL、在线 RL、训练恢复、生产治理和系统性性能诊断。

### 0.2 主要缺失内容

| 缺失主题 | 为什么重要 | 本文补充位置 |
|---|---|---|
| 版本锚定与架构成熟度 | `main`、Tag、旧 SPMD、Single-Controller、2.x 服务接口并非同一稳定层级 | 第 3、24 节 |
| Token 级轨迹协议 | Agentic RL 的训练对象不是普通文本，而是带 `loss_mask`、logprob、版本和父子关系的轨迹 | 第 12 节 |
| 奖励归因与多轮折扣 | 奖励必须绑定具体 Completion，且需要处理多轮回传、分支和重试孤儿 | 第 12、13 节 |
| Online RL 会话协议 | 外部 Agent 如何创建会话、调用模型、设置奖励、结束会话并进入训练 | 第 13 节 |
| Checkpoint 与恢复 | Hugging Face 导出和分布式全状态恢复是两个不同问题 | 第 18 节 |
| 独立评估 | 训练 Reward 不等于泛化能力，AReaL 也不是完整 Benchmark 套件 | 第 19 节 |
| 指标与性能剖析 | 仅观察 Reward 无法定位队列、Staleness、推理、通信或训练瓶颈 | 第 20、21 节 |
| LoRA、VLM、NPU、Tree Training | 这些能力具有明确的后端矩阵和限制，不能仅按“支持/不支持”二分 | 第 16 节 |
| 高级算法 | M2PO、DPO、蒸馏、近端 logprob 近似、IcePop/KPop 等未展开 | 第 14 节 |
| 安全与生产治理 | 在线代理、模型注册、沙箱执行、租户数据和奖励完整性均涉及安全边界 | 第 23 节 |
| v2.1.0 新变化 | 调度、共置、轨迹正确性、VLM/LoRA 和安全修复会直接影响部署方案 | 第 24 节 |

### 0.3 对上一版的关键修正

#### 修正 1：以本地 Tag 的字段定义为准

审校日的 `examples/math/gsm8k_grpo.yaml` 和 `areal/api/cli_args.py` 使用：

```yaml
actor:
  recompute_logprob: true
```

部分文档或旧示例可能出现 `recompute_logprobs`。复制配置时不要混用，应以当前检出版本的 Dataclass 字段和示例 YAML 为准。

#### 修正 2：README 与示例 YAML 的默认模型可能不同

审校日主分支的 GSM8K GRPO YAML 使用：

```yaml
actor:
  path: Qwen/Qwen2.5-1.5B-Instruct
```

某些 README 快速入门文字仍可能引用 `Qwen/Qwen2-1.5B-Instruct`。这不影响架构理解，但会影响可复现性。实验报告必须记录 **Tag、Commit、YAML 哈希、模型 Revision 和数据集 Revision**。

#### 修正 3：`p1` 不代表 SGLang 已支持多级流水线

例如：

```yaml
rollout:
  backend: "sglang:d4p1t1"
```

`p1` 只是将流水线维度显式设为 1。官方支持矩阵中，SGLang 推理侧仍未声明支持 Pipeline Parallel 大于 1。不能由配置字符串可解析，推断某种并行组合一定可运行。

#### 修正 4：2.x 服务化接口需要单独看待

AReaL 的成熟训练主链路仍以 **Single-Controller + 训练脚本 + YAML** 为核心。2.x 的统一 CLI、Inference Service、Agent Service 和 Online RL Proxy 已可用于特定场景，但部分接口仍标注为实验性，并且调度器、后端和端到端验证范围存在限制。

#### 修正 5：AReaL 的评估能力有明确边界

AReaL 提供分布式推理、Workflow 复用和评估调度能力，但它不是一个内置所有基准、裁判和报告模板的完整评测平台。生产使用时仍需对接独立 Benchmark、离线回放、LLM Judge、规则判定和安全评估系统。

---

## 1. AReaL 的定位与边界

AReaL 全称为 **A Large-Scale Asynchronous Reinforcement Learning System**。它是一套面向语言模型推理、数学、代码、工具调用和智能体任务的分布式强化学习基础设施。

一句话概括：

> AReaL 将持续生成的模型或 Agent 轨迹转换为带奖励、Token 概率、版本证据和训练掩码的样本，并异步更新策略模型，再将新权重同步回推理侧。

### 1.1 AReaL 主要负责什么

```text
数据或外部任务
  ↓
Rollout / Agent 执行
  ↓
Token 级轨迹采集
  ↓
规则、模型、环境或人工奖励
  ↓
PPO / GRPO / DAPO / 其他优化
  ↓
权重同步
  ↓
下一轮推理或 Agent 执行
```

它主要解决：

1. **训练与生成解耦**：避免同步大批次中的长尾等待；
2. **异步样本治理**：控制 Staleness，并修正行为策略与当前策略的差异；
3. **大规模资源编排**：统一训练、推理、奖励和权重更新资源；
4. **Agentic RL 数据采集**：记录多轮、工具调用、分支和 Token 级概率；
5. **多训练后端适配**：支持 FSDP、Megatron、Archon 等路线；
6. **推理后端适配**：支持 SGLang、vLLM；
7. **工程闭环**：保存、恢复、评估、指标和性能追踪。

### 1.2 AReaL 不直接替代什么

AReaL 通常不直接替代：

- 业务 Agent 平台；
- 工具权限系统；
- 代码沙箱或浏览器沙箱；
- 数据脱敏和租户治理平台；
- 完整的 Benchmark 与质量门户；
- 模型发布、灰度、回滚和流量治理系统；
- 人工标注平台；
- Prompt、Skill、Memory 的产品层管理系统。

更准确的定位是：

```text
Agent / 业务环境 / 数据平台
           ↓
        AReaL
           ↓
训练集群 / 推理集群 / 模型仓库
```

---

## 2. 为什么需要异步大模型强化学习

### 2.1 同步 RL 的长尾问题

同步训练通常按轮次执行：

```mermaid
flowchart LR
    A[生成一个完整批次] --> B[等待最长样本结束]
    B --> C[计算奖励]
    C --> D[训练更新]
    D --> E[同步权重]
    E --> A
```

同一批次中，不同回答长度可能相差几十倍。短序列早已完成，但所有生成资源仍需等待最长序列。训练 GPU 在生成期间空闲，推理 GPU 在训练期间也可能空闲。

### 2.2 AReaL 的异步流水线

```mermaid
flowchart LR
    D[数据或任务] --> R[Rollout / Agent Workers]
    R --> Q[轨迹队列]
    Q --> T[Trainer]
    T --> W[权重更新]
    W --> R
    R --> S[奖励服务]
    S --> Q
```

核心变化是：

- Rollout Worker 持续生产轨迹；
- Trainer 达到消费条件后即可训练；
- 奖励计算可以并行；
- 权重更新按版本进行；
- 样本不再要求全部来自完全相同的策略版本。

AReaL 最新论文修订报告，在对应实验配置中端到端训练最高可达到约 **2.77 倍加速**。这个数字是特定硬件、模型和任务下的实验结果，不应直接当作任意工作负载的固定收益。

### 2.3 异步不是“无限积压”

完全不限制异步度会造成：

- 数据严重过期；
- 重要性比率极端；
- Reward 对应旧行为而非当前策略；
- 训练分布漂移；
- 轨迹版本难以解释；
- 推理侧和训练侧吞吐失衡。

因此，AReaL 的关键不是“异步”本身，而是：

> **有版本证据、受 Staleness 约束、可拒绝异常数据的异步训练。**

---

## 3. AReaL 的两条架构主线

### 3.1 Single-Controller 训练主链路

这是理解和使用 AReaL 的首选入口：

```mermaid
flowchart TB
    C[Single Controller / PPOTrainer]
    C --> DC[Data Controller]
    C --> RC[Rollout Controller]
    C --> TC[Training Controller]
    C --> EV[Evaluator]
    C --> SV[Saver / Recover]

    RC --> RW[Rollout Workers]
    RW --> INF[SGLang / vLLM]
    DC --> BUF[轨迹缓冲区]
    BUF --> TC
    TC --> ACTOR[Actor Engine]
    TC --> REF[Reference Engine]
    TC --> CRITIC[可选 Critic]
    ACTOR --> WU[Weight Update]
    WU --> INF
```

特点：

- 一个 Python Driver 统一编排整个实验；
- YAML 描述资源和算法；
- 支持 Local、Ray、Slurm；
- 容易建立同步基线；
- 便于复现实验和统一生命周期；
- 目前是教程和大多数示例的核心路径。

### 3.2 AReaL 2.x 服务化主线

AReaL 2.x 将能力拆成更独立的服务：

```mermaid
flowchart LR
    APP[外部应用 / Agent] --> AG[Agent Service 或 Online Proxy]
    AG --> INF[Inference Service]
    INF --> DP[Data Proxy]
    DP --> TRAIN[Training Service]
    TRAIN --> WU[Weight Update Service]
    WU --> INF

    ENV[工具 / 沙箱 / 环境] <--> APP
    R[奖励 / 人工反馈] --> DP
```

服务化的价值包括：

- 外部 Agent 无需运行在训练进程内；
- 推理、Agent、训练可以独立扩缩容；
- 可接入 OpenAI 兼容客户端；
- 更适合持续在线收集轨迹；
- 为长期运行的自演进 Agent 系统提供基础。

但使用时必须注意：

- 部分 API 仍是实验性接口；
- 不同调度器的验证成熟度不同；
- 服务状态、版本、认证和数据生命周期更复杂；
- 不能把服务化等同于已经具备完整生产控制面。

### 3.3 数据面与控制面

#### 数据面

负责：

- Prompt 和消息；
- Token ID；
- Token log probability；
- `loss_mask`；
- 奖励；
- Completion 父子关系；
- 生成模型版本；
- 训练样本导出。

#### 控制面

负责：

- Worker 调度；
- 模型版本推进；
- Staleness 容量；
- 权重更新；
- 会话生命周期；
- Checkpoint 和恢复；
- 健康检查与故障处理。

工程上需要始终区分：

> 控制器声称的“当前版本”是控制面意图，Token 上记录的版本才是生成行为的数据面证据。

---

## 4. 异步 RL 的算法基础

### 4.1 Staleness

设：

- 样本生成时策略版本为 \(v_b\)；
- Trainer 当前策略版本为 \(v_c\)。

则：

\[
\text{staleness}=v_c-v_b
\]

AReaL 使用：

```yaml
rollout:
  max_head_offpolicyness: 2
```

限制允许的最大头部 off-policy 程度。

常见理解：

| 配置 | 含义 | 适用场景 |
|---:|---|---|
| `0` | 同步或近似严格 on-policy | 建立基线、排查算法问题 |
| `1~2` | 保守异步 | 初次开启异步 |
| `2~8` | 更高异步度 | 已验证稳定、需要提高吞吐 |
| 过大 | 数据积压和策略漂移风险显著 | 通常不建议直接使用 |

实际最优值取决于：

- Rollout 速度；
- 每次训练步耗时；
- 生成长度分布；
- 权重同步时延；
- 策略更新幅度；
- 重要性比率和拒绝率。

### 4.2 一个轨迹可能跨越多个服务版本

异步推理和权重更新可能使一条长轨迹中的不同 Completion，甚至不同输出片段，来自不同服务版本。因此不能只在“会话级”记录一个版本号。

训练数据至少应保留：

```text
input_ids
logprobs
loss_mask
versions
rewards
```

其中 `versions` 应能证明每个参与 Loss 的输出 Token 来自哪个服务版本。

### 4.3 三种策略角色

异步 PPO 中需要区分：

- \(\pi_{behav}\)：真正生成样本的行为策略；
- \(\pi_{prox}\)：近端约束使用的策略；
- \(\pi_\theta\)：当前训练中的策略。

标准 PPO 比率为：

\[
r_t(\theta)=\frac{\pi_\theta(a_t|s_t)}{\pi_{old}(a_t|s_t)}
\]

裁剪目标为：

\[
L_{PPO}=\mathbb{E}\left[
\min\left(
 r_t A_t,
 \operatorname{clip}(r_t,1-\epsilon,1+\epsilon)A_t
\right)
\right]
\]

AReaL 的 Decoupled PPO 思想是将：

1. “样本由谁生成”；
2. “当前更新围绕谁做近端约束”；

拆开处理。概念化表示为：

\[
L_{async}\approx
\mathbb{E}\left[
\frac{\pi_{prox}}{\pi_{behav}}
\min\left(
 r_t^{prox}A_t,
 \operatorname{clip}(r_t^{prox},1-\epsilon,1+\epsilon)A_t
\right)
\right]
\]

其中：

\[
r_t^{prox}=\frac{\pi_\theta(a_t|s_t)}{\pi_{prox}(a_t|s_t)}
\]

### 4.4 为什么要重新计算 logprob

```yaml
actor:
  recompute_logprob: true
  use_decoupled_loss: true
```

重新计算 logprob 的作用包括：

- 使用训练侧当前模型获得可比概率；
- 避免推理后端与训练后端数值实现差异被误当作策略变化；
- 支持近端比率和 off-policy 修正；
- 为极端 Ratio 过滤提供依据。

### 4.5 拒绝采样与异常比率

示例：

```yaml
actor:
  rejection_sampling:
    metric: ratio
    upper: 5.0
```

当：

\[
\frac{\pi_{current}}{\pi_{behavior}}
\]

出现极端值时，单个 Token 可能产生异常梯度。拒绝策略可以按 Token 或样本过滤异常区域。

需要同时监控：

- Ratio 分布；
- 被拒绝 Token 数；
- 被拒绝样本数；
- 拒绝前后有效 Token；
- 不同版本样本的拒绝率；
- KL 与 Clip Fraction。

---

## 5. 安装与环境准备

### 5.1 建议的环境策略

优先级建议：

```text
固定 Tag 的官方 Docker 镜像
  > 固定 Tag 的 uv 环境
  > main 分支开发环境
```

生产实验不要直接跟随滚动 `main`，否则：

- 配置字段可能变化；
- 依赖锁文件可能更新；
- 推理后端版本可能变化；
- 权重同步协议可能变化；
- 同一 YAML 可能无法复现。

### 5.2 Docker 安装

以 v2.1.0 SGLang 镜像为例：

```bash
docker pull ghcr.io/areal-project/areal-runtime:v2.1.0-sglang
```

启动容器：

```bash
docker run -it \
  --name areal-node1 \
  --privileged \
  --gpus all \
  --network host \
  --shm-size 128g \
  -v /data/areal:/data/areal \
  ghcr.io/areal-project/areal-runtime:v2.1.0-sglang \
  /bin/bash
```

注意：

- `--shm-size` 应按实际内存和并发调整；
- 多节点使用相同镜像；
- 模型、日志和 Checkpoint 使用共享或可复制存储；
- 生产环境不应无条件使用 `--privileged`，应按设备、IPC、RDMA 和安全策略最小授权。

容器内安装源码：

```bash
git clone https://github.com/areal-project/AReaL /data/areal/AReaL
cd /data/areal/AReaL
git checkout v2.1.0
uv pip install -e . --no-deps
```

验证：

```bash
uv run python3 areal/tools/validate_installation.py
```

### 5.3 使用 uv 安装

```bash
git clone https://github.com/areal-project/AReaL
cd AReaL
git checkout v2.1.0

pip install uv
uv sync --extra cuda
source .venv/bin/activate
```

无 CUDA 环境只做代码检查或部分测试：

```bash
uv sync
```

使用 vLLM 依赖集时，按当前 Tag 提供的独立锁文件切换：

```bash
cp pyproject.vllm.toml pyproject.toml
cp uv.vllm.lock uv.lock
uv sync --extra cuda
```

不要将 SGLang 与 vLLM 对应的 PyTorch、FlashAttention、CUDA 扩展版本随意混装。

### 5.4 环境验收清单

```bash
nvidia-smi
python -c "import torch; print(torch.__version__, torch.version.cuda)"
python -c "import torch; print(torch.cuda.device_count())"
python -c "import areal; print(areal.__file__)"
```

多节点还应检查：

- CUDA 驱动一致；
- NCCL 版本一致；
- 主机名和 IP 可解析；
- 指定端口互通；
- RDMA/RoCE 配置一致；
- `/dev/shm` 足够；
- `cluster.fileroot` 对所有节点可见；
- NFS Name Resolve 目录可读写；
- 时间同步正常；
- 模型和 Tokenizer Revision 一致。

### 5.5 官方测试硬件不等于最低配置

官方文档列出的充分测试环境包括 8 张 H800、NVSwitch、大内存和多节点 RoCE。这说明其主要验证目标是大规模训练，并不表示所有示例至少需要相同硬件。

但资源缩减时必须同步调整：

- 模型大小；
- Rollout 并发；
- 最大上下文；
- Token Micro-batch；
- TP/CP；
- 梯度检查点；
- 权重更新方式。

---

## 6. 第一个 GSM8K GRPO 实验

### 6.1 推荐先固定版本

```bash
git checkout v2.1.0
git status
```

记录：

```bash
git rev-parse HEAD
sha256sum examples/math/gsm8k_grpo.yaml
```

### 6.2 默认 8 GPU 运行

```bash
python3 examples/math/gsm8k_rl.py \
  --config examples/math/gsm8k_grpo.yaml \
  scheduler.type=local \
  experiment_name=gsm8k-grpo \
  trial_name=baseline
```

审校日的示例配置使用：

```yaml
cluster:
  n_nodes: 1
  n_gpus_per_node: 8

rollout:
  backend: "sglang:d4p1t1"

actor:
  backend: "fsdp:d4p1t1"
  path: Qwen/Qwen2.5-1.5B-Instruct
```

资源逻辑：

```text
4 GPU：Rollout
4 GPU：Actor
Reference：默认与 Actor 共置
```

### 6.3 4 GPU 缩减示例

```bash
python3 examples/math/gsm8k_rl.py \
  --config examples/math/gsm8k_grpo.yaml \
  scheduler.type=local \
  cluster.n_nodes=1 \
  cluster.n_gpus_per_node=4 \
  rollout.backend=sglang:d2p1t1 \
  actor.backend=fsdp:d2p1t1 \
  rollout.max_concurrent_rollouts=64 \
  actor.mb_spec.max_tokens_per_mb=4096 \
  experiment_name=gsm8k-grpo \
  trial_name=four-gpu
```

这只是资源缩减模板，不保证任意 4 卡显存都能直接运行。若仍 OOM，应继续降低并发、上下文、生成长度或 Micro-batch Token 上限。

### 6.4 训练主流程

```mermaid
flowchart TD
    A[加载 GSM8K] --> B[构造消息与标准答案]
    B --> C[每题生成 n_samples 个回答]
    C --> D[解析最终答案]
    D --> E[计算正确性奖励]
    E --> F[组内 Reward 归一化]
    F --> G[计算 Advantage]
    G --> H[GRPO/PPO 更新 Actor]
    H --> I[权重同步到 Rollout]
    I --> C
```

### 6.5 首次运行的通过标准

不要只判断“进程没退出”，至少检查：

- 推理服务成功启动；
- Actor 和 Reference 加载成功；
- Dataset 数量符合预期；
- 能看到非空模型输出；
- Reward 不全为零；
- 有有效 Loss Token；
- 训练步能够完成；
- 权重更新成功；
- Checkpoint 或日志目录生成；
- 评估流程按配置触发；
- GPU 显存和利用率没有持续泄漏。

---

## 7. 配置系统逐项解析

下面使用审校日 GSM8K GRPO 配置的主要结构：

```yaml
experiment_name: gsm8k-grpo
trial_name: trial0
seed: 1
total_train_epochs: 10

tokenizer_path: ${actor.path}

cluster:
  n_nodes: 1
  n_gpus_per_node: 8
  fileroot: /tmp/areal/experiments
  name_resolve:
    type: nfs
    nfs_record_root: /tmp/areal/name_resolve

scheduler:
  type: null

rollout:
  backend: "sglang:d4p1t1"
  max_concurrent_rollouts: 256
  consumer_batch_size: ${train_dataset.batch_size}
  max_head_offpolicyness: 2
  dump_to_file: false
  agent:
    mode: inline
    export_style: individual
    turn_discount: 1.0

gconfig:
  n_samples: 4
  max_new_tokens: 1024
  max_tokens: 2048
  temperature: 1.0

actor:
  backend: "fsdp:d4p1t1"
  path: Qwen/Qwen2.5-1.5B-Instruct
  dtype: bfloat16
  gradient_checkpointing: true
  mb_spec:
    max_tokens_per_mb: 10240
    packing_algorithm: ffd
  optimizer:
    type: adam
    lr: 6.0e-6
    lr_scheduler_type: constant
    warmup_steps_proportion: 0.001
  eps_clip: 0.4
  kl_ctl: 0.0
  ppo_n_minibatches: 1
  recompute_logprob: true
  use_decoupled_loss: true
  weight_update_mode: xccl

ref:
  backend: ${actor.backend}
  path: ${actor.path}
  optimizer: null
  scheduling_strategy:
    type: colocation
    target: actor

train_dataset:
  path: openai/gsm8k
  type: rl
  batch_size: 256
  max_length: 1024

valid_dataset:
  path: openai/gsm8k
  type: rl
  batch_size: 256

saver:
  freq_epochs: 1

recover:
  mode: disabled
  freq_secs: 3600

evaluator:
  freq_epochs: 1

stats_logger:
  wandb:
    mode: disabled

perf_tracer:
  enabled: false
  session_tracer:
    enabled: false
```

### 7.1 实验身份

```yaml
experiment_name: gsm8k-grpo
trial_name: trial0
```

建议命名包含：

```text
任务-模型-算法-后端-关键变量
```

例如：

```text
gsm8k-qwen25-15b-grpo-fsdp-stale2
```

`trial_name` 用于区分随机种子、学习率、并发、异步度等实验分支。

### 7.2 `cluster`

```yaml
cluster:
  n_nodes: 1
  n_gpus_per_node: 8
  fileroot: /shared/areal
```

`fileroot` 不只是日志目录，还可能被以下模块使用：

- Saver；
- Recover；
- Evaluator；
- Stats Logger；
- Perf Tracer；
- 磁盘权重同步；
- 多节点发现和中间状态。

多节点场景必须确认它是共享路径，而不是每台机器各自的同名本地目录。

### 7.3 `rollout.max_concurrent_rollouts`

控制同时在途的生成请求数量。

调大：

- 可能提高推理吞吐；
- 增加 KV Cache 和排队压力；
- 增加奖励服务并发；
- 更容易触发 OOM；
- 可能扩大 Staleness。

调小：

- 显存和队列压力降低；
- 推理 GPU 可能不饱和；
- Trainer 可能等待数据。

### 7.4 `queue_size` 与 `consumer_batch_size`

- `queue_size` 控制缓存容量；
- `consumer_batch_size` 控制训练侧每次需要消费的样本规模；
- 队列过小会使 Rollout 被背压；
- 队列过大会提高过期数据积压风险。

### 7.5 `n_samples`

```yaml
gconfig:
  n_samples: 4
```

表示每道题采样多个回答。GRPO 依赖组内相对比较。例如：

```text
同一题奖励：[1, 0, 1, 0]
组内均值：0.5
相对方向：[正, 负, 正, 负]
```

组大小增加会提高探索和组统计稳定性，但 Rollout 成本近似线性增加。

### 7.6 长度相关参数

```yaml
gconfig:
  max_new_tokens: 1024
  max_tokens: 2048

train_dataset:
  max_length: 1024

sglang:
  context_length: 32768
```

应满足：

```text
Prompt 长度
+ 生成长度
+ 模板和工具消息开销
<= 推理上下文
```

训练侧还必须能容纳有效序列。工具 Agent 经常存在大量 JSON、工具结果和系统 Prompt，不能按纯数学题的长度预算直接套用。

### 7.7 Token Micro-batch

```yaml
actor:
  mb_spec:
    max_tokens_per_mb: 10240
    packing_algorithm: ffd
```

峰值训练显存通常更受 **每次 Forward 的 Token 数** 影响，而不是 Dataset 的逻辑样本数。

当前代码支持的 Packing 算法包括：

- `ffd`：First Fit Decreasing，速度和效果均衡；
- `kk`：Karmarkar-Karp，更关注跨 Rank 负载平衡，但分配开销稍高。

### 7.8 Reward 与 Advantage 归一化

```yaml
actor:
  reward_norm:
    mean_level: group
    std_level: group
    group_size: ${gconfig.n_samples}
  adv_norm:
    mean_level: batch
    std_level: batch
```

需要区分：

- Reward 归一化的统计范围；
- Advantage 归一化的统计范围；
- Group 的真实成员关系；
- 动态过滤后 Group 是否仍完整；
- 单成员 Group 的标准差处理。

v2.1.0 增强了分组奖励归一化控制和元数据驱动的 Group 处理。对于自定义采样器，不应只依赖“相邻 N 条样本属于一组”的隐含假设。

### 7.9 Reference Model

```yaml
ref:
  optimizer: null
  scheduling_strategy:
    type: colocation
    target: actor
```

Reference 通常用于：

- KL 约束；
- 参考 logprob；
- DPO 或蒸馏中的基准概率；
- 算法稳定性诊断。

与 Actor 共置可以节省独占 GPU，但会带来：

- 显存叠加；
- Forward 阶段竞争；
- 调度复杂度；
- Checkpoint 和权重驻留压力。

### 7.10 Warmup

当前版本既可能使用比例式 Warmup，也加入了固定步数能力。配置时只选一种明确策略，并把最终计算出的 Warmup Step 写入实验记录，避免数据量变化后比例式 Warmup 被悄然放大或缩小。

### 7.11 Hydra/OmegaConf 覆盖

命令行覆盖示例：

```bash
python3 examples/math/gsm8k_rl.py \
  --config examples/math/gsm8k_grpo.yaml \
  actor.optimizer.lr=3e-6 \
  rollout.max_head_offpolicyness=0
```

原则：

- 修改已有字段通常使用 `key=value`；
- 添加结构中不存在的新字段可能需要 `+key=value`；
- 是否需要 `+` 由当前配置 Schema 和加载逻辑决定；
- 启动日志中应输出合并后的最终配置；
- 不要只保存原始 YAML，而漏掉命令行覆盖项。

---

## 8. GPU 分配、并行策略与共置

### 8.1 Backend 字符串

格式：

```text
<backend>:<parallel-dimensions>
```

示例：

```text
fsdp:d8
sglang:d2t4
megatron:d2p2t4
archon:d4t2
```

维度含义：

| 字母 | 含义 |
|---|---|
| `d` | Data Parallel |
| `t` | Tensor Parallel |
| `p` | Pipeline Parallel |
| `c` | Context Parallel |
| `e` | Expert Parallel |

一般世界规模：

\[
WorldSize=DP\times TP\times PP\times CP
\]

Expert Parallel 经常是在现有 Mesh 中重新布置专家，是否额外扩大世界规模取决于后端实现，不能只用一个通式推断。

### 8.2 示例

```text
fsdp:d8
```

8 张 GPU 运行一个 FSDP Actor。

```text
sglang:d2t4
```

2 个推理副本，每个副本 4 路 TP，共 8 张 GPU。

```text
megatron:d2p2t4
```

理论基础 Mesh 为：

\[
2\times2\times4=16\text{ GPUs}
\]

### 8.3 不要只检查总 GPU 数

除了总数，还必须检查：

- 后端是否支持该并行维度；
- 模型层数是否能被 PP 合理切分；
- Attention Head 是否能被 TP 整除；
- MoE 专家数是否能被 EP 整除；
- CP 对序列长度和 Attention 实现的约束；
- 权重更新协议是否支持该拓扑；
- 共置目标是否重复计入资源；
- 推理副本数是否足以形成有效 Batch。

### 8.4 Per-engine 分配优先

Single-Controller 模式应优先使用：

```yaml
rollout:
  backend: sglang:d4
actor:
  backend: fsdp:d4
```

而不是依赖旧式顶层 `allocation_mode`。Per-engine 描述更清楚，也更适合 Trainer、Reference、Critic、Rollout 各自独立演进。

### 8.5 共置策略

常见共置：

- Actor 与 Reference 共置；
- Actor 与 Critic 共置；
- Actor 与 Rollout 共置；
- 多训练引擎按 Group 共置。

收益：

- 减少闲置资源；
- 避免为不同阶段长期独占 GPU；
- 适合训练和推理交替明显的工作负载。

代价：

- 峰值显存更难控制；
- 状态切换和权重驻留复杂；
- 进程隔离与通信更复杂；
- 故障影响范围扩大。

v2.1.0 加入或增强了 AWEX Actor-Rollout 共置和 Ray Grouped Colocation。生产使用前应建立单独的吞吐、显存和故障测试，不应只按“节省 GPU”决策。

---

## 9. 训练脚本的执行主链路

一个典型训练脚本可以抽象为：

```python
def main(argv):
    config = parse_and_merge_config(argv)

    tokenizer = load_tokenizer(config.tokenizer_path)

    train_dataset = build_dataset(
        config.train_dataset,
        tokenizer=tokenizer,
    )
    valid_dataset = build_dataset(
        config.valid_dataset,
        tokenizer=tokenizer,
    )

    with PPOTrainer(
        config,
        train_dataset=train_dataset,
        valid_dataset=valid_dataset,
    ) as trainer:
        trainer.train(
            workflow="my_project.workflow.MathAgent",
            workflow_kwargs={
                "temperature": config.gconfig.temperature,
                "max_tokens": config.gconfig.max_tokens,
            },
        )
```

### 9.1 为什么类名是 `PPOTrainer`，却能跑 GRPO

`PPOTrainer` 更接近统一 RL 训练编排器。具体算法行为由以下配置决定：

- Advantage 计算方式；
- 是否使用 Critic；
- Reward/Advantage 归一化；
- PPO Clip；
- Token 或序列级 Loss；
- 动态采样和过滤；
- Decoupled Loss；
- 算法专用字段。

因此，不能由 Trainer 类名直接判断最终运行的是标准 PPO。

### 9.2 生命周期

```mermaid
flowchart TD
    A[解析配置] --> B[初始化调度器]
    B --> C[启动训练引擎]
    C --> D[启动推理引擎]
    D --> E[初始化数据控制器]
    E --> F[提交 Rollout]
    F --> G[收集轨迹与奖励]
    G --> H[训练更新]
    H --> I[更新权重]
    I --> J{保存/评估触发?}
    J -->|是| K[保存与评估]
    J -->|否| F
    K --> F
```

### 9.3 失败语义

工程上应明确：

- 某个 Rollout 超时是否重试；
- 重试是否生成重复 Completion；
- 奖励失败返回零、跳过还是终止；
- Worker 失联后任务是否重新分配；
- 权重更新失败是否允许继续生成旧版本数据；
- Checkpoint 失败是否阻断训练；
- 不完整轨迹是否 Fail Closed。

v2.1.0 增加了对不完整采样证据的拒绝、推理 Worker 启动失败快速报错和重试孤儿清理等修复。这些不是边缘细节，而是训练数据正确性的组成部分。

---

## 10. 数据集与奖励设计

### 10.1 在线 RL 数据 Schema 由 Workflow 决定

AReaL 兼容 Hugging Face `datasets.Dataset`。对于 RLVR 或 Agentic RL，一条数据可以是：

```python
from datasets import Dataset

train_data = Dataset.from_list([
    {
        "id": "math-0001",
        "messages": [
            {
                "role": "user",
                "content": "计算 17 × 24，并将最终答案放入 \\boxed{}。",
            }
        ],
        "answer": "408",
        "category": "multiplication",
        "difficulty": "easy",
    }
])
```

常见字段：

| 字段 | 用途 |
|---|---|
| `id` / `task_id` | 追踪、去重和根因分析 |
| `messages` | 模型输入 |
| `answer` | 规则奖励或标准答案 |
| `category` | 分类评估 |
| `difficulty` | 分层采样和分析 |
| `tools` | 工具 Schema |
| `environment` | 环境初始化信息 |
| `metadata` | Group、来源、租户、版本等 |

### 10.2 SFT 数据不是同一种 Schema

SFT 训练通常需要更显式的：

```text
input_ids
attention_mask
loss_mask
```

或者由数据预处理函数将消息转换成这些张量。不要假设能被 Agent Workflow 读取的数据，自动就是可用于 SFT Engine 的训练批次。

### 10.3 奖励来源

AReaL 可以承载多类奖励：

| 类型 | 示例 | 优点 | 风险 |
|---|---|---|---|
| 规则奖励 | 数学答案、格式、SQL 结果 | 稳定、低成本 | 容易被规则漏洞利用 |
| 单元测试 | 代码编译、测试通过率 | 可验证 | 沙箱成本高，可能存在测试泄漏 |
| 模型奖励 | LLM Judge、Reward Model | 覆盖开放任务 | 偏差、漂移、成本和延迟 |
| 环境奖励 | 游戏、浏览器、工具任务成功 | 接近真实目标 | 环境非确定性和重置复杂 |
| 人工奖励 | 评分、选择、纠正 | 质量高 | 慢、贵、一致性有限 |
| 组合奖励 | 正确性 + 格式 + 成本 + 安全 | 可表达复杂目标 | 权重难调，易产生奖励投机 |

### 10.4 数学奖励示例

```python
def math_reward(model_output: str, expected: str) -> float:
    predicted = extract_boxed_answer(model_output)
    if predicted is None:
        return -0.2
    return 1.0 if predicted == expected else 0.0
```

组合奖励：

```python
def combined_reward(output: str, answer: str) -> float:
    correctness = check_answer(output, answer)
    format_score = check_boxed_format(output)
    excessive_length = max(0, token_count(output) - 2048)

    return (
        1.0 * correctness
        + 0.05 * format_score
        - 0.00002 * excessive_length
    )
```

### 10.5 代码任务奖励

```mermaid
flowchart LR
    A[模型生成代码] --> B[解析代码块]
    B --> C[隔离沙箱]
    C --> D[编译/静态检查]
    D --> E[运行测试]
    E --> F[收集退出码、通过率、资源消耗]
    F --> G[生成奖励]
```

示例：

```python
def code_reward(result) -> float:
    if result.timed_out:
        return -0.2
    if result.compile_error:
        return -0.1
    if result.total_tests == 0:
        return 0.0
    return result.passed_tests / result.total_tests
```

沙箱至少限制：

- CPU 时间；
- 内存；
- 磁盘；
- 文件系统作用域；
- 网络；
- 子进程；
- 系统调用；
- 输出大小；
- 环境变量；
- Secret；
- 容器和宿主设备访问。

### 10.6 异步奖励

奖励涉及网络、沙箱或模型 Judge 时，应避免阻塞主事件循环。典型做法：

- 使用异步 HTTP Client；
- 对同步判定器使用线程池或进程池；
- 为每类奖励设置独立超时；
- 缓存确定性判定结果；
- 记录奖励失败原因；
- 明确超时后是零奖励、拒绝样本还是重试。

### 10.7 奖励设计的单元测试

每个 Reward 至少测试：

1. 正确答案；
2. 错误答案；
3. 无法解析；
4. 超长输出；
5. 多个候选答案；
6. 注入或伪造格式；
7. 沙箱超时；
8. 奖励服务异常；
9. 重复请求；
10. 缺失标准答案。

### 10.8 奖励投机检查

上线前执行：

```text
高奖励样本人工审计
  ↓
寻找共同格式或漏洞
  ↓
对抗生成与模糊测试
  ↓
固定隐藏测试集验证
  ↓
奖励规则版本化
```

需要记录：

```text
reward_name
reward_version
reward_inputs_hash
raw_scores
combined_score
error_code
latency
```

---

## 11. Agent Workflow 设计

### 11.1 推荐接口

自定义 Agent 一般实现：

```python
class ArithmeticAgent:
    async def run(self, data, **runtime):
        ...
        return 1.0
```

也可以返回多项指标：

```python
return {
    "reward": 1.0,
    "correctness": 1.0,
    "format": 0.8,
}
```

实际返回结构应以当前版本 Workflow 约定为准。

### 11.2 OpenAI 兼容客户端示例

```python
from openai import AsyncOpenAI

class ArithmeticAgent:
    async def run(self, data, **runtime):
        client = AsyncOpenAI(
            base_url=runtime["base_url"],
            api_key=runtime["api_key"],
            http_client=runtime.get("http_client"),
            max_retries=0,
        )

        response = await client.chat.completions.create(
            model="default",
            messages=data["messages"],
            temperature=0.8,
        )

        output = response.choices[0].message.content or ""
        predicted = extract_answer(output)
        return float(predicted == str(data["answer"]))
```

`max_retries=0` 的意义不是永远禁止业务重试，而是避免 SDK 在不可见状态下自动重试，导致代理记录到无法归因的重复 Completion。需要重试时，应在 Agent 层显式实现，并保留 Attempt ID。

### 11.3 三种执行模式

| 模式 | 运行位置 | 适用场景 | 主要代价 |
|---|---|---|---|
| `inline` | Rollout Worker 进程内 | 异步 Agent、低开销 | 阻塞或崩溃会影响 Worker |
| `subproc` | 独立进程池 | 同步 SDK、依赖隔离、CPU 重任务 | IPC、序列化、进程管理 |
| `online` | AReaL 外部 | 人类反馈、外部 Agent Runtime、持续服务 | 会话、认证、背压和数据治理复杂 |

#### Inline

```yaml
rollout:
  agent:
    mode: inline
```

要求：

- `run` 是异步方法；
- 不在事件循环执行长时间同步阻塞；
- 复用注入的 HTTP Client；
- 正确清理资源。

#### Subprocess

```yaml
rollout:
  agent:
    mode: subproc
    subproc_max_workers: 4
```

适合：

- 第三方 Agent SDK 仅支持同步；
- 存在依赖冲突；
- 需要更强故障隔离；
- CPU 密集预处理。

注意 Agent 对象和参数需要可序列化。

#### Online

外部程序通过 HTTP 驱动会话，详见第 13 节。

### 11.4 Workflow 最佳实践

#### 不要在 `run` 中重复初始化重对象

错误：

```python
async def run(...):
    browser = launch_browser()
    reward_model = load_large_model()
```

推荐：

- 在构造阶段初始化；
- 使用连接池；
- 复用沙箱 Worker；
- 将昂贵 Reward 服务独立部署；
- 对只读资源做进程内缓存。

#### 为每个 Episode 建立稳定身份

至少记录：

```text
task_id
session_id
episode_id
attempt_id
completion_id
model_version
reward_version
```

#### 明确取消语义

当训练取消、样本过期或用户终止时：

- 取消推理请求；
- 终止工具和沙箱任务；
- 释放浏览器与文件句柄；
- 不导出半条轨迹；
- 记录取消原因；
- 不将取消误计为失败奖励。

### 11.5 低层 `RolloutWorkflow`

除了高层 Agent Workflow，AReaL 还保留更低层的 Rollout Workflow 抽象。它适合需要直接控制：

- Tokenization；
- 推理请求；
- Grouped Rollout；
- `input_ids`、logprob、`loss_mask`；
- 版本字段；
- 自定义轨迹导出。

新项目一般优先使用高层 Agent Workflow；只有在代理协议无法表达需求时，才下沉到低层接口。

---

## 12. Token 级轨迹、奖励归因与版本证据

这是上一版最重要的缺失部分。

### 12.1 普通聊天记录不等于 RL 轨迹

普通聊天日志可能只有：

```json
{
  "role": "assistant",
  "content": "答案是 42"
}
```

RL 训练至少还需要：

```json
{
  "input_ids": [1, 2, 3],
  "logprobs": [-0.1, -0.3, -0.2],
  "loss_mask": [0, 1, 1],
  "versions": [10, 10, 11],
  "rewards": [0.0, 0.0, 1.0],
  "completion_id": "cmp_xxx",
  "parent_completion_id": "cmp_parent"
}
```

具体字段名和嵌套结构以当前 Tag 的实现为准，但语义不能缺失。

### 12.2 Interaction Cache

Data Proxy 会在一个会话中保存多次 Completion 及其关系：

```mermaid
flowchart TD
    U1[用户消息] --> C1[Completion A]
    U1 --> C2[Completion B]
    C1 --> T1[工具结果]
    T1 --> C3[Completion C]
    C2 --> C4[Completion D]
```

这实际上是一棵交互树，而不是简单数组。树结构用于：

- 判断哪次生成被后续对话真正采用；
- 识别分支；
- 绑定中间奖励；
- 构造 `concat` 轨迹；
- 删除自动重试产生的孤儿 Completion；
- 传播回合奖励。

### 12.3 Completion ID 与奖励绑定

奖励可以绑定：

- 最后一次交互；
- 指定 `interaction_id` / Completion ID；
- 整个 Episode；
- 某个工具步骤；
- 多个分项指标。

不应只保存一个“Session 总奖励”，否则无法区分：

- 哪一步决策正确；
- 哪一步工具调用导致失败；
- 哪个分支被采用；
- 哪些 Token 应获得训练信号。

### 12.4 多轮奖励回传

设最后一轮获得奖励 \(r_T\)，回合折扣为 \(\gamma\)，可向前传播：

\[
R_t=r_t+\gamma R_{t+1}
\]

配置：

```yaml
rollout:
  agent:
    turn_discount: 1.0
```

- `1.0`：不随回合衰减；
- 小于 `1.0`：离最终结果更远的决策获得更小权重。

折扣不是越小越好。对于需要早期规划的长任务，过强衰减会使关键规划步骤几乎没有信号。

### 12.5 `individual` 与 `concat`

```yaml
rollout:
  agent:
    export_style: individual
```

#### `individual`

每次 Completion 独立导出。

优点：

- 样本简单；
- 易于按 Completion 训练；
- 容易过滤异常步骤。

限制：

- 跨轮长期依赖表达较弱；
- 需要额外元数据保留父子关系。

#### `concat`

将一条采用路径连接成长轨迹。

优点：

- 保留多轮上下文；
- 更适合端到端 Agent 行为优化。

限制：

- 序列更长；
- Tree 分支处理更复杂；
- 自动重试会产生轨迹分裂；
- 更容易触发上下文与训练 OOM。

### 12.6 `loss_mask`

`loss_mask` 决定哪些 Token 参与策略梯度。

典型原则：

```text
系统 Prompt：0
用户输入：0
工具返回：0
模型输出：1
不可训练的格式包装：视任务而定
```

Agentic RL 中尤其要防止：

- 将环境或标准答案 Token 误设为 1；
- 将别的模型生成内容当作当前 Actor 输出；
- Tool Result 中包含答案泄漏；
- 拼接轨迹时 Mask 错位。

### 12.7 Token 版本证据

异步系统中，参与 Loss 的每个 Token 应具有可解释的服务版本。训练和评估时建议校验：

```python
for token, mask, version in zip(input_ids, loss_mask, versions):
    if mask == 1:
        assert version is not None
```

严格版本评估还可要求：

```python
assert all(
    version == expected_policy_version
    for version, mask in zip(versions, loss_mask)
    if mask == 1
)
```

v2.1.0 修复了输出 Token 服务版本归因，并加强对不完整采样证据的拒绝。由此可见，版本字段不是普通观测信息，而是训练正确性证据。

### 12.8 Retry-Orphan Completion

当上游 SDK 超时后自动重试，代理可能记录：

1. 服务端已经生成、但客户端未收到的孤儿 Completion；
2. 客户端重试后真正采用的 Completion。

两者输入相同，但只有后者进入后续对话。孤儿若被导出，会：

- 污染折扣链；
- 形成错误分支；
- 重复计算训练样本；
- 破坏 `concat` 路径。

Online 模式可配置：

```yaml
rollout:
  agent:
    drop_retry_orphans: true
```

但更根本的措施是：

- Agent SDK 关闭隐式自动重试；
- 业务层显式记录 Attempt ID；
- Completion 采用关系可追踪；
- Export 前做树完整性校验。

---
## 13. Online RL：外部 Agent 驱动训练

Online RL 允许 Agent Runtime、人类评估器或其他 OpenAI 兼容客户端运行在 AReaL 外部。外部应用完成任务，AReaL 代理负责记录交互、Token 概率、版本与奖励，并将会话导出为训练轨迹。

> **状态说明**：官方文档明确将 Online RL API 标记为实验性接口。部署前必须在固定 Tag 上做端到端验证。

### 13.1 架构

```mermaid
flowchart TB
    APP[外部 Agent / 人类 / 脚本]
    APP -->|会话与模型请求| GW[Proxy Gateway]
    GW --> PW1[Proxy Worker 1]
    GW --> PW2[Proxy Worker 2]
    GW --> PWN[Proxy Worker N]

    PW1 --> I1[SGLang / vLLM]
    PW2 --> I2[SGLang / vLLM]
    PWN --> IN[SGLang / vLLM]

    PW1 --> CACHE[Interaction Cache]
    PW2 --> CACHE
    PWN --> CACHE
    CACHE --> BUF[Trajectory Buffer]
    BUF --> TRAIN[PPOTrainer]
    TRAIN --> WU[Weight Update]
    WU --> I1
    WU --> I2
    WU --> IN
```

Proxy Gateway 主要负责：

- 会话创建和刷新；
- 管理员密钥与会话密钥认证；
- Worker 路由；
- 容量控制与背压；
- 健康检查。

Proxy Worker 主要负责：

- 转发模型请求；
- 记录 Token ID 和 logprob；
- 保存交互树；
- 绑定奖励；
- 导出训练轨迹。

### 13.2 配置 Online 模式

```yaml
rollout:
  agent:
    mode: online
    admin_api_key: "replace-with-a-strong-secret"
    session_timeout_seconds: 3600
    turn_discount: 1.0
    export_style: individual
    drop_retry_orphans: true
```

生产环境必须修改默认管理员密钥，并通过 Secret Manager、容器 Secret 或受控环境变量注入，而不是提交到 Git。

### 13.3 启动官方示例

官方 Online Proxy 教程使用 OpenClaw 示例：

```bash
python3 examples/openclaw/train.py \
  --config examples/openclaw/config.yaml \
  experiment_name=my-exp \
  trial_name=trial-0 \
  rollout.backend=sglang:d1 \
  actor.backend=fsdp:d1 \
  actor.path=Qwen/Qwen3-0.6B \
  scheduler.type=local \
  rollout.agent.admin_api_key="$AREAL_ADMIN_KEY"
```

启动成功后，日志会给出 Proxy Gateway 地址。

### 13.4 创建会话

```bash
curl -X POST "http://GATEWAY/rl/start_session" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AREAL_ADMIN_KEY}" \
  -d '{"task_id":"demo-task-0"}'
```

响应形态：

```json
{
  "session_id": "demo-task-0",
  "api_key": "sk-sess-xxxxxxxxxxxx"
}
```

每个会话拥有独立会话密钥，使 Gateway 能将模型请求、奖励和轨迹归入正确 Episode。

### 13.5 调用模型

Chat Completions：

```bash
curl "http://GATEWAY/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-sess-xxxxxxxxxxxx" \
  -d '{
    "model":"default",
    "messages":[
      {"role":"user","content":"What is 12 * 15 + 3?"}
    ],
    "temperature":0.7
  }'
```

Python SDK：

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://GATEWAY",
    api_key="sk-sess-xxxxxxxxxxxx",
    max_retries=0,
)

response = client.chat.completions.create(
    model="default",
    messages=[
        {"role": "user", "content": "What is 12 * 15 + 3?"}
    ],
)
```

公开文档列出的模型调用端点包括：

- `POST /chat/completions`；
- `POST /responses`；
- `POST /v1/messages`。

不同客户端对 `base_url` 和路径拼接方式不同，接入前用最小请求验证最终 URL，避免 SDK 自动补 `/v1` 后形成重复路径。

### 13.6 设置奖励

给最后一次交互设置奖励：

```bash
curl "http://GATEWAY/rl/set_reward" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-sess-xxxxxxxxxxxx" \
  -d '{"reward":1.0}'
```

给指定中间交互设置奖励：

```bash
curl "http://GATEWAY/rl/set_reward" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-sess-xxxxxxxxxxxx" \
  -d '{
    "reward":0.5,
    "interaction_id":"completion-or-interaction-id"
  }'
```

### 13.7 结束会话

```bash
curl "http://GATEWAY/rl/end_session" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-sess-xxxxxxxxxxxx" \
  -d '{}'
```

结束后，轨迹进入导出和训练缓冲流程。训练侧收集到由 `train_dataset.batch_size` 等配置决定的足够样本后，执行训练步并更新权重。

### 13.8 会话刷新模式

对于需要固定 URL 和固定 API Key 的长期 Agent，可以在新 Episode 开始时刷新会话：

```text
旧会话结束并导出
  ↓
同一固定密钥绑定新会话
  ↓
Agent 无需重新配置
```

必须明确区分：

- **Session**：一段连接和身份生命周期；
- **Episode**：一个可独立评分的任务执行；
- **Conversation**：Episode 内的消息和工具交互；
- **Training Trajectory**：从交互中导出的训练样本。

不要让一个无限期 Session 对应一个无限长 Episode。

### 13.9 两级认证

| 认证 | 用途 |
|---|---|
| Admin API Key | 创建会话、管理类接口 |
| Session API Key | 模型调用、设置奖励、结束会话 |

管理面和数据面必须使用不同密钥，并满足：

- 定期轮换；
- 最小权限；
- 不写入日志；
- 不通过 Prompt 或工具结果暴露；
- 网络层限制来源；
- 对管理接口增加审计。

### 13.10 常见 HTTP 状态

| 状态码 | 含义 | 建议处理 |
|---:|---|---|
| `200` | 成功 | 正常处理 |
| `401` | 认证失败 | 检查密钥和作用域，不要无限重试 |
| `409` | 密钥已绑定或会话冲突 | 结束旧会话或按刷新协议处理 |
| `429` | 当前无容量 | 指数退避并增加抖动，保留原 Task ID |
| `502` | 后端 Worker 不可达 | 检查服务健康、路由和推理 Worker |

`429` 常常是异步训练的容量保护信号，不等同于普通 Web 限流。客户端重试时要避免产生新的 Episode 或重复奖励。

### 13.11 Online 模式的限制

审校日官方文档列出的关键限制包括：

- 仅适用于 Single-Controller 路径；
- 支持 Local、Slurm 和 Ray 调度，但 Ray 端到端成熟度需按当前版本验证；
- 工具 Schema 的完全一致性与推理后端和版本相关；
- Online API 仍可能变化；
- 外部 Agent 的工具副作用不会由 AReaL 自动回滚；
- 训练 Reward 不能替代固定验证集。

### 13.12 Online RL 的生产接入清单

```text
[ ] 每个 Episode 唯一 task_id
[ ] 关闭 SDK 隐式重试或记录 attempt_id
[ ] 对 429 使用有界退避
[ ] 所有 Reward 可追踪到 interaction_id
[ ] 会话必须显式结束或超时清理
[ ] 轨迹导出前校验 loss_mask、版本和父子关系
[ ] 管理密钥和会话密钥分离
[ ] Prompt、工具结果和奖励输入完成脱敏
[ ] 训练数据设置保留期和删除机制
[ ] 新权重通过离线评估后再进入生产流量
```

---

## 14. 算法全景与选型

AReaL 不只支持一种 RL 算法。算法选择应由任务的奖励形态、是否需要 Critic、数据是否在线、异步程度和序列长度决定。

### 14.1 主要算法

| 算法 | 核心特征 | 适用场景 | 主要注意点 |
|---|---|---|---|
| GRPO | 同题多回答的组内相对优势，无独立 Critic | 数学、代码、RLVR | Group 必须正确，奖励不能全相同 |
| PPO | Actor/Critic/GAE/Clip 体系完整 | 复杂长任务、稠密奖励 | 资源和调参成本高 |
| GSPO | 更偏序列级策略优化 | 长推理、序列目标 | 关注序列级 Ratio 与长度偏差 |
| DAPO | 动态采样、长度与优化修正 | 数学推理 | 动态过滤后 Group 完整性 |
| Dr.GRPO | 修正部分 GRPO 归一化偏差 | RLVR | 对照标准 GRPO 建立基线 |
| LitePPO | 简化 PPO 路径 | 快速实验 | 确认简化假设适合任务 |
| RLOO | Leave-One-Out 基线 | 无 Critic 策略梯度 | Group 大小时方差不同 |
| REINFORCE++ | REINFORCE 改进 | 简化策略梯度 | 更依赖方差控制 |
| SAPO | 特定策略优化目标 | 按论文场景验证 | 注意与其他 Clip/修正冲突 |
| IcePop | 处理极端 off-policy Token | 异步 RL | 需要监控过滤比例 |
| KPop | 关注 KL/异常 Token 过滤 | 策略偏移明显场景 | 阈值过严会损失有效数据 |
| M2PO | 用二阶矩信息稳定异步 off-policy | 高异步度、多步任务 | 配置和诊断更复杂 |
| DPO | 离线 chosen/rejected 偏好优化 | 偏好数据 | 不是在线 Rollout 算法 |
| SFT | 监督学习 | 冷启动、格式和工具示范 | 依赖高质量标注 |
| Distillation | 教师概率或响应监督 | 能力迁移、策略蒸馏 | 教师成本和分布覆盖 |
| Reward Modeling | 学习奖励模型 | 开放任务偏好 | 奖励模型偏差和攻击面 |

### 14.2 推荐选择顺序

```text
高质量 SFT 冷启动
  ↓
GRPO + 可验证奖励
  ↓
同步模式验证正确性
  ↓
开启保守异步
  ↓
按异常 Ratio 选择 IcePop/KPop/M2PO 等
  ↓
进入多轮 Agentic RL
```

### 14.3 GRPO 的组信号

同一道题生成 \(G\) 个回答，奖励为 \(r_1,...,r_G\)。简单组内标准化可写为：

\[
A_i=\frac{r_i-\mu_G}{\sigma_G+\epsilon}
\]

问题：

- 所有奖励相同，则组内信号消失；
- Group 大小 1 无法形成相对优势；
- 动态过滤可能破坏组；
- 不同题目难度差异会影响 Reward 分布；
- 单纯追求格式可能掩盖正确性。

### 14.4 PPO 与 Critic

PPO 通常需要：

- Actor；
- Critic；
- Reference；
- GAE；
- 多轮 Minibatch；
- Clip 和 KL；
- 更复杂的共置或资源分配。

适合奖励更稠密、任务更长、需要状态价值估计的场景。对于简单二元数学奖励，GRPO 往往更容易作为第一条基线。

### 14.5 DAPO 与动态采样

DAPO 类配置常包含：

- 动态 Batch；
- 过滤无信息 Group；
- 过长样本处理；
- Token 级策略优化；
- 更有针对性的 Clip。

动态采样必须记录：

```text
原始候选数
过滤原因
过滤后组大小
有效 Token
过长截断比例
每类难度保留率
```

否则 Reward 上升可能只是“过滤掉了困难样本”。

### 14.6 IcePop 与 KPop

两类方法都用于降低异常 Token 对异步更新的破坏，但诊断重点不同：

- 重要性 Ratio 极端；
- KL Token 极端；
- 某些版本或长度区间异常集中；
- 过滤后有效样本过少。

启用后必须同时报告：

```text
raw_reward
accepted_reward
rejected_token_ratio
accepted_token_count
version_distribution
```

### 14.7 M2PO

M2PO 通过额外的二阶矩或阈值机制，提高高 off-policy 场景的稳定性。它适合已经证明普通 Decoupled PPO 在较高异步度下不稳定的场景，而不适合作为第一条基线。

正确路径：

```text
同步 GRPO/PPO 稳定
  ↓
异步度 1~2 稳定
  ↓
确认瓶颈确实来自策略过期
  ↓
再引入 M2PO
```

### 14.8 On-policy Distillation 与 KDRL

蒸馏场景可以让 Student 在当前 Prompt 分布上采样，再用 Teacher 的 Token 分布提供训练信号。KDRL 等方案常使用反向 KL 或与策略奖励结合的目标。

需要关注：

- Teacher 与 Student Tokenizer 一致性；
- Teacher 调用成本；
- Teacher 覆盖不到的工具状态；
- 蒸馏信号与外部 Reward 冲突；
- 教师错误被固化。

### 14.9 DPO

DPO 使用离线偏好对：

```json
{
  "prompt": "...",
  "chosen": "better answer",
  "rejected": "worse answer"
}
```

它不需要在线 Rollout，但仍依赖 Reference 概率。适合先用人工或规则生成偏好数据，再进行离线对齐。

### 14.10 近端 logprob 近似

在异步更新中，完全重算近端概率可能增加计算成本。AReaL 提供近端 logprob 的近似策略，例如线性或 log-linear 方式。

使用前要比较：

- 近似与完整重算的误差；
- 训练吞吐收益；
- Ratio、KL 和 Reward 稳定性；
- 长序列与不同版本间误差；
- 是否改变最终收敛结果。

优化顺序应是：

```text
正确性
  > 稳定性
  > 可解释性
  > 吞吐优化
```

### 14.11 多轮 GAE

多轮 Agent 场景可采用固定或更灵活的 GAE Lambda 策略。关键是定义：

- “一步”是 Token、Completion、Turn 还是工具动作；
- 中间奖励如何进入 Return；
- 终止、超时、用户取消如何处理；
- 不同 Turn 长度是否导致权重失衡。

v2.1.0 增加了更灵活的 GAE Lambda 策略，使用前应先确定轨迹粒度和奖励语义。

---

## 15. 模型、训练后端与推理后端

### 15.1 审校日官方模型支持矩阵

| 模型家族 | Megatron | PyTorch FSDP | PyTorch Archon | 说明 |
|---|:---:|:---:|:---:|---|
| Qwen2/3 | ✅ | ✅ | ✅ | 主流文本模型 |
| Qwen3-MoE | ✅ | ✅ | ✅ | MoE |
| Qwen2.5-VL | ✅ | ✅ | ❌ | 视觉语言模型 |
| Qwen3-VL | ✅ | ✅ | ❌ | 视觉语言模型 |
| Gemma 3 | ❌ | ✅ | ❌ | 视觉语言模型 |
| 其他 Hugging Face LLM | ❌ | ✅ | ❌ | 取决于 Transformers 版本和模型实现 |

该矩阵会变化。引入新模型时至少验证：

- Config 映射；
- Tokenizer；
- Chat Template；
- Attention 实现；
- Rope 和位置编码；
- 权重命名；
- LM Head；
- TP/PP/EP 切分；
- 推理侧加载；
- 权重同步。

### 15.2 训练后端矩阵

| 后端 | DP | TP | SP | CP | PP | EP | Packing | LoRA |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Megatron | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 有条件支持 |
| PyTorch FSDP | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| PyTorch Archon | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

#### FSDP

适合：

- Hugging Face 模型快速接入；
- 中小规模实验；
- 需要 LoRA；
- 希望保持 PyTorch 原生开发体验。

限制：

- 官方矩阵未声明 PP、EP；
- 超大 MoE 的并行弹性不如 Megatron；
- 高级模型结构可能需要额外适配。

#### Megatron

适合：

- 大模型和 MoE；
- TP、PP、CP、EP 组合；
- 大规模训练；
- 需要更精细的并行布局。

代价：

- 模型转换和桥接复杂；
- Checkpoint 与权重同步更复杂；
- 对拓扑和确定性配置要求更高。

#### Archon

Archon 是 PyTorch 原生的多维并行训练后端，目标是兼顾原生开发体验与 DP/TP/PP/CP/EP。当前仍属于实验性能力，API 和模型覆盖可能变化。

使用时重点验证：

- 模型是否在支持列表；
- `torch.compile` 行为；
- Activation Checkpointing 模式；
- PP Schedule；
- Weight Tying 限制；
- Tree Training 是否支持；
- 首轮编译开销；
- 确定性模式。

### 15.3 推理后端矩阵

| 后端 | TP | CP | PP | Data Parallel Attention | EP |
|---|:---:|:---:|:---:|:---:|:---:|
| vLLM | ✅ | 未明确 | ✅ | 未明确 | 未明确 |
| SGLang | ✅ | ❌ | ❌ | ✅ | ✅ |

这里的“未明确”不等于一定不支持，而是 AReaL 官方矩阵没有给出稳定承诺。应以对应后端版本和 AReaL Adapter 的实际能力为准。

### 15.4 SGLang 还是 vLLM

#### 优先 SGLang 的情况

- 使用官方默认链路；
- 高并发 Rollout；
- 需要 Data Parallel Attention 或特定 Radix Cache 能力；
- 已按官方镜像验证。

#### 优先 vLLM 的情况

- 现有生产推理基于 vLLM；
- 需要其特定 PP、LoRA 或生态能力；
- 已有兼容镜像和运维经验。

不要只比较单请求延迟。RL Rollout 更关注：

```text
总输出 Token/s
长短序列混合吞吐
暂停/恢复生成
权重更新停顿
KV Cache 利用
失败恢复
Token 证据完整性
```

### 15.5 Megatron Bridge

AReaL 中可能出现两条桥接路线：

- `mbridge`；
- `megatron-bridge`。

总体建议：

- 新 GPU 工作流优先验证 `megatron-bridge`；
- LoRA 通常依赖 `megatron-bridge` 路线；
- 某些磁盘广播或 Tree Training 能力可能仍依赖旧桥接路径；
- 不要在同一实验中未经验证地切换桥类型；
- Checkpoint 不能假设跨桥实现无损互换。

---

## 16. LoRA、VLM、NPU、FP8 与 Tree Training

### 16.1 LoRA 支持不能只看 Actor

LoRA 能否工作取决于完整链路：

```text
训练后端产生 Adapter
  ↓
导出正确权重键
  ↓
权重更新协议传输
  ↓
推理后端加载 Adapter
  ↓
服务版本正确推进
```

审校日官方文档的保守理解：

| 训练后端 | 推理后端 | 状态 |
|---|---|---|
| FSDP | vLLM | 支持 |
| FSDP | SGLang | 支持，但需按当前示例确认权重更新方式 |
| Megatron | vLLM | 支持，通常需 `megatron-bridge` |
| Megatron | SGLang | 版本相关，按当前 Tag 示例验证 |
| Archon | 任意 | 官方矩阵未声明支持 |

### 16.2 LoRA 配置关注点

```yaml
actor:
  use_lora: true
  lora_rank: 64
  lora_alpha: 128
  lora_dropout: 0.0
```

字段名以当前 Tag 为准。还需设置：

- Target Modules；
- Adapter Dtype；
- 是否训练 Bias；
- 推理侧 Adapter 名称；
- PEFT 标准键名；
- 磁盘或 XCCL 权重更新；
- 合并导出策略。

v2.1.0 修复了 PEFT 标准 Adapter Key 导出和 Megatron LoRA 回归问题，说明 LoRA 的核心风险常在“训练能跑，但推理侧加载的并不是新 Adapter”。

### 16.3 VLM

AReaL 提供视觉语言模型示例，包括视觉推理和 NPU VLM 训练。

VLM 额外关注：

- 图片下载与缓存；
- 图片解码失败；
- 多模态 Processor Revision；
- 图像 Token 数；
- 文本与视觉 Padding；
- 混合纯文本和多模态 Micro-batch；
- 视觉 Encoder 是否训练；
- 图像数据隐私；
- 推理后端多模态请求格式；
- Reward 是否真正依赖视觉证据。

v2.1.0 包含文本-only VLM Micro-batch、Qwen3-VL、Qwen3.6 VLM LoRA 和相关共置路径更新。升级前应重新跑纯文本、单图、多图和空图输入测试。

### 16.4 NPU

AReaL 的 Ascend NPU 支持维护在专门分支，而非简单等同于主分支 CUDA 路径。使用时：

1. 检出官方指定 NPU 分支；
2. 使用对应 CANN、PyTorch NPU 和 vLLM Ascend 版本；
3. 使用官方 NPU 镜像或严格锁定依赖；
4. 按 NPU 示例验证 RLVR/VLM；
5. 不直接复用 CUDA 的 NCCL、FlashAttention 和权重同步假设。

截至审校日，发布说明提到文档已更新到 `ascend-v1.0.5` 路线。部署前应再次核对仓库当前 NPU 指南。

### 16.5 FP8

FP8 可以降低显存和提高吞吐，但会引入：

- 训练数值稳定性；
- 不同后端格式转换；
- 权重同步格式；
- LM Head 精度；
- 梯度缩放；
- Checkpoint 兼容性。

正确验证顺序：

```text
BF16 基线
  ↓
固定随机种子的小步 FP8 对照
  ↓
比较 Loss、KL、Reward、Grad Norm
  ↓
验证保存/恢复和推理同步
  ↓
扩大规模
```

### 16.6 Tree Training

多轮 Agent 往往存在共享前缀：

```text
系统 Prompt + 用户任务
  ├─ 回答 A
  │   └─ 工具结果 A → 后续回答
  ├─ 回答 B
  │   └─ 工具结果 B → 后续回答
  └─ 回答 C
```

普通训练会为每个分支重复计算共享前缀。Tree Training 将共享前缀组织成树，以减少重复 FLOPs。

```mermaid
flowchart TD
    P[共享 Prompt] --> A[分支 A]
    P --> B[分支 B]
    P --> C[分支 C]
    A --> A2[后续 A2]
    B --> B2[后续 B2]
```

官方文档在 Tau2 场景报告过显著 FLOPs 和速度收益，但收益取决于共享前缀比例和树结构，不能外推到普通单轮数据。

启用前检查：

- 后端是否支持；
- Attention 实现是否为 Tree 模式；
- `max_tokens_per_mb` 的块对齐；
- 并行维度带来的额外对齐约束；
- PP、CP、Critic 路径是否兼容；
- 数据确实包含高共享率分支。

建议监控：

```text
tree_token_ratio
unique_prefix_tokens
duplicated_prefix_tokens
packing_efficiency
forward_time
memory_peak
```

如果 `tree_token_ratio` 很低，Tree 结构管理成本可能大于收益。

---

## 17. 多节点调度与权重同步

### 17.1 调度器

| 调度器 | 场景 | 重点 |
|---|---|---|
| Local | 单机、开发、基线 | 最容易调试 |
| Ray | 动态集群和 Python 生态 | 集群发现、资源标签、服务稳定性 |
| Slurm | HPC 集群 | 分区、预留、环境、终止状态、共享目录 |

Single-Controller 是推荐主线。旧 SPMD Launcher 主要用于兼容历史作业，不应作为新项目默认入口。

### 17.2 Ray

示意：

```bash
ray start --head
## 其他节点
ray start --address HEAD_IP:6379
```

训练：

```bash
python3 examples/math/gsm8k_rl.py \
  --config examples/math/gsm8k_grpo.yaml \
  scheduler.type=ray \
  cluster.n_nodes=2 \
  cluster.n_gpus_per_node=8 \
  cluster.fileroot=/shared/areal \
  rollout.backend=sglang:d12 \
  actor.backend=fsdp:d4 \
  experiment_name=gsm8k-ray \
  trial_name=t1
```

v2.1.0 增加了 HTTP-based Ray Scheduler，并支持 Ray Grouped Colocation。迁移时要验证：

- 旧 Scheduler 配置是否兼容；
- Worker 地址发现；
- 网络 ACL；
- HTTP 控制面认证；
- Group 资源是否按预期共置；
- Worker 重启后缓存和路由是否清理。

### 17.3 Slurm

示意：

```bash
python3 examples/math/gsm8k_rl.py \
  --config examples/math/gsm8k_grpo.yaml \
  scheduler.type=slurm \
  cluster.n_nodes=16 \
  cluster.n_gpus_per_node=8 \
  cluster.fileroot=/shared/areal \
  rollout.backend=sglang:d96 \
  actor.backend=fsdp:d32 \
  experiment_name=gsm8k-slurm \
  trial_name=t1
```

还要配置或确认：

- Partition；
- Account；
- Reservation；
- Exclusive；
- 用户环境变量；
- 终止状态检测；
- 作业超时；
- NFS Name Resolve 路径。

v2.1.0 增强了 Slurm Reservation、Exclusive 和用户环境覆盖，并将所有终止状态视为 Worker 已死亡，降低控制器继续等待僵尸 Worker 的风险。

### 17.4 资源比例

论文中的某些大规模实验采用较多 GPU 负责 Rollout、较少 GPU 负责训练，但不存在统一的 3:1 固定比例。

调优方法：

1. 测量 Rollout 有效 Token/s；
2. 测量 Trainer 消费 Token/s；
3. 观察队列增长方向；
4. 观察 Trainer 等待数据时间；
5. 观察 Rollout 被背压时间；
6. 调整推理副本、TP 和训练 GPU；
7. 重新测量权重同步开销。

理想状态：

```text
轨迹生产速率 ≈ 训练消费速率
```

而不是让队列长期单向增长。

### 17.5 XCCL 权重更新

```yaml
actor:
  weight_update_mode: xccl
```

优点：

- 直接集合通信；
- 通常比磁盘加载快；
- 适合频繁更新。

代价：

- 额外通信组；
- 额外显存和缓存；
- 对网络和拓扑敏感；
- 共置时控制屏障复杂；
- LoRA 和某些后端组合可能有限制。

### 17.6 磁盘权重更新

```yaml
actor:
  weight_update_mode: disk
```

链路：

```text
Actor 导出权重
  ↓
共享存储
  ↓
Rollout Engine 加载
```

适合：

- XCCL 初始化或同步 OOM；
- 训练和推理服务无法加入同一通信组；
- LoRA Adapter 通过文件加载；
- 调试和跨系统传输。

代价：

- 存储吞吐和元数据压力；
- 更新更慢；
- 需要原子发布；
- 防止推理侧读取半写入文件；
- 多节点必须使用真正共享路径。

### 17.7 权重更新的一致性

生产实现应满足：

```text
新权重完整生成
  ↓
完整性校验
  ↓
注册新版本
  ↓
暂停或协调相关请求
  ↓
推理 Worker 加载
  ↓
健康检查
  ↓
版本切换
```

v2.1.0 增加了权重更新期间暂停 Proxy Worker 的修复，反映出“边更新、边生成”若没有屏障，可能产生版本证据不完整或混合权重请求。

---

## 18. Checkpoint、恢复与模型导出

### 18.1 Saver 与 Recover 是两个系统

| 能力 | Saver | Recover Handler |
|---|---|---|
| 目标 | 导出可部署/可评估模型 | 恢复中断训练 |
| 典型格式 | Hugging Face 权重 | DCP 或后端原生分布式状态 |
| 包含模型 | 是 | 是 |
| 包含优化器 | 通常不是完整训练恢复语义 | 是 |
| 包含 Scheduler | 不一定 | 是 |
| 包含 RNG | 通常不保证 | 是 |
| 包含数据进度 | 不保证 | 应恢复或单独保存 |
| 跨并行拓扑 | 相对更容易 | 通常要求兼容拓扑 |

不要用一个 Hugging Face 导出目录假装可以无损恢复整个 PPO/GRPO 训练状态。

### 18.2 Saver 配置

```yaml
saver:
  experiment_name: ${experiment_name}
  trial_name: ${trial_name}
  fileroot: ${cluster.fileroot}
  freq_epochs: 1
  freq_steps: null
  freq_secs: null
```

可以按 Epoch、Step 或时间触发。频率过高会造成：

- GPU 到 CPU 拷贝；
- 文件系统突发写入；
- 训练停顿；
- 大量历史版本占用存储。

### 18.3 Recover 配置

```yaml
recover:
  mode: auto
  experiment_name: ${experiment_name}
  trial_name: ${trial_name}
  fileroot: ${cluster.fileroot}
  freq_epochs: 1
  freq_secs: 3600
```

字段值以当前 Tag 为准。恢复内容通常包括：

- Actor；
- Critic；
- Reference 必需状态；
- Optimizer；
- LR Scheduler；
- 训练 Step/Epoch；
- RNG；
- 数据加载进度或独立 DataLoader 状态；
- 算法统计状态。

### 18.4 恢复约束

恢复前检查：

```text
[ ] Tag/Commit 一致
[ ] 模型 Config 一致
[ ] Tokenizer Revision 一致
[ ] DP/TP/PP/CP/EP 拓扑兼容
[ ] Optimizer 类型一致
[ ] 参数组顺序一致
[ ] 数据集 Revision 一致
[ ] Reward 版本一致
[ ] 训练脚本和 YAML 一致
[ ] Checkpoint 完整写入
```

改变并行拓扑后能否恢复，取决于后端和 Checkpoint 格式，不应默认支持。

### 18.5 推荐保存策略

```text
每 N 分钟：训练恢复 Checkpoint
每 N Step：轻量状态或指标快照
每 N Epoch：HF 模型导出
关键里程碑：不可变归档 + 校验和
```

保存时生成 Manifest：

```json
{
  "git_commit": "...",
  "areal_version": "v2.1.0",
  "model_revision": "...",
  "dataset_revision": "...",
  "config_sha256": "...",
  "reward_version": "...",
  "global_step": 1000,
  "policy_version": 125,
  "parallelism": {
    "dp": 4,
    "tp": 1,
    "pp": 1,
    "cp": 1
  }
}
```

### 18.6 恢复演练

没有恢复演练的 Checkpoint 不能算有效备份。

建议定期执行：

1. 杀死训练进程；
2. 从最新 Checkpoint 恢复；
3. 检查 Step、LR、Optimizer 和 RNG；
4. 继续训练若干步；
5. 与不中断对照实验比较 Loss 和 Reward；
6. 验证新权重能同步到推理侧；
7. 验证 Saver 仍能导出 HF 权重。

---

## 19. 评估体系

### 19.1 AReaL 评估能力的边界

AReaL 提供：

- 分布式推理；
- 评估 Workflow；
- Dataset 调度；
- 周期性评估触发；
- 指标聚合与记录；
- HF Checkpoint 评估示例。

AReaL 不自动提供：

- 所有 Benchmark 数据；
- 通用 LLM Judge Prompt；
- 安全红队；
- Agent 工具环境；
- 完整质量门户；
- 模型发布决策。

### 19.2 三层评估

#### 层 1：训练内指标

```text
Reward
KL
Entropy
Clip Fraction
Ratio
Length
Success Rate
```

用于观察优化过程，不代表最终能力。

#### 层 2：固定验证集

要求：

- 不参与训练采样；
- 数据版本固定；
- 推理参数固定；
- 明确对应 Policy Version；
- 记录失败和拒绝样本，不静默缩小分母。

#### 层 3：独立离线评估

在模型导出后，由独立流程执行：

- GSM8K、MATH、代码 Benchmark；
- Agent Benchmark；
- 工具调用质量；
- 安全评估；
- 回归集；
- 成本和延迟；
- 与生产基线对照。

### 19.3 评估示意

```bash
python3 examples/math/gsm8k_eval.py \
  --config examples/math/gsm8k_grpo.yaml \
  actor.path=/path/to/hf-checkpoint \
  scheduler.type=local
```

具体脚本和参数以检出版本为准。

### 19.4 评估指标

数学和代码任务：

```text
Pass@1
Pass@k
Exact Match
测试通过率
编译成功率
格式正确率
平均生成长度
```

Agent 任务：

```text
任务完成率
工具选择正确率
参数正确率
工具失败恢复率
平均回合数
无效动作率
超时率
环境成本
安全违规率
```

### 19.5 版本归因

评估结果必须携带：

```text
checkpoint_id
policy_version
model_revision
sampling_config
benchmark_revision
reward/judge_version
code_commit
```

异步在线评估尤其要验证所有参与评估的 Loss/输出 Token 属于期望策略版本。不能仅根据控制器当前版本给结果贴标签。

### 19.6 在线训练奖励不是固定评估

Online RL 的任务流量、用户行为、奖励分布和生产环境都会变化。训练 Reward 上升可能来自：

- 任务变简单；
- 用户分布变化；
- Reward 服务更新；
- 外部 Agent 逻辑变化；
- 失败会话没有进入分母；
- 过期样本比例变化。

因此必须保持独立、固定、可回放的验证集。

---

## 20. 指标、日志与性能剖析

### 20.1 两类指标

#### Streaming Rollout 指标

在轨迹持续到达时增量统计：

- Reward；
- 输出长度；
- 工具调用；
- 超时；
- Staleness；
- 版本分布；
- 队列延迟。

#### Distributed Tensor 指标

在训练 Rank 上聚合：

- Loss；
- KL；
- Entropy；
- Ratio；
- Clip Fraction；
- Grad Norm；
- Token 数；
- 优化器统计。

二者不能简单混为同一个平均值。例如：按 Episode 平均长度和按 Token 加权长度代表不同含义。

### 20.2 Stats Logger

配置示意：

```yaml
stats_logger:
  experiment_name: ${experiment_name}
  trial_name: ${trial_name}
  fileroot: ${cluster.fileroot}
  wandb:
    mode: online
```

官方文档主要介绍 W&B、SwanLab、TensorBoard；当前代码还可能包含其他 Logger。使用时以当前 Tag 配置 Schema 为准。

注意不同 Logger 的 `mode` 枚举可能不同，不能把一个后端的 `online` 直接复制到另一个后端。

### 20.3 最小指标集

#### 质量

```text
train/reward_mean
train/reward_std
eval/pass_at_1
eval/task_success_rate
rollout/format_success_rate
```

#### 策略稳定性

```text
train/kl
train/entropy
train/policy_ratio_mean
train/policy_ratio_p99
train/clip_fraction
train/rejected_token_ratio
train/grad_norm
```

#### 异步状态

```text
async/staleness_mean
async/staleness_p95
async/staleness_max
async/version_distribution
async/queue_depth
async/rejected_stale_samples
```

#### 系统

```text
system/rollout_tokens_per_sec
system/train_tokens_per_sec
system/reward_latency
system/weight_update_latency
system/trainer_wait_for_data
system/rollout_backpressure_time
system/gpu_utilization
system/gpu_memory_peak
```

#### Agent 行为

```text
agent/turn_count
agent/tool_calls
agent/tool_success_rate
agent/invalid_tool_args
agent/retry_count
agent/timeout_rate
agent/orphan_completion_count
```

### 20.4 Perf Tracer

```yaml
perf_tracer:
  enabled: true
  session_tracer:
    enabled: true
```

Perf Tracer 可用于分析：

- Rollout；
- Reward；
- 队列等待；
- Trainer Step；
- 权重更新；
- 保存和评估；
- Session 生命周期。

生成的 Trace 可以使用 Chrome Trace Viewer 或 Perfetto 查看。重点寻找：

- 大片空白；
- 单个阶段长尾；
- 同步屏障；
- Worker 负载不均；
- 权重更新停顿；
- 重复初始化。

### 20.5 Session Tracer

对于 Agentic RL，Session Tracer 应至少关联：

```text
task_id
session_id
completion_id
model_version
request_start/end
reward_start/end
tool_start/end
export_time
train_consume_time
```

这样才能回答：

> 一条低奖励轨迹，究竟是模型决策差、工具超时、奖励服务慢、队列积压，还是被旧策略生成？

### 20.6 PyTorch Profiler

建议仅在指定 Step 启用，避免全程 Profiling 造成巨大开销：

```text
Warmup 若干步
  ↓
捕获 1~3 个稳定训练步
  ↓
分析 CPU、CUDA、Collective、Kernel
```

关注：

- Attention；
- Packing；
- All-Gather / Reduce-Scatter；
- Optimizer；
- Host-to-Device；
- Checkpoint；
- Compile Warmup；
- MoE All-to-All。

---

## 21. 调试、性能诊断与稳定性治理

### 21.1 第一原则：先跑同步基线

```yaml
rollout:
  max_head_offpolicyness: 0
  max_concurrent_rollouts: 32
```

先证明：

- Reward 正确；
- Loss 正常；
- 模型能力有提升；
- Checkpoint 可恢复；
- 独立评估有改善。

若同步都不稳定，不要通过增大异步并发掩盖问题。

### 21.2 分层调试法

```text
数据层
  ↓
Workflow 层
  ↓
Reward 层
  ↓
推理层
  ↓
轨迹代理层
  ↓
训练算法层
  ↓
分布式通信层
  ↓
调度与存储层
```

每层建立独立可执行测试，而不是每次都启动全量集群。

### 21.3 推理一致性对照

同一个 Prompt 使用：

1. Transformers 本地生成；
2. SGLang；
3. vLLM；
4. AReaL Proxy 路径。

固定：

- 模型 Revision；
- Tokenizer；
- Chat Template；
- Temperature；
- Seed；
- Stop Token；
- 最大长度。

比较：

- Token ID；
- EOS 行为；
- Tool Schema；
- logprob；
- 输出文本；
- 截断位置。

### 21.4 Reward 为零

排查顺序：

```text
原始模型输出
  ↓
解析结果
  ↓
标准答案
  ↓
Reward 子项
  ↓
组合 Reward
  ↓
归一化后 Reward
  ↓
Advantage
```

保存至少几十条：

```text
Prompt
Output
Parsed Answer
Gold
Raw Reward
Normalized Reward
Advantage
Error
```

### 21.5 Loss 正常但能力不提升

常见原因：

- Group 内奖励相同；
- Reward 漏洞；
- 学习率过低；
- 有效 Token 太少；
- `loss_mask` 错；
- 训练使用过期或错误版本数据；
- 权重没有成功加载到 Rollout；
- 验证集污染；
- 生成被过早截断；
- 模型只学到格式而非正确性。

### 21.6 训练突然崩溃

检查：

- Ratio P99/Max；
- KL；
- Clip Fraction；
- Grad Norm；
- Reward 分布；
- Staleness；
- 拒绝 Token 比例；
- 某个模型版本是否异常；
- 长度分布是否突然变化；
- 推理和训练 Tokenizer 是否一致；
- 权重更新时是否产生混合状态。

临时降级：

```yaml
rollout:
  max_head_offpolicyness: 0
  max_concurrent_rollouts: 32
```

若同步稳定、异步不稳定，再逐步尝试 `1`、`2`、`4`。

### 21.7 GPU 利用率低

#### Rollout GPU 低

检查：

- 并发太小；
- Prompt/Reward 阻塞；
- 副本太多导致单副本 Batch 太小；
- Agent 工具 I/O 长；
- Data Proxy 成为瓶颈；
- 请求长度差异过大；
- 推理 Worker 被频繁暂停更新。

#### Training GPU 低

检查：

- 轨迹供给不足；
- Token Micro-batch 太小；
- Packing 效率低；
- DP Rank 负载不均；
- Checkpoint 太频繁；
- 权重同步过慢；
- 数据反序列化和远程 Tensor 拉取慢。

### 21.8 队列诊断

| 现象 | 可能原因 | 调整方向 |
|---|---|---|
| 队列长期为空 | Rollout 慢或 Trainer 过快 | 增加推理资源/并发，减少训练资源 |
| 队列持续增长 | Trainer 慢或异步度过高 | 增加训练资源，减少并发/容量 |
| 队列周期振荡 | 权重更新或批次节奏明显 | 检查更新屏障、Batch 和队列容量 |
| 大量 Stale 拒绝 | 积压严重 | 降低异步度、缩短训练步或清理旧数据 |

### 21.9 Python 和通信调试

Python 阻塞可用：

```bash
py-spy top --pid PID
py-spy dump --pid PID
```

NCCL 问题可临时启用：

```bash
export NCCL_DEBUG=INFO
export NCCL_DEBUG_SUBSYS=INIT,NET,COLL
```

注意 Debug 日志开销较大，不应默认长期启用。

### 21.10 可复现性

记录：

```text
随机种子
Tag/Commit
镜像 Digest
CUDA/CUDNN/NCCL
GPU 型号与拓扑
模型和数据 Revision
最终合并配置
环境变量
推理后端版本
Reward 版本
```

MoE、分布式 Collective、`torch.compile` 和异步调度都可能引入非确定性。调试时可开启后端提供的确定性模式，但通常会牺牲性能。

---

## 22. OOM 系统排查

OOM 必须先判断发生在哪个阶段。

### 22.1 Rollout OOM

优先降低并发：

```yaml
rollout:
  max_concurrent_rollouts: 64
```

再降低推理静态显存比例：

```yaml
sglang:
  mem_fraction_static: 0.75
```

或者：

```yaml
vllm:
  gpu_memory_utilization: 0.75
```

继续处理：

- 减小 `max_new_tokens`；
- 减小推理上下文；
- 增加 TP；
- 减少同时在途 Agent Session；
- 限制工具结果长度；
- 检查 KV Cache 是否泄漏；
- 检查权重更新后旧缓存是否释放。

### 22.2 Training OOM

降低 Token Micro-batch：

```yaml
actor:
  mb_spec:
    max_tokens_per_mb: 4096
```

启用梯度检查点：

```yaml
actor:
  gradient_checkpointing: true
```

调整并行：

```yaml
actor:
  backend: fsdp:d2t2
```

或在支持的后端使用 CP/PP。

注意：`train_dataset.batch_size` 通常影响一个训练更新的逻辑数据量，但峰值显存主要由单次 Forward Token 数、序列长度、模型状态和并行方式决定。

### 22.3 初始化 OOM

```yaml
actor:
  fsdp:
    memory_efficient_load: true
```

典型思想：

```text
CPU 构建模型
  ↓
应用分片
  ↓
按 Rank 加载/广播
  ↓
逐步转移到 GPU
```

### 22.4 Reference/Critic 共置 OOM

处理方式：

- 减小 Actor Micro-batch；
- Reference 单独分配资源；
- 关闭不需要的 KL/Reference 计算；
- 对 Reference 分批 Forward；
- 使用 CPU Offload；
- 调整共置时序。

### 22.5 权重同步 OOM

切换磁盘方式：

```yaml
actor:
  weight_update_mode: disk
```

或：

- 减小通信 Bucket；
- 避免同时驻留两份完整权重；
- 分阶段更新；
- 检查 LoRA 是否只传 Adapter；
- 使用 AWEX 等支持的分离/Delta 传输能力。

### 22.6 VLM OOM

额外处理：

- 降低图像分辨率；
- 限制图片数量；
- 控制视觉 Token；
- 将纯文本和多模态 Batch 分开；
- 冻结视觉 Encoder；
- 调整视觉 Padding；
- 对图像做尺寸分桶。

### 22.7 OOM 记录模板

```text
阶段：rollout / forward / backward / optimizer / weight-update / save
GPU：型号、显存、Rank
模型：名称、Revision、Dtype
序列：Prompt P50/P95/Max，Output P50/P95/Max
Micro-batch：有效 Token
并行：DP/TP/PP/CP/EP
共置：Actor/Ref/Critic/Rollout
峰值显存：allocated/reserved
最后成功配置：...
失败配置：...
```

---

## 23. 安全、数据与生产治理

### 23.1 管理接口安全

v2.1.0 要求 Data Proxy 的 `/register_model` 使用管理员密钥，以降低 SSRF 风险。这说明模型注册和代理目标地址属于高权限控制面。

必须执行：

- 管理 API 不暴露公网；
- 非 Loopback 监听时禁止默认密钥；
- 目标模型地址使用 Allowlist；
- 禁止任意内网 URL；
- 记录注册、更新、删除审计；
- 使用 mTLS 或受控 Service Mesh；
- 限制管理接口访问主体。

### 23.2 外部 Agent 权限

AReaL 记录轨迹，但不会自动约束 Agent 工具权限。工具执行层需要：

- 文件系统范围；
- 网络域名 Allowlist；
- Shell 命令策略；
- Secret 隔离；
- 数据库只读/写权限；
- 人工确认；
- 幂等操作；
- 超时和预算；
- 高风险动作禁止或审批。

### 23.3 数据脱敏

轨迹可能包含：

- 用户 Prompt；
- 源代码；
- API Key；
- 工具参数；
- 数据库内容；
- 个人信息；
- 内部 URL；
- 模型推理痕迹。

训练前应做：

```text
采集资格判定
  ↓
Secret 检测
  ↓
PII 脱敏
  ↓
租户隔离
  ↓
许可证与授权检查
  ↓
保留期标记
  ↓
进入训练缓冲
```

### 23.4 奖励完整性

外部调用 `/rl/set_reward` 时，Reward API 本身就是训练控制面。应防止：

- 任意客户端伪造高奖励；
- 重复提交；
- 奖励覆盖；
- 给错误 Completion 设置奖励；
- Reward 服务版本漂移；
- 训练和评估共用可篡改 Judge。

建议：

- Reward 请求签名；
- Idempotency Key；
- `interaction_id` 强绑定；
- 奖励来源和版本审计；
- 高风险奖励由服务端计算；
- 原始证据不可变存储。

### 23.5 多租户隔离

至少在以下维度隔离：

```text
API Key
Session
Trajectory Store
Checkpoint
日志
指标
模型版本
Reward 配置
数据保留策略
```

不能只依靠 `task_id` 命名约定实现租户隔离。

### 23.6 模型晋级与回滚

训练完成不等于自动进入生产：

```mermaid
flowchart LR
    A[新 Checkpoint] --> B[完整性校验]
    B --> C[固定集评估]
    C --> D[安全评估]
    D --> E[回归与成本评估]
    E --> F[小流量灰度]
    F --> G{门禁通过?}
    G -->|是| H[扩大流量]
    G -->|否| I[回滚]
```

门禁建议包括：

- 核心任务不下降；
- 安全指标不恶化；
- 工具错误率不升高；
- 延迟和成本可接受；
- 长输出和循环率受控；
- 可在分钟级回滚。

---

## 24. v2.1.0 需要重点关注的变化

AReaL `v2.1.0` 于 2026-08-25 发布。相比只关注“新算法”，更值得注意的是数据正确性、调度和服务安全的改动。

### 24.1 调度与共置

- 增加 HTTP-based Ray Scheduler；
- 支持 AWEX Actor-Rollout 共置；
- Ray Scheduler 支持 Grouped Colocation；
- Slurm 支持 Reservation、Exclusive 和用户环境覆盖；
- 更严格识别终止状态和失效 Worker；
- 更新 AWEX 版本，并增强控制屏障与数据传输隔离。

### 24.2 轨迹正确性

- 输出 Token 归因到实际服务版本；
- 拒绝不完整采样证据；
- 清理重试孤儿 Completion，防止轨迹分裂；
- 权重更新期间暂停 Proxy Worker；
- 修复在线 Reward 的单成员信号保留；
- 增加 Rejection-aware Token 和 logprob 统计。

这些变化说明：

> 异步 RL 的首要问题不是吞吐，而是“训练样本是否真的对应它声称的策略与交互路径”。

### 24.3 Group 与优势计算

- 增加 Grouped Reward Normalization 控制；
- 支持元数据驱动的 Group 归一化；
- Online v2 路径支持 Group Reward Normalization；
- 增加灵活 GAE Lambda 策略。

升级后应重新验证：

- Group Size；
- 动态过滤；
- 单成员组；
- 分组元数据；
- Advantage 分布。

### 24.4 模型与 LoRA/VLM

- 增加 Qwen3.6 27B、35B-A3B VLM LoRA GRPO 支持；
- 加强 Qwen3-VL 和 AWEX 共置路径；
- 修复 PEFT 标准 LoRA Adapter Key；
- 修复 Megatron + LoRA 回归；
- 修复纯文本 VLM Micro-batch；
- 增加 Qwen3-VL THD 相关能力。

### 24.5 性能与稳定性

- 降低 Megatron 训练内存峰值；
- 支持固定 Warmup Steps；
- 修复训练后异步保存时 Actor 权重释放；
- 加强推理 Worker 路由和缓存稳定性；
- 本地推理服务启动失败时快速失败；
- 增强 Rollout 采样确定性。

### 24.6 安全

- `/register_model` 强制管理员密钥，降低 SSRF 风险。

升级检查清单：

```text
[ ] Pin v2.1.0 镜像和 Commit
[ ] 对比最终配置字段
[ ] 重新跑同步小规模基线
[ ] 验证权重更新与 Token 版本
[ ] 验证 Retry-Orphan 清理
[ ] 重新验证 Group Normalization
[ ] 测试 Checkpoint 恢复
[ ] 测试 LoRA/VLM 推理加载
[ ] 审计管理 API Key
[ ] 再进行多节点扩容
```

---

## 25. 推荐学习与落地路线

### 阶段 1：理解同步 RLVR

配置：

```yaml
rollout:
  max_head_offpolicyness: 0
  max_concurrent_rollouts: 32
```

目标：

- 跑通 GSM8K；
- 能解释 Reward、Advantage、Ratio、KL；
- 能定位 Reward 为零；
- 能保存和恢复。

### 阶段 2：开启保守异步

```yaml
rollout:
  max_head_offpolicyness: 2
  max_concurrent_rollouts: 128

actor:
  recompute_logprob: true
  use_decoupled_loss: true
```

对比同步与异步：

```text
端到端时间
Rollout Token/s
Train Token/s
Reward
固定验证集
Staleness
Ratio
拒绝率
GPU 利用率
```

### 阶段 3：自定义数据与 Reward

```text
公开 GSM8K
  ↓
私有小样本回放
  ↓
Reward 单元测试
  ↓
同步训练
  ↓
独立验证
  ↓
异步训练
```

### 阶段 4：Agentic RL

从简单到复杂：

```text
单轮回答
  ↓
多轮对话
  ↓
单工具调用
  ↓
多工具调用
  ↓
沙箱任务
  ↓
长周期任务
```

每阶段都验证：

- Completion Tree；
- Reward 归因；
- `loss_mask`；
- Token 版本；
- 取消和重试；
- 轨迹导出。

### 阶段 5：Online RL

先使用合成外部客户端：

```text
固定任务生成器
  ↓
创建会话
  ↓
调用模型
  ↓
服务端计算 Reward
  ↓
结束会话
  ↓
训练
```

不要一开始直接接入真实生产用户流量。

### 阶段 6：扩展规模

```text
单机 4/8 GPU
  ↓
两节点
  ↓
Ray 或 Slurm
  ↓
共置
  ↓
LoRA/VLM/MoE
  ↓
完整发布门禁
```

### 阶段 7：生产闭环

```text
真实任务
  ↓
轨迹采集与脱敏
  ↓
奖励与资格过滤
  ↓
异步训练
  ↓
固定集评估
  ↓
安全与回归评估
  ↓
灰度发布
  ↓
监控与回滚
```

---

## 最小配置模板

### A.1 同步 GRPO 基线

```yaml
experiment_name: demo-grpo
trial_name: sync-baseline
seed: 1

total_train_epochs: 1
tokenizer_path: ${actor.path}

cluster:
  n_nodes: 1
  n_gpus_per_node: 4
  fileroot: /tmp/areal/experiments

scheduler:
  type: local

rollout:
  backend: sglang:d2p1t1
  max_concurrent_rollouts: 32
  max_head_offpolicyness: 0
  agent:
    mode: inline
    export_style: individual
    turn_discount: 1.0

gconfig:
  n_samples: 4
  max_new_tokens: 512
  max_tokens: 1024
  temperature: 1.0

actor:
  backend: fsdp:d2p1t1
  path: Qwen/Qwen2.5-1.5B-Instruct
  dtype: bfloat16
  gradient_checkpointing: true
  mb_spec:
    max_tokens_per_mb: 4096
    packing_algorithm: ffd
  optimizer:
    type: adam
    lr: 6e-6
  eps_clip: 0.4
  kl_ctl: 0.0
  ppo_n_minibatches: 1
  recompute_logprob: true
  use_decoupled_loss: true
  weight_update_mode: xccl

ref:
  backend: ${actor.backend}
  path: ${actor.path}
  optimizer: null
  scheduling_strategy:
    type: colocation
    target: actor

train_dataset:
  type: rl
  path: openai/gsm8k
  batch_size: 64
  max_length: 512

valid_dataset:
  type: rl
  path: openai/gsm8k
  batch_size: 64

saver:
  freq_epochs: 1

recover:
  mode: disabled

evaluator:
  freq_epochs: 1

stats_logger:
  wandb:
    mode: disabled

perf_tracer:
  enabled: false
```

> 该模板用于说明结构。字段默认值、必填项和可用枚举以本地 Tag 为准。

### A.2 异步 GRPO 差异项

```yaml
rollout:
  max_concurrent_rollouts: 128
  max_head_offpolicyness: 2

actor:
  recompute_logprob: true
  use_decoupled_loss: true
  rejection_sampling:
    metric: ratio
    upper: 5.0
```

### A.3 Online RL 差异项

```yaml
rollout:
  agent:
    mode: online
    admin_api_key: ${oc.env:AREAL_ADMIN_KEY}
    session_timeout_seconds: 3600
    turn_discount: 1.0
    export_style: individual
    drop_retry_orphans: true
```

### A.4 磁盘权重更新

```yaml
cluster:
  fileroot: /shared/areal

actor:
  weight_update_mode: disk
```

### A.5 开启性能追踪

```yaml
perf_tracer:
  enabled: true
  session_tracer:
    enabled: true
```

---

## 排障矩阵

| 现象 | 首要证据 | 常见根因 | 优先动作 |
|---|---|---|---|
| Reward 全零 | 原始输出、解析结果 | 格式不匹配、字段错误、截断 | 保存样本并逐步检查 Reward Pipeline |
| Advantage 近零 | Group Reward 分布 | 同组奖励相同、Group 错 | 检查 Group 元数据和过滤后成员 |
| Loss 为 NaN | Ratio、KL、Grad Norm | 极端 off-policy、学习率、数值精度 | 切同步、降 LR、检查拒绝策略 |
| 异步不稳定 | Staleness、版本分布 | 队列积压、更新幅度大 | 从 0→1→2 逐步增加异步度 |
| Rollout OOM | 并发、KV Cache | 并发或上下文过大 | 先降 `max_concurrent_rollouts` |
| Training OOM | Forward Token 数 | Micro-batch、模型状态、共置 | 降 `max_tokens_per_mb` |
| Trainer 等数据 | Queue 深度为 0 | 推理慢、Reward 慢 | 增加 Rollout 资源或并发 |
| Queue 持续增长 | Staleness 上升 | Trainer 慢 | 增加训练资源或限制生产速率 |
| Reward 提升但 Eval 不升 | 固定集指标 | 奖励投机、分布变化 | 审计高奖励样本和 Reward 版本 |
| 权重更新后能力不变 | 推理版本、模型哈希 | 推理未加载新权重 | 验证加载响应和 Token 版本 |
| 多轮轨迹分叉异常 | Completion Tree | SDK 自动重试 | 关闭隐式重试、清理 Orphan |
| 评估结果不稳定 | Seed、Sampling、版本 | 混合策略版本、随机采样 | 固定版本和采样参数 |
| Checkpoint 无法恢复 | Manifest、拓扑 | 并行配置或代码变化 | 使用同 Tag 和兼容拓扑恢复 |
| 多节点挂起 | NCCL、Worker 状态 | 网络、端口、僵尸 Worker | 开启有限 NCCL 日志并检查调度器 |
| LoRA 训练有效、推理无变化 | Adapter Key、加载日志 | Adapter 未加载或键名不兼容 | 验证 PEFT Key 与后端加载接口 |
| VLM 文本样本失败 | Batch 类型 | 文本/多模态 Padding 路径错误 | 分开测试纯文本、单图、多图 |
| 在线接口大量 429 | 容量与训练周期 | Staleness 容量耗尽 | 有界退避，调平生产/消费速率 |
| 在线轨迹缺失 | Session 状态 | 未结束会话、超时、认证错误 | 检查 Session 生命周期和 Export |

---

## 术语表

| 术语 | 含义 |
|---|---|
| Actor | 被优化的策略模型 |
| Critic | 估计状态价值的模型 |
| Reference | 提供参考概率或 KL 基准的冻结模型 |
| Rollout | 使用策略生成回答或 Agent 轨迹 |
| Trajectory | 带 Token、概率、Mask、奖励和版本的训练轨迹 |
| Episode | 可独立评分的一次任务执行 |
| Completion | 一次模型生成结果 |
| Behavior Policy | 真正生成样本的策略 |
| Proximal Policy | 近端更新约束所参考的策略 |
| Staleness | 样本策略版本落后当前策略的程度 |
| Off-policy | 数据并非由当前策略直接生成 |
| Decoupled PPO | 分离行为策略修正与近端策略约束的 PPO 形式 |
| `loss_mask` | 标记哪些 Token 参与训练 Loss |
| Grouped Rollout | 同一任务生成多条候选轨迹 |
| GRPO | 使用组内相对奖励构造优势的策略优化 |
| GAE | Generalized Advantage Estimation |
| Data Proxy | 代理模型请求并记录 Token 级训练证据 |
| Interaction Cache | 保存会话中 Completion 及父子关系的缓存 |
| XCCL | 通过集合通信同步权重的路径 |
| DCP | Distributed Checkpoint |
| DP | Data Parallel |
| TP | Tensor Parallel |
| PP | Pipeline Parallel |
| CP | Context Parallel |
| EP | Expert Parallel |
| SP | Sequence Parallel |
| Packing | 将可变长度序列组合进 Token 预算，减少 Padding |
| Tree Training | 对共享前缀的多分支轨迹复用计算 |
| AWEX | AReaL 使用的共置/权重交换相关基础设施之一 |

---

## 官方资料索引

以下资料建议与本文配合阅读，并优先选择与本地 Tag 对应的版本。

### 项目与发布

- [AReaL GitHub 仓库](https://github.com/areal-project/AReaL)
- [AReaL v2.1.0 Release](https://github.com/areal-project/AReaL/releases/tag/v2.1.0)
- [AReaL 异步 RL 论文](https://arxiv.org/abs/2505.24298)

### 入门

- [Installation](https://github.com/areal-project/AReaL/blob/main/docs/en/tutorial/installation.md)
- [Quickstart](https://github.com/areal-project/AReaL/blob/main/docs/en/tutorial/quickstart.md)
- [GSM8K GRPO 示例配置](https://github.com/areal-project/AReaL/blob/main/examples/math/gsm8k_grpo.yaml)
- [GSM8K GRPO 代码讲解](https://github.com/areal-project/AReaL/blob/main/docs/en/tutorial/gsm8k_grpo.md)

### Agent 与 Online RL

- [Agentic RL Tutorial](https://github.com/areal-project/AReaL/blob/main/docs/en/tutorial/agentic_rl.md)
- [Custom Agent Workflow](https://github.com/areal-project/AReaL/blob/main/docs/en/customization/agent.md)
- [Agent Workflow Reference](https://github.com/areal-project/AReaL/blob/main/docs/en/reference/agent_workflow.md)
- [Online RL Training](https://github.com/areal-project/AReaL/blob/main/docs/en/tutorial/online_proxy.md)
- [Rollout Workflow Reference](https://github.com/areal-project/AReaL/blob/main/docs/en/reference/rollout_workflow.md)

### 算法

- [Asynchronous RL](https://github.com/areal-project/AReaL/blob/main/docs/en/algorithms/async.md)
- [PPO、GRPO 与相关算法](https://github.com/areal-project/AReaL/blob/main/docs/en/algorithms/grpo_series.md)
- [M2PO](https://github.com/areal-project/AReaL/blob/main/docs/en/algorithms/m2po.md)
- [DPO](https://github.com/areal-project/AReaL/blob/main/docs/en/algorithms/dpo.md)
- [Distillation](https://github.com/areal-project/AReaL/blob/main/docs/en/algorithms/distillation.md)

### 后端与高级能力

- [Megatron Tutorial](https://github.com/areal-project/AReaL/blob/main/docs/en/tutorial/megatron.md)
- [Archon Tutorial](https://github.com/areal-project/AReaL/blob/main/docs/en/tutorial/archon.md)
- [LoRA Reference](https://github.com/areal-project/AReaL/blob/main/docs/en/reference/lora.md)
- [Tree Training](https://github.com/areal-project/AReaL/blob/main/docs/en/reference/tree_training.md)
- [Allocation Mode](https://github.com/areal-project/AReaL/blob/main/docs/en/reference/alloc_mode.md)
- [NPU Installation](https://github.com/areal-project/AReaL/blob/main/docs/en/tutorial/installation_npu.md)

### 工程实践

- [Checkpointing](https://github.com/areal-project/AReaL/blob/main/docs/en/reference/checkpointing.md)
- [Metrics Tracking](https://github.com/areal-project/AReaL/blob/main/docs/en/reference/metrics_tracking.md)
- [Evaluation](https://github.com/areal-project/AReaL/blob/main/docs/en/tutorial/eval.md)
- [Workflow Best Practices](https://github.com/areal-project/AReaL/blob/main/docs/en/best_practices/workflow.md)
- [Debugging](https://github.com/areal-project/AReaL/blob/main/docs/en/best_practices/debugging.md)
- [Handling OOM](https://github.com/areal-project/AReaL/blob/main/docs/en/best_practices/handling_oom.md)
- [Performance Profiling](https://github.com/areal-project/AReaL/blob/main/docs/en/best_practices/perf_profiling.md)
- [CLI Configuration Reference](https://github.com/areal-project/AReaL/blob/main/docs/en/cli_reference.md)

---

## 总结

AReaL 的核心并不是“提供一个 GRPO 脚本”，而是建立如下闭环：

```text
任务和环境
  ↓
模型或 Agent 执行
  ↓
带 Token、logprob、loss_mask、版本和父子关系的轨迹
  ↓
可验证、可归因、可审计的奖励
  ↓
受 Staleness 和异常 Ratio 约束的异步策略更新
  ↓
一致的权重同步
  ↓
固定集评估、灰度与回滚
```

真正掌握 AReaL，需要同时理解四个层面：

1. **算法层**：GRPO/PPO、off-policy、Decoupled Loss、优势与拒绝策略；
2. **数据层**：Token 轨迹、版本证据、Reward 归因、Group 和 Mask；
3. **系统层**：Rollout、Trainer、调度、共置、权重更新、Checkpoint；
4. **生产层**：认证、沙箱、数据治理、独立评估、发布和回滚。

只跑通训练命令属于入门；能够证明每条训练轨迹从何而来、为何获得奖励、由哪个模型版本生成，并能在故障后恢复和在评估失败时回滚，才是可生产化的 AReaL 工程能力。
