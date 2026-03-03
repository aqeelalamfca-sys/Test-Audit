import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";
import path from "path";
import { execSync } from "child_process";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "bcryptjs",
  "compression",
  "connect-pg-simple",
  "cookie-parser",
  "cors",
  "csv-parse",
  "date-fns",
  "docx",
  "drizzle-orm",
  "drizzle-zod",
  "exceljs",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "p-limit",
  "p-retry",
  "passport",
  "passport-local",
  // "pg", // Removed - must be external for Prisma adapter
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("generating prisma client...");
  execSync("npx prisma generate", { stdio: "inherit" });

  if (process.env.DATABASE_URL) {
    console.log("syncing database schema...");
    try {
      execSync("npx prisma db push", { stdio: "inherit" });
    } catch (e) {
      console.warn("prisma db push warning (continuing build):", (e as any).message || e);
    }
  } else {
    console.log("no DATABASE_URL set, skipping db push");
  }

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
    alias: {
      "@shared": path.resolve("shared"),
    },
    tsconfig: "server/tsconfig.json",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
