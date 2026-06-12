const path = require("path")
const fs = require("fs")
require("dotenv").config({ path: path.resolve(__dirname, "../.env") })

const express = require("express")
const cors = require("cors")
const helmet = require("helmet")
const morgan = require("morgan")
const compression = require("compression")
const rateLimit = require("express-rate-limit")
const { ensurePropertyEngagementColumns } = require("./utils/ensurePropertyEngagementColumns")

const app = express()
const clientBuildPath = path.resolve(__dirname, "../../Frontend/build")
const clientIndexPath = path.join(clientBuildPath, "index.html")
const hasClientBuild = fs.existsSync(clientIndexPath)

if (process.env.NODE_ENV === "production" && !hasClientBuild) {
  console.warn(`Frontend build not found at ${clientIndexPath}. Skipping SPA static serving.`)
}

/* --------------------------------------------------
   Trust Proxy (important for VPS / nginx / cloud)
---------------------------------------------------*/
app.set("trust proxy", 1)

/* --------------------------------------------------
   Security
---------------------------------------------------*/
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
)

app.use(compression())

/* --------------------------------------------------
   Rate Limiter
---------------------------------------------------*/
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
  })
)

/* --------------------------------------------------
   Logging
---------------------------------------------------*/
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"))
}

/* --------------------------------------------------
   CORS
---------------------------------------------------*/
app.use(
  cors({
    origin: process.env.CLIENT_URL || "*",
    credentials: true,
  })
)

/* --------------------------------------------------
   Razorpay Webhook Raw Body
---------------------------------------------------*/
app.use("/api/payment/webhook", express.raw({ type: "application/json" }))

/* --------------------------------------------------
   Body Parsers
---------------------------------------------------*/
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

/* --------------------------------------------------
   Disable API Caching
---------------------------------------------------*/
app.use("/api", (req, res, next) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store",
  })
  next()
})

/* --------------------------------------------------
   Static Files
---------------------------------------------------*/
app.use(express.static("public"))
app.use(require("./routes/seo"))

/* --------------------------------------------------
   Serve Client Build (Production)
---------------------------------------------------*/
if (process.env.NODE_ENV === "production") {
  if (hasClientBuild) {
    app.use(
      express.static(clientBuildPath, {
        etag: true,
        maxAge: "1y",
        setHeaders: (res, filePath) => {
          if (filePath.endsWith("index.html")) {
            res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
            res.setHeader("Pragma", "no-cache")
            res.setHeader("Expires", "0")
          }
        },
      })
    )
  }
}

/* --------------------------------------------------
   Routes
---------------------------------------------------*/
app.use("/api/auth", require("./routes/auth"))
app.use("/api/properties", require("./routes/properties"))
app.use("/api/inquiries", require("./routes/inquiries"))
app.use("/api/admin", require("./routes/admin"))
app.use("/api/admin/payments", require("./routes/adminPayments"))
app.use("/api/user/properties", require("./routes/user-properties"))
app.use("/api/upload", require("./routes/upload"))
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
})
app.use("/api/payment", paymentLimiter, require("./routes/paymentRoutes"))
app.use("/api/contact", require("./routes/contact"))
app.use("/api/subscription", require("./routes/subscriptionRoutes"))
app.use("/api/plans", require("./routes/planRoutes"))
app.use("/api/ai", require("./routes/ai"))

/* --------------------------------------------------
   SPA Fallback (Production)
---------------------------------------------------*/
if (process.env.NODE_ENV === "production") {
  if (hasClientBuild) {
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next()
      res.sendFile(clientIndexPath)
    })
  }
}

/* --------------------------------------------------
   Health Check
---------------------------------------------------*/
app.get("/api/health", (_, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date(),
  })
})

/* --------------------------------------------------
   Service Worker Fix
---------------------------------------------------*/
app.get("/service-worker.js", (req, res) => {
  res.status(204).end()
})

/* --------------------------------------------------
   404 Handler
---------------------------------------------------*/
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found",
  })
})

/* --------------------------------------------------
   Global Error Handler
---------------------------------------------------*/
app.use((err, req, res, next) => {
  console.error("Server Error:", err)

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  })
})

/* --------------------------------------------------
   Server Startup
---------------------------------------------------*/
const PORT = process.env.PORT || 5000

let server

const handleServerError = (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the existing server or set a different PORT in .env.`)
    process.exit(1)
  }

  console.error("Failed to start server:", error)
  process.exit(1)
}

const startServer = async () => {
  try {
    await ensurePropertyEngagementColumns()
    server = app.listen(PORT, () => {
      console.log(`
Server Running on Port ${PORT}
Environment: ${process.env.NODE_ENV}
      `)
    })
    server.on("error", handleServerError)
  } catch (error) {
    console.error("Failed to prepare server schema:", error)
    process.exit(1)
  }
}

startServer()

/* --------------------------------------------------
   Graceful Shutdown
---------------------------------------------------*/
process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)

function shutdown() {
  console.log("Shutting down server...")
  if (!server) {
    process.exit(0)
    return
  }
  server.close(() => process.exit(0))
}
