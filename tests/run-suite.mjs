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
  { in: "src/data/product-categories.ts", out: ".test-dist/src/data/product-categories.js" },
  { in: "src/data/mock-data.ts", out: ".test-dist/src/data/mock-data.js" },
  { in: "src/lib/policies.ts", out: ".test-dist/src/lib/policies.js" },
  { in: "src/lib/support-contact.ts", out: ".test-dist/src/lib/support-contact.js" },
  { in: "src/lib/shipping/provider.ts", out: ".test-dist/src/lib/shipping/provider.js" },
  { in: "src/lib/db/index.ts", out: ".test-dist/src/lib/db/index.js" },
  { in: "src/lib/db/sql.ts", out: ".test-dist/src/lib/db/sql.js" },
  { in: "src/lib/db/orders.ts", out: ".test-dist/src/lib/db/orders.js" },
  { in: "src/lib/db/audit.ts", out: ".test-dist/src/lib/db/audit.js" },
  { in: "src/lib/auth/admin-auth.ts", out: ".test-dist/src/lib/auth/admin-auth.js" },
  { in: "src/lib/order-status-machine.ts", out: ".test-dist/src/lib/order-status-machine.js" },
  { in: "src/lib/razorpay.ts", out: ".test-dist/src/lib/razorpay.js" },
  { in: "src/services/checkout-service.ts", out: ".test-dist/src/services/checkout-service.js" },
  { in: "src/services/mood-quotes.ts", out: ".test-dist/src/services/mood-quotes.js" },
  { in: "src/services/wear-your-mood-preview.ts", out: ".test-dist/src/services/wear-your-mood-preview.js" },
  { in: "src/services/customer-orders-api.ts", out: ".test-dist/src/services/customer-orders-api.js" },
  { in: "src/services/checkout-idempotency.ts", out: ".test-dist/src/services/checkout-idempotency.js" },
  { in: "src/services/razorpay-order-recovery.ts", out: ".test-dist/src/services/razorpay-order-recovery.js" },
  { in: "src/services/order-payment-state.ts", out: ".test-dist/src/services/order-payment-state.js" },
  { in: "src/services/notification-service.ts", out: ".test-dist/src/services/notification-service.js" },
  { in: "src/services/contact-submission.ts", out: ".test-dist/src/services/contact-submission.js" },
  { in: "src/services/refund-reconciliation.ts", out: ".test-dist/src/services/refund-reconciliation.js" },
  { in: "src/services/refund-reconciliation-route.ts", out: ".test-dist/src/services/refund-reconciliation-route.js" },
  { in: "tests/checkout-and-payment.test.mjs", out: ".test-dist/tests/checkout-and-payment.test.mjs" },
  { in: "tests/mood-quotes.test.mjs", out: ".test-dist/tests/mood-quotes.test.mjs" },
  { in: "tests/wear-your-mood-preview.test.mjs", out: ".test-dist/tests/wear-your-mood-preview.test.mjs" },
  { in: "tests/customer-orders-api.test.mjs", out: ".test-dist/tests/customer-orders-api.test.mjs" },
  { in: "tests/contact-submission.test.mjs", out: ".test-dist/tests/contact-submission.test.mjs" },
  { in: "tests/admin-and-dashboard.test.mjs", out: ".test-dist/tests/admin-and-dashboard.test.mjs" },
  { in: "tests/shipping-returns-refunds.test.mjs", out: ".test-dist/tests/shipping-returns-refunds.test.mjs" },
  { in: "tests/refund-reconciliation.test.mjs", out: ".test-dist/tests/refund-reconciliation.test.mjs" },
  { in: "tests/refund-reconciliation-route.test.mjs", out: ".test-dist/tests/refund-reconciliation-route.test.mjs" },
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
      .replace(/from\s+["']@\/types["']/g, 'from "../types/index.js"')
      .replace(/from\s+["']@\/lib\/db["']/g, 'from "../lib/db/index.js"');
    code = code.replace(/from\s+["']@\/lib\/db\/sql["']/g, 'from "../lib/db/sql.js"');
    code = code.replace(/from\s+["']@\/lib\/support-contact["']/g, 'from "../lib/support-contact.js"');
    if (f.in === "src/services/refund-reconciliation-route.ts") {
      code = code
        .replace(/from\s+["']next\/server["']/g, 'from "../../test-next-server.js"')
        .replace(/from\s+["']@\/lib\/auth\/admin-auth["']/g, 'from "../lib/auth/admin-auth.js"')
        .replace(/from\s+["']@\/lib\/db\/orders["']/g, 'from "../lib/db/orders.js"')
        .replace(/from\s+["']@\/lib\/razorpay["']/g, 'from "../lib/razorpay.js"')
        .replace(/from\s+["']@\/services\/notification-service["']/g, 'from "./notification-service.js"')
        .replace(/from\s+["']@\/services\/refund-reconciliation["']/g, 'from "./refund-reconciliation.js"')
        .replace(/from\s+["']@\/lib\/db\/audit["']/g, 'from "../lib/db/audit.js"');
    }
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
      .replace(/from\s+["']@\/lib\/order-status-machine["']/g, 'from "../order-status-machine.js"')
      .replace(/from\s+["']\.\/index["']/g, 'from "./index.js"');
  } else if (f.in.startsWith("src/data/")) {
  code = code
    .replace(/from\s+["']@\/types["']/g, 'from "../types/index.js"')
    .replace(/from\s+["']@\/lib\/support-contact["']/g, 'from "../lib/support-contact.js"')
    .replace(
      /from\s+["']@\/data\/product-categories["']/g,
      'from "./product-categories.js"'
    );
  } else if (f.in.startsWith("tests/")) {
    code = code
      .replace(/from\s+["']\.\.\/src\/services\/checkout-service\.ts["']/g, 'from "../src/services/checkout-service.js"')
      .replace(/from\s+["']\.\.\/src\/services\/mood-quotes\.ts["']/g, 'from "../src/services/mood-quotes.js"')
      .replace(/from\s+["']\.\.\/src\/services\/wear-your-mood-preview\.ts["']/g, 'from "../src/services/wear-your-mood-preview.js"')
      .replace(/from\s+["']\.\.\/src\/services\/customer-orders-api\.ts["']/g, 'from "../src/services/customer-orders-api.js"')
      .replace(/from\s+["']\.\.\/src\/services\/contact-submission\.ts["']/g, 'from "../src/services/contact-submission.js"')
      .replace(/from\s+["']\.\.\/src\/services\/checkout-idempotency\.ts["']/g, 'from "../src/services/checkout-idempotency.js"')
      .replace(/from\s+["']\.\.\/src\/services\/razorpay-order-recovery\.ts["']/g, 'from "../src/services/razorpay-order-recovery.js"')
      .replace(/from\s+["']\.\.\/src\/services\/order-payment-state\.ts["']/g, 'from "../src/services/order-payment-state.js"')
      .replace(/from\s+["']\.\.\/src\/services\/notification-service\.ts["']/g, 'from "../src/services/notification-service.js"')
      .replace(/from\s+["']\.\.\/src\/services\/contact-submission\.ts["']/g, 'from "../src/services/contact-submission.js"')
      .replace(/from\s+["']\.\.\/src\/services\/refund-reconciliation\.ts["']/g, 'from "../src/services/refund-reconciliation.js"')
      .replace(/from\s+["']\.\.\/src\/services\/refund-reconciliation-route\.ts["']/g, 'from "../src/services/refund-reconciliation-route.js"')
      .replace(/from\s+["']\.\.\/src\/lib\/policies\.ts["']/g, 'from "../src/lib/policies.js"')
      .replace(/from\s+["']\.\.\/src\/lib\/support-contact\.ts["']/g, 'from "../src/lib/support-contact.js"')
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
fs.writeFileSync(path.join(outDir, "test-next-server.js"), `export class NextResponse extends Response {\n  static json(body, init = {}) {\n    const headers = new Headers(init.headers);\n    headers.set("content-type", "application/json");\n    return new Response(JSON.stringify(body), { ...init, headers });\n  }\n}\n`);

console.log("Transpiled test build ready in .test-dist. Running node test suite sequentially...");
try {
  execSync("node --test tests/postgres-migration.test.mjs tests/postgres-import.test.mjs tests/postgres-migration-runner.test.mjs tests/postgres-sql.test.mjs", {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  execSync("node --test tests/cart-add-notification.test.mjs", {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  execSync("node --test tests/mobile-navigation.test.mjs", {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  execSync("node --conditions=react-server --test .test-dist/tests/checkout-and-payment.test.mjs", {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  execSync("node --conditions=react-server --test .test-dist/tests/mood-quotes.test.mjs", {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  execSync("node --conditions=react-server --test .test-dist/tests/wear-your-mood-preview.test.mjs", {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  execSync("node --conditions=react-server --test .test-dist/tests/customer-orders-api.test.mjs", {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  execSync("node --conditions=react-server --test .test-dist/tests/contact-submission.test.mjs", {
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
  execSync("node --conditions=react-server --test .test-dist/tests/refund-reconciliation.test.mjs", {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  execSync("node --conditions=react-server --test .test-dist/tests/refund-reconciliation-route.test.mjs", {
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
