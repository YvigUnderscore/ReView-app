const request = require('supertest');
const app = require('../server');
const { PrismaClient } = require('@prisma/client');
const { sanitizeHtml } = require('../utils/security');
const { isValidText } = require('../utils/validation');

// Mock Prisma
jest.mock('@prisma/client', () => {
    const mockPrisma = {
        project: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
        },
        comment: {
            create: jest.fn(),
            findUnique: jest.fn(),
            delete: jest.fn(),
            update: jest.fn(),
        },
        user: {
            findUnique: jest.fn(),
            create: jest.fn(),
        },
        invite: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        video: {
            findFirst: jest.fn(),
        },
        image: {
            findUnique: jest.fn(),
        },
        threeDAsset: {
            findFirst: jest.fn(),
        },
        $transaction: jest.fn((callback) => callback(mockPrisma)),
    };
    return { PrismaClient: jest.fn(() => mockPrisma) };
});

const prisma = new PrismaClient();

// Mock Auth Middleware
jest.mock('../middleware', () => ({
    authenticateToken: (req, res, next) => {
        req.user = { id: 1, role: 'user' };
        next();
    },
    requireAdmin: (req, res, next) => next(),
    JWT_SECRET: 'test_secret'
}));

// Mock rate limiter
jest.mock('../utils/rateLimiter', () => ({
    rateLimit: () => (req, res, next) => next()
}));

// Mock validation utils
jest.mock('../utils/validation', () => ({
    isValidText: jest.fn((text, len) => text && text.length <= len),
    isValidImageFile: jest.fn(() => true),
    isValidImageBuffer: jest.fn(() => true),
    isValidEmail: jest.fn(() => true),
    isValidPassword: jest.fn(() => true)
}));

// Mock services that cause initialization errors
jest.mock('../services/emailService', () => ({
    initEmailService: jest.fn(),
    sendEmail: jest.fn()
}));
jest.mock('../services/cleanupService', () => ({
    runCleanup: jest.fn()
}));
jest.mock('../services/cronService', () => ({
    initCron: jest.fn()
}));
jest.mock('../services/systemStatsService', () => ({
    initSystemStats: jest.fn()
}));

describe('Security: Input Sanitization', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('POST /api/client/projects/:token/comments should sanitize guestName', async () => {
        const token = 'test-token';
        const maliciousName = '<script>alert("XSS")</script>John';

        // Expected output from xss library for this input
        const expectedSafeName = '&lt;script&gt;alert("XSS")&lt;/script&gt;John';

        // Mock Project
        prisma.project.findUnique.mockResolvedValue({
            id: 1,
            clientToken: token,
            status: 'CLIENT_REVIEW'
        });

        // Mock Asset
        prisma.video.findFirst.mockResolvedValue({ id: 1, projectId: 1 });

        // Mock Comment Create
        prisma.comment.create.mockImplementation((args) => {
            return Promise.resolve({
                id: 1,
                ...args.data
            });
        });

        const res = await request(app)
            .post(`/api/client/projects/${token}/comments`)
            .send({
                guestName: maliciousName,
                content: 'Test comment',
                timestamp: 10,
                videoId: 1
            });

        expect(res.status).toBe(200);
        expect(prisma.comment.create).toHaveBeenCalled();
        const createCall = prisma.comment.create.mock.calls[0][0];

        expect(createCall.data.guestName).toBe(expectedSafeName);
    });

    test('POST /api/auth/register should sanitize name', async () => {
        const maliciousName = '<img src=x onerror=alert(1)>User';
        // The xss library by default strips the onerror attribute and keeps the img tag but without src=x if invalid or keeps it if valid?
        // Wait, my debug script output `<img src>User`.
        // Let's match what the library actually produces.
        // xss defaults: allow img tag, but strip invalid attributes.
        // It seems it stripped src because 'x' is not a valid url or similar rule, and onerror is definitely stripped.
        // The important part is onerror is gone.
        const expectedSafeName = '<img src>User';

        prisma.invite.findUnique.mockResolvedValue({
            id: 1,
            token: 'valid-token',
            email: 'test@example.com',
            role: 'user',
            used: false
        });

        prisma.user.findUnique.mockResolvedValue(null);
        prisma.user.create.mockResolvedValue({
            id: 1,
            email: 'test@example.com',
            name: expectedSafeName,
            role: 'user'
        });

        const res = await request(app)
            .post('/api/auth/register')
            .send({
                token: 'valid-token',
                name: maliciousName,
                password: 'Password123'
            });

        expect(res.status).toBe(200);
        expect(prisma.user.create).toHaveBeenCalled();
        const createCall = prisma.user.create.mock.calls[0][0];
        expect(createCall.data.name).toBe(expectedSafeName);
    });

});
