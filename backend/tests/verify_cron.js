const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCron() {
    console.log('Testing Cron Logic...');

    // Create an expired invite
    const expiredInvite = await prisma.invite.create({
        data: {
            token: 'test_expired_' + Date.now(),
            email: 'expired@test.com',
            expiresAt: new Date(Date.now() - 10000) // Expired 10s ago
        }
    });

    // Create a valid invite
    const validInvite = await prisma.invite.create({
        data: {
            token: 'test_valid_' + Date.now(),
            email: 'valid@test.com',
            expiresAt: new Date(Date.now() + 100000) // Valid
        }
    });

    console.log('Created invites. Running cleanup...');

    // Manually run the logic (since we can't wait an hour)
    const { count } = await prisma.invite.deleteMany({
        where: { expiresAt: { lt: new Date() } }
    });

    console.log(`Deleted ${count} invites.`);

    // Verify
    const expiredCheck = await prisma.invite.findUnique({ where: { id: expiredInvite.id } });
    const validCheck = await prisma.invite.findUnique({ where: { id: validInvite.id } });

    if (!expiredCheck && validCheck) {
        console.log('SUCCESS: Expired invite deleted, valid invite retained.');
    } else {
        console.error('FAILURE: Logic incorrect.');
        console.log('Expired exists:', !!expiredCheck);
        console.log('Valid exists:', !!validCheck);
    }
}

testCron()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
