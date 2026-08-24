# AI-Infra 优化基线报告(Task Group 0)

> 生成日期:2026-08-24
> 对应计划:`plans/AI-INFRA-OPTIMIZATION-PLAN.md`
> 本报告只做盘点,未修改任何正文语义。

## 1. 仓库基线

- **HEAD**:`54639dcda2c672728b4c1691ab05886ee3981205`
- **分支**:`main`;**远端**:`origin = https://github.com/cdavid817/AI-Infra.git`
- **工作树**:盘点开始时干净(本轮仅新增 `plans/` 与 `reports/` 两个目录的文件)

## 2. 文件数量与结构

| 项 | 数量 | 统计命令 |
|---|---|---|
| Markdown 文件 | 45(31 章 + 6 附录 + README/CONTRIBUTING/ERRATA/SOURCES 等) | `glob **/*.md` |
| 图片与 SVG(images/ + diagrams/) | 49 | `glob` 排除 .md/.d2/.excalidraw |
| 图表源文件 | diagrams/ 下 .d2 与 .excalidraw 共 29 个 | `ls diagrams/` |
| Mermaid 代码块 | 71 | count ```` ```mermaid ```` |
| 外部 HTTP 链接 | 5(正文延伸阅图另有纯文本 arXiv 链接未计入) | regex `](https?://` |
| 带锚点内部链接 | 596(§X.Y 交叉引用体系) | regex `](...#...)` |
| Markdown 表格 | 108 | 表头+分隔行匹配 |

章节清单与七部分结构与 README 目录一致,未发现缺章或重复章。

## 3. 现有检查命令及真实结果

| 命令 | 结果 |
|---|---|
| `node scripts/check-doc-links.mjs` | **执行失败**:`spawnSync rg ENOENT` —— 脚本硬依赖系统 `rg`(ripgrep),本机未安装。对应计划 Task 1.10 的问题描述属实。CI(ubuntu-latest)上能否运行未验证。 |
| 等效本地链接检查(Python 重实现,仅盘点用) | 45 个文件的本地图片/文件链接均有效(前几轮已多次核验) |

## 4. 证据缺口统计(第 27–31 章,首批强制范围)

### 4.1 含量化数字的段落数(启发式:数字+单位正则,非精确)

| 章 | 含数字/单位段落 |
|---|---|
| 第 27 章 模型网关 | 8 |
| 第 28 章 Agent 运行时基础设施 | 11 |
| 第 29 章 可观测性与评测流水线 | 11 |
| 第 30 章 模型生命周期管理 | 5 |
| 第 31 章 容量、成本与 SLO | 20 |

以上段落目前**均无** Claim ID、来源 ID 或示意标记。

### 4.2 问题场景初判分类(待 Group 2 正式标注)

| 章 | 场景概要 | 初判类型 |
|---|---|---|
| 27 | 智能客服 SaaS 供应商故障中断四小时 | 合成案例(写作时虚构,无来源) |
| 28 | 数据分析 Agent 沙箱冷启动占延迟大头 | 合成案例 |
| 29 | 70B 模型量化上线后质量静默下降 | 合成案例 |
| 30 | 回滚时无法确定线上版本与训练数据 | 合成案例 |
| 31 | 按算力买卡但机房供电不足 | 合成案例 |

**结论**:五章问题场景全部为写作时构造的合成案例,无一被伪装为可查证真实事故,但也均未按计划 §5.6 显式标注「合成案例」元数据。全书其他 26 章情况相同(本轮未逐章列举)。

**已有真实来源的例外**:第 1 章(Llama 3 466 次中断、MegaScale——有 arXiv 出处;Epoch AI 数据——CC BY)、各章「延伸阅图」共 13 处有论文出处。

## 5. 附录来源覆盖率

| 附录 | 表格数据行 | 含来源线索的行 | 覆盖率 |
|---|---|---|---|
| 附录 A(加速卡与集群形态) | 75 | 1 | ≈1% |
| 附录 C(框架选型快照) | 57 | 0 | 0% |

两附录页首有「数据截至 2026 年 8 月」快照日期,但**逐行来源、精度口径(稠密/稀疏、峰值/持续)、核验日期均缺失**;数据为手工 Markdown 维护,无结构化数据源(`data/` 目录不存在)。

## 6. 图片授权状态

`images/SOURCES.md` 台账共 6 条记录:

- **5 条「待确认」**:vLLM 两图、投机解码两图(标记 CC BY 4.0 需发布前复核)、DistServe 一图(CC BY-SA 4.0 需复核)——均为论文图,写作轮已按 arXiv 摘要页许可初核,但台账要求发布前二次复核,尚未完成。
- **1 条「可发布」**:Epoch AI 训练算力图(CC BY 4.0,2026-08 核实,需保留署名)。
- 台账无 SHA-256、无结构化 `images/sources.yaml`;`diagrams/` 下 24 张自绘 SVG 均有源文件(.d2/.excalidraw)但未建立 manifest,也未纳入台账(自绘图无授权问题,但计划 §12 要求统一登记)。

## 7. CI 能力矩阵

| 能力 | 现状 |
|---|---|
| 本地文件链接检查 | 有脚本,但硬依赖 `rg`,本机不可运行;无测试、无 fixture |
| 标题锚点检查 | 无(596 个锚点链接完全靠人工) |
| 外链检查 | 无 |
| 章节骨架/交付物/图注校验 | 无 |
| Evidence/Data Schema 校验 | 无(schema、claims、sources 均不存在) |
| 生成物漂移检查 | 无(附录非生成文件) |
| Mermaid 语法/渲染检查 | 无 |
| workflow 权限 | **未设置 `permissions`**(默认权限过宽) |
| Action 固定方式 | 浮动 tag(`actions/checkout@v4`、`actions/setup-node@v4`),未固定 commit SHA |
| Node 版本 | 22(与计划一致) |
| package.json / lockfile | 不存在 |

## 8. 治理文件盘点

**全部缺失**:LICENSE / LICENSE-CONTENT / LICENSE-CODE、CITATION.cff、CHANGELOG.md、SECURITY.md、MAINTAINERS.md、CODE_OF_CONDUCT.md、.github/CODEOWNERS、Issue/PR 模板、book-manifest.yaml。

**已存在**:README.md、CONTRIBUTING.md(已含口径与一手来源要求)、ERRATA.md(含一条真实勘误与附录更新要求)、images/SOURCES.md。

## 9. 高风险文件

1. `scripts/check-doc-links.mjs` —— 在无 `rg` 环境直接崩溃,当前保护作用可能为零(取决于 CI 环境)。
2. `附录/附录A-*.md`、`附录/附录C-*.md` —— 高时效手工数据,无逐项来源,任何人可改且无门禁。
3. `images/` 5 张待确认论文图 —— 发布阻塞项。
4. `.github/workflows/docs.yml` —— 无 permissions、浮动 tag。
5. 第 27–31 章 —— 首批强制范围,55 个含数字段落待分类。

## 10. 建议迁移顺序

按计划 §19.1 原序执行即可,基线未发现需要调整依赖的情况。两点补充:

1. Group 1 修复 `rg` 硬依赖时,本仓库 45 个文件规模用 Node 原生 `fs` 遍历即可,无需可选加速路径。
2. Group 4 附录数据化时注意:附录 A 的 75 行中含「负载适配倾向」等**作者判断列**,抽取 schema 时需按计划 §10.3 区分事实字段与判断字段。

## 11. 本轮执行的命令清单

```bash
git rev-parse HEAD && git branch --show-current && git remote -v && git status --short
node scripts/check-doc-links.mjs        # 失败:spawnSync rg ENOENT
which rg                                 # 不存在
python3 (统计脚本:md/图片/mermaid/外链/锚点/表格计数;第27–31章数字段落计数)
grep -c 'http|来源|出处' 附录A/附录C;grep -c '待确认' images/SOURCES.md
ls 治理文件清单;grep .github/workflows/docs.yml
```

## 12. Group 0 任务勾选状态

- [x] 0.1 HEAD/分支/远端/状态已记录
- [x] 0.2 工作树干净确认(无用户未提交修改)
- [x] 0.3 现有检查已运行,真实结果=执行失败(rg 缺失),已如实记录
- [x] 0.4 全库统计完成
- [x] 0.5 第 27–31 章数字段落统计完成(启发式,非确定事实)
- [x] 0.6 问题场景初判分类完成(五章均合成)
- [x] 0.7 附录 A 来源覆盖盘点完成(≈1%)
- [x] 0.8 附录 C 来源覆盖盘点完成(0%)
- [x] 0.9 图片台账盘点完成(5 待确认 / 1 可发布)
- [x] 0.10 治理文件盘点完成(全部缺失)
- [x] 0.11 Actions 审计完成(无 permissions、浮动 tag、Node 22)
- [x] 0.12 本报告即产物
- [x] 0.13 未修改任何任务结论;启发式统计已标注为非确定事实
