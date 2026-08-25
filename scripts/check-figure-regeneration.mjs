#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parse as parseYaml } from 'yaml';
import { report } from './lib/diagnostics.mjs';

const doc = parseYaml(readFileSync('visuals/manifest.yaml', 'utf8'));
const generated = (doc.figures ?? []).filter((f) => f.source_kind.startsWith('generated-'));
const before = new Map(generated.map((f) => [f.output_file, readFileSync(f.output_file)]));
const run = spawnSync(process.execPath, ['visuals/scripts/build-pilot-figures.mjs'], { encoding: 'utf8' });
const diagnostics = [];
if (run.status !== 0) diagnostics.push({ file: 'visuals/scripts/build-pilot-figures.mjs', line: 0, rule: 'figure-regeneration', message: run.stderr || `生成脚本退出码 ${run.status}` });
for (const figure of generated) {
  const after = readFileSync(figure.output_file);
  if (!after.equals(before.get(figure.output_file))) diagnostics.push({ file: figure.output_file, line: 0, rule: 'figure-drift', message: '重新生成后与已提交产物不一致' });
}
report(diagnostics, { okMessage: `视觉再生成检查通过:${generated.length} 张 SVG 可离线重建且无漂移。` });
