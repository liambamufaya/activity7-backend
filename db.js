require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("WARNING: DATABASE_URL is not set. Database requests will fail.");
}

// Render's EXTERNAL database URL has a dotted hostname and requires SSL.
// Its INTERNAL URL (and local Postgres) uses a short hostname and needs no SSL.
// Set DATABASE_SSL=true or DATABASE_SSL=false in the environment to override.
function shouldUseSsl() {
  const flag = (process.env.DATABASE_SSL || "").toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  if (!connectionString) return false;
  try {
    const host = new URL(connectionString).hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]") {
      return false;
    }
    return host.includes(".");
  } catch (error) {
    return false;
  }
}

const pool = new Pool({
  connectionString,
  ssl: shouldUseSsl() ? { rejectUnauthorized: false } : false,
  max: 5,
  connectionTimeoutMillis: 10000
});

// Prevents an idle-connection error from crashing the whole server.
pool.on("error", (error) => {
  console.error("Unexpected database pool error:", error.message);
});

function readSql(fileName) {
  return fs.readFileSync(path.join(__dirname, fileName), "utf8");
}

// Creates the table if needed. The seed data is inserted only when the
// table is created for the first time, so deleted records never come back.
async function initDb() {
  const client = await pool.connect();
  try {
    const check = await client.query("SELECT to_regclass('public.records') AS name");
    const tableExisted = check.rows[0].name !== null;
    await client.query(readSql("schema.sql"));
    if (!tableExisted) {
      await client.query(readSql("seed.sql"));
      console.log("Database table created and seeded with sample records.");
    } else {
      console.log("Database table already exists.");
    }
  } finally {
    client.release();
  }
}

module.exports = pool;
module.exports.initDb = initDb;
