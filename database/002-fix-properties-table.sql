-- Fix Properties Table - Run this to update an existing table
-- This removes the invalid 'service_choice' column and ensures correct schema

-- Step 1: Drop the table if exists (backup your data first!)
-- DROP TABLE IF EXISTS properties;

-- Step 2: If you want to fix the existing table without dropping it, run this:
-- Note: Run each statement individually

-- Remove the invalid 'service_choice' column if it exists
-- ALTER TABLE properties DROP COLUMN IF EXISTS service_choice;  -- (MySQL 8.0.32+)

-- For older MySQL versions, use this:
-- ALTER TABLE properties DROP COLUMN service_choice;

-- Ensure all required columns exist (these are added dynamically by the app, but you can add them manually):
-- ALTER TABLE properties ADD COLUMN latitude DECIMAL(10,8) DEFAULT NULL AFTER pincode;
-- ALTER TABLE properties ADD COLUMN longitude DECIMAL(11,8) DEFAULT NULL AFTER latitude;
-- ALTER TABLE properties ADD COLUMN google_place_id VARCHAR(255) DEFAULT NULL AFTER longitude;
-- ALTER TABLE properties ADD COLUMN map_address VARCHAR(500) DEFAULT NULL AFTER google_place_id;

-- Fix subscription_plan enum values if needed:
-- First, change to a compatible type, then back to enum with correct values
-- ALTER TABLE properties MODIFY subscription_plan VARCHAR(20) DEFAULT 'premium';
-- ALTER TABLE properties MODIFY subscription_plan ENUM('premium','elite','super_elite') DEFAULT 'premium';

-- Ensure is_visible and is_featured are tinyint(1):
-- ALTER TABLE properties MODIFY is_visible TINYINT(1) DEFAULT '1';
-- ALTER TABLE properties MODIFY is_featured TINYINT(1) DEFAULT '0';

