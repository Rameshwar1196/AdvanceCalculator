const path = require("path");
const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const { Pool } = require("pg");

const app = express();
const port = process.env.PORT || 13000;
const dbPath = process.env.HISTORY_DB_PATH || path.join(__dirname, "history.db");
const dbClient = process.env.HISTORY_DB_CLIENT || (process.env.DATABASE_URL ? "postgres" : "sqlite");

app.use(cors());
app.use(express.json());

let sqliteDb = null;
let pgPool = null;

function isPostgres() {
  return dbClient === "postgres";
}

function maskDatabaseUrl(value) {
  if (!value || typeof value !== "string") {
    return "";
  }

  try {
    const parsed = new URL(value);
    const dbName = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname.slice(1) : "database";
    return `${parsed.protocol}//***:***@${parsed.hostname}:${parsed.port || "5432"}/${dbName}`;
  } catch (error) {
    // Fallback mask for non-standard URL strings.
    return value.replace(/:\/\/.*@/, "://***:***@");
  }
}

function sanitizeErrorMessage(error) {
  const raw = error && error.message ? String(error.message) : "Unknown error";
  return process.env.DATABASE_URL
    ? raw.replace(process.env.DATABASE_URL, maskDatabaseUrl(process.env.DATABASE_URL))
    : raw;
}

async function initDatabase() {
  if (isPostgres()) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is required when HISTORY_DB_CLIENT=postgres.");
    }

    const useSsl = process.env.PGSSL === "true";
    const pgConfig = {
      connectionString: process.env.DATABASE_URL
    };

    if (useSsl) {
      pgConfig.ssl = { rejectUnauthorized: false };
    }

    pgPool = new Pool(pgConfig);

    await pgPool.query(
      `CREATE TABLE IF NOT EXISTS calculations (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        a DOUBLE PRECISION NOT NULL,
        b DOUBLE PRECISION NOT NULL,
        operation TEXT NOT NULL,
        result DOUBLE PRECISION NOT NULL
      )`
    );

    return;
  }

  sqliteDb = new sqlite3.Database(dbPath);

  await new Promise((resolve, reject) => {
    sqliteDb.run(
      `CREATE TABLE IF NOT EXISTS calculations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        a REAL NOT NULL,
        b REAL NOT NULL,
        operation TEXT NOT NULL,
        result REAL NOT NULL
      )`,
      (error) => {
        if (error) return reject(error);
        resolve();
      }
    );
  });
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isOperationValid(operation) {
  return operation === "add" || operation === "subtract" || operation === "multiply" || operation === "divide";
}

async function databaseHealthCheck() {
  if (isPostgres()) {
    await pgPool.query("SELECT 1 AS ok");
    return;
  }

  await new Promise((resolve, reject) => {
    sqliteDb.get("SELECT 1 AS ok", (error) => {
      if (error) return reject(error);
      resolve();
    });
  });
}

async function insertCalculation({ createdAt, a, b, operation, result }) {
  if (isPostgres()) {
    const insertResult = await pgPool.query(
      "INSERT INTO calculations (created_at, a, b, operation, result) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at",
      [createdAt, a, b, operation, result]
    );

    return {
      id: insertResult.rows[0].id,
      createdAt: new Date(insertResult.rows[0].created_at).toISOString()
    };
  }

  const insertResult = await new Promise((resolve, reject) => {
    sqliteDb.run(
      "INSERT INTO calculations (created_at, a, b, operation, result) VALUES (?, ?, ?, ?, ?)",
      [createdAt, a, b, operation, result],
      function onInsert(error) {
        if (error) return reject(error);
        resolve({ id: this.lastID });
      }
    );
  });

  return {
    id: insertResult.id,
    createdAt
  };
}

async function getCalculationHistory(limit) {
  if (isPostgres()) {
    const result = await pgPool.query(
      "SELECT id, created_at, a, b, operation, result FROM calculations ORDER BY id DESC LIMIT $1",
      [limit]
    );

    return result.rows.map((row) => ({
      id: row.id,
      createdAt: new Date(row.created_at).toISOString(),
      a: Number(row.a),
      b: Number(row.b),
      operation: row.operation,
      result: Number(row.result)
    }));
  }

  const rows = await new Promise((resolve, reject) => {
    sqliteDb.all(
      "SELECT id, created_at, a, b, operation, result FROM calculations ORDER BY id DESC LIMIT ?",
      [limit],
      (error, sqliteRows) => {
        if (error) return reject(error);
        resolve(sqliteRows);
      }
    );
  });

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    a: row.a,
    b: row.b,
    operation: row.operation,
    result: row.result
  }));
}

async function closeDatabase() {
  if (isPostgres() && pgPool) {
    await pgPool.end();
    return;
  }

  if (!isPostgres() && sqliteDb) {
    await new Promise((resolve) => {
      sqliteDb.close(() => resolve());
    });
  }
}

app.get("/health", async (req, res) => {
  try {
    await databaseHealthCheck();

    return res.json({
      service: "history",
      status: "ok",
      port,
      database: isPostgres() ? "postgres" : "sqlite"
    });
  } catch (error) {
    return res.status(500).json({
      service: "history",
      status: "error",
      port,
      error: "Database check failed."
    });
  }
});

app.post("/history", async (req, res) => {
  const a = toNumber(req.body.a);
  const b = toNumber(req.body.b);
  const result = toNumber(req.body.result);
  const operation = req.body.operation;

  if (a === null || b === null || result === null || !isOperationValid(operation)) {
    return res.status(400).json({ error: "Invalid history payload." });
  }

  const createdAt = new Date().toISOString();

  try {
    const insertResult = await insertCalculation({ createdAt, a, b, operation, result });

    return res.status(201).json({
      id: insertResult.id,
      createdAt: insertResult.createdAt,
      a,
      b,
      operation,
      result
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to save calculation history." });
  }
});

app.get("/history", async (req, res) => {
  const parsedLimit = Number(req.query.limit);
  const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 && parsedLimit <= 100 ? parsedLimit : 20;

  try {
    const history = await getCalculationHistory(limit);
    return res.json({ history });
  } catch (error) {
    return res.status(500).json({ error: "Failed to load history." });
  }
});

async function shutdown() {
  await closeDatabase();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

initDatabase()
  .then(() => {
    app.listen(port, () => {
      const dbInfo = isPostgres()
        ? `postgres (${maskDatabaseUrl(process.env.DATABASE_URL || "") || "configured"})`
        : `sqlite (${dbPath})`;
      console.log(`History service running on http://localhost:${port} using ${dbInfo}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize history database:", sanitizeErrorMessage(error));
    process.exit(1);
  });
