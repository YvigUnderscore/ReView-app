const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('./middleware');
const { generateThumbnail } = require('./utils/thumbnail');
const { isValidVideoFile, isValidImageFile, isValidThreeDFile, isValidZipFile, isValidText, isValidImageBuffer } = require('./utils/validation');
const { generatePDF, generateCSV } = require('./utils/export');
const { getVideoMetadata } = require('./utils/metadata');
const { checkProjectAccess, checkCommentAccess } = require('./utils/authCheck');
const { checkQuota, updateStorage } = require('./utils/storage');
const ffmpeg = require('fluent-ffmpeg');
const AdmZip = require('adm-zip');
const { createAndBroadcast } = require('./services/notificationService');
const { getIo } = require('./services/socketService');

const router = express.Router();

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}
const prisma = new PrismaClient();

// Configure Multer
const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, 'storage');
const UPLOAD_DIR = path.join(DATA_PATH, 'media');
const THUMBNAIL_DIR = path.join(DATA_PATH, 'thumbnails');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(THUMBNAIL_DIR)) {
  fs.mkdirSync(THUMBNAIL_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'thumbnail') {
      cb(null, THUMBNAIL_DIR);
    } else {
      cb(null, UPLOAD_DIR);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = crypto.randomUUID();
    const ext = path.extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, '');
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({ storage: storage });

const commentUpload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Helper to calculate next version name
const getNextVersionName = async (projectId) => {
  const videoCount = await prisma.video.count({ where: { projectId } });
  const imageBundleCount = await prisma.imageBundle.count({ where: { projectId } });
  const threeDCount = await prisma.threeDAsset.count({ where: { projectId } });
  const nextNum = videoCount + imageBundleCount + threeDCount + 1;
  return `V${nextNum.toString().padStart(2, '0')}`;
};

const getFrameRate = (filePath) => {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error('Error getting framerate:', err);
        return resolve(24.0); // Default fallback
      }
      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      if (videoStream && videoStream.r_frame_rate) {
        const parts = videoStream.r_frame_rate.split('/');
        if (parts.length === 2) {
          const fps = parseFloat(parts[0]) / parseFloat(parts[1]);
          if (!isNaN(fps) && fps > 0) return resolve(fps);
        }
      }
      resolve(24.0);
    });
  });
};

// GET /projects/trash: List deleted projects
router.get('/trash', authenticateToken, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: {
                teams: { select: { id: true } },
                ownedTeams: { select: { id: true } }
            }
        });

        if (!user) return res.status(401).json({ error: 'User not found' });

        const userTeamIds = [...user.teams.map(t => t.id), ...user.ownedTeams.map(t => t.id)];
        const uniqueTeamIds = [...new Set(userTeamIds)];

        const where = {
            deletedAt: { not: null }
        };

        if (user.role !== 'admin') {
            where.OR = [
                { teamId: { in: uniqueTeamIds } },
                { teamId: null } // Assuming user can't see others' null-team projects unless admin, but schema enforces admin for null team
            ];
            // Fix logic: If regular user, they only see projects in their teams.
            // Admin sees all trash.
        }

        const projects = await prisma.project.findMany({
            where: where,
            include: {
                 team: { select: { name: true } }
            },
            orderBy: { deletedAt: 'desc' }
        });

        res.json(projects);
    } catch (error) {
        console.error('Error fetching trash:', error);
        res.status(500).json({ error: 'Failed to fetch trash' });
    }
});

// GET /projects: List all projects
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        teams: { select: { id: true } },
        ownedTeams: { select: { id: true } }
      }
    });

    if (!user) {
        return res.status(401).json({ error: 'User not found' });
    }

    const userTeamIds = [...user.teams.map(t => t.id), ...user.ownedTeams.map(t => t.id)];
    const uniqueTeamIds = [...new Set(userTeamIds)];

    if (uniqueTeamIds.length === 0 && user.role !== 'admin') {
      return res.json([]);
    }

    const where = {};
    if (user.role === 'admin') {
        // Admin sees all
    } else {
        where.OR = [
            { teamId: { in: uniqueTeamIds } },
            { teamId: null }
        ];
    }

    // Filter out deleted projects
    where.deletedAt = null;

    const projects = await prisma.project.findMany({
      where: where,
      include: {
        videos: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        },
        imageBundles: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            include: { images: { take: 1, orderBy: { order: 'asc' } } }
        },
        threeDAssets: {
            take: 1,
            orderBy: { createdAt: 'desc' }
        },
        team: {
          select: { id: true, name: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// GET /projects/slug/:teamSlug/:projectSlug: Get full project details by slug
router.get('/slug/:teamSlug/:projectSlug', authenticateToken, async (req, res) => {
    try {
        const { teamSlug, projectSlug } = req.params;

        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: { teams: { select: { id: true, slug: true } }, ownedTeams: { select: { id: true, slug: true } } }
        });

        if (!user) return res.status(401).json({ error: 'User not found' });

        const userTeams = [...user.teams, ...user.ownedTeams];

        // Find team by slug to verify access
        const team = await prisma.team.findUnique({ where: { slug: teamSlug } });
        if (!team) return res.status(404).json({ error: 'Team not found' });

        // Access check
        const hasAccess = user.role === 'admin' || userTeams.some(t => t.id === team.id);
        if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

        const basicProject = await prisma.project.findFirst({
            where: {
                slug: projectSlug,
                teamId: team.id
            },
            include: { mutedBy: { select: { id: true } } }
        });

        if (!basicProject) return res.status(404).json({ error: 'Project not found' });

        // Delegate to fetchFullProject logic (reused)
        const project = await fetchFullProject(basicProject.id, req.user.id, basicProject.teamId);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const projectWithVersions = {
            ...project,
            // Re-map versions as before
            versions: [
                ...project.videos.map(v => ({ ...v, type: 'video' })),
                ...project.imageBundles.map(b => ({ ...b, type: 'image_bundle' })),
                ...project.threeDAssets.map(a => ({ ...a, type: 'three_d_asset' }))
            ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
            isMuted: basicProject.mutedBy.some(u => u.id === req.user.id)
        };

        res.json(projectWithVersions);

    } catch (error) {
        console.error('Error fetching project by slug:', error);
        res.status(500).json({ error: 'Failed to fetch project' });
    }
});

// Reuseable fetch function
async function fetchFullProject(projectId, userId, teamId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        videos: {
          include: {
            comments: {
              where: { parentId: null },
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    role: true,
                    avatarPath: true,
                    teamRoles: true
                  }
                },
                reactions: true,
                replies: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        name: true,
                        role: true,
                        avatarPath: true,
                        teamRoles: true
                      }
                    },
                    reactions: true
                  }
                }
              },
              orderBy: { timestamp: 'asc' }
            }
          },
        },
        imageBundles: {
            include: {
                images: {
                    orderBy: { order: 'asc' },
                    include: {
                        comments: {
                            where: { parentId: null },
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        name: true,
                                        role: true,
                                        avatarPath: true,
                                        teamRoles: true
                                    }
                                },
                                reactions: true,
                                replies: {
                                    include: {
                                        user: {
                                            select: {
                                                id: true,
                                                name: true,
                                                role: true,
                                                avatarPath: true,
                                                teamRoles: true
                                            }
                                        },
                                        reactions: true
                                    }
                                }
                            },
                            orderBy: { createdAt: 'desc' }
                        }
                    }
                }
            }
        },
        threeDAssets: {
            include: {
                comments: {
                    where: { parentId: null },
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                role: true,
                                avatarPath: true,
                                teamRoles: true
                            }
                        },
                        reactions: true,
                        replies: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        name: true,
                                        role: true,
                                        avatarPath: true,
                                        teamRoles: true
                                    }
                                },
                                reactions: true
                            }
                        }
                    },
                    orderBy: { createdAt: 'desc' }
                }
            }
        },
        team: {
          include: {
            members: {
              select: {
                id: true,
                name: true,
                avatarPath: true,
                teamRoles: true
              }
            },
            roles: true
          }
        }
      }
    });

    if (project) {
        // Filter roles logic (copied from original)
        const filterRoles = (user) => {
            if (user && user.teamRoles) {
                user.teamRoles = user.teamRoles.filter(role => role.teamId === teamId);
            }
        };
        // Apply filter
        if (project.videos) project.videos.forEach(v => v.comments?.forEach(c => { filterRoles(c.user); c.replies?.forEach(r => filterRoles(r.user)); }));
        if (project.imageBundles) project.imageBundles.forEach(ib => ib.images?.forEach(img => img.comments?.forEach(c => { filterRoles(c.user); c.replies?.forEach(r => filterRoles(r.user)); })));
        if (project.threeDAssets) project.threeDAssets.forEach(a => a.comments?.forEach(c => { filterRoles(c.user); c.replies?.forEach(r => filterRoles(r.user)); }));
        if (project.team?.members) project.team.members.forEach(m => filterRoles(m));
    }

    return project;
}

// GET /projects/:id: Get full project details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) return res.status(400).json({ error: 'Invalid project ID' });

    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { teams: { select: { id: true } }, ownedTeams: { select: { id: true } } }
    });

    if (!user) {
        return res.status(401).json({ error: 'User not found' });
    }

    const userTeamIds = [...user.teams.map(t => t.id), ...user.ownedTeams.map(t => t.id)];

    // Fetch basic project info first to check access and optimize subsequent query
    const basicProject = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
          mutedBy: { select: { id: true } }
      }
    });

    if (!basicProject) return res.status(404).json({ error: 'Project not found' });

    if (user.role !== 'admin' && (!basicProject.teamId || !userTeamIds.includes(basicProject.teamId))) {
        return res.status(403).json({ error: 'Access denied' });
    }

    const project = await fetchFullProject(projectId, req.user.id, basicProject.teamId);

    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Merge and sort versions
    const allVersions = [
        ...project.videos.map(v => ({ ...v, type: 'video' })),
        ...project.imageBundles.map(b => ({ ...b, type: 'image_bundle' })),
        ...project.threeDAssets.map(a => ({ ...a, type: 'three_d_asset' }))
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // We attach sorted versions to the response object instead of raw videos/imageBundles
    // But to keep API consistent, we can just return the raw data and let frontend sort,
    // or return a 'versions' field.
    // Frontend expects 'videos' array usually. Let's add 'versions' field.
    const projectWithVersions = {
        ...project,
        versions: allVersions,
        isMuted: basicProject.mutedBy.some(u => u.id === req.user.id)
    };

    res.json(projectWithVersions);
  } catch (error) {
    console.error(`Error fetching project ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// POST /projects: Create new project
router.post('/', authenticateToken, upload.fields([{ name: 'file', maxCount: 1 }, { name: 'images', maxCount: 50 }, { name: 'thumbnail', maxCount: 1 }]), async (req, res) => {
  const videoFile = req.files.file ? req.files.file[0] : null;
  const imageFiles = req.files.images || [];
  const thumbnailFile = req.files.thumbnail ? req.files.thumbnail[0] : null;

  // Calculate total size for quota check
  let totalSize = 0;
  if (videoFile) totalSize += videoFile.size;
  if (imageFiles) imageFiles.forEach(f => totalSize += f.size);
  // Thumbnails usually small, but let's be strict if we want
  // if (thumbnailFile) totalSize += thumbnailFile.size;

  // Check for 3D file (treated as 'file' but validated as GLB/FBX/USD if extension matches)
  let isThreeD = false;
  let isZip = false;
  if (videoFile) {
      const ext = path.extname(videoFile.originalname).toLowerCase();
      const valid3DExtensions = ['.glb', '.fbx', '.usd', '.usdz', '.usda', '.usdc'];

      if (valid3DExtensions.includes(ext)) {
          isThreeD = true;
      } else if (ext === '.zip') {
          isThreeD = true;
          isZip = true;
      }
  }

  if (!videoFile && imageFiles.length === 0) {
      return res.status(400).json({ error: 'File or images are required' });
  }

  if (isThreeD) {
      if (isZip) {
          if (!isValidZipFile(videoFile.path)) {
            try { fs.unlinkSync(videoFile.path); } catch(e) {}
            if (thumbnailFile) try { fs.unlinkSync(thumbnailFile.path); } catch(e) {}
            return res.status(400).json({ error: 'Invalid ZIP file format' });
          }
      } else {
          if (!isValidThreeDFile(videoFile.path)) {
              try { fs.unlinkSync(videoFile.path); } catch(e) {}
              if (thumbnailFile) try { fs.unlinkSync(thumbnailFile.path); } catch(e) {}
              return res.status(400).json({ error: 'Invalid 3D file format' });
          }
      }
  } else if (videoFile) {
      // Validate Video
      if (!isValidVideoFile(videoFile.path)) {
          try { fs.unlinkSync(videoFile.path); } catch(e) {}
          if (thumbnailFile) try { fs.unlinkSync(thumbnailFile.path); } catch(e) {}
          return res.status(400).json({ error: 'Invalid video file format' });
      }
  }

  // Validate Images
  for (const img of imageFiles) {
      if (!isValidImageFile(img.path)) {
           // Cleanup all uploaded files
           if (videoFile) try { fs.unlinkSync(videoFile.path); } catch(e) {}
           imageFiles.forEach(f => { try { fs.unlinkSync(f.path); } catch(e) {} });
           if (thumbnailFile) try { fs.unlinkSync(thumbnailFile.path); } catch(e) {}
           return res.status(400).json({ error: `Invalid image file format: ${img.originalname}` });
      }
  }

  if (thumbnailFile && !isValidImageFile(thumbnailFile.path)) {
       if (videoFile) try { fs.unlinkSync(videoFile.path); } catch(e) {}
       imageFiles.forEach(f => { try { fs.unlinkSync(f.path); } catch(e) {} });
       try { fs.unlinkSync(thumbnailFile.path); } catch(e) {}
      return res.status(400).json({ error: 'Invalid thumbnail file format' });
  }

  const { name, description, teamId } = req.body;

  // Input Validation
  if (!isValidText(name, 100)) return res.status(400).json({ error: 'Project name exceeds 100 characters' });
  if (!isValidText(description, 2000)) return res.status(400).json({ error: 'Project description exceeds 2000 characters' });

  if (!teamId && req.user.role !== 'admin') {
      return res.status(400).json({ error: 'Team ID is required' });
  }

  try {
    const parsedTeamId = teamId ? parseInt(teamId) : null;

    // Check Quota
    try {
        await checkQuota({
            userId: req.user.id,
            teamId: parsedTeamId,
            fileSize: totalSize
        });
    } catch (e) {
        if (videoFile) try { fs.unlinkSync(videoFile.path); } catch(err) {}
        if (thumbnailFile) try { fs.unlinkSync(thumbnailFile.path); } catch(err) {}
        imageFiles.forEach(f => { try { fs.unlinkSync(f.path); } catch(err) {} });
        return res.status(403).json({ error: e.message });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        teams: { select: { id: true } },
        ownedTeams: { select: { id: true } }
      }
    });

    if (!user) {
        try { fs.unlinkSync(videoFile.path); } catch(e) {}
        if (thumbnailFile) try { fs.unlinkSync(thumbnailFile.path); } catch(e) {}
        return res.status(401).json({ error: 'User not found' });
    }

    const userTeamIds = [...user.teams.map(t => t.id), ...user.ownedTeams.map(t => t.id)];

    if (user.role !== 'admin') {
        if (!teamId || !userTeamIds.includes(parseInt(teamId))) {
            return res.status(403).json({ error: 'You must be a member of the team to create projects.' });
        }
    }

    let baseSlug = slugify(name);
    if (!baseSlug) baseSlug = `project-${Date.now()}`;
    let slug = baseSlug;
    let counter = 1;

    // Uniqueness within team
    if (parsedTeamId) {
        while (true) {
            const existing = await prisma.project.findFirst({
                where: {
                    teamId: parsedTeamId,
                    slug: slug
                }
            });
            if (!existing) break;
            slug = `${baseSlug}-${counter}`;
            counter++;
        }
    } else {
        // Admin project (no team)
        // Ensure uniqueness even for null teamId to prevent confusion
        while (true) {
            const existing = await prisma.project.findFirst({
                where: {
                    teamId: null,
                    slug: slug
                }
            });
            if (!existing) break;
            slug = `${baseSlug}-${counter}`;
            counter++;
        }
    }

    let thumbnailPath = null;
    let hasCustomThumbnail = false;

    if (thumbnailFile) {
        thumbnailPath = thumbnailFile.filename;
        hasCustomThumbnail = true;
    } else if (videoFile && !isThreeD) {
        try {
            thumbnailPath = await generateThumbnail(videoFile.path, THUMBNAIL_DIR);
        } catch (e) {
            console.error("Failed to generate thumbnail", e);
        }
    } else if (imageFiles.length > 0) {
        // Use first image as thumbnail if none provided
        // We copy the image to thumbnails dir or just reference it?
        // Thumbnail path usually expects a file in storage/thumbnails
        // Let's copy the first image there
        const firstImg = imageFiles[0];
        const thumbName = `thumb-${firstImg.filename}`;
        const thumbDest = path.join(THUMBNAIL_DIR, thumbName);
        fs.copyFileSync(firstImg.path, thumbDest);
        thumbnailPath = thumbName;
    }

    let projectData = {
        name: name || 'Untitled Project',
        description: description || '',
        teamId: parsedTeamId,
        thumbnailPath,
        hasCustomThumbnail,
        slug
    };

    if (videoFile) {
        if (isThreeD) {
            let finalPath = videoFile.path;
            let finalFilename = videoFile.filename;
            let mimeType = 'model/gltf-binary'; // Default for GLB

            const ext = path.extname(videoFile.originalname).toLowerCase();
            if (ext === '.fbx') mimeType = 'application/octet-stream';
            else if (ext === '.usdz') mimeType = 'model/vnd.usdz+zip';
            else if (['.usd', '.usda', '.usdc'].includes(ext)) mimeType = 'model/usd';

            if (isZip) {
                // Extract ZIP
                try {
                    const zip = new AdmZip(videoFile.path);
                    const extractDir = path.join(UPLOAD_DIR, 'unpacked', path.parse(videoFile.filename).name);
                    fs.mkdirSync(extractDir, { recursive: true });

                    // Secure Extraction: Only extract allowlisted extensions
                    const zipEntries = zip.getEntries();
                    const SAFE_EXTENSIONS = ['.glb', '.gltf', '.bin', '.png', '.jpg', '.jpeg', '.webp'];

                    zipEntries.forEach(entry => {
                        if (!entry.isDirectory) {
                            const ext = path.extname(entry.entryName).toLowerCase();
                            if (SAFE_EXTENSIONS.includes(ext)) {
                                zip.extractEntryTo(entry, extractDir, true, true);
                            }
                        }
                    });

                    // Find GLB in extracted files
                    // We need to walk the directory to find the GLB
                    const findGlb = (dir) => {
                        const files = fs.readdirSync(dir);
                        for (const file of files) {
                            const fullPath = path.join(dir, file);
                            const stat = fs.statSync(fullPath);
                            if (stat.isDirectory()) {
                                const found = findGlb(fullPath);
                                if (found) return found;
                            } else if (file.toLowerCase().endsWith('.glb')) {
                                return fullPath;
                            }
                        }
                        return null;
                    };

                    const glbFullPath = findGlb(extractDir);
                    if (!glbFullPath) {
                         throw new Error('No GLB file found in ZIP');
                    }

                    // Calculate path relative to UPLOAD_DIR
                    finalFilename = path.relative(UPLOAD_DIR, glbFullPath);
                    finalPath = glbFullPath;
                    mimeType = 'model/gltf-binary'; // Extracted GLB

                    // Clean up the original ZIP file
                    try { fs.unlinkSync(videoFile.path); } catch(err) {}

                } catch (e) {
                    console.error('Error processing ZIP:', e);
                    try { fs.unlinkSync(videoFile.path); } catch(err) {}
                    if (thumbnailFile) try { fs.unlinkSync(thumbnailFile.path); } catch(err) {}

                    // Cleanup extracted directory if it exists
                    const extractDir = path.join(UPLOAD_DIR, 'unpacked', path.parse(videoFile.filename).name);
                    try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch(err) {}

                    return res.status(400).json({ error: 'Failed to process ZIP file: ' + e.message });
                }
            }

            projectData.threeDAssets = {
                create: {
                    filename: finalFilename, // Relative path for serving
                    originalName: videoFile.originalname,
                    mimeType: mimeType,
                    path: finalPath, // Absolute path
                    versionName: 'V01',
                    size: BigInt(videoFile.size), // Note: if extracted from ZIP, this might be slightly diff, but using upload size is safer for quota
                    uploaderId: req.user.id
                }
            };
        } else {
            const frameRate = await getFrameRate(videoFile.path);
            projectData.videos = {
                create: {
                    filename: videoFile.filename,
                    originalName: videoFile.originalname,
                    mimeType: videoFile.mimetype,
                    path: videoFile.path,
                    versionName: 'V01',
                    frameRate,
                    size: BigInt(videoFile.size),
                    uploaderId: req.user.id
                }
            };
        }
    } else {
        projectData.imageBundles = {
            create: {
                versionName: 'V01',
                uploaderId: req.user.id,
                images: {
                    create: imageFiles.map((file, index) => ({
                        filename: file.filename,
                        originalName: file.originalname,
                        mimeType: file.mimetype,
                        path: file.path,
                        order: index,
                        size: BigInt(file.size)
                    }))
                }
            }
        };
    }

    const project = await prisma.project.create({
      data: projectData,
      include: { videos: true, imageBundles: { include: { images: true } }, threeDAssets: true }
    });

    // Update Storage Usage
    // Attribute to Team Storage AND User Storage
    if (parsedTeamId) {
        await updateStorage({ teamId: parsedTeamId, deltaBytes: totalSize });
    }
    // Update User Storage (Global Limit)
    await updateStorage({ userId: req.user.id, deltaBytes: totalSize });

    // Notification: PROJECT_CREATE
    if (parsedTeamId) {
        const team = await prisma.team.findUnique({
            where: { id: parsedTeamId },
            include: { members: { select: { id: true } }, owner: { select: { id: true } } }
        });

        const recipients = new Set();
        if (team) {
            if (team.ownerId !== req.user.id) recipients.add(team.ownerId);
            team.members.forEach(m => {
                if (m.id !== req.user.id) recipients.add(m.id);
            });
        }

        // Send Live Update to Team Members
        // We iterate and emit to each user's room
        const io = getIo();
        recipients.forEach(userId => {
             io.to(`user_${userId}`).emit('PROJECT_CREATE', project);
        });
        // Also emit to myself (the creator) so my list updates if I'm on multiple devices or tabs
        io.to(`user_${req.user.id}`).emit('PROJECT_CREATE', project);

        // Also emit to the project room (though newly created, no one is there yet, but for consistency)
        io.to(`project_${project.id}`).emit('PROJECT_CREATE', project);

            // Also emit to the project room (though newly created, no one is there yet, but for consistency)
            io.to(`project_${project.id}`).emit('PROJECT_CREATE', project);

        const videoId = project.videos.length > 0 ? project.videos[0].id : null;

        await createAndBroadcast(Array.from(recipients), {
            type: 'PROJECT_CREATE',
            content: `New project "${project.name}" created`,
            referenceId: project.id,
            projectId: project.id,
            videoId: videoId
        });
    }

    res.json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// POST /projects/:id/versions: Upload a new version (Video or Images)
router.post('/:id/versions', authenticateToken, upload.fields([{ name: 'file', maxCount: 1 }, { name: 'images', maxCount: 50 }]), async (req, res) => {
    const videoFile = req.files.file ? req.files.file[0] : null;
    const imageFiles = req.files.images || [];

    let totalSize = 0;
    if (videoFile) totalSize += videoFile.size;
    if (imageFiles) imageFiles.forEach(f => totalSize += f.size);

    // Check for 3D
    let isThreeD = false;
    let isZip = false;
    if (videoFile) {
        const ext = path.extname(videoFile.originalname).toLowerCase();
        const valid3DExtensions = ['.glb', '.fbx', '.usd', '.usdz', '.usda', '.usdc'];

        if (valid3DExtensions.includes(ext)) {
            isThreeD = true;
        } else if (ext === '.zip') {
            isThreeD = true;
            isZip = true;
        }
    }

    if (!videoFile && imageFiles.length === 0) {
        return res.status(400).json({ error: 'File is required' });
    }

    if (isThreeD) {
        if (isZip) {
            if (!isValidZipFile(videoFile.path)) {
                try { fs.unlinkSync(videoFile.path); } catch(e) {}
                return res.status(400).json({ error: 'Invalid ZIP file format' });
            }
        } else {
            if (!isValidThreeDFile(videoFile.path)) {
                try { fs.unlinkSync(videoFile.path); } catch(e) {}
                return res.status(400).json({ error: 'Invalid 3D file format' });
            }
        }
    } else if (videoFile) {
        if (!isValidVideoFile(videoFile.path)) {
            try { fs.unlinkSync(videoFile.path); } catch(e) {}
            return res.status(400).json({ error: 'Invalid video file format' });
        }
    }

    for (const img of imageFiles) {
        if (!isValidImageFile(img.path)) {
             if (videoFile) try { fs.unlinkSync(videoFile.path); } catch(e) {}
             imageFiles.forEach(f => { try { fs.unlinkSync(f.path); } catch(e) {} });
             return res.status(400).json({ error: 'Invalid image file format' });
        }
    }

    const projectId = parseInt(req.params.id);

    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user) {
             if (videoFile) try { fs.unlinkSync(videoFile.path); } catch(e) {}
             imageFiles.forEach(f => { try { fs.unlinkSync(f.path); } catch(e) {} });
             return res.status(401).json({ error: 'User not found' });
        }
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) return res.status(404).json({ error: 'Project not found' });

        // Quota Check
        if (project.teamId) {
            try {
                 await checkQuota({ userId: req.user.id, teamId: project.teamId, fileSize: totalSize });
            } catch (e) {
                 if (videoFile) try { fs.unlinkSync(videoFile.path); } catch(err) {}
                 imageFiles.forEach(f => { try { fs.unlinkSync(f.path); } catch(err) {} });
                 return res.status(403).json({ error: e.message });
            }
        }

        if (user.role !== 'admin' && project.teamId !== user.teamId) { // NOTE: User model doesn't have teamId, this check looks suspicious in original code, but we keep logic consistent or fix it.
            // Original code: if (user.role !== 'admin' && project.teamId !== user.teamId)
            // But User has many teams. Logic was probably flawed or relying on legacy field.
            // Let's assume strict check: user must belong to project.teamId.
            const isMember = await prisma.team.findFirst({
                where: {
                    id: project.teamId,
                    OR: [
                        { members: { some: { id: user.id } } },
                        { ownerId: user.id }
                    ]
                }
            });
            if (!isMember && user.role !== 'admin') {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        const versionName = await getNextVersionName(projectId);

        if (!project.hasCustomThumbnail) {
            if (videoFile && !isThreeD) {
                try {
                    const newThumb = await generateThumbnail(videoFile.path, THUMBNAIL_DIR);
                    await prisma.project.update({
                        where: { id: projectId },
                        data: { thumbnailPath: newThumb }
                    });
                } catch (e) {
                    console.error("Failed to generate thumbnail for new version", e);
                }
            } else if (imageFiles.length > 0) {
                 const firstImg = imageFiles[0];
                 const thumbName = `thumb-${firstImg.filename}`;
                 const thumbDest = path.join(THUMBNAIL_DIR, thumbName);
                 try {
                     fs.copyFileSync(firstImg.path, thumbDest);
                     await prisma.project.update({
                         where: { id: projectId },
                         data: { thumbnailPath: thumbName }
                     });
                 } catch (e) {
                     console.error("Failed to set thumbnail from image", e);
                 }
            }
        }

        let newVersion;

        if (videoFile) {
            if (isThreeD) {
                let finalPath = videoFile.path;
                let finalFilename = videoFile.filename;
                let mimeType = 'model/gltf-binary'; // Default for GLB

                const ext = path.extname(videoFile.originalname).toLowerCase();
                if (ext === '.fbx') mimeType = 'application/octet-stream';
                else if (ext === '.usdz') mimeType = 'model/vnd.usdz+zip';
                else if (['.usd', '.usda', '.usdc'].includes(ext)) mimeType = 'model/usd';

                if (isZip) {
                    try {
                        const zip = new AdmZip(videoFile.path);
                        const extractDir = path.join(UPLOAD_DIR, 'unpacked', path.parse(videoFile.filename).name);
                        fs.mkdirSync(extractDir, { recursive: true });

                        // Secure Extraction: Only extract allowlisted extensions
                        const zipEntries = zip.getEntries();
                        const SAFE_EXTENSIONS = ['.glb', '.gltf', '.bin', '.png', '.jpg', '.jpeg', '.webp'];

                        zipEntries.forEach(entry => {
                            if (!entry.isDirectory) {
                                const ext = path.extname(entry.entryName).toLowerCase();
                                if (SAFE_EXTENSIONS.includes(ext)) {
                                    zip.extractEntryTo(entry, extractDir, true, true);
                                }
                            }
                        });

                        const findGlb = (dir) => {
                            const files = fs.readdirSync(dir);
                            for (const file of files) {
                                const fullPath = path.join(dir, file);
                                const stat = fs.statSync(fullPath);
                                if (stat.isDirectory()) {
                                    const found = findGlb(fullPath);
                                    if (found) return found;
                                } else if (file.toLowerCase().endsWith('.glb')) {
                                    return fullPath;
                                }
                            }
                            return null;
                        };

                        const glbFullPath = findGlb(extractDir);
                        if (!glbFullPath) {
                             throw new Error('No GLB file found in ZIP');
                        }

                        finalFilename = path.relative(UPLOAD_DIR, glbFullPath);
                        finalPath = glbFullPath;
                        mimeType = 'model/gltf-binary'; // Extracted GLB

                        // Clean up the original ZIP file
                        try { fs.unlinkSync(videoFile.path); } catch(err) {}

                    } catch (e) {
                        console.error('Error processing ZIP:', e);
                        try { fs.unlinkSync(videoFile.path); } catch(err) {}
                        // Cleanup extracted directory if it exists
                        const extractDir = path.join(UPLOAD_DIR, 'unpacked', path.parse(videoFile.filename).name);
                        try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch(err) {}

                        return res.status(400).json({ error: 'Failed to process ZIP file: ' + e.message });
                    }
                }

                newVersion = await prisma.threeDAsset.create({
                    data: {
                        projectId,
                        filename: finalFilename,
                        originalName: videoFile.originalname,
                        mimeType: mimeType,
                        path: finalPath,
                        versionName,
                        size: BigInt(videoFile.size),
                        uploaderId: req.user.id
                    }
                });
            } else {
                const frameRate = await getFrameRate(videoFile.path);
                newVersion = await prisma.video.create({
                    data: {
                        projectId,
                        filename: videoFile.filename,
                        originalName: videoFile.originalname,
                        mimeType: videoFile.mimetype,
                        path: videoFile.path,
                        versionName,
                        frameRate,
                        size: BigInt(videoFile.size),
                        uploaderId: req.user.id
                    }
                });
            }
        } else {
             newVersion = await prisma.imageBundle.create({
                data: {
                    projectId,
                    versionName,
                    uploaderId: req.user.id,
                    images: {
                        create: imageFiles.map((file, index) => ({
                            filename: file.filename,
                            originalName: file.originalname,
                            mimeType: file.mimetype,
                            path: file.path,
                            order: index,
                            size: BigInt(file.size)
                        }))
                    }
                },
                include: { images: true }
            });
        }

        await prisma.project.update({
            where: { id: projectId },
            data: { updatedAt: new Date() }
        });

        // Update Storage (Team + User)
        if (project.teamId) {
            await updateStorage({ teamId: project.teamId, deltaBytes: totalSize });
        }
        await updateStorage({ userId: req.user.id, deltaBytes: totalSize });

        // Broadcast to Project Room
        const io = getIo();
        io.to(`project_${projectId}`).emit('VERSION_ADDED', { projectId, version: newVersion });

        // Notification: VIDEO_VERSION (Generalized for version)
        if (project.teamId) {
            const team = await prisma.team.findUnique({
                where: { id: project.teamId },
                include: { members: { select: { id: true } }, owner: { select: { id: true } } }
            });

            const recipients = new Set();
            if (team) {
                if (team.ownerId !== req.user.id) recipients.add(team.ownerId);
                team.members.forEach(m => {
                    if (m.id !== req.user.id) recipients.add(m.id);
                });
            }

            await createAndBroadcast(Array.from(recipients), {
                type: 'VIDEO_VERSION',
                content: `New version ${versionName} uploaded to "${project.name}"`,
                referenceId: newVersion.id,
                projectId: projectId,
                videoId: (videoFile && !isThreeD) ? newVersion.id : null
            });
        }

        res.json(newVersion);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to upload version' });
    }
});

// POST /projects/:id/comments: Add comment (Video or Image)
router.post('/:id/comments', authenticateToken, commentUpload.single('attachment'), async (req, res) => {
  const { content, timestamp, annotation, parentId, duration, assigneeId, videoId, imageId, threeDAssetId, cameraState, screenshot } = req.body;
  const attachmentFile = req.file;

  // Calculate sizes for quota
  let totalSize = 0;
  if (attachmentFile) totalSize += attachmentFile.size;
  // Screenshot is base64 string, length is approx size in chars (bytes? Base64 is ~1.33x larger than binary)
  // But we store binary. We will calculate binary size.
  // We do it below in matches.

  // Input Validation
  if (!isValidText(content, 5000)) {
      if (attachmentFile) try { fs.unlinkSync(attachmentFile.path); } catch(e) {}
      return res.status(400).json({ error: 'Comment content exceeds 5000 characters' });
  }

  // Validate attachment if present
  let attachmentPath = null;
  if (attachmentFile) {
      if (!isValidImageFile(attachmentFile.path)) {
          try { fs.unlinkSync(attachmentFile.path); } catch(e) {}
          return res.status(400).json({ error: 'Invalid attachment file format' });
      }
      attachmentPath = attachmentFile.filename;
  }

  const projectId = parseInt(req.params.id);

  // Security: Check if user has access to the project
  const access = await checkProjectAccess(req.user, projectId);
  if (!access.authorized) {
      if (attachmentFile) try { fs.unlinkSync(attachmentFile.path); } catch(e) {}
      return res.status(access.status).json({ error: access.error });
  }

  try {
    let screenshotPath = null;
    let screenshotSize = 0;

    if (screenshot) {
        const matches = screenshot.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
            const buffer = Buffer.from(matches[2], 'base64');
            screenshotSize = buffer.length;
            totalSize += screenshotSize;

            // Security: Validate buffer size (Max 5MB)
            if (buffer.length > 5 * 1024 * 1024) {
                 if (attachmentFile) try { fs.unlinkSync(attachmentFile.path); } catch(e) {}
                 return res.status(400).json({ error: 'Screenshot too large (max 5MB)' });
            }

            // Check Quota (User's quota for comments/attachments)
            if (totalSize > 0) {
                try {
                    await checkQuota({
                        userId: req.user.id,
                        teamId: null, // Comments count towards USER quota, not Team (as per discussion/plan)
                        fileSize: totalSize
                    });
                } catch(e) {
                     if (attachmentFile) try { fs.unlinkSync(attachmentFile.path); } catch(err) {}
                     return res.status(403).json({ error: e.message });
                }
            }

            // Security: Validate image content (Magic numbers)
            if (!isValidImageBuffer(buffer)) {
                 if (attachmentFile) try { fs.unlinkSync(attachmentFile.path); } catch(e) {}
                 return res.status(400).json({ error: 'Invalid screenshot file format' });
            }

            const filename = `shot-${crypto.randomUUID()}.jpg`;
            const commentsDir = path.join(DATA_PATH, 'comments');
            const filepath = path.join(commentsDir, filename);
            if (!fs.existsSync(commentsDir)) fs.mkdirSync(commentsDir, { recursive: true });
            fs.writeFileSync(filepath, buffer);
            screenshotPath = filename;
        }
    } else if (totalSize > 0) {
        // Check Quota for attachment only (if no screenshot)
        try {
            await checkQuota({ userId: req.user.id, teamId: null, fileSize: totalSize });
        } catch(e) {
             if (attachmentFile) try { fs.unlinkSync(attachmentFile.path); } catch(err) {}
             return res.status(403).json({ error: e.message });
        }
    }

    // Prepare data
    // Handle JSON stringified fields if coming from FormData (they might be strings already)
    const parseJSONIfNeeded = (val) => {
        if (typeof val === 'string') {
             try {
                 // Check if it looks like JSON? Or just return it if Prisma expects string?
                 // Prisma expects String for annotation/cameraState.
                 // But we want to ensure we store consistent format.
                 // If the client sends `"[...]"`, it is a string.
                 // If the client sends a JS object (via JSON body), `req.body` has object.
                 // `multer` populates `req.body` with strings for text fields.
                 // So `annotation` will be a string `"[{...}]"`.
                 // Current code: `annotation ? JSON.stringify(annotation) : null`
                 // If it is already a string, stringifying it again makes it `"\"[...]\""`.
                 // We should check type.
                 if (val.trim().startsWith('[') || val.trim().startsWith('{')) {
                     return val; // It's already a JSON string
                 }
                 return JSON.stringify(val); // It's something else?
             } catch (e) {
                 return val;
             }
        }
        return val ? JSON.stringify(val) : null;
    };

    const data = {
        content,
        timestamp: timestamp ? parseFloat(timestamp) : 0,
        duration: duration ? parseFloat(duration) : null,
        annotation: annotation ? (typeof annotation === 'string' ? annotation : JSON.stringify(annotation)) : null,
        userId: req.user.id,
        parentId: parentId ? parseInt(parentId) : null,
        assigneeId: assigneeId ? parseInt(assigneeId) : null,
        cameraState: cameraState ? (typeof cameraState === 'string' ? cameraState : JSON.stringify(cameraState)) : null,
        screenshotPath,
        attachmentPath,
        size: BigInt(totalSize)
    };

    if (videoId) data.videoId = parseInt(videoId);
    if (imageId) data.imageId = parseInt(imageId);
    if (threeDAssetId) data.threeDAssetId = parseInt(threeDAssetId);

    const comment = await prisma.comment.create({
      data: data,
      include: {
        user: { select: { id: true, name: true, avatarPath: true, teamRoles: true } },
        assignee: { select: { id: true, name: true } },
        replies: {
          include: {
            user: { select: { id: true, name: true, avatarPath: true, teamRoles: true } }
          }
        }
      }
    });

    if (totalSize > 0) {
        await updateStorage({ userId: req.user.id, teamId: null, deltaBytes: totalSize });
        // Also update Team storage if we wanted comments to count towards Team, but we stick to User Quota for comments
    }

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { mutedBy: { select: { id: true } } }
    });

    const mutedUserIds = new Set(project.mutedBy.map(u => u.id));

    // 1. Notify all team members (COMMENT)
    // Filter out author and muted users
    if (project && project.teamId) {
        const team = await prisma.team.findUnique({
            where: { id: project.teamId },
            include: { members: { select: { id: true } }, owner: { select: { id: true } } }
        });

        const recipients = new Set();
        if (team) {
            // Add owner
            recipients.add(team.ownerId);
            // Add members
            team.members.forEach(m => recipients.add(m.id));
        }

        // Live Comment Update (to everyone in team, including muted, excluding author maybe? or include author for sync)
        // Including author is good for multi-tab.
        const io = getIo();
        recipients.forEach(userId => {
             // Emit full comment object with projectId context
             io.to(`user_${userId}`).emit('COMMENT_ADDED', { ...comment, projectId });
        });

        // Also emit to Project Room (for Guests and focused views)
        io.to(`project_${projectId}`).emit('COMMENT_ADDED', { ...comment, projectId });

        const notifyIds = Array.from(recipients).filter(id => !mutedUserIds.has(id) && id !== req.user.id);

        if (notifyIds.length > 0) {
            await createAndBroadcast(notifyIds, {
                type: 'COMMENT',
                content: `New comment on ${project.name}`,
                referenceId: comment.id,
                projectId,
                videoId: videoId ? parseInt(videoId) : null
            });
        }
    }

    // Handle Mentions
    if (project && project.teamId && content && content.includes('@')) {
        const matches = content.match(/@([\w_\-]+)/g);
        if (matches) {
            const mentions = matches.map(m => m.substring(1).replace(/_/g, ' '));

            const mentionedUsers = await prisma.user.findMany({
                where: {
                    OR: [
                        { teams: { some: { id: project.teamId } } },
                        { ownedTeams: { some: { id: project.teamId } } }
                    ],
                    name: { in: mentions }
                }
            });

            const mentionedRoles = await prisma.teamRole.findMany({
                where: {
                    teamId: project.teamId,
                    name: { in: mentions }
                },
                include: { users: true }
            });

            const userIdsToNotify = new Set();
            mentionedUsers.forEach(u => userIdsToNotify.add(u.id));
            mentionedRoles.forEach(r => {
                r.users.forEach(u => userIdsToNotify.add(u.id));
            });

            // Remove author
            userIdsToNotify.delete(req.user.id);
            // Muted users SHOULD still get Mentions (usually high priority), but maybe not general comments?
            // Standard practice: Mentions override Mute.
            // So we do NOT filter by mutedUserIds here.

            await createAndBroadcast(Array.from(userIdsToNotify), {
                type: 'MENTION',
                content: `You were mentioned in a comment on ${project.name}`,
                referenceId: comment.id,
                projectId,
                videoId: videoId ? parseInt(videoId) : null
            });
        }
    }

    // Handle Replies
    if (parentId) {
        const parentComment = await prisma.comment.findUnique({ where: { id: parseInt(parentId) } });
        if (parentComment && parentComment.userId && parentComment.userId !== req.user.id) {
            // Check if already notified via mention?
            // The service doesn't check dupes across calls, but distinct types are fine.
            // Like Mentions, Replies often override mute settings or have their own preference.
            // We'll keep it sending.
            await createAndBroadcast([parentComment.userId], {
                type: 'REPLY',
                content: `New reply to your comment on ${project ? project.name : 'video'}`,
                referenceId: comment.id,
                projectId,
                videoId: videoId ? parseInt(videoId) : null
            });
        }
    }

    await prisma.project.update({
        where: { id: projectId },
        data: { updatedAt: new Date() }
    });

    res.json(comment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

// PATCH /projects/comments/:commentId: Update comment
router.patch('/comments/:commentId', authenticateToken, async (req, res) => {
    const { isResolved, isVisibleToClient, assigneeId } = req.body;
    const commentId = parseInt(req.params.commentId);

    // Security: Check if user has access to the project containing the comment
    const access = await checkCommentAccess(req.user, commentId);
    if (!access.authorized) return res.status(access.status).json({ error: access.error });

    try {
        const data = {};
        if (isResolved !== undefined) data.isResolved = isResolved;
        if (isVisibleToClient !== undefined) data.isVisibleToClient = isVisibleToClient;
        if (assigneeId !== undefined) data.assigneeId = assigneeId ? parseInt(assigneeId) : null;

        const comment = await prisma.comment.update({
            where: { id: commentId },
            data: data,
            include: {
                user: { select: { id: true, name: true, avatarPath: true } },
                assignee: { select: { id: true, name: true } }
            }
        });
        res.json(comment);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update comment' });
    }
});

// POST /projects/comments/:commentId/reactions: Toggle reaction
router.post('/comments/:commentId/reactions', authenticateToken, async (req, res) => {
    const { emoji, guestName } = req.body;
    const commentId = parseInt(req.params.commentId);

    if (!emoji) return res.status(400).json({ error: 'Emoji is required' });

    // Security check
    const access = await checkCommentAccess(req.user, commentId);
    if (!access.authorized) return res.status(access.status).json({ error: access.error });

    try {
        const existing = await prisma.reaction.findFirst({
            where: {
                commentId,
                emoji,
                userId: req.user.id
            }
        });

        if (existing) {
            // Remove (Toggle Off)
            await prisma.reaction.delete({ where: { id: existing.id } });
        } else {
            // Add (Toggle On)
            await prisma.reaction.create({
                data: {
                    commentId,
                    emoji,
                    userId: req.user.id,
                    guestName
                }
            });
        }

        const updatedComment = await prisma.comment.findUnique({
            where: { id: commentId },
            include: {
                user: { select: { id: true, name: true, avatarPath: true } },
                assignee: { select: { id: true, name: true } },
                reactions: true,
                replies: {
                    include: {
                        user: { select: { id: true, name: true, avatarPath: true } },
                        reactions: true
                    }
                }
            }
        });

        res.json(updatedComment);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to toggle reaction' });
    }
});

// GET /projects/:id/images/:imageId/export/:format
router.get('/:id/images/:imageId/export/:format', authenticateToken, async (req, res) => {
    const { id, imageId, format } = req.params;

    if (format === 'csv') {
        return res.status(400).send('CSV export disabled for images');
    }

    // Security: Check access
    const access = await checkProjectAccess(req.user, id);
    if (!access.authorized) return res.status(access.status).send(access.error);

    try {
        const project = access.project;
        // Fetch the bundle ID first from the requested image
        const requestedImage = await prisma.image.findUnique({ where: { id: parseInt(imageId) } });

        if (!requestedImage) return res.status(404).send('Not found');

        // Fetch the full bundle (all images in this version)
        const imageBundle = await prisma.imageBundle.findUnique({
            where: { id: requestedImage.bundleId },
            include: {
                images: {
                    orderBy: { order: 'asc' },
                    include: {
                        comments: {
                            where: { parentId: null }, // Only root comments
                            include: {
                                user: true,
                                assignee: true
                            },
                            orderBy: { createdAt: 'asc' }
                        }
                    }
                }
            }
        });

        if (!imageBundle) return res.status(404).send('Bundle not found');

        const dateFormatSetting = await prisma.systemSetting.findUnique({ where: { key: 'date_format' } });
        const dateFormat = dateFormatSetting ? dateFormatSetting.value : 'DD/MM/YYYY';
        const siteTitleSetting = await prisma.systemSetting.findUnique({ where: { key: 'site_title' } });
        const siteTitle = siteTitleSetting ? siteTitleSetting.value : 'ReView';

        const settings = { dateFormat, siteTitle };

        if (format === 'pdf') {
            // Pass the entire bundle object to generatePDF, instead of a single image
            await generatePDF(project, imageBundle, [], res, settings);
        } else {
            res.status(400).send('Invalid format');
        }
    } catch (e) {
        console.error("Export error", e);
        res.status(500).send("Export failed");
    }
});

// GET /projects/:id/3d/:threeDAssetId/export/:format
router.get('/:id/3d/:threeDAssetId/export/:format', authenticateToken, async (req, res) => {
    const { id, threeDAssetId, format } = req.params;

    if (format === 'csv') {
        return res.status(400).send('CSV export disabled for 3D assets');
    }

    // Security: Check access
    const access = await checkProjectAccess(req.user, id);
    if (!access.authorized) return res.status(access.status).send(access.error);

    try {
        const project = access.project;
        const asset = await prisma.threeDAsset.findUnique({ where: { id: parseInt(threeDAssetId) } });

        if (!asset) return res.status(404).send('Not found');

        const comments = await prisma.comment.findMany({
            where: { threeDAssetId: parseInt(threeDAssetId) },
            include: {
                user: true,
                assignee: true
            },
            orderBy: { createdAt: 'asc' }
        });

        const dateFormatSetting = await prisma.systemSetting.findUnique({ where: { key: 'date_format' } });
        const dateFormat = dateFormatSetting ? dateFormatSetting.value : 'DD/MM/YYYY';
        const siteTitleSetting = await prisma.systemSetting.findUnique({ where: { key: 'site_title' } });
        const siteTitle = siteTitleSetting ? siteTitleSetting.value : 'ReView';

        const settings = { dateFormat, siteTitle };

        if (format === 'pdf') {
            // Treat 3D asset as video/image hybrid for export (single item with comments)
            // Passing asset as the 'mediaObject'
            await generatePDF(project, asset, comments, res, settings);
        } else {
            res.status(400).send('Invalid format');
        }
    } catch (e) {
        console.error("Export error", e);
        res.status(500).send("Export failed");
    }
});

// GET /projects/:id/videos/:videoId/export/:format
router.get('/:id/videos/:videoId/export/:format', authenticateToken, async (req, res) => {
    const { id, videoId, format } = req.params;

    // Security: Check access
    const access = await checkProjectAccess(req.user, id);
    if (!access.authorized) return res.status(access.status).send(access.error);

    try {
        const project = access.project;
        const video = await prisma.video.findUnique({ where: { id: parseInt(videoId) } });

        if (!video) return res.status(404).send('Not found');

        // Fetch Metadata
        const metadata = await getVideoMetadata(video.path);
        const extendedVideo = { ...video, ...metadata };

        const comments = await prisma.comment.findMany({
            where: { videoId: parseInt(videoId) },
            include: {
                user: true,
                assignee: true
            },
            orderBy: { timestamp: 'asc' }
        });

        const dateFormatSetting = await prisma.systemSetting.findUnique({ where: { key: 'date_format' } });
        const dateFormat = dateFormatSetting ? dateFormatSetting.value : 'DD/MM/YYYY';
        const siteTitleSetting = await prisma.systemSetting.findUnique({ where: { key: 'site_title' } });
        const siteTitle = siteTitleSetting ? siteTitleSetting.value : 'ReView';

        const settings = { dateFormat, siteTitle };

        if (format === 'pdf') {
            await generatePDF(project, extendedVideo, comments, res, settings);
        } else if (format === 'csv') {
            await generateCSV(project, extendedVideo, comments, res, dateFormat);
        } else {
            res.status(400).send('Invalid format');
        }
    } catch (e) {
        console.error("Export error", e);
        res.status(500).send("Export failed");
    }
});

// PATCH /projects/:id: Update project details
router.patch('/:id', authenticateToken, upload.single('thumbnail'), async (req, res) => {
  const { name, description, status } = req.body;

  // Input Validation
  if (name !== undefined && !isValidText(name, 100)) return res.status(400).json({ error: 'Project name exceeds 100 characters' });
  if (description !== undefined && !isValidText(description, 2000)) return res.status(400).json({ error: 'Project description exceeds 2000 characters' });

  const projectId = parseInt(req.params.id);
  const thumbnailFile = req.file;

  if (thumbnailFile && !isValidImageFile(thumbnailFile.path)) {
    try { fs.unlinkSync(thumbnailFile.path); } catch(e) {}
    return res.status(400).json({ error: 'Invalid thumbnail file format' });
  }

  try {
    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { teams: { select: { id: true } }, ownedTeams: { select: { id: true } } }
    });

    if (!user) {
        if (thumbnailFile) try { fs.unlinkSync(thumbnailFile.path); } catch(e) {}
        return res.status(401).json({ error: 'User not found' });
    }

    const userTeamIds = [...user.teams.map(t => t.id), ...user.ownedTeams.map(t => t.id)];

    const project = await prisma.project.findUnique({ where: { id: projectId } });

    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (user.role !== 'admin' && (!project.teamId || !userTeamIds.includes(project.teamId))) {
        return res.status(403).json({ error: 'Access denied' });
    }

    const data = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;

    let statusChanged = false;
    if (status !== undefined) {
        data.status = status;
        if (status !== project.status) statusChanged = true;
        if (!project.clientToken) {
             data.clientToken = crypto.randomUUID();
        }
    }

    if (thumbnailFile) {
        data.thumbnailPath = thumbnailFile.filename;
        data.hasCustomThumbnail = true;
    }

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data
    });

    // Notification: STATUS_CHANGE & Real-time Update
    if (project.teamId) { // Check teamId for updates generally
        const team = await prisma.team.findUnique({
            where: { id: project.teamId },
            include: { members: { select: { id: true } }, owner: { select: { id: true } } }
        });

        const recipients = new Set();
        if (team) {
            recipients.add(team.ownerId); // Include owner
            team.members.forEach(m => recipients.add(m.id));
        }

        // Real-time Update
        const io = getIo();
        recipients.forEach(userId => {
             io.to(`user_${userId}`).emit('PROJECT_UPDATE', updatedProject);
        });

        io.to(`project_${updatedProject.id}`).emit('PROJECT_UPDATE', updatedProject);

        if (statusChanged) {
            // Filter out current user for notification
            const notifyRecipients = new Set(recipients);
            notifyRecipients.delete(req.user.id);

            await createAndBroadcast(Array.from(notifyRecipients), {
                type: 'STATUS_CHANGE',
                content: `Status changed to ${status} for "${updatedProject.name}"`,
                referenceId: updatedProject.id, // Using projectId as reference
                projectId: updatedProject.id
            });
        }
    }

    res.json(updatedProject);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// PATCH /videos/:id: Rename version
router.patch('/videos/:id', authenticateToken, async (req, res) => {
    const { versionName } = req.body;
    const videoId = parseInt(req.params.id);

    try {
        const video = await prisma.video.findUnique({
            where: { id: videoId },
            include: { project: true }
        });
        if (!video) return res.status(404).json({ error: 'Video not found' });

        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            include: { teams: { select: { id: true } }, ownedTeams: { select: { id: true } } }
        });

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        const userTeamIds = [...user.teams.map(t => t.id), ...user.ownedTeams.map(t => t.id)];

        if (user.role !== 'admin' && (!video.project.teamId || !userTeamIds.includes(video.project.teamId))) {
             return res.status(403).json({ error: 'Access denied' });
        }

        const updatedVideo = await prisma.video.update({
            where: { id: videoId },
            data: { versionName }
        });
        res.json(updatedVideo);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update video' });
    }
});

// DELETE /projects/:id: Soft Delete a project (Trash)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { teams: { select: { id: true } }, ownedTeams: { select: { id: true } } }
    });

    if (!user) {
        return res.status(401).json({ error: 'User not found' });
    }

    const userTeamIds = [...user.teams.map(t => t.id), ...user.ownedTeams.map(t => t.id)];

    const project = await prisma.project.findUnique({ where: { id: projectId } });

    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (user.role !== 'admin' && (!project.teamId || !userTeamIds.includes(project.teamId))) {
        return res.status(403).json({ error: 'Access denied' });
    }

    // Soft Delete
    await prisma.project.update({
        where: { id: projectId },
        data: { deletedAt: new Date() }
    });

    // Real-time Update (Trash)
    if (project.teamId) {
        const team = await prisma.team.findUnique({
            where: { id: project.teamId },
            include: { members: { select: { id: true } }, owner: { select: { id: true } } }
        });

        if (team) {
            const recipients = new Set();
            recipients.add(team.ownerId);
            team.members.forEach(m => recipients.add(m.id));

            const io = getIo();
            recipients.forEach(userId => {
                 // Emitting PROJECT_DELETE causes frontend to remove from list and fetch trash count
                 io.to(`user_${userId}`).emit('PROJECT_DELETE', { id: projectId });
            });
        }
    } else {
        // Admin personal project
        const io = getIo();
        io.to(`user_${req.user.id}`).emit('PROJECT_DELETE', { id: projectId });
    }

    res.json({ message: 'Project moved to trash' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// POST /projects/:id/restore: Restore a project from Trash
router.post('/:id/restore', authenticateToken, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { teams: { select: { id: true } }, ownedTeams: { select: { id: true } } }
    });

    if (!user) {
        return res.status(401).json({ error: 'User not found' });
    }

    const userTeamIds = [...user.teams.map(t => t.id), ...user.ownedTeams.map(t => t.id)];

    const project = await prisma.project.findUnique({ where: { id: projectId } });

    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (user.role !== 'admin' && (!project.teamId || !userTeamIds.includes(project.teamId))) {
        return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.project.update({
        where: { id: projectId },
        data: { deletedAt: null }
    });

    // Real-time Update (Restore)
    const restoredProject = await prisma.project.findUnique({ where: { id: projectId }, include: { team: true } });

    if (restoredProject.teamId) {
        const team = await prisma.team.findUnique({
            where: { id: restoredProject.teamId },
            include: { members: { select: { id: true } }, owner: { select: { id: true } } }
        });

        if (team) {
            const recipients = new Set();
            recipients.add(team.ownerId);
            team.members.forEach(m => recipients.add(m.id));

            const io = getIo();
            recipients.forEach(userId => {
                 io.to(`user_${userId}`).emit('PROJECT_RESTORE', restoredProject);
            });
        }
    } else {
        const io = getIo();
        io.to(`user_${req.user.id}`).emit('PROJECT_RESTORE', restoredProject);
    }

    res.json({ message: 'Project restored' });
  } catch (error) {
    console.error('Error restoring project:', error);
    res.status(500).json({ error: 'Failed to restore project' });
  }
});

// DELETE /projects/:id/permanent: Permanently delete a project
router.delete('/:id/permanent', authenticateToken, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { teams: { select: { id: true } }, ownedTeams: { select: { id: true } } }
    });

    if (!user) {
        return res.status(401).json({ error: 'User not found' });
    }

    const userTeamIds = [...user.teams.map(t => t.id), ...user.ownedTeams.map(t => t.id)];

    const project = await prisma.project.findUnique({ where: { id: projectId } });

    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (user.role !== 'admin' && (!project.teamId || !userTeamIds.includes(project.teamId))) {
        return res.status(403).json({ error: 'Access denied' });
    }

    // Release Storage Calculation
    let teamBytesToRelease = 0;

    // 1. Videos
    const videos = await prisma.video.findMany({ where: { projectId } });
    for (const video of videos) {
       teamBytesToRelease += Number(video.size);
       if (video.path && fs.existsSync(video.path)) {
           try { fs.unlinkSync(video.path); } catch(e) { console.error('Error deleting file', e); }
       }
       // If uploaderId exists, we should release user quota?
       // Currently we only enforce USER quota on comments.
       // But if we track upload, we should technically release it.
       if (video.uploaderId) {
            // await updateStorage({ userId: video.uploaderId, teamId: null, deltaBytes: -Number(video.size) });
            // Not doing this yet as we decided User Quota is mostly Comments for now.
       }
    }

    // 2. ThreeDAssets
    const assets = await prisma.threeDAsset.findMany({ where: { projectId } });
    for (const asset of assets) {
        teamBytesToRelease += Number(asset.size);
        if (asset.path && fs.existsSync(asset.path)) {
            try { fs.unlinkSync(asset.path); } catch(e) {}
        }
    }

    // 3. ImageBundles / Images
    const bundles = await prisma.imageBundle.findMany({ where: { projectId }, include: { images: true } });
    for (const bundle of bundles) {
        for (const img of bundle.images) {
            teamBytesToRelease += Number(img.size);
            if (img.path && fs.existsSync(img.path)) {
                try { fs.unlinkSync(img.path); } catch(e) {}
            }
        }
    }

    // 4. Comments (Attachments/Screenshots)
    // Note: Comment attachments DO count towards User Quota.
    // We should iterate comments to release USER quota.
    // However, finding all comments for a project is tricky:
    // Linked to video/image/asset -> easy.
    // We need to fetch all comments.

    // Fetch videos IDs, asset IDs, bundle IDs -> Image IDs.
    const videoIds = videos.map(v => v.id);
    const assetIds = assets.map(a => a.id);
    const imageIds = bundles.flatMap(b => b.images.map(i => i.id));

    const comments = await prisma.comment.findMany({
        where: {
            OR: [
                { videoId: { in: videoIds } },
                { threeDAssetId: { in: assetIds } },
                { imageId: { in: imageIds } }
            ]
        }
    });

    for (const c of comments) {
        // Release User Storage
        if (c.userId && c.size > 0) {
            await updateStorage({ userId: c.userId, teamId: null, deltaBytes: -Number(c.size) });
        }
        // Also release Team Storage? Currently comments don't count towards Team Quota in our logic (only project media).
        // If they did, we'd add to teamBytesToRelease.

        // Delete files
        if (c.attachmentPath) {
             const p = path.join(DATA_PATH, 'media', c.attachmentPath);
             try { if(fs.existsSync(p)) fs.unlinkSync(p); } catch(e) {}
        }
        if (c.screenshotPath) {
             const p = path.join(DATA_PATH, 'comments', c.screenshotPath);
             try { if(fs.existsSync(p)) fs.unlinkSync(p); } catch(e) {}
        }
    }

    // Update Team Storage
    if (project.teamId && teamBytesToRelease > 0) {
        await updateStorage({ teamId: project.teamId, deltaBytes: -teamBytesToRelease });
    }

    // Real-time Update (DELETE)
    // We need to notify team members that this project is GONE (so remove from list)
    if (project.teamId) {
        const team = await prisma.team.findUnique({
            where: { id: project.teamId },
            include: { members: { select: { id: true } }, owner: { select: { id: true } } }
        });

        if (team) {
            const recipients = new Set();
            recipients.add(team.ownerId);
            team.members.forEach(m => recipients.add(m.id));

            const io = getIo();
            recipients.forEach(userId => {
                 io.to(`user_${userId}`).emit('PROJECT_DELETE', { id: projectId });
            });
        }
    } else {
        const io = getIo();
        io.to(`user_${req.user.id}`).emit('PROJECT_DELETE', { id: projectId });
    }

    await prisma.project.delete({ where: { id: projectId } });
    res.json({ message: 'Project permanently deleted' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// POST /projects/:id/mute: Mute project notifications
router.post('/:id/mute', authenticateToken, async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        const access = await checkProjectAccess(req.user, projectId);
        if (!access.authorized) return res.status(access.status).json({ error: access.error });

        await prisma.project.update({
            where: { id: projectId },
            data: {
                mutedBy: {
                    connect: { id: req.user.id }
                }
            }
        });
        res.json({ message: 'Project muted' });
    } catch (error) {
        console.error('Error muting project:', error);
        res.status(500).json({ error: 'Failed to mute project' });
    }
});

// DELETE /projects/:id/mute: Unmute project notifications
router.delete('/:id/mute', authenticateToken, async (req, res) => {
    try {
        const projectId = parseInt(req.params.id);
        const access = await checkProjectAccess(req.user, projectId);
        if (!access.authorized) return res.status(access.status).json({ error: access.error });

        await prisma.project.update({
            where: { id: projectId },
            data: {
                mutedBy: {
                    disconnect: { id: req.user.id }
                }
            }
        });
        res.json({ message: 'Project unmuted' });
    } catch (error) {
        console.error('Error unmuting project:', error);
        res.status(500).json({ error: 'Failed to unmute project' });
    }
});

// DELETE /projects/comments/:commentId: Delete a comment
router.delete('/comments/:commentId', authenticateToken, async (req, res) => {
    const commentId = parseInt(req.params.commentId);

    try {
        const comment = await prisma.comment.findUnique({
            where: { id: commentId },
            include: {
                video: { select: { projectId: true } },
                image: { include: { bundle: { select: { projectId: true } } } },
                threeDAsset: { select: { projectId: true } }
            }
        });

        if (!comment) return res.status(404).json({ error: 'Comment not found' });

        // Determine Project ID
        let projectId = null;
        if (comment.video) projectId = comment.video.projectId;
        else if (comment.image && comment.image.bundle) projectId = comment.image.bundle.projectId;
        else if (comment.threeDAsset) projectId = comment.threeDAsset.projectId;

        // Fetch Project to check Team Owner
        let teamOwnerId = null;
        if (projectId) {
            const project = await prisma.project.findUnique({
                where: { id: projectId },
                include: { team: true }
            });
            if (project && project.team) {
                teamOwnerId = project.team.ownerId;
            }
        }

        // Authorization Logic
        const isAuthor = comment.userId === req.user.id;
        const isAdmin = req.user.role === 'admin';
        const isTeamOwner = teamOwnerId && teamOwnerId === req.user.id;

        if (!isAuthor && !isAdmin && !isTeamOwner) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await prisma.comment.delete({ where: { id: commentId } });
        res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

module.exports = router;
