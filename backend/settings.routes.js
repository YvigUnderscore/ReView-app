const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('./middleware');
const { initEmailService } = require('./services/emailService');
const { recalculateAllStorage } = require('./utils/storage');

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
        // Check fieldname to decide prefix
        const prefix = file.fieldname === 'sound' ? 'notification-sound-' : 'site-icon-';
        const ext = path.extname(file.originalname);
        const filename = `${prefix}${Date.now()}${ext}`;
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
        const soundSetting = await prisma.systemSetting.findUnique({ where: { key: 'notification_sound' } });

        res.json({
            title: titleSetting ? titleSetting.value : 'ReView',
            iconUrl: iconSetting ? `/api/media/system/${iconSetting.value}` : '/vite.svg',
            dateFormat: dateFormatSetting ? dateFormatSetting.value : 'DD/MM/YYYY',
            notificationSoundUrl: soundSetting ? `/api/media/system/${soundSetting.value}` : null
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

    const { title, dateFormat, retentionDays } = req.body;
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
        if (retentionDays !== undefined) {
             updates.push(prisma.systemSetting.upsert({
                where: { key: 'trash_retention_days' },
                update: { value: String(retentionDays) },
                create: { key: 'trash_retention_days', value: String(retentionDays) }
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

// POST /api/admin/settings/sound
// Admin only
router.post('/sound', authenticateToken, upload.single('sound'), async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // Validate MIME type (MP3)
    // audio/mpeg is standard for MP3.
    const allowedMimeTypes = ['audio/mpeg', 'audio/mp3'];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
        if (req.file.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({ error: 'Invalid file type. Only MP3 allowed.' });
    }

    try {
        await prisma.systemSetting.upsert({
            where: { key: 'notification_sound' },
            update: { value: req.file.filename },
            create: { key: 'notification_sound', value: req.file.filename }
        });
        res.json({ notificationSoundUrl: `/api/media/system/${req.file.filename}` });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to update sound' });
    }
});

// GET /api/admin/settings/retention
router.get('/retention', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    try {
        const setting = await prisma.systemSetting.findUnique({ where: { key: 'trash_retention_days' } });
        res.json({ retentionDays: setting ? setting.value : '7' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to fetch retention settings' });
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

// GET /api/admin/settings/storage
router.get('/storage', authenticateToken, async (req, res) => {
    // Optional: Allow non-admins to read this if we use it for generic UI limits,
    // but typically users only care about their OWN limit (which is already in /auth/me).
    // Admin dashboard definitely needs it.
    // If we want Sidebar to show "Global Limit" when no specific limit is set, we can either:
    // 1. Fetch it here (if user has access).
    // 2. Or just rely on the fallback logic in Sidebar (which is currently hardcoded).
    // Let's allow authenticated users to read it to keep Sidebar accurate.

    try {
        const teamLimitSetting = await prisma.systemSetting.findUnique({ where: { key: 'storage_limit_team' } });
        const userLimitSetting = await prisma.systemSetting.findUnique({ where: { key: 'storage_limit_user' } });

        // Defaults in bytes
        const defaults = {
            teamLimit: 25 * 1024 * 1024 * 1024,
            userLimit: 10 * 1024 * 1024 * 1024
        };

        res.json({
            teamLimit: teamLimitSetting ? teamLimitSetting.value : defaults.teamLimit.toString(),
            userLimit: userLimitSetting ? userLimitSetting.value : defaults.userLimit.toString()
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to fetch storage settings' });
    }
});

// PATCH /api/admin/settings/storage
router.patch('/storage', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const { userLimit, teamLimit } = req.body; // Expecting bytes as numbers or strings

    try {
        const updates = [];
        if (userLimit !== undefined) {
             updates.push(prisma.systemSetting.upsert({
                where: { key: 'storage_limit_user' },
                update: { value: String(userLimit) },
                create: { key: 'storage_limit_user', value: String(userLimit) }
            }));
        }
        if (teamLimit !== undefined) {
             updates.push(prisma.systemSetting.upsert({
                where: { key: 'storage_limit_team' },
                update: { value: String(teamLimit) },
                create: { key: 'storage_limit_team', value: String(teamLimit) }
            }));
        }

        await prisma.$transaction(updates);
        res.json({ message: 'Storage settings updated' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to update storage settings' });
    }
});

// POST /api/admin/storage/recalculate
router.post('/storage/recalculate', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    try {
        await recalculateAllStorage();
        res.json({ message: 'Storage recalculation started/completed' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to recalculate storage' });
    }
});

module.exports = router;
