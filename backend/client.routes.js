const express = require('express');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { isValidText, isValidImageBuffer } = require('./utils/validation');
const { rateLimit } = require('./utils/rateLimiter');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/client/projects/:token
// Public endpoint to fetch project data
router.get('/projects/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const project = await prisma.project.findUnique({
      where: { clientToken: token },
      include: {
        videos: {
          include: {
            // Include comments, but we will filter them in code
            comments: {
              where: { parentId: null }, // Only fetch root comments
              include: {
                user: { select: { id: true, name: true } },
                replies: {
                  include: {
                    user: { select: { id: true, name: true } }
                  }
                }
              },
              orderBy: { timestamp: 'asc' }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        imageBundles: {
            include: {
                images: {
                    orderBy: { order: 'asc' },
                    include: {
                        comments: {
                            where: { parentId: null },
                            include: {
                                user: { select: { id: true, name: true } },
                                replies: {
                                    include: {
                                        user: { select: { id: true, name: true } }
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
                        user: { select: { id: true, name: true } },
                        replies: {
                            include: {
                                user: { select: { id: true, name: true } }
                            }
                        }
                    },
                    orderBy: { createdAt: 'desc' }
                }
            }
        }
      }
    });

    if (!project) {
        return res.status(404).json({ error: 'Project not found' });
    }

    if (project.status === 'INTERNAL_REVIEW') {
        return res.status(403).json({ error: 'Review not started', status: 'INTERNAL_REVIEW' });
    }

    // Filter comments based on visibility
    // Client can see:
    // 1. Comments where isVisibleToClient is true
    // 2. Comments where guestName is present (their own/other guests)
    // 3. Actually, guest comments should implicitly be visible.

    const filterComments = (comments) => {
        return comments.filter(c => c.isVisibleToClient || c.guestName).map(c => {
             if (c.replies) {
                 c.replies = filterComments(c.replies);
             }
             return c;
        });
    };

    if (project.videos) {
        project.videos.forEach(video => {
            video.comments = filterComments(video.comments);
        });
    }

    if (project.imageBundles) {
        project.imageBundles.forEach(bundle => {
            if (bundle.images) {
                bundle.images.forEach(image => {
                    image.comments = filterComments(image.comments);
                });
            }
        });
    }

    if (project.threeDAssets) {
        project.threeDAssets.forEach(asset => {
            asset.comments = filterComments(asset.comments);
        });
    }

    res.json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Rate limit for guest comments: 30 comments per 5 minutes per IP
const commentLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 30,
    message: { error: 'You are posting comments too fast. Please wait a moment.' }
});

// POST /api/client/projects/:token/comments
// Public endpoint for guest comments
router.post('/projects/:token/comments', commentLimiter, async (req, res) => {
  const { token } = req.params;
  const { content, timestamp, annotation, guestName, videoId, imageId, threeDAssetId, parentId, cameraState, screenshot } = req.body;

  if (!guestName) {
      return res.status(400).json({ error: 'Guest name is required' });
  }

  // Security: Input Validation
  if (!isValidText(content, 5000)) return res.status(400).json({ error: 'Comment content exceeds 5000 characters' });
  if (!isValidText(guestName, 100)) return res.status(400).json({ error: 'Guest name exceeds 100 characters' });

  try {
    const project = await prisma.project.findUnique({
      where: { clientToken: token },
    });

    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (project.status !== 'CLIENT_REVIEW' && project.status !== 'ALL_REVIEWS_DONE') {
         return res.status(403).json({ error: 'Reviews are not active for this project' });
    }

    if (project.status === 'ALL_REVIEWS_DONE') {
        return res.status(403).json({ error: 'Reviews are closed for this project' });
    }

    // Verify asset belongs to project
    let assetFound = false;
    if (videoId) {
        const video = await prisma.video.findFirst({ where: { id: parseInt(videoId), projectId: project.id } });
        if (video) assetFound = true;
    } else if (imageId) {
        // Image logic slightly more complex due to bundles, but for now check if it exists in db linked to project
        // Simplification: Check if ImageBundle belongs to project
        const img = await prisma.image.findUnique({ where: { id: parseInt(imageId) }, include: { bundle: true } });
        if (img && img.bundle.projectId === project.id) assetFound = true;
    } else if (threeDAssetId) {
        const asset = await prisma.threeDAsset.findFirst({ where: { id: parseInt(threeDAssetId), projectId: project.id } });
        if (asset) assetFound = true;
    }

    if (!assetFound) {
        return res.status(404).json({ error: 'Asset not found or does not belong to this project' });
    }

    let screenshotPath = null;
    if (screenshot) {
        const fs = require('fs');
        const path = require('path');
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
            const filepath = path.join(__dirname, 'storage/comments', filename);
            // Ensure dir exists
            if (!fs.existsSync(path.dirname(filepath))) fs.mkdirSync(path.dirname(filepath), { recursive: true });
            fs.writeFileSync(filepath, buffer);
            screenshotPath = filename;
        }
    }

    const data = {
        content,
        timestamp: parseFloat(timestamp),
        annotation: annotation ? JSON.stringify(annotation) : null,
        guestName: guestName,
        isVisibleToClient: true, // Guest comments are always visible
        parentId: parentId ? parseInt(parentId) : null,
        cameraState: cameraState ? JSON.stringify(cameraState) : null,
        screenshotPath
    };

    if (videoId) data.videoId = parseInt(videoId);
    if (imageId) data.imageId = parseInt(imageId);
    if (threeDAssetId) data.threeDAssetId = parseInt(threeDAssetId);

    const comment = await prisma.comment.create({
      data,
      include: {
        user: { select: { id: true, name: true } },
        replies: {
            include: { user: { select: { id: true, name: true } } }
        }
      }
    });

    res.json(comment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

module.exports = router;
