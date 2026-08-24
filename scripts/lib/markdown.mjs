import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import GithubSlugger from 'github-slugger';

const processor = unified().use(remarkParse).use(remarkGfm);

/** 解析 Markdown 文本为 mdast 语法树。 */
export function parseMarkdown(text) {
  return processor.parse(text);
}

/** 深度优先遍历 mdast 节点。 */
export function visit(node, callback) {
  callback(node);
  if (node.children) {
    for (const child of node.children) visit(child, callback);
  }
}

/**
 * 提取全部链接目标:inline 链接/图片、引用式定义。
 * 返回 { url, line, column, kind }。基于 AST,天然正确处理
 * 转义、行内代码、代码块(其中的伪链接不会被提取)与带 title 的链接。
 */
export function extractLinkTargets(ast) {
  const targets = [];
  visit(ast, (node) => {
    if (node.type === 'link' || node.type === 'image' || node.type === 'definition') {
      targets.push({
        url: node.url ?? '',
        line: node.position?.start.line ?? 0,
        column: node.position?.start.column ?? 0,
        kind: node.type,
      });
    }
  });
  return targets;
}

/**
 * 提取标题并按 GitHub 规则计算锚点 slug。
 * 重复标题按 GitHub 行为追加 -1、-2 后缀(由 github-slugger 处理)。
 */
export function extractHeadingSlugs(ast) {
  const slugger = new GithubSlugger();
  const headings = [];
  visit(ast, (node) => {
    if (node.type !== 'heading') return;
    let text = '';
    visit(node, (child) => {
      if (child.type === 'text' || child.type === 'inlineCode') text += child.value;
    });
    headings.push({
      depth: node.depth,
      text,
      slug: slugger.slug(text),
      line: node.position?.start.line ?? 0,
    });
  });
  return headings;
}

/** 判断链接是否属于本地文件目标(需要做存在性检查)。 */
export function isLocalFileTarget(url) {
  if (!url) return false;
  return !/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(url);
}

/** 拆分本地链接为 { filePart, anchor },并解码 URL 编码。 */
export function splitLocalTarget(url) {
  const hashIndex = url.indexOf('#');
  const rawPath = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const anchor = hashIndex === -1 ? null : url.slice(hashIndex + 1);
  let filePart;
  try {
    filePart = decodeURIComponent(rawPath);
  } catch {
    filePart = rawPath;
  }
  return { filePart, anchor };
}
