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
        teamMemberships: {
          include: {
            team: {
              select: { id: true, name: true, storageUsed: true, storageLimit: true }
            }
          }
        },
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
    let uniqueTeams = [];

    if (user.role === 'admin') {
      uniqueTeams = await prisma.team.findMany();
    } else {
      const memberTeams = user.teamMemberships ? user.teamMemberships.map(tm => tm.team) : [];
      const allTeams = [...memberTeams, ...user.ownedTeams];
      uniqueTeams = Array.from(new Map(allTeams.map(t => [t.id, t])).values());
    }

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
        teamMemberships: {
          include: {
            team: {
              select: { id: true, name: true, storageUsed: true, storageLimit: true }
            }
          }
        },
        ownedTeams: { select: { id: true, name: true, storageUsed: true, storageLimit: true } }
      }
    });
    if (!user) return res.sendStatus(404);

    let uniqueTeams = [];

    if (user.role === 'admin') {
      uniqueTeams = await prisma.team.findMany();
    } else {
      const memberTeams = user.teamMemberships ? user.teamMemberships.map(tm => tm.team) : [];
      const allTeams = [...memberTeams, ...user.ownedTeams];
      uniqueTeams = Array.from(new Map(allTeams.map(t => [t.id, t])).values());
    }

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

// Lazy import for email service (avoid circular dependency)
let sendEmail;
const getEmailService = () => {
  if (!sendEmail) {
    sendEmail = require('./services/emailService').sendEmail;
  }
  return sendEmail;
};

// Rate limit: 3 attempts per hour per IP (Prevent abuse)
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Too many password reset requests, please try again later.' }
});

// POST /auth/forgot-password
router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  const { email } = req.body;

  // Always respond with success to prevent email enumeration
  const genericResponse = { message: 'If an account with that email exists, a password reset link has been sent.' };

  if (!email || !isValidEmail(email)) {
    return res.json(genericResponse);
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal if user exists
      return res.json(genericResponse);
    }

    // Generate secure token (64 bytes = 128 hex chars)
    const resetToken = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate previous unused tokens for this user
    await prisma.passwordReset.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true }
    });

    // Create new token
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        token: resetToken,
        expiresAt
      }
    });

    // Get site URL from system settings or fallback
    let siteUrl = process.env.SITE_URL || 'http://localhost:3429';
    try {
      const urlSetting = await prisma.systemSetting.findUnique({ where: { key: 'site_url' } });
      if (urlSetting && urlSetting.value) siteUrl = urlSetting.value;
    } catch (e) { }

    const resetUrl = `${siteUrl}/reset-password?token=${resetToken}`;

    // Send email
    const emailService = getEmailService();
    await emailService(
      email,
      'Reset Your Password - ReView',
      `You requested a password reset. Click this link to reset your password: ${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, please ignore this email.`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">Reset Your Password</h2>
          <p>You requested a password reset for your ReView account.</p>
          <p style="margin: 30px 0;">
            <a href="${resetUrl}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              Reset Password
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">This link expires in 1 hour.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
        </div>
      `
    );

    res.json(genericResponse);

  } catch (error) {
    console.error("Forgot Password Error:", error);
    // Still return generic response to prevent info leak
    res.json(genericResponse);
  }
});

// Rate limit: 5 attempts per 15 minutes
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many password reset attempts, please try again later.' }
});

// POST /auth/reset-password
router.post('/reset-password', resetPasswordLimiter, async (req, res) => {
  const { token, password } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Reset token is required' });
  }

  if (!password || !isValidPassword(password)) {
    return res.status(400).json({ error: 'Password must be 8-128 characters long and contain at least one letter and one number.' });
  }

  try {
    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!resetRecord) {
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    if (resetRecord.used) {
      return res.status(400).json({ error: 'This reset link has already been used' });
    }

    if (new Date() > resetRecord.expiresAt) {
      return res.status(400).json({ error: 'This reset link has expired. Please request a new one.' });
    }

    // Update password and mark token as used
    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetRecord.userId },
        data: { password: hashedPassword }
      }),
      prisma.passwordReset.update({
        where: { id: resetRecord.id },
        data: { used: true }
      })
    ]);

    res.json({ message: 'Password reset successfully. You can now login with your new password.' });

  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;
