const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

if (
  !process.env.DB_HOST ||
  !process.env.DB_USER ||
  !process.env.DB_PASSWORD ||
  !process.env.DB_NAME
) {
  throw new Error("Database environment variables are not properly set");
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 30306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT || 10000),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

const transientDbErrors = new Set([
  "ECONNRESET",
  "PROTOCOL_CONNECTION_LOST",
  "ER_SERVER_SHUTDOWN",
  "ETIMEDOUT",
  "EPIPE",
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const runWithRetry = async (operation, retries = 1) => {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (err) {
      const isTransient = transientDbErrors.has(err.code);
      if (!isTransient || attempt >= retries) {
        throw err;
      }
      attempt += 1;
      await sleep(150);
    }
  }
};

const originalQuery = pool.query.bind(pool);
const originalExecute = pool.execute.bind(pool);

pool.query = (sql, values) =>
  runWithRetry(() => originalQuery(sql, values), 1);

pool.execute = (sql, values) =>
  runWithRetry(() => originalExecute(sql, values), 1);

const testDatabaseConnection = async (retries = 5) => {
  let lastError;
  for (let i = 0; i < retries; i += 1) {
    try {
      const connection = await pool.getConnection();
      await connection.ping();
      connection.release();
      console.log("Database connected successfully");
      return;
    } catch (err) {
      lastError = err;
      const attempt = i + 1;
      console.error(
        `Database connection attempt ${attempt}/${retries} failed:`,
        err.message
      );
      await sleep(Math.min(1000 * attempt, 4000));
    }
  }

  console.error(
    `Database unavailable after ${retries} attempts. Server will keep running, but DB routes will fail until connectivity is restored.`
  );
  console.error(
    `Check DB_HOST (${process.env.DB_HOST}) and network/firewall access to port ${process.env.DB_PORT || 3306}.`
  );
  if (lastError?.code) {
    console.error("Last DB error code:", lastError.code);
  }
};

testDatabaseConnection();

module.exports = pool;
