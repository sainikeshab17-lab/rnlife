import { createAdminUser, getAdminByEmail } from "../src/lib/auth/admin-auth";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

async function main() {
  const email = process.argv[2] || process.env.INITIAL_ADMIN_EMAIL;
  const password = process.argv[3] || process.env.INITIAL_ADMIN_PASSWORD;
  const name = process.argv[4] || process.env.INITIAL_ADMIN_NAME || "Store Administrator";
  const role = process.argv[5] || process.env.INITIAL_ADMIN_ROLE || "super_admin";

  if (!email || !password) {
    throw new Error("Provide the initial admin email and password through arguments or environment variables.");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to create an admin in PostgreSQL.");
  }

  console.log("Checking PostgreSQL for the initial RIGHTNOWLIFE admin account...");
  if (await getAdminByEmail(email)) {
    console.log("[INFO] An active admin account already exists for that email.");
    return;
  }

  const result = await createAdminUser(email, name, password, role);
  if (!result.success) throw new Error(result.error || "Unable to create admin account.");

  console.log("[SUCCESS] Initial admin account created. Credentials were not logged.");
}

main().catch((error: unknown) => {
  const code = error instanceof Error && "code" in error ? String(error.code) : "unknown";
  console.error(`[setup-admin] Failed to create initial admin (database code ${code}).`);
  process.exitCode = 1;
});
