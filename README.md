# Real Estate Backend (Node.js + Express + MySQL)

A robust RESTful API backend for the Real Estate Property Listing Platform.

## Features

- User authentication (Email/Password + Phone OTP)
- Property CRUD operations
- Image upload and management
- Inquiry system
- Admin dashboard endpoints
- JWT-based session management
- Role-based access control

## Prerequisites

- Node.js 18+
- MySQL 8.0+
- npm or yarn

## Installation

1. Clone the repository
2. Navigate to the server folder:
   ```bash
   cd server
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a \`.env\` file from \`.env.example\`:
   ```bash
   cp .env.example .env
   ```
5. Update the \`.env\` file with your database credentials

## Database Setup

1. Start MySQL server
2. Run the database creation script:
   ```bash
   mysql -u root -p < database/001-create-database.sql
   ```
3. Run the visit purpose / role migration:
   ```bash
   mysql -u root -p < database/004-add-visit-purpose-and-role.sql
   ```
4. Run the seed data script:
   ```bash
   mysql -u root -p < database/002-seed-data.sql
   ```

## Running the Application

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

The server will run on http://localhost:5000

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/send-otp | Send OTP to phone |
| POST | /api/auth/verify-otp | Verify OTP and login |
| GET | /api/auth/me | Get current user |
| POST | /api/auth/logout | Logout user |

### Properties
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/properties | Get all properties (with filters) |
| GET | /api/properties/:id | Get property details |
| GET | /api/properties/featured | Get featured properties |
| GET | /api/properties/types | Get property types |

### Inquiries
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/inquiries | Submit new inquiry |
| GET | /api/inquiries/my | Get user's inquiries |

### Admin (Protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/admin/dashboard | Dashboard statistics |
| GET | /api/admin/properties | Get all properties |
| POST | /api/admin/properties | Create property |
| PUT | /api/admin/properties/:id | Update property |
| DELETE | /api/admin/properties/:id | Delete property |
| GET | /api/admin/inquiries | Get all inquiries |
| PUT | /api/admin/inquiries/:id | Update inquiry status |

### Upload
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/upload/image | Upload single image |
| POST | /api/upload/images | Upload multiple images |

## Project Structure

```
server/
├── database/
│   ├── 001-create-database.sql
│   └── 002-seed-data.sql
├── src/
│   ├── config/
│   │   └── database.js
│   ├── middleware/
│   │   └── auth.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── properties.js
│   │   ├── inquiries.js
│   │   ├── admin.js
│   │   └── upload.js
│   └── index.js
├── uploads/
├── .env.example
├── package.json
└── README.md
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 5000 |
| NODE_ENV | Environment | development |
| CLIENT_URL | Frontend URL | http://localhost:3000 |
| DB_HOST | MySQL host | localhost |
| DB_PORT | MySQL port | 3306 |
| DB_USER | MySQL user | root |
| DB_PASSWORD | MySQL password | - |
| DB_NAME | Database name | real_estate_platform |
| JWT_SECRET | JWT signing secret | - |
| ACCESS_TOKEN_TTL | Access token expiry | 15m |

## Security Features

- Password hashing with bcrypt
- JWT-based authentication
- CORS configuration
- Helmet security headers
- Input validation
- SQL injection prevention
```

```text file="server/.gitignore"
# Dependencies
node_modules/

# Environment files
.env
.env.local
.env.production

# Uploads
uploads/*
!uploads/.gitkeep

# Logs
logs/
*.log
npm-debug.log*

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/

# Build
dist/
build/
