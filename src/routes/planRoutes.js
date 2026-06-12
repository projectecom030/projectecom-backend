const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { optionalAuth } = require("../middleware/auth");

const resolvePlanRole = (role) => {
  if (role === "dealer" || role === "broker") return "dealer";
  return "customer";
};

// GET PLANS
router.get("/", optionalAuth, async (req, res) => {
  try {
    const role = resolvePlanRole(req.user?.role);
    const [plans] = await db.query(`
      SELECT 
        id,
        role,
        name,
        is_premium,
        price,
        contacts,
        validity_days,
        razorpay_plan_id
      FROM subscription_plans
      WHERE role = ?
      ORDER BY price ASC
    `, [role]);

    res.json(plans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
