#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { findMarkdownFiles } from './lib/files.mjs';
import { extractHeadingSlugs, parseMarkdown } from './lib/markdown.mjs';

const PHRASES = ['本质上', '真正的', '这就是为什么', '换句话说', '值得注意的是', '没有银弹', '唯一正确答案', '第一公民', '所以这对做平台的人意味着什么'];
const ABSOLUTES = ['彻底失效', '彻底解决', '必然', '唯一', '永远', '绝不'];

function count(text, needle) {
  return text.split(needle).length - 1;
}

export function analyzeProse(text, file = '') {
  const body = text.replace(/```[\s\S]*?```/g, '').replace(/<!--([\s\S]*?)-->/g, '');
  const headings = extractHeadingSlugs(parseMarkdown(text)).filter((h) => h.depth === 2).map((h) => h.text);
  const boldChars = [...body.matchAll(/\*\*([^*]+)\*\*/g)].reduce((n, m) => n + m[1].length, 0);
  const visibleChars = body.replace(/\s/g, '').length || 1;
  const phraseCounts = Object.fromEntries(PHRASES.map((p) => [p, count(body, p)]));
  const absoluteCounts = Object.fromEntries(ABSOLUTES.map((p) => [p, count(body, p)]));
  const paragraphs = body.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, '').length).filter((n) => n > 20);
  let similarRuns = 0;
  for (let i = 2; i < paragraphs.length; i++) {
    const trio = paragraphs.slice(i - 2, i + 1);
    if (Math.max(...trio) / Math.max(1, Math.min(...trio)) < 1.2) similarRuns++;
  }
  const numericCaseSignals = [...body.matchAll(/(?:某公司|某客户|某团队|负责人|生产环境)[^\n]{0,160}(?:\d+(?:\.\d+)?\s*(?:张|卡|节点|QPS|ms|秒|小时|GB|TB|%))/g)].length;
  return {
    file,
    headings,
    phrase_counts: phraseCounts,
    absolute_counts: absoluteCounts,
    bold_ratio: Number((boldChars / visibleChars).toFixed(4)),
    similar_paragraph_runs: similarRuns,
    numeric_case_signals: numericCaseSignals,
    has_case_metadata: /<CaseMeta\b|案例元数据/.test(text),
  };
}

function renderMarkdown(chapters) {
  const totalPhrases = Object.fromEntries(PHRASES.map((p) => [p, chapters.reduce((n, c) => n + c.phrase_counts[p], 0)]));
  const headingSequences = new Map();
  for (const c of chapters) {
    const key = c.headings.map((h) => h.replace(/^\d+(?:\.\d+)*\s*/, '')).join(' → ');
    headingSequences.set(key, [...(headingSequences.get(key) ?? []), c.file]);
  }
  const repeated = [...headingSequences.entries()].filter(([, files]) => files.length >= 2).sort((a, b) => b[1].length - a[1].length);
  const out = [
    '# 正文风格基线', '',
    '> 此报告用于发现编辑风险，不作为事实判断，也不阻断 CI。', '',
    `扫描章节：${chapters.length}；生成命令：\`npm run docs:audit:prose\`。`, '',
    '## 高频句型', '', '| 句型 | 次数 |', '|---|---:|',
    ...Object.entries(totalPhrases).map(([p, n]) => `| ${p} | ${n} |`), '',
    '## 重复的二级标题序列', '',
    ...(repeated.length ? repeated.map(([seq, files]) => `- ${files.length} 章：${seq || '（无二级标题）'}`) : ['- 未发现完全相同的二级标题序列。']), '',
    '## 逐章风险画像', '',
    '| 章节 | 粗体占比 | 相似段落三连 | 数字化案例信号 | 缺案例元数据 |', '|---|---:|---:|---:|---|',
    ...chapters.map((c) => `| ${c.file} | ${(c.bold_ratio * 100).toFixed(2)}% | ${c.similar_paragraph_runs} | ${c.numeric_case_signals} | ${c.numeric_case_signals && !c.has_case_metadata ? '是' : '否'} |`), '',
    '## 使用方式', '',
    '- 句型计数只提示跨章节奏重复，不要求机械替换。',
    '- 数字化案例信号需要人工确认；公式、公开事实和普通容量表可能误报。',
    '- 首轮阈值以本报告为基线，风格项保持 warning。',
  ];
  return out.join('\n') + '\n';
}

export function runProseAudit(rootDir = process.cwd()) {
  const files = findMarkdownFiles(rootDir).filter((f) => /第\d{2}章-/.test(f));
  const chapters = files.map((file) => analyzeProse(readFileSync(file, 'utf8'), relative(rootDir, file)));
  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/prose-style-audit.json', JSON.stringify({ version: 1, chapters }, null, 2) + '\n');
  writeFileSync('reports/prose-style-audit.md', renderMarkdown(chapters).replace('# 正文风格基线', '# 正文风格审计'));
  if (!existsSync('reports/prose-style-baseline.md')) writeFileSync('reports/prose-style-baseline.md', renderMarkdown(chapters));
  return chapters;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const chapters = runProseAudit();
  console.log(`正文风格审计已更新：${chapters.length} 章（warning 模式，基线文件不覆盖）。`);
}
