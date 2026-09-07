// Checks the demo admin login and prints the exact auth error if it fails.
// Run with: node scripts/check-demo-login.mjs
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

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
const { data, error } = await supabase.auth.signInWithPassword({
  email: "admin@starling.demo",
  password: "Maggi2026!",
});

if (error) {
  console.error("Sign-in failed:", error.message);
  process.exit(1);
}
console.log("Sign-in OK. User:", data.user.email, "id:", data.user.id);
