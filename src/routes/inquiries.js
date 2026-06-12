const express = require("express")
const { body, validationResult } = require("express-validator")
const pool = require("../config/database")

const router = express.Router()

// Create inquiry (public - no auth required)
router.post(
  "/",
  [
    body("propertyId").isNumeric(),
    body("userName").trim().isLength({ min: 2 }),
    body("userPhone").isMobilePhone(),
    body("inquiryType").isIn(["call", "message", "callback_request"]),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() })
      }

      const { propertyId, userName, userEmail, userPhone, message, inquiryType } = req.body

      // Verify property exists
      const [property] = await pool.execute("SELECT id FROM properties WHERE id = ? AND is_visible = TRUE", [
        propertyId,
      ])

      if (property.length === 0) {
        return res.status(404).json({ success: false, message: "Property not found" })
      }

      // Create inquiry
      const [result] = await pool.execute(
        `INSERT INTO inquiries (property_id, user_name, user_email, user_phone, message, inquiry_type) 
       VALUES (?, ?, ?, ?, ?, ?)`,
        [propertyId, userName, userEmail || null, userPhone, message || null, inquiryType],
      )

      res.status(201).json({
        success: true,
        message: "Inquiry submitted successfully",
        inquiryId: result.insertId,
      })
    } catch (error) {
      console.error("Create inquiry error:", error)
      res.status(500).json({ success: false, message: "Failed to submit inquiry" })
    }
  },
)

module.exports = router
