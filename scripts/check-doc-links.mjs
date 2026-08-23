import { existsSync, readFileSync } from 'node:fs';
import { dirname, normalize, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const files = execFileSync('rg', ['--files', '-g', '*.md'], { encoding: 'utf8' })
  .trim()
  .split('\n')
  .filter(Boolean);
const pattern = /!?\[[^\]]*\]\(([^\s)]+)(?:\s+['"][^)]*['"])?\)/g;
const failures = [];

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(pattern)) {
    const target = match[1];
    if (/^(?:https?:|mailto:|#)/.test(target)) continue;
    const pathPart = decodeURIComponent(target.split('#', 1)[0]);
    if (!pathPart) continue;
    const destination = normalize(resolve(dirname(file), pathPart));
    if (!existsSync(destination)) failures.push(`${file} -> ${target}`);
  }
}

if (failures.length) {
  console.error(`发现 ${failures.length} 个无效的本地 Markdown 链接：`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`已检查 ${files.length} 个 Markdown 文件：本地链接均有效。`);
}
