const request = require('supertest');
const app = require('../server'); // This imports the real app
const { sendEmail } = require('../services/emailService');

// Mock the email service
jest.mock('../services/emailService', () => ({
  sendEmail: jest.fn(),
  initEmailService: jest.fn(),
}));

// Mock authentication middleware
jest.mock('../middleware', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 1, email: 'admin@example.com', role: 'admin' };
    next();
  },
  requireAdmin: (req, res, next) => {
    next();
  },
  JWT_SECRET: 'test-secret'
}));

// Mock Prisma Client
// We can't easily mock prisma entirely if server.js uses it indirectly,
// but admin.routes.js instantiates it.
// However, since we mock the routes or the logic...
// Actually, `admin.routes.js` uses `new PrismaClient()`.
// To mock Prisma properly, we need jest-mock-extended or similar, but let's try to minimal mock.
// Since we only test /mail/test and /mail/broadcast:
// /mail/test doesn't use prisma.
// /mail/broadcast uses prisma.user.findMany.

const { PrismaClient } = require('@prisma/client');
jest.mock('@prisma/client', () => {
  const mPrisma = {
    user: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
    systemSetting: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        upsert: jest.fn(),
    }
  };
  return { PrismaClient: jest.fn(() => mPrisma) };
});


describe('Admin Email Routes', () => {
  let prisma;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/admin/mail/test', () => {
    it('should send a test email to the requester', async () => {
      sendEmail.mockResolvedValue(true);

      const res = await request(app)
        .post('/api/admin/mail/test')
        .send({ email: 'test@example.com' });

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('Test email sent successfully');
      expect(sendEmail).toHaveBeenCalledWith(
        'test@example.com',
        expect.stringContaining('Test Email'),
        expect.stringContaining('This is a test email')
      );
    });

    it('should default to user email if none provided', async () => {
        sendEmail.mockResolvedValue(true);

        const res = await request(app)
          .post('/api/admin/mail/test')
          .send({});

        expect(res.statusCode).toBe(200);
        expect(sendEmail).toHaveBeenCalledWith(
          'admin@example.com', // From mocked auth
          expect.any(String),
          expect.any(String)
        );
      });

    it('should handle send failure', async () => {
      sendEmail.mockResolvedValue(false);

      const res = await request(app)
        .post('/api/admin/mail/test')
        .send({ email: 'fail@example.com' });

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toContain('Failed to send test email');
    });
  });

  describe('POST /api/admin/mail/broadcast', () => {
    it('should require subject and message', async () => {
      const res = await request(app)
        .post('/api/admin/mail/broadcast')
        .send({ subject: 'Test' }); // Missing message

      expect(res.statusCode).toBe(400);
    });

    it('should send email to all users', async () => {
      const mockUsers = [
        { email: 'user1@example.com' },
        { email: 'user2@example.com' },
        { email: null } // Should be ignored
      ];

      prisma.user.findMany.mockResolvedValue(mockUsers);
      sendEmail.mockResolvedValue(true);

      const res = await request(app)
        .post('/api/admin/mail/broadcast')
        .send({ subject: 'News', message: 'Hello' });

      expect(res.statusCode).toBe(200);
      expect(res.body.stats.sent).toBe(2);
      expect(res.body.stats.total).toBe(3);

      expect(sendEmail).toHaveBeenCalledTimes(2);
      expect(sendEmail).toHaveBeenCalledWith('user1@example.com', 'News', 'Hello');
      expect(sendEmail).toHaveBeenCalledWith('user2@example.com', 'News', 'Hello');
    });
  });
});
