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
      select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          storageUsed: true,
          storageLimit: true,
          teams: { select: { id: true, name: true } },
          ownedTeams: { select: { id: true, name: true } }
      }
    });
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/admin/teams - List all teams with storage info
router.get('/teams', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const teams = await prisma.team.findMany({
            include: {
                owner: { select: { id: true, name: true, email: true } },
                _count: { select: { members: true } }
            }
        });
        res.json(teams);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch teams' });
    }
});

// PATCH /api/admin/teams/:id - Update team (specifically storageLimit)
router.patch('/teams/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { storageLimit } = req.body;

        const data = {};
        // Allow setting limit to null (to use system default) or a number
        if (storageLimit !== undefined) {
             data.storageLimit = storageLimit === null ? null : BigInt(storageLimit);
        }

        const team = await prisma.team.update({
            where: { id },
            data,
            include: {
                owner: { select: { id: true, name: true } },
                _count: { select: { members: true } }
            }
        });
        res.json(team);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update team' });
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
        const { name, email, role, password, storageLimit } = req.body;

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
        if (storageLimit !== undefined) {
             data.storageLimit = storageLimit === null ? null : BigInt(storageLimit);
        }

        const user = await prisma.user.update({
            where: { id },
            data,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                storageUsed: true,
                storageLimit: true,
                teams: { select: { id: true, name: true } },
                ownedTeams: { select: { id: true, name: true } }
            }
        });

        res.json(user);
    } catch (error) {
        console.error(error);
        if (error.code === 'P2002') return res.status(400).json({ error: 'Email already in use' });
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// POST /api/admin/storage/recalculate - Manually recalculate storage usage for all users and teams
router.post('/storage/recalculate', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Reset all storage counters
        await prisma.user.updateMany({ data: { storageUsed: 0 } });
        await prisma.team.updateMany({ data: { storageUsed: 0 } });

        const userStorage = {};
        const teamStorage = {};

        const addToUser = (userId, size) => {
            if (!userId) return;
            userStorage[userId] = (userStorage[userId] || 0n) + BigInt(size);
        };

        const addToTeam = (teamId, size) => {
            if (!teamId) return;
            teamStorage[teamId] = (teamStorage[teamId] || 0n) + BigInt(size);
        };

        // 1. Videos
        const videos = await prisma.video.findMany({
            select: { size: true, uploaderId: true, project: { select: { teamId: true } } }
        });
        videos.forEach(v => {
            addToUser(v.uploaderId, v.size);
            if (v.project && v.project.teamId) addToTeam(v.project.teamId, v.size);
        });

        // 2. ThreeDAssets
        const threeDAssets = await prisma.threeDAsset.findMany({
             select: { size: true, uploaderId: true, project: { select: { teamId: true } } }
        });
        threeDAssets.forEach(a => {
            addToUser(a.uploaderId, a.size);
            if (a.project && a.project.teamId) addToTeam(a.project.teamId, a.size);
        });

        // 3. Images
        const images = await prisma.image.findMany({
            select: {
                size: true,
                bundle: {
                    select: {
                        uploaderId: true,
                        project: { select: { teamId: true } }
                    }
                }
            }
        });
        images.forEach(img => {
            if (img.bundle) {
                addToUser(img.bundle.uploaderId, img.size);
                if (img.bundle.project && img.bundle.project.teamId) {
                    addToTeam(img.bundle.project.teamId, img.size);
                }
            }
        });

        // 4. Comments (Attachments + Screenshots)
        const comments = await prisma.comment.findMany({
            select: {
                size: true,
                userId: true, // Comment author
                video: { select: { project: { select: { teamId: true } } } },
                image: { select: { bundle: { select: { project: { select: { teamId: true } } } } } },
                threeDAsset: { select: { project: { select: { teamId: true } } } }
            }
        });
        comments.forEach(c => {
            addToUser(c.userId, c.size);

            let teamId = null;
            if (c.video?.project?.teamId) teamId = c.video.project.teamId;
            else if (c.image?.bundle?.project?.teamId) teamId = c.image.bundle.project.teamId;
            else if (c.threeDAsset?.project?.teamId) teamId = c.threeDAsset.project.teamId;

            if (teamId) addToTeam(teamId, c.size);
        });

        // Update Users
        for (const [userId, size] of Object.entries(userStorage)) {
            await prisma.user.update({
                where: { id: parseInt(userId) },
                data: { storageUsed: size }
            });
        }

        // Update Teams
        for (const [teamId, size] of Object.entries(teamStorage)) {
             await prisma.team.update({
                where: { id: parseInt(teamId) },
                data: { storageUsed: size }
            });
        }

        res.json({ message: 'Storage recalculation completed' });
    } catch (error) {
        console.error('Recalculate error:', error);
        res.status(500).json({ error: 'Failed to recalculate storage' });
    }
});

module.exports = router;
