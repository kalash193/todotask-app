import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { get, head, put } from "@vercel/blob";

const DB_PATH = "taskflow/db.json";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_DB_FILE = path.join(__dirname, "..", "..", "data", "vercel-db.json");

function hashPassword(password) {
  return createHash("sha256").update(password).digest("hex");
}

function createSeed() {
  const now = new Date().toISOString();

  return {
    users: [
      {
        id: "admin-user",
        name: "TaskFlow Admin",
        email: "admin@taskflow.local",
        passwordHash: hashPassword("admin123"),
        role: "admin",
        createdAt: now,
      },
      {
        id: "employee-demo",
        name: "Demo Employee",
        email: "employee@taskflow.local",
        passwordHash: hashPassword("employee123"),
        role: "employee",
        createdAt: now,
      },
    ],
    sessions: [],
    tasks: [],
  };
}

function useBlobStorage() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function isVercelRuntime() {
  return process.env.VERCEL === "1";
}

async function ensureLocalDb() {
  try {
    await fs.access(LOCAL_DB_FILE);
  } catch {
    await fs.mkdir(path.dirname(LOCAL_DB_FILE), { recursive: true });
    await fs.writeFile(LOCAL_DB_FILE, JSON.stringify(createSeed(), null, 2));
  }
}

async function readLocalDb() {
  await ensureLocalDb();
  const raw = await fs.readFile(LOCAL_DB_FILE, "utf8");
  return JSON.parse(raw);
}

async function writeLocalDb(db) {
  await fs.mkdir(path.dirname(LOCAL_DB_FILE), { recursive: true });
  await fs.writeFile(LOCAL_DB_FILE, JSON.stringify(db, null, 2));
}

async function readBlobDb() {
  try {
    await head(DB_PATH);
  } catch {
    const seed = createSeed();
    await writeBlobDb(seed);
    return seed;
  }

  const blob = await get(DB_PATH, { access: "private" });
  const raw = await new Response(blob.body).text();
  return JSON.parse(raw);
}

async function readRuntimeFallbackDb() {
  if (isVercelRuntime() && !useBlobStorage()) {
    throw new Error(
      "Vercel Blob is not configured. Add a Blob store to the Vercel project so /api can persist data.",
    );
  }

  return readLocalDb();
}

async function writeBlobDb(db) {
  await put(DB_PATH, JSON.stringify(db, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

export async function readDb() {
  return useBlobStorage() ? readBlobDb() : readRuntimeFallbackDb();
}

export async function writeDb(db) {
  if (useBlobStorage()) {
    return writeBlobDb(db);
  }

  if (isVercelRuntime()) {
    throw new Error(
      "Vercel Blob is not configured. Add a Blob store to the Vercel project so /api can persist data.",
    );
  }

  return writeLocalDb(db);
}

export function createId() {
  return randomUUID().replaceAll("-", "");
}

export function getNow() {
  return new Date().toISOString();
}

export function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export { hashPassword };
