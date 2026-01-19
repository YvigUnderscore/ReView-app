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
const createAndBroadcast = async (userIds, { type, content, referenceId = null, projectId = null, videoId = null, extraData = {} }) => {
  if (!userIds || userIds.length === 0) return;

  // Deduplicate userIds
  const uniqueUserIds = [...new Set(userIds)];

  try {
    const notifications = await Promise.all(
      uniqueUserIds.map(async (userId) => {
        // 1. Create In-App Notification (Always, or based on pref? System usually implies always in-app, but let's check basic logic)
        // Existing logic creates it indiscriminately. We'll keep that for "In-App" history.
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

        // 2. Check Preferences for Email
        // We need to fetch the user's preference for this 'type'.
        // Default is usually: Email=False (opt-in).
        const pref = await prisma.notificationPreference.findUnique({
          where: { userId_type: { userId, type } }
        });

        const emailEnabled = pref ? pref.email : false; // Default false

        if (emailEnabled) {
          // Construct Payload for Email
          // We need more context than just 'content'. We might need project name, slug, etc.
          // Ideally 'extraData' should be passed in.
          // If not available, we might assume the consumer of this service passes enough info or we fetch it?
          // For now, let's assume `extraData` contains what we need (projectName, slugs, etc.)
          // If extraData is missing, we might record minimal info.

          const payload = JSON.stringify({
            content,
            type,
            referenceId,
            projectId,
            videoId,
            ...extraData
          });

          await prisma.emailQueue.create({
            data: {
              userId,
              type,
              payload
            }
          });
        }

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
