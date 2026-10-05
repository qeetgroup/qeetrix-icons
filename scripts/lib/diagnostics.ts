export type DiagnosticCode =
  | "QXI-XML-001"
  | "QXI-XML-002"
  | "QXI-SVG-001"
  | "QXI-SVG-002"
  | "QXI-SVG-003"
  | "QXI-SVG-004"
  | "QXI-SVG-005"
  | "QXI-SVG-006"
  | "QXI-SVG-007"
  | "QXI-SVG-008"
  | "QXI-NAME-001"
  | "QXI-PATH-001"
  | "QXI-PATH-002"
  | "QXI-PATH-003"
  | "QXI-DUP-001"
  | "QXI-DUP-002"
  | "QXI-DUP-003"
  | "QXI-DUP-004"
  | "QXI-IO-001"
  | "QXI-META-001"
  | "QXI-META-002"
  | "QXI-META-003"
  | "QXI-VAR-001"
  | "QXI-STYLE-001"
  | "QXI-GEN-001"
  | "QXI-GEN-002"
  | "QXI-GEN-003";

export type Diagnostic = {
  readonly code: DiagnosticCode;
  readonly file: string;
  readonly message: string;
  readonly severity: "error";
};

export function diagnostic(code: DiagnosticCode, file: string, message: string): Diagnostic {
  return { code, file, message, severity: "error" };
}

export function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function sortDiagnostics(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return [...diagnostics].sort(
    (left, right) =>
      compareText(left.file, right.file) ||
      compareText(left.code, right.code) ||
      compareText(left.message, right.message),
  );
}

export function formatDiagnostics(diagnostics: readonly Diagnostic[]): string {
  return sortDiagnostics(diagnostics)
    .map((entry) => `${entry.code} ${JSON.stringify(entry.file)}\n  ${entry.message}`)
    .join("\n");
}
