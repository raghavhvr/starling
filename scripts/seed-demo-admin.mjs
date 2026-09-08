// Seeds the default demo admin account (admin@starling.demo / Maggi2026!).
// Uses the service-role admin API so the account is created pre-confirmed,
// regardless of the project's email-confirmation setting.
// Run with: node scripts/seed-demo-admin.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(join(root, ".env"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    })
);

const EMAIL = "admin@starling.demo";
const PASSWORD = "Maggi2026!";

const URL_ = env.NEW_SUPABASE_URL || env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.NEW_SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !SERVICE_KEY) {
  console.error("Set NEW_SUPABASE_URL and NEW_SUPABASE_SERVICE_ROLE_KEY in .env first.");
  process.exit(1);
}

const admin = createClient(URL_, SERVICE_KEY, { auth: { persistSession: false } });

const { data, error } = await admin.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
  user_metadata: { full_name: "Starling Admin" },
});

if (error && !/already.*(registered|exists)/i.test(error.message)) {
  console.error("Create failed:", error.message);
  process.exit(1);
}
console.log(error ? `Demo admin already exists: ${EMAIL}` : `Demo admin created (confirmed): ${EMAIL}`);

// Verify the credentials actually work with the app's anon client
const anon = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false },
});
const signIn = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
if (signIn.error) {
  console.error("Sign-in check FAILED:", signIn.error.message);
  process.exit(1);
}
console.log("Sign-in check passed.");
