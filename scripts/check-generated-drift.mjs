#!/usr/bin/env node
// 生成物漂移检查:重新生成与磁盘文件比对,不一致即失败(说明有人手改了生成文件或忘了重新生成)。
import { readFileSync } from 'node:fs';
import { GENERATED_TARGETS } from './lib/generate-appendices.mjs';
import { report } from './lib/diagnostics.mjs';

const diagnostics = [];
for (const t of GENERATED_TARGETS) {
  const expected = t.generate(process.cwd());
  const actual = readFileSync(t.path, 'utf8');
  if (expected !== actual) {
    const eLines = expected.split('\n');
    const aLines = actual.split('\n');
    let line = 1;
    while (line <= Math.min(eLines.length, aLines.length) && eLines[line - 1] === aLines[line - 1]) line++;
    diagnostics.push({
      file: t.path,
      line,
      rule: 'generated-drift',
      message: '与数据文件重新生成的结果不一致;请勿手改生成文件,修改 data/ 后运行 npm run docs:generate',
    });
  }
}
report(diagnostics, { okMessage: `生成物漂移检查通过:${GENERATED_TARGETS.length} 个生成文件与数据源一致。` });
