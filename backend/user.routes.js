const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('./middleware');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/users/me/preferences
router.get('/me/preferences', authenticateToken, async (req, res) => {
    try {
        const prefs = await prisma.notificationPreference.findMany({
            where: { userId: req.user.id }
        });
        res.json(prefs);
    } catch (error) {
        console.error("Get Prefs Error:", error);
        res.status(500).json({ error: 'Failed to fetch preferences' });
    }
});

// PATCH /api/users/me/preferences
router.patch('/me/preferences', authenticateToken, async (req, res) => {
    const { type, channel, enabled } = req.body;
    // Body expected: { type: 'MENTION', channel: 'email', enabled: false }
    // OR multiple updates
    if (!type || !channel) return res.status(400).json({ error: 'Type and channel required' });

    try {
        // channel is 'email' or 'inApp'
        const data = {};
        if (channel === 'email') data.email = enabled;
        if (channel === 'inApp') data.inApp = enabled;

        const pref = await prisma.notificationPreference.upsert({
            where: {
                userId_type: {
                    userId: req.user.id,
                    type: type
                }
            },
            update: data,
            create: {
                userId: req.user.id,
                type: type,
                ...data
            }
        });
        res.json(pref);
    } catch (error) {
        console.error("Update Prefs Error:", error);
        res.status(500).json({ error: 'Failed to update preferences' });
    }
});

// DELETE /api/users/me (Delete Account)
router.delete('/me', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        // 1. Check owned teams
        const ownedTeams = await prisma.team.findMany({
            where: { ownerId: userId },
            include: { members: true }
        });

        if (ownedTeams.length > 0) {
            return res.status(400).json({
                error: 'CANNOT_DELETE_OWNER',
                message: 'You own teams. Please transfer ownership or delete them first.',
                teams: ownedTeams.map(t => t.name)
            });
        }

        // 2. Delete user (Cascade should handle relations mostly, but files need manual cleanup if strictly followed, though typically avatar is unique)
        // User has avatarPath
        const user = await prisma.user.findUnique({ where: { id: userId } });

        await prisma.user.delete({ where: { id: userId } });

        // Cleanup avatar
        if (user.avatarPath) {
            const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, 'storage');
            const avatarPath = path.join(DATA_PATH, 'avatars', user.avatarPath);
            if (fs.existsSync(avatarPath)) {
                fs.unlinkSync(avatarPath);
            }
        }

        res.json({ message: 'Account deleted successfully' });

    } catch (error) {
        console.error("Delete Account Error:", error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

module.exports = router;
