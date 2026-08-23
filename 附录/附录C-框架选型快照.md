# 附录 C 框架选型快照

> **数据截至 2026 年 8 月。** 框架项目的半衰期远短于本书的生命周期,本附录是三层框架地图(§2.4.3)在成书时刻的一张快照:项目清单、版本态势与选型矩阵都会过时,**层的划分与选型方法不会**。使用前请核对在线勘误与更新页:**https://<在线勘误地址占位>/appendix-c**。
>
> 使用纪律(正文结论重申):任何框架对比只有发生在**同一层内**才有意义——vLLM vs KServe 之争等价于 Spark vs YARN 之争,是问错了问题(§2.4.3)。拿到本附录清单外的新项目,先把它放进层格子,再找同层项目对比;故意跨层的项目标注"占哪两格、与谁互斥",不要硬塞。

---

## C.1 三层框架地图:完整项目清单

### C.1.1 训练侧

| 层 | 项目 | 定位一句话 | 机制剖析章节 | 昇腾侧对应 |
|---|---|---|---|---|
| 运行时 / 引擎层 | Megatron-Core | TP/PP/EP 全维并行的参照实现,大规模预训练事实标准 | 第 18 章 | MindSpeed(Megatron 移植增强)|
| 运行时 / 引擎层 | DeepSpeed | ZeRO 系显存优化起家,全家桶式训练引擎 | 第 18 章 | 经 torch_npu 适配可用 |
| 运行时 / 引擎层 | PyTorch FSDP2 | 原生全分片数据并行,与 PyTorch 生态零摩擦 | 第 18 章 | torch_npu 路线原生支持 |
| 运行时 / 引擎层 | MindSpore | 昇腾原生训练框架(非 PyTorch 生态) | 第 18 章 | ——本体即昇腾侧,两条路线取舍见第 18 章 |
| 框架 / 工程层 | TorchTitan | PyTorch 官方参考训练循环,组合原生并行原语 | 第 19 章 | torch_npu 路线可用 |
| 框架 / 工程层 | LLaMA-Factory | 微调工作台,配置驱动、覆盖主流开源模型 | 第 19 章 | 官方支持昇腾后端 |
| 框架 / 工程层 | Axolotl | 微调工作台,YAML 配置、社区驱动 | 第 19 章 | — |
| 框架 / 工程层(RL) | verl | RL 后训练框架,单控制器编排训推混合 | 第 21 章 | 社区昇腾适配推进中 |
| 框架 / 工程层(RL) | OpenRLHF | Ray 架构的 RLHF 实现 | 第 21 章 | — |
| 框架 / 工程层(RL) | TRL | Hugging Face 系轻量 RL,单机到小规模 | 第 21 章 | — |
| 框架 / 工程层(RL) | slime | 面向大规模 rollout 的 RL 框架 | 第 21 章 | — |
| 编排 / 平台层 | Ray Train | 进程组拉起与弹性,Python 原生 | 第 19 章 | 可跑昇腾资源 |
| 编排 / 平台层 | Slurm | HPC 血统批调度,超算与大训练集群主力 | 第 9、19 章 | 支持 |
| 编排 / 平台层 | Kubeflow(Training Operator) | K8s 上的训练任务 CRD 编排 | 第 9、19 章 | 配合 Ascent device plugin |
| 编排 / 平台层(批调度器) | Volcano / Kueue | K8s gang scheduling 与配额队列 | 第 9 章 | Volcano 对昇腾支持成熟 |

### C.1.2 推理侧

| 层 | 项目 | 定位一句话 | 机制剖析章节 | 昇腾侧对应 |
|---|---|---|---|---|
| 运行时 / 引擎层 | vLLM | PagedAttention + continuous batching,开源推理事实标准 | 第 22 章 | vLLM-Ascend |
| 运行时 / 引擎层 | SGLang | RadixAttention 前缀复用,Agent/结构化输出见长 | 第 22 章 | 社区适配推进中 |
| 运行时 / 引擎层 | TensorRT-LLM | NVIDIA 编译路线,榨取单卡极限 | 第 22 章 | ——(绑定 NVIDIA) |
| 运行时 / 引擎层 | LMDeploy | 上海 AI Lab 出品,TurboMind 内核 + 量化一体 | 第 22 章 | — |
| 运行时 / 引擎层 | MindIE | 昇腾官方推理引擎 | §22.4 | ——本体即昇腾侧;与 vLLM-Ascend 的取舍见 §22.4 |
| 运行时 / 引擎层(边缘) | llama.cpp / Ollama | CPU/端侧量化推理;后者做易用性封装 | 第 22 章 | — |
| 框架 / 工程层 | Triton Inference Server | 多后端服务组装、ensemble 流水线 | 第 24 章 | 可挂第三方后端 |
| 框架 / 工程层 | NVIDIA Dynamo | 分布式推理编排:PD 分离、KV 感知路由 | 第 24 章 | — |
| 编排 / 平台层 | KServe | K8s 上的模型服务 CRD、按请求扩缩 | 第 24 章 | 可编排 MindIE/vLLM-Ascend 实例 |
| 编排 / 平台层 | Ray Serve | Python 原生服务编排、细粒度组合 | 第 24 章 | 同上 |
| 编排 / 平台层 | KubeAI | 轻量 K8s 模型服务编排 | 第 24 章 | — |
| 网关层 | 各类 LLM Gateway(如 LiteLLM 系、Higress 系及自研) | 配额、计费口径、多模型多供应商路由 | 第 27 章 | 与硬件无关 |

### C.1.3 配套工具层(不入三层地图,按用途归类)

| 用途 | 项目 | 章节 | 昇腾侧对应 |
|---|---|---|---|
| 量化工具链 | GPTQ / AWQ / llm-compressor / TensorRT Model Optimizer | 第 23 章 | 昇腾模型压缩工具(msModelSlim 系) |
| 编译与算子 | Triton 语言、TorchInductor、FlashAttention / FlashInfer、CUTLASS | 第 23 章 | CANN 算子开发(Ascend C)、VF/CF 融合特性(§23.2) |
| 集合通信库 | NCCL | 第 7 章 | HCCL(原语对应关系见 §7.4.5)|
| 底层软件栈 | CUDA 全家桶 | 第 5 章 | CANN(完整栈对照见 §5.3,术语对照见附录 D)|

---

## C.2 选型矩阵:场景 × 规模

矩阵给的是**默认起点**,不是终点;每格的失效边界在对应章节。规模档口径:小 = 单机 8 卡内,中 = 数机到百卡,大 = 数百到数千卡,超大 = 数千卡以上。

### C.2.1 训练侧

| 场景 \ 规模 | 小(≤8 卡) | 中(~百卡) | 大(数百~数千卡) | 超大(数千卡+) |
|---|---|---|---|---|
| 微调(SFT/LoRA) | LLaMA-Factory / Axolotl 单机直跑 | LLaMA-Factory + FSDP2,K8s Job 或 Slurm | 少见;若有,TorchTitan + FSDP2 | — |
| 稠密预训练 / 继续预训练 | FSDP2(TorchTitan 起步) | FSDP2 或 Megatron-Core,Slurm/Volcano 编排 | Megatron-Core(TP×PP×DP),Slurm | Megatron-Core + 容错体系(第 20 章)|
| MoE 预训练 | 不建议(EP 域太小) | Megatron-Core(EP 域内化,需超节点或单机 EP) | Megatron-Core + EP,域对齐见第 16 章 | 同左,All2All 域内化是硬约束 |
| RL 后训练 | TRL 单机 | verl / OpenRLHF + Ray | verl(训推混合潮汐,第 21 章) | verl / slime |
| 昇腾集群训练 | torch_npu + LLaMA-Factory | MindSpeed 或 torch_npu+FSDP,Volcano | MindSpeed(PyTorch 路线)或 MindSpore | MindSpeed;两条路线取舍见第 18 章 |

### C.2.2 推理侧

| 场景 \ 规模 | 单卡~单机 | 多实例(数机) | 大规模服务(数十机+) |
|---|---|---|---|
| 通用对话 / API 服务 | vLLM 直跑 | vLLM + KServe/Ray Serve | vLLM/SGLang + Dynamo(PD 分离)+ 网关层 |
| Agent / 高前缀复用 / 结构化输出 | SGLang | SGLang + 编排层(KV 感知路由) | SGLang + Dynamo,前缀缓存策略见第 22 章 |
| 极致单卡吞吐 / 延迟(NVIDIA) | TensorRT-LLM | TensorRT-LLM + Triton Server | 同左 + KServe;绑定代价见第 12 章 |
| 长上下文 / 大 KV | vLLM(量化 KV)+ 大显存卡(附录 A) | PD 分离 + KV 分层(第 25 章) | 同左 |
| 边缘 / 端侧 | llama.cpp / Ollama | — | — |
| 昇腾推理 | MindIE 或 vLLM-Ascend(取舍见 §22.4) | 同左 + KServe/Volcano | MindIE 集群方案 |

### C.2.3 矩阵外的三条否决规则

1. **跨层混比一票否决**:出现"vLLM 还是 KServe""Megatron 还是 Ray"式的问题,先回 §2.4.3 把层定对,再回来查矩阵。
2. **规模档跨档不外推**:小规模验证过的组合升档时,必须重算通信账(附录 B F15–F20)——百卡可行的方案千卡未必可行,反之亦然。
3. **昇腾侧选型先查算子覆盖率**(附录 E 盘点表),后查本矩阵:矩阵假设"该跑的都能跑",这个假设在异构迁移场景下必须先被验证(第 12 章)。

---

## C.3 快照的保质期声明

本附录三类信息的过时速度不同,更新时按此优先级核对勘误页:

| 信息类型 | 预期保质期 | 过时的信号 |
|---|---|---|
| 层的划分与否决规则 | 全书生命周期 | 出现稳定占据两层的主流项目(需重画地图而非改清单) |
| 项目清单与定位 | 12~24 个月 | 某层出现新的事实标准;清单内项目停止维护 |
| 选型矩阵推荐 | 6~12 个月 | 引擎层性能格局变化、昇腾侧适配状态变化 |

---

*本附录数据截至 2026 年 8 月;勘误与更新:https://<在线勘误地址占位>/appendix-c。*
