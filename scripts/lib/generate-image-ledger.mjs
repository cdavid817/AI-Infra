import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

export function generateImageLedger(rootDir) {
  const doc = parseYaml(readFileSync(join(rootDir, 'images/sources.yaml'), 'utf8'));
  const out = [];
  out.push('<!-- AUTO-GENERATED. DO NOT EDIT DIRECTLY. -->');
  out.push('<!-- Source: images/sources.yaml ; Generator: scripts/generate-appendices.mjs -->');
  out.push('');
  out.push('# 图片来源与授权台账');
  out.push('');
  out.push('本台账由 `images/sources.yaml` 生成(含 SHA-256 防替换校验)。`approved` 表示许可证已核验、可正式发布(需保留署名);`draft_only` 仅可用于草稿审阅;正式 Release 遇到非 approved 项即失败。');
  out.push('');
  out.push('| 文件 | 使用位置 | 原始来源 | 原始图号 | 许可证(核验日期) | 发布状态 |');
  out.push('|---|---|---|---|---|---|');
  for (const img of doc.images) {
    const used = img.used_in.map((u) => u.match(/第(\d+)章/)?.[0] ?? u).join('、');
    const lic = `${img.license.name}(${img.license.verified_at})${img.license.share_alike ? ',SA' : ''}`;
    out.push(`| \`${img.file}\` | ${used} | ${img.origin.author}, *${img.origin.title}*(${img.origin.source_url}) | ${img.origin.original_figure} | ${lic} | ${img.publish_status === 'approved' ? '可发布(需署名)' : img.publish_status} |`);
  }
  out.push('');
  out.push('注:自绘图(`diagrams/` 下 SVG)不属第三方授权范围,其源文件与产物对应关系见 `diagrams/manifest.yaml`。');
  out.push('');
  return out.join('\n');
}
