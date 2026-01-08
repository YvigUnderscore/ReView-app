const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

const initCron = () => {
    // Run every hour
    cron.schedule('0 * * * *', async () => {
        console.log('Running cron: Cleanup expired invites');
        try {
            const { count } = await prisma.invite.deleteMany({
                where: { expiresAt: { lt: new Date() } }
            });
            console.log(`Deleted ${count} expired invites`);
        } catch (error) {
            console.error('Error cleaning up invites:', error);
        }
    });

    console.log('Cron service initialized');
};

module.exports = { initCron };
