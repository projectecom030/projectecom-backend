const express = require("express")
const pool = require("../config/database")
const { authenticateToken, isAdmin } = require("../middleware/auth")

const router = express.Router()

// All routes require admin authentication
router.use(authenticateToken, isAdmin)

const buildWhereClause = (query) => {
  const clauses = []
  const params = []

  if (query.startDate) {
    clauses.push("sp.created_at >= ?")
    params.push(`${query.startDate} 00:00:00`)
  }

  if (query.endDate) {
    clauses.push("sp.created_at <= ?")
    params.push(`${query.endDate} 23:59:59`)
  }

  if (query.planId) {
    clauses.push("sp.plan_id = ?")
    params.push(query.planId)
  }

  if (query.role) {
    clauses.push("p.role = ?")
    params.push(query.role)
  }

  if (query.userId) {
    clauses.push("sp.user_id = ?")
    params.push(query.userId)
  }

  if (query.q) {
    const q = `%${query.q}%`
    clauses.push(
      `(CAST(sp.id AS CHAR) LIKE ? OR sp.razorpay_order_id LIKE ? OR sp.razorpay_payment_id LIKE ? OR u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ? OR p.name LIKE ?)`,
    )
    params.push(q, q, q, q, q, q, q)
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""
  return { whereClause, params }
}

const formatPayments = (rows) =>
  rows.map((item) => ({
    ...item,
    amount_rupees: Number(item.amount_paise || 0) / 100,
    status: "paid",
  }))

const paymentsSelect = `
  SELECT
    sp.id AS payment_id,
    sp.razorpay_order_id,
    sp.razorpay_payment_id,
    sp.amount_paise,
    sp.currency,
    sp.created_at,
    u.id AS user_id,
    u.full_name AS user_name,
    u.phone AS user_phone,
    u.email AS user_email,
    p.id AS plan_id,
    p.name AS plan_name,
    p.role AS plan_role
  FROM subscription_payments sp
  INNER JOIN users u ON u.id = sp.user_id
  INNER JOIN subscription_plans p ON p.id = sp.plan_id
`

// GET /api/admin/payments
router.get("/", async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1)
    const rawLimit = Math.max(Number(req.query.limit) || 10, 1)
    const limit = Math.min(rawLimit, 100)
    const offset = (page - 1) * limit
    const safeOffset = Math.max(offset, 0)
    const safeLimit = Math.max(Math.min(limit, 100), 1)

    const { whereClause, params } = buildWhereClause(req.query)

    const [countRows] = await pool.execute(
      `
      SELECT COUNT(*) AS total
      FROM subscription_payments sp
      INNER JOIN subscription_plans p ON p.id = sp.plan_id
      ${whereClause}
      `,
      params,
    )

    const [payments] = await pool.execute(
      `
      ${paymentsSelect}
      ${whereClause}
      ORDER BY sp.created_at DESC
      LIMIT ${safeLimit} OFFSET ${safeOffset}
      `,
      params,
    )

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const monthQuery = {
      ...req.query,
      startDate: monthStart.toISOString().slice(0, 10),
      endDate: monthEnd.toISOString().slice(0, 10),
    }
    const monthFilter = buildWhereClause(monthQuery)

    const [monthRows] = await pool.execute(
      `
      SELECT COUNT(*) AS total
      FROM subscription_payments sp
      INNER JOIN subscription_plans p ON p.id = sp.plan_id
      ${monthFilter.whereClause}
      `,
      monthFilter.params,
    )

    const formatted = formatPayments(payments)

    res.json({
      success: true,
      data: formatted,
      summary: {
        total: countRows[0]?.total || 0,
        thisMonth: monthRows[0]?.total || 0,
        pending: 0,
      },
      pagination: {
        page,
        limit: safeLimit,
        total: countRows[0]?.total || 0,
        totalPages: Math.ceil((countRows[0]?.total || 0) / safeLimit),
      },
    })
  } catch (error) {
    console.error("Get admin payments error:", error)
    res.status(500).json({ success: false, message: "Failed to fetch payments" })
  }
})

// GET /api/admin/payments/export
router.get("/export", async (req, res) => {
  try {
    const { whereClause, params } = buildWhereClause(req.query)

    const [payments] = await pool.execute(
      `
      ${paymentsSelect}
      ${whereClause}
      ORDER BY sp.created_at DESC
      `,
      params,
    )

    const rows = formatPayments(payments)
    const header = [
      "payment_id",
      "user_name",
      "user_phone",
      "user_email",
      "plan_name",
      "plan_role",
      "amount_rupees",
      "currency",
      "status",
      "created_at",
      "razorpay_order_id",
      "razorpay_payment_id",
    ]

    const escapeCsv = (value) => {
      if (value === null || value === undefined) return ""
      const stringValue = String(value)
      if (/[",\n]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }
      return stringValue
    }

    const csvLines = [header.join(",")]
    rows.forEach((row) => {
      const line = [
        row.payment_id,
        row.user_name,
        row.user_phone,
        row.user_email,
        row.plan_name,
        row.plan_role,
        row.amount_rupees,
        row.currency,
        row.status,
        row.created_at,
        row.razorpay_order_id,
        row.razorpay_payment_id,
      ]
      csvLines.push(line.map(escapeCsv).join(","))
    })

    res.setHeader("Content-Type", "text/csv")
    res.setHeader("Content-Disposition", "attachment; filename=payments.csv")
    res.status(200).send(csvLines.join("\n"))
  } catch (error) {
    console.error("Export admin payments error:", error)
    res.status(500).json({ success: false, message: "Failed to export payments" })
  }
})

module.exports = router
