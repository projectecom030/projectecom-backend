const express = require("express")
const path = require("path")
const crypto = require("crypto")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const { body, validationResult } = require("express-validator")
const pool = require("../config/database")
const { authenticateToken } = require("../middleware/auth")
const axios = require("axios")
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") })
const { sendOtpSMS } = require("../utils/sendSMS")

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET
const SALT_ROUNDS = 10
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "15m"

const createPasswordHash = async (password) => {
  const passwordValue =
    typeof password === "string" && password.length > 0
      ? password
      : crypto.randomBytes(32).toString("hex")

  return bcrypt.hash(passwordValue, SALT_ROUNDS)
}

const createAccessToken = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      phone: user.phone,
      role: user.role,
      email: user.email || null,
      full_name: user.full_name || user.fullName || null,
      profile_image: user.profile_image || user.profileImage || null,
      visit_purpose: user.visit_purpose || user.visitPurpose || null,
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL, algorithm: "HS256" }
  )
}


// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

router.post(
  "/register",
  [
    body("fullName").trim().isLength({ min: 2 }),
    body("phone").notEmpty(),
    body("role").isIn(["customer", "dealer", "broker", "owner"]),
    body("email").optional({ checkFalsy: true }).isEmail(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      let { email, fullName, phone, role, password } = req.body;

      // normalize phone
      phone = phone.replace(/\D/g, "");

      // check existing user
      const [existing] = await pool.execute(
        "SELECT id FROM users WHERE phone = ? OR (email = ? AND email IS NOT NULL)",
        [phone, email || null]
      );

      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: "User already exists",
        });
      }

      const passwordHash = await createPasswordHash(password);

      // INSERT MATCHING YOUR DB SCHEMA
      const [result] = await pool.execute(
        `INSERT INTO users 
         (email, phone, password_hash, full_name, role, is_verified)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          email || null,
          phone,
          passwordHash,
          fullName,
          role,
          1
        ]
      );

      res.status(201).json({
        success: true,
        message: "Registration successful",
        userId: result.insertId,
      });

    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        message: "Registration failed",
      });
    }
  }
);

router.post("/send-otp", async (req, res) => {
  try {
    let { phone, purpose } = req.body;

    if (!phone) {
      return res.status(400).json({
        success:false,
        message:"Phone required"
      });
    }

    phone = phone.replace(/\D/g,"");
    if (typeof purpose === "string") {
      purpose = purpose.trim().toLowerCase();
    } else {
      purpose = "login";
    }

    const allowedPurposes = new Set(["login", "register", "verify"]);
    if (!allowedPurposes.has(purpose)) {
      purpose = "login";
    }

    // login is only for already-registered users
    const [users] = await pool.execute(
      "SELECT * FROM users WHERE phone = ?",
      [phone]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Account not found. Please register first.",
      });
    }

    const otp = Math.floor(100000 + Math.random()*900000).toString();
    const expiresAt = new Date(Date.now() + 5*60*1000);

    // mark old OTP used
    await pool.execute(
      "UPDATE otp_verifications SET is_used=1 WHERE phone=? AND is_used=0",
      [phone]
    );

    await pool.execute(
      `INSERT INTO otp_verifications
       (phone, otp_code, purpose, expires_at)
       VALUES (?, ?, ?, ?)`,
      [phone, otp, purpose, expiresAt]
    );

    const sent = await sendOtpSMS(phone, otp);

    if(!sent){
      return res.status(500).json({
        success:false,
        message:"Failed to send OTP"
      });
    }

    const responsePayload = {
      success:true,
      message:"OTP sent successfully"
    };

    if (process.env.NODE_ENV !== "production") {
      responsePayload.otp = otp;
      responsePayload.expiresAt = expiresAt;
    }

    res.json(responsePayload);

  } catch(err){
    console.error(err);
    res.status(500).json({success:false,message:"Server error"});
  }
});


router.post("/verify-otp", async (req,res)=>{
  try{
    let { phone, otp } = req.body;

    if(!phone || !otp){
      return res.status(400).json({
        success:false,
        message:"Missing phone or OTP"
      });
    }

    phone = phone.replace(/\D/g,"");
    otp = String(otp).trim();

    const [records] = await pool.execute(
      `SELECT * FROM otp_verifications
       WHERE phone=? AND otp_code=? AND is_used=0
       AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [phone, otp]
    );

    if(records.length === 0){
      return res.status(400).json({
        success:false,
        message:"Invalid or expired OTP"
      });
    }

    const otpRecord = records[0];

    await pool.execute(
      "UPDATE otp_verifications SET is_used=1 WHERE id=?",
      [otpRecord.id]
    );

    const [users] = await pool.execute(
      "SELECT * FROM users WHERE phone=?",
      [phone]
    );

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    const user = users[0];

    await pool.execute(
      "UPDATE users SET is_verified=1 WHERE id=?",
      [user.id]
    );

    const accessToken = createAccessToken(user)

    res.json({
      success:true,
      message:"OTP verified",
      token: accessToken,
      accessToken,
      user:{
        id:user.id,
        email:user.email,
        phone:user.phone,
        fullName:user.full_name,
        role:user.role,
        visitPurpose: user.visit_purpose || null,
        profileImage:user.profile_image || null,
      }
    });

  }catch(err){
    console.error(err);
    res.status(500).json({success:false,message:"Server error"});
  }
});

// Logout (allow even if access token expired)
router.post("/logout", async (req, res) => {
  try {
    res.json({
      success: true,
      message: "Logged out successfully"
    })
  } catch (error) {
    console.error("Logout error:", error)
    res.status(500).json({
      success: false,
      message: "Logout failed"
    })
  }
})

// Get current user
router.get("/me", authenticateToken, async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      phone: req.user.phone,
      fullName: req.user.full_name,
      role: req.user.role,
      visitPurpose: req.user.visit_purpose || null,
      profileImage: req.user.profile_image || null,
    },
  })
})

// Update visit purpose
router.put(
  "/purpose",
  authenticateToken,
  [body("purpose").isIn(["post", "buy", "rent"])],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() })
      }

      const { purpose } = req.body
      await pool.execute("UPDATE users SET visit_purpose = ? WHERE id = ?", [purpose, req.user.id])

      res.json({
        success: true,
        message: "Visit purpose updated",
        purpose,
      })
    } catch (error) {
      console.error("Update visit purpose error:", error)
      res.status(500).json({ success: false, message: "Failed to update visit purpose" })
    }
  },
)

// Update current user profile
router.put(
  "/me",
  authenticateToken,
  [
    body("fullName").optional().trim().isLength({ min: 2 }),
    body("email").optional({ checkFalsy: true }).isEmail(),
    body("profileImage").optional({ nullable: true }).isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() })
      }

      const { fullName, email, profileImage } = req.body
      const updates = []
      const params = []

      if (typeof fullName === "string" && fullName.trim()) {
        updates.push("full_name = ?")
        params.push(fullName.trim())
      }

      if (email !== undefined) {
        const normalizedEmail = email ? String(email).trim() : null
        if (normalizedEmail) {
          const [existingEmail] = await pool.execute(
            "SELECT id FROM users WHERE email = ? AND id != ?",
            [normalizedEmail, req.user.id]
          )
          if (existingEmail.length > 0) {
            return res.status(400).json({
              success: false,
              message: "Email already in use by another account",
            })
          }
        }
        updates.push("email = ?")
        params.push(normalizedEmail)
      }

      if (profileImage !== undefined) {
        const normalizedProfileImage =
          typeof profileImage === "string" ? profileImage.trim() : null
        updates.push("profile_image = ?")
        params.push(normalizedProfileImage || null)
      }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No profile fields provided to update",
        })
      }

      params.push(req.user.id)
      await pool.execute(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params)

      const [users] = await pool.execute(
        "SELECT id, email, phone, full_name, role, profile_image FROM users WHERE id = ?",
        [req.user.id]
      )

      const user = users[0]
      res.json({
        success: true,
        message: "Profile updated successfully",
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          fullName: user.full_name,
          role: user.role,
          profileImage: user.profile_image || null,
        },
      })
    } catch (error) {
      console.error("Update profile error:", error)
      res.status(500).json({ success: false, message: "Failed to update profile" })
    }
  }
)

module.exports = router


