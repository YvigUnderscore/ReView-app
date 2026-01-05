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
const ffmpeg = require('fluent-ffmpeg');
const AdmZip = require('adm-zip');
const { createAndBroadcast } = require('./services/notificationService');

const router = express.Router();
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
      select: { id: true, teamId: true }
    });

    if (!basicProject) return res.status(404).json({ error: 'Project not found' });

    if (user.role !== 'admin' && (!basicProject.teamId || !userTeamIds.includes(basicProject.teamId))) {
        return res.status(403).json({ error: 'Access denied' });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        videos: {
          include: {
            comments: {
              where: { parentId: null }, // Only fetch root comments
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    role: true,
                    avatarPath: true,
                    teamRoles: true // Fetch all roles, filter later
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
                        teamRoles: true // Fetch all roles, filter later
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
                                        teamRoles: true // Fetch all roles, filter later
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
                                                teamRoles: true // Fetch all roles, filter later
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
                                teamRoles: true // Fetch all roles, filter later
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
                                        teamRoles: true // Fetch all roles, filter later
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
                teamRoles: true // Fetch all roles, filter later
              }
            },
            roles: true
          }
        }
      }
    });

    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Filter team roles manually
    const filterRoles = (user) => {
        if (user && user.teamRoles) {
            // Filter roles for the current project's team
            user.teamRoles = user.teamRoles.filter(role => role.teamId === project.teamId);
        }
    };

    // Traverse and filter
    if (project.videos) {
        project.videos.forEach(v => {
            if (v.comments) {
                v.comments.forEach(c => {
                    filterRoles(c.user);
                    if (c.replies) c.replies.forEach(r => filterRoles(r.user));
                });
            }
        });
    }

    if (project.imageBundles) {
        project.imageBundles.forEach(ib => {
            if (ib.images) {
                ib.images.forEach(img => {
                    if (img.comments) {
                        img.comments.forEach(c => {
                            filterRoles(c.user);
                            if (c.replies) c.replies.forEach(r => filterRoles(r.user));
                        });
                    }
                });
            }
        });
    }

    if (project.threeDAssets) {
        project.threeDAssets.forEach(asset => {
            if (asset.comments) {
                asset.comments.forEach(c => {
                    filterRoles(c.user);
                    if (c.replies) c.replies.forEach(r => filterRoles(r.user));
                });
            }
        });
    }

    if (project.team && project.team.members) {
        project.team.members.forEach(member => filterRoles(member));
    }

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
        versions: allVersions
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

    const parsedTeamId = teamId ? parseInt(teamId) : null;

    let projectData = {
        name: name || 'Untitled Project',
        description: description || '',
        teamId: parsedTeamId,
        thumbnailPath,
        hasCustomThumbnail,
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
                    versionName: 'V01'
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
                    frameRate
                }
            };
        }
    } else {
        projectData.imageBundles = {
            create: {
                versionName: 'V01',
                images: {
                    create: imageFiles.map((file, index) => ({
                        filename: file.filename,
                        originalName: file.originalname,
                        mimeType: file.mimetype,
                        path: file.path,
                        order: index
                    }))
                }
            }
        };
    }

    const project = await prisma.project.create({
      data: projectData,
      include: { videos: true, imageBundles: { include: { images: true } }, threeDAssets: true }
    });

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
                        versionName
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
                        frameRate
                    }
                });
            }
        } else {
             newVersion = await prisma.imageBundle.create({
                data: {
                    projectId,
                    versionName,
                    images: {
                        create: imageFiles.map((file, index) => ({
                            filename: file.filename,
                            originalName: file.originalname,
                            mimeType: file.mimetype,
                            path: file.path,
                            order: index
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
router.post('/:id/comments', authenticateToken, async (req, res) => {
  const { content, timestamp, annotation, parentId, duration, assigneeId, videoId, imageId, threeDAssetId, cameraState, screenshot } = req.body;

  // Input Validation
  if (!isValidText(content, 5000)) return res.status(400).json({ error: 'Comment content exceeds 5000 characters' });

  const projectId = parseInt(req.params.id);

  // Security: Check if user has access to the project
  const access = await checkProjectAccess(req.user, projectId);
  if (!access.authorized) return res.status(access.status).json({ error: access.error });

  try {
    let screenshotPath = null;
    if (screenshot) {
        const matches = screenshot.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
            const buffer = Buffer.from(matches[2], 'base64');

            // Security: Validate buffer size (Max 5MB)
            if (buffer.length > 5 * 1024 * 1024) {
                 return res.status(400).json({ error: 'Screenshot too large (max 5MB)' });
            }

            // Security: Validate image content (Magic numbers)
            if (!isValidImageBuffer(buffer)) {
                 return res.status(400).json({ error: 'Invalid screenshot file format' });
            }

            const filename = `shot-${crypto.randomUUID()}.jpg`;
            const commentsDir = path.join(DATA_PATH, 'comments');
            const filepath = path.join(commentsDir, filename);
            if (!fs.existsSync(commentsDir)) fs.mkdirSync(commentsDir, { recursive: true });
            fs.writeFileSync(filepath, buffer);
            screenshotPath = filename;
        }
    }

    const data = {
        content,
        timestamp: timestamp ? parseFloat(timestamp) : 0,
        duration: duration ? parseFloat(duration) : null,
        annotation: annotation ? JSON.stringify(annotation) : null,
        userId: req.user.id,
        parentId: parentId ? parseInt(parentId) : null,
        assigneeId: assigneeId ? parseInt(assigneeId) : null,
        cameraState: cameraState ? JSON.stringify(cameraState) : null,
        screenshotPath
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

    const project = await prisma.project.findUnique({ where: { id: projectId } });

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

            userIdsToNotify.delete(req.user.id);

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

    // Notification: STATUS_CHANGE
    if (statusChanged && project.teamId) {
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
            type: 'STATUS_CHANGE',
            content: `Status changed to ${status} for "${updatedProject.name}"`,
            referenceId: updatedProject.id, // Using projectId as reference
            projectId: updatedProject.id
        });
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

// DELETE /projects/:id: Delete a project
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

    const videos = await prisma.video.findMany({ where: { projectId } });
    for (const video of videos) {
       if (video.path && fs.existsSync(video.path)) {
           try { fs.unlinkSync(video.path); } catch(e) { console.error('Error deleting file', e); }
       }
    }

    await prisma.project.delete({ where: { id: projectId } });
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

module.exports = router;
