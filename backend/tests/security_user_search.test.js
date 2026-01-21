const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock Services to prevent side effects
jest.mock('../services/socketService', () => ({ init: jest.fn(), getIo: jest.fn() }));
jest.mock('../services/emailService', () => ({ initEmailService: jest.fn() }));
jest.mock('../services/cronService', () => ({ initCron: jest.fn() }));
jest.mock('../services/cleanupService', () => ({ runCleanup: jest.fn() }));
jest.mock('../services/systemStatsService', () => ({ initSystemStats: jest.fn() }));

// Mock Prisma
const mockFindMany = jest.fn();
const mockFindUnique = jest.fn();

jest.mock('@prisma/client', () => {
    return {
        PrismaClient: jest.fn().mockImplementation(() => {
            return {
                user: {
                    findMany: mockFindMany,
                    findUnique: mockFindUnique,
                    count: jest.fn().mockResolvedValue(0)
                },
                systemSetting: { findUnique: jest.fn() },
                $disconnect: jest.fn()
            };
        })
    };
});

// Import app
const app = require('../server');
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_IN_PROD_PLEASE';

describe('User Search Security', () => {
    let token;

    beforeAll(() => {
        token = jwt.sign({ id: 1, email: 'user@test.com', role: 'user' }, JWT_SECRET);
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should strip wildcards and scope search to teams (Fix Verification)', async () => {
        // Mock findUnique for retrieving current user's teams
        mockFindUnique.mockResolvedValue({
            teamMemberships: [{ teamId: 101 }, { teamId: 102 }]
        });

        // Mock findMany for the search result (empty is fine)
        mockFindMany.mockResolvedValue([]);

        // Use a query with wildcard that remains >1 char after stripping
        // 'ab%' -> 'ab'
        const response = await request(app)
            .get('/api/users/search?q=ab%')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);

        if (mockFindMany.mock.calls.length === 0) {
            throw new Error('Prisma findMany was not called');
        }

        const callArgs = mockFindMany.mock.calls[0][0];

        // CHECK 1: Wildcard stripped
        // 'ab%' should become 'ab'
        expect(callArgs.where.OR[0].name.contains).toBe('ab');
        expect(callArgs.where.OR[1].email.contains).toBe('ab');

        // CHECK 2: Team scoping applied
        expect(callArgs.where).toHaveProperty('teamMemberships');
        expect(callArgs.where.teamMemberships.some.teamId.in).toEqual([101, 102]);
    });
});
