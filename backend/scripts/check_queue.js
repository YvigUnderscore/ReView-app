const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- Checking Discord Queue ---');
        const queueCount = await prisma.discordQueue.count();
        console.log(`Total items in DiscordQueue: ${queueCount}`);

        const items = await prisma.discordQueue.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10
        });

        if (items.length === 0) {
            console.log('Queue is empty.');
        } else {
            items.forEach(item => {
                console.log(`\n- Queue Item ID: ${item.id}, TeamID: ${item.teamId}, Type: ${item.type}`);
                try {
                    const data = JSON.parse(item.payload);
                    console.log('  Payload Data:');
                    console.log(`    - ID: ${data.id}`);
                    console.log(`    - Content: "${data.content}"`);
                    console.log(`    - ProjectID: ${data.projectId}`);
                    console.log(`    - Timestamp: ${data.timestamp} (Type: ${typeof data.timestamp})`);
                    console.log(`    - CameraState: ${data.cameraState ? 'Present' : 'Missing'}`);
                } catch (e) {
                    console.log('  Failed to parse payload:', e.message);
                }
            });
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
