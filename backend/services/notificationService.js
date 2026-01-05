const { PrismaClient } = require('@prisma/client');
const { emitToUser } = require('./socketService');

const prisma = new PrismaClient();

// Centralized Notification Service

/**
 * Creates notifications for multiple users and broadcasts them via Socket.IO
 *
 * @param {Array<number>} userIds - Array of User IDs to notify
 * @param {Object} data - Notification data
 * @param {string} data.type - Notification type (MENTION, REPLY, SYSTEM, PROJECT_CREATE, VIDEO_VERSION, STATUS_CHANGE, TEAM_ADD)
 * @param {string} data.content - Notification text content
 * @param {number|null} data.referenceId - Related entity ID (e.g. commentId, teamId)
 * @param {number|null} data.projectId - Related Project ID
 * @param {number|null} data.videoId - Related Video ID
 */
const createAndBroadcast = async (userIds, { type, content, referenceId = null, projectId = null, videoId = null }) => {
  if (!userIds || userIds.length === 0) return;

  // Deduplicate userIds
  const uniqueUserIds = [...new Set(userIds)];

  try {
    // We iterate to create individually so we have the ID for each notification to emit
    // A bulk create wouldn't return the IDs easily in all DBs/Prisma versions without a subsequent fetch
    // Given the expected scale (team size), simple loop is acceptable.
    const notifications = await Promise.all(
      uniqueUserIds.map(async (userId) => {
        const notification = await prisma.notification.create({
          data: {
            userId,
            type,
            content,
            referenceId,
            projectId,
            videoId,
            isRead: false
          }
        });
        return notification;
      })
    );

    // Broadcast to each user
    notifications.forEach(notification => {
      emitToUser(notification.userId, 'notification', notification);
    });

  } catch (error) {
    console.error('Error in NotificationService:', error);
  }
};

module.exports = {
  createAndBroadcast
};
