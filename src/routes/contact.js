const express = require("express");
const router = express.Router();
const db = require("../config/database");
const { authenticateToken } = require("../middleware/auth");
const { ensurePropertyEngagementColumns } = require("../utils/ensurePropertyEngagementColumns");

router.post("/view-contact", authenticateToken, async (req, res) => {
  await ensurePropertyEngagementColumns();
  const userId = req.user.id;
  const { propertyId } = req.body;

  if (!propertyId) {
    return res.status(400).json({ message: "Property ID is required" });
  }

  if (req.user.role !== "customer") {
    return res.status(403).json({ message: "Direct contact is only available for customers." });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [propertyRows] = await connection.query(
      `
      SELECT u.phone
      FROM properties p
      JOIN users u ON p.builder_id = u.id
      WHERE p.id = ?
      LIMIT 1
      `,
      [propertyId]
    );

    if (!propertyRows.length) {
      await connection.rollback();
      return res.status(404).json({ message: "Property not found" });
    }

    const [subs] = await connection.query(
      `
      SELECT us.id, us.contacts_remaining, sp.is_premium
      FROM user_subscriptions us
      JOIN subscription_plans sp ON us.plan_id = sp.id
      WHERE us.user_id = ?
        AND us.is_active = 1
        AND us.contacts_remaining > 0
        AND us.expires_at > NOW()
      ORDER BY us.expires_at DESC
      LIMIT 1
      FOR UPDATE
      `,
      [userId]
    );

    if (!subs.length) {
      await connection.rollback();
      return res.status(403).json({ message: "No active subscription" });
    }

    const subscription = subs[0];
    if (Number(subscription.is_premium) === 1) {
      await connection.rollback();
      return res.status(403).json({ message: "Premium plan uses admin contact only." });
    }
    const [updateResult] = await connection.query(
      `
      UPDATE user_subscriptions
      SET contacts_remaining = contacts_remaining - 1
      WHERE id = ? AND contacts_remaining > 0
      `,
      [subscription.id]
    );

    if (!updateResult.affectedRows) {
      await connection.rollback();
      return res.status(403).json({ message: "No contacts remaining" });
    }

    await connection.query(
      `
      UPDATE properties
      SET contact_count = COALESCE(contact_count, 0) + 1
      WHERE id = ?
      `,
      [propertyId]
    );

    const [countRows] = await connection.query(
      `
      SELECT contact_count
      FROM properties
      WHERE id = ?
      LIMIT 1
      `,
      [propertyId]
    );

    await connection.commit();

    return res.json({
      success: true,
      phone: propertyRows[0].phone,
      contactsRemaining: Number(subscription.contacts_remaining) - 1,
      contactCount: Number(countRows[0]?.contact_count || 0),
    });
  } catch (err) {
    await connection.rollback();
    console.error("View contact error:", err);
    return res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }
});

module.exports = router;
