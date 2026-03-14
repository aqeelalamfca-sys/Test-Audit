import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";

let pass = 0;
let warn = 0;
let fail = 0;

function printStatus(level, message) {
  const color = level === "PASS" ? GREEN : level === "WARN" ? YELLOW : RED;
  console.log(`${color}${level}${RESET}  ${message}`);
  if (level === "PASS") pass += 1;
  if (level === "WARN") warn += 1;
  if (level === "FAIL") fail += 1;
}

function run(command, options = {}) {
  try {
    execSync(command, { stdio: "pipe", ...options });
    return true;
  } catch {
    return false;
  }
}

function readEnvFile() {
  const envPath = path.resolve(".env");
  if (!fs.existsSync(envPath)) return {};

  const content = fs.readFileSync(envPath, "utf8");
  const map = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    map[key] = value;
  }

  return map;
}

function isPlaceholder(value) {
  if (!value) return true;
  return /generate-with-openssl|change-this|your_|example|replace_me/i.test(value);
}

console.log("========================================");
console.log("  AuditWise Deployment Preflight");
console.log(`  ${new Date().toISOString()}`);
console.log("========================================");
console.log("");

console.log("[1/6] Tooling");
if (run("git --version")) printStatus("PASS", "git available");
else printStatus("FAIL", "git missing");

if (run("docker --version")) printStatus("PASS", "docker available");
else printStatus("FAIL", "docker missing");

if (run("docker compose version") || run("docker-compose --version")) {
  printStatus("PASS", "docker compose available");
} else {
  printStatus("FAIL", "docker compose missing");
}

if (run("openssl version")) printStatus("PASS", "openssl available");
else printStatus("WARN", "openssl not available in PATH (needed for secure secrets)");

if (run("curl --version")) printStatus("PASS", "curl available");
else printStatus("WARN", "curl not available in PATH");

console.log("");

console.log("[2/6] Git Clone Access");
if (run("git ls-remote --heads https://github.com/aqeelalamfca-sys/Test-Audit.git")) {
  printStatus("PASS", "repository is reachable over HTTPS");
} else {
  printStatus("FAIL", "cannot reach repository over HTTPS (network/auth/DNS issue)");
}

if (run("git rev-parse --is-inside-work-tree")) {
  printStatus("PASS", "current folder is a git repository");
} else {
  printStatus("FAIL", "current folder is not a git repository");
}

console.log("");

console.log("[3/6] Compose File Integrity");
if (run("docker compose config")) {
  printStatus("PASS", "docker-compose.yml is valid");
} else {
  printStatus("FAIL", "docker-compose.yml has syntax or env interpolation errors");
}

const requiredFiles = [
  "docker/backend.Dockerfile",
  "docker/frontend.Dockerfile",
  "docker/nginx.Dockerfile",
  "docker/docker-entrypoint.sh",
  "docker/nginx-entrypoint.sh",
  "deploy/nginx/proxy.conf",
  "deploy/nginx/proxy-ssl.conf",
];

for (const file of requiredFiles) {
  if (fs.existsSync(path.resolve(file))) printStatus("PASS", `${file} exists`);
  else printStatus("FAIL", `${file} is missing`);
}

console.log("");

console.log("[4/6] Environment");
const envPath = path.resolve(".env");
if (fs.existsSync(envPath)) printStatus("PASS", ".env exists");
else printStatus("FAIL", ".env missing (copy from .env.example)");

const envVars = readEnvFile();
const mustHave = ["POSTGRES_PASSWORD", "JWT_SECRET", "ENCRYPTION_MASTER_KEY"];

for (const key of mustHave) {
  const shellVal = process.env[key] || "";
  const fileVal = envVars[key] || "";
  const val = shellVal || fileVal;

  if (!val) {
    printStatus("FAIL", `${key} is not set (.env or shell)`);
    continue;
  }

  if (isPlaceholder(val)) {
    printStatus("FAIL", `${key} looks like a placeholder`);
  } else {
    printStatus("PASS", `${key} is set`);
  }
}

console.log("");

console.log("[5/6] Known Go-Live Risks");
const composePath = path.resolve("docker-compose.yml");
if (fs.existsSync(composePath)) {
  const composeText = fs.readFileSync(composePath, "utf8");
  if (/external:\s*true/i.test(composeText)) {
    printStatus("WARN", "compose file uses external volumes; ensure they exist before startup");
  } else {
    printStatus("PASS", "no hard dependency on external volumes");
  }
}

const dbPass = envVars.POSTGRES_PASSWORD || process.env.POSTGRES_PASSWORD || "";
if (/[\s:@/#?]/.test(dbPass)) {
  printStatus("WARN", "POSTGRES_PASSWORD contains special chars; ensure DATABASE_URL is URL-encoded");
} else {
  printStatus("PASS", "POSTGRES_PASSWORD format looks safe");
}

console.log("");
console.log("[6/6] Summary");
console.log(`Passed:   ${pass}`);
console.log(`Warnings: ${warn}`);
console.log(`Failed:   ${fail}`);

if (fail > 0) {
  console.log("\nPreflight failed. Fix FAIL items before deployment.");
  process.exit(1);
}

console.log("\nPreflight passed. Safe to proceed with docker compose build/up.");
