#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { findMarkdownFiles } from './lib/files.mjs';
import { report } from './lib/diagnostics.mjs';

const TYPES = new Set(['architecture', 'topology', 'sequence', 'state', 'timeline', 'quantitative-chart', 'waterfall', 'heatmap', 'comparison', 'diagnostic', 'worksheet', 'decision-matrix']);
const PURPOSES = new Set(['orientation', 'derivation', 'comparison', 'diagnosis', 'decision', 'evidence']);
const STATUSES = new Set(['planned', 'draft', 'reviewed', 'published', 'deprecated']);

export function validateVisualManifest(doc, { fileExists = existsSync, chapterTexts = [] } = {}) {
  const diagnostics = [];
  const err = (message, file = 'visuals/manifest.yaml') => diagnostics.push({ file, line: 0, rule: 'visual-manifest', message });
  if (doc?.version !== 1) err('version 必须为 1');
  const seen = new Set();
  for (const figure of doc?.figures ?? []) {
    if (!figure.id || seen.has(figure.id)) err(`图片 id 缺失或重复: ${figure.id ?? '(空)'}`);
    seen.add(figure.id);
    if (!Number.isInteger(figure.chapter) || figure.chapter < 1 || figure.chapter > 31) err(`${figure.id}: chapter 必须在 1–31`);
    if (!TYPES.has(figure.type)) err(`${figure.id}: 未知 type ${figure.type}`);
    if (!PURPOSES.has(figure.purpose)) err(`${figure.id}: 未知 purpose ${figure.purpose}`);
    if (!STATUSES.has(figure.status)) err(`${figure.id}: 未知 status ${figure.status}`);
    for (const key of ['title', 'source_kind', 'source_file', 'output_file', 'license', 'alt', 'caption']) {
      if (!String(figure[key] ?? '').trim()) err(`${figure.id}: 缺少 ${key}`);
    }
    for (const path of [figure.source_file, figure.output_file, ...(figure.data_files ?? [])].filter(Boolean)) {
      if (!fileExists(path)) err(`${figure.id}: 文件不存在 ${path}`);
    }
    if (figure.status === 'published' && !chapterTexts.some(({ text }) => text.includes(`id="${figure.id}"`))) err(`${figure.id}: 状态为 published 但正文未通过 BookFigure 引用`);
  }
  for (const { file, text } of chapterTexts) {
    for (const match of text.matchAll(/<BookFigure\b[\s\S]*?\/>/g)) {
      const id = match[0].match(/\bid="([^"]+)"/)?.[1];
      const src = match[0].match(/\bsrc="([^"]+)"/)?.[1] ?? '';
      if (!id) err('BookFigure 缺少 id', file);
      else if (!seen.has(id)) err(`BookFigure 未登记: ${id}`, file);
      if (!/\balt="[^"]+"/.test(match[0])) err(`BookFigure ${id ?? ''} 缺少 alt`, file);
      if (!/\bcaption="[^"]+"/.test(match[0])) err(`BookFigure ${id ?? ''} 缺少 caption`, file);
      if (src.includes('/visuals/') && ![...(doc?.figures ?? [])].some((f) => f.id === id && src.endsWith(f.output_file.replace(/^visuals\//, '')))) err(`BookFigure ${id ?? ''} 的 src 与 manifest output_file 不一致`, file);
    }
  }
  return diagnostics;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const doc = parseYaml(readFileSync('visuals/manifest.yaml', 'utf8'));
  const chapterTexts = findMarkdownFiles(process.cwd()).filter((f) => /第\d{2}章-/.test(f)).map((file) => ({ file: relative(process.cwd(), file), text: readFileSync(file, 'utf8') }));
  report(validateVisualManifest(doc, { chapterTexts }), { okMessage: `视觉 manifest 检查通过:${doc.figures?.length ?? 0} 张新图,文件与正文引用一致。` });
}
