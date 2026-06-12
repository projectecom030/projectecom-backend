const db = require("../config/database");

const checkSubscription = async (req, res, next) => {
  const userId = req.user.id;

  const [rows] = await db.query(
    "SELECT * FROM user_subscriptions WHERE user_id = ? AND is_active = 1",
    [userId]
  );

  if (!rows.length) {
    return res.status(403).json({ message: "No active subscription" });
  }

  const subscription = rows[0];

  if (new Date(subscription.expires_at) < new Date()) {
    return res.status(403).json({ message: "Subscription expired" });
  }

  req.subscription = subscription;
  next();
};

module.exports = checkSubscription;
