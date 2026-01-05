const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

// Ensure ffmpeg path is set if we are running in the sandbox with local ffmpeg
// In docker, it will be in /usr/bin/ffmpeg or similar, handled by PATH.
// In this sandbox, I installed it to ./ffmpeg (relative to root)
// I need to resolve that path if running locally, or trust PATH if in prod.

// Helper to check if ffmpeg is in path
const checkFfmpeg = () => {
    // Basic check for sandbox:
    const sandboxPath = path.resolve(__dirname, '../../ffmpeg');
    if (fs.existsSync(sandboxPath)) {
        ffmpeg.setFfmpegPath(sandboxPath);
    }
};

checkFfmpeg();

/**
 * Generates a thumbnail from a video file.
 * @param {string} videoPath - The full path to the video file.
 * @param {string} outputDir - The directory where the thumbnail should be saved.
 * @returns {Promise<string>} - The filename of the generated thumbnail.
 */
const generateThumbnail = (videoPath, outputDir) => {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const filename = path.basename(videoPath, path.extname(videoPath)) + '-thumb.jpg';
        const outputPath = path.join(outputDir, filename);

        ffmpeg(videoPath)
            .screenshots({
                timestamps: ['00:00:00.000'], // First frame
                filename: filename,
                folder: outputDir,
                size: '?x720' // Resize height to 720, keep aspect ratio? Or just '1280x720'. ?x720 scales width automatically.
            })
            .on('end', () => {
                resolve(filename);
            })
            .on('error', (err) => {
                console.error('Error generating thumbnail:', err);
                reject(err);
            });
    });
};

module.exports = { generateThumbnail };
