const http = require('http');
const { init, getIo } = require('../services/socketService');
const ioClient = require('socket.io-client');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { JWT_SECRET } = require('../middleware');

const prisma = new PrismaClient();
const PORT = 3000 + Math.floor(Math.random() * 1000); // Random port

async function runTest() {
    console.log(`[TEST] Starting Security Socket Auth Test on port ${PORT}...`);

    // Start Server
    const server = http.createServer();
    init(server);
    server.listen(PORT);

    // Setup Data
    const victim = await prisma.user.create({
        data: { email: `victim_${Date.now()}@test.com`, password: 'x', name: 'Victim' }
    });
    const attacker = await prisma.user.create({
        data: { email: `attacker_${Date.now()}@test.com`, password: 'x', name: 'Attacker' }
    });
    const member = await prisma.user.create({
        data: { email: `member_${Date.now()}@test.com`, password: 'x', name: 'Member' }
    });

    const team = await prisma.team.create({
        data: {
            name: 'Auth Test Team',
            slug: `auth-team-${Date.now()}`,
            ownerId: victim.id,
            members: {
                create: [
                    { userId: victim.id, role: 'OWNER' },
                    { userId: member.id, role: 'MEMBER' }
                ]
            }
        }
    });

    const project = await prisma.project.create({
        data: {
            name: 'Secret Project',
            slug: `secret-project-${Date.now()}`,
            teamId: team.id
        }
    });

    const attackerToken = jwt.sign({ id: attacker.id, email: attacker.email, role: 'user' }, JWT_SECRET);
    const memberToken = jwt.sign({ id: member.id, email: member.email, role: 'user' }, JWT_SECRET);

    // TEST 1: Attacker (Unauthorized)
    console.log('[TEST] Scenario 1: Unauthorized access');
    const attackerSocket = ioClient(`http://localhost:${PORT}`, { query: { token: attackerToken } });

    await new Promise(resolve => attackerSocket.on('connect', resolve));
    attackerSocket.emit('join_project', project.id);
    await new Promise(r => setTimeout(r, 500)); // wait for join attempt

    // TEST 2: Member (Authorized)
    console.log('[TEST] Scenario 2: Authorized access');
    const memberSocket = ioClient(`http://localhost:${PORT}`, { query: { token: memberToken } });

    await new Promise(resolve => memberSocket.on('connect', resolve));
    memberSocket.emit('join_project', project.id);
    await new Promise(r => setTimeout(r, 500)); // wait for join attempt

    // EMIT EVENT
    const io = getIo();
    const eventData = { content: "Secret", projectId: project.id };
    io.to(`project_${project.id}`).emit('COMMENT_ADDED', eventData);

    // CHECK RECEPTION
    let attackerReceived = false;
    let memberReceived = false;

    attackerSocket.on('COMMENT_ADDED', () => attackerReceived = true);
    memberSocket.on('COMMENT_ADDED', () => memberReceived = true);

    await new Promise(r => setTimeout(r, 1000));

    attackerSocket.disconnect();
    memberSocket.disconnect();
    server.close();

    // Cleanup
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.team.delete({ where: { id: team.id } });
    await prisma.user.deleteMany({ where: { id: { in: [victim.id, attacker.id, member.id] } } });

    if (attackerReceived) {
        console.error('FAIL: Attacker received event!');
        process.exit(1);
    }
    if (!memberReceived) {
        console.error('FAIL: Member did NOT receive event!');
        process.exit(1);
    }

    console.log('SUCCESS: Attacker blocked, Member allowed.');
    process.exit(0);
}

runTest().catch(e => {
    console.error(e);
    process.exit(1);
});
