import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { execSync } from "node:child_process";

const outDir = path.join(process.cwd(), ".admin-dist");
if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });

const filesToCompile = [
  { in: "src/types/index.ts", out: ".admin-dist/types/index.js" },
  { in: "src/data/mock-data.ts", out: ".admin-dist/data/mock-data.js" },
  { in: "src/lib/db/index.ts", out: ".admin-dist/lib/db/index.js" },
  { in: "src/lib/auth/admin-auth.ts", out: ".admin-dist/lib/auth/admin-auth.js" },
  { in: "scripts/create-admin.ts", out: ".admin-dist/scripts/create-admin.js" }
];

for (const f of filesToCompile) {
  const fullIn = path.join(process.cwd(), f.in);
  const fullOut = path.join(process.cwd(), f.out);
  fs.mkdirSync(path.dirname(fullOut), { recursive: true });

  let code = fs.readFileSync(fullIn, "utf8");

  if (f.in.startsWith("scripts/")) {
    code = code
      .replace(/from\s+["']\.\.\/src\/lib\/db\/index["']/g, 'from "../lib/db/index.js"')
      .replace(/from\s+["']\.\.\/src\/lib\/auth\/admin-auth["']/g, 'from "../lib/auth/admin-auth.js"');
  } else if (f.in.startsWith("src/lib/auth/")) {
    code = code.replace(/from\s+["']@\/lib\/db\/index["']/g, 'from "../db/index.js"');
  } else if (f.in.startsWith("src/lib/db/")) {
    code = code
      .replace(/from\s+["']@\/data\/mock-data["']/g, 'from "../../data/mock-data.js"')
      .replace(/from\s+["']@\/types["']/g, 'from "../../types/index.js"');
  } else if (f.in.startsWith("src/data/")) {
    code = code.replace(/from\s+["']@\/types["']/g, 'from "../types/index.js"');
  }

  const result = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      inlineSourceMap: true
    }
  });
  fs.writeFileSync(fullOut, result.outputText, "utf8");
}

try {
  execSync(`node .admin-dist/scripts/create-admin.js ${process.argv.slice(2).join(" ")}`, {
    stdio: "inherit",
    cwd: process.cwd(),
  });
} catch (e) {
  process.exit(1);
}
