const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('./middleware');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/notifications - List unread notifications
router.get('/', authenticateToken, async (req, res) => {
    try {
        const notifications = await prisma.notification.findMany({
            where: {
                userId: req.user.id,
            },
            include: {
                project: {
                    select: { id: true, name: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 100
        });
        res.json(notifications);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// PATCH /api/notifications/read-all - Mark all as read
router.patch('/read-all', authenticateToken, async (req, res) => {
    try {
        await prisma.notification.updateMany({
            where: {
                userId: req.user.id,
                isRead: false
            },
            data: { isRead: true }
        });
        res.json({ message: 'All notifications marked as read' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to mark all as read' });
    }
});

// PATCH /api/notifications/:id/read - Mark as read
router.patch('/:id/read', authenticateToken, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const notification = await prisma.notification.findUnique({ where: { id } });

        if (!notification) return res.status(404).json({ error: 'Notification not found' });
        if (notification.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

        const updated = await prisma.notification.update({
            where: { id },
            data: { isRead: true }
        });
        res.json(updated);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update notification' });
    }
});

// DELETE /api/notifications - Delete all notifications
router.delete('/', authenticateToken, async (req, res) => {
    try {
        await prisma.notification.deleteMany({
            where: { userId: req.user.id }
        });
        res.json({ message: 'All notifications deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete notifications' });
    }
});

// DELETE /api/notifications/:id - Delete single notification
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const notification = await prisma.notification.findUnique({ where: { id } });

        if (!notification) return res.status(404).json({ error: 'Notification not found' });
        if (notification.userId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

        await prisma.notification.delete({ where: { id } });
        res.json({ message: 'Notification deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
});

module.exports = router;
