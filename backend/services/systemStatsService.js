const os = require('os');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const initSystemStats = (io) => {
    // Run every 5 seconds
    setInterval(async () => {
        try {
            // CPU Load
            const cpus = os.cpus();
            const cpuCount = cpus.length;
            const loadAvg = os.loadavg()[0]; // 1 minute load avg
            // Normalize load avg to percentage (approx)
            // If load is 1.0 on 1 core, it's 100%. On 4 cores, it's 25%.
            const cpuPercent = Math.min(100, (loadAvg / cpuCount) * 100);

            // RAM
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            const ramPercent = (usedMem / totalMem) * 100;

            // Storage (Global App Usage)
            // Sum all User storageUsed and Team storageUsed?
            // Or just Team since user personal usage might be overlapping?
            // Actually, we track User.storageUsed (personal + uploads) and Team.storageUsed (team projects).
            // To get total "App Data" size, we can sum all distinct files OR verify the sum.
            // But for a dashboard widget, sum of User+Team might be double counting if not careful?
            // Wait, logic says:
            // "Attribute to Team Storage AND User Storage" (Double accounting for Quota).
            // But for "Server Storage", we want actual disk usage.
            // Recalculating SUM(User.storageUsed) is just "Total Quota Consumed", not disk space.
            // Let's return Total Quota Consumed (Sum of all User.storageUsed is simplest 'Global' metric).
            // BUT, if we want "Server Storage", maybe we should check the actual disk?
            // "la charge serveur CPU/RAM/storage" -> implies Server Health.
            // Checking disk usage in Node is tricky cross-platform without exec('df').
            // Let's stick to "Total User Storage Used" as a proxy for "App Storage".

            const users = await prisma.user.aggregate({
                _sum: { storageUsed: true }
            });
            const globalStorageUsed = users._sum.storageUsed ? Number(users._sum.storageUsed) : 0;

            const stats = {
                cpu: cpuPercent.toFixed(1),
                ram: ramPercent.toFixed(1),
                ramUsed: (usedMem / 1024 / 1024 / 1024).toFixed(2) + ' GB',
                ramTotal: (totalMem / 1024 / 1024 / 1024).toFixed(2) + ' GB',
                storage: (globalStorageUsed / 1024 / 1024 / 1024).toFixed(2) + ' GB' // App storage
            };

            // Emit to 'admin_stats' room
            io.to('admin_stats').emit('SYSTEM_STATS', stats);

        } catch (error) {
            console.error('Error getting system stats:', error);
        }
    }, 5000);

    console.log('System Stats service initialized');
};

module.exports = { initSystemStats };
