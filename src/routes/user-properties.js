const express = require("express")
const { body, validationResult } = require("express-validator")
const pool = require("../config/database")
const { authenticateToken } = require("../middleware/auth")
const { ensurePropertyLocationColumns } = require("../utils/ensurePropertyLocationColumns")
const { ensurePropertyEngagementColumns } = require("../utils/ensurePropertyEngagementColumns")

const router = express.Router()

// All routes require authentication
router.use(authenticateToken)

// Get inquiries for user's properties
router.get("/inquiries", async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search = "" } = req.query
    const pageInt = parseInt(page, 10)
    const limitInt = parseInt(limit, 10)
    const offset = (pageInt - 1) * limitInt

    const whereConditions = ["p.builder_id = ?"]
    const params = [req.user.id]
    const normalizedSearch = String(search).trim()

    if (status) {
      whereConditions.push("i.status = ?")
      params.push(status)
    }

    if (normalizedSearch) {
      whereConditions.push("(p.title LIKE ? OR i.user_phone LIKE ? OR i.user_name LIKE ?)")
      const likeQuery = `%${normalizedSearch}%`
      params.push(likeQuery, likeQuery, likeQuery)
    }

    const whereClause = whereConditions.join(" AND ")

    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM inquiries i 
       INNER JOIN properties p ON i.property_id = p.id 
       WHERE ${whereClause}`,
      params,
    )

    const [inquiries] = await pool.execute(
      `SELECT 
        i.*,
        p.title as property_title,
        p.city as property_city,
        (SELECT image_url FROM property_images WHERE property_id = p.id AND is_primary = TRUE LIMIT 1) as property_image
      FROM inquiries i
      INNER JOIN properties p ON i.property_id = p.id
      WHERE ${whereClause}
      ORDER BY i.created_at DESC
      LIMIT ${limitInt} OFFSET ${offset}`,
      params,
    )

    res.json({
      success: true,
      data: inquiries,
      pagination: {
        page: pageInt,
        limit: limitInt,
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limitInt),
      },
    })
  } catch (error) {
    console.error("Get user inquiries error:", error)
    res.status(500).json({ success: false, message: "Failed to fetch inquiries" })
  }
})

// Get user's properties
router.get("/", async (req, res) => {
  try {
    await ensurePropertyEngagementColumns()
    const { page = 1, limit = 10, status, search = "" } = req.query
    const pageInt = parseInt(page, 10)
    const limitInt = parseInt(limit, 10)
    const offset = (pageInt - 1) * limitInt

    const whereConditions = ["p.builder_id = ?"]
    const params = [req.user.id]
    const normalizedSearch = String(search).trim()

    if (status) {
      whereConditions.push("p.status = ?")
      params.push(status)
    }

    if (normalizedSearch) {
      whereConditions.push("(p.title LIKE ? OR p.city LIKE ? OR p.address_line1 LIKE ?)")
      const likeQuery = `%${normalizedSearch}%`
      params.push(likeQuery, likeQuery, likeQuery)
    }

    const whereClause = whereConditions.join(" AND ")

    const [countResult] = await pool.execute(`SELECT COUNT(*) as total FROM properties p WHERE ${whereClause}`, params)

    const [properties] = await pool.execute(
      `SELECT 
        p.*,
        pt.name as property_type,
        (SELECT image_url FROM property_images WHERE property_id = p.id AND is_primary = TRUE LIMIT 1) as primary_image,
        (SELECT COUNT(*) FROM inquiries WHERE property_id = p.id) as inquiry_count
      FROM properties p
      LEFT JOIN property_types pt ON p.property_type_id = pt.id
      WHERE ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ${limitInt} OFFSET ${offset}`,
      params,
    )

    res.json({
      success: true,
      data: properties,
      pagination: {
        page: pageInt,
        limit: limitInt,
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / limitInt),
      },
    })
  } catch (error) {
    console.error("Get user properties error:", error)
    res.status(500).json({ success: false, message: "Failed to fetch properties" })
  }
})

// Create property
router.post(
  "/",
  [
    body("title").trim().isLength({ min: 5 }),
    body("price").isNumeric(),
    body("city").trim().isLength({ min: 2 }),
    body("state").trim().isLength({ min: 2 }),
    body("addressLine1").trim().isLength({ min: 5 }),
    body("pincode").matches(/^\d{6}$/).withMessage("Invalid pincode"),
  ],
  async (req, res) => {
    try {
      await ensurePropertyLocationColumns()
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        console.log("Validation errors:", errors.array())
        return res.status(400).json({ success: false, errors: errors.array(), message: "Validation failed" })
      }

      const {
        title,
        description,
        propertyTypeId,
        price,
        priceUnit,
        areaSqft,
        bedrooms,
        bathrooms,
        parkingSpaces,
        furnishing,
        facing,
        floorNumber,
        totalFloors,
        ageOfProperty,
        addressLine1,
        addressLine2,
        city,
        state,
        pincode,
        latitude,
        longitude,
        googlePlaceId,
        mapAddress,
        status,
        listingType,
        amenities,
        images,
      } = req.body
      const normalizedPincode = String(pincode || "").replace(/\D/g, "")

      if (["owner", "dealer", "broker"].includes(req.user.role)) {
        const [countRows] = await pool.execute(
          `SELECT COUNT(*) as total
           FROM properties p
           JOIN users u ON p.builder_id = u.id
           WHERE u.phone = ?`,
          [req.user.phone],
        )
        if (Number(countRows[0]?.total || 0) >= 2) {
          return res.status(403).json({
            success: false,
            message: "Post limit reached for this phone number (max 2).",
          })
        }
      }

      // Insert property
      const [result] = await pool.execute(
        `INSERT INTO properties (
        builder_id, title, description, property_type_id, price, price_unit,
        area_sqft, bedrooms, bathrooms, parking_spaces, furnishing,
        facing, floor_number, total_floors, age_of_property,
        address_line1, address_line2, city, state, pincode,
        latitude, longitude, google_place_id, map_address, status, listing_type, is_featured
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          title,
          description,
          propertyTypeId || null,
          price,
          priceUnit || "total",
          areaSqft || null,
          bedrooms || null,
          bathrooms || null,
          parkingSpaces || 0,
          furnishing || null,
          facing || null,
          floorNumber || null,
          totalFloors || null,
          ageOfProperty || null,
          addressLine1,
          addressLine2 || null,
          city,
          state,
          normalizedPincode,
          latitude ?? null,
          longitude ?? null,
          googlePlaceId || null,
          mapAddress || null,
          status || "available",
          listingType || "sale",
          false, // isFeatured is always false for regular users
        ],
      )

      const propertyId = result.insertId

      // Insert images if provided
      if (images && images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          await pool.execute(
            "INSERT INTO property_images (property_id, image_url, is_primary, display_order) VALUES (?, ?, ?, ?)",
            [propertyId, images[i], i === 0, i],
          )
        }
      }

      // Insert amenities if provided
      if (amenities && amenities.length > 0) {
        for (const amenityId of amenities) {
          await pool.execute("INSERT INTO property_amenities (property_id, amenity_id) VALUES (?, ?)", [
            propertyId,
            amenityId,
          ])
        }
      }

      res.status(201).json({
        success: true,
        message: "Property created successfully",
        propertyId,
      })
    } catch (error) {
      console.error("Create property error:", error)
      res.status(500).json({ success: false, message: "Failed to create property" })
    }
  },
)

// Update property
router.put("/:id", async (req, res) => {
  try {
    await ensurePropertyLocationColumns()
    const { id } = req.params

    // Verify ownership
    const [existing] = await pool.execute("SELECT id FROM properties WHERE id = ? AND builder_id = ?", [
      id,
      req.user.id,
    ])

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "Property not found" })
    }

    const updates = req.body
    if (Object.prototype.hasOwnProperty.call(updates, "pincode")) {
      const normalizedPincode = String(updates.pincode || "").replace(/\D/g, "")
      if (!/^\d{6}$/.test(normalizedPincode)) {
        return res.status(400).json({ success: false, message: "Invalid pincode" })
      }
      updates.pincode = normalizedPincode
    }
      const allowedFields = [
        "title",
        "description",
        "property_type_id",
        "price",
        "price_unit",
        "area_sqft",
      "bedrooms",
      "bathrooms",
      "parking_spaces",
      "furnishing",
      "facing",
      "floor_number",
      "total_floors",
      "age_of_property",
      "address_line1",
      "address_line2",
      "city",
      "state",
      "pincode",
      "latitude",
      "longitude",
        "google_place_id",
        "map_address",
        "status",
        "is_visible",
        "listing_type",
        // is_featured is NOT allowed
      ]

    const setClauses = []
    const params = []

    for (const [key, value] of Object.entries(updates)) {
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
      if (allowedFields.includes(snakeKey)) {
        setClauses.push(`${snakeKey} = ?`)
        params.push(value)
      }
    }

    if (setClauses.length > 0) {
      params.push(id)
      await pool.execute(`UPDATE properties SET ${setClauses.join(", ")} WHERE id = ?`, params)
    }

    // Update amenities if provided
    if (updates.amenities) {
      await pool.execute("DELETE FROM property_amenities WHERE property_id = ?", [id])
      for (const amenityId of updates.amenities) {
        await pool.execute("INSERT INTO property_amenities (property_id, amenity_id) VALUES (?, ?)", [id, amenityId])
      }
    }

    // Update images if provided
    if (updates.images) {
      await pool.execute("DELETE FROM property_images WHERE property_id = ?", [id])
      for (let i = 0; i < updates.images.length; i++) {
        await pool.execute(
          "INSERT INTO property_images (property_id, image_url, is_primary, display_order) VALUES (?, ?, ?, ?)",
          [id, updates.images[i], i === 0, i],
        )
      }
    }

    res.json({ success: true, message: "Property updated successfully" })
  } catch (error) {
    console.error("Update property error:", error)
    res.status(500).json({ success: false, message: "Failed to update property" })
  }
})

// Delete property
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params

    const [result] = await pool.execute("DELETE FROM properties WHERE id = ? AND builder_id = ?", [id, req.user.id])

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Property not found" })
    }

    res.json({ success: true, message: "Property deleted successfully" })
  } catch (error) {
    console.error("Delete property error:", error)
    res.status(500).json({ success: false, message: "Failed to delete property" })
  }
})

// Toggle property visibility
router.patch("/:id/visibility", async (req, res) => {
  try {
    const { id } = req.params
    const { isVisible } = req.body

    await pool.execute("UPDATE properties SET is_visible = ? WHERE id = ? AND builder_id = ?", [
      isVisible,
      id,
      req.user.id,
    ])

    res.json({ success: true, message: "Visibility updated" })
  } catch (error) {
    console.error("Toggle visibility error:", error)
    res.status(500).json({ success: false, message: "Failed to update visibility" })
  }
})

module.exports = router
