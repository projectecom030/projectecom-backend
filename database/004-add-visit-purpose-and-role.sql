-- Add visit_purpose column and align role enum values
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS visit_purpose ENUM('post', 'buy', 'rent') NULL;

ALTER TABLE users
  MODIFY COLUMN role ENUM('admin', 'customer', 'dealer', 'broker', 'owner') DEFAULT 'customer';
