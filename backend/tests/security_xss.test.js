/**
 * XSS Sanitization Tests
 * Verifies that HTML tags are sanitized from user inputs before storage
 */

const { sanitizeHtml } = require('../utils/security');

describe('XSS Sanitization', () => {
    describe('sanitizeHtml function', () => {
        test('should strip basic script tags', () => {
            const malicious = '<script>alert("XSS")</script>';
            const result = sanitizeHtml(malicious);
            expect(result).not.toContain('<script');
            expect(result).not.toContain('</script>');
        });

        test('should strip inline event handlers', () => {
            const malicious = '<img src="x" onerror="alert(1)">';
            const result = sanitizeHtml(malicious);
            expect(result).not.toContain('onerror');
        });

        test('should strip javascript: protocol', () => {
            const malicious = '<a href="javascript:alert(1)">click</a>';
            const result = sanitizeHtml(malicious);
            expect(result).not.toContain('javascript:');
        });

        test('should handle mixed content with scripts', () => {
            const malicious = 'Hello <script>evil()</script> World';
            const result = sanitizeHtml(malicious);
            expect(result).not.toContain('<script');
            expect(result).toContain('Hello');
            expect(result).toContain('World');
        });

        test('should sanitize nested tags', () => {
            const malicious = '<div><script>alert(1)</script></div>';
            const result = sanitizeHtml(malicious);
            expect(result).not.toContain('<script');
        });

        test('should handle SVG-based XSS attempts', () => {
            const malicious = '<svg onload="alert(1)">';
            const result = sanitizeHtml(malicious);
            expect(result).not.toContain('onload');
        });

        test('should preserve plain text without HTML', () => {
            const plainText = 'This is just regular text with no HTML';
            const result = sanitizeHtml(plainText);
            expect(result).toBe(plainText);
        });

        test('should handle null/undefined input gracefully', () => {
            expect(sanitizeHtml(null)).toBe('');
            expect(sanitizeHtml(undefined)).toBe('');
            expect(sanitizeHtml('')).toBe('');
        });

        test('should handle guest names with malicious content', () => {
            // Simulates guestName XSS attack vector
            const maliciousName = 'John<script>document.cookie</script>Doe';
            const result = sanitizeHtml(maliciousName);
            expect(result).not.toContain('<script');
            expect(result).toContain('John');
            expect(result).toContain('Doe');
        });

        test('should handle user names with HTML injection', () => {
            // Simulates name field XSS attack vector
            const maliciousName = '<img src=x onerror=alert(1)>Admin';
            const result = sanitizeHtml(maliciousName);
            expect(result).not.toContain('<img');
            expect(result).not.toContain('onerror');
            expect(result).toContain('Admin');
        });

        test('should handle encoded XSS attempts', () => {
            const encodedXss = '&lt;script&gt;alert(1)&lt;/script&gt;';
            const result = sanitizeHtml(encodedXss);
            // HTML entities should remain as-is or be decoded safely
            expect(result).not.toMatch(/<script>/i);
        });
    });
});
