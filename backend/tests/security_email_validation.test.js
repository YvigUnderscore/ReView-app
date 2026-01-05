
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

// Set env vars before requiring app
const DB_NAME = `security_test_${Date.now()}.db`;
process.env.DATABASE_URL = `file:./${DB_NAME}`;
process.env.JWT_SECRET = "test-secret";
process.env.DATA_PATH = path.join(__dirname, `security_storage_${Date.now()}`);

const app = require('../server');
const prisma = new PrismaClient();

describe('Security: Email Validation', () => {
    beforeAll(async () => {
        // Push schema to test db
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

    it('should reject invalid email format in setup', async () => {
        const res = await request(app)
            .post('/api/auth/setup')
            .send({
                email: 'invalid-email',
                password: 'Password123!',
                name: 'Admin'
            });

        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('Invalid email format');
    });

    it('should reject email injection attempts', async () => {
        const res = await request(app)
            .post('/api/auth/setup')
            .send({
                email: 'admin@example.com<script>alert(1)</script>',
                password: 'Password123!',
                name: 'Admin'
            });
         expect(res.statusCode).toBe(400);
    });
});
