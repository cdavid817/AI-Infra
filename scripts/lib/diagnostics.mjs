/** 统一诊断输出:文件、行号、规则 ID、消息。 */
export function formatDiagnostic({ file, line, rule, message }) {
  return `${file}:${line} [${rule}] ${message}`;
}

export function report(diagnostics, { okMessage }) {
  if (diagnostics.length > 0) {
    console.error(`发现 ${diagnostics.length} 个问题:`);
    for (const d of diagnostics) console.error(`- ${formatDiagnostic(d)}`);
    process.exitCode = 1;
    return false;
  }
  console.log(okMessage);
  return true;
}
