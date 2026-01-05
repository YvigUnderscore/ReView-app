const request = require('supertest');
const { PrismaClient } = require('@prisma/client');

// Mock Prisma
const mockCreate = jest.fn();
const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
const mockTransaction = jest.fn();

jest.mock('@prisma/client', () => {
    return {
        PrismaClient: jest.fn().mockImplementation(() => {
            return {
                user: {
                    create: mockCreate,
                    findUnique: mockFindUnique,
                    count: jest.fn().mockResolvedValue(0)
                },
                invite: {
                    create: mockCreate,
                    findUnique: mockFindUnique,
                    update: mockUpdate
                },
                $transaction: mockTransaction,
                $disconnect: jest.fn()
            };
        })
    };
});

// Import app AFTER mocking
const app = require('../server');

describe('Rate Limiting Security Tests', () => {

    beforeAll(async () => {
        process.env.PORT = 3001;
        // Silence console logs for expected errors
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    describe('POST /auth/register Rate Limiting', () => {
        it('should enforce rate limit on registration', async () => {
            // Mock DB behavior to return error or success, doesn't matter for rate limit
            mockFindUnique.mockResolvedValue(null); // Invalid token

            const agent = request(app);

            // Our limit is 5. So we send 5 requests.
            const promises = [];
            for (let i = 0; i < 5; i++) {
                promises.push(
                    agent
                        .post('/api/auth/register')
                        .send({ token: 'invalid-token', name: 'Test', password: 'Password123' })
                );
            }

            await Promise.all(promises);

            // The 6th request should be blocked
            const resLimit = await agent
                .post('/api/auth/register')
                .send({ token: 'invalid-token', name: 'Test', password: 'Password123' });

            expect(resLimit.status).toBe(429);
            expect(resLimit.body.error).toContain('Too many registration attempts');
        });
    });

    describe('GET /invites/:token Rate Limiting', () => {
        it('should enforce rate limit on invite validation', async () => {
            mockFindUnique.mockResolvedValue(null); // Invalid token

            const agent = request(app);

            // Limit is 60. We'll send 60 requests.
            const promises = [];
            for (let i = 0; i < 60; i++) {
                promises.push(agent.get('/api/invites/invalid-token-' + i));
            }
            await Promise.all(promises);

            const resLimit = await agent.get('/api/invites/blocked-token');
            expect(resLimit.status).toBe(429);
            expect(resLimit.body.error).toContain('Too many validation attempts');
        });
    });
});
