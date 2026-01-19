const { generateDigestEmail } = require('../services/templateService');
const fs = require('fs');
const path = require('path');

const user = { name: 'Test User', email: 'test@example.com' };
const items = [
    {
        type: 'COMMENT',
        payload: JSON.stringify({
            projectName: 'Test Project with Image',
            projectSlug: 'project-a',
            teamSlug: 'team-a',
            content: "Check out this screenshot.",
            user: { name: "Alice Admin", avatarPath: "avatar_123.jpg" },
            id: 101,
            image: "logo_full.png"
        })
    }
];

const html = generateDigestEmail(user, items, 'http://localhost:3000');
fs.writeFileSync('test_email_with_image.html', html);
console.log('Generated test_email_with_image.html');
