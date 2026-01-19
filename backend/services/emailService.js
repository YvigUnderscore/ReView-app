const nodemailer = require('nodemailer');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

let transporter = null;

// Initialize transporter from SystemSettings
const initEmailService = async () => {
    try {
        const settings = await prisma.systemSetting.findMany({
            where: {
                key: { in: ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_secure', 'smtp_from'] }
            }
        });

        const config = {};
        settings.forEach(s => config[s.key] = s.value);

        if (config.smtp_host && config.smtp_user && config.smtp_pass) {
            transporter = nodemailer.createTransport({
                host: config.smtp_host,
                port: parseInt(config.smtp_port) || 587,
                secure: config.smtp_secure === 'true', // true for 465, false for other ports
                auth: {
                    user: config.smtp_user,
                    pass: config.smtp_pass,
                },
            });
            console.info('Email Service: Transporter initialized');
        } else {
            console.warn('Email Service: SMTP settings not found or incomplete');
        }
    } catch (error) {
        console.error('Email Service: Initialization failed', error);
    }
};

const sendEmail = async (to, subject, text, html, attachments = []) => {
    if (!transporter) {
        await initEmailService(); // Try to init if not ready
        if (!transporter) {
            console.warn('Email Service: Skipped sending email (transporter not ready). To:', to, 'Subject:', subject);
            return false;
        }
    }

    try {
        const fromSetting = await prisma.systemSetting.findUnique({ where: { key: 'smtp_from' } });
        const from = fromSetting ? fromSetting.value : process.env.SMTP_FROM || '"ReView" <noreply@example.com>';

        await transporter.sendMail({
            from,
            to,
            subject,
            text,
            html,
            attachments
        });
        return true;
    } catch (error) {
        console.error('Email Service: Send failed', error);
        return false;
    }
};

module.exports = {
    initEmailService,
    sendEmail
};
