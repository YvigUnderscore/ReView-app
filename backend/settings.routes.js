const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('./middleware');
const { initEmailService } = require('./services/emailService');

const router = express.Router();
const prisma = new PrismaClient();

// Configure storage
const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, 'storage');
const SYSTEM_DIR = path.join(DATA_PATH, 'system');

if (!fs.existsSync(SYSTEM_DIR)) {
  fs.mkdirSync(SYSTEM_DIR, { recursive: true });
}

// Multer for icon upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, SYSTEM_DIR);
    },
    filename: (req, file, cb) => {
        // Always name it icon.png (or appropriate ext) or allow multiple?
        // User wants "ICO" to be targeted.
        // Let's stick to a fixed name for simplicity or store path in DB.
        // Storing path in DB allows versioning/cache busting.
        const ext = path.extname(file.originalname);
        const filename = `site-icon-${Date.now()}${ext}`;
        cb(null, filename);
    }
});

const upload = multer({ storage: storage });

// GET /api/system/config
// Public endpoint
router.get('/config', async (req, res) => {
    try {
        const titleSetting = await prisma.systemSetting.findUnique({ where: { key: 'site_title' } });
        const iconSetting = await prisma.systemSetting.findUnique({ where: { key: 'site_icon' } });
        const dateFormatSetting = await prisma.systemSetting.findUnique({ where: { key: 'date_format' } });

        res.json({
            title: titleSetting ? titleSetting.value : 'ReView',
            iconUrl: iconSetting ? `/api/media/system/${iconSetting.value}` : '/vite.svg', // Default to vite svg or whatever
            dateFormat: dateFormatSetting ? dateFormatSetting.value : 'DD/MM/YYYY'
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to fetch config' });
    }
});

// PATCH /api/admin/settings
// Admin only
router.patch('/', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const { title, dateFormat } = req.body;
    try {
        const updates = [];
        if (title) {
            updates.push(prisma.systemSetting.upsert({
                where: { key: 'site_title' },
                update: { value: title },
                create: { key: 'site_title', value: title }
            }));
        }
        if (dateFormat) {
            updates.push(prisma.systemSetting.upsert({
                where: { key: 'date_format' },
                update: { value: dateFormat },
                create: { key: 'date_format', value: dateFormat }
            }));
        }
        await prisma.$transaction(updates);
        res.json({ message: 'Settings updated' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// POST /api/admin/settings/icon
// Admin only
router.post('/icon', authenticateToken, upload.single('icon'), async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Validate MIME type
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/x-icon', 'image/svg+xml'];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
        // Delete the file if it was saved by multer before validation
        if (req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({ error: 'Invalid file type. Only images are allowed.' });
    }

    try {
        await prisma.systemSetting.upsert({
            where: { key: 'site_icon' },
            update: { value: req.file.filename },
            create: { key: 'site_icon', value: req.file.filename }
        });
        res.json({ iconUrl: `/api/media/system/${req.file.filename}` });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to update icon' });
    }
});

// GET /api/admin/settings/smtp
router.get('/smtp', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    try {
        const keys = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_secure', 'smtp_from'];
        const settings = await prisma.systemSetting.findMany({
            where: { key: { in: keys } }
        });

        const config = {};
        keys.forEach(k => config[k] = ''); // Default
        settings.forEach(s => config[s.key] = s.value);

        res.json(config);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to fetch smtp settings' });
    }
});

// PATCH /api/admin/settings/smtp
router.patch('/smtp', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, smtp_from } = req.body;

    try {
        const updates = [];
        if (smtp_host !== undefined) updates.push(prisma.systemSetting.upsert({ where: { key: 'smtp_host' }, update: { value: smtp_host }, create: { key: 'smtp_host', value: smtp_host } }));
        if (smtp_port !== undefined) updates.push(prisma.systemSetting.upsert({ where: { key: 'smtp_port' }, update: { value: smtp_port }, create: { key: 'smtp_port', value: smtp_port } }));
        if (smtp_user !== undefined) updates.push(prisma.systemSetting.upsert({ where: { key: 'smtp_user' }, update: { value: smtp_user }, create: { key: 'smtp_user', value: smtp_user } }));
        if (smtp_pass !== undefined) updates.push(prisma.systemSetting.upsert({ where: { key: 'smtp_pass' }, update: { value: smtp_pass }, create: { key: 'smtp_pass', value: smtp_pass } }));
        if (smtp_secure !== undefined) updates.push(prisma.systemSetting.upsert({ where: { key: 'smtp_secure' }, update: { value: String(smtp_secure) }, create: { key: 'smtp_secure', value: String(smtp_secure) } }));
        if (smtp_from !== undefined) updates.push(prisma.systemSetting.upsert({ where: { key: 'smtp_from' }, update: { value: smtp_from }, create: { key: 'smtp_from', value: smtp_from } }));

        await prisma.$transaction(updates);

        // Re-init email service
        await initEmailService();

        res.json({ message: 'SMTP Settings updated' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to update smtp settings' });
    }
});

module.exports = router;
