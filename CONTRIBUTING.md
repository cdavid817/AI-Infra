# 贡献指南

## 修改原则

- 正文优先修订稳定的机制和判断方法；具体型号、版本、价格和项目状态应放在附录或勘误页，并标注日期。
- 任何可量化结论都要写清口径、适用边界和可公开核验的一手来源。性能数字还应给出模型、精度、长度分布、并发、硬件和测量日期。
- 遵循「证据即代码」:来源登记在 `references/sources.yaml`,可核验结论按章登记在 `references/claims/chapter-NN.yaml`,来源分级与 Claim 类型见 [references/source-policy.md](references/source-policy.md)。第 27–31 章与附录 A/C 为强制范围,提交前运行 `npm run docs:check:evidence`。
- 每章「问题场景」必须按 [templates/case-metadata.md](templates/case-metadata.md) 标注案例四分类(公开真实 / 作者实测 / 合成 / 容量估算)。无法核验的内容降级为合成案例或估算示例,不得反向编造来源。
- 使用 AI 辅助写作时,证据责任仍由提交者承担:AI 生成的数字、案例与来源必须逐条人工核验后才能登记。
- 新增或替换图片前，先登记到 [images/SOURCES.md](images/SOURCES.md)。未经确认授权的图片只能标为草稿，不能用于正式发布。
- Mermaid 图的跨层、跨子图及数据/控制流边必须有标签；图注应写出读者需要记住的结论。

## 提交前检查

首次或依赖变更后先安装(需要 Node 22+):

```bash
npm ci
```

然后运行:

```bash
npm run test:docs-tools        # 文档工具链自身的单元测试
npm run docs:check:local-links # 检查全书 Markdown 的本地文件链接
```

链接检查基于 Markdown AST(unified/remark)解析,正确处理中文文件名、URL 编码、代码块与带 title 的链接,不依赖任何外部命令。`node scripts/check-doc-links.mjs` 仍可作为兼容入口直接运行。锚点、外部链接和 Mermaid 的语义正确性目前仍需人工复核(后续由专项检查覆盖)。

## 勘误提交格式

请提供受影响的文件和小节、原文、修订建议、来源链接、访问日期，以及适用的版本/测量条件。高时效内容同时更新 [ERRATA.md](ERRATA.md)。
