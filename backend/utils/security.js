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

module.exports = {
    sanitizeHtml
};
