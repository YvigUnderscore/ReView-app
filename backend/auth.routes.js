const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireAdmin, JWT_SECRET, isDefaultSecret } = require('./middleware');
const { rateLimit } = require('./utils/rateLimiter');
const { isValidPassword, isValidEmail, isValidText } = require('./utils/validation');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for avatar uploads
const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, 'storage');
const AVATAR_PATH = path.join(DATA_PATH, 'avatars');

if (!fs.existsSync(AVATAR_PATH)) {
    fs.mkdirSync(AVATAR_PATH, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, AVATAR_PATH);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = crypto.randomUUID();
        cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error("Error: File upload only supports images!"));
    }
});

// GET /auth/status: Check if setup is required (i.e., no users exist)
router.get('/status', async (req, res) => {
  try {
    const userCount = await prisma.user.count();
    res.json({
      setupRequired: userCount === 0,
      securityIssue: isDefaultSecret ? 'SECURITY ISSUE : Please update JWT_SECRET env variable' : null
    });
  } catch (error) {
    console.error("Auth Status Error:", error);
    res.status(500).json({ error: 'Database error checking status' });
  }
});

// POST /auth/setup: Create the FIRST user (Admin)
router.post('/setup', async (req, res) => {
  try {
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      return res.status(403).json({ error: 'Setup already completed. Please login.' });
    }

    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }

    if (!isValidText(name, 100)) {
        return res.status(400).json({ error: 'Name exceeds 100 characters' });
    }

    if (!isValidPassword(password)) {
        return res.status(400).json({ error: 'Password must be 8-128 characters long and contain at least one letter and one number.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'admin'
      }
    });

    // Auto-login after setup
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name, preferences: user.preferences, teams: [] } });

  } catch (error) {
    console.error("Auth Setup Error:", error);
    res.status(500).json({ error: 'Setup failed' });
  }
});

// Rate limit: 5 attempts per hour per IP (Prevent brute force/spam)
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { error: 'Too many registration attempts, please try again later.' }
});

// POST /auth/register: Register using an invite token
router.post('/register', registerLimiter, async (req, res) => {
  const { token, name, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: 'Token and password are required' });
  }

  if (!isValidText(name, 100)) {
      return res.status(400).json({ error: 'Name exceeds 100 characters' });
  }

  if (!isValidPassword(password)) {
      return res.status(400).json({ error: 'Password must be 8-128 characters long and contain at least one letter and one number.' });
  }

  try {
    const invite = await prisma.invite.findUnique({ where: { token } });
    if (!invite || invite.used || (invite.expiresAt && new Date() > invite.expiresAt)) {
      return res.status(400).json({ error: 'Invalid or expired invite token' });
    }

    // Double check email from invite is still valid (paranoid check)
    if (!isValidEmail(invite.email)) {
        return res.status(400).json({ error: 'Invalid email format in invite' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });
    if (existingUser) {
        return res.status(400).json({ error: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user and mark invite as used in a transaction
    const user = await prisma.$transaction(async (prisma) => {
        const newUser = await prisma.user.create({
            data: {
                email: invite.email,
                password: hashedPassword,
                name: name,
                role: invite.role
            }
        });
        await prisma.invite.update({
            where: { id: invite.id },
            data: { used: true }
        });
        return newUser;
    });

    const jwtToken = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token: jwtToken, user: { id: user.id, email: user.email, role: user.role, name: user.name, preferences: user.preferences, teams: [] } });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /auth/login
// Rate limit: 10 attempts per 15 minutes
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many login attempts, please try again later.' }
});

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        teams: { select: { id: true, name: true, storageUsed: true, storageLimit: true } },
        ownedTeams: { select: { id: true, name: true, storageUsed: true, storageLimit: true } }
      }
    });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Combine teams and ownedTeams, removing duplicates if any (though ownedTeams should be in teams usually? Schema says separate)
    // New schema: teams (member), ownedTeams (owner).
    // Let's return all unique teams.
    const allTeams = [...user.teams, ...user.ownedTeams];
    const uniqueTeams = Array.from(new Map(allTeams.map(t => [t.id, t])).values());

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({
        token,
        user: {
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
            preferences: user.preferences,
            storageUsed: user.storageUsed,
            storageLimit: user.storageLimit,
            teams: uniqueTeams
        }
    });

  } catch (error) {
    console.error("Auth Login Error:", error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /auth/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        teams: { select: { id: true, name: true, storageUsed: true, storageLimit: true } },
        ownedTeams: { select: { id: true, name: true, storageUsed: true, storageLimit: true } }
      }
    });
    if (!user) return res.sendStatus(404);

    const allTeams = [...user.teams, ...user.ownedTeams];
    const uniqueTeams = Array.from(new Map(allTeams.map(t => [t.id, t])).values());

    res.json({
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        avatarPath: user.avatarPath,
        preferences: user.preferences,
        storageUsed: user.storageUsed,
        storageLimit: user.storageLimit,
        teams: uniqueTeams
    });
  } catch (error) {
    console.error("Auth Me Error:", error);
    res.sendStatus(500);
  }
});

// PUT /auth/me: Update current user profile
router.put('/me', authenticateToken, upload.single('avatar'), async (req, res) => {
  const { name, email, password, currentPassword } = req.body;
  const userId = req.user.id;
  const avatarPath = req.file ? req.file.filename : undefined;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const data = {};
    if (name) {
        if (!isValidText(name, 100)) {
            return res.status(400).json({ error: 'Name exceeds 100 characters' });
        }
        data.name = name;
    }
    if (email) {
        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }
        data.email = email;
    }

    if (password) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to set a new password' });
      }

      const validPassword = await bcrypt.compare(currentPassword, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid current password' });
      }

      if (!isValidPassword(password)) {
          return res.status(400).json({ error: 'Password must be 8-128 characters long and contain at least one letter and one number.' });
      }

       data.password = await bcrypt.hash(password, 10);
    }

    if (avatarPath) {
        data.avatarPath = avatarPath;
        // Optionally: delete old avatar if exists
        const oldUser = await prisma.user.findUnique({ where: { id: userId } });
        if (oldUser && oldUser.avatarPath) {
            const oldPath = path.join(AVATAR_PATH, oldUser.avatarPath);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: data,
      select: { id: true, email: true, name: true, role: true, avatarPath: true } // Exclude password
    });

    res.json(updatedUser);
  } catch (error) {
    console.error("Auth Update Error:", error);
    if (error.code === 'P2002') { // Unique constraint violation (email)
         return res.status(400).json({ error: 'Email already in use' });
    }
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// POST /users: Create a new user (Admin only) - Still useful for admin-only non-invite flow if needed
router.post('/users', authenticateToken, requireAdmin, async (req, res) => {
  const { email, password, name } = req.body;
  try {
    if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    if (!isValidText(name, 100)) {
        return res.status(400).json({ error: 'Name exceeds 100 characters' });
    }

    if (!isValidPassword(password)) {
        return res.status(400).json({ error: 'Password must be 8-128 characters long and contain at least one letter and one number.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'user' // Default role
      }
    });

    res.json({ message: 'User created successfully', user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    console.error("Auth User Create Error:", error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

module.exports = router;
