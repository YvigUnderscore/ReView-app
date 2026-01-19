
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Set env vars before requiring app
const DB_NAME = `bypass_test_${Date.now()}.db`;
process.env.DATABASE_URL = `file:./${DB_NAME}`;
process.env.JWT_SECRET = "test-secret";
process.env.DATA_PATH = path.join(__dirname, `bypass_storage_${Date.now()}`);

// Mock validation
jest.mock('../utils/validation', () => {
    const original = jest.requireActual('../utils/validation');
    return {
        ...original,
        isValidVideoFile: () => true,
        isValidImageFile: () => true,
    };
});

const app = require('../server');
const prisma = new PrismaClient();

describe('Security: Auth Bypass in Version Upload', () => {
    let adminToken, userToken;
    let adminProject;

    jest.setTimeout(30000); // Increase timeout for DB setup

    beforeAll(async () => {
        // Init DB
        const { execSync } = require('child_process');
        execSync('npx prisma db push', {
            env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
            cwd: path.join(__dirname, '..'),
            stdio: 'ignore'
        });

        // Create storage dirs
        if (!fs.existsSync(process.env.DATA_PATH)) fs.mkdirSync(process.env.DATA_PATH, { recursive: true });
        const mediaDir = path.join(process.env.DATA_PATH, 'media');
        if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
        const thumbDir = path.join(process.env.DATA_PATH, 'thumbnails');
        if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

        // Create Admin
        const admin = await prisma.user.create({
            data: {
                email: 'admin@example.com',
                password: await bcrypt.hash('password', 10),
                name: 'Admin',
                role: 'admin'
            }
        });
        adminToken = jwt.sign({ id: admin.id, email: admin.email, role: admin.role }, process.env.JWT_SECRET);

        // Create Normal User
        const user = await prisma.user.create({
            data: {
                email: 'user@example.com',
                password: await bcrypt.hash('password', 10),
                name: 'User',
                role: 'user'
            }
        });
        userToken = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET);

        // Create Admin Project (teamId: null)
        adminProject = await prisma.project.create({
            data: {
                name: 'Admin Secret Project',
                slug: 'admin-secret',
                teamId: null, // Critical: Admin project has no team
            }
        });
    });

    afterAll(async () => {
        await prisma.$disconnect();
        try { fs.unlinkSync(path.join(__dirname, `../${DB_NAME}`)); } catch (e) {}
        try { fs.rmSync(process.env.DATA_PATH, { recursive: true, force: true }); } catch (e) {}
        try { fs.unlinkSync(path.join(__dirname, 'dummy.mp4')); } catch (e) {}
    });

    it('should DENY normal user from uploading version to Admin Project (FIXED)', async () => {
        // Create a dummy video file
        const dummyVideoPath = path.join(__dirname, 'dummy.mp4');
        if (!fs.existsSync(dummyVideoPath)) fs.writeFileSync(dummyVideoPath, 'dummy content');

        const res = await request(app)
            .post(`/api/projects/${adminProject.id}/versions`)
            .set('Authorization', `Bearer ${userToken}`)
            .attach('file', dummyVideoPath);

        // Expectation: 403 Access Denied
        if (res.statusCode !== 403) {
            console.log('Test Failed Response:', res.statusCode, res.body);
        }
        expect(res.statusCode).toBe(403);
        expect(res.body.error).toBe('Access denied');
    });

    it('should ALLOW user to upload version to their Team Project', async () => {
        // 1. Create Team
        const userObj = jwt.decode(userToken);
        const team = await prisma.team.create({
            data: {
                name: 'User Team',
                slug: 'user-team',
                owner: { connect: { id: userObj.id } },
                members: { create: { userId: userObj.id, role: 'OWNER' } }
            }
        });

        // 2. Create Project in Team
        const project = await prisma.project.create({
            data: {
                name: 'User Project',
                slug: 'user-project',
                teamId: team.id
            }
        });

        // 3. Upload Version
        const dummyVideoPath = path.join(__dirname, 'dummy.mp4');
        if (!fs.existsSync(dummyVideoPath)) fs.writeFileSync(dummyVideoPath, 'dummy content');

        const res = await request(app)
            .post(`/api/projects/${project.id}/versions`)
            .set('Authorization', `Bearer ${userToken}`)
            .attach('file', dummyVideoPath);

        if (res.statusCode !== 200) {
            console.log('Valid Upload Failed:', res.statusCode, res.body);
        }
        expect(res.statusCode).toBe(200);
        expect(res.body.versionName).toBe('V01');
    });
});
