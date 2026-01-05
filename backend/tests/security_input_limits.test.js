
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

// Set env vars before requiring app
const DB_NAME = `limits_test_${Date.now()}.db`;
process.env.DATABASE_URL = `file:./${DB_NAME}`;
process.env.JWT_SECRET = "test-secret";
process.env.DATA_PATH = path.join(__dirname, `limits_storage_${Date.now()}`);

const app = require('../server');
const prisma = new PrismaClient();

describe('Security: Input Length Limits', () => {
    beforeAll(async () => {
        const { execSync } = require('child_process');
        execSync('npx prisma db push', {
            env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
            cwd: path.join(__dirname, '..'),
            stdio: 'ignore'
        });
    });

    afterAll(async () => {
        await prisma.$disconnect();
        try { fs.unlinkSync(path.join(__dirname, `../${DB_NAME}`)); } catch (e) {}
        try { fs.rmSync(process.env.DATA_PATH, { recursive: true, force: true }); } catch (e) {}
    });

    it('should REJECT huge name in setup', async () => {
        const hugeName = 'A'.repeat(200);
        const res = await request(app)
            .post('/api/auth/setup')
            .send({
                email: 'admin_limits@example.com',
                password: 'Password123!',
                name: hugeName
            });
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Name exceeds 100 characters');
    });

    it('should REJECT huge password in setup', async () => {
        const hugePass = 'P' + 'a'.repeat(200) + '1!';
        const res = await request(app)
            .post('/api/auth/setup')
            .send({
                email: 'admin_pass@example.com',
                password: hugePass,
                name: 'Admin'
            });
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/Password must be 8-128 characters/);
    });
});
