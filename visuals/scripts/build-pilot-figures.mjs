#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const W = 960;
const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const frame = (title, subtitle, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="540" viewBox="0 0 ${W} 540" role="img" aria-labelledby="title desc"><title id="title">${esc(title)}</title><desc id="desc">${esc(subtitle)}</desc><style>text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans CJK SC",sans-serif;fill:#1f2937}.title{font-size:25px;font-weight:700}.sub{font-size:14px;fill:#6b7280}.label{font-size:15px}.small{font-size:12px;fill:#6b7280}.axis{stroke:#9ca3af;stroke-width:1}.grid{stroke:#e5e7eb;stroke-width:1}.blue{fill:#3b6fd4}.green{fill:#2e9e64}.orange{fill:#d9822b}.purple{fill:#7c5cd4}.red{fill:#d64545}</style><rect width="960" height="540" rx="18" fill="#fff"/><text x="48" y="46" class="title">${esc(title)}</text><text x="48" y="72" class="sub">${esc(subtitle)}</text>${body}</svg>`;
const rows = (path) => {
  const [head, ...lines] = readFileSync(path, 'utf8').trim().split('\n');
  const keys = head.split(',');
  return lines.map((line) => Object.fromEntries(line.split(',').map((v, i) => [keys[i], v])));
};
const save = (chapter, name, svg) => {
  const dir = `visuals/generated/${chapter}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${name}.svg`, svg);
};

function migrationMatrix() {
  const caps = ['调度与配额', '存储治理', '数据管道', '可观测性', '故障模型', '弹性前提'];
  const vals = [1, 1, 1, 1, 0, 0];
  const colors = ['#fdecec', '#fff4e5', '#e9f7ef'];
  let body = '<text x="55" y="122" class="label">大数据经验</text><text x="760" y="122" class="label">AI Infra 落点</text>';
  caps.forEach((cap, i) => {
    const y = 145 + i * 56;
    body += `<text x="55" y="${y + 25}" class="label">${cap}</text><rect x="300" y="${y}" width="390" height="38" rx="8" fill="${colors[vals[i]]}" stroke="${['#d64545','#d9822b','#2e9e64'][vals[i]]}"/><text x="495" y="${y + 25}" text-anchor="middle" class="label">${['失效：重新建模','重构后复用','直接复用'][vals[i]]}</text><path d="M700 ${y+19} H742" stroke="#9ca3af" marker-end="url(#a)"/>`;
  });
  body += '<defs><marker id="a" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8Z" fill="#9ca3af"/></marker></defs><text x="55" y="500" class="small">分类为编辑用判断框架；具体边界由对应章节的机制与数据验证。</text>';
  return frame('能力迁移不是一张“全部复用”清单', '绿色保留方法，橙色重做资源语义，红色放弃原前提', body);
}

function incidentTimeline() {
  const data = rows('visuals/data/ch01-incident-timeline.csv');
  let body = '<line x1="90" y1="245" x2="875" y2="245" stroke="#9ca3af" stroke-width="3"/>';
  data.forEach((r, i) => {
    const x = 105 + i * 185;
    const upper = i % 2 === 0;
    const y = upper ? 145 : 345;
    body += `<line x1="${x}" y1="245" x2="${x}" y2="${upper ? 190 : 300}" stroke="#d9822b"/><circle cx="${x}" cy="245" r="8" fill="#d9822b"/><text x="${x}" y="${upper ? 122 : 329}" text-anchor="middle" class="label">${esc(r.event)}</text><text x="${x}" y="${upper ? 145 : 352}" text-anchor="middle" class="small">${esc(r.signal)}</text><text x="${x}" y="270" text-anchor="middle" class="small">${r.minute} min</text>`;
  });
  body += '<rect x="70" y="430" width="820" height="58" rx="10" fill="#fdecec"/><text x="480" y="455" text-anchor="middle" class="label">证据链：调度快照 → 通信 trace → step 长尾 → checkpoint 恢复窗口</text><text x="480" y="477" text-anchor="middle" class="small">任何单一“GPU 利用率”曲线都无法解释这次失败</text>';
  return frame('一次同步训练事故的证据时间线', '合成案例；时间与规模仅用于展示排查顺序，不代表生产实测', body);
}

function lineChart() {
  const data = rows('visuals/data/ch07-allreduce-crosspoint.csv').map((r) => Object.fromEntries(Object.entries(r).map(([k,v]) => [k, Number(v)])));
  const x = (v) => 95 + Math.log2(v) / 12 * 790;
  const y = (v) => 450 - Math.log10(v + 0.1) / Math.log10(200.1) * 340;
  let body = '<line x1="95" y1="110" x2="95" y2="450" class="axis"/><line x1="95" y1="450" x2="885" y2="450" class="axis"/>';
  for (const t of [1, 4, 16, 64, 256, 1024, 4096]) body += `<line x1="${x(t)}" y1="450" x2="${x(t)}" y2="456" class="axis"/><text x="${x(t)}" y="477" text-anchor="middle" class="small">${t}</text>`;
  const path = (key) => data.map((r, i) => `${i ? 'L' : 'M'}${x(r.message_mb)},${y(r[key])}`).join(' ');
  body += `<path d="${path('ring_ms')}" fill="none" stroke="#3b6fd4" stroke-width="4"/><path d="${path('tree_ms')}" fill="none" stroke="#d9822b" stroke-width="4"/><text x="760" y="125" class="label" fill="#3b6fd4">Ring</text><text x="760" y="150" class="label" fill="#d9822b">Tree</text><text x="490" y="515" text-anchor="middle" class="small">消息大小（MB，对数刻度）</text><text x="25" y="285" transform="rotate(-90 25 285)" text-anchor="middle" class="small">完成时间（ms，对数刻度）</text>`;
  return frame('消息变大后，算法优势由延迟转向带宽', '示意数据；用于展示交叉点测量方法，实际边界必须在目标拓扑上复测', body);
}

function stepWaterfall() {
  const data = rows('visuals/data/ch07-step-waterfall.csv');
  const colors = ['#3b6fd4', '#d9822b', '#9ca3af'];
  let body = '';
  data.forEach((r, i) => {
    let start = 205;
    ['compute_s','allreduce_s','other_s'].forEach((k, j) => {
      const w = Number(r[k]) * 82;
      body += `<rect x="${start}" y="${160+i*130}" width="${w}" height="64" fill="${colors[j]}"/><text x="${start+w/2}" y="${198+i*130}" text-anchor="middle" fill="#fff" class="label">${r[k]}s</text>`;
      start += w;
    });
    body += `<text x="185" y="${198+i*130}" text-anchor="end" class="label">${esc(r.placement)}</text><text x="${start+12}" y="${198+i*130}" class="label">总计 ${(Number(r.compute_s)+Number(r.allreduce_s)+Number(r.other_s)).toFixed(1)}s</text>`;
  });
  body += '<rect x="260" y="440" width="18" height="18" class="blue"/><text x="285" y="454" class="small">计算</text><rect x="360" y="440" width="18" height="18" class="orange"/><text x="385" y="454" class="small">AllReduce 等待</text><rect x="520" y="440" width="18" height="18" fill="#9ca3af"/><text x="545" y="454" class="small">其他</text>';
  return frame('加卡没有改变计算时间，却拉长了同步等待', '容量示例；输入取自本章合成场景，数值不代表硬件基准', body);
}

function memoryWaterfall() {
  const data = rows('visuals/data/ch22-memory-waterfall.csv');
  const colors = ['#3b6fd4','#7c5cd4','#2e9e64'];
  let body = '<line x1="100" y1="440" x2="875" y2="440" class="axis"/>';
  let start = 110;
  data.forEach((r,i) => { const w = Number(r.gib)*8.8; body += `<rect x="${start}" y="190" width="${w}" height="150" fill="${colors[i]}"/><text x="${start+w/2}" y="250" text-anchor="middle" fill="#fff" class="label">${esc(r.component)}</text><text x="${start+w/2}" y="280" text-anchor="middle" fill="#fff" class="label">${r.gib} GiB</text>`; start += w; });
  body += '<text x="110" y="390" class="label">80 GiB 标称显存</text><path d="M110 410 H814" stroke="#1f2937" stroke-width="2"/><text x="110" y="475" class="small">KV token 容量 = 60 GiB ÷ 每 token KV 字节数；并发上限还需除以业务上下文长度。</text>';
  return frame('先从显存总量扣除固定项，再计算 KV 容量', '容量估算；16 GiB 权重与 4 GiB 预留为示例输入，可替换', body);
}

function fourNumberComparison() {
  const data = rows('visuals/data/ch04-four-number-comparison.csv');
  const colors = ['#3b6fd4', '#2e9e64', '#d9822b', '#7c5cd4'];
  let body = '<text x="340" y="120" text-anchor="middle" class="label">候选 A</text><text x="620" y="120" text-anchor="middle" class="label">候选 B</text><text x="820" y="120" text-anchor="middle" class="label">本负载优先级</text>';
  data.forEach((r, i) => {
    const y = 155 + i * 78;
    const a = Number(r.card_a_index) * 1.35;
    const b = Number(r.card_b_index) * 1.35;
    body += `<text x="55" y="${y + 24}" class="label">${esc(r.metric)}</text><rect x="260" y="${y}" width="${a}" height="34" rx="6" fill="${colors[i]}" opacity=".65"/><text x="${260+a+8}" y="${y+23}" class="small">${r.card_a_index}</text><rect x="540" y="${y}" width="${b}" height="34" rx="6" fill="${colors[i]}"/><text x="${540+b+8}" y="${y+23}" class="small">${r.card_b_index}</text><circle cx="820" cy="${y+17}" r="${7+Number(r.workload_priority)*3}" fill="${colors[i]}"/><text x="850" y="${y+22}" class="small">${r.workload_priority}/4</text>`;
  });
  body += '<rect x="55" y="470" width="850" height="44" rx="8" fill="#f3f4f6"/><text x="480" y="497" text-anchor="middle" class="label">先用精度支持和可用容量过滤，再按负载优先级比较带宽，峰值算力不能单独排序</text>';
  return frame('读规格书时，把四个数字放回负载画像', '合成规格指数；B=100，仅演示判断顺序，不代表任何真实产品', body);
}

function trainingMemoryWaterfall() {
  const data = rows('visuals/data/ch06-training-memory-waterfall.csv');
  const deductions = data.filter((r) => r.nature !== 'derived');
  let remaining = 80;
  let body = '<text x="45" y="105" class="small">扣减项</text><text x="300" y="105" class="small">扣减后的剩余容量</text>';
  deductions.forEach((r, i) => {
    remaining -= Number(r.gb);
    const y = 120 + i * 48;
    const color = r.nature === 'formula' ? '#3b6fd4' : '#d9822b';
    body += `<text x="45" y="${y + 23}" class="label">${esc(r.component)}</text><text x="265" y="${y + 23}" text-anchor="end" class="small">−${r.gb} GB</text><rect x="300" y="${y}" width="${remaining * 6.7}" height="31" rx="5" fill="${color}" opacity="${r.nature === 'formula' ? '.78' : '.92'}"/><text x="${312 + remaining * 6.7}" y="${y + 21}" class="small">余 ${remaining.toFixed(remaining % 1 ? 1 : 0)} GB</text>`;
  });
  body += '<rect x="45" y="475" width="16" height="16" class="blue"/><text x="68" y="488" class="small">公式项</text><rect x="175" y="475" width="16" height="16" class="orange"/><text x="198" y="488" class="small">待实测假设</text><rect x="340" y="463" width="560" height="42" rx="8" fill="#f3f4f6"/><text x="620" y="489" text-anchor="middle" class="label">最终余量 34 GB；若任一橙色项上升，余量同比减少</text>';
  return frame('70B 训练单卡显存瀑布', '容量示例；TP8×PP4、未启用 ZeRO、micro-batch=1，橙色项必须用目标框架实测替换', body);
}

function capacityWorksheet() {
  const data = rows('visuals/data/ch06-capacity-worksheet.csv');
  const groups = [...new Set(data.map((r) => r.section))];
  const colors = ['#eef4ff', '#fff4e5', '#e9f7ef', '#f3eeff', '#fdecec'];
  let body = '';
  groups.forEach((group, i) => {
    const entries = data.filter((r) => r.section === group);
    const x = 45 + i * 180;
    body += `<rect x="${x}" y="125" width="160" height="${75 + entries.length * 42}" rx="10" fill="${colors[i]}" stroke="#cbd5e1"/><text x="${x + 80}" y="154" text-anchor="middle" class="label">${esc(group)}</text>`;
    entries.forEach((r, j) => body += `<text x="${x + 12}" y="${188 + j * 42}" class="small">${esc(r.name)}</text><text x="${x + 148}" y="${207 + j * 42}" text-anchor="end" class="label">${esc(r.value)}</text>`);
    if (i < groups.length - 1) body += `<path d="M${x + 163} 255 H${x + 177}" stroke="#6b7280" stroke-width="2" marker-end="url(#wa)"/>`;
  });
  body += '<defs><marker id="wa" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8Z" fill="#6b7280"/></marker></defs><rect x="50" y="455" width="860" height="45" rx="8" fill="#f3f4f6"/><text x="480" y="483" text-anchor="middle" class="label">配置文件给结构，需求单给负载，规格与实测给系统系数；输出不得隐藏输入性质</text>';
  return frame('容量工作表把输入、假设和输出分开', '70B 合成容量示例；工期为不含故障、维护与 checkpoint 停顿的理想计算时长', body);
}

function zeroStateSharding() {
  const data = rows('visuals/data/ch17-zero-state-sharding.csv');
  const parts = [
    ['weights_bytes_per_param', '#3b6fd4', '权重'],
    ['gradients_bytes_per_param', '#2e9e64', '梯度'],
    ['optimizer_bytes_per_param', '#d9822b', '优化器状态'],
  ];
  let body = '<text x="245" y="112" class="small">每个本地参数在单卡保留的字节数（DP=8；TP/PP 切分后再应用）</text>';
  data.forEach((r, i) => {
    const y = 145 + i * 72;
    let x = 210;
    body += `<text x="185" y="${y + 27}" text-anchor="end" class="label">${esc(r.stage)}</text>`;
    parts.forEach(([key, color]) => {
      const value = Number(r[key]);
      const width = value * 38;
      body += `<rect x="${x}" y="${y}" width="${width}" height="38" fill="${color}"/>${width >= 32 ? `<text x="${x + width / 2}" y="${y + 25}" text-anchor="middle" fill="#fff" class="small">${value}</text>` : ''}`;
      x += width;
    });
    const total = parts.reduce((sum, [key]) => sum + Number(r[key]), 0);
    body += i === 0
      ? `<text x="${x + 12}" y="${y + 26}" class="label">Σ ${total}</text>`
      : `<text x="${Math.max(x + 12, 520)}" y="${y + 19}" class="small">权/梯/优化器 = ${r.weights_bytes_per_param}/${r.gradients_bytes_per_param}/${r.optimizer_bytes_per_param}</text><text x="${Math.max(x + 12, 520)}" y="${y + 36}" class="small">合计 ${total} B/param</text>`;
  });
  body += parts.map(([, color, label], i) => `<rect x="${245 + i * 170}" y="458" width="16" height="16" fill="${color}"/><text x="${268 + i * 170}" y="471" class="small">${label}</text>`).join('');
  body += '<text x="245" y="510" class="small">图中只比较静态模型状态；激活、通信缓冲、临时聚合峰值和分配器余量另计。</text>';
  return frame('ZeRO 阶段改变的是哪一份状态', '容量示例；BF16 权重与梯度、FP32 master weights + Adam，DP=8', body);
}

function recomputeExchange() {
  const data = rows('visuals/data/ch17-recompute-exchange.csv');
  const x = (v) => 120 + (Number(v) - 95) / 42 * 720;
  const y = (v) => 440 - Number(v) / 110 * 310;
  let body = '<line x1="120" y1="440" x2="865" y2="440" class="axis"/><line x1="120" y1="120" x2="120" y2="440" class="axis"/><text x="490" y="505" text-anchor="middle" class="small">训练计算量指数（不重计算 = 100）</text><text x="35" y="280" transform="rotate(-90 35 280)" text-anchor="middle" class="small">激活显存指数（不重计算 = 100）</text>';
  for (const t of [100, 110, 120, 130]) body += `<line x1="${x(t)}" y1="440" x2="${x(t)}" y2="446" class="axis"/><text x="${x(t)}" y="467" text-anchor="middle" class="small">${t}</text>`;
  for (const t of [0, 25, 50, 75, 100]) body += `<line x1="114" y1="${y(t)}" x2="120" y2="${y(t)}" class="axis"/><text x="105" y="${y(t)+4}" text-anchor="end" class="small">${t}</text>`;
  const path = data.map((r, i) => `${i ? 'L' : 'M'}${x(r.training_compute_index)},${y(r.activation_index)}`).join(' ');
  body += `<path d="${path}" fill="none" stroke="#9ca3af" stroke-width="3" stroke-dasharray="7 5"/>`;
  data.forEach((r, i) => {
    const px = x(r.training_compute_index), py = y(r.activation_index);
    const color = i === 0 ? '#3b6fd4' : i === 1 ? '#2e9e64' : '#d9822b';
    body += `<circle cx="${px}" cy="${py}" r="10" fill="${color}"/><text x="${px + (i === 2 ? -12 : 14)}" y="${py - 14}" text-anchor="${i === 2 ? 'end' : 'start'}" class="label">${esc(r.mode)}</text><text x="${px + (i === 2 ? -12 : 14)}" y="${py + 7}" text-anchor="${i === 2 ? 'end' : 'start'}" class="small">激活 ${r.activation_index} / 计算 ${r.training_compute_index}</text>`;
  });
  body += '<rect x="495" y="125" width="360" height="48" rx="8" fill="#fff4e5"/><text x="675" y="146" text-anchor="middle" class="small">示意点只说明交换方向，不承诺固定收益</text><text x="675" y="164" text-anchor="middle" class="small">目标框架、算子与序列形状必须实测</text>';
  return frame('重计算沿曲线用计算量换激活显存', '归一化容量示例；选择性与完全重计算为示意点，不是跨框架基准', body);
}

function fragmentation() {
  const data = rows('visuals/data/ch22-fragmentation-comparison.csv');
  const colors = ['#2e9e64','#d9822b','#e5e7eb'];
  let body = '';
  data.forEach((r,row) => {
    body += `<text x="60" y="${168+row*170}" class="label">${esc(r.layout)}</text>`;
    const counts = [r.used_blocks,r.reserved_or_fragmented_blocks,r.free_blocks].map(Number);
    let idx=0;
    counts.forEach((count,c) => { for(let n=0;n<count;n++,idx++){ const x=60+(idx%16)*50, y=190+row*170+Math.floor(idx/16)*50; body += `<rect x="${x}" y="${y}" width="40" height="40" rx="5" fill="${colors[c]}" stroke="#cbd5e1"/>`; } });
  });
  body += '<rect x="550" y="115" width="18" height="18" class="green"/><text x="575" y="129" class="small">已写入 KV</text><rect x="680" y="115" width="18" height="18" class="orange"/><text x="705" y="129" class="small">预留/碎片</text><rect x="820" y="115" width="18" height="18" fill="#e5e7eb"/><text x="845" y="129" class="small">可分配</text>';
  return frame('相同有效 KV，占用方式决定还能接纳多少请求', '示意块布局；比较连续预留与分页分配，不代表特定引擎实测', body);
}

function utilizationFunnel() {
  const data = rows('visuals/data/ch11-utilization-funnel.csv');
  const colors = ['#1f2937', '#3b6fd4', '#7c5cd4', '#2e9e64'];
  let body = '';
  data.forEach((r, i) => {
    const width = Number(r.share_percent) * 7.2;
    const x = 120 + (720 - width) / 2;
    const y = 118 + i * 82;
    body += `<rect x="${x}" y="${y}" width="${width}" height="54" rx="8" fill="${colors[i]}" opacity="${i ? '.9' : '.78'}"/><text x="${x + width / 2}" y="${y + 23}" text-anchor="middle" fill="#fff" class="label">${esc(r.stage)}</text><text x="${x + width / 2}" y="${y + 43}" text-anchor="middle" fill="#fff" class="small">${r.share_percent}%</text>`;
    if (i) body += `<text x="850" y="${y + 31}" class="small">${esc(r.note)}</text>`;
  });
  body += '<rect x="120" y="470" width="720" height="42" rx="8" fill="#fff4e5"/><text x="480" y="496" text-anchor="middle" class="label">GPU/SM 活动用于解释损失，不作为第四个乘数</text>';
  return frame('从占卡到有效模型 FLOPs 的三层漏斗', '512 卡合成容量示例；85% × 62% × 40% = 21.1%，不代表生产基准', body);
}

function attributionMatrix() {
  const data = rows('visuals/data/ch11-attribution-matrix.csv');
  const colors = ['#f3eeff', '#e9f7ef', '#fff4e5', '#eef4ff'];
  const heads = ['候选原因', '主证据', '单变量实验', '移交前证据'];
  const xs = [45, 205, 455, 705];
  const widths = [150, 240, 240, 210];
  let body = heads.map((h, i) => `<text x="${xs[i] + widths[i] / 2}" y="116" text-anchor="middle" class="label">${h}</text>`).join('');
  data.forEach((r, row) => {
    const y = 135 + row * 82;
    const vals = [r.cause, r.primary_signal, r.controlled_test, r.handoff_evidence];
    vals.forEach((v, col) => body += `<rect x="${xs[col]}" y="${y}" width="${widths[col]}" height="62" rx="7" fill="${colors[row]}" stroke="#cbd5e1"/><text x="${xs[col] + widths[col] / 2}" y="${y + 37}" text-anchor="middle" class="${col ? 'small' : 'label'}">${esc(v)}</text>`);
  });
  body += '<path d="M120 475 H840" stroke="#6b7280" stroke-width="2" marker-end="url(#mxa)"/><defs><marker id="mxa" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8Z" fill="#6b7280"/></marker></defs><text x="480" y="505" text-anchor="middle" class="small">指标提出假设 → 时间线限定范围 → 受控实验验证 → 再移交行动项</text>';
  return frame('低产出归因不是一张自动定责表', '编辑诊断矩阵；阈值应来自同类任务基线，行动项必须经过受控实验', body);
}

function riskFrontier() {
  const data = rows('visuals/data/ch11-risk-frontier.csv');
  const x = (v) => 120 + (Number(v) - 55) / 45 * 720;
  const y = (v) => 440 - Number(v) / 100 * 310;
  let body = '<line x1="120" y1="110" x2="120" y2="440" class="axis"/><line x1="120" y1="440" x2="860" y2="440" class="axis"/><text x="490" y="500" text-anchor="middle" class="small">分配占用率目标（%）</text><text x="35" y="275" transform="rotate(-90 35 275)" text-anchor="middle" class="small">归一化指数 / 百分比</text>';
  for (const t of [60, 70, 80, 90, 95]) body += `<line x1="${x(t)}" y1="440" x2="${x(t)}" y2="446" class="axis"/><text x="${x(t)}" y="467" text-anchor="middle" class="small">${t}</text>`;
  for (const t of [0, 25, 50, 75, 100]) body += `<line x1="114" y1="${y(t)}" x2="860" y2="${y(t)}" class="${t ? 'grid' : 'axis'}"/><text x="105" y="${y(t)+4}" text-anchor="end" class="small">${t}</text>`;
  const path = (key) => data.map((r, i) => `${i ? 'L' : 'M'}${x(r.allocation_target)},${y(r[key])}`).join(' ');
  body += `<path d="${path('queue_delay_index')}" fill="none" stroke="#d64545" stroke-width="4"/><path d="${path('recovery_headroom_percent')}" fill="none" stroke="#2e9e64" stroke-width="4"/>`;
  data.forEach((r) => body += `<circle cx="${x(r.allocation_target)}" cy="${y(r.queue_delay_index)}" r="6" fill="#d64545"/><circle cx="${x(r.allocation_target)}" cy="${y(r.recovery_headroom_percent)}" r="6" fill="#2e9e64"/>`);
  body += '<rect x="590" y="115" width="18" height="5" class="red"/><text x="618" y="123" class="small">队列延迟指数</text><rect x="590" y="142" width="18" height="5" class="green"/><text x="618" y="150" class="small">恢复余量（%）</text><text x="590" y="180" class="small">合成数据只表达权衡方向</text>';
  return frame('提高占用率会同时挤压排队与恢复空间', '合成风险曲线；生产目标必须用到达过程、作业规模、故障模型和 SLO 重算', body);
}

function compatibilitySurface() {
  const data = rows('visuals/data/ch12-compatibility-surface.csv');
  const heads = ['适配层', '所需证据', '失败信号', '迁移动作'];
  const xs = [40, 175, 410, 650];
  const widths = [125, 225, 230, 270];
  const colors = ['#eef4ff', '#f3eeff', '#fff4e5', '#e9f7ef', '#fdecec'];
  let body = heads.map((h, i) => `<text x="${xs[i] + widths[i] / 2}" y="108" text-anchor="middle" class="label">${h}</text>`).join('');
  data.forEach((r, row) => {
    const y = 125 + row * 68;
    const vals = [r.layer, r.required_evidence, r.failure_signal, r.decision];
    vals.forEach((v, col) => body += `<rect x="${xs[col]}" y="${y}" width="${widths[col]}" height="52" rx="7" fill="${colors[row]}" stroke="#cbd5e1"/><text x="${xs[col] + widths[col] / 2}" y="${y + 31}" text-anchor="middle" class="${col ? 'small' : 'label'}">${esc(v)}</text>`);
  });
  body += '<text x="480" y="500" text-anchor="middle" class="small">统一 API 只覆盖第一层；每层都要有版本、证据、责任人与退路。</text>';
  return frame('加速器迁移的五层适配面', '编辑诊断矩阵；适配层来自框架集成与生产运行边界，不表示特定平台成熟度', body);
}

function scaleEfficiency() {
  const data = rows('visuals/data/ch12-scale-efficiency.csv');
  const x = (i) => 170 + i * 310;
  const y = (v) => 440 - (Number(v) - 60) / 45 * 315;
  let body = '<line x1="120" y1="110" x2="120" y2="440" class="axis"/><line x1="120" y1="440" x2="855" y2="440" class="axis"/><text x="490" y="500" text-anchor="middle" class="small">卡数（8 卡为最小可比单元）</text><text x="35" y="275" transform="rotate(-90 35 275)" text-anchor="middle" class="small">规模效率（%）</text>';
  for (const t of [60, 70, 80, 90, 100]) body += `<line x1="114" y1="${y(t)}" x2="855" y2="${y(t)}" class="${t === 60 ? 'axis' : 'grid'}"/><text x="105" y="${y(t)+4}" text-anchor="end" class="small">${t}</text>`;
  data.forEach((r, i) => body += `<line x1="${x(i)}" y1="440" x2="${x(i)}" y2="446" class="axis"/><text x="${x(i)}" y="468" text-anchor="middle" class="small">${r.cards}</text>`);
  const path = (key) => data.map((r, i) => `${i ? 'L' : 'M'}${x(i)},${y(r[key])}`).join(' ');
  body += `<path d="${path('platform_a_percent')}" fill="none" stroke="#3b6fd4" stroke-width="4"/><path d="${path('platform_b_percent')}" fill="none" stroke="#d9822b" stroke-width="4"/>`;
  data.forEach((r, i) => body += `<circle cx="${x(i)}" cy="${y(r.platform_a_percent)}" r="7" fill="#3b6fd4"/><text x="${x(i)}" y="${y(r.platform_a_percent)-13}" text-anchor="middle" class="small">${r.platform_a_percent}</text><circle cx="${x(i)}" cy="${y(r.platform_b_percent)}" r="7" fill="#d9822b"/><text x="${x(i)}" y="${y(r.platform_b_percent)+22}" text-anchor="middle" class="small">${r.platform_b_percent}</text>`);
  body += '<rect x="625" y="108" width="18" height="5" class="blue"/><text x="652" y="116" class="small">平台 A</text><rect x="725" y="108" width="18" height="5" class="orange"/><text x="752" y="116" class="small">平台 B</text>';
  return frame('最小单元打平后，规模斜率仍可分叉', '32B 合成容量示例；数值不代表任何硬件或软件栈基准', body);
}

function costLedger() {
  const data = rows('visuals/data/ch12-cost-ledger.csv');
  const max = 4;
  let body = '<text x="515" y="106" text-anchor="middle" class="small">人月（一次性与每年持续投入不可直接相加）</text>';
  data.forEach((r, i) => {
    const y = 128 + i * 55;
    const one = Number(r.one_time_person_months) / max * 300;
    const annual = Number(r.annual_person_months) / max * 300;
    body += `<text x="145" y="${y + 23}" text-anchor="end" class="label">${esc(r.category)}</text><rect x="165" y="${y}" width="${one}" height="18" rx="4" fill="#3b6fd4"/><rect x="165" y="${y + 23}" width="${annual}" height="18" rx="4" fill="#d9822b"/><text x="${175 + one}" y="${y + 14}" class="small">${r.one_time_person_months}</text><text x="${175 + annual}" y="${y + 37}" class="small">${r.annual_person_months}</text>`;
  });
  body += '<rect x="620" y="160" width="18" height="12" class="blue"/><text x="648" y="171" class="small">一次性迁移</text><rect x="620" y="190" width="18" height="12" class="orange"/><text x="648" y="201" class="small">年度持续</text><rect x="585" y="240" width="290" height="92" rx="9" fill="#f3f4f6"/><text x="730" y="268" text-anchor="middle" class="label">账本使用方法</text><text x="730" y="292" text-anchor="middle" class="small">一次性投入按受益年限摊销</text><text x="730" y="313" text-anchor="middle" class="small">持续投入乘预计双栈年限</text><text x="480" y="500" text-anchor="middle" class="small">合成数值只展示分类；每项应给低/中/高情景、依据和置信度。</text>';
  return frame('迁移账必须同时保留一次性与持续成本', '32B 合成容量示例；人月仅用于演示账本结构，不代表行业估算', body);
}

function checkpointCriticalPath() {
  const data = rows('visuals/data/ch14-checkpoint-critical-path.csv');
  const colors = { pause: '#7c5cd4', queue: '#d9822b', data: '#3b6fd4', commit: '#2e9e64' };
  const total = data.reduce((n, r) => n + Number(r.seconds), 0);
  let start = 75;
  let body = '<text x="75" y="130" class="small">触发保存</text><text x="875" y="130" text-anchor="end" class="small">可恢复版本提交</text>';
  data.forEach((r) => {
    const w = Number(r.seconds) / total * 800;
    body += `<rect x="${start}" y="165" width="${w}" height="105" fill="${colors[r.nature]}"/><text x="${start + w / 2}" y="205" text-anchor="middle" fill="#fff" class="label">${esc(r.stage)}</text><text x="${start + w / 2}" y="235" text-anchor="middle" fill="#fff" class="label">${r.seconds} s</text>`;
    start += w;
  });
  body += `<path d="M75 310 H875" stroke="#1f2937" stroke-width="2"/><text x="475" y="340" text-anchor="middle" class="label">端到端 ${total} s</text><rect x="75" y="390" width="800" height="65" rx="9" fill="#fff4e5"/><text x="475" y="418" text-anchor="middle" class="label">S / B 只能给数据段的物理下界</text><text x="475" y="441" text-anchor="middle" class="small">队列、元数据、最慢 rank、commit 与 verify 必须分别测量</text>`;
  return frame('一次 checkpoint 的端到端关键路径', '70B 合成事故；阶段耗时只用于展示证据分解，不代表存储基准', body);
}

function burstContention() {
  const data = rows('visuals/data/ch14-burst-contention.csv');
  const x = (v) => 100 + Number(v) / 9 * 760;
  const y = (v) => 445 - Number(v) / 130 * 320;
  const total = (r, staggered) => Number(r.steady_read) + Number(r.checkpoint_a) + Number(staggered ? r.checkpoint_b_staggered : r.checkpoint_b_same);
  const path = (fn) => data.map((r, i) => `${i ? 'L' : 'M'}${x(r.minute)},${y(fn(r))}`).join(' ');
  let body = '<line x1="100" y1="110" x2="100" y2="445" class="axis"/><line x1="100" y1="445" x2="865" y2="445" class="axis"/><text x="485" y="505" text-anchor="middle" class="small">分钟</text><text x="28" y="275" transform="rotate(-90 28 275)" text-anchor="middle" class="small">共享服务负载指数</text>';
  for (const t of [0, 25, 50, 75, 100, 125]) body += `<line x1="94" y1="${y(t)}" x2="865" y2="${y(t)}" class="${t ? 'grid' : 'axis'}"/><text x="86" y="${y(t)+4}" text-anchor="end" class="small">${t}</text>`;
  data.forEach((r) => body += `<text x="${x(r.minute)}" y="468" text-anchor="middle" class="small">${r.minute}</text>`);
  body += `<path d="${path((r) => Number(r.service_capacity))}" fill="none" stroke="#9ca3af" stroke-width="3" stroke-dasharray="8 5"/><path d="${path((r) => total(r, false))}" fill="none" stroke="#d64545" stroke-width="4"/><path d="${path((r) => total(r, true))}" fill="none" stroke="#3b6fd4" stroke-width="4"/>`;
  body += '<rect x="575" y="112" width="18" height="5" fill="#d64545"/><text x="602" y="120" class="small">同相触发总负载</text><rect x="575" y="140" width="18" height="5" class="blue"/><text x="602" y="148" class="small">错峰后总负载</text><path d="M575 174 H593" stroke="#9ca3af" stroke-width="3" stroke-dasharray="6 4"/><text x="602" y="179" class="small">服务能力</text>';
  return frame('同样的小时平均流量，保存时刻可以完全不同', '合成负载指数；错峰只展示调度杠杆，不承诺适用于所有 RPO', body);
}

function recoveryMatrix() {
  const data = rows('visuals/data/ch14-recovery-matrix.csv');
  const heads = ['落点', '确认完成条件', '耐受故障域', '恢复用途'];
  const xs = [45, 190, 430, 675];
  const widths = [135, 230, 235, 240];
  const colors = ['#fff4e5', '#e9f7ef', '#eef4ff'];
  let body = heads.map((h, i) => `<text x="${xs[i] + widths[i] / 2}" y="120" text-anchor="middle" class="label">${h}</text>`).join('');
  data.forEach((r, row) => {
    const y = 145 + row * 95;
    const vals = [r.tier, r.ack_condition, r.failure_domain, r.recovery_role];
    vals.forEach((v, col) => body += `<rect x="${xs[col]}" y="${y}" width="${widths[col]}" height="68" rx="8" fill="${colors[row]}" stroke="#cbd5e1"/><text x="${xs[col] + widths[col] / 2}" y="${y + 40}" text-anchor="middle" class="${col ? 'small' : 'label'}">${esc(v)}</text>`);
  });
  body += '<rect x="115" y="450" width="730" height="46" rx="8" fill="#f3f4f6"/><text x="480" y="479" text-anchor="middle" class="label">完成语义 = 数据落点 + commit 条件 + 声明故障域 + restore 证据</text>';
  return frame('同一份状态在不同层有不同的完成语义', '编辑决策矩阵；具体持久性由目标存储实现和部署故障域验证', body);
}

function parallelismEvidenceMatrix() {
  const data = rows('visuals/data/ch16-parallelism-evidence-matrix.csv');
  const labels = {
    DP: ['batch', '梯度 / 参数', '每 step', 'DP 组与 bucket trace'],
    TP: ['层内张量', '激活 / 部分和', '每层每微批', 'TP 组与 collective trace'],
    PP: ['layer / stage', '边界激活', '每边界每微批', 'stage 映射与 P2P 时间线'],
    EP: ['专家', '路由 token', '每 MoE 层每微批', '专家负载与 AllToAll trace'],
    CP: ['序列上下文', 'KV 分块', '每注意力层每微批', 'CP 组与 attention 时间线']
  };
  const heads = ['轴', '切分对象', '主要载荷', '发生频率', '放置证据'];
  const xs = [45, 115, 275, 450, 640];
  const widths = [60, 150, 165, 180, 275];
  let body = heads.map((h, i) => `<text x="${xs[i] + widths[i] / 2}" y="112" text-anchor="middle" class="label">${h}</text>`).join('');
  data.forEach((r, row) => {
    const y = 132 + row * 64;
    const vals = [r.axis, ...labels[r.axis]];
    vals.forEach((v, col) => body += `<rect x="${xs[col]}" y="${y}" width="${widths[col]}" height="48" rx="7" fill="${row % 2 ? '#f8fafc' : '#eef4ff'}" stroke="#cbd5e1"/><text x="${xs[col] + widths[col] / 2}" y="${y + 29}" text-anchor="middle" class="${col === 0 ? 'label' : 'small'}">${esc(v)}</text>`);
  });
  body += '<text x="480" y="493" text-anchor="middle" class="small">载荷公式只做预算；次数、算法、重叠和关键路径由目标图与 trace 确认。</text>';
  return frame('并行轴的通信证据矩阵', '编辑矩阵；不预设某个框架的固定 collective 次数', body);
}

function pipelineBubble() {
  const data = rows('visuals/data/ch16-pipeline-bubble.csv');
  const x = (i) => 110 + i * 105;
  const y = (v) => 445 - Number(v) / 80 * 320;
  let body = '<line x1="90" y1="125" x2="90" y2="445" class="axis"/><line x1="90" y1="445" x2="665" y2="445" class="axis"/><text x="375" y="500" text-anchor="middle" class="small">microbatch 数 m</text><text x="28" y="285" transform="rotate(-90 28 285)" text-anchor="middle" class="small">理想气泡率（%）</text>';
  for (const t of [0, 20, 40, 60, 80]) body += `<line x1="84" y1="${y(t)}" x2="665" y2="${y(t)}" class="${t ? 'grid' : 'axis'}"/><text x="75" y="${y(t)+4}" text-anchor="end" class="small">${t}</text>`;
  const path = data.map((r, i) => `${i ? 'L' : 'M'}${x(i)},${y(r.ideal_bubble_percent)}`).join(' ');
  body += `<path d="${path}" fill="none" stroke="#3b6fd4" stroke-width="4"/>`;
  data.forEach((r, i) => body += `<circle cx="${x(i)}" cy="${y(r.ideal_bubble_percent)}" r="6" fill="#3b6fd4"/><text x="${x(i)}" y="468" text-anchor="middle" class="small">${r.microbatches}</text><text x="${x(i)}" y="${y(r.ideal_bubble_percent)-12}" text-anchor="middle" class="small">${r.ideal_bubble_percent}%</text>`);
  body += '<rect x="700" y="145" width="210" height="205" rx="10" fill="#fff4e5"/><text x="805" y="178" text-anchor="middle" class="label">公式假设</text><text x="805" y="211" text-anchor="middle" class="small">p = 4 且各 stage 等时</text><text x="805" y="239" text-anchor="middle" class="small">GPipe 式灌入 / 排空</text><text x="805" y="267" text-anchor="middle" class="small">忽略通信与调度开销</text><text x="805" y="310" text-anchor="middle" class="label">实测另加</text><text x="805" y="338" text-anchor="middle" class="small">失衡、P2P、运行时空闲</text>';
  return frame('流水线气泡的理想下界', 'p=4 的公式曲线；不代表 1F1B 或 interleaved schedule 的实测值', body);
}

function feasibleRegion() {
  const data = rows('visuals/data/ch16-feasible-region.csv');
  const heads = ['候选', '显存', '整除', 'batch', '拓扑', '结果'];
  const xs = [38, 185, 285, 385, 485, 650];
  const widths = [137, 90, 90, 90, 155, 265];
  const cn = { pass: '通过', fail: '失败', not_checked: '未检查', risk_cross_domain: '跨域风险', reject_batch: '拒绝：batch', measure: '进入短跑（指数 100）', measure_with_risk: '带风险进入短跑', reject_memory: '拒绝：显存' };
  let body = heads.map((h, i) => `<text x="${xs[i] + widths[i] / 2}" y="120" text-anchor="middle" class="label">${h}</text>`).join('');
  data.forEach((r, row) => {
    const y = 145 + row * 72;
    const vals = [r.candidate, r.memory, r.divisibility, r.batch, r.topology, r.result];
    vals.forEach((v, col) => {
      const bad = v === 'fail' || v.startsWith('reject');
      const risk = v.includes('risk');
      const fill = bad ? '#fdecec' : risk ? '#fff4e5' : v === 'pass' || v === 'measure' ? '#e9f7ef' : '#f3f4f6';
      body += `<rect x="${xs[col]}" y="${y}" width="${widths[col]}" height="52" rx="7" fill="${fill}" stroke="#cbd5e1"/><text x="${xs[col] + widths[col] / 2}" y="${y + 31}" text-anchor="middle" class="${col === 0 ? 'label' : 'small'}">${esc(cn[v] || v)}</text>`;
    });
  });
  body += '<text x="480" y="493" text-anchor="middle" class="small">合成门禁工作表；“100”只是短跑归一化占位，不是硬件性能结论。</text>';
  return frame('候选并行网格的可行域过滤', '容量示例；先记录最早拒绝原因，再测量通过门禁的候选', body);
}

function interruptionProbability() {
  const data = rows('visuals/data/ch20-interruption-probability.csv');
  const x = (v) => 105 + Number(v) / 4 * 755;
  const y = (v) => 445 - Number(v) / 100 * 320;
  let body = '<line x1="105" y1="125" x2="105" y2="445" class="axis"/><line x1="105" y1="445" x2="860" y2="445" class="axis"/><text x="485" y="503" text-anchor="middle" class="small">任务期内期望中断次数 μ</text><text x="30" y="285" transform="rotate(-90 30 285)" text-anchor="middle" class="small">至少一次中断概率（%）</text>';
  for (const t of [0, 25, 50, 75, 100]) body += `<line x1="99" y1="${y(t)}" x2="860" y2="${y(t)}" class="${t ? 'grid' : 'axis'}"/><text x="90" y="${y(t)+4}" text-anchor="end" class="small">${t}</text>`;
  const path = data.map((r, i) => `${i ? 'L' : 'M'}${x(r.expected_interruptions)},${y(r.probability_percent)}`).join(' ');
  body += `<path d="${path}" fill="none" stroke="#d64545" stroke-width="4"/>`;
  data.forEach((r) => body += `<circle cx="${x(r.expected_interruptions)}" cy="${y(r.probability_percent)}" r="6" fill="#d64545"/><text x="${x(r.expected_interruptions)}" y="468" text-anchor="middle" class="small">${r.expected_interruptions}</text><text x="${x(r.expected_interruptions)}" y="${y(r.probability_percent)-12}" text-anchor="middle" class="small">${r.probability_percent}%</text>`);
  body += '<text x="480" y="103" text-anchor="middle" class="small">P(N≥1)=1−exp(−μ)；Poisson 假设只用于初筛</text>';
  return frame('任务期内至少一次中断的概率', '公式曲线；不包含任何硬件或集群故障率基准', body);
}

function checkpointCostCurve() {
  const data = rows('visuals/data/ch20-checkpoint-cost-curve.csv');
  const x = (i) => 105 + i * 120;
  const y = (v) => 445 - Number(v) / 35 * 315;
  let body = '<line x1="95" y1="130" x2="95" y2="445" class="axis"/><line x1="95" y1="445" x2="850" y2="445" class="axis"/><text x="475" y="505" text-anchor="middle" class="small">checkpoint 间隔 τ（小时）</text><text x="28" y="285" transform="rotate(-90 28 285)" text-anchor="middle" class="small">期望浪费占比（%）</text>';
  for (const t of [0, 10, 20, 30]) body += `<line x1="89" y1="${y(t)}" x2="850" y2="${y(t)}" class="${t ? 'grid' : 'axis'}"/><text x="80" y="${y(t)+4}" text-anchor="end" class="small">${t}</text>`;
  const path = (key) => data.map((r, i) => `${i ? 'L' : 'M'}${x(i)},${y(r[key])}`).join(' ');
  body += `<path d="${path('save_overhead_percent')}" fill="none" stroke="#3b6fd4" stroke-width="3"/><path d="${path('rollback_waste_percent')}" fill="none" stroke="#d9822b" stroke-width="3"/><path d="${path('total_waste_percent')}" fill="none" stroke="#d64545" stroke-width="5"/>`;
  data.forEach((r, i) => body += `<text x="${x(i)}" y="468" text-anchor="middle" class="small">${r.interval_hours}</text><circle cx="${x(i)}" cy="${y(r.total_waste_percent)}" r="5" fill="#d64545"/>`);
  body += '<rect x="560" y="135" width="18" height="5" class="blue"/><text x="587" y="143" class="small">保存开销 C/τ</text><rect x="560" y="163" width="18" height="5" class="orange"/><text x="587" y="171" class="small">期望回滚 τ/(2M)</text><rect x="560" y="191" width="18" height="5" class="red"/><text x="587" y="199" class="small">一阶总浪费</text><text x="480" y="105" text-anchor="middle" class="small">合成假设：M=48 h，C=5 min；不含检测、恢复和异步 staging</text>';
  return frame('Checkpoint 间隔的一阶成本曲线', '合成容量示例；参数必须由目标任务事件与 pause 测量替换', body);
}

function recoveryTimeline() {
  const data = rows('visuals/data/ch20-recovery-timeline.csv');
  const total = data.reduce((n, r) => n + Number(r.minutes), 0);
  const colors = ['#7c5cd4', '#d64545', '#d9822b', '#3b6fd4', '#2e9e64', '#64748b'];
  let start = 60;
  let body = '<text x="60" y="120" class="small">异常首次发生</text><text x="900" y="120" text-anchor="end" class="small">再次提交有效 step</text>';
  data.forEach((r, i) => {
    const w = Number(r.minutes) / total * 840;
    body += `<rect x="${start}" y="150" width="${w}" height="105" fill="${colors[i]}"/><text x="${start + w / 2}" y="188" text-anchor="middle" fill="#fff" class="label">${esc(r.stage)}</text><text x="${start + w / 2}" y="218" text-anchor="middle" fill="#fff" class="label">${r.minutes} min</text>`;
    start += w;
  });
  data.forEach((r, i) => body += `<rect x="${70 + (i % 3) * 285}" y="${310 + Math.floor(i / 3) * 75}" width="260" height="52" rx="8" fill="#f8fafc" stroke="#cbd5e1"/><text x="${200 + (i % 3) * 285}" y="${332 + Math.floor(i / 3) * 75}" text-anchor="middle" class="label">${esc(r.stage)} · ${esc(r.owner)}</text><text x="${200 + (i % 3) * 285}" y="${351 + Math.floor(i / 3) * 75}" text-anchor="middle" class="small">完成证据：${esc(r.evidence)}</text>`);
  body += `<text x="480" y="493" text-anchor="middle" class="small">端到端 ${total} min；合成时长只展示分账结构，不代表恢复 SLO。</text>`;
  return frame('一次训练失败的检测与恢复时间线', '合成事故；每段应由事件时间戳、owner 与完成证据复算', body);
}

function kernelTimeline() {
  const data = rows('visuals/data/ch23-kernel-timeline.csv');
  const colors = { gap: '#9ca3af', compute: '#3b6fd4', memory: '#d9822b', fused: '#2e9e64' };
  const labels = { gap: 'CPU / launch gap', compute: '独立 kernel', memory: '中间张量往返', fused: '融合 kernel' };
  let body = '';
  ['优化前', '优化后'].forEach((version, row) => {
    const items = data.filter((r) => r.version === version);
    const scale = 6.8;
    let start = 160;
    body += `<text x="140" y="${190 + row * 155}" text-anchor="end" class="label">${version}</text>`;
    items.forEach((r) => {
      const w = Number(r.duration_us) * scale;
      body += `<rect x="${start}" y="${155 + row * 155}" width="${w}" height="70" fill="${colors[r.nature]}"/><text x="${start + w / 2}" y="${185 + row * 155}" text-anchor="middle" fill="#fff" class="small">${esc(r.segment)}</text><text x="${start + w / 2}" y="${207 + row * 155}" text-anchor="middle" fill="#fff" class="small">${r.duration_us} μs</text>`;
      start += w;
    });
    const total = items.reduce((n, r) => n + Number(r.duration_us), 0);
    body += `<text x="${start + 12}" y="${195 + row * 155}" class="label">${total} μs</text>`;
  });
  Object.entries(labels).forEach(([key, label], i) => body += `<rect x="${110 + i * 205}" y="455" width="16" height="16" fill="${colors[key]}"/><text x="${135 + i * 205}" y="468" class="small">${label}</text>`);
  return frame('Kernel 时间线优化前后对照', '合成微秒数；只展示 launch 与中间张量往返被删除的证据结构', body);
}

function optimizationPareto() {
  const data = rows('visuals/data/ch23-pareto.csv');
  const x = (v) => 105 + (Number(v) - 98.5) / 2 * 710;
  const y = (v) => 445 - (Number(v) - 90) / 80 * 315;
  const latencyColor = (v) => Number(v) <= 65 ? '#2e9e64' : Number(v) <= 85 ? '#d9822b' : '#d64545';
  let body = '<line x1="105" y1="130" x2="105" y2="445" class="axis"/><line x1="105" y1="445" x2="815" y2="445" class="axis"/><text x="460" y="505" text-anchor="middle" class="small">业务质量保留率（%）</text><text x="28" y="285" transform="rotate(-90 28 285)" text-anchor="middle" class="small">有效吞吐指数</text>';
  for (const t of [98.5, 99, 99.5, 100, 100.5]) body += `<line x1="${x(t)}" y1="445" x2="${x(t)}" y2="451" class="axis"/><text x="${x(t)}" y="473" text-anchor="middle" class="small">${t}</text>`;
  for (const t of [100, 120, 140, 160]) body += `<line x1="99" y1="${y(t)}" x2="815" y2="${y(t)}" class="grid"/><text x="90" y="${y(t)+4}" text-anchor="end" class="small">${t}</text>`;
  data.forEach((r, i) => {
    const cx = x(r.quality_retention_percent), cy = y(r.throughput_index);
    body += `<circle cx="${cx}" cy="${cy}" r="11" fill="${latencyColor(r.tail_latency_index)}"/><text x="${cx + (i % 2 ? 15 : -15)}" y="${cy - 16}" text-anchor="${i % 2 ? 'start' : 'end'}" class="small">${esc(r.candidate)}</text>`;
  });
  body += '<rect x="835" y="165" width="16" height="16" class="green"/><text x="860" y="178" class="small">尾延迟指数 ≤65</text><rect x="835" y="198" width="16" height="16" class="orange"/><text x="860" y="211" class="small">66–85</text><rect x="835" y="231" width="16" height="16" class="red"/><text x="860" y="244" class="small">＞85</text><text x="840" y="295" class="small">合成工作表</text><text x="840" y="316" class="small">非产品基准</text>';
  return frame('计算优化候选的三目标 Pareto', '合成质量、吞吐与尾延迟指数；候选名称不承诺通用排序', body);
}

function speculativePayoff() {
  const data = rows('visuals/data/ch23-speculative-payoff.csv');
  const x = (v) => 105 + Number(v) / 0.9 * 735;
  const y = (v) => 445 - Number(v) / 3.1 * 315;
  const path = (key) => data.map((r, i) => `${i ? 'L' : 'M'}${x(r.acceptance_rate)},${y(r[key])}`).join(' ');
  let body = '<line x1="105" y1="130" x2="105" y2="445" class="axis"/><line x1="105" y1="445" x2="840" y2="445" class="axis"/><text x="475" y="505" text-anchor="middle" class="small">逐 token 接受率 α</text><text x="28" y="285" transform="rotate(-90 28 285)" text-anchor="middle" class="small">简化模型加速比 S</text>';
  for (const t of [0, 0.5, 1, 1.5, 2, 2.5, 3]) body += `<line x1="99" y1="${y(t)}" x2="840" y2="${y(t)}" class="${t === 1 ? 'axis' : 'grid'}"/><text x="90" y="${y(t)+4}" text-anchor="end" class="small">${t}</text>`;
  data.forEach((r) => body += `<text x="${x(r.acceptance_rate)}" y="470" text-anchor="middle" class="small">${r.acceptance_rate}</text>`);
  body += `<path d="${path('ideal_v1_speedup')}" fill="none" stroke="#3b6fd4" stroke-width="4"/><path d="${path('loaded_v1_5_speedup')}" fill="none" stroke="#d9822b" stroke-width="4"/>`;
  data.forEach((r) => body += `<circle cx="${x(r.acceptance_rate)}" cy="${y(r.ideal_v1_speedup)}" r="5" fill="#3b6fd4"/><circle cx="${x(r.acceptance_rate)}" cy="${y(r.loaded_v1_5_speedup)}" r="5" fill="#d9822b"/>`);
  body += '<rect x="575" y="145" width="18" height="5" class="blue"/><text x="603" y="153" class="small">验证成本 v=1.0</text><rect x="575" y="176" width="18" height="5" class="orange"/><text x="603" y="184" class="small">验证成本 v=1.5</text><text x="575" y="220" class="small">固定 k=4、c=0.1</text><text x="575" y="242" class="small">S=1 为盈亏线</text>';
  return frame('投机解码收益随接受率与验证成本变化', '简化独立接受模型；生产值还受调度、padding、图命中与 KV 路径影响', body);
}

save('ch01', 'capability-migration', migrationMatrix());
save('ch01', 'incident-evidence-timeline', incidentTimeline());
save('ch04', 'four-number-comparison', fourNumberComparison());
save('ch06', 'training-memory-waterfall', trainingMemoryWaterfall());
save('ch06', 'capacity-worksheet', capacityWorksheet());
save('ch17', 'zero-state-sharding', zeroStateSharding());
save('ch17', 'recompute-exchange', recomputeExchange());
save('ch11', 'utilization-funnel', utilizationFunnel());
save('ch11', 'attribution-matrix', attributionMatrix());
save('ch11', 'risk-frontier', riskFrontier());
save('ch12', 'compatibility-surface', compatibilitySurface());
save('ch12', 'scale-efficiency', scaleEfficiency());
save('ch12', 'cost-ledger', costLedger());
save('ch14', 'checkpoint-critical-path', checkpointCriticalPath());
save('ch14', 'burst-contention', burstContention());
save('ch14', 'recovery-matrix', recoveryMatrix());
save('ch16', 'parallelism-evidence-matrix', parallelismEvidenceMatrix());
save('ch16', 'pipeline-bubble', pipelineBubble());
save('ch16', 'feasible-region', feasibleRegion());
save('ch20', 'interruption-probability', interruptionProbability());
save('ch20', 'checkpoint-cost-curve', checkpointCostCurve());
save('ch20', 'recovery-timeline', recoveryTimeline());
save('ch23', 'kernel-timeline', kernelTimeline());
save('ch23', 'pareto', optimizationPareto());
save('ch23', 'speculative-payoff', speculativePayoff());
save('ch07', 'allreduce-crosspoint', lineChart());
save('ch07', 'step-time-waterfall', stepWaterfall());
save('ch22', 'memory-waterfall', memoryWaterfall());
save('ch22', 'kv-fragmentation-comparison', fragmentation());
console.log('已生成 29 张数据驱动 SVG。');
