# 来源政策

本书所有事实、数字与案例遵循「证据即代码」:来源登记在 `references/sources.yaml`,可核验结论按章登记在 `references/claims/chapter-NN.yaml`,由 `npm run docs:check:evidence` 校验。

## 来源分级

| 级别 | 类型 | 可用于何种结论 |
|---|---|---|
| L1 | 标准规范、厂商规格页、官方文档、官方 Release、正式论文 | 默认首选;事实、参数、兼容性与机制 |
| L2 | 官方工程博客、官方事故报告、项目维护者说明 | 实践判断;必须标明时间和上下文 |
| L3 | 作者实测 | 实测结论;必须提供环境口径和复现资产 |
| L4 | 二手技术文章、社区讨论 | 只能作为线索或补充观点,不能单独支撑关键数字 |
| L5 | 合成案例、估算示例 | 只能说明方法;必须明确标记,不能作为现实统计证据 |

**禁止**把搜索摘要、AI 回答、未核验转载或营销二次解读登记为 L1。

## Claim 类型

`quantitative`(数值/比例/带宽/延迟/成本)、`compatibility`(兼容性)、`project_status`(项目状态)、`mechanism`(机制与因果)、`recommendation`(选型立场)、`incident`(公开事故)、`measurement`(实测结果)、`estimate`(公式推导估算)、`illustrative`(讲解用示意数字)。

## 硬规则

1. `id` 永久稳定;URL 变化时更新记录,不新建语义重复来源。
2. 每条来源必须有 `accessed_at`;高时效来源应设 `review_after_days`。
3. `measurement` 缺任一关键口径字段(模型、精度、长度分布、并发、硬件、软件版本、样本数、指标定义)不得标 `verified`。
4. `illustrative` 只能是 `illustrative_only` 状态,并写明 `disclosure`。
5. `estimate` 必须给出输入、公式、假设与误差来源。
6. `verified` 的 quantitative / compatibility / project_status / incident 类结论至少一个来源。
7. 无法核验的数字不得伪装成真实生产数据;降级为合成案例或估算示例。

## 案例四分类

每章「问题场景」标题后必须有可见元数据块(模板见 `templates/case-metadata.md`):**公开真实案例**(必须有来源)/ **作者实测案例**(必须有复现路径)/ **合成案例**(必须声明人物、日期、数值为示意)/ **容量估算示例**(必须列输入、公式、假设、误差来源)。

## 正文 Claim 标记

```markdown
<!-- claim: CLM-027-001 -->
<!-- claim: CLM-027-002; classification: illustrative -->
```

## 门禁阶段

audit(只报告)→ warn(增量违规警告)→ enforce(硬门禁)。当前 enforce 范围:第 27–31 章、附录 A、附录 C、所有新增高时效内容。
