import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { execSync } from "node:child_process";

const outDir = path.join(process.cwd(), ".test-dist");
if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true });
}
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "package.json"), JSON.stringify({ type: "module" }));

const filesToCompile = [
  { in: "src/types/index.ts", out: ".test-dist/src/types/index.js" },
  { in: "src/data/mock-data.ts", out: ".test-dist/src/data/mock-data.js" },
  { in: "src/lib/policies.ts", out: ".test-dist/src/lib/policies.js" },
  { in: "src/lib/shipping/provider.ts", out: ".test-dist/src/lib/shipping/provider.js" },
  { in: "src/lib/db/index.ts", out: ".test-dist/src/lib/db/index.js" },
  { in: "src/lib/db/sql.ts", out: ".test-dist/src/lib/db/sql.js" },
  { in: "src/lib/db/orders.ts", out: ".test-dist/src/lib/db/orders.js" },
  { in: "src/lib/db/audit.ts", out: ".test-dist/src/lib/db/audit.js" },
  { in: "src/lib/auth/admin-auth.ts", out: ".test-dist/src/lib/auth/admin-auth.js" },
  { in: "src/lib/order-status-machine.ts", out: ".test-dist/src/lib/order-status-machine.js" },
  { in: "src/lib/razorpay.ts", out: ".test-dist/src/lib/razorpay.js" },
  { in: "src/services/checkout-service.ts", out: ".test-dist/src/services/checkout-service.js" },
  { in: "tests/checkout-and-payment.test.mjs", out: ".test-dist/tests/checkout-and-payment.test.mjs" },
  { in: "tests/admin-and-dashboard.test.mjs", out: ".test-dist/tests/admin-and-dashboard.test.mjs" },
  { in: "tests/shipping-returns-refunds.test.mjs", out: ".test-dist/tests/shipping-returns-refunds.test.mjs" },
  { in: "tests/postgres-test-support.mjs", out: ".test-dist/tests/postgres-test-support.mjs" },
  { in: "tests/postgres-sql.test.mjs", out: ".test-dist/tests/postgres-sql.test.mjs" },
];

for (const f of filesToCompile) {
  const fullIn = path.join(process.cwd(), f.in);
  const fullOut = path.join(process.cwd(), f.out);
  fs.mkdirSync(path.dirname(fullOut), { recursive: true });

  let code = fs.readFileSync(fullIn, "utf8");

  // Fix module aliases and file extensions for native node execution
  if (f.in.startsWith("src/services/")) {
    code = code
      .replace(/from\s+["']@\/data\/mock-data["']/g, 'from "../data/mock-data.js"')
      .replace(/from\s+["']@\/types["']/g, 'from "../types/index.js"');
  } else if (f.in.startsWith("src/lib/auth/")) {
    code = code.replace(/from\s+["']@\/lib\/db\/index["']/g, 'from "../db/index.js"');
  } else if (f.in.startsWith("src/lib/shipping/")) {
    code = code.replace(/from\s+["']@\/lib\/policies["']/g, 'from "../policies.js"');
  } else if (f.in.startsWith("src/lib/db/")) {
    code = code
      .replace(/from\s+["']\.\/sql["']/g, 'from "./sql.js"')
      .replace(/from\s+["']@\/lib\/db\/index["']/g, 'from "./index.js"')
      .replace(/from\s+["']@\/data\/mock-data["']/g, 'from "../../data/mock-data.js"')
      .replace(/from\s+["']@\/types["']/g, 'from "../../types/index.js"')
      .replace(/from\s+["']\.\/index["']/g, 'from "./index.js"');
  } else if (f.in.startsWith("src/data/")) {
    code = code
      .replace(/from\s+["']@\/types["']/g, 'from "../types/index.js"');
  } else if (f.in.startsWith("tests/")) {
    code = code
      .replace(/from\s+["']\.\.\/src\/services\/checkout-service\.ts["']/g, 'from "../src/services/checkout-service.js"')
      .replace(/from\s+["']\.\.\/src\/lib\/policies\.ts["']/g, 'from "../src/lib/policies.js"')
      .replace(/from\s+["']\.\.\/src\/lib\/shipping\/provider\.ts["']/g, 'from "../src/lib/shipping/provider.js"')
      .replace(/from\s+["']\.\.\/src\/lib\/razorpay\.ts["']/g, 'from "../src/lib/razorpay.js"')
      .replace(/from\s+["']\.\.\/src\/lib\/db\/orders\.ts["']/g, 'from "../src/lib/db/orders.js"')
      .replace(/from\s+["']\.\.\/src\/lib\/db\/index\.ts["']/g, 'from "../src/lib/db/index.js"')
      .replace(/from\s+["']\.\.\/src\/lib\/db\/sql\.ts["']/g, 'from "../src/lib/db/sql.js"')
      .replace(/from\s+["']\.\.\/src\/lib\/db\/audit\.ts["']/g, 'from "../src/lib/db/audit.js"')
      .replace(/from\s+["']\.\.\/src\/lib\/auth\/admin-auth\.ts["']/g, 'from "../src/lib/auth/admin-auth.js"')
      .replace(/from\s+["']\.\.\/src\/lib\/order-status-machine\.ts["']/g, 'from "../src/lib/order-status-machine.js"')
      .replace(/from\s+["']\.\.\/src\/data\/mock-data\.ts["']/g, 'from "../src/data/mock-data.js"');
  }

  if (f.in.endsWith(".ts")) {
    const result = ts.transpileModule(code, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        inlineSourceMap: true
      }
    });
    fs.writeFileSync(fullOut, result.outputText, "utf8");
  } else {
    fs.writeFileSync(fullOut, code, "utf8");
  }
}

const serverOnlyStub = path.join(outDir, "node_modules", "server-only");
fs.mkdirSync(serverOnlyStub, { recursive: true });
fs.writeFileSync(
  path.join(serverOnlyStub, "package.json"),
  JSON.stringify({ type: "module", exports: "./index.js" })
);
fs.writeFileSync(path.join(serverOnlyStub, "index.js"), "export {};\n");

console.log("Transpiled test build ready in .test-dist. Running node test suite sequentially...");
try {
  execSync("node --test tests/postgres-migration.test.mjs tests/postgres-import.test.mjs tests/postgres-migration-runner.test.mjs tests/postgres-sql.test.mjs", {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  execSync("node --conditions=react-server --test .test-dist/tests/checkout-and-payment.test.mjs", {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  execSync("node --conditions=react-server --test .test-dist/tests/admin-and-dashboard.test.mjs", {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  execSync("node --conditions=react-server --test .test-dist/tests/shipping-returns-refunds.test.mjs", {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  console.log("\nAll automated test suites completed; see TAP totals for passed, failed, and skipped tests.");
} catch (e) {
  console.error("Test execution failed:", e.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(outDir, { recursive: true, force: true });
}
