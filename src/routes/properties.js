const express = require("express")
const { body, query, validationResult } = require("express-validator")
const pool = require("../config/database")
const { optionalAuth } = require("../middleware/auth")
const { ensurePropertyEngagementColumns } = require("../utils/ensurePropertyEngagementColumns")

const router = express.Router()

const resolvePlanRole = (role) => {
  if (role === "dealer" || role === "broker") return "dealer"
  return "customer"
}

const getActiveSubscription = async (userId) => {
  const [rows] = await pool.execute(
    `
    SELECT us.*, sp.is_premium
    FROM user_subscriptions us
    JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.user_id = ?
      AND us.is_active = 1
      AND us.expires_at > NOW()
    ORDER BY us.expires_at DESC
    LIMIT 1
    `,
    [userId],
  )
  return rows[0] || null
}

const maskPropertyDetails = (property) => ({
  ...property,
  address_line1: null,
  address_line2: null,
  map_address: null,
  pincode: null,
  builder_name: null,
  builder_phone: null,
  builder_email: null,
  details_locked: true,
})

// Get all properties (public)
router.get("/", optionalAuth, async (req, res) => {
  try {
    await ensurePropertyEngagementColumns()
    const userRole = req.user?.role
    const canViewDetails =
      userRole === "owner" || userRole === "admin"
        ? true
        : userRole === "customer"
          ? Boolean(await getActiveSubscription(req.user.id))
          : false

    const pageRaw = parseInt(req.query.page, 10)
    const limitRaw = parseInt(req.query.limit, 10)
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1
    const limitSanitized = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 12
    const limit = Math.min(Math.max(limitSanitized, 1), 100)
    const offset = (page - 1) * limit


    const {
      city,
      type,
      minPrice,
      maxPrice,
      bedrooms,
      listingType,
      pincode,
      search,
      sortBy = "created_at",
      sortOrder = "DESC",
    } = req.query

    const whereConditions = ["p.is_visible = TRUE", 'p.status = "available"']
    const params = []

    if (city) {
      whereConditions.push("p.city = ?")
      params.push(city)
    }

    if (type) {
      whereConditions.push("pt.name = ?")
      params.push(type)
    }

    if (minPrice) {
      whereConditions.push("p.price >= ?")
      params.push(minPrice)
    }

    if (maxPrice) {
      whereConditions.push("p.price <= ?")
      params.push(maxPrice)
    }

    if (bedrooms) {
      whereConditions.push("p.bedrooms = ?")
      params.push(bedrooms)
    }

    if (listingType) {
      whereConditions.push("p.listing_type = ?")
      params.push(listingType)
    }

    if (pincode) {
      whereConditions.push("p.pincode = ?")
      params.push(String(pincode).trim())
    }

    if (search) {
      whereConditions.push("(p.title LIKE ? OR p.description LIKE ? OR p.city LIKE ? OR p.pincode = ?)")
      const searchTerm = `%${search}%`
      params.push(searchTerm, searchTerm, searchTerm, String(search).trim())
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : ""

    // Get total count
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM properties p 
       LEFT JOIN property_types pt ON p.property_type_id = pt.id 
       ${whereClause}`,
      params,
    )

    const total = countResult[0].total

    // Get properties
    const listSql = `SELECT 
        p.*,
        pt.name as property_type,
        u.full_name as builder_name,
        u.phone as builder_phone,
        u.email as builder_email,
        (SELECT image_url FROM property_images WHERE property_id = p.id AND is_primary = TRUE LIMIT 1) as primary_image,
        (SELECT GROUP_CONCAT(image_url ORDER BY is_primary DESC, display_order ASC SEPARATOR '||')
         FROM property_images
         WHERE property_id = p.id) as image_gallery
      FROM properties p
      LEFT JOIN property_types pt ON p.property_type_id = pt.id
      LEFT JOIN users u ON p.builder_id = u.id
      ${whereClause}
      ORDER BY p.is_featured DESC, p.${sortBy} ${sortOrder}
      LIMIT ${limit} OFFSET ${offset}`
    const [properties] = await pool.execute(listSql, params)

    const data = canViewDetails
      ? properties.map((property) => ({ ...property, details_locked: false }))
      : properties.map(maskPropertyDetails)

    res.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("Get properties error:", error)
    res.status(500).json({ success: false, message: "Failed to fetch properties" })
  }
})

// Get featured properties
router.get("/featured", async (req, res) => {
  try {
    await ensurePropertyEngagementColumns()
    const [properties] = await pool.execute(`
      SELECT 
        p.*,
        pt.name as property_type,
        u.full_name as builder_name,
        pi.image_url as primary_image,
        (SELECT GROUP_CONCAT(image_url ORDER BY is_primary DESC, display_order ASC SEPARATOR '||')
         FROM property_images
         WHERE property_id = p.id) as image_gallery
      FROM properties p
      LEFT JOIN property_types pt ON p.property_type_id = pt.id
      LEFT JOIN users u ON p.builder_id = u.id
      LEFT JOIN property_images pi 
        ON pi.property_id = p.id 
        AND pi.is_primary = 1
      WHERE p.is_visible = 1
        AND p.is_featured = 1
        AND p.status = 'available'
      ORDER BY p.created_at DESC
      LIMIT 6
    `)

    res.json({ success: true, data: properties })
  } catch (error) {
    console.error("Get featured properties error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to fetch featured properties",
    })
  }
})

// Get property types
router.get("/meta/types", async (req, res) => {
  try {
    const [types] = await pool.execute("SELECT * FROM property_types ORDER BY name")
    res.json({ success: true, data: types })
  } catch (error) {
    console.error("Get property types error:", error)
    res.status(500).json({ success: false, message: "Failed to fetch property types" })
  }
})

// Get amenities
router.get("/meta/amenities", async (req, res) => {
  try {
    const [amenities] = await pool.execute("SELECT * FROM amenities ORDER BY category, name")
    res.json({ success: true, data: amenities })
  } catch (error) {
    console.error("Get amenities error:", error)
    res.status(500).json({ success: false, message: "Failed to fetch amenities" })
  }
})

// Get cities with property counts
router.get("/meta/cities", async (req, res) => {
  try {
    const [cities] = await pool.execute(
      `SELECT city, COUNT(*) as count 
       FROM properties 
       WHERE is_visible = TRUE 
       GROUP BY city 
       ORDER BY count DESC`,
    )
    res.json({ success: true, data: cities })
  } catch (error) {
    console.error("Get cities error:", error)
    res.status(500).json({ success: false, message: "Failed to fetch cities" })
  }
})

// Get property by ID
router.get("/:id(\\d+)", optionalAuth, async (req, res) => {
  try {
    await ensurePropertyEngagementColumns()
    const { id } = req.params

    await pool.execute(
      `
      UPDATE properties
      SET view_count = COALESCE(view_count, 0) + 1
      WHERE id = ?
      `,
      [id],
    )

    const [rows] = await pool.execute(
      `
      SELECT
        p.*,
        pt.name as property_type,
        u.full_name as builder_name,
        u.phone as builder_phone,
        u.email as builder_email,
        u.profile_image as builder_image,
        pi.id as image_id,
        pi.image_url,
        pi.is_primary,
        pi.display_order
      FROM properties p
      LEFT JOIN property_types pt ON pt.id = p.property_type_id
      LEFT JOIN users u ON u.id = p.builder_id
      LEFT JOIN property_images pi ON pi.property_id = p.id
      WHERE p.id = ?
      ORDER BY pi.is_primary DESC, pi.display_order ASC
      `,
      [id],
    )

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Property not found" })
    }

    const property = rows[0]

    const images = rows
      .filter((r) => r.image_id)
      .map((r) => ({
        id: r.image_id,
        image_url: r.image_url,
        is_primary: r.is_primary,
        display_order: r.display_order,
      }))

    const userRole = req.user?.role
    const canViewDetails =
      userRole === "owner" || userRole === "admin"
        ? true
        : userRole === "customer"
          ? Boolean(await getActiveSubscription(req.user.id))
          : false

    const payload = {
      ...property,
      images,
      details_locked: false,
    }

    res.json({
      success: true,
      data: canViewDetails ? payload : maskPropertyDetails(payload),
    })
  } catch (error) {
    console.error("Get property error:", error)
    res.status(500).json({ success: false, message: "Failed to fetch property" })
  }
})

module.exports = router
