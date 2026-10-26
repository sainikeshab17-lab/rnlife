export function toPostgresPlaceholders(sql: string): string {
  let output = "";
  let parameter = 0;
  let quote: "'" | '"' | null = null;
  let lineComment = false;
  let blockComment = false;

  for (let i = 0; i < sql.length; i += 1) {
    const current = sql[i];
    const next = sql[i + 1];

    if (lineComment) {
      output += current;
      if (current === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      output += current;
      if (current === "*" && next === "/") {
        output += next;
        i += 1;
        blockComment = false;
      }
      continue;
    }
    if (quote) {
      output += current;
      if (current === quote && next === quote) {
        output += next;
        i += 1;
      } else if (current === quote) {
        quote = null;
      }
      continue;
    }

    if (current === "-" && next === "-") {
      output += current + next;
      i += 1;
      lineComment = true;
    } else if (current === "/" && next === "*") {
      output += current + next;
      i += 1;
      blockComment = true;
    } else if (current === "'" || current === '"') {
      quote = current;
      output += current;
    } else if (current === "?") {
      parameter += 1;
      output += `$${parameter}`;
    } else {
      output += current;
    }
  }

  return output;
}

export function safePostgresDiagnostic(sql: string, error: unknown): {
  code: string;
  severity: string;
  category: "capacity" | "authentication" | "connection" | "sql" | "server" | "unknown";
  causeCode: string | null;
  missingRelation: string | null;
  statement: string;
} {
  const record = error && typeof error === "object" ? error as { code?: unknown; message?: unknown; severity?: unknown; cause?: unknown } : {};
  const message = typeof record.message === "string" ? record.message : "";
  const code = typeof record.code === "string" ? record.code : "unknown";
  const cause = record.cause && typeof record.cause === "object" ? record.cause as { code?: unknown } : null;
  const causeCode = cause && typeof cause.code === "string" ? cause.code : null;
  const category = /EMAXCONNSESSION|max clients reached in session mode/i.test(message) || code === "53300"
    ? "capacity"
    : code === "28P01" || code === "28000"
      ? "authentication"
      : code.startsWith("08") || ["ECONNRESET", "ETIMEDOUT", "EPIPE"].includes(code) || (causeCode?.startsWith("08") ?? false)
        ? "connection"
        : code.startsWith("42") || code.startsWith("23")
          ? "sql"
          : code.startsWith("XX")
            ? "server"
            : "unknown";
  const relation = message.match(/relation\s+["']([^"']+)["']\s+does not exist/i)?.[1] ?? null;
  const statement = sql
    .replace(/'(?:''|[^'])*'/g, "'[redacted]'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
  return {
    code,
    severity: typeof record.severity === "string" ? record.severity : "unknown",
    category,
    causeCode,
    missingRelation: relation,
    statement,
  };
}
