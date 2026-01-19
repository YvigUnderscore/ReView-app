const ffmpeg = require('fluent-ffmpeg');

/**
 * Retrieves video metadata (width, height, aspect ratio, frameRate) from a file.
 * @param {string} filePath
 * @returns {Promise<{width: number, height: number, aspectRatio: string, frameRate: number}>}
 */
const getVideoMetadata = (filePath) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                console.error('Error getting metadata:', err);
                return resolve({ width: 0, height: 0, aspectRatio: 'Unknown', frameRate: 24.0 });
            }

            const videoStream = metadata.streams.find(s => s.codec_type === 'video');
            if (!videoStream) {
                return resolve({ width: 0, height: 0, aspectRatio: 'Unknown', frameRate: 24.0 });
            }

            const width = videoStream.width;
            const height = videoStream.height;
            let aspectRatio = 'Unknown';
            let frameRate = 24.0;

            if (width && height) {
                // Calculate common aspect ratios
                const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
                const divisor = gcd(width, height);
                aspectRatio = `${width / divisor}:${height / divisor}`;

                // If it's close to 16:9, normalize it?
                // FFmpeg display_aspect_ratio is often 16:9 for non-square pixels.
                // We'll trust the calculated ratio for now or use display_aspect_ratio if available.
                if (videoStream.display_aspect_ratio) {
                    aspectRatio = videoStream.display_aspect_ratio;
                }
            }

            if (videoStream.r_frame_rate) {
                const parts = videoStream.r_frame_rate.split('/');
                if (parts.length === 2) {
                    const fps = parseFloat(parts[0]) / parseFloat(parts[1]);
                    if (!isNaN(fps) && fps > 0) frameRate = fps;
                }
            } else if (videoStream.avg_frame_rate) {
                const parts = videoStream.avg_frame_rate.split('/');
                if (parts.length === 2) {
                    const fps = parseFloat(parts[0]) / parseFloat(parts[1]);
                    if (!isNaN(fps) && fps > 0) frameRate = fps;
                }
            }

            const duration = metadata.format.duration || 0;

            resolve({ width, height, aspectRatio, frameRate, duration });
        });
    });
};

module.exports = { getVideoMetadata };
