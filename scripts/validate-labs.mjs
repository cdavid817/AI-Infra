#!/usr/bin/env node
// Lab 元数据校验:labs/**/lab.yaml 按 references/schemas/lab.schema.json 校验,
// 并检查启用路径的 entrypoint 文件存在。planned 路径不得携带 last_verified(防止虚标已验证)。
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import Ajv from 'ajv';
import { report } from './lib/diagnostics.mjs';

const rootDir = process.cwd();
const schema = JSON.parse(readFileSync('references/schemas/lab.schema.json', 'utf8'));
const validate = new Ajv({ allErrors: true }).compile(schema);

const labFiles = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name === 'lab.yaml') labFiles.push(full);
  }
};
walk(join(rootDir, 'labs'));
labFiles.sort();

const diagnostics = [];
for (const file of labFiles) {
  const rel = relative(rootDir, file);
  const err = (message) => diagnostics.push({ file: rel, line: 0, rule: 'lab-schema', message });
  let doc;
  try {
    doc = parseYaml(readFileSync(file, 'utf8'));
  } catch (e) {
    err(`YAML 解析失败: ${e.message}`);
    continue;
  }
  if (!validate(doc)) {
    for (const e of validate.errors) err(`${e.instancePath || '/'} ${e.message}`);
    continue;
  }
  for (const [name, path] of Object.entries(doc.paths)) {
    if (path.status !== 'planned' && path.entrypoint) {
      const target = resolve(dirname(file), path.entrypoint);
      if (!existsSync(target)) err(`paths.${name}.entrypoint 不存在: ${path.entrypoint}`);
    }
  }
}

report(diagnostics, { okMessage: `lab 元数据检查通过:${labFiles.length} 个 lab.yaml 符合 Schema,entrypoint 均存在。` });
