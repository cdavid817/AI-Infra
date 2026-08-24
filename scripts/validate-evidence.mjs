#!/usr/bin/env node
// 用法:node scripts/validate-evidence.mjs [--mode=audit|enforce]
// audit:只输出报告不置失败退出码;enforce(默认):有 error 即失败。
import { validateEvidence } from './lib/validate-evidence.mjs';

const mode = process.argv.includes('--mode=audit') ? 'audit' : 'enforce';
const { errors, warnings, sourceCount, claimCount } = validateEvidence(process.cwd());

for (const w of warnings) console.warn(`WARN  ${w.file}${w.id ? ` [${w.id}]` : ''} (${w.rule}) ${w.message}`);
for (const e of errors) console.error(`ERROR ${e.file}${e.id ? ` [${e.id}]` : ''} (${e.rule}) ${e.message}`);

console.log(`\n证据检查:${sourceCount} 个来源,${claimCount} 条 claim;${errors.length} 个错误,${warnings.length} 个警告(mode=${mode})`);
if (mode === 'enforce' && errors.length > 0) process.exitCode = 1;
