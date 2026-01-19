const fs = require('fs');
const path = require('path');

// Basic styles for the email
const STYLES = `
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; margin: 0; padding: 0; background-color: #f3f4f6; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .header { background-color: #0f172a; padding: 32px; text-align: center; } /* Increased padding */
    .header img { height: 64px; width: auto; } /* Increased Logo Size */
    .content { padding: 32px; }
    .title { font-size: 24px; font-weight: 700; margin-bottom: 24px; color: #0f172a; }
    .project-card { margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
    .project-title { font-size: 16px; font-weight: 600; color: #3b82f6; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
    .item { display: flex; align-items: flex-start; margin-bottom: 16px; }
    .item:last-child { margin-bottom: 0; }
    .item-media { margin-right: 12px; flex-shrink: 0; }
    .item-icon { font-size: 18px; line-height: 1.5; width: 24px; text-align: center; }
    .avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 1px solid #e2e8f0; }
    .item-content { flex: 1; font-size: 14px; line-height: 1.5; align-self: center; }
    .item-link { color: #3b82f6; text-decoration: none; font-weight: 500; font-size: 12px; margin-left: 8px; }
    .footer { background-color: #f8fafc; padding: 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
    .footer a { color: #64748b; text-decoration: underline; }
`;

/**
 * Generates the HTML for a Digest Email
 * @param {Object} user - The user object
 * @param {Array} items - List of notification items
 * @param {string} publicUrl - Base URL of the application
 * @returns {string} HTML string
 */
const generateDigestEmail = (user, items, publicUrl) => {
    // Group by Project
    const byProject = {};
    items.forEach(item => {
        let data;
        try { data = JSON.parse(item.payload); } catch (e) { data = {}; }

        const projectName = data.projectName || 'General Updates';
        if (!byProject[projectName]) byProject[projectName] = [];
        byProject[projectName].push({ type: item.type, data });
    });

    // Build Project Cards
    let projectsHtml = '';
    for (const [project, events] of Object.entries(byProject)) {
        let itemsHtml = '';
        for (const event of events) {
            const { type, data } = event;
            let iconOrAvatar = '<div class="item-icon">•</div>'; // Default
            let text = '';
            let link = publicUrl;

            // Link Logic
            const teamSlug = data.teamSlug || 'team';
            const projectSlug = data.projectSlug || 'project';
            const userAvatar = data.user && data.user.avatarPath
                ? `<img src="${publicUrl}/api/media/avatars/${data.user.avatarPath}" class="avatar" alt="${data.user.name}">`
                : null;

            if (type === 'COMMENT' || type === 'MENTION' || type === 'REPLY') {
                iconOrAvatar = userAvatar || '<div class="item-icon">💬</div>';
                const author = data.user ? data.user.name : (data.guestName || 'User');
                text = `<strong>${author}</strong>: "${data.content ? data.content.substring(0, 100) : '...'}"`;
                if (data.id) link = `${publicUrl}/#/${teamSlug}/project/${projectSlug}?commentId=${data.id}`;
            } else if (type === 'STATUS_CHANGE') {
                iconOrAvatar = '<div class="item-icon">🔄</div>';
                text = `Status changed to <strong>${data.status}</strong>`;
                if (data.projectSlug) link = `${publicUrl}/#/${teamSlug}/project/${projectSlug}`;
            } else if (type === 'VIDEO_VERSION') {
                iconOrAvatar = '<div class="item-icon">🎬</div>';
                text = `New version uploaded: <strong>${data.versionName}</strong>`;
                if (data.projectSlug) link = `${publicUrl}/#/${teamSlug}/project/${projectSlug}`;
            } else if (type === 'PROJECT_CREATE') {
                iconOrAvatar = '<div class="item-icon">🚀</div>';
                text = `New project created: <strong>${data.name}</strong>`;
                if (data.slug) link = `${publicUrl}/#/${teamSlug}/project/${data.slug}`;
            }

            // Optional: Check for attachment image (for tests or rich media)
            let attachmentHtml = '';
            if (data.image) {
                // Determine source: If it starts with http, use as is, else prepend publicUrl
                const imgSrc = data.image.startsWith('http') ? data.image : `${publicUrl}/${data.image}`;
                attachmentHtml = `<div style="margin-top: 8px;"><img src="${imgSrc}" style="max-width: 100%; border-radius: 4px; border: 1px solid #e2e8f0;" alt="Attachment"></div>`;
            }

            // GIF Turnaround
            if (data.gifPath) {
                const gifSrc = `${publicUrl}/api/media/${data.gifPath}`;
                attachmentHtml += `<div style="margin-top: 8px;"><img src="${gifSrc}" style="max-width: 100%; border-radius: 4px; border: 1px solid #e2e8f0;" alt="3D Turnaround"></div>`;
            }

            itemsHtml += `
                <div class="item">
                    <div class="item-media">${iconOrAvatar}</div>
                    <div class="item-content">
                        ${text}
                        <a href="${link}" class="item-link">View</a>
                        ${attachmentHtml}
                    </div>
                </div>
            `;
        }

        projectsHtml += `
            <div class="project-card">
                <div class="project-title">${project}</div>
                ${itemsHtml}
            </div>
        `;
    }

    const logoUrl = `${publicUrl}/logo_full.png`;

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Activity Digest</title>
    <style>${STYLES}</style>
</head>
<body>
    <div class="container">
        <div class="header">
            <!-- Fallback to text if image not loaded, but ideally assume public assets are served -->
            <img src="${logoUrl}" alt="ReView" style="color: white; font-size: 24px; font-weight: bold;">
        </div>
        <div class="content">
            <div class="title">Here's what you missed</div>
            ${projectsHtml}
        </div>
        <div class="footer">
            <p>You received this email because you subscribed to notifications.</p>
            <p><a href="${publicUrl}/settings">Manage Notifications</a> | <a href="${publicUrl}/settings?action=unsubscribe">Unsubscribe</a></p>
        </div>
    </div>
</body>
</html>
    `;
};

module.exports = {
    generateDigestEmail
};
