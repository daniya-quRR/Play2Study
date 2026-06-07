const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();

// Security Middleware
app.use(helmet());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later."
});

app.use(limiter);

// CORS & JSON
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// ============ MIDDLEWARE ============

// JWT Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token missing" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
}

// Admin Middleware
async function adminCheck(req, res, next) {
  try {
    const result = await pool.query(
      "SELECT is_admin FROM users WHERE id = $1",
      [req.user.id]
    );
    
    if (!result.rows[0] || !result.rows[0].is_admin) {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: "Admin check failed" });
  }
}

// Validation Middleware
function validateInput(schema) {
  return (req, res, next) => {
    const validation = schema.validate(req.body, { abortEarly: false });
    if (validation.error) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validation.error.details.map(d => d.message) 
      });
    }
    next();
  };
}

// ============ DATABASE INITIALIZATION ============

async function initDatabase() {
  try {
    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        level INTEGER DEFAULT 1,
        xp INTEGER DEFAULT 0,
        emeralds INTEGER DEFAULT 0,
        health INTEGER DEFAULT 100,
        willpower INTEGER DEFAULT 100,
        is_admin BOOLEAN DEFAULT FALSE,
        avatar_url VARCHAR(255),
        bio TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✓ Users table ready");

    // Tasks table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        xp_reward INTEGER DEFAULT 10,
        difficulty VARCHAR(20) DEFAULT 'medium',
        category VARCHAR(50),
        completed BOOLEAN DEFAULT FALSE,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✓ Tasks table ready");

    // Comments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✓ Comments table ready");

    // Followers table (Social)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS followers (
        id SERIAL PRIMARY KEY,
        follower_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        following_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(follower_id, following_id)
      )
    `);
    console.log("✓ Followers table ready");

    // Achievements table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS achievements (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        achievement_name VARCHAR(100),
        earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("✓ Achievements table ready");

  } catch (err) {
    console.error("Database init error:", err);
  }
}

// ============ HEALTH CHECK ============

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// ============ AUTHENTICATION ROUTES ============

// REGISTER
app.post("/api/auth/register", async (req, res) => {
  const { username, email, password, confirmPassword } = req.body;

  // Validation
  if (!username || !email || !password) {
    return res.status(400).json({ error: "All fields required" });
  }
  
  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  try {
    const existingUser = await pool.query(
      "SELECT * FROM users WHERE email = $1 OR username = $2",
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (username, email, password)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, level, xp`,
      [username, email, hashedPassword]
    );

    const token = jwt.sign(
      { id: result.rows[0].id, email: result.rows[0].email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: result.rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// LOGIN
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        level: user.level,
        xp: user.xp,
        emeralds: user.emeralds,
        is_admin: user.is_admin
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ============ PROFILE ROUTES ============

// GET PROFILE
app.get("/api/profile/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await pool.query(
      `SELECT id, username, email, level, xp, emeralds, health, willpower, 
              avatar_url, bio, is_admin, created_at 
       FROM users WHERE id = $1`,
      [userId]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const stats = await pool.query(
      `SELECT COUNT(*) as completed_tasks FROM tasks 
       WHERE user_id = $1 AND completed = TRUE`,
      [userId]
    );

    const followers = await pool.query(
      "SELECT COUNT(*) FROM followers WHERE following_id = $1",
      [userId]
    );

    const following = await pool.query(
      "SELECT COUNT(*) FROM followers WHERE follower_id = $1",
      [userId]
    );

    res.json({
      ...user.rows[0],
      stats: {
        completed_tasks: stats.rows[0].completed_tasks,
        followers: followers.rows[0].count,
        following: following.rows[0].count
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// UPDATE PROFILE (Protected)
app.put("/api/profile", authenticateToken, async (req, res) => {
  const { username, bio, avatar_url } = req.body;
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `UPDATE users 
       SET username = COALESCE($1, username),
           bio = COALESCE($2, bio),
           avatar_url = COALESCE($3, avatar_url),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, username, email, bio, avatar_url, level, xp`,
      [username, bio, avatar_url, userId]
    );

    res.json({ message: "Profile updated", user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// ============ TASKS ROUTES ============

// CREATE TASK (Protected)
app.post("/api/tasks", authenticateToken, async (req, res) => {
  const { title, description, xp_reward, difficulty, category } = req.body;
  const userId = req.user.id;

  if (!title) {
    return res.status(400).json({ error: "Task title required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO tasks (user_id, title, description, xp_reward, difficulty, category)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, title, description, xp_reward || 10, difficulty || "medium", category]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create task" });
  }
});

// GET ALL TASKS (with filters & search)
app.get("/api/tasks", authenticateToken, async (req, res) => {
  const { search, difficulty, category, completed } = req.query;
  const userId = req.user.id;

  let query = "SELECT * FROM tasks WHERE user_id = $1";
  const params = [userId];
  let paramCount = 1;

  if (search) {
    paramCount++;
    query += ` AND (title ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
    params.push(`%${search}%`);
  }

  if (difficulty) {
    paramCount++;
    query += ` AND difficulty = $${paramCount}`;
    params.push(difficulty);
  }

  if (category) {
    paramCount++;
    query += ` AND category = $${paramCount}`;
    params.push(category);
  }

  if (completed !== undefined) {
    paramCount++;
    query += ` AND completed = $${paramCount}`;
    params.push(completed === "true");
  }

  query += " ORDER BY created_at DESC";

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// GET SINGLE TASK
app.get("/api/tasks/:taskId", authenticateToken, async (req, res) => {
  const { taskId } = req.params;

  try {
    const task = await pool.query(
      "SELECT * FROM tasks WHERE id = $1",
      [taskId]
    );

    if (task.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const comments = await pool.query(
      `SELECT c.id, c.content, c.created_at, u.username, u.avatar_url
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.task_id = $1
       ORDER BY c.created_at DESC`,
      [taskId]
    );

    res.json({
      ...task.rows[0],
      comments: comments.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch task" });
  }
});

// COMPLETE TASK & ADD XP (Protected)
app.put("/api/tasks/:taskId/complete", authenticateToken, async (req, res) => {
  const { taskId } = req.params;
  const userId = req.user.id;

  try {
    // Get task details
    const task = await pool.query(
      "SELECT * FROM tasks WHERE id = $1 AND user_id = $2",
      [taskId, userId]
    );

    if (task.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    const xpReward = task.rows[0].xp_reward;

    // Update task
    await pool.query(
      "UPDATE tasks SET completed = TRUE, completed_at = CURRENT_TIMESTAMP WHERE id = $1",
      [taskId]
    );

    // Add XP to user
    const userUpdate = await pool.query(
      `UPDATE users 
       SET xp = xp + $1,
           level = FLOOR(1 + (xp + $1) / 100)
       WHERE id = $2
       RETURNING level, xp, emeralds`,
      [xpReward, userId]
    );

    res.json({
      message: "Task completed!",
      xp_earned: xpReward,
      user_stats: userUpdate.rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to complete task" });
  }
});

// DELETE TASK (Protected)
app.delete("/api/tasks/:taskId", authenticateToken, async (req, res) => {
  const { taskId } = req.params;
  const userId = req.user.id;

  try {
    const result = await pool.query(
      "DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id",
      [taskId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.json({ message: "Task deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

// ============ COMMENTS ROUTES ============

// ADD COMMENT (Protected)
app.post("/api/tasks/:taskId/comments", authenticateToken, async (req, res) => {
  const { taskId } = req.params;
  const { content } = req.body;
  const userId = req.user.id;

  if (!content) {
    return res.status(400).json({ error: "Comment content required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO comments (task_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [taskId, userId, content]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add comment" });
  }
});

// DELETE COMMENT (Protected)
app.delete("/api/comments/:commentId", authenticateToken, async (req, res) => {
  const { commentId } = req.params;
  const userId = req.user.id;

  try {
    const result = await pool.query(
      "DELETE FROM comments WHERE id = $1 AND user_id = $2 RETURNING id",
      [commentId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: "Cannot delete this comment" });
    }

    res.json({ message: "Comment deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});

// ============ SOCIAL ROUTES ============

// FOLLOW USER (Protected)
app.post("/api/users/:userId/follow", authenticateToken, async (req, res) => {
  const { userId } = req.params;
  const followerId = req.user.id;

  if (parseInt(userId) === followerId) {
    return res.status(400).json({ error: "Cannot follow yourself" });
  }

  try {
    await pool.query(
      `INSERT INTO followers (follower_id, following_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [followerId, userId]
    );

    res.json({ message: "User followed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to follow user" });
  }
});

// UNFOLLOW USER (Protected)
app.post("/api/users/:userId/unfollow", authenticateToken, async (req, res) => {
  const { userId } = req.params;
  const followerId = req.user.id;

  try {
    await pool.query(
      "DELETE FROM followers WHERE follower_id = $1 AND following_id = $2",
      [followerId, userId]
    );

    res.json({ message: "User unfollowed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to unfollow user" });
  }
});

// GET FOLLOWERS LIST
app.get("/api/users/:userId/followers", async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.avatar_url, u.level
       FROM users u
       JOIN followers f ON u.id = f.follower_id
       WHERE f.following_id = $1
       ORDER BY u.level DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch followers" });
  }
});

// GET FOLLOWING LIST
app.get("/api/users/:userId/following", async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.avatar_url, u.level
       FROM users u
       JOIN followers f ON u.id = f.following_id
       WHERE f.follower_id = $1
       ORDER BY u.level DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch following" });
  }
});

// ============ LEADERBOARD ROUTES ============

// GET TOP USERS BY LEVEL
app.get("/api/leaderboard/top", async (req, res) => {
  const { limit = 10 } = req.query;

  try {
    const result = await pool.query(
      `SELECT id, username, level, xp, emeralds, avatar_url 
       FROM users 
       ORDER BY level DESC, xp DESC 
       LIMIT $1`,
      [Math.min(limit, 100)]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// GET USER RANK
app.get("/api/leaderboard/rank/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const result = await pool.query(
      `SELECT position FROM (
        SELECT id, ROW_NUMBER() OVER (ORDER BY level DESC, xp DESC) as position
        FROM users
      ) ranked
      WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ rank: result.rows[0].position });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch rank" });
  }
});

// ============ ADMIN ROUTES ============

// GET ALL USERS (Admin only)
app.get("/api/admin/users", authenticateToken, adminCheck, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, username, email, level, xp, created_at FROM users ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// DELETE USER (Admin only)
app.delete("/api/admin/users/:userId", authenticateToken, adminCheck, async (req, res) => {
  const { userId } = req.params;

  if (parseInt(userId) === req.user.id) {
    return res.status(400).json({ error: "Cannot delete yourself" });
  }

  try {
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    res.json({ message: "User deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// MAKE ADMIN (Admin only)
app.put("/api/admin/users/:userId/make-admin", authenticateToken, adminCheck, async (req, res) => {
  const { userId } = req.params;

  try {
    await pool.query(
      "UPDATE users SET is_admin = TRUE WHERE id = $1",
      [userId]
    );
    res.json({ message: "User is now admin" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to make admin" });
  }
});

// GET STATS (Admin only)
app.get("/api/admin/stats", authenticateToken, adminCheck, async (req, res) => {
  try {
    const totalUsers = await pool.query("SELECT COUNT(*) FROM users");
    const totalTasks = await pool.query("SELECT COUNT(*) FROM tasks");
    const completedTasks = await pool.query("SELECT COUNT(*) FROM tasks WHERE completed = TRUE");

    res.json({
      total_users: totalUsers.rows[0].count,
      total_tasks: totalTasks.rows[0].count,
      completed_tasks: completedTasks.rows[0].count
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ============ SERVER START ============

const PORT = process.env.PORT || 5000;

initDatabase().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✓ Server running on port ${PORT}`);
    console.log(`✓ Database connected`);
    console.log(`✓ API ready at http://localhost:${PORT}`);
  });
});