const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Connecting to database...");
        const user = await prisma.user.findFirst();
        if (!user) {
            console.log("No user found in local DB. Creating a dummy user for testing.");
            const newUser = await prisma.user.create({
                data: {
                    email: `test_pref_${Date.now()}@example.com`,
                    password: 'password123',
                    name: 'Test user'
                }
            });
            console.log("Created user:", newUser.id);
            await testPrefs(newUser.id);
        } else {
            console.log("Found user:", user.id);
            await testPrefs(user.id);
        }
    } catch (e) {
        console.error("Top level Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

async function testPrefs(userId) {
    try {
        console.log("Fetching preferences for user:", userId);
        const prefs = await prisma.notificationPreference.findMany({
            where: { userId: userId }
        });
        console.log("Preferences fetched successfully:", prefs);
    } catch (e) {
        console.error("Error fetching preferences:", e);
    }
}

main();
