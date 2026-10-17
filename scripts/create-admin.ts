import { getDb } from "../src/lib/db/index";
import { createAdminUser, getAdminByEmail } from "../src/lib/auth/admin-auth";

const email = process.argv[2] || process.env.INITIAL_ADMIN_EMAIL || "admin@rightnowlife.in";
const password = process.argv[3] || process.env.INITIAL_ADMIN_PASSWORD || "RightNowLife@Admin2026";
const name = process.argv[4] || process.env.INITIAL_ADMIN_NAME || "Store Administrator";
const role = process.argv[5] || process.env.INITIAL_ADMIN_ROLE || "super_admin";

console.log("==> Initializing RIGHTNOWLIFE Database & Initial Admin User...");

// Ensure database schema and migrations run
getDb();

const existing = getAdminByEmail(email);
if (existing) {
  console.log(`[INFO] Admin user '${email}' already exists. (ID: ${existing.id}, Role: ${existing.role})`);
  process.exit(0);
}

const result = createAdminUser(email, name, password, role);
if (!result.success) {
  console.error(`[ERROR] Failed to create admin user: ${result.error}`);
  process.exit(1);
}

console.log(`[SUCCESS] Admin user created successfully:`);
console.log(`  Email: ${email}`);
console.log(`  Name:  ${name}`);
console.log(`  Role:  ${role}`);
console.log(`  Note:  Never log or commit raw passwords.`);
