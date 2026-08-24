# 安全政策

本仓库是文档与配套工具项目,安全关注面:

1. **恶意/失效外链**:正文链接指向钓鱼或被接管域名 —— 通过 GitHub 私有安全通告(Security Advisories)或 issue 报告;nightly 外链检查覆盖存活性但不覆盖内容安全。
2. **依赖供应链**:npm 依赖精确锁定(package-lock.json),GitHub Actions 固定 commit SHA;升级依赖的 PR 须说明用途与来源。
3. **脚本安全**:scripts/ 下工具只读仓库内容与访问公开网络(kroki、arXiv 等);发现越权行为(写系统路径、外传数据)按漏洞报告。

报告渠道:GitHub Security Advisories(首选)或仓库 issue(不含敏感细节时)。
