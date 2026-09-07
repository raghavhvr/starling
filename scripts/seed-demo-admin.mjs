// Seeds the default demo admin account (admin@starling.demo / Maggi2026!).
// Run with: node scripts/seed-demo-admin.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(join(root, ".env"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    })
);

const EMAIL = "admin@starling.demo";
const PASSWORD = "Maggi2026!";

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);

// Try signing in first — account may already exist
const signIn = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
if (signIn.data?.session) {
  console.log("Demo admin already exists and signs in fine:", EMAIL);
  process.exit(0);
}

const signUp = await supabase.auth.signUp({
  email: EMAIL,
  password: PASSWORD,
  options: { data: { full_name: "Starling Admin" } },
});

if (signUp.error) {
  console.error("Sign-up failed:", signUp.error.message);
  process.exit(1);
}

if (signUp.data.session) {
  console.log("Demo admin created and auto-confirmed:", EMAIL);
} else {
  console.log(
    "Demo admin created but requires email confirmation (enable auto-confirm in Supabase Auth settings, or confirm manually):",
    EMAIL
  );
}
