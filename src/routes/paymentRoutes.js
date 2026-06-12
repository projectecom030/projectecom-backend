const express = require("express");
const crypto = require("crypto");
const razorpay = require("../config/razorpay");
const db = require("../config/database");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

const getPlanRoleForUser = (userRole) =>
  userRole === "dealer" || userRole === "broker" ? "dealer" : "customer";
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

const resolveRazorpayPlanId = (plan) => plan.razorpay_plan_id || getEnvRazorpayPlanId(plan.name);

const ensureSubscriptionPaymentsTable = async (connection) => {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS subscription_payments (
      id INT NOT NULL AUTO_INCREMENT,
      user_id INT NOT NULL,
      plan_id INT NOT NULL,
      subscription_id INT DEFAULT NULL,
      razorpay_order_id VARCHAR(100) NOT NULL,
      razorpay_payment_id VARCHAR(100) NOT NULL,
      amount_paise INT NOT NULL,
      currency VARCHAR(10) NOT NULL DEFAULT 'INR',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_subscription_payments_razorpay_payment_id (razorpay_payment_id),
      KEY idx_subscription_payments_user_id (user_id),
      KEY idx_subscription_payments_plan_id (plan_id),
      KEY idx_subscription_payments_subscription_id (subscription_id),
      CONSTRAINT subscription_payments_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      CONSTRAINT subscription_payments_plan_fk FOREIGN KEY (plan_id) REFERENCES subscription_plans (id),
      CONSTRAINT subscription_payments_subscription_fk FOREIGN KEY (subscription_id) REFERENCES user_subscriptions (id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
};

router.post("/create-order", authenticateToken, async (req, res) => {
  try {
    const { plan_id } = req.body;
    const user_id = req.user.id;
    const planRole = getPlanRoleForUser(req.user.role);

    if (!plan_id) {
      return res.status(400).json({ message: "Plan ID is required" });
    }

    const [plans] = await db.query(
      "SELECT id, role, name, price, razorpay_plan_id FROM subscription_plans WHERE id = ? AND role = ?",
      [plan_id, planRole]
    );

    if (!plans.length) {
      return res.status(404).json({ message: "Plan not found for user role" });
    }

    const plan = plans[0];
    const amount = Number(plan.price) * 100;
    const resolvedRazorpayPlanId = resolveRazorpayPlanId(plan);

    if (amount <= 0) {
      return res.status(400).json({
        message: "Free plan activation is disabled. Please choose a paid plan.",
      });
    }

    if (!resolvedRazorpayPlanId) {
      return res.status(400).json({
        message: "Paid plan is missing Razorpay plan id. Update subscription_plans or .env plan ids.",
      });
    }

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `u${user_id}_p${plan.id}_${Date.now()}`.slice(0, 40),
      notes: {
        user_id: String(user_id),
        plan_id: String(plan.id),
        role: plan.role,
        razorpay_plan_id: String(resolvedRazorpayPlanId),
      },
    });

    return res.json({
      ...order,
      razorpay_plan_id: resolvedRazorpayPlanId,
    });
  } catch (err) {
    console.error("Create order error:", err);
    return res.status(500).json({ message: "Order creation failed" });
  }
});

router.post("/verify-payment", authenticateToken, async (req, res) => {
  let connection;
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan_id } =
      req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Payment details missing" });
    }

    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ message: "Payment verification is not configured" });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Invalid signature" });
    }

    const [order, payment] = await Promise.all([
      razorpay.orders.fetch(razorpay_order_id),
      razorpay.payments.fetch(razorpay_payment_id),
    ]);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (!payment || payment.order_id !== razorpay_order_id) {
      return res.status(400).json({ message: "Payment/order mismatch" });
    }

    if (payment.status !== "captured") {
      return res.status(400).json({ message: "Payment not captured" });
    }

    const user_id = req.user.id;
    const planRole = getPlanRoleForUser(req.user.role);
    const orderUserId = Number(order.notes?.user_id);
    const requestedPlanId = Number(plan_id);
    const orderPlanId = Number(order.notes?.plan_id) || requestedPlanId;

    if (!orderUserId || orderUserId !== user_id) {
      return res.status(403).json({ message: "Order does not belong to user" });
    }

    if (!orderPlanId) {
      return res.status(400).json({ message: "Invalid order plan" });
    }

    if (requestedPlanId && requestedPlanId !== orderPlanId) {
      return res.status(400).json({ message: "Plan mismatch for payment verification" });
    }

    if (payment.amount !== order.amount || payment.currency !== order.currency) {
      return res.status(400).json({ message: "Payment amount mismatch" });
    }

    const [plans] = await db.query(
      `SELECT id, role, price, contacts, validity_days
       FROM subscription_plans
       WHERE id = ? AND role = ?`,
      [orderPlanId, planRole]
    );

    if (!plans.length) {
      return res.status(404).json({ message: "Plan not found for user role" });
    }

    const plan = plans[0];
    if (Number(plan.price) <= 0) {
      return res.status(400).json({ message: "Free plans do not require payment" });
    }

    if (Number(order.amount) !== Number(plan.price) * 100 || order.currency !== "INR") {
      return res
        .status(400)
        .json({ message: "Order amount does not match selected plan" });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();
    await ensureSubscriptionPaymentsTable(connection);

    const [existing] = await connection.query(
      `SELECT id
       FROM subscription_payments
       WHERE razorpay_payment_id = ?
       LIMIT 1`,
      [razorpay_payment_id]
    );

    if (existing.length) {
      await connection.rollback();
      return res.json({
        success: true,
        idempotent: true,
        message: "Payment already processed",
      });
    }

    await connection.query(
      "UPDATE user_subscriptions SET is_active = 0 WHERE user_id = ?",
      [user_id]
    );

    const [subscriptionInsert] = await connection.query(
      `INSERT INTO user_subscriptions
         (user_id, plan_id, contacts_remaining, expires_at, is_active)
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY), 1)`,
      [user_id, plan.id, plan.contacts, plan.validity_days]
    );

    await connection.query(
      `INSERT INTO subscription_payments
        (user_id, plan_id, subscription_id, razorpay_order_id, razorpay_payment_id, amount_paise, currency)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        plan.id,
        subscriptionInsert.insertId,
        razorpay_order_id,
        razorpay_payment_id,
        Number(order.amount),
        order.currency || "INR",
      ]
    );

    await connection.commit();
    return res.json({
      success: true,
      message: "Payment verified and subscription activated",
    });
  } catch (err) {
    if (connection) {
      await connection.rollback();
    }
    if (err && err.code === "ER_NO_SUCH_TABLE") {
      return res.status(500).json({
        message: "Missing table subscription_payments. Run migration first.",
      });
    }
    console.error("Verify error:", err);
    return res.status(500).json({ message: err.message || "Verification failed" });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

const toPayloadBuffer = (body) => {
  if (Buffer.isBuffer(body)) return body;
  if (typeof body === "string") return Buffer.from(body, "utf8");
  return Buffer.from(JSON.stringify(body || {}), "utf8");
};

const isValidWebhookSignature = (payload, signature, secret) => {
  if (!signature || !secret) return false;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  const provided = Buffer.from(String(signature), "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (provided.length !== expected.length) return false;

  return crypto.timingSafeEqual(provided, expected);
};

router.post("/webhook", async (req, res) => {
  let connection;
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];
    const payload = toPayloadBuffer(req.body);

    if (!secret) {
      console.error("Webhook secret not configured");
      return res.status(500).json({ message: "Webhook secret missing" });
    }

    if (!isValidWebhookSignature(payload, signature, secret)) {
      return res.status(400).json({ message: "Invalid webhook signature" });
    }

    const event = JSON.parse(payload.toString("utf8"));
    const paymentId = event?.payload?.payment?.entity?.id;
    const orderId = event?.payload?.order?.entity?.id;
    const orderNotes = event?.payload?.order?.entity?.notes || {};
    const paymentNotes = event?.payload?.payment?.entity?.notes || {};
    const notes = { ...orderNotes, ...paymentNotes };
    const userId = Number(notes.user_id);
    const planId = Number(notes.plan_id);

    switch (event.event) {
      case "payment.captured":
        console.log("Webhook: payment.captured", { paymentId, orderId });
        break;
      case "payment.failed":
        console.log("Webhook: payment.failed", { paymentId, orderId });
        break;
      case "order.paid":
        console.log("Webhook: order.paid", { paymentId, orderId });
        break;
      default:
        console.log("Webhook: unhandled event", {
          event: event.event,
          paymentId,
          orderId,
        });
    }

    if (event.event !== "payment.captured") {
      return res.status(200).json({ received: true });
    }

    if (!paymentId || !orderId || !userId || !planId) {
      return res.status(400).json({ message: "Webhook missing payment/order metadata" });
    }

    const [users] = await db.query("SELECT role FROM users WHERE id = ?", [userId]);
    if (!users.length) {
      return res.status(404).json({ message: "User not found for webhook" });
    }

    const planRole = getPlanRoleForUser(users[0].role);
    const [plans] = await db.query(
      `SELECT id, role, price, contacts, validity_days
       FROM subscription_plans
       WHERE id = ? AND role = ?`,
      [planId, planRole]
    );

    if (!plans.length) {
      return res.status(404).json({ message: "Plan not found for webhook" });
    }

    const plan = plans[0];
    if (Number(plan.price) <= 0) {
      return res.status(400).json({ message: "Free plans are not activated via payment webhook" });
    }

    const paymentAmount = Number(event?.payload?.payment?.entity?.amount) || 0;
    const orderAmount = Number(event?.payload?.order?.entity?.amount) || 0;
    const amountPaise = paymentAmount || orderAmount || Number(plan.price) * 100;
    const currency =
      event?.payload?.payment?.entity?.currency ||
      event?.payload?.order?.entity?.currency ||
      "INR";

    if (orderAmount && orderAmount !== Number(plan.price) * 100) {
      return res.status(400).json({ message: "Order amount does not match plan price" });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();
    await ensureSubscriptionPaymentsTable(connection);

    const [existing] = await connection.query(
      `SELECT id
       FROM subscription_payments
       WHERE razorpay_payment_id = ?
       LIMIT 1`,
      [paymentId]
    );

    if (existing.length) {
      await connection.rollback();
      return res.status(200).json({ received: true, idempotent: true });
    }

    await connection.query(
      "UPDATE user_subscriptions SET is_active = 0 WHERE user_id = ?",
      [userId]
    );

    const [subscriptionInsert] = await connection.query(
      `INSERT INTO user_subscriptions
         (user_id, plan_id, contacts_remaining, expires_at, is_active)
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY), 1)`,
      [userId, plan.id, plan.contacts, plan.validity_days]
    );

    await connection.query(
      `INSERT INTO subscription_payments
        (user_id, plan_id, subscription_id, razorpay_order_id, razorpay_payment_id, amount_paise, currency)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        plan.id,
        subscriptionInsert.insertId,
        orderId,
        paymentId,
        amountPaise,
        currency,
      ]
    );

    await connection.commit();
    return res.status(200).json({ received: true, activated: true });
  } catch (err) {
    if (connection) {
      await connection.rollback();
    }
    console.error("Webhook error:", err);
    return res.status(500).json({ message: "Webhook failed" });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;
