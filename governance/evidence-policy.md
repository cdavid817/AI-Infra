# Evidence as Code

高风险结论不靠口头信誉,靠机器可读的证据登记。本规范描述当前仓库已经在执行的证据机制,并定义后续扩展的口径。

## 现有机制

- **Claim 登记**:正文中以 `<!-- claim: CLM-XXX-YYY -->` 注释标记可核验结论,站点渲染为角标,跳转到 `references/claims/chapter-XX.yaml`。ID → 文件映射规则:章节段按数值解析后补零到两位(`CLM-024-001` → `chapter-24.yaml`),实现与测试见 `scripts/lib/claim-links.mjs`。
- **Claim / Source Schema**:`references/schemas/claim.schema.json` 与 `source.schema.json`,由 `node scripts/validate-evidence.mjs` 校验。
- **来源政策**:[references/source-policy.md](../references/source-policy.md) 定义来源准入与登记(`references/sources.yaml`)。
- **新鲜度**:附录 A/B/C 的数据以 `book-version.yaml` 的 `data_snapshot` 为口径日期,nightly CI 生成 freshness 报告。

## 数据性质四分类

正文与实验中出现的数字必须能区分四种性质,引用时显式标注:

| 性质 | 含义 |
|---|---|
| `measured` | 明确环境中的实测数据(必须附环境声明,见 [lab-fidelity-model.md](lab-fidelity-model.md)) |
| `derived` | 由公式和已知输入推导 |
| `estimate` | 带不确定性的工程估算 |
| `synthetic` | 教学构造的数据或场景,**不得描述为真实测量** |

## 证据等级

| 等级 | 来源 |
|---|---|
| L1 | 官方规范、标准、源代码、正式文档 |
| L2 | 官方设计文档、维护者说明、正式基准 |
| L3 | 可复现实验和完整数据 |
| L4 | 高质量二手资料或多个独立来源 |
| L5 | 工程经验、待验证假设或教学示意 |

## 高风险 Claim(默认清单)

生产兼容性、容量与硬件数量、成本与 TCO、性能/延迟/吞吐/扩展效率、数据持久性与故障恢复、安全边界与权限行为。Stable 发布不得包含未显著标记的高风险未验证 Claim。

## 审计状态模型

章节的证据审计状态登记在 [book-manifest.yaml](../book-manifest.yaml) 的 `governance.evidence_audit` 段,取值:

- `pending`:尚未逐条审计(当前全部章节的初始值)
- `audited-no-claims`:已审计且确认无需登记高风险 Claim
- `audited`:已审计且 Claim 登记完整

「没有记录」与「没有问题」是两回事:未审计一律 `pending`,不得默认为已通过。
