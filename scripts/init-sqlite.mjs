import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { DatabaseSync } from "node:sqlite";

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8");
  const result = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function resolveDbPath(databaseUrl, schemaDir) {
  if (!databaseUrl || !databaseUrl.startsWith("file:")) {
    throw new Error("DATABASE_URL must be file:... for sqlite");
  }

  const filePart = databaseUrl.slice("file:".length);
  if (!filePart) {
    throw new Error("Invalid sqlite DATABASE_URL");
  }

  if (/^[a-zA-Z]:[\\/]/.test(filePart)) {
    return path.normalize(filePart);
  }

  if (filePart.startsWith("/")) {
    return path.normalize(filePart.slice(1));
  }

  const normalized = filePart.replace(/^\.\/+/, "");
  return path.resolve(schemaDir, normalized);
}

function loadSql(filePath) {
  let sql = fs.readFileSync(filePath, "utf8");
  if (sql.charCodeAt(0) === 0xfeff) {
    sql = sql.slice(1);
  }
  return sql;
}

function main() {
  const root = process.cwd();
  const schemaDir = path.join(root, "prisma");
  const env = {
    ...readEnvFile(path.join(root, ".env")),
    ...process.env,
  };

  const dbPath = resolveDbPath(env.DATABASE_URL, schemaDir);
  const reset = process.argv.includes("--reset");

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  if (reset && fs.existsSync(dbPath)) {
    fs.rmSync(dbPath, { force: true });
  }

  if (!reset && fs.existsSync(dbPath) && fs.statSync(dbPath).size > 0) {
    console.log(`[init-sqlite] 数据库已存在，跳过初始化: ${dbPath}`);
    return;
  }

  const sqlPath = path.join(root, "prisma", "migrations", "0001_init", "migration.sql");
  const sql = loadSql(sqlPath);

  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(sql);
  db.close();

  console.log(`[init-sqlite] SQLite 初始化完成: ${dbPath}`);
}

try {
  main();
} catch (error) {
  console.error("[init-sqlite] 初始化失败:", error instanceof Error ? error.message : error);
  process.exit(1);
}
