const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Fetching recent 3D projects with comments...');

        const projects = await prisma.project.findMany({
            take: 5,
            orderBy: { updatedAt: 'desc' },
            where: {
                threeDAssets: { some: {} }
            },
            include: {
                threeDAssets: {
                    include: {
                        comments: {
                            orderBy: { timestamp: 'asc' },
                        }
                    }
                },
                team: true
            }
        });

        for (const p of projects) {
            console.log(`\nProject: ${p.name} (ID: ${p.id}, Slug: ${p.slug})`);
            console.log(`Team: ${p.team.name} (Slug: ${p.team.slug})`);

            for (const asset of p.threeDAssets) {
                console.log(` Asset: ${asset.versionName} (ID: ${asset.id})`);
                console.log(` Comments: ${asset.comments.length}`);

                asset.comments.forEach(c => {
                    console.log(`  - ID: ${c.id}, Time: ${c.timestamp}, Content: ${c.content.substring(0, 20)}...`);
                });
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
