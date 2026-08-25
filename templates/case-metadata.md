# 案例元数据模板

包含具体组织、规模、时间、性能或成本数字的案例使用 `<CaseMeta>` 声明数据性质。六种类型如下:

- `public-case`:公开论文、博客、演讲、事故报告或官方材料;
- `field-case`:作者或贡献者参与的匿名真实项目;
- `reproduced-test`:可按仓库脚本或步骤复现实测;
- `capacity-example`:用于演示公式的容量估算;
- `synthetic-case`:为解释机制构造的合成案例;
- `composite-case`:多个真实场景合并,不代表单一客户。

```md
<CaseMeta
  type="capacity-example"
  data-nature="由公式和假设推导,不代表生产实测"
  scope="32 节点训练集群"
  assumptions="节点故障相互独立;故障率使用给定输入"
  reproducible="calculators/failure-risk.py"
/>
```

规则:

- `public-case` 必须有来源(`CLM` 指向含 L1/L2 来源的 claim)。
- `field-case` 必须说明匿名与脱敏范围。
- `reproduced-test` 必须有复现路径(`labs/...`)。
- `synthetic-case` 和 `composite-case` 必须明确不代表单一生产事故。
- `capacity-example` 必须列出输入、公式、假设和误差来源。
