# Play2Study 🎓
**AI-powered gamified learning platform to fight procrastination**

## 🚀 Features

### Core Features
- ✅ User Authentication (JWT-based)
- ✅ Task Management (create, read, update, complete)
- ✅ XP & Level System
- ✅ User Profiles with Statistics
- ✅ Comments on Tasks
- ✅ Social Features (follow/unfollow users)
- ✅ Leaderboard System
- ✅ Admin Dashboard
- ✅ Advanced Search & Filtering

## 📋 Tech Stack

### Backend
- **Framework**: Node.js + Express
- **Database**: PostgreSQL
- **Authentication**: JWT (JSON Web Tokens)
- **Security**: Bcrypt, Helmet, Rate Limiting

### Frontend
- **Framework**: HTML/CSS/JavaScript
- **Testing**: Test Runner included

### DevOps
- **Containerization**: Docker & Docker Compose
- **Services**: PostgreSQL, Node.js Backend, Frontend

## 🛠️ Installation & Setup

### Prerequisites
- Docker & Docker Compose
- OR Node.js 16+, PostgreSQL 12+

### Quick Start (Docker)

```bash
# 1. Clone and setup
cd AetherProtocol6.04

# 2. Create .env file in backend folder
cp .env.example backend/.env

# 3. Build and run containers
docker-compose up --build

# 4. Access services:
# - Frontend: http://localhost:3000
# - Backend API: http://localhost:5000
# - PostgreSQL: localhost:5432
```

### Manual Setup (Without Docker)

```bash
# 1. Install dependencies
cd backend
npm install

# 2. Setup database
# Create PostgreSQL database and user
psql -U postgres
CREATE DATABASE mydb;

# 3. Configure environment
cp .env.example .env
# Edit .env with your database credentials

# 4. Start server
npm start
# Server runs on http://localhost:5000
```

## 📚 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication
All protected endpoints require JWT token in header:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

---

### 🔐 Authentication Endpoints

#### Register User
```
POST /auth/register
Content-Type: application/json

{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "password123",
  "confirmPassword": "password123"
}

Response: { token, user }
```

#### Login
```
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}

Response: { token, user }
```

---

### 👤 Profile Endpoints

#### Get Profile
```
GET /profile/:userId

Response: {
  id, username, email, level, xp, emeralds,
  avatar_url, bio, created_at,
  stats: { completed_tasks, followers, following }
}
```

#### Update Profile (Protected)
```
PUT /profile
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "username": "new_username",
  "bio": "I love learning!",
  "avatar_url": "https://example.com/avatar.jpg"
}

Response: { message, user }
```

---

### 📋 Task Endpoints

#### Create Task (Protected)
```
POST /tasks
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "title": "Learn React",
  "description": "Complete React tutorial",
  "xp_reward": 50,
  "difficulty": "medium",
  "category": "programming"
}

Response: { id, user_id, title, ... }
```

#### Get All Tasks (Protected - with filters)
```
GET /tasks?search=React&difficulty=medium&category=programming&completed=false
Authorization: Bearer TOKEN

Response: [ { id, title, description, ... }, ... ]
```

#### Get Single Task (Protected)
```
GET /tasks/:taskId
Authorization: Bearer TOKEN

Response: {
  id, title, description, xp_reward, difficulty, completed,
  comments: [ { id, content, username, created_at }, ... ]
}
```

#### Complete Task & Earn XP (Protected)
```
PUT /tasks/:taskId/complete
Authorization: Bearer TOKEN

Response: {
  message: "Task completed!",
  xp_earned: 50,
  user_stats: { level, xp, emeralds }
}
```

#### Delete Task (Protected)
```
DELETE /tasks/:taskId
Authorization: Bearer TOKEN

Response: { message: "Task deleted" }
```

---

### 💬 Comment Endpoints

#### Add Comment (Protected)
```
POST /tasks/:taskId/comments
Authorization: Bearer TOKEN
Content-Type: application/json

{
  "content": "Great task! I learned a lot."
}

Response: { id, task_id, user_id, content, created_at }
```

#### Delete Comment (Protected)
```
DELETE /comments/:commentId
Authorization: Bearer TOKEN

Response: { message: "Comment deleted" }
```

---

### 👥 Social Endpoints

#### Follow User (Protected)
```
POST /users/:userId/follow
Authorization: Bearer TOKEN

Response: { message: "User followed" }
```

#### Unfollow User (Protected)
```
POST /users/:userId/unfollow
Authorization: Bearer TOKEN

Response: { message: "User unfollowed" }
```

#### Get Followers
```
GET /users/:userId/followers

Response: [
  { id, username, avatar_url, level },
  ...
]
```

#### Get Following
```
GET /users/:userId/following

Response: [
  { id, username, avatar_url, level },
  ...
]
```

---

### 🏆 Leaderboard Endpoints

#### Get Top Users
```
GET /leaderboard/top?limit=10

Response: [
  { id, username, level, xp, emeralds, avatar_url },
  ...
]
```

#### Get User Rank
```
GET /leaderboard/rank/:userId

Response: { rank: 5 }
```

---

### 🔧 Admin Endpoints (Admin Only)

#### Get All Users
```
GET /admin/users
Authorization: Bearer ADMIN_TOKEN

Response: [
  { id, username, email, level, xp, created_at },
  ...
]
```

#### Delete User
```
DELETE /admin/users/:userId
Authorization: Bearer ADMIN_TOKEN

Response: { message: "User deleted" }
```

#### Make User Admin
```
PUT /admin/users/:userId/make-admin
Authorization: Bearer ADMIN_TOKEN

Response: { message: "User is now admin" }
```

#### Get System Stats
```
GET /admin/stats
Authorization: Bearer ADMIN_TOKEN

Response: {
  total_users: 150,
  total_tasks: 1200,
  completed_tasks: 890
}
```

---

## 🗄️ Database Schema

### Users Table
```sql
- id: SERIAL PRIMARY KEY
- username: VARCHAR UNIQUE
- email: VARCHAR UNIQUE
- password: VARCHAR (hashed)
- level: INTEGER (default 1)
- xp: INTEGER (default 0)
- emeralds: INTEGER (default 0)
- is_admin: BOOLEAN (default false)
- avatar_url: VARCHAR
- bio: TEXT
- created_at, updated_at: TIMESTAMP
```

### Tasks Table
```sql
- id: SERIAL PRIMARY KEY
- user_id: INTEGER FK → users
- title, description: VARCHAR/TEXT
- xp_reward: INTEGER
- difficulty: VARCHAR (easy/medium/hard)
- category: VARCHAR
- completed: BOOLEAN
- created_at, completed_at: TIMESTAMP
```

### Comments Table
```sql
- id: SERIAL PRIMARY KEY
- task_id: INTEGER FK → tasks
- user_id: INTEGER FK → users
- content: TEXT
- created_at: TIMESTAMP
```

### Followers Table
```sql
- follower_id: INTEGER FK → users
- following_id: INTEGER FK → users
- created_at: TIMESTAMP
```

### Achievements Table
```sql
- id: SERIAL PRIMARY KEY
- user_id: INTEGER FK → users
- achievement_name: VARCHAR
- earned_at: TIMESTAMP
```

---

## 🧪 Testing API

### Using cURL

```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "pass123",
    "confirmPassword": "pass123"
  }'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "pass123"
  }'

# Get Profile (with token)
curl -X GET http://localhost:5000/api/profile/1 \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create Task
curl -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "Learn Docker",
    "description": "Master containerization",
    "xp_reward": 100,
    "difficulty": "hard"
  }'
```

### Using Postman
Import the endpoints listed above into Postman for easy testing.

---

## 📁 Project Structure

```
AetherProtocol6.04/
├── backend/
│   ├── server.js              # Main API server
│   ├── package.json           # Dependencies
│   ├── .env                   # Environment config
│   ├── Dockerfile             # Docker image
│   └── node_modules/          # Installed packages
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── assets/
├── docker-compose.yml         # Docker services
├── .env.example               # Environment template
└── README.md                  # This file
```

---

## 🚢 Deployment

### Docker Compose
```bash
docker-compose up --build -d
```

### Environment Variables for Production
```bash
# Update backend/.env with:
NODE_ENV=production
JWT_SECRET=your_strong_secret_key_here
DB_PASSWORD=strong_password
```

---

## 🐛 Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solution**: Make sure PostgreSQL is running or Docker container is up:
```bash
docker-compose up
```

### Port Already in Use
```
Error: listen EADDRINUSE :::5000
```
**Solution**: Change PORT in .env or kill process:
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :5000
kill -9 <PID>
```

### JWT Token Expired
```
Error: "Invalid or expired token"
```
**Solution**: Request a new token by logging in again.

---

## 📈 Future Enhancements

- [ ] Email verification
- [ ] Password reset functionality
- [ ] Real-time notifications
- [ ] AI task recommendations
- [ ] Gamification badges
- [ ] Mobile app
- [ ] WebSocket support for live updates
- [ ] Analytics dashboard

---

## 📝 License

MIT License - Feel free to use this project!

---

## 🤝 Support

For issues or questions, please create an issue in the repository.

**Made with ❤️ for learning and productivity** 
