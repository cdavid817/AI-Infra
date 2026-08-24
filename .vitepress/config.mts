import { readFileSync } from 'node:fs'
import { parse as parseYaml } from 'yaml'
import { withMermaid } from 'vitepress-plugin-mermaid'
import mathjax3 from 'markdown-it-mathjax3'

const manifest = parseYaml(readFileSync('book-manifest.yaml', 'utf8'))
const version = parseYaml(readFileSync('book-version.yaml', 'utf8'))

const toLink = (p: string) => '/' + p.replace(/\.md$/, '')
const chapterItems = manifest.parts.map((part: any) => ({
  text: part.title,
  collapsed: true,
  items: part.chapters.map((ch: any) => ({
    text: `第 ${ch.number} 章 ${ch.path.split('/').pop().replace(/^第\d+章-/, '').replace(/\.md$/, '')}`,
    link: toLink(ch.path),
  })),
}))
const appendixItems = {
  text: '附录',
  collapsed: true,
  items: manifest.appendices.map((a: any) => ({
    text: a.path.split('/').pop().replace(/\.md$/, ''),
    link: toLink(a.path),
  })),
}

export default withMermaid({
  title: manifest.book.title,
  description: '面向平台建设方的中文 AI 基础设施书稿',
  lang: manifest.book.language,
  base: '/AI-Infra/',
  vue: { template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('mjx-') } } },
  srcDir: '.',
  srcExclude: [
    'node_modules/**', 'scripts/**', 'references/**', 'reports/**', 'plans/**',
    'templates/**', 'data/**', 'images/SOURCES.md', 'AGENTS.md', 'CODE_OF_CONDUCT.md',
    'SECURITY.md', 'MAINTAINERS.md',
  ],
  ignoreDeadLinks: true, // 站内链接有效性由 CI 的 AST 检查强制(见 ADR-001)
  markdown: {
    config(md) {
      md.use(mathjax3)
      // Claim 注释 → 可见角标(计划 8.8 最小实现)
      const claimRe = /<!--\s*claim:\s*(CLM-(\d{3})-\d{3})[^>]*-->/g
      for (const rule of ['html_block', 'html_inline']) {
        const prev = md.renderer.rules[rule]
        md.renderer.rules[rule] = (tokens, idx, opts, env, self) => {
          const content = tokens[idx].content
          if (claimRe.test(content)) {
            return content.replace(claimRe, (_m, id, ch) =>
              `<sup class="claim-ref"><a href="https://github.com/cdavid817/AI-Infra/blob/main/references/claims/chapter-${ch}.yaml" target="_blank" title="可核验结论登记:${id}">[${id}]</a></sup>`)
          }
          return prev ? prev(tokens, idx, opts, env, self) : content
        }
      }
    },
  },
  themeConfig: {
    nav: [
      { text: '目录', link: '/README' },
      { text: '勘误', link: '/ERRATA' },
      { text: `v${version.version} · 数据快照 ${version.data_snapshot}`, link: '/CHANGELOG' },
    ],
    sidebar: [...chapterItems, appendixItems,
      { text: '关于', items: [
        { text: '目录与阅读路径', link: '/README' },
        { text: '勘误与更新', link: '/ERRATA' },
        { text: '贡献指南', link: '/CONTRIBUTING' },
        { text: '变更日志', link: '/CHANGELOG' },
      ] },
    ],
    outline: { level: [2, 3], label: '本章目录' },
    docFooter: { prev: '上一节', next: '下一节' },
    search: {
      provider: 'local',
      options: {
        miniSearch: {
          options: {
            // CJK:按单字切分建立索引,保证中文可搜(见 ADR-001)
            tokenize: (text: string) => text.split(/[\s\-_,.;:!?()\[\]{}'"、,。;:!?()【】《》]+/)
              .flatMap((w) => (/[一-鿿]/.test(w) ? Array.from(w) : [w])).filter(Boolean),
          },
          searchOptions: {
            tokenize: (text: string) => text.split(/\s+/)
              .flatMap((w) => (/[一-鿿]/.test(w) ? Array.from(w) : [w])).filter(Boolean),
          },
        },
      },
    },
    footer: {
      message: `内容 CC BY 4.0 · 代码 MIT · v${version.version}(${version.stage})`,
      copyright: `数据快照 ${version.data_snapshot},过期项见 nightly freshness 报告 · © 2026 cdavid817`,
    },
  },
  mermaid: {},
})
