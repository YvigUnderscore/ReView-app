const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');
const { processDebouncedQueue, processHourlyQueue } = require('./discordService');
const { processEmailQueue } = require('./emailBatchService');

const initCron = () => {
    // Run every hour
    cron.schedule('0 * * * *', async () => {
        console.log('Running cron: Hourly tasks');
        try {
            const { count } = await prisma.invite.deleteMany({
                where: { expiresAt: { lt: new Date() } }
            });
            console.log(`Deleted ${count} expired invites`);
        } catch (error) {
            console.error('Error cleaning up invites:', error);
        }

        // Discord Hourly Digest
        try {
            await processHourlyQueue();
        } catch (e) {
            console.error('Error processing hourly discord queue:', e);
        }
    });

    // Run every minute for Debounced/Grouped notifications (Discord & Email)
    cron.schedule('* * * * *', async () => {
        try {
            await processDebouncedQueue();
        } catch (e) {
            console.error('Error processing debounced discord queue:', e);
        }

        try {
            await processEmailQueue();
        } catch (e) {
            console.error('Error processing email queue:', e);
        }
    });

    console.log('Cron service initialized');
};

module.exports = { initCron };
