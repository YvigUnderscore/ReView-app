const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function createAdmin() {
    const email = 'admin@test.com';
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Upsert admin
    const user = await prisma.user.upsert({
        where: { email },
        update: {
            password: hashedPassword,
            role: 'admin'
        },
        create: {
            email,
            password: hashedPassword,
            name: 'Admin User',
            role: 'admin'
        }
    });

    console.log('Admin user ensured:', user.email);
}

createAdmin()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
