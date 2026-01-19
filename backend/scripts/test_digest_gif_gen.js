const { generateDigestGif } = require('../services/digestGifService');
const path = require('path');
const fs = require('fs');

async function test() {
    const projectId = 66; // "animation"
    const comments = [
        { id: 149, timestamp: 1.4444 },
        { id: 150, timestamp: 4.4100 },
        { id: 151, timestamp: 6.4024 }
    ];

    const outputDir = path.join(__dirname, '../data/media/debug');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    console.log('Starting GIF generation test...');
    try {
        const result = await generateDigestGif(comments, projectId, outputDir);
        console.log('Result:', result);
    } catch (e) {
        console.error('Test failed:', e);
    }
}

test();
