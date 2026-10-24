import { readFile } from "node:fs/promises";
import dotenv from "dotenv";

const apiUrl = "https://apiv2.shiprocket.in/v1/external/auth/login";
async function main() {
let localConfig = {};
try {
  localConfig = dotenv.parse(await readFile(new URL("../.env.local", import.meta.url)));
} catch {
  console.error("Shiprocket diagnostic unavailable: .env.local could not be read.");
  process.exitCode = 1;
  return;
}

const getValue = (key) => process.env[key] ?? localConfig[key];
if (getValue("SHIPROCKET_ENABLED") !== "false") {
  console.error("Shiprocket diagnostic stopped: set SHIPROCKET_ENABLED=false first.");
  process.exitCode = 1;
  return;
}

const email = getValue("SHIPROCKET_EMAIL");
const password = getValue("SHIPROCKET_PASSWORD");
if (!email || !password) {
  console.error("Shiprocket authentication not tested: SHIPROCKET_EMAIL or SHIPROCKET_PASSWORD is missing.");
  process.exitCode = 1;
  return;
}

try {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(12_000),
  });
  const result = await response.json().catch(() => ({}));
  if (response.ok && typeof result.token === "string" && result.token.length > 0) {
    console.log("Shiprocket authentication succeeded. No shipping operations were requested.");
    return;
  }
  console.error(`Shiprocket authentication failed (HTTP ${response.status}). Credentials and response details were withheld.`);
  process.exitCode = 1;
} catch {
  console.error("Shiprocket authentication could not be reached. Network and credential details were withheld.");
  process.exitCode = 1;
}
}

await main();
