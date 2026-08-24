# ADR-001:静态站点生成器选型

- 状态:已采纳(2026-08-24)
- 决策:**VitePress**(1.6.x)

## 备选与理由

| 候选 | 评估 |
|---|---|
| **VitePress(选定)** | Node 单一工具链(与现有 docs 工具一致,无需引入 Python);`srcDir` 可指向仓库根,**正文零搬迁、零复制**(满足计划 8.2/14.2);sidebar/nav 可在 config 中由 book-manifest.yaml 程序化生成;本地搜索(minisearch)可配 CJK 分词;mermaid 经 vitepress-plugin-mermaid 构建期打包;数学公式经 markdown-it-mathjax3;上一/下一章由 sidebar 顺序自动提供 |
| MkDocs Material | 中文搜索最佳,但 docs_dir 不允许包含配置文件,指向仓库根需搬迁或符号链接正文,违反"不搬迁、不复制"约束;且引入 Python 第二工具链 |

## 取舍记录

- `ignoreDeadLinks: true`:站内链接有效性已由自研 AST 检查(local-links + anchors)在 CI 强制,不重复用 VitePress 的宽松检查;站点范围外的仓库文件链接(如 scripts/)在站上呈现为 GitHub 相对路径,属可接受降级。
- Claim 标记(HTML 注释)经 markdown-it 规则转为可见角标,链接到 GitHub 上的对应 claims 文件——满足计划 8.8 的"侧栏或脚注"最小实现。
- 数据 freshness 与版本提示放页脚(来自 book-version.yaml),满足 8.9/14.2 的最小要求;逐表格徽标留待后续。
- PDF/EPUB(8.12–8.14)属 P2,本轮不做。
