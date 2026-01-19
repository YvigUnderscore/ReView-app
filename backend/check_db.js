const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const result = await prisma.$queryRaw`PRAGMA table_info(Comment);`;
        console.log(JSON.stringify(result, (key, value) =>
            typeof value === 'bigint'
                ? value.toString()
                : value // return everything else unchanged
            , 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
