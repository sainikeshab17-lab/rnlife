
const crypto = require("node:crypto");
const { Client } = require("pg");
const readline = require("node:readline/promises");

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const email = "sainikeshab17@gmail.com";
  const name = "Sainikeshab17 Admin";
  const password = await rl.question("Enter a strong admin password (12+ characters): ");
  rl.close();

  if (password.length < 12) {
    throw new Error("Password must be at least 12 characters.");
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Load it from .env.local first.");
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  const passwordHash = `pbkdf2$100000$${salt}$${hash}`;
  const id = `adm_${crypto.randomBytes(8).toString("hex")}`;
  const now = new Date().toISOString();

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    const result = await client.query(
      `INSERT INTO public.admin_users
       (id, email, name, password_hash, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'admin', 1, $5, $5)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, name, role, is_active`,
      [id, email, name, passwordHash, now]
    );

    if (result.rowCount === 0) {
      console.log("An admin account with this email already exists; no changes made.");
    } else {
      console.log("Admin account created:", result.rows[0]);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Setup failed:", err.message);
  process.exitCode = 1;
});
