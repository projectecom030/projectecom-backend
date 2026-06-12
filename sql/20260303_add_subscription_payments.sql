CREATE TABLE IF NOT EXISTS subscription_payments (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  plan_id INT NOT NULL,
  subscription_id INT DEFAULT NULL,
  razorpay_order_id VARCHAR(100) NOT NULL,
  razorpay_payment_id VARCHAR(100) NOT NULL,
  amount_paise INT NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_subscription_payment_id (razorpay_payment_id),
  KEY idx_subscription_payments_user_id (user_id),
  KEY idx_subscription_payments_plan_id (plan_id),
  KEY idx_subscription_payments_subscription_id (subscription_id),
  CONSTRAINT subscription_payments_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT subscription_payments_plan_fk FOREIGN KEY (plan_id) REFERENCES subscription_plans (id),
  CONSTRAINT subscription_payments_subscription_fk FOREIGN KEY (subscription_id) REFERENCES user_subscriptions (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
