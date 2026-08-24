import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

const GEN_HEADER = (source) => `<!-- AUTO-GENERATED. DO NOT EDIT DIRECTLY. -->\n<!-- Source: ${source} ; Generator: scripts/generate-appendices.mjs -->\n\n`;

function fmtSnapshot(s) {
  const [y, m] = s.split('-');
  return `${y} 年 ${Number(m)} 月`;
}

const dash = '—';
const approx = (c) => (c === 'approximate' ? '≈' : '');

function fmtBandwidth(bw) {
  if (!bw || bw.value == null) return dash;
  // TB/s 档保留一位小数(2.0 而非 2),与 spec sheet 惯例一致
  const v = bw.unit === 'TB/s' && Number.isInteger(bw.value) ? bw.value.toFixed(1) : bw.value;
  return `${approx(bw.confidence)}${v} ${bw.unit}`;
}

function fmtMemory(m) {
  if (!m.capacity) return dash;
  return m.type ? `${m.capacity} ${m.type}` : m.capacity;
}

function fmtInterconnect(ic) {
  if (!ic || (!ic.name && !ic.note)) return dash;
  const parts = [];
  if (ic.name) parts.push(ic.generation ? `${ic.name} ${ic.generation}` : ic.name);
  const agg = ic.per_device_aggregate;
  if (agg && agg.value != null) parts.push(`${approx(agg.confidence)}${agg.value} ${agg.unit}`);
  if (ic.note) parts.push(ic.note);
  return parts.join(',') || dash;
}

function fmtCompute(device, precision) {
  const c = (device.compute ?? []).find((x) => x.precision === precision);
  if (!c) return dash; // 该表无此列语义时由调用方控制;行内无该精度记录 → —
  if (c.value == null) return c.note ? `${c.note}` : dash;
  if (typeof c.value === 'string') return `${approx(c.confidence)}${c.value}`;
  const unitMap = { TFLOPS: 'TF', PFLOPS: 'PF', TOPS: 'TOPS', POPS: 'POPS' };
  return `${approx(c.confidence)}${c.value} ${unitMap[c.unit] ?? c.unit ?? ''}`.trim();
}

function fmtPower(p) {
  if (!p || p.tdp_w == null) return dash;
  const v = p.tdp_w >= 1000 && p.tdp_w % 100 === 0 && p.confidence === 'approximate'
    ? `≈${p.tdp_w / 1000} kW`
    : `${approx(p.confidence)}${p.tdp_w} W`;
  return v;
}

function deviceTitle(d) {
  const extra = d.form_factor ?? d.availability?.note ?? null;
  return extra ? `${d.model}(${extra})` : d.model;
}

function table(header, rows) {
  const line = (cells) => `| ${cells.join(' | ')} |`;
  return [line(header), line(header.map(() => '---')), ...rows.map(line)].join('\n');
}

export function generateAppendixA(rootDir) {
  const acc = parseYaml(readFileSync(join(rootDir, 'data/accelerators/accelerators.yaml'), 'utf8'));
  const cf = parseYaml(readFileSync(join(rootDir, 'data/cluster-forms/cluster-forms.yaml'), 'utf8'));
  const snap = fmtSnapshot(acc.snapshot_date);
  const by = (cat) => acc.devices.filter((d) => d.category === cat);
  const unverifiedMark = (d) => (d.verification === 'verified' ? '' : '');

  const nvidiaCols = ['FP32', 'TF32', 'BF16/FP16', 'FP8', 'FP4', 'INT8'];
  const intlCols = ['FP32', 'BF16/FP16', 'FP8', 'FP4', 'INT8'];
  const domCols = ['FP32', 'BF16/FP16', 'FP8', 'INT8'];

  const devRow = (d, cols, withTendency = false) => {
    const cells = [
      deviceTitle(d), fmtMemory(d.memory), fmtBandwidth(d.memory.bandwidth), fmtInterconnect(d.interconnect),
      ...cols.map((p) => fmtCompute(d, p)), fmtPower(d.power),
    ];
    if (withTendency) cells.push(d.tendency ? `${d.tendency.label}(${d.tendency.rationale})`.replace('()', '') : dash);
    return cells;
  };

  const out = [];
  out.push(GEN_HEADER('data/accelerators/accelerators.yaml + data/cluster-forms/cluster-forms.yaml'));
  out.push(`# 附录 A 加速卡与集群形态速查表\n`);
  out.push(`> **数据截至 ${snap}。** 本附录承载的是会过时的具体数据,与正文的分工是:正文只教"如何读一张卡的 spec sheet"([§4.2](../第一部分-基础与心智模型/第04章-硬件第一性原理、架构范式与数值精度.md#42-加速器架构范式)),本附录给出可以直接查的数字。使用前请核对[勘误与更新页](../ERRATA.md#附录-a-加速卡与集群形态速查表)及对应的来源与口径记录;**逐项数据的来源与核验状态以 \`data/\` 目录为准,未标注来源的行均为 unverified(待核验)**。\n>`);
  out.push(`> 数字口径说明(先读再查):\n>`);
  acc.intro_notes.forEach((n, i) => out.push(`> ${i + 1}. ${n}`));
  out.push(`\n---\n`);
  out.push(`## A.1 主流加速卡参数对照\n`);
  out.push(`### A.1.1 NVIDIA 系\n`);
  out.push(table(['型号(形态)', '显存', '显存带宽', '卡间互联(双向)', ...nvidiaCols, '典型功耗'],
    by('nvidia').map((d) => devRow(d, nvidiaCols))));
  out.push(`\n### A.1.2 AMD / Intel / Google 系\n`);
  out.push(table(['型号(形态)', '显存', '显存带宽', '卡间互联(双向)', ...intlCols, '典型功耗'],
    by('amd_intel_google').map((d) => devRow(d, intlCols))));
  if (acc.section_notes?.amd_intel_google) out.push(`\n> ${acc.section_notes.amd_intel_google}`);
  out.push(`\n### A.1.3 负载适配倾向标注(按 [§4.2.2](../第一部分-基础与心智模型/第04章-硬件第一性原理、架构范式与数值精度.md#422-训练型与推理型负载的硬件诉求差异) 六维配比)\n`);
  out.push(acc.tendency_notes.join('\n\n'));
  out.push('');
  const tendencyRows = acc.devices
    .filter((d) => d.tendency && ['nvidia', 'amd_intel_google'].includes(d.category))
    .map((d) => [d.tendency.row_label ?? d.model, d.tendency.label, d.tendency.rationale]);
  out.push(table(['型号', '倾向', '依据(六维中的决定项)'], tendencyRows));
  out.push(`\n---\n`);
  out.push(`## A.2 HBM 代际对照\n`);
  out.push(table(['代际', '单堆栈容量(典型)', '单堆栈带宽(典型)', '代表落地卡', '量产时间段'],
    cf.hbm_generations.rows.map((r) => [r.generation, r.stack_capacity, r.stack_bandwidth, r.example_devices, r.production_period])));
  out.push(`\n${cf.capacity_deductions.intro}\n`);
  out.push(table(['扣除项', '典型量级', '说明'], cf.capacity_deductions.rows.map((r) => [r.item, r.magnitude, r.note])));
  out.push(`\n---\n`);
  out.push(`## A.3 超节点形态对照\n`);
  out.push(`${cf.supernodes.intro}\n`);
  out.push(table(['方案', '单域卡数', '域内互联(单卡双向)', '域内拓扑', '域间(scale-out)方案', '备注'],
    cf.supernodes.rows.map((r) => [r.name, r.domain_size, r.intra_domain_bandwidth, r.intra_domain_topology, r.scale_out, r.note])));
  out.push(`\n${cf.supernodes.reading_guide}\n`);
  out.push(`---\n`);
  out.push(`## A.4 功率密度参考值\n`);
  out.push(`${cf.power_density.intro}\n`);
  out.push(table(['对象', '功率参考值', '可行散热方案'], cf.power_density.rows.map((r) => [r.target, r.power_reference, r.cooling])));
  out.push(`\n${cf.power_density.outro}\n`);
  out.push(`---\n`);
  out.push(`## A.5 国产卡速查(单列)\n`);
  if (acc.section_notes?.domestic_intro) out.push(`> ${acc.section_notes.domestic_intro}\n`);
  out.push(table(['型号', '显存', '显存带宽', '卡间互联', ...domCols, '典型功耗', '倾向标注'],
    by('domestic').map((d) => devRow(d, domCols, true))));
  if (acc.section_notes?.domestic_disciplines?.length) {
    out.push(`\n国产卡速查的三条使用纪律(正文结论的重申):\n`);
    acc.section_notes.domestic_disciplines.forEach((x, i) => out.push(`${i + 1}. ${x}`));
  }
  out.push(`\n---\n`);
  out.push(`*本附录数据截至 ${snap}；勘误与更新见[本地勘误页](../ERRATA.md#附录-a-加速卡与集群形态速查表)。数据源:\`data/accelerators/accelerators.yaml\`、\`data/cluster-forms/cluster-forms.yaml\`(更新请改数据文件后运行 \`npm run docs:generate\`)。*\n`);
  return out.join('\n');
}

export function generateAppendixC(rootDir) {
  const fw = parseYaml(readFileSync(join(rootDir, 'data/frameworks/frameworks.yaml'), 'utf8'));
  const snap = fmtSnapshot(fw.snapshot_date);
  const out = [];
  out.push(GEN_HEADER('data/frameworks/frameworks.yaml'));
  out.push(`# 附录 C 框架选型快照\n`);
  out.push(`> **数据截至 ${snap}。** ${fw.intro_notes[0]}\n>`);
  out.push(`> ${fw.intro_notes[1]}\n`);
  out.push(`---\n`);
  out.push(`## C.1 三层框架地图:完整项目清单\n`);
  const projTable = (list) => table(['层', '项目', '定位一句话', '机制剖析章节', '昇腾侧对应'],
    list.map((p) => [p.layer, p.name, p.positioning, p.chapter_ref, p.ascend_counterpart]));
  out.push(`### C.1.1 训练侧\n`);
  out.push(projTable(fw.training));
  out.push(`\n### C.1.2 推理侧\n`);
  out.push(projTable(fw.inference));
  out.push(`\n### C.1.3 配套工具层(不入三层地图,按用途归类)\n`);
  out.push(table(['用途', '项目', '章节', '昇腾侧对应'],
    fw.tooling.map((t) => [t.purpose, t.projects, t.chapter_ref, t.ascend_counterpart])));
  out.push(`\n---\n`);
  out.push(`## C.2 选型矩阵:场景 × 规模\n`);
  out.push(`${fw.recommendations.intro}\n`);
  const matrix = (m) => table(['场景 \\ 规模', ...m.scale_header], m.rows.map((r) => [r.scenario, ...r.cells]));
  out.push(`### C.2.1 训练侧\n`);
  out.push(matrix(fw.recommendations.training_matrix));
  out.push(`\n### C.2.2 推理侧\n`);
  out.push(matrix(fw.recommendations.inference_matrix));
  out.push(`\n### C.2.3 矩阵外的三条否决规则\n`);
  fw.recommendations.veto_rules.forEach((x, i) => out.push(`${i + 1}. ${x}`));
  out.push(`\n---\n`);
  out.push(`## C.3 快照的保质期声明\n`);
  out.push(`本附录三类信息的过时速度不同,更新时按此优先级核对勘误页:\n`);
  out.push(table(['信息类型', '预期保质期', '过时的信号'],
    fw.shelf_life.map((r) => [r.info_type, r.expected_shelf_life, r.staleness_signal])));
  out.push(`\n---\n`);
  out.push(`*本附录数据截至 ${snap}；勘误与更新见[本地勘误页](../ERRATA.md#附录-c-框架选型快照)。数据源:\`data/frameworks/frameworks.yaml\`(项目清单为登记信息,矩阵与否决规则为作者判断 author_judgment;更新请改数据文件后运行 \`npm run docs:generate\`)。*\n`);
  return out.join('\n');
}

export const GENERATED_TARGETS = [
  { path: '附录/附录A-加速卡与集群形态速查表.md', generate: generateAppendixA },
  { path: '附录/附录C-框架选型快照.md', generate: generateAppendixC },
];
