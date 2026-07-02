import fs from "node:fs";
import path from "node:path";

const appRoot = path.resolve(new URL("..", import.meta.url).pathname);

loadEnv(path.join(appRoot, ".env.local"));
loadEnv(path.join(appRoot, ".env"));
loadEnv(path.resolve(appRoot, "..", ".env"));

const required = ["SUPABASE_ACCESS_TOKEN", "SUPABASE_ORG_ID", "SUPABASE_DB_PASSWORD"];
const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  console.log(`Missing required environment values: ${missing.join(", ")}`);
  console.log("Create admin-app/.env.local from .env.example, then rerun this script.");
  process.exitCode = 2;
} else {
  const projectName = process.env.SUPABASE_PROJECT_NAME || "JCIT Team Management Admin";
  const region = process.env.SUPABASE_REGION || "us-east-1";
  const plan = process.env.SUPABASE_PLAN || "free";

  const payload = {
    name: projectName,
    organization_id: process.env.SUPABASE_ORG_ID,
    region,
    db_pass: process.env.SUPABASE_DB_PASSWORD,
    plan,
  };

  const response = await fetch("https://api.supabase.com/v1/projects", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error(body.message || body.error || `Supabase project creation failed with ${response.status}.`);
    process.exit(1);
  }

  console.log("Supabase project create request accepted.");
  console.log(JSON.stringify(redactProject(body), null, 2));
}

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const index = trimmed.indexOf("=");
    if (index === -1) return;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value.replace(/\\n/g, "\n");
  });
}

function redactProject(project) {
  const copy = { ...project };
  for (const key of Object.keys(copy)) {
    if (/password|secret|token|key/i.test(key)) copy[key] = "[redacted]";
  }
  return copy;
}
