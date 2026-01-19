const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('./middleware');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/users/search: Search for users by name or email
router.get('/search', authenticateToken, async (req, res) => {
    const { q } = req.query;
    if (!q || q.length < 2) {
        return res.json([]);
    }

    try {
        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { name: { contains: q } },
                    { email: { contains: q } }
                ]
            },
            take: 10,
            select: {
                id: true,
                name: true,
                email: true,
                avatarPath: true
            }
        });
        res.json(users);
    } catch (error) {
        console.error("User search error:", error);
        res.status(500).json({ error: 'Failed to search users' });
    }
});

// GET /api/users/me/preferences (Notification Preferences)
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

// POST /api/users/me/preferences/unsubscribe-all
router.post('/me/preferences/unsubscribe-all', authenticateToken, async (req, res) => {
    const notificationTypes = ['MENTION', 'REPLY', 'PROJECT_CREATE', 'VIDEO_VERSION', 'STATUS_CHANGE', 'TEAM_ADD'];
    try {
        const operations = notificationTypes.map(type =>
            prisma.notificationPreference.upsert({
                where: { userId_type: { userId: req.user.id, type } },
                update: { email: false },
                create: { userId: req.user.id, type, email: false, inApp: true }
            })
        );
        await prisma.$transaction(operations);
        res.json({ message: 'Unsubscribed from all emails' });
    } catch (error) {
        console.error("Unsubscribe All Error:", error);
        res.status(500).json({ error: 'Failed to unsubscribe' });
    }
});

// PATCH /api/users/me/preferences (Notification Preferences)
router.patch('/me/preferences', authenticateToken, async (req, res) => {
    const { type, channel, enabled } = req.body;
    // Body expected: { type: 'MENTION', channel: 'email', enabled: false }
    // OR multiple updates
    if (!type || !channel) return res.status(400).json({ error: 'Type and channel required' });

    try {
        // channel is 'email', 'inApp', or 'discord'
        const data = {};
        if (channel === 'email') data.email = enabled;
        if (channel === 'inApp') data.inApp = enabled;
        if (channel === 'discord') data.discord = enabled;

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

// PATCH /api/users/me/client-preferences (General User Preferences JSON)
router.patch('/me/client-preferences', authenticateToken, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { preferences: true }
        });

        if (!user) return res.sendStatus(404);

        let currentPrefs = {};
        try {
            currentPrefs = user.preferences ? JSON.parse(user.preferences) : {};
        } catch (e) { }

        const newPrefs = { ...currentPrefs, ...req.body };

        const updated = await prisma.user.update({
            where: { id: req.user.id },
            data: { preferences: JSON.stringify(newPrefs) },
            select: { preferences: true }
        });

        res.json(JSON.parse(updated.preferences));
    } catch (error) {
        console.error("Update Client Prefs Error:", error);
        res.status(500).json({ error: 'Failed to update client preferences' });
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
