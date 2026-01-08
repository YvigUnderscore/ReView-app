const io = require('socket.io-client');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');

// Matches backend/middleware.js default fallback
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE_ME_IN_PROD_PLEASE';

async function verifySocketEvents() {
    console.log('Verifying Socket Events...');

    // 1. Create User & Team
    const email = `socket_test_${Date.now()}@test.com`;
    const user = await prisma.user.create({
        data: {
            email,
            password: 'password123',
            name: 'Socket Tester'
        }
    });

    const team = await prisma.team.create({
        data: {
            name: 'Socket Team',
            ownerId: user.id
        }
    });

    // 2. Generate Token
    const token = jwt.sign({ id: user.id, email: user.email, role: 'user' }, JWT_SECRET);

    // 3. Connect Socket
    const socket = io('http://localhost:3000', {
        query: { token },
        transports: ['websocket', 'polling']
    });

    return new Promise((resolve, reject) => {
        socket.on('connect', async () => {
            console.log('Socket connected.');

            // 4. Create Project
            const project = await prisma.project.create({
                data: {
                    name: 'Socket Project',
                    teamId: team.id,
                    status: 'INTERNAL_REVIEW'
                }
            });

            // 5. Trigger Update via API
            try {
                // Wait a bit to ensure socket subscription to rooms is done?
                // The socket joins 'user_{id}' on connection. It should be instant.

                const res = await fetch(`http://localhost:3000/api/projects/${project.id}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ status: 'CLIENT_REVIEW' })
                });

                if (!res.ok) console.error('API Error:', res.status, await res.text());
                else console.log('Project updated via API.');

            } catch(e) {
                console.error("Fetch failed", e);
            }
        });

        socket.on('PROJECT_UPDATE', (data) => {
            console.log('Received PROJECT_UPDATE event:', data.name, data.status);
            if (data.status === 'CLIENT_REVIEW') {
                console.log('SUCCESS: Real-time update received.');
                socket.disconnect();
                resolve();
            }
        });

        socket.on('connect_error', (err) => {
            console.error('Socket connection error:', err.message);
            reject(err);
        });

        setTimeout(() => {
            console.error('TIMEOUT: Event not received.');
            socket.disconnect();
            reject(new Error('Timeout'));
        }, 5000);
    });
}

verifySocketEvents()
    .then(() => process.exit(0))
    .catch(e => { console.error(e); process.exit(1); });
