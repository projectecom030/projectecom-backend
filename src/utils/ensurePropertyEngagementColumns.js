const db = require("../config/database")

let ensurePromise = null

const REQUIRED_COLUMNS = ["view_count", "contact_count"]

const addColumnSqlByName = {
  view_count: "ALTER TABLE properties ADD COLUMN view_count INT NOT NULL DEFAULT 0",
  contact_count: "ALTER TABLE properties ADD COLUMN contact_count INT NOT NULL DEFAULT 0",
}

const getMissingColumns = async () => {
  const [rows] = await db.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'properties'
       AND COLUMN_NAME IN ('view_count', 'contact_count')`,
  )

  const existing = new Set(rows.map((row) => row.COLUMN_NAME))
  return REQUIRED_COLUMNS.filter((columnName) => !existing.has(columnName))
}

const ensurePropertyEngagementColumns = async () => {
  if (ensurePromise) return ensurePromise

  ensurePromise = (async () => {
    const missingColumns = await getMissingColumns()
    for (const columnName of missingColumns) {
      await db.query(addColumnSqlByName[columnName])
    }
  })()

  try {
    await ensurePromise
  } catch (error) {
    ensurePromise = null
    throw error
  }
}

module.exports = { ensurePropertyEngagementColumns }
