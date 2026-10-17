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
