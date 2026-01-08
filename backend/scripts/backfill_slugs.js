const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

async function backfill() {
  console.log('Starting backfill...');

  // Backfill Teams
  const teams = await prisma.team.findMany({ where: { slug: null } });
  console.log(`Found ${teams.length} teams without slug.`);

  for (const team of teams) {
    let baseSlug = slugify(team.name);
    if (!baseSlug) baseSlug = `team-${team.id}`;
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await prisma.team.findUnique({ where: { slug } });
      if (!existing) break;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    await prisma.team.update({
      where: { id: team.id },
      data: { slug }
    });
    console.log(`Updated team ${team.id} with slug: ${slug}`);
  }

  // Backfill Projects
  const projects = await prisma.project.findMany({ where: { slug: null } });
  console.log(`Found ${projects.length} projects without slug.`);

  for (const project of projects) {
    let baseSlug = slugify(project.name);
    if (!baseSlug) baseSlug = `project-${project.id}`;
    let slug = baseSlug;
    let counter = 1;

    // Uniqueness within team (or global if teamId is null, though typically teamId+slug is unique)
    // We'll check uniqueness based on teamId
    while (true) {
      const existing = await prisma.project.findFirst({
        where: {
            teamId: project.teamId,
            slug: slug
        }
      });
      if (!existing) break;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    await prisma.project.update({
      where: { id: project.id },
      data: { slug }
    });
    console.log(`Updated project ${project.id} with slug: ${slug}`);
  }

  console.log('Backfill complete.');
}

backfill()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
