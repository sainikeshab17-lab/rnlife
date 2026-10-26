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
  { in: "src/lib/db/shiprocket-operation-guard.ts", out: ".test-dist/src/lib/db/shiprocket-operation-guard.js" },
  { in: "src/lib/db/audit.ts", out: ".test-dist/src/lib/db/audit.js" },
  { in: "src/lib/auth/admin-auth.ts", out: ".test-dist/src/lib/auth/admin-auth.js" },
  { in: "src/lib/auth/admin-login-rate-limit.ts", out: ".test-dist/src/lib/auth/admin-login-rate-limit.js" },
  { in: "src/lib/auth/admin-route-gate.ts", out: ".test-dist/src/lib/auth/admin-route-gate.js" },
  { in: "src/lib/order-status-machine.ts", out: ".test-dist/src/lib/order-status-machine.js" },
  { in: "src/lib/razorpay.ts", out: ".test-dist/src/lib/razorpay.js" },
  { in: "src/lib/shiprocket/client.ts", out: ".test-dist/src/lib/shiprocket/client.js" },
  { in: "src/services/shiprocket/serviceability-service.ts", out: ".test-dist/src/services/shiprocket/serviceability-service.js" },
  { in: "src/services/shiprocket/serviceability-route-handler.ts", out: ".test-dist/src/services/shiprocket/serviceability-route-handler.js" },
  { in: "src/services/admin-me-route.ts", out: ".test-dist/src/services/admin-me-route.js" },
  { in: "src/services/admin-login-route.ts", out: ".test-dist/src/services/admin-login-route.js" },
  { in: "src/services/shiprocket/shipping-service.ts", out: ".test-dist/src/services/shiprocket/shipping-service.js" },
  { in: "src/services/shiprocket/shipment-preparation.ts", out: ".test-dist/src/services/shiprocket/shipment-preparation.js" },
  { in: "src/services/shiprocket/shipping-route-handler.ts", out: ".test-dist/src/services/shiprocket/shipping-route-handler.js" },
  { in: "src/services/shiprocket/shipment-preparation-route-handler.ts", out: ".test-dist/src/services/shiprocket/shipment-preparation-route-handler.js" },
  { in: "src/services/checkout-service.ts", out: ".test-dist/src/services/checkout-service.js" },
  { in: "src/services/inventory-product-catalog.ts", out: ".test-dist/src/services/inventory-product-catalog.js" },
  { in: "src/services/admin-orders-list.ts", out: ".test-dist/src/services/admin-orders-list.js" },
  { in: "src/services/checkout-payment-attempts.ts", out: ".test-dist/src/services/checkout-payment-attempts.js" },
  { in: "src/services/mood-quotes.ts", out: ".test-dist/src/services/mood-quotes.js" },
  { in: "src/services/wear-your-mood-preview.ts", out: ".test-dist/src/services/wear-your-mood-preview.js" },
  { in: "src/services/customer-orders-api.ts", out: ".test-dist/src/services/customer-orders-api.js" },
  { in: "src/services/checkout-idempotency.ts", out: ".test-dist/src/services/checkout-idempotency.js" },
  { in: "src/services/razorpay-order-recovery.ts", out: ".test-dist/src/services/razorpay-order-recovery.js" },
  { in: "src/services/order-payment-state.ts", out: ".test-dist/src/services/order-payment-state.js" },
  { in: "src/services/notification-service.ts", out: ".test-dist/src/services/notification-service.js" },
  { in: "src/services/twilio-whatsapp.ts", out: ".test-dist/src/services/twilio-whatsapp.js" },
  { in: "src/services/admin-notification-route.ts", out: ".test-dist/src/services/admin-notification-route.js" },
  { in: "src/services/contact-submission.ts", out: ".test-dist/src/services/contact-submission.js" },
  { in: "src/services/refund-reconciliation.ts", out: ".test-dist/src/services/refund-reconciliation.js" },
  { in: "src/services/refund-reconciliation-route.ts", out: ".test-dist/src/services/refund-reconciliation-route.js" },
  { in: "src/services/whatsapp-webhook.ts", out: ".test-dist/src/services/whatsapp-webhook.js" },
  { in: "src/services/razorpay/refund-webhook-inbox-policy.ts", out: ".test-dist/src/services/razorpay/refund-webhook-inbox-policy.js" },
  { in: "src/services/razorpay/refund-webhook-inbox.ts", out: ".test-dist/src/services/razorpay/refund-webhook-inbox.js" },
  { in: "tests/checkout-and-payment.test.mjs", out: ".test-dist/tests/checkout-and-payment.test.mjs" },
  { in: "tests/mood-quotes.test.mjs", out: ".test-dist/tests/mood-quotes.test.mjs" },
  { in: "tests/wear-your-mood-preview.test.mjs", out: ".test-dist/tests/wear-your-mood-preview.test.mjs" },
  { in: "tests/customer-orders-api.test.mjs", out: ".test-dist/tests/customer-orders-api.test.mjs" },
  { in: "tests/contact-submission.test.mjs", out: ".test-dist/tests/contact-submission.test.mjs" },
  { in: "tests/admin-and-dashboard.test.mjs", out: ".test-dist/tests/admin-and-dashboard.test.mjs" },
  { in: "tests/admin-me-route.test.mjs", out: ".test-dist/tests/admin-me-route.test.mjs" },
  { in: "tests/admin-session-shipping-flow.test.mjs", out: ".test-dist/tests/admin-session-shipping-flow.test.mjs" },
  { in: "tests/admin-login-rate-limit.test.mjs", out: ".test-dist/tests/admin-login-rate-limit.test.mjs" },
  { in: "tests/shipping-returns-refunds.test.mjs", out: ".test-dist/tests/shipping-returns-refunds.test.mjs" },
  { in: "tests/refund-reconciliation.test.mjs", out: ".test-dist/tests/refund-reconciliation.test.mjs" },
  { in: "tests/refund-reconciliation-route.test.mjs", out: ".test-dist/tests/refund-reconciliation-route.test.mjs" },
  { in: "tests/whatsapp-webhook.test.mjs", out: ".test-dist/tests/whatsapp-webhook.test.mjs" },
  { in: "tests/refund-webhook-inbox.test.mjs", out: ".test-dist/tests/refund-webhook-inbox.test.mjs" },
  { in: "tests/refund-webhook-inbox-policy.test.mjs", out: ".test-dist/tests/refund-webhook-inbox-policy.test.mjs" },
  { in: "tests/notification-service.test.mjs", out: ".test-dist/tests/notification-service.test.mjs" },
  { in: "tests/twilio-whatsapp.test.mjs", out: ".test-dist/tests/twilio-whatsapp.test.mjs" },
  { in: "tests/admin-notification-route.test.mjs", out: ".test-dist/tests/admin-notification-route.test.mjs" },
  { in: "tests/shiprocket-client.test.mjs", out: ".test-dist/tests/shiprocket-client.test.mjs" },
  { in: "tests/shiprocket-serviceability.test.mjs", out: ".test-dist/tests/shiprocket-serviceability.test.mjs" },
  { in: "tests/shiprocket-serviceability-route.test.mjs", out: ".test-dist/tests/shiprocket-serviceability-route.test.mjs" },
  { in: "tests/shiprocket-shipping-service.test.mjs", out: ".test-dist/tests/shiprocket-shipping-service.test.mjs" },
  { in: "tests/shiprocket-shipping-route.test.mjs", out: ".test-dist/tests/shiprocket-shipping-route.test.mjs" },
  { in: "tests/shiprocket-shipment-preparation.test.mjs", out: ".test-dist/tests/shiprocket-shipment-preparation.test.mjs" },
  { in: "tests/storefront-upgrade.test.mjs", out: ".test-dist/tests/storefront-upgrade.test.mjs" },
  { in: "tests/postgres-test-support.mjs", out: ".test-dist/tests/postgres-test-support.mjs" },
  { in: "tests/postgres-test-database-gate.mjs", out: ".test-dist/tests/postgres-test-database-gate.mjs" },
  { in: "tests/postgres-sql.test.mjs", out: ".test-dist/tests/postgres-sql.test.mjs" },
];

for (const f of filesToCompile) {
  const fullIn = path.join(process.cwd(), f.in);
  const fullOut = path.join(process.cwd(), f.out);
  fs.mkdirSync(path.dirname(fullOut), { recursive: true });

  let code = fs.readFileSync(fullIn, "utf8");

  // Fix module aliases and file extensions for native node execution
  if (f.in === "src/services/razorpay/refund-webhook-inbox.ts") {
    code = code
      .replace(/from\s+["']@\/lib\/db["']/g, 'from "../../../test-refund-webhook-inbox-deps.js"')
      .replace(/from\s+["']@\/lib\/db\/orders["']/g, 'from "../../../test-refund-webhook-inbox-deps.js"')
      .replace(/from\s+["']@\/lib\/db\/shiprocket-operation-guard["']/g, 'from "../../../test-refund-webhook-inbox-deps.js"')
      .replace(/from\s+["']@\/lib\/order-status-machine["']/g, 'from "../../../test-refund-webhook-inbox-deps.js"')
      .replace(/from\s+["']\.\/refund-webhook-inbox-policy["']/g, 'from "./refund-webhook-inbox-policy.js"');
  }
  if (f.in.startsWith("src/services/")) {
    code = code
      .replace(/from\s+["']@\/data\/mock-data["']/g, 'from "../data/mock-data.js"')
      .replace(/from\s+["']@\/types["']/g, 'from "../types/index.js"')
      .replace(/from\s+["']@\/lib\/db["']/g, 'from "../lib/db/index.js"');
    code = code.replace(/from\s+["']@\/lib\/db\/sql["']/g, 'from "../lib/db/sql.js"');
    code = code.replace(/from\s+["']@\/lib\/support-contact["']/g, 'from "../lib/support-contact.js"');
    code = code
      .replace(/from\s+["']@\/lib\/db\/orders["']/g, 'from "../lib/db/orders.js"')
      .replace(/from\s+["']@\/lib\/razorpay["']/g, 'from "../lib/razorpay.js"')
      .replace(/from\s+["']@\/services\/checkout-service["']/g, 'from "./checkout-service.js"');
    code = code.replace(/from\s+["']@\/services\/razorpay-order-recovery["']/g, 'from "./razorpay-order-recovery.js"');
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
    if (f.in === "src/services/shiprocket/shipping-service.ts") {
      code = code
        .replace('from "../lib/db/index.js"', 'from "../../lib/db/index.js"')
        .replace(/from\s+["']@\/lib\/policies["']/g, 'from "../../lib/policies.js"')
        .replace(/from\s+["']@\/lib\/db\/shiprocket-operation-guard["']/g, 'from "../../lib/db/shiprocket-operation-guard.js"')
        .replace(/from\s+["']@\/lib\/shiprocket\/client["']/g, 'from "../../lib/shiprocket/client.js"')
        .replace(/from\s+["']@\/services\/shiprocket\/shipment-preparation["']/g, 'from "./shipment-preparation.js"');
    }
    if (f.in === "src/services/shiprocket/shipping-route-handler.ts") {
      code = code
        .replace(/from\s+["']next\/server["']/g, 'from "../../../test-next-server.js"')
        .replace(/from\s+["']@\/lib\/auth\/admin-auth["']/g, 'from "../../../test-shiprocket-route-deps.js"')
        .replace(/from\s+["']@\/lib\/shiprocket\/client["']/g, 'from "../../../test-shiprocket-route-deps.js"')
        .replace(/from\s+["']@\/services\/shiprocket\/shipping-service["']/g, 'from "../../../test-shiprocket-route-deps.js"');
    }
    if (f.in === "src/services/shiprocket/serviceability-service.ts") {
      code = code.replace(/from\s+["']@\/lib\/shiprocket\/client["']/g, 'from "../../lib/shiprocket/client.js"');
    }
    if (f.in === "src/services/shiprocket/shipment-preparation.ts") {
      code = code
        .replace('from "../lib/db/index.js"', 'from "../../lib/db/index.js"')
        .replace(/from\s+["']@\/lib\/shiprocket\/client["']/g, 'from "../../lib/shiprocket/client.js"');
    }
    if (f.in === "src/services/shiprocket/serviceability-route-handler.ts") {
      code = code
        .replace(/from\s+["']next\/server["']/g, 'from "../../../test-next-server.js"')
        .replace(/from\s+["']@\/lib\/auth\/admin-auth["']/g, 'from "../../../test-shiprocket-route-deps.js"')
        .replace(/from\s+["']@\/lib\/shiprocket\/client["']/g, 'from "../../../test-shiprocket-route-deps.js"')
        .replace(/from\s+["']@\/services\/shiprocket\/serviceability-service["']/g, 'from "../../../test-shiprocket-route-deps.js"');
    }
    if (f.in === "src/services/shiprocket/shipment-preparation-route-handler.ts") {
      code = code
        .replace(/from\s+["']next\/server["']/g, 'from "../../../test-next-server.js"')
        .replace(/from\s+["']@\/lib\/auth\/admin-auth["']/g, 'from "../../../test-shiprocket-route-deps.js"')
        .replace(/from\s+["']@\/lib\/shiprocket\/client["']/g, 'from "../../../test-shiprocket-route-deps.js"')
        .replace(/from\s+["']@\/services\/shiprocket\/shipment-preparation["']/g, 'from "../../../test-shiprocket-route-deps.js"');
    }
    if (f.in === "src/services/admin-me-route.ts") {
      code = code
        .replace(/from\s+["']next\/server["']/g, 'from "../../test-next-server.js"')
        .replace(/from\s+["']@\/lib\/auth\/admin-auth["']/g, 'from "../../test-admin-auth-deps.js"');
    }
    if (f.in === "src/services/admin-login-route.ts") {
      code = code
        .replace(/from\s+["']next\/server["']/g, 'from "../../test-next-server.js"')
        .replace(/from\s+["']@\/lib\/auth\/admin-auth["']/g, 'from "../lib/auth/admin-auth.js"')
        .replace(/from\s+["']@\/lib\/auth\/admin-login-rate-limit["']/g, 'from "../lib/auth/admin-login-rate-limit.js"')
        .replace(/from\s+["']@\/lib\/db\/audit["']/g, 'from "../lib/db/audit.js"');
    }
    if (f.in === "src/services/admin-notification-route.ts") {
      code = code.replace(/from\s+["']next\/server["']/g, 'from "../../test-next-server.js"');
    }
    if (f.in === "src/services/twilio-whatsapp.ts") {
      code = code.replace(/from\s+["']@\/lib\/db["']/g, 'from "../lib/db/index.js"');
    }
    if (f.in === "src/services/notification-service.ts") {
      code = code.replace(/from\s+["']@\/services\/twilio-whatsapp["']/g, 'from "./twilio-whatsapp.js"');
    }
  } else if (f.in === "src/services/shiprocket/shipping-route-handler.ts") {
    const routeStubs = path.relative(path.dirname(fullOut), path.join(outDir, "test-shiprocket-route-deps.js")).replace(/\\/g, "/");
    const nextStub = path.relative(path.dirname(fullOut), path.join(outDir, "test-next-server.js")).replace(/\\/g, "/");
    const routeSpecifier = routeStubs.startsWith(".") ? routeStubs : `./${routeStubs}`;
    const nextSpecifier = nextStub.startsWith(".") ? nextStub : `./${nextStub}`;
    code = code
      .replace(/from\s+["']next\/server["']/g, `from "${nextSpecifier}"`)
      .replace(/from\s+["']@\/lib\/auth\/admin-auth["']/g, `from "${routeSpecifier}"`)
      .replace(/from\s+["']@\/lib\/shiprocket\/client["']/g, `from "${routeSpecifier}"`)
      .replace(/from\s+["']@\/services\/shiprocket\/shipping-service["']/g, `from "${routeSpecifier}"`);
  } else if (f.in === "src/services/shiprocket/serviceability-route-handler.ts") {
    const routeStubs = path.relative(path.dirname(fullOut), path.join(outDir, "test-shiprocket-route-deps.js")).replace(/\\/g, "/");
    const nextStub = path.relative(path.dirname(fullOut), path.join(outDir, "test-next-server.js")).replace(/\\/g, "/");
    const routeSpecifier = routeStubs.startsWith(".") ? routeStubs : `./${routeStubs}`;
    const nextSpecifier = nextStub.startsWith(".") ? nextStub : `./${nextStub}`;
    code = code
      .replace(/from\s+["']next\/server["']/g, `from "${nextSpecifier}"`)
      .replace(/from\s+["']@\/lib\/auth\/admin-auth["']/g, `from "${routeSpecifier}"`)
      .replace(/from\s+["']@\/lib\/shiprocket\/client["']/g, `from "${routeSpecifier}"`)
      .replace(/from\s+["']@\/services\/shiprocket\/serviceability-service["']/g, `from "${routeSpecifier}"`);
  } else if (f.in === "src/services/admin-me-route.ts") {
    const authStub = path.relative(path.dirname(fullOut), path.join(outDir, "test-admin-auth-deps.js")).replace(/\\/g, "/");
    const nextStub = path.relative(path.dirname(fullOut), path.join(outDir, "test-next-server.js")).replace(/\\/g, "/");
    code = code
      .replace(/from\s+["']next\/server["']/g, `from "${nextStub.startsWith(".") ? nextStub : `./${nextStub}`}"`)
      .replace(/from\s+["']@\/lib\/auth\/admin-auth["']/g, `from "${authStub.startsWith(".") ? authStub : `./${authStub}`}"`);
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
      .replace(/from\s+["']@\/lib\/policies["']/g, 'from "../policies.js"')
      .replace(/from\s+["']\.\/shiprocket-operation-guard["']/g, 'from "./shiprocket-operation-guard.js"')
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
      .replace(/from\s+["']\.\.\/src\/services\/admin-login-route\.ts["']/g, 'from "../src/services/admin-login-route.js"')
      .replace(/from\s+["']\.\.\/src\/services\/checkout-service\.ts["']/g, 'from "../src/services/checkout-service.js"')
      .replace(/from\s+["']\.\.\/src\/services\/inventory-product-catalog\.ts["']/g, 'from "../src/services/inventory-product-catalog.js"')
      .replace(/from\s+["']\.\.\/src\/services\/admin-orders-list\.ts["']/g, 'from "../src/services/admin-orders-list.js"')
      .replace(/from\s+["']\.\.\/src\/services\/checkout-payment-attempts\.ts["']/g, 'from "../src/services/checkout-payment-attempts.js"')
      .replace(/from\s+["']\.\.\/src\/lib\/shiprocket\/client\.ts["']/g, 'from "../src/lib/shiprocket/client.js"')
      .replace(/from\s+["']\.\.\/src\/services\/shiprocket\/shipping-service\.ts["']/g, 'from "../src/services/shiprocket/shipping-service.js"')
      .replace(/from\s+["']\.\.\/src\/services\/shiprocket\/shipment-preparation\.ts["']/g, 'from "../src/services/shiprocket/shipment-preparation.js"')
      .replace(/from\s+["']\.\.\/src\/services\/shiprocket\/shipment-preparation\.ts["']/g, 'from "../src/services/shiprocket/shipment-preparation.js"')
      .replace(/from\s+["']\.\.\/src\/services\/shiprocket\/shipment-preparation-route-handler\.ts["']/g, 'from "../src/services/shiprocket/shipment-preparation-route-handler.js"')
      .replace(/from\s+["']\.\.\/src\/app\/api\/admin\/orders\/\[id\]\/shipping\/route\.ts["']/g, 'from "../src/services/shiprocket/shipping-route-handler.js"')
      .replace(/from\s+["']\.\.\/src\/services\/shiprocket\/shipping-route-handler\.ts["']/g, 'from "../src/services/shiprocket/shipping-route-handler.js"')
      .replace(/from\s+["']\.\.\/src\/services\/shiprocket\/serviceability-service\.ts["']/g, 'from "../src/services/shiprocket/serviceability-service.js"')
      .replace(/from\s+["']\.\.\/src\/services\/shiprocket\/serviceability-route-handler\.ts["']/g, 'from "../src/services/shiprocket/serviceability-route-handler.js"')
      .replace(/from\s+["']\.\.\/src\/services\/admin-me-route\.ts["']/g, 'from "../src/services/admin-me-route.js"')
      .replace(/from\s+["']\.\.\/src\/services\/mood-quotes\.ts["']/g, 'from "../src/services/mood-quotes.js"')
      .replace(/from\s+["']\.\.\/src\/services\/wear-your-mood-preview\.ts["']/g, 'from "../src/services/wear-your-mood-preview.js"')
      .replace(/from\s+["']\.\.\/src\/services\/customer-orders-api\.ts["']/g, 'from "../src/services/customer-orders-api.js"')
      .replace(/from\s+["']\.\.\/src\/services\/contact-submission\.ts["']/g, 'from "../src/services/contact-submission.js"')
      .replace(/from\s+["']\.\.\/src\/services\/checkout-idempotency\.ts["']/g, 'from "../src/services/checkout-idempotency.js"')
      .replace(/from\s+["']\.\.\/src\/services\/razorpay-order-recovery\.ts["']/g, 'from "../src/services/razorpay-order-recovery.js"')
      .replace(/from\s+["']\.\.\/src\/services\/order-payment-state\.ts["']/g, 'from "../src/services/order-payment-state.js"')
      .replace(/from\s+["']\.\.\/src\/services\/notification-service\.ts["']/g, 'from "../src/services/notification-service.js"')
      .replace(/from\s+["']\.\.\/src\/services\/twilio-whatsapp\.ts["']/g, 'from "../src/services/twilio-whatsapp.js"')
      .replace(/from\s+["']\.\.\/src\/services\/contact-submission\.ts["']/g, 'from "../src/services/contact-submission.js"')
      .replace(/from\s+["']\.\.\/src\/services\/refund-reconciliation\.ts["']/g, 'from "../src/services/refund-reconciliation.js"')
      .replace(/from\s+["']\.\.\/src\/services\/refund-reconciliation-route\.ts["']/g, 'from "../src/services/refund-reconciliation-route.js"')
      .replace(/from\s+["']\.\.\/src\/services\/whatsapp-webhook\.ts["']/g, 'from "../src/services/whatsapp-webhook.js"')
      .replace(/from\s+["']\.\.\/src\/services\/razorpay\/refund-webhook-inbox-policy\.ts["']/g, 'from "../src/services/razorpay/refund-webhook-inbox-policy.js"')
      .replace(/from\s+["']\.\.\/src\/services\/razorpay\/refund-webhook-inbox\.ts["']/g, 'from "../src/services/razorpay/refund-webhook-inbox.js"')
      .replace(/from\s+["']\.\.\/src\/services\/admin-notification-route\.ts["']/g, 'from "../src/services/admin-notification-route.js"')
      .replace(/from\s+["']\.\.\/src\/lib\/policies\.ts["']/g, 'from "../src/lib/policies.js"')
      .replace(/from\s+["']\.\.\/src\/lib\/support-contact\.ts["']/g, 'from "../src/lib/support-contact.js"')
      .replace(/from\s+["']\.\.\/src\/lib\/shipping\/provider\.ts["']/g, 'from "../src/lib/shipping/provider.js"')
      .replace(/from\s+["']\.\.\/src\/lib\/razorpay\.ts["']/g, 'from "../src/lib/razorpay.js"')
      .replace(/from\s+["']\.\.\/src\/lib\/db\/orders\.ts["']/g, 'from "../src/lib/db/orders.js"')
      .replace(/from\s+["']\.\.\/src\/lib\/db\/index\.ts["']/g, 'from "../src/lib/db/index.js"')
      .replace(/from\s+["']\.\.\/src\/lib\/db\/sql\.ts["']/g, 'from "../src/lib/db/sql.js"')
      .replace(/from\s+["']\.\.\/src\/lib\/db\/audit\.ts["']/g, 'from "../src/lib/db/audit.js"')
      .replace(/from\s+["']\.\.\/src\/lib\/auth\/admin-auth\.ts["']/g, 'from "../src/lib/auth/admin-auth.js"')
      .replace(/from\s+["']\.\.\/src\/lib\/auth\/admin-login-rate-limit\.ts["']/g, 'from "../src/lib/auth/admin-login-rate-limit.js"')
      .replace(/from\s+["']\.\.\/src\/lib\/auth\/admin-route-gate\.ts["']/g, 'from "../src/lib/auth/admin-route-gate.js"')
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
fs.writeFileSync(path.join(outDir, "test-next-server.js"), `export class NextResponse extends Response {\n  static json(body, init = {}) {\n    const headers = new Headers(init.headers);\n    headers.set("content-type", "application/json");\n    const response = new Response(JSON.stringify(body), { ...init, headers });\n    response.cookies = { set(name, value, options = {}) { const bits = [name + "=" + value, "Path=" + (options.path || "/")]; if (options.maxAge !== undefined) bits.push("Max-Age=" + options.maxAge); if (options.httpOnly) bits.push("HttpOnly"); if (options.secure) bits.push("Secure"); if (options.sameSite) bits.push("SameSite=" + options.sameSite); response.headers.append("set-cookie", bits.join("; ")); } };\n    return response;\n  }\n}\n`);
fs.writeFileSync(path.join(outDir, "test-admin-auth-deps.js"), `export async function requireAdminAuth() { return null; }\n`);
fs.writeFileSync(path.join(outDir, "test-shiprocket-route-deps.js"), `export async function requireAdminAuth() { return null; }\nexport function shiprocketEnabled() { return false; }\nexport function shiprocketServiceabilityEnabled() { return false; }\nexport class ShiprocketError extends Error {}\nexport async function assignShipmentAwb() {}\nexport async function createOrResumeShipment() {}\nexport async function generateShipmentLabel() {}\nexport async function scheduleShipmentPickup() {}\nexport async function checkShiprocketServiceability() {}\nexport async function prepareShiprocketShipment() {}\n`);
fs.writeFileSync(path.join(outDir, "test-refund-webhook-inbox-deps.js"), `export function getDb() { throw new Error("Unexpected database access in inbox unit test"); }\nexport async function withTransaction(callback) { throw new Error("Unexpected default transaction in inbox unit test"); }\nexport async function recordRefund() { throw new Error("Unexpected refund mutation in inbox unit test"); }\nexport function hasUnresolvedShiprocketOperation() { return false; }\nexport function getRefundWebhookIdempotencyKey(id) { return "rzp_refund_" + id; }\nexport function shouldMarkOrderRefunded() { return false; }\n`);

console.log("Transpiled test build ready in .test-dist. Running node test suite sequentially...");
try {
  execSync("node --test tests/postgres-migration.test.mjs tests/postgres-import.test.mjs tests/postgres-migration-runner.test.mjs tests/postgres-sql.test.mjs", {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  execSync("node --test tests/postgres-test-database-gate.test.mjs", {
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
  execSync("node --test .test-dist/tests/storefront-upgrade.test.mjs", {
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
  execSync("node --conditions=react-server --test .test-dist/tests/admin-me-route.test.mjs", {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  execSync("node --conditions=react-server --test .test-dist/tests/admin-session-shipping-flow.test.mjs", {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  execSync("node --conditions=react-server --test .test-dist/tests/admin-login-rate-limit.test.mjs", {
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
  execSync("node --conditions=react-server --test .test-dist/tests/whatsapp-webhook.test.mjs", {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  execSync("node --conditions=react-server --test .test-dist/tests/refund-webhook-inbox.test.mjs .test-dist/tests/refund-webhook-inbox-policy.test.mjs", {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  execSync("node --conditions=react-server --test .test-dist/tests/notification-service.test.mjs .test-dist/tests/admin-notification-route.test.mjs", {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  execSync("node --conditions=react-server --test .test-dist/tests/twilio-whatsapp.test.mjs", {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  execSync("node --conditions=react-server --test .test-dist/tests/shiprocket-client.test.mjs", {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  execSync("node --conditions=react-server --test .test-dist/tests/shiprocket-serviceability.test.mjs .test-dist/tests/shiprocket-serviceability-route.test.mjs", {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  execSync("node --conditions=react-server --test .test-dist/tests/shiprocket-shipping-service.test.mjs .test-dist/tests/shiprocket-shipping-route.test.mjs", {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  execSync("node --conditions=react-server --test .test-dist/tests/shiprocket-shipment-preparation.test.mjs", {
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
