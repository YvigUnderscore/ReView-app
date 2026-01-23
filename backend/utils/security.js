const xss = require('xss');

/**
 * Sanitizes HTML input to prevent XSS.
 * Allows a safe whitelist of tags and attributes if needed, or strips all.
 * For this application, we likely want to allow basic formatting but definitely not scripts.
 *
 * @param {string} html
 * @returns {string}
 */
const sanitizeHtml = (html) => {
    if (!html) return '';
    // Default xss options are generally safe (strips scripts, iframes, on* events)
    return xss(html);
};

/**
 * Validates a Discord Webhook URL to prevent SSRF.
 * Strict allowlist of domains: discord.com, discordapp.com
 *
 * @param {string} url
 * @returns {boolean}
 */
const isValidDiscordWebhook = (url) => {
    if (!url || typeof url !== 'string') return false;

    try {
        const parsed = new URL(url);
        // Protocol must be https
        if (parsed.protocol !== 'https:') return false;

        // Hostname must be exactly discord.com or discordapp.com
        // We do NOT allow subdomains like 'evil.discord.com' or 'discord.com.evil.com'
        const allowedHosts = ['discord.com', 'discordapp.com'];
        if (!allowedHosts.includes(parsed.hostname)) return false;

        return true;
    } catch (e) {
        return false;
    }
};

module.exports = {
    sanitizeHtml,
    isValidDiscordWebhook
};
