const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('./middleware');
const { isValidText } = require('./utils/validation');
const fs = require('fs');
const { createAndBroadcast } = require('./services/notificationService');

const router = express.Router();

function slugify(text) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-');
}
const prisma = new PrismaClient();

// GET /teams: Get all my teams
router.get('/', authenticateToken, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: {
                teamMemberships: {
                    include: {
                        team: {
                            include: {
                                members: {
                                    include: {
                                        user: {
                                            select: {
                                                id: true,
                                                name: true,
                                                email: true,
                                                avatarPath: true,
                                                teamRoles: true,
                                            }
                                        }
                                    }
                                },
                                roles: true,
                                owner: true
                            }
                        }
                    }
                },
                ownedTeams: {
                    include: {
                        members: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        name: true,
                                        email: true,
                                        avatarPath: true,
                                        teamRoles: true,
                                    }
                                }
                            }
                        },
                        roles: true
                    }
                }
            }
        });

        // We need to flatten and unify this structure.
        // Both ownedTeams and teamMemberships point to teams.

        const teamsMap = new Map();

        // Process Owned Teams
        for (const team of user.ownedTeams) {
            teamsMap.set(team.id, {
                ...team,
                members: team.members.map(tm => ({ ...tm.user, role: tm.role, joinedAt: tm.joinedAt })),
                isOwner: true,
                myRole: 'OWNER'
            });
        }

        // Process Memberships
        for (const membership of user.teamMemberships) {
            if (!teamsMap.has(membership.team.id)) {
                const team = membership.team;
                teamsMap.set(team.id, {
                    ...team,
                    members: team.members.map(tm => ({ ...tm.user, role: tm.role, joinedAt: tm.joinedAt })),
                    isOwner: team.ownerId === user.id,
                    myRole: membership.role
                });
            }
        }

        // Now ensure the owner is included in the members list if not already (logic from migration might have added them, but let's be safe)
        // Actually, we want to return the members list as Users with an extra 'role' property.
        // The query above returns `TeamMembership` as `members`.
        // I mapped it: `members: team.members.map(tm => ({ ...tm.user, role: tm.role }))`

        // Wait, the Owner might NOT be in TeamMembership if I didn't migrate them or if new logic doesn't add them.
        // My previous step: `POST /` creates team and connects members: { connect: { id: req.user.id } }`.
        // Since I changed the relation to `TeamMembership`, `members: { connect: ... }` on User will FAIL if I didn't update the create logic.
        // I need to update the create logic below.

        // Also, for the response, we should ensure the owner is in the list.
        const teams = Array.from(teamsMap.values()).map(team => {
            // Check if owner is in members
            const ownerInMembers = team.members.find(m => m.id === team.ownerId);
            let members = team.members;
            if (!ownerInMembers && team.ownerId) {
                // We can't easily get the owner object here unless we included it.
                // I included `owner: true` in the query above.
                if (team.owner) { // owner relation from Team
                    members = [...members, { ...team.owner, role: 'OWNER' }];
                }
            } else if (ownerInMembers) {
                // Force role to OWNER for display if it matches ownerId
                members = members.map(m => m.id === team.ownerId ? { ...m, role: 'OWNER' } : m);
            }
            return { ...team, members };
        });

        res.json(teams);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch teams' });
    }
});

// POST /teams: Create team
router.post('/', authenticateToken, async (req, res) => {
    const { name } = req.body;

    if (!isValidText(name, 100)) {
        return res.status(400).json({ error: 'Team name exceeds 100 characters' });
    }

    try {
        let baseSlug = slugify(name);
        if (!baseSlug) baseSlug = `team-${Date.now()}`;
        let slug = baseSlug;
        let counter = 1;

        // Ensure uniqueness
        while (true) {
            const existing = await prisma.team.findUnique({ where: { slug } });
            if (!existing) break;
            slug = `${baseSlug}-${counter}`;
            counter++;
        }

        // Transaction to create team and assign user
        const team = await prisma.$transaction(async (prisma) => {
            const newTeam = await prisma.team.create({
                data: {
                    name,
                    slug,
                    owner: { connect: { id: req.user.id } },
                    members: {
                        create: {
                            userId: req.user.id,
                            role: 'OWNER'
                        }
                    }
                }
            });
            return newTeam;
        });

        res.json(team);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create team' });
    }
});

// PATCH /teams/:id: Update team (Owner or Admin)
router.patch('/:id', authenticateToken, async (req, res) => {
    const teamId = parseInt(req.params.id);
    const {
        name,
        startFrame,
        discordWebhookUrl,
        discordBotName,
        discordBotAvatar,
        discordTiming,
        discordBurnAnnotations
    } = req.body;

    try {
        const team = await prisma.team.findUnique({ where: { id: teamId } });
        if (!team) return res.status(404).json({ error: 'Team not found' });

        // Check permission: Owner or Admin
        const userMembership = await prisma.teamMembership.findUnique({
            where: { userId_teamId: { userId: req.user.id, teamId } }
        });

        // Determine if user is authorized
        const isOwner = team.ownerId === req.user.id;
        const isAdmin = userMembership && userMembership.role === 'ADMIN';
        const isGlobalAdmin = req.user.role === 'admin';

        if (!isOwner && !isAdmin && !isGlobalAdmin) {
            return res.status(403).json({ error: 'Only owner or admins can update team settings' });
        }

        const data = {};
        if (name !== undefined) {
            if (!isValidText(name, 100)) return res.status(400).json({ error: 'Team name exceeds 100 characters' });
            data.name = name;
        }
        if (startFrame !== undefined) {
            const parsedFrame = parseInt(startFrame);
            if (isNaN(parsedFrame)) return res.status(400).json({ error: 'Invalid start frame' });
            data.startFrame = parsedFrame;
        }

        // Discord Settings
        if (discordWebhookUrl !== undefined) data.discordWebhookUrl = discordWebhookUrl;
        if (discordBotName !== undefined) data.discordBotName = discordBotName;
        if (discordBotAvatar !== undefined) data.discordBotAvatar = discordBotAvatar;
        if (discordTiming !== undefined) {
            const validTimings = ['REALTIME', 'GROUPED', 'HYBRID', 'HOURLY', 'MAJOR'];
            if (!validTimings.includes(discordTiming)) return res.status(400).json({ error: 'Invalid timing mode' });
            data.discordTiming = discordTiming;
        }
        if (discordBurnAnnotations !== undefined) data.discordBurnAnnotations = Boolean(discordBurnAnnotations);

        // Digest Video Settings
        const { digestFps, digestTransition, digestPause } = req.body;
        if (digestFps !== undefined) {
            data.digestFps = digestFps === null ? null : parseInt(digestFps);
        }
        if (digestTransition !== undefined) {
            data.digestTransition = digestTransition === null ? null : parseFloat(digestTransition);
        }
        if (digestPause !== undefined) {
            data.digestPause = digestPause === null ? null : parseFloat(digestPause);
        }
        if (req.body.digestVideoEnabled !== undefined) {
            data.digestVideoEnabled = Boolean(req.body.digestVideoEnabled);
        }

        const updatedTeam = await prisma.team.update({
            where: { id: teamId },
            data
        });

        res.json(updatedTeam);
    } catch (error) {
        console.error("Update team error:", error);
        res.status(500).json({ error: 'Failed to update team' });
    }
});

// DELETE /teams/:id: Delete team (Owner only)
router.delete('/:id', authenticateToken, async (req, res) => {
    const teamId = parseInt(req.params.id);

    try {
        const team = await prisma.team.findUnique({ where: { id: teamId } });
        if (!team) return res.status(404).json({ error: 'Team not found' });

        // Check permission: Owner ONLY (Admin cannot delete team)
        // Global admin can also delete team
        if (team.ownerId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only the team owner or a global admin can delete the team' });
        }

        // Collect files to delete
        let filesToDelete = [];

        // Transaction to delete everything related to the team
        await prisma.$transaction(async (tx) => {
            // 1. Get all projects
            const projects = await tx.project.findMany({ where: { teamId } });

            for (const project of projects) {
                // 2. Collect video files for each project
                const videos = await tx.video.findMany({ where: { projectId: project.id } });
                for (const video of videos) {
                    if (video.path) {
                        filesToDelete.push(video.path);
                    }
                }
            }

            // 3. Delete Projects (Cascades Videos, Comments)
            await tx.project.deleteMany({ where: { teamId } });

            // 4. Delete TeamRoles
            await tx.teamRole.deleteMany({ where: { teamId } });

            // 5. Delete TeamMemberships (Cascade should handle this but explicit is safer or relied on cascade)
            // tx.teamMembership.deleteMany({ where: { teamId } }) // Handled by Cascade

            // 6. Delete Team
            await tx.team.delete({ where: { id: teamId } });
        });

        // If transaction succeeded, delete files
        for (const filePath of filesToDelete) {
            if (fs.existsSync(filePath)) {
                try {
                    await fs.promises.unlink(filePath);
                } catch (e) {
                    console.error('Error deleting file:', filePath, e);
                }
            }
        }

        res.json({ message: 'Team deleted successfully' });
    } catch (error) {
        console.error("Delete team error:", error);
        res.status(500).json({ error: 'Failed to delete team: ' + error.message });
    }
});

// POST /teams/members: Add member (Owner or Admin)
router.post('/members', authenticateToken, async (req, res) => {
    const { email, teamId, role } = req.body; // role is optional, default MEMBER

    if (!teamId) return res.status(400).json({ error: 'Team ID is required' });

    try {
        const team = await prisma.team.findUnique({ where: { id: parseInt(teamId) } });
        if (!team) return res.status(404).json({ error: 'Team not found' });

        // Check permission: Owner or Admin
        const userMembership = await prisma.teamMembership.findUnique({
            where: { userId_teamId: { userId: req.user.id, teamId: team.id } }
        });

        const isOwner = team.ownerId === req.user.id;
        const isAdmin = userMembership && userMembership.role === 'ADMIN';

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ error: 'Only the team owner or admins can add members' });
        }

        const member = await prisma.user.findUnique({ where: { email } });
        if (!member) {
            return res.status(404).json({ error: 'User not found. They must register first.' });
        }

        // Check if already in this team
        const existingMembership = await prisma.teamMembership.findUnique({
            where: { userId_teamId: { userId: member.id, teamId: team.id } }
        });

        if (existingMembership) {
            return res.status(400).json({ error: 'User is already in this team' });
        }

        await prisma.teamMembership.create({
            data: {
                userId: member.id,
                teamId: team.id,
                role: role || 'MEMBER'
            }
        });

        // Notification: TEAM_ADD
        await createAndBroadcast([member.id], {
            type: 'TEAM_ADD',
            content: `You have been added to the team "${team.name}"`,
            referenceId: team.id
        });

        res.json({ message: 'Member added' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to add member' });
    }
});

// PATCH /teams/:id/members/:userId: Update member role (Owner or Admin)
router.patch('/:id/members/:userId', authenticateToken, async (req, res) => {
    const teamId = parseInt(req.params.id);
    const userId = parseInt(req.params.userId);
    const { role } = req.body;

    if (!['ADMIN', 'MEMBER', 'CLIENT'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
    }

    try {
        const team = await prisma.team.findUnique({ where: { id: teamId } });
        if (!team) return res.status(404).json({ error: 'Team not found' });

        // Check permission
        const userMembership = await prisma.teamMembership.findUnique({
            where: { userId_teamId: { userId: req.user.id, teamId: team.id } }
        });
        const isOwner = team.ownerId === req.user.id;
        const isAdmin = userMembership && userMembership.role === 'ADMIN';

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ error: 'Only the team owner or admins can manage roles' });
        }

        // Cannot change owner's role
        if (userId === team.ownerId) {
            return res.status(400).json({ error: 'Cannot change the owner role' });
        }

        // Admins cannot modify other Admins
        if (isAdmin && !isOwner) {
            const targetMembership = await prisma.teamMembership.findUnique({
                where: { userId_teamId: { userId, teamId } }
            });
            if (targetMembership && targetMembership.role === 'ADMIN') {
                return res.status(403).json({ error: 'Admins cannot modify other admins' });
            }
            // Optional: Admins cannot promote to Admin?
            // Requirement says "modify grade (member or client)". Let's restrict promotion to ADMIN for now to be safe/strict to prompt.
            if (role === 'ADMIN') {
                return res.status(403).json({ error: 'Admins cannot promote users to Admin' });
            }
        }

        await prisma.teamMembership.update({
            where: { userId_teamId: { userId, teamId } },
            data: { role }
        });

        res.json({ message: 'Role updated successfully' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update role' });
    }
});



// DELETE /teams/:id/members/:userId: Remove member (Owner or Admin)
router.delete('/:id/members/:userId', authenticateToken, async (req, res) => {
    const teamId = parseInt(req.params.id);
    const targetUserId = parseInt(req.params.userId);

    try {
        const team = await prisma.team.findUnique({ where: { id: teamId } });
        if (!team) return res.status(404).json({ error: 'Team not found' });

        // Check permission
        const userMembership = await prisma.teamMembership.findUnique({
            where: { userId_teamId: { userId: req.user.id, teamId: team.id } }
        });
        const isOwner = team.ownerId === req.user.id;
        const isAdmin = userMembership && userMembership.role === 'ADMIN';

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ error: 'Only the team owner or admins can remove members' });
        }

        // Cannot remove self (owner)
        if (targetUserId === team.ownerId) {
            return res.status(400).json({ error: 'Cannot remove the owner from the team' });
        }

        // Admin cannot remove other Admins? (Optional rule, but safe to implement)
        if (isAdmin && !isOwner) {
            const targetMembership = await prisma.teamMembership.findUnique({
                where: { userId_teamId: { userId: targetUserId, teamId: team.id } }
            });
            if (targetMembership && targetMembership.role === 'ADMIN') {
                return res.status(403).json({ error: 'Admins cannot remove other admins' });
            }
        }

        await prisma.teamMembership.delete({
            where: { userId_teamId: { userId: targetUserId, teamId: teamId } }
        });

        res.json({ message: 'Member removed successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to remove member' });
    }
});

// POST /teams/:id/transfer: Transfer ownership
router.post('/:id/transfer', authenticateToken, async (req, res) => {
    const teamId = parseInt(req.params.id);
    const { newOwnerId } = req.body;

    if (!newOwnerId) return res.status(400).json({ error: 'New owner ID is required' });

    try {
        const team = await prisma.team.findUnique({ where: { id: teamId } });
        if (!team) return res.status(404).json({ error: 'Team not found' });

        if (team.ownerId !== req.user.id) {
            return res.status(403).json({ error: 'Only the owner can transfer the team' });
        }

        // Check if new owner is a member
        const membership = await prisma.teamMembership.findUnique({
            where: { userId_teamId: { userId: parseInt(newOwnerId), teamId } }
        });

        if (!membership) {
            return res.status(400).json({ error: 'New owner must be a member of the team' });
        }

        // Transaction: Update Owner ID and ensure roles
        await prisma.$transaction(async (tx) => {
            await tx.team.update({
                where: { id: teamId },
                data: { ownerId: parseInt(newOwnerId) }
            });
            // Update roles: Old owner becomes Admin? New owner becomes Owner?
            // Since we use 'role' field, let's update them.
            await tx.teamMembership.update({
                where: { userId_teamId: { userId: req.user.id, teamId } },
                data: { role: 'ADMIN' } // Downgrade to Admin
            });
            await tx.teamMembership.update({
                where: { userId_teamId: { userId: parseInt(newOwnerId), teamId } },
                data: { role: 'OWNER' } // Upgrade to Owner
            });
        });

        // Notify new owner
        await createAndBroadcast([parseInt(newOwnerId)], {
            type: 'SYSTEM',
            content: `You are now the owner of team "${team.name}"`,
            referenceId: team.id
        });

        res.json({ message: 'Ownership transferred successfully' });

    } catch (error) {
        console.error("Transfer error:", error);
        res.status(500).json({ error: 'Failed to transfer ownership' });
    }
});

// POST /teams/:id/force-digest: Force send digest (Owner or Admin)
router.post('/:id/force-digest', authenticateToken, async (req, res) => {
    const teamId = parseInt(req.params.id);

    try {
        const team = await prisma.team.findUnique({ where: { id: teamId } });
        if (!team) return res.status(404).json({ error: 'Team not found' });

        // Check permission: Owner or Admin
        const userMembership = await prisma.teamMembership.findUnique({
            where: { userId_teamId: { userId: req.user.id, teamId } }
        });
        const isOwner = team.ownerId === req.user.id;
        const isAdmin = userMembership && userMembership.role === 'ADMIN';
        const isGlobalAdmin = req.user.role === 'admin';

        if (!isOwner && !isAdmin && !isGlobalAdmin) {
            return res.status(403).json({ error: 'Only owner or admins can force digest' });
        }

        // Trigger Email Queue Processing (Force)
        // We need to import this. It's safe to require inside handler to avoid circular deps if any
        const { processEmailQueue } = require('./services/emailBatchService');
        await processEmailQueue(true); // true = force (ignore debounce)

        // Trigger Discord Processing (Force)
        // We'll need to update discordService to export a queue processor or similar
        // For now, if discord logic is "instant" mostly, we might just need to check if there's a stored buffer
        // But the current discordService uses `processInstantNotification` immediately.
        // If we implement 'GROUPED' timing, we need a processor.

        // Let's assume we'll implement `processDiscordQueue(true)` in discordService
        const { processDiscordQueue } = require('./services/discordService');
        if (processDiscordQueue) {
            await processDiscordQueue(true);
        }

        res.json({ message: 'Digest processing triggered successfully' });

    } catch (error) {
        console.error("Force digest error:", error);
        res.status(500).json({ error: 'Failed to trigger digest' });
    }
});

module.exports = router;
