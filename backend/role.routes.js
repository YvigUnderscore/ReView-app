const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('./middleware');

const router = express.Router({ mergeParams: true }); // mergeParams to access :teamId
const prisma = new PrismaClient();

// GET /api/teams/:teamId/roles - List all roles for a team
router.get('/', authenticateToken, async (req, res) => {
    try {
        const teamId = parseInt(req.params.teamId);
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: {
                teamMemberships: { include: { team: true } },
                ownedTeams: true
            }
        });

        const isMember = user.teamMemberships.some(tm => tm.team.id === teamId);
        const isOwner = user.ownedTeams.some(t => t.id === teamId);

        if (!isMember && !isOwner && user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const roles = await prisma.teamRole.findMany({
            where: { teamId }
        });
        res.json(roles);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch roles' });
    }
});

// POST /api/teams/:teamId/roles - Create a new role
router.post('/', authenticateToken, async (req, res) => {
    try {
        const teamId = parseInt(req.params.teamId);
        const { name, color } = req.body;

        // Validation
        if (!name) return res.status(400).json({ error: 'Role name is required' });

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        const team = await prisma.team.findUnique({ where: { id: teamId } });

        // Check Team Admin
        const membership = await prisma.teamMembership.findUnique({
            where: { userId_teamId: { userId: req.user.id, teamId } }
        });
        const isTeamAdmin = membership && membership.role === 'ADMIN';

        if (user.role !== 'admin' && team.ownerId !== user.id && !isTeamAdmin) {
            return res.status(403).json({ error: 'Only team owner or admins can manage roles' });
        }

        const role = await prisma.teamRole.create({
            data: {
                name,
                color: color || '#3b82f6',
                teamId
            }
        });
        res.json(role);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create role' });
    }
});

// DELETE /api/teams/:teamId/roles/:roleId - Delete a role
router.delete('/:roleId', authenticateToken, async (req, res) => {
    try {
        const teamId = parseInt(req.params.teamId);
        const roleId = parseInt(req.params.roleId);

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        const team = await prisma.team.findUnique({ where: { id: teamId } });

        // Check Team Admin
        const membership = await prisma.teamMembership.findUnique({
            where: { userId_teamId: { userId: req.user.id, teamId } }
        });
        const isTeamAdmin = membership && membership.role === 'ADMIN';

        if (user.role !== 'admin' && team.ownerId !== user.id && !isTeamAdmin) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await prisma.teamRole.delete({
            where: { id: roleId }
        });
        res.json({ message: 'Role deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete role' });
    }
});

// POST /api/teams/:teamId/roles/:roleId/assign - Assign role to user
router.post('/:roleId/assign', authenticateToken, async (req, res) => {
    try {
        const teamId = parseInt(req.params.teamId);
        const roleId = parseInt(req.params.roleId);
        const { userId } = req.body;

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        const team = await prisma.team.findUnique({ where: { id: teamId } });

        // Check Team Admin
        const membership = await prisma.teamMembership.findUnique({
            where: { userId_teamId: { userId: req.user.id, teamId } }
        });
        const isTeamAdmin = membership && membership.role === 'ADMIN';

        if (user.role !== 'admin' && team.ownerId !== user.id && !isTeamAdmin) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Verify user belongs to team
        const targetUser = await prisma.user.findUnique({
            where: { id: userId },
            include: { teamMemberships: { include: { team: true } }, ownedTeams: true }
        });

        if (!targetUser) return res.status(404).json({ error: 'User not found' });

        const isMember = targetUser.teamMemberships.some(tm => tm.team.id === teamId) || targetUser.ownedTeams.some(t => t.id === teamId);

        if (!isMember) {
            return res.status(400).json({ error: 'User is not in this team' });
        }

        await prisma.user.update({
            where: { id: userId },
            data: {
                teamRoles: {
                    connect: { id: roleId }
                }
            }
        });
        res.json({ message: 'Role assigned' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to assign role' });
    }
});

// DELETE /api/teams/:teamId/roles/:roleId/remove - Remove role from user
router.delete('/:roleId/remove', authenticateToken, async (req, res) => {
    try {
        const teamId = parseInt(req.params.teamId);
        const roleId = parseInt(req.params.roleId);
        const { userId } = req.body;

        if (!userId) return res.status(400).json({ error: 'User ID required' });

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        const team = await prisma.team.findUnique({ where: { id: teamId } });

        // Check Team Admin
        const membership = await prisma.teamMembership.findUnique({
            where: { userId_teamId: { userId: req.user.id, teamId } }
        });
        const isTeamAdmin = membership && membership.role === 'ADMIN';

        if (user.role !== 'admin' && team.ownerId !== user.id && !isTeamAdmin) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await prisma.user.update({
            where: { id: userId },
            data: {
                teamRoles: {
                    disconnect: { id: roleId }
                }
            }
        });
        res.json({ message: 'Role removed' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to remove role' });
    }
});

module.exports = router;
