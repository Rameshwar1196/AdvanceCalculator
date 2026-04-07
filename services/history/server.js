const path = require("path");
const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const port = process.env.PORT || 13000;
const dbPath = process.env.HISTORY_DB_PATH || path.join(__dirname, "history.db");

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS calculations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      a REAL NOT NULL,
      b REAL NOT NULL,
      operation TEXT NOT NULL,
      result REAL NOT NULL
    )`
  );
});

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isOperationValid(operation) {
  return operation === "add" || operation === "subtract" || operation === "multiply" || operation === "divide";
}

app.get("/health", (req, res) => {
  db.get("SELECT 1 AS ok", (error) => {
    if (error) {
      return res.status(500).json({
        service: "history",
        status: "error",
        port,
        error: "Database check failed."
      });
    }

    return res.json({
      service: "history",
      status: "ok",
      port
    });
  });
});

app.post("/history", (req, res) => {
  const a = toNumber(req.body.a);
  const b = toNumber(req.body.b);
  const result = toNumber(req.body.result);
  const operation = req.body.operation;

  if (a === null || b === null || result === null || !isOperationValid(operation)) {
    return res.status(400).json({ error: "Invalid history payload." });
  }

  const createdAt = new Date().toISOString();

  db.run(
    "INSERT INTO calculations (created_at, a, b, operation, result) VALUES (?, ?, ?, ?, ?)",
    [createdAt, a, b, operation, result],
    function onInsert(error) {
      if (error) {
        return res.status(500).json({ error: "Failed to save calculation history." });
      }

      return res.status(201).json({
        id: this.lastID,
        createdAt,
        a,
        b,
        operation,
        result
      });
    }
  );
});

app.get("/history", (req, res) => {
  const parsedLimit = Number(req.query.limit);
  const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 && parsedLimit <= 100 ? parsedLimit : 20;

  db.all(
    "SELECT id, created_at, a, b, operation, result FROM calculations ORDER BY id DESC LIMIT ?",
    [limit],
    (error, rows) => {
      if (error) {
        return res.status(500).json({ error: "Failed to load history." });
      }

      const history = rows.map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        a: row.a,
        b: row.b,
        operation: row.operation,
        result: row.result
      }));

      return res.json({ history });
    }
  );
});

process.on("SIGINT", () => {
  db.close(() => {
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  db.close(() => {
    process.exit(0);
  });
});

app.listen(port, () => {
  console.log(`History service running on http://localhost:${port}`);
});
