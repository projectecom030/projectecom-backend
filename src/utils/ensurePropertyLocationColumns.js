const db = require("../config/database");

let ensurePromise = null;

const getMissingColumns = async () => {
  const [rows] = await db.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'properties'
       AND COLUMN_NAME IN ('latitude', 'longitude', 'google_place_id', 'map_address')`
  );

  const existing = new Set(rows.map((row) => row.COLUMN_NAME));
  const required = ["latitude", "longitude", "google_place_id", "map_address"];
  return required.filter((name) => !existing.has(name));
};

const addColumnSqlByName = {
  latitude: "ALTER TABLE properties ADD COLUMN latitude DECIMAL(10,8) NULL",
  longitude: "ALTER TABLE properties ADD COLUMN longitude DECIMAL(11,8) NULL",
  google_place_id: "ALTER TABLE properties ADD COLUMN google_place_id VARCHAR(255) NULL",
  map_address: "ALTER TABLE properties ADD COLUMN map_address VARCHAR(500) NULL",
};

const ensurePropertyLocationColumns = async () => {
  if (ensurePromise) return ensurePromise;

  ensurePromise = (async () => {
    const missingColumns = await getMissingColumns();
    for (const columnName of missingColumns) {
      await db.query(addColumnSqlByName[columnName]);
    }
  })();

  try {
    await ensurePromise;
  } catch (error) {
    ensurePromise = null;
    throw error;
  }
};

module.exports = { ensurePropertyLocationColumns };
