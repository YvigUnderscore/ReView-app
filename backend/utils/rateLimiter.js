/**
 * Simple in-memory rate limiter middleware.
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds (default: 15 minutes)
 * @param {number} options.max - Max number of connections during windowMs (default: 100)
 * @param {Object} options.message - Error response body (default: { error: 'Too many requests...' })
 * @param {Function} options.keyGenerator - Function to generate key from req (default: req.ip)
 * @returns {Function} Express middleware
 */
const rateLimit = (options = {}) => {
    const windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
    const max = options.max || 100;
    const message = options.message || { error: 'Too many requests, please try again later.' };
    const keyGenerator = options.keyGenerator || ((req) => req.ip || req.connection.remoteAddress || 'unknown');

    const hits = new Map();

    // Clean up expired entries every minute
    const cleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [key, data] of hits.entries()) {
            if (now - data.startTime > windowMs) {
                hits.delete(key);
            }
        }
    }, 60000);

    // Unref so it doesn't block process exit (useful for tests/scripts)
    if (cleanupInterval.unref) cleanupInterval.unref();

    return (req, res, next) => {
        const key = keyGenerator(req);
        const now = Date.now();

        if (!hits.has(key)) {
            hits.set(key, { count: 1, startTime: now });
            return next();
        }

        const data = hits.get(key);

        // Check if window has passed
        if (now - data.startTime > windowMs) {
            // Reset window
            data.count = 1;
            data.startTime = now;
            return next();
        }

        // Check limit
        if (data.count >= max) {
            return res.status(429).json(message);
        }

        data.count++;
        next();
    };
};

module.exports = { rateLimit };
