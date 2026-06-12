const express = require("express");
const db = require("../config/database");
const { authenticateToken, optionalAuth } = require("../middleware/auth");

const router = express.Router();

const normalizePlanKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const getEnvRazorpayPlanId = (planName) => {
  const key = normalizePlanKey(planName);
  if (key === "elite") return process.env.RAZORPAY_PLAN_ID_ELITE || "";
  if (key === "super_elite") return process.env.RAZORPAY_PLAN_ID_SUPER_ELITE || "";
  if (key === "premium") return process.env.RAZORPAY_PLAN_ID_PREMIUM || "";
  if (key === "dealer_elite") return process.env.RAZORPAY_PLAN_ID_DEALER_ELITE || "";
  if (key === "dealer_super_elite") return process.env.RAZORPAY_PLAN_ID_DEALER_SUPER_ELITE || "";
  return "";
};

const resolvePlanRole = (role) => {
  if (role === "dealer" || role === "broker") return "dealer";
  return "customer";
};

router.get("/plans", optionalAuth, async (req, res) => {
  try {
    const role = resolvePlanRole(req.user?.role);

    const [plans] = await db.query(
      `SELECT id, role, name, price, contacts, validity_days, is_premium, razorpay_plan_id
       FROM subscription_plans
       WHERE role = ?
       ORDER BY price ASC, id ASC`,
      [role]
    );

    const data = plans.map((plan) => ({
      ...plan,
      razorpay_plan_id: plan.razorpay_plan_id || getEnvRazorpayPlanId(plan.name),
    }));

    return res.json({
      success: true,
      data,
      role,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch subscription plans",
    });
  }
});

router.get("/plans/all", async (req, res) => {
  try {
    const [plans] = await db.query(
      `SELECT id, role, name, price, contacts, validity_days, is_premium, razorpay_plan_id
       FROM subscription_plans
       ORDER BY role ASC, price ASC, id ASC`
    );

    const data = plans.map((plan) => ({
      ...plan,
      razorpay_plan_id: plan.razorpay_plan_id || getEnvRazorpayPlanId(plan.name),
    }));

    const customerPlans = data.filter((plan) => plan.role === "customer");
    const dealerPlans = data.filter((plan) => plan.role === "dealer");

    return res.json({
      success: true,
      customerPlans,
      dealerPlans,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch subscription plans",
    });
  }
});

router.get("/active", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await db.query(`
      SELECT us.*, sp.name, sp.price, sp.contacts, sp.validity_days, sp.is_premium, sp.role
      FROM user_subscriptions us
      JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE us.user_id = ?
      AND us.is_active = 1
      AND us.expires_at > NOW()
    `, [userId]);

    return res.json({
      success: true,
      data: rows[0] || null,
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch active subscription",
    });
  }
});

module.exports = router;
