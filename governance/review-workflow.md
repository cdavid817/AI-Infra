# 技术审阅与目标读者审阅

内容质量走双轨审阅,两轨独立记录状态。自动检查(链接、结构、Schema、prose 审计)只能提示潜在问题,不能替代人工审阅。

## 双轨检查清单

**技术审阅**关注:

- 技术结论与术语是否准确;版本与适用范围是否明确
- 架构权衡是否完整;数字、公式、单位是否正确
- 故障处置路径与恢复动作是否安全
- Claim 与来源登记是否匹配

**目标读者审阅**(平台建设方 / 方案与选型方视角)关注:

- 前置知识是否充分、阅读顺序是否自然
- 缩写与术语首次出现是否解释
- 示例能否支撑读者完成实际任务
- 图表是否帮助理解或决策;结论是否可转化为行动

## 状态机

```text
pending → in-review → changes-requested → approved
                ↖________________________↙
```

- `pending`:尚未开始审阅(所有内容的初始值,**不得默认为 approved**)
- `in-review`:审阅进行中
- `changes-requested`:审阅者提出修改要求
- `approved`:该轨审阅通过

## 记录位置

审阅状态登记在 [book-manifest.yaml](../book-manifest.yaml) 的 `governance.review` 段(状态模型)与各内容条目的 `review` 字段,结构:

```yaml
review:
  technical: pending      # 或 {status: approved, reviewer: <github-handle>, reviewed_at: YYYY-MM-DD}
  readability: pending
```

## 合并与发布要求

- 结构调整需至少一名维护者审阅。
- 高风险技术结论(见 [evidence-policy.md](evidence-policy.md))需对应领域技术审阅通过。
- 章节标记 Stable 前,两轨均须 `approved`;Release Candidate 阶段允许存在 `pending`,但发布说明必须列出已知限制。
