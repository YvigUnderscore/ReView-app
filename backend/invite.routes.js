const express = require('express');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireAdmin } = require('./middleware');
const { rateLimit } = require('./utils/rateLimiter');
const { isValidEmail } = require('./utils/validation');

const router = express.Router();
const prisma = new PrismaClient();

// Rate limit: 20 invites per minute per IP (Admin protection)
const inviteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many invites created, please try again later.' }
});

// POST /invites: Create new invite
// Authenticated users can invite if they are Admin OR own a Team.
router.post('/', authenticateToken, inviteLimiter, async (req, res) => {
  const { email, role } = req.body;

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    // Permission Check
    if (req.user.role !== 'admin') {
      // Check if user owns at least one team
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { ownedTeams: { select: { id: true } } }
      });

      if (!user || user.ownedTeams.length === 0) {
        return res.status(403).json({ error: 'Only admins or team owners can create invites.' });
      }

      // Force role to 'user' if not admin
      if (role && role !== 'user') {
        return res.status(403).json({ error: 'Only admins can invite users with special roles.' });
      }
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invite = await prisma.invite.create({
      data: {
        token,
        email,
        role: role || 'user',
        expiresAt
      }
    });

    res.json(invite);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create invite' });
  }
});

// Rate limit: 60 validation attempts per minute (Anti-enumeration)
const validateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many validation attempts.' }
});

// Rate limit: 5 bulk invite requests per hour (prevent mass spam)
const bulkInviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many bulk invite attempts, please try again later.' }
});

// POST /invites/bulk: Create multiple invites from a list of emails (Admin only)
router.post('/bulk', authenticateToken, bulkInviteLimiter, async (req, res) => {
  // Admin only for bulk invites
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can generate bulk invites.' });
  }

  const { emails } = req.body;

  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ error: 'Please provide an array of emails.' });
  }

  // Limit to 100 emails per request
  if (emails.length > 100) {
    return res.status(400).json({ error: 'Maximum 100 emails per bulk invite.' });
  }

  try {
    const results = [];
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    for (const email of emails) {
      const trimmedEmail = email.trim();
      if (!trimmedEmail) continue;

      if (!isValidEmail(trimmedEmail)) {
        // Skip invalid emails to prevent XSS and garbage data
        console.warn(`[Bulk Invite] Skipped invalid email: ${trimmedEmail}`);
        continue;
      }

      const token = crypto.randomBytes(32).toString('hex');

      await prisma.invite.create({
        data: {
          token,
          email: trimmedEmail,
          role: 'user',
          expiresAt
        }
      });

      results.push({ email: trimmedEmail, token });
    }

    res.json({ invites: results, count: results.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create bulk invites' });
  }
});

// GET /invites/:token: Validate invite
router.get('/:token', validateLimiter, async (req, res) => {
  const { token } = req.params;

  try {
    const invite = await prisma.invite.findUnique({ where: { token } });

    if (!invite) {
      return res.status(404).json({ error: 'Invalid invite' });
    }

    if (invite.used) {
      return res.status(400).json({ error: 'Invite already used' });
    }

    if (invite.expiresAt && new Date() > invite.expiresAt) {
      return res.status(400).json({ error: 'Invite expired' });
    }

    res.json({ email: invite.email, role: invite.role });
  } catch (error) {
    res.status(500).json({ error: 'Failed to validate invite' });
  }
});

module.exports = router;
