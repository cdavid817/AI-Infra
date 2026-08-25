# Release Notes 草稿:v0.2.0(release candidate)

> 状态:草稿,发布需 Owner 显式授权(计划 12.14)。

## 这一版是什么

《AI Infra》从"内容完整的书稿"(v0.1.0)升级为**有来源、可审查、可复算、可生成、可测试的工程知识库**:31 章 + 6 附录 + 8 个前沿主题增量,全部经过证据登记与 CI 门禁。

## 亮点

- **八个前沿主题**(每个先建 Research Pack、来源实抓核验):DRA、JobSet/MultiKueue、InferencePool/EPP 推理路由、OTel GenAI、SCI 能源碳账、Agentic RL、MCP 与 Agent Runtime 2.0、模型供应链可信平面。
- **证据体系**:21 条一手来源(全部含访问日期与复核期)、78 条 claim(verified/estimate/illustrative/unverified 分级,示意与推断显式披露)。
- **可复算**:七个估算器与正文算例互锁(28 项固定向量);附录 A/C 由结构化数据生成,手改即 CI 失败。
- **可发布**:6 张第三方图片许可全部核验(CC BY/CC BY-SA,署名齐备);内容 CC BY 4.0、代码 MIT。

## 发布门禁核验(§18.2)

| 门禁 | 状态 |
|---|---|
| 首批范围(27–31 章)案例分类与关键数字 claim | ✅ 全部完成 |
| 附录 A/C 生成与 freshness | ✅ 零漂移、零过期 |
| 图片授权 | ✅ release 模式通过,无待确认项 |
| 许可证范围 | ✅ 双许可证落地 |
| 网站/计算器/全套 CI | ✅(干净 checkout 复验记录见集成报告) |
| **已知缺口** | 第 1–26 章问题场景尚未按四分类标注元数据(首批强制范围仅 27–31);全书数据项多为 unverified 待逐项补一手来源——两项均如实标注,不伪装,建议作为 v0.3 主线 |

## 升级说明

- 附录 A/C 更新入口已迁至 `data/`(直接改 Markdown 会被 CI 拒绝)。
- 新增/大改章节须走 Research Pack 流程(ai-infra-book-prompts.md v3)。
