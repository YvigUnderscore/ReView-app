const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BASE_URL = 'http://localhost:3000/api';

async function reproduce() {
    console.log('--- Starting IDOR Reproduction ---');

    try {
        // 1. Create Data directly in DB (to bypass auth complexity for setup)
        // We need: 2 projects, 1 video in Project A, 1 comment on Video A

        // Clean up previous test data if any (optional, but good practice)
        // For simplicity, we just create new unique ones
        const suffix = Date.now();

        // Create Team
        const team = await prisma.team.create({
            data: { name: `Test Team ${suffix}`, slug: `test-team-${suffix}` }
        });

        // Create Project A
        const projectA = await prisma.project.create({
            data: {
                name: `Project A ${suffix}`,
                slug: `project-a-${suffix}`,
                description: 'Desc',
                status: 'CLIENT_REVIEW',
                clientToken: `token-a-${suffix}`,
                teamId: team.id
            }
        });

        // Create Project B
        const projectB = await prisma.project.create({
            data: {
                name: `Project B ${suffix}`,
                slug: `project-b-${suffix}`,
                description: 'Desc',
                status: 'CLIENT_REVIEW',
                clientToken: `token-b-${suffix}`,
                teamId: team.id
            }
        });

        // Create Video in Project A
        const videoA = await prisma.video.create({
            data: {
                title: 'Video A',
                path: 'dummy.mp4',
                projectId: projectA.id,
                duration: 10,
                format: 'mp4',
                size: 1000,
                frameRate: 24,
                width: 1920,
                height: 1080
            }
        });

        // Create Comment on Video A
        const commentA = await prisma.comment.create({
            data: {
                content: 'Secret Comment',
                timestamp: 0,
                guestName: 'Attacker',
                visible: true,
                isVisibleToClient: true,
                videoId: videoA.id
            }
        });

        console.log(`Created Project A (Token: ${projectA.clientToken})`);
        console.log(`Created Project B (Token: ${projectB.clientToken})`);
        console.log(`Created Comment ${commentA.id} on Project A (Guest: Attacker)`);

        // 2. Attempt to delete Comment A using Project B's token
        console.log('\n--- Attempting Attack ---');
        console.log(`Deleting Comment ${commentA.id} using Project B token...`);

        try {
            await axios.delete(`${BASE_URL}/client/projects/${projectB.clientToken}/comments/${commentA.id}`, {
                data: { guestName: 'Attacker' }
            });
            console.log('❌ VULNERABILITY CONFIRMED: Comment deleted successfully using wrong project token!');
        } catch (error) {
            if (error.response && error.response.status === 403 || error.response.status === 404) {
                console.log('✅ SECURE: Delete request failed with status ' + error.response.status);
            } else {
                console.log('❓ UNEXPECTED ERROR:', error.message);
                if (error.response) console.log('Status:', error.response.status, error.response.data);
            }
        }

    } catch (error) {
        console.error('Setup failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

reproduce();
