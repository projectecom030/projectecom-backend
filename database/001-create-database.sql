-- Real Estate Property Listing Platform
-- MySQL Database Schema

-- Create Database
CREATE DATABASE IF NOT EXISTS real_estate_platform;
USE real_estate_platform;

-- Users Table (for both Admin/Builder and regular users)
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role ENUM('admin', 'customer', 'dealer', 'broker', 'owner') DEFAULT 'customer',
    profile_image VARCHAR(500),
    visit_purpose ENUM('post', 'buy', 'rent'),
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_phone (phone),
    INDEX idx_role (role)
);

-- OTP Verification Table
CREATE TABLE otp_verifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    phone VARCHAR(20),
    email VARCHAR(255),
    otp_code VARCHAR(6) NOT NULL,
    purpose ENUM('registration', 'login', 'password_reset') NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_phone_otp (phone, otp_code),
    INDEX idx_email_otp (email, otp_code)
);

-- Sessions Table
CREATE TABLE sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token),
    INDEX idx_user_sessions (user_id)
);

-- Refresh Tokens Table
CREATE TABLE refresh_tokens (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_refresh_user (user_id),
    INDEX idx_refresh_expires (expires_at)
);

-- Property Types Table
CREATE TABLE property_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- Properties Table
CREATE TABLE properties (
    id INT PRIMARY KEY AUTO_INCREMENT,
    builder_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    property_type_id INT,
    price DECIMAL(15, 2) NOT NULL,
    price_unit ENUM('total', 'per_sqft', 'per_month') DEFAULT 'total',
    area_sqft DECIMAL(10, 2),
    bedrooms INT,
    bathrooms INT,
    parking_spaces INT DEFAULT 0,
    furnishing ENUM('unfurnished', 'semi-furnished', 'fully-furnished'),
    facing VARCHAR(20),
    floor_number INT,
    total_floors INT,
    age_of_property VARCHAR(50),
    
    -- Location Details
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    pincode VARCHAR(10) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Status and Visibility
    status ENUM('available', 'sold', 'rented', 'under_construction') DEFAULT 'available',
    is_visible BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    listing_type ENUM('sale', 'rent') DEFAULT 'sale',
    view_count INT NOT NULL DEFAULT 0,
    contact_count INT NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (builder_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (property_type_id) REFERENCES property_types(id) ON DELETE SET NULL,
    INDEX idx_builder (builder_id),
    INDEX idx_city (city),
    INDEX idx_status (status),
    INDEX idx_price (price),
    INDEX idx_listing_type (listing_type),
    FULLTEXT INDEX idx_search (title, description, address_line1, city)
);

-- Property Images Table
CREATE TABLE property_images (
    id INT PRIMARY KEY AUTO_INCREMENT,
    property_id INT NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    INDEX idx_property_images (property_id)
);

-- Property Amenities Table
CREATE TABLE amenities (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    icon VARCHAR(50),
    category VARCHAR(50)
);

-- Property-Amenities Junction Table
CREATE TABLE property_amenities (
    property_id INT NOT NULL,
    amenity_id INT NOT NULL,
    PRIMARY KEY (property_id, amenity_id),
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    FOREIGN KEY (amenity_id) REFERENCES amenities(id) ON DELETE CASCADE
);

-- User Inquiries Table
CREATE TABLE inquiries (
    id INT PRIMARY KEY AUTO_INCREMENT,
    property_id INT NOT NULL,
    user_name VARCHAR(100) NOT NULL,
    user_email VARCHAR(255),
    user_phone VARCHAR(20) NOT NULL,
    message TEXT,
    inquiry_type ENUM('call', 'message', 'callback_request') NOT NULL,
    status ENUM('new', 'contacted', 'closed') DEFAULT 'new',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    INDEX idx_property_inquiries (property_id),
    INDEX idx_inquiry_status (status)
);

-- Favorites Table (for users to save properties)
CREATE TABLE favorites (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    property_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_favorite (user_id, property_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);
