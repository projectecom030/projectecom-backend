const express = require("express")
const pool = require("../config/database")

const router = express.Router()

const escapeXml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")

const getBaseUrl = (req) => {
  const configuredUrl = process.env.PUBLIC_SITE_URL || process.env.CLIENT_URL

  if (configuredUrl && !configuredUrl.includes("localhost")) {
    return configuredUrl.replace(/\/$/, "")
  }

  const forwardedProto = req.get("x-forwarded-proto")
  const protocol = forwardedProto ? forwardedProto.split(",")[0].trim() : req.protocol
  return `${protocol}://${req.get("host")}`.replace(/\/$/, "")
}

router.get("/robots.txt", (req, res) => {
  const baseUrl = getBaseUrl(req)

  res.type("text/plain").send(
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin",
      "Disallow: /user",
      "Disallow: /login",
      "Disallow: /register",
      "Disallow: /profile",
      "Disallow: /wishlist",
      "Disallow: /subscription",
      "",
      `Sitemap: ${baseUrl}/sitemap.xml`,
    ].join("\n"),
  )
})

router.get("/sitemap.xml", async (req, res) => {
  try {
    const baseUrl = getBaseUrl(req)
    const staticPages = [
      { path: "/", priority: "1.0", changefreq: "daily" },
      { path: "/properties", priority: "0.9", changefreq: "daily" },
      { path: "/about", priority: "0.7", changefreq: "monthly" },
      { path: "/contact", priority: "0.6", changefreq: "monthly" },
      { path: "/privacy-policy", priority: "0.4", changefreq: "yearly" },
      { path: "/terms", priority: "0.4", changefreq: "yearly" },
      { path: "/refund-policy", priority: "0.4", changefreq: "yearly" },
    ]

    const [propertyRows] = await pool.execute(
      `
      SELECT
        id,
        COALESCE(updated_at, created_at) AS last_modified
      FROM properties
      WHERE is_visible = TRUE
        AND status = 'available'
      ORDER BY COALESCE(updated_at, created_at) DESC
      `,
    )

    const staticXml = staticPages
      .map(
        ({ path, priority, changefreq }) => `
  <url>
    <loc>${escapeXml(`${baseUrl}${path}`)}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`,
      )
      .join("")

    const propertyXml = propertyRows
      .map(
        ({ id, last_modified: lastModified }) => `
  <url>
    <loc>${escapeXml(`${baseUrl}/properties/${id}`)}</loc>
    <lastmod>${new Date(lastModified || Date.now()).toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`,
      )
      .join("")

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticXml}
${propertyXml}
</urlset>`

    res.header("Content-Type", "application/xml").send(xml)
  } catch (error) {
    console.error("Failed to generate sitemap:", error)
    res.status(500).type("text/plain").send("Failed to generate sitemap")
  }
})

module.exports = router
