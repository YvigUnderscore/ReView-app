const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    const email = 'debug_gif_user@example.com';
    const password = 'password123';
    // Use 10 rounds for bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        // Upsert: Create if not exists, Update password if exists
        const user = await prisma.user.upsert({
            where: { email },
            update: { password: hashedPassword, role: 'admin' },
            create: {
                email,
                password: hashedPassword,
                name: 'Debug Admin',
                role: 'admin'
            }
        });
        console.log('User created/updated:', user.email);
    } catch (e) {
        console.error('Error creating user:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
