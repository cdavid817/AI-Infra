#!/usr/bin/env node
import { checkAnchors } from './lib/check-anchors.mjs';
import { report } from './lib/diagnostics.mjs';

const { diagnostics, fileCount } = checkAnchors(process.cwd());
report(diagnostics, { okMessage: `已检查 ${fileCount} 个 Markdown 文件:站内锚点均有效。` });
