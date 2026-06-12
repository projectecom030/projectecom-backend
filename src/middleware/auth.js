const jwt = require("jsonwebtoken");

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET not defined in environment variables");
}

const JWT_SECRET = process.env.JWT_SECRET;

/* ======================================================
   1️⃣ Main Authentication (JWT Only - CLEAN VERSION)
====================================================== */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const token = authHeader.split(" ")[1];

    // ✅ Verify JWT
    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = {
      id: decoded.userId,
      email: decoded.email || null,
      phone: decoded.phone || null,
      full_name: decoded.full_name || decoded.fullName || null,
      role: decoded.role || null,
      profile_image: decoded.profile_image || decoded.profileImage || null,
      visit_purpose: decoded.visit_purpose || decoded.visitPurpose || null,
    };
    req.token = token;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

/* ======================================================
   2️⃣ Admin Check Middleware
====================================================== */
const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }
  next();
};

/* ======================================================
   3️⃣ Optional Authentication (JWT Only)
====================================================== */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    req.user = {
      id: decoded.userId,
      email: decoded.email || null,
      phone: decoded.phone || null,
      full_name: decoded.full_name || decoded.fullName || null,
      role: decoded.role || null,
      visit_purpose: decoded.visit_purpose || decoded.visitPurpose || null,
    };

    next();
  } catch (error) {
    // silently continue if invalid
    next();
  }
};

module.exports = {
  authenticateToken,
  isAdmin,
  optionalAuth,
};
