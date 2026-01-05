const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Checks if a user has access to a specific project.
 *
 * @param {object|number} userOrId - The user object (with id) or user ID.
 * @param {number} projectId - The project ID to check access for.
 * @returns {Promise<{authorized: boolean, error?: string, status?: number, project?: object, user?: object}>}
 */
const checkProjectAccess = async (userOrId, projectId) => {
    const userId = typeof userOrId === 'object' ? userOrId.id : userOrId;

    if (!userId) return { authorized: false, error: 'User ID required', status: 401 };

    // Fetch fresh user data including teams
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            teams: { select: { id: true } },
            ownedTeams: { select: { id: true } }
        }
    });

    if (!user) return { authorized: false, error: 'User not found', status: 401 };

    const project = await prisma.project.findUnique({ where: { id: parseInt(projectId) } });
    if (!project) return { authorized: false, error: 'Project not found', status: 404 };

    const userTeamIds = [...user.teams.map(t => t.id), ...user.ownedTeams.map(t => t.id)];

    // Admin Access or Team Membership
    if (user.role !== 'admin' && (!project.teamId || !userTeamIds.includes(project.teamId))) {
        return { authorized: false, error: 'Access denied', status: 403 };
    }

    return { authorized: true, project, user };
};

/**
 * Checks if a user has access to a project associated with a specific comment.
 * Useful for PATCH/DELETE comment operations.
 *
 * @param {object|number} userOrId - The user object (with id) or user ID.
 * @param {number} commentId - The comment ID.
 * @returns {Promise<{authorized: boolean, error?: string, status?: number, comment?: object, project?: object}>}
 */
const checkCommentAccess = async (userOrId, commentId) => {
    const userId = typeof userOrId === 'object' ? userOrId.id : userOrId;

    const comment = await prisma.comment.findUnique({
        where: { id: parseInt(commentId) },
        include: {
            video: { select: { projectId: true } },
            image: { include: { bundle: { select: { projectId: true } } } },
            threeDAsset: { select: { projectId: true } }
        }
    });

    if (!comment) return { authorized: false, error: 'Comment not found', status: 404 };

    // Determine Project ID from relations
    let projectId = null;
    if (comment.video) projectId = comment.video.projectId;
    else if (comment.image && comment.image.bundle) projectId = comment.image.bundle.projectId;
    else if (comment.threeDAsset) projectId = comment.threeDAsset.projectId;

    if (!projectId) {
        // Orphaned comment or unexpected structure?
        // If we can't find a project, we can't authorize via project team.
        // Fallback: check if user is the comment author (if we allowed personal comments?)
        // But for now, fail safe.
        return { authorized: false, error: 'Project context not found for comment', status: 404 };
    }

    const access = await checkProjectAccess(userId, projectId);
    if (!access.authorized) return access;

    return { authorized: true, comment, project: access.project };
};

module.exports = { checkProjectAccess, checkCommentAccess };
