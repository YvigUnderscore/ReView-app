const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireAdmin } = require('./middleware');
const { sendEmail } = require('./services/emailService');
const { isValidEmail, isValidText, isValidPassword } = require('./utils/validation');

const router = express.Router();
const prisma = new PrismaClient();

// Send Test Email
router.post('/mail/test', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { email } = req.body;

        if (email && !isValidEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        const targetEmail = email || req.user.email;

        const success = await sendEmail(
            targetEmail,
            'ReView - Test Email',
            'This is a test email from your ReView instance. If you are reading this, your SMTP configuration is correct.'
        );

        if (success) {
            res.json({ message: 'Test email sent successfully' });
        } else {
            res.status(500).json({ error: 'Failed to send test email. Check server logs.' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Send Broadcast/Announcement
router.post('/mail/broadcast', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { subject, message } = req.body;

        if (!subject || !message) {
            return res.status(400).json({ error: 'Subject and message are required' });
        }

        const users = await prisma.user.findMany({
            select: { email: true }
        });

        let sentCount = 0;
        let failCount = 0;

        // Batch processing to avoid rate limits
        const BATCH_SIZE = 20;
        for (let i = 0; i < users.length; i += BATCH_SIZE) {
            const batch = users.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map(async (user) => {
                if (user.email) {
                    const result = await sendEmail(user.email, subject, message);
                    if (result) sentCount++;
                    else failCount++;
                }
            });
            await Promise.all(batchPromises);

            // Small delay between batches if not the last batch
            if (i + BATCH_SIZE < users.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        res.json({
            message: 'Broadcast complete',
            stats: { sent: sentCount, failed: failCount, total: users.length }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (id === req.user.id) {
       return res.status(400).json({ error: 'Cannot delete yourself' });
    }
    await prisma.user.delete({ where: { id } });
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// PATCH /api/admin/users/:id
router.patch('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { name, email, role, password } = req.body;

        const data = {};
        if (name) {
            if (!isValidText(name, 100)) return res.status(400).json({ error: 'Invalid name' });
            data.name = name;
        }
        if (email) {
            if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email' });
            data.email = email;
        }
        if (role) {
            if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
            // Prevent stripping own admin status if you are the only admin (optional safety, but good to have)
            if (id === req.user.id && role !== 'admin') {
                return res.status(400).json({ error: 'Cannot remove your own admin status' });
            }
            data.role = role;
        }
        if (password) {
            if (!isValidPassword(password)) return res.status(400).json({ error: 'Invalid password format' });
            data.password = await bcrypt.hash(password, 10);
        }

        const user = await prisma.user.update({
            where: { id },
            data,
            select: { id: true, name: true, email: true, role: true }
        });

        res.json(user);
    } catch (error) {
        console.error(error);
        if (error.code === 'P2002') return res.status(400).json({ error: 'Email already in use' });
        res.status(500).json({ error: 'Failed to update user' });
    }
});

module.exports = router;
