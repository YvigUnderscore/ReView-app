const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('./middleware');

const router = express.Router({ mergeParams: true }); // mergeParams to access :teamId
const prisma = new PrismaClient();

// Helper to check team admin permissions
async function checkTeamAdmin(userId, teamId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user.role === 'admin') return true;

    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (team.ownerId === userId) return true;

    const membership = await prisma.teamMembership.findUnique({
        where: { userId_teamId: { userId, teamId } }
    });
    return membership && membership.role === 'ADMIN';
}

// GET /api/teams/:teamId/discord-channels - List all Discord channels for a team
router.get('/', authenticateToken, async (req, res) => {
    try {
        const teamId = parseInt(req.params.teamId);

        // Check membership
        const membership = await prisma.teamMembership.findUnique({
            where: { userId_teamId: { userId: req.user.id, teamId } }
        });
        const team = await prisma.team.findUnique({ where: { id: teamId } });

        if (!membership && team?.ownerId !== req.user.id) {
            const user = await prisma.user.findUnique({ where: { id: req.user.id } });
            if (user.role !== 'admin') {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        const channels = await prisma.discordChannel.findMany({
            where: { teamId },
            include: {
                teamRoles: {
                    select: { id: true, name: true, color: true }
                }
            },
            orderBy: { createdAt: 'asc' }
        });

        res.json(channels);
    } catch (error) {
        console.error('Failed to fetch Discord channels:', error);
        res.status(500).json({ error: 'Failed to fetch Discord channels' });
    }
});

// POST /api/teams/:teamId/discord-channels - Create a new Discord channel
router.post('/', authenticateToken, async (req, res) => {
    try {
        const teamId = parseInt(req.params.teamId);
        const { name, webhookUrl, botName, botAvatar, notificationMode, timing, burnAnnotations, teamRoleIds } = req.body;

        // Permission check
        if (!await checkTeamAdmin(req.user.id, teamId)) {
            return res.status(403).json({ error: 'Only team admins can create Discord channels' });
        }

        // Validation
        if (!name || !webhookUrl) {
            return res.status(400).json({ error: 'Name and webhook URL are required' });
        }

        // Create channel
        const channel = await prisma.discordChannel.create({
            data: {
                name,
                webhookUrl,
                teamId,
                botName: botName || null,
                botAvatar: botAvatar || null,
                notificationMode: notificationMode || 'VIDEO',
                timing: timing || null,
                burnAnnotations: burnAnnotations ?? null,
                teamRoles: teamRoleIds && teamRoleIds.length > 0 ? {
                    connect: teamRoleIds.map(id => ({ id }))
                } : undefined
            },
            include: {
                teamRoles: {
                    select: { id: true, name: true, color: true }
                }
            }
        });

        res.status(201).json(channel);
    } catch (error) {
        console.error('Failed to create Discord channel:', error);
        res.status(500).json({ error: 'Failed to create Discord channel' });
    }
});

// PATCH /api/teams/:teamId/discord-channels/:id - Update a Discord channel
router.patch('/:id', authenticateToken, async (req, res) => {
    try {
        const teamId = parseInt(req.params.teamId);
        const channelId = parseInt(req.params.id);
        const { name, webhookUrl, botName, botAvatar, notificationMode, timing, burnAnnotations, teamRoleIds } = req.body;

        // Permission check
        if (!await checkTeamAdmin(req.user.id, teamId)) {
            return res.status(403).json({ error: 'Only team admins can update Discord channels' });
        }

        // Verify channel belongs to team
        const existingChannel = await prisma.discordChannel.findFirst({
            where: { id: channelId, teamId }
        });
        if (!existingChannel) {
            return res.status(404).json({ error: 'Channel not found' });
        }

        // Build update data
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (webhookUrl !== undefined) updateData.webhookUrl = webhookUrl;
        if (botName !== undefined) updateData.botName = botName || null;
        if (botAvatar !== undefined) updateData.botAvatar = botAvatar || null;
        if (notificationMode !== undefined) updateData.notificationMode = notificationMode;
        if (timing !== undefined) updateData.timing = timing || null;
        if (burnAnnotations !== undefined) updateData.burnAnnotations = burnAnnotations;

        // Handle role associations
        if (teamRoleIds !== undefined) {
            updateData.teamRoles = {
                set: teamRoleIds.map(id => ({ id }))
            };
        }

        const channel = await prisma.discordChannel.update({
            where: { id: channelId },
            data: updateData,
            include: {
                teamRoles: {
                    select: { id: true, name: true, color: true }
                }
            }
        });

        res.json(channel);
    } catch (error) {
        console.error('Failed to update Discord channel:', error);
        res.status(500).json({ error: 'Failed to update Discord channel' });
    }
});

// DELETE /api/teams/:teamId/discord-channels/:id - Delete a Discord channel
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const teamId = parseInt(req.params.teamId);
        const channelId = parseInt(req.params.id);

        // Permission check
        if (!await checkTeamAdmin(req.user.id, teamId)) {
            return res.status(403).json({ error: 'Only team admins can delete Discord channels' });
        }

        // Verify channel belongs to team
        const existingChannel = await prisma.discordChannel.findFirst({
            where: { id: channelId, teamId }
        });
        if (!existingChannel) {
            return res.status(404).json({ error: 'Channel not found' });
        }

        await prisma.discordChannel.delete({
            where: { id: channelId }
        });

        res.json({ message: 'Discord channel deleted' });
    } catch (error) {
        console.error('Failed to delete Discord channel:', error);
        res.status(500).json({ error: 'Failed to delete Discord channel' });
    }
});

// POST /api/teams/:teamId/discord-channels/:id/test - Send a test message
router.post('/:id/test', authenticateToken, async (req, res) => {
    try {
        const teamId = parseInt(req.params.teamId);
        const channelId = parseInt(req.params.id);

        // Permission check
        if (!await checkTeamAdmin(req.user.id, teamId)) {
            return res.status(403).json({ error: 'Only team admins can test Discord channels' });
        }

        const channel = await prisma.discordChannel.findFirst({
            where: { id: channelId, teamId },
            include: { team: true }
        });

        if (!channel) {
            return res.status(404).json({ error: 'Channel not found' });
        }

        // Send test message using axios
        const axios = require('axios');
        const payload = {
            content: '🔔 Test notification from ReView!',
            username: channel.botName || channel.team.discordBotName || 'ReView Bot',
            avatar_url: channel.botAvatar || channel.team.discordBotAvatar || null,
            embeds: [{
                title: 'Discord Channel Test',
                description: `This is a test message for channel **${channel.name}**.`,
                color: 3447003,
                footer: { text: 'ReView' },
                timestamp: new Date().toISOString()
            }]
        };

        await axios.post(channel.webhookUrl, payload);
        res.json({ message: 'Test message sent successfully' });
    } catch (error) {
        console.error('Failed to send test message:', error);
        res.status(500).json({
            error: 'Failed to send test message',
            details: error.response?.data?.message || error.message
        });
    }
});

module.exports = router;
