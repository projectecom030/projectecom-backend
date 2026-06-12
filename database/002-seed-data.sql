-- Seed Data for Real Estate Platform
USE real_estate_platform;

-- Insert Property Types
INSERT INTO property_types (name, description, icon) VALUES
('Apartment', 'Residential apartment in a building', 'building'),
('Villa', 'Independent luxury house', 'home'),
('House', 'Independent residential house', 'house'),
('Plot', 'Land plot for construction', 'map'),
('Commercial', 'Commercial property for business', 'briefcase'),
('Office Space', 'Office space in commercial building', 'building-2'),
('Shop', 'Retail shop space', 'store'),
('Penthouse', 'Luxury penthouse apartment', 'crown');

-- Insert Amenities
INSERT INTO amenities (name, icon, category) VALUES
('Swimming Pool', 'waves', 'Recreation'),
('Gym', 'dumbbell', 'Recreation'),
('Parking', 'car', 'Basic'),
('Security', 'shield', 'Basic'),
('Power Backup', 'zap', 'Basic'),
('Lift', 'arrow-up', 'Basic'),
('Garden', 'flower', 'Recreation'),
('Clubhouse', 'users', 'Recreation'),
('Children Play Area', 'baby', 'Recreation'),
('CCTV', 'camera', 'Security'),
('Intercom', 'phone', 'Security'),
('Fire Safety', 'flame', 'Security'),
('Water Supply', 'droplet', 'Basic'),
('Gas Pipeline', 'flame', 'Basic'),
('WiFi', 'wifi', 'Basic'),
('Air Conditioning', 'wind', 'Comfort'),
('Modular Kitchen', 'utensils', 'Interior'),
('Wardrobe', 'archive', 'Interior'),
('Balcony', 'sun', 'Basic'),
('Terrace', 'sun', 'Basic');

-- Insert Admin User (password: admin123)
INSERT INTO users (email, phone, password_hash, full_name, role, is_verified) VALUES
('admin@proplist.com', '9999999999', '$2b$10$rQZ8K.5L5L5L5L5L5L5L5uQZ8K.5L5L5L5L5L5L5L5L5L5L5L5L', 'Admin User', 'admin', TRUE);

-- Insert Sample Properties
INSERT INTO properties (builder_id, title, description, property_type_id, price, area_sqft, bedrooms, bathrooms, parking_spaces, furnishing, address_line1, city, state, pincode, status, is_featured, listing_type) VALUES
(1, 'Luxury 3BHK Apartment in City Center', 'Beautiful 3BHK apartment with modern amenities, spacious rooms, and stunning city views. Perfect for families looking for a premium living experience.', 1, 8500000, 1800, 3, 3, 2, 'semi-furnished', '123 Main Street, Downtown', 'Mumbai', 'Maharashtra', '400001', 'available', TRUE, 'sale'),
(1, 'Spacious Villa with Garden', 'Elegant 4BHK villa with private garden, swimming pool, and premium finishes throughout. Ideal for those seeking luxury and privacy.', 2, 25000000, 4500, 4, 4, 3, 'fully-furnished', '456 Garden Lane, Suburbs', 'Bangalore', 'Karnataka', '560001', 'available', TRUE, 'sale'),
(1, 'Modern 2BHK for Rent', 'Well-maintained 2BHK apartment available for rent. Close to metro station and shopping centers. Ideal for young professionals.', 1, 35000, 1200, 2, 2, 1, 'semi-furnished', '789 Metro Road, Tech Park', 'Hyderabad', 'Telangana', '500001', 'available', FALSE, 'rent'),
(1, 'Commercial Office Space', 'Prime commercial office space in business district. Modern infrastructure, ample parking, and excellent connectivity.', 6, 15000000, 3000, 0, 2, 10, 'unfurnished', '101 Business Park, CBD', 'Delhi', 'Delhi', '110001', 'available', TRUE, 'sale'),
(1, 'Cozy 1BHK Studio Apartment', 'Perfect starter home or investment property. Compact yet comfortable 1BHK with all essential amenities.', 1, 3200000, 650, 1, 1, 1, 'unfurnished', '202 Student Quarter, University Area', 'Pune', 'Maharashtra', '411001', 'available', FALSE, 'sale');

-- Link Amenities to Properties
INSERT INTO property_amenities (property_id, amenity_id) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 10), (1, 11),
(2, 1), (2, 2), (2, 3), (2, 4), (2, 5), (2, 7), (2, 9), (2, 10), (2, 16), (2, 17),
(3, 3), (3, 4), (3, 5), (3, 6), (3, 13), (3, 15),
(4, 3), (4, 4), (4, 5), (4, 6), (4, 10), (4, 12), (4, 15), (4, 16),
(5, 3), (5, 4), (5, 6), (5, 13);

-- Insert Sample Property Images
INSERT INTO property_images (property_id, image_url, is_primary, display_order) VALUES
(1, '/placeholder.svg?height=400&width=600', TRUE, 1),
(1, '/placeholder.svg?height=400&width=600', FALSE, 2),
(1, '/placeholder.svg?height=400&width=600', FALSE, 3),
(2, '/placeholder.svg?height=400&width=600', TRUE, 1),
(2, '/placeholder.svg?height=400&width=600', FALSE, 2),
(2, '/placeholder.svg?height=400&width=600', FALSE, 3),
(3, '/placeholder.svg?height=400&width=600', TRUE, 1),
(4, '/placeholder.svg?height=400&width=600', TRUE, 1),
(5, '/placeholder.svg?height=400&width=600', TRUE, 1);
