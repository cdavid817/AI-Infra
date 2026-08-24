#!/usr/bin/env node
// 从 data/ 生成附录 A/C。生成文件带 AUTO-GENERATED 头,不得手工编辑。
import { writeFileSync } from 'node:fs';
import { GENERATED_TARGETS } from './lib/generate-appendices.mjs';

for (const t of GENERATED_TARGETS) {
  writeFileSync(t.path, t.generate(process.cwd()));
  console.log(`已生成 ${t.path}`);
}
