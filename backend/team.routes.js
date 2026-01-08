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
        teams: {
          include: {
            members: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                avatarPath: true,
                teamRoles: true
              }
            },
            roles: true
          }
        },
        ownedTeams: {
          include: {
             members: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                avatarPath: true,
                teamRoles: true
              }
            },
            roles: true
          }
        }
      }
    });

    // Combine and deduplicate
    const allTeams = [...user.teams, ...user.ownedTeams];
    const uniqueTeams = Array.from(new Map(allTeams.map(t => [t.id, t])).values());

    // Format response to include isOwner flag per team
    const formattedTeams = uniqueTeams.map(team => ({
        ...team,
        isOwner: team.ownerId === user.id
    }));

    res.json(formattedTeams);
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
          members: { connect: { id: req.user.id } } // Owner is also a member
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

// DELETE /teams/:id: Delete team (Owner or Admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  const teamId = parseInt(req.params.id);

  try {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    // Check permission: Owner or Admin
    if (team.ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the team owner or an admin can delete the team' });
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

        // 5. Delete Team (Relations to User via TeamMembers implicit table should be handled by Prisma)
        await tx.team.delete({ where: { id: teamId } });
    });

    // If transaction succeeded, delete files
    for (const filePath of filesToDelete) {
         if (fs.existsSync(filePath)) {
             try {
                 await fs.promises.unlink(filePath);
             } catch(e) {
                 console.error('Error deleting file:', filePath, e);
             }
         }
    }

    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    console.error("Delete team error:", error);
    // Check for Prisma error codes if needed, but for now generic message with log
    if (error.code === 'P2003') {
         return res.status(400).json({ error: 'Cannot delete team due to existing dependencies that could not be cleared.' });
    }
    res.status(500).json({ error: 'Failed to delete team: ' + error.message });
  }
});

// POST /teams/members: Add member (Owner only)
router.post('/members', authenticateToken, async (req, res) => {
  const { email, teamId } = req.body;

  if (!teamId) return res.status(400).json({ error: 'Team ID is required' });

  try {
    // Verify ownership of the specific team
    const team = await prisma.team.findUnique({ where: { id: parseInt(teamId) } });
    if (!team) return res.status(404).json({ error: 'Team not found' });

    if (team.ownerId !== req.user.id) {
       return res.status(403).json({ error: 'Only the team owner can add members' });
    }

    const member = await prisma.user.findUnique({ where: { email } });
    if (!member) {
      return res.status(404).json({ error: 'User not found. They must register first.' });
    }

    // Check if already in this team
    const isMember = await prisma.user.findFirst({
        where: {
            id: member.id,
            teams: { some: { id: team.id } }
        }
    });

    if (isMember) {
       return res.status(400).json({ error: 'User is already in this team' });
    }

    await prisma.team.update({
      where: { id: team.id },
      data: {
          members: { connect: { id: member.id } }
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

// DELETE /teams/:id/members/:userId: Remove member (Owner only)
router.delete('/:id/members/:userId', authenticateToken, async (req, res) => {
    const teamId = parseInt(req.params.id);
    const userId = parseInt(req.params.userId);

    try {
        const team = await prisma.team.findUnique({ where: { id: teamId } });
        if (!team) return res.status(404).json({ error: 'Team not found' });

        // Only owner can remove members
        if (team.ownerId !== req.user.id) {
            return res.status(403).json({ error: 'Only the team owner can remove members' });
        }

        // Cannot remove self (owner)
        if (userId === team.ownerId) {
            return res.status(400).json({ error: 'Cannot remove the owner from the team' });
        }

        await prisma.team.update({
            where: { id: teamId },
            data: {
                members: { disconnect: { id: userId } }
            }
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
        const isMember = await prisma.user.findFirst({
            where: {
                id: parseInt(newOwnerId),
                teams: { some: { id: teamId } }
            }
        });

        if (!isMember) {
            return res.status(400).json({ error: 'New owner must be a member of the team' });
        }

        // Update owner
        await prisma.team.update({
            where: { id: teamId },
            data: { ownerId: parseInt(newOwnerId) }
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

module.exports = router;
