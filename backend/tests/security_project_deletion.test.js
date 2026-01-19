const request = require('supertest');
const app = require('../server');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

describe('Security: Project Access Control (BAC)', () => {
    let ownerToken, memberToken, otherUserToken;
    let owner, member, otherUser;
    let team;
    let project;

    beforeAll(async () => {
        // cleanup
        await prisma.comment.deleteMany();
        await prisma.video.deleteMany();
        await prisma.project.deleteMany();
        await prisma.teamMembership.deleteMany();
        await prisma.team.deleteMany();
        await prisma.user.deleteMany();

        // 1. Create Users
        owner = await prisma.user.create({
            data: { email: 'owner@test.com', password: 'hash', name: 'Owner' }
        });
        member = await prisma.user.create({
            data: { email: 'member@test.com', password: 'hash', name: 'Member' }
        });
        otherUser = await prisma.user.create({
            data: { email: 'outsider@test.com', password: 'hash', name: 'Outsider' }
        });

        // 2. Create Team
        team = await prisma.team.create({
            data: {
                name: 'Test Team',
                slug: 'test-team',
                ownerId: owner.id
            }
        });

        // 3. Add Member to Team
        await prisma.teamMembership.create({
            data: {
                userId: member.id,
                teamId: team.id,
                role: 'MEMBER'
            }
        });

        // 4. Generate Tokens
        ownerToken = jwt.sign({ id: owner.id, email: owner.email, role: 'user' }, process.env.JWT_SECRET || 'CHANGE_ME_IN_PROD_PLEASE');
        memberToken = jwt.sign({ id: member.id, email: member.email, role: 'user' }, process.env.JWT_SECRET || 'CHANGE_ME_IN_PROD_PLEASE');
        otherUserToken = jwt.sign({ id: otherUser.id, email: otherUser.email, role: 'user' }, process.env.JWT_SECRET || 'CHANGE_ME_IN_PROD_PLEASE');
    });

    beforeEach(async () => {
        // Reset Project
        await prisma.project.deleteMany();
        project = await prisma.project.create({
            data: {
                name: 'Owner Project',
                slug: 'owner-project',
                teamId: team.id,
                status: 'INTERNAL_REVIEW'
            }
        });
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    // TEST CASES

    test('Owner should be able to DELETE project', async () => {
        const res = await request(app)
            .delete(`/api/projects/${project.id}`)
            .set('Authorization', `Bearer ${ownerToken}`);

        expect(res.statusCode).toBe(200);

        const deletedProject = await prisma.project.findUnique({ where: { id: project.id } });
        expect(deletedProject.deletedAt).not.toBeNull();
    });

    test('VULNERABILITY: Member should NOT be able to DELETE project (Expect 403, currently 200)', async () => {
        const res = await request(app)
            .delete(`/api/projects/${project.id}`)
            .set('Authorization', `Bearer ${memberToken}`);

        // EXPECTING FAILURE INITIALLY (reproducing vulnerability)
        // If this passes (200), the vulnerability exists.
        // We want to eventually assert 403.

        // For reproduction, let's assert what currently happens (200) to confirm exploit
        if (res.statusCode === 200) {
            console.log("VULNERABILITY REPRODUCED: Member deleted project");
        }

        // In the final fix, this should be 403.
        // For now, I will write the test to assert 403 so it FAILS, proving it needs fixing.
        expect(res.statusCode).toBe(403);
    });

    test('VULNERABILITY: Member should NOT be able to PATCH project (Expect 403, currently 200)', async () => {
        const res = await request(app)
            .patch(`/api/projects/${project.id}`)
            .set('Authorization', `Bearer ${memberToken}`)
            .send({ name: 'Hacked Project Name' });

        expect(res.statusCode).toBe(403);
    });

    test('Outsider should NOT be able to DELETE project', async () => {
        const res = await request(app)
            .delete(`/api/projects/${project.id}`)
            .set('Authorization', `Bearer ${otherUserToken}`);

        expect(res.statusCode).toBe(403);
    });

});
