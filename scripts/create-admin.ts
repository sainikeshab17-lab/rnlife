
import "dotenv/config";
import { createAdminUser } from "../src/lib/auth/admin-auth";

async function main() {
  const email = "sainikeshab17@gmail.com";
  const name = "Sainikeshab17 Admin";
  const password = process.env.INITIAL_ADMIN_PASSWORD;

  if (!password || password.length < 12) {
    throw new Error(
      "Set INITIAL_ADMIN_PASSWORD to a password of at least 12 characters."
    );
  }

  const result = await createAdminUser(email, name, password, "admin");

  if (!result.success) {
    throw new Error(result.error ?? "Admin creation failed.");
  }

  console.log(`Admin account created successfully: ${email}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

