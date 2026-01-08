const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const { createObjectCsvWriter } = require('csv-writer');

const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, '../storage');

// Constants for Dark Mode Theme
const THEME = {
    bg: '#020817', // Dark Blue/Black
    text: '#f8fafc', // White
    cardBg: '#1e293b', // Slate 800
    border: '#334155', // Slate 700
    accent: '#3b82f6', // Blue 500
    muted: '#94a3b8', // Slate 400
    success: '#22c55e', // Green 500
};

// Map drawing tools to PDFKit commands
const drawAnnotation = (doc, annotationJson, x, y, width, height) => {
    try {
        const shapes = typeof annotationJson === 'string' ? JSON.parse(annotationJson) : annotationJson;
        if (!Array.isArray(shapes)) return;

        doc.save();
        // PDFKit clip to the image area
        doc.rect(x, y, width, height).clip();

        shapes.forEach(shape => {
            if (!shape) return;

            doc.save();

            // Handle color (hex)
            if (shape.color) {
                doc.strokeColor(shape.color);
                doc.fillColor(shape.color);
            }

            // Stroke Width
            // Scale based on PDF vs Canvas width.
            const scaleFactor = Math.max(width / 1920, 0.5);
            let lineWidth = (shape.strokeWidth || 10);
            if (shape.tool === 'highlighter') lineWidth *= 3;
            // Additional scaling for PDF resolution
            doc.lineWidth(lineWidth * (width / 1920));
            doc.lineCap('round');
            doc.lineJoin('round');

            // Opacity
            if (shape.tool === 'highlighter') {
                doc.opacity(0.4);
            } else {
                doc.opacity(1.0);
            }

            // Helper to denormalize
            const getCoord = (sx, sy) => ({ x: x + sx * width, y: y + sy * height });

            if (['pencil', 'highlighter', 'eraser'].includes(shape.tool)) {
                if (shape.points && shape.points.length > 1) {
                    const start = getCoord(shape.points[0].x, shape.points[0].y);
                    doc.moveTo(start.x, start.y);
                    for (let i = 1; i < shape.points.length; i++) {
                        const p = getCoord(shape.points[i].x, shape.points[i].y);
                        doc.lineTo(p.x, p.y);
                    }
                    if (shape.tool !== 'eraser') {
                         doc.stroke();
                    }
                }
            } else {
                // Shapes
                const p = getCoord(shape.x, shape.y);
                const w_ = shape.w * width;
                const h_ = shape.h * height;

                if (shape.tool === 'rect') {
                    doc.rect(p.x, p.y, w_, h_).stroke();
                } else if (shape.tool === 'circle') {
                    doc.ellipse(p.x + w_/2, p.y + h_/2, Math.abs(w_/2), Math.abs(h_/2)).stroke();
                } else if (shape.tool === 'line') {
                    doc.moveTo(p.x, p.y).lineTo(p.x + w_, p.y + h_).stroke();
                } else if (shape.tool === 'arrow') {
                    doc.moveTo(p.x, p.y).lineTo(p.x + w_, p.y + h_).stroke();
                    const angle = Math.atan2(h_, w_);
                    const headlen = (shape.strokeWidth || 10) * 3 * (width / 1920);
                    const tox = p.x + w_;
                    const toy = p.y + h_;

                    doc.moveTo(tox, toy)
                       .lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6))
                       .stroke();
                    doc.moveTo(tox, toy)
                       .lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6))
                       .stroke();

                } else if (shape.tool === 'text') {
                     doc.fontSize((shape.strokeWidth || 10) * 3 * (width/1920))
                        .text(shape.text || 'Text', p.x, p.y);
                } else if (shape.tool === 'bubble') {
                    doc.roundedRect(p.x, p.y, w_, h_, 10).stroke();
                    doc.moveTo(p.x + w_ * 0.2, p.y + h_)
                       .lineTo(p.x + w_ * 0.2 - 10, p.y + h_ + 20)
                       .lineTo(p.x + w_ * 0.2 + 10, p.y + h_)
                       .stroke();
                } else if (shape.tool === 'curve') {
                     const startX = p.x; const startY = p.y;
                     const endX = p.x + w_; const endY = p.y + h_;
                     const midX = (startX + endX) / 2;
                     const midY = (startY + endY) / 2;
                     const cpX = midX;
                     const cpY = midY - Math.abs(w_) * 0.5;

                     doc.moveTo(startX, startY)
                        .quadraticCurveTo(cpX, cpY, endX, endY)
                        .stroke();
                }
            }

            doc.restore();
        });

        doc.restore();
    } catch (e) {
        console.error("Error drawing annotation", e);
    }
};

const generateCommentScreenshot = (videoPath, timestamp, outputDir) => {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(outputDir)) {
             fs.mkdirSync(outputDir, { recursive: true });
        }
        const filename = `shot-${crypto.randomUUID()}.jpg`;
        ffmpeg(videoPath)
            .screenshots({
                timestamps: [timestamp],
                filename: filename,
                folder: outputDir,
                size: '640x?' // Reasonable size for PDF
            })
            .on('end', () => {
                resolve(path.join(outputDir, filename));
            })
            .on('error', (err) => {
                console.error("Screenshot error", err);
                resolve(null);
            });
    });
};

const formatTime = (seconds, frameRate = 24) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * frameRate);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
};

const formatDate = (dateInput, format = "DD/MM/YYYY") => {
    if (!dateInput) return "";
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return "";

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    if (format === "MM/DD/YYYY") {
        return `${month}/${day}/${year}`;
    }
    return `${day}/${month}/${year}`;
};

const generatePDF = async (project, mediaObject, comments, res, settings = {}) => {
    const { dateFormat = "DD/MM/YYYY", siteTitle = "ReView" } = settings;

    const doc = new PDFDocument({ autoFirstPage: false, margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    // Sanitize filename to alphanumeric/safe chars
    const safeFilename = project.name.replace(/[^a-zA-Z0-9_\- ]/g, '_').trim() || 'project';
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}-export.pdf"`);
    doc.pipe(res);

    const tempFiles = [];
    const tempDir = path.join(DATA_PATH, 'temp_screenshots');

    // Cleanup Logic
    const cleanup = () => {
        tempFiles.forEach(file => {
            if (fs.existsSync(file)) {
                try { fs.unlinkSync(file); } catch(e) {}
            }
        });
    };

    res.on('finish', cleanup);
    res.on('close', cleanup);

    // Set Background Color Helper
    const fillBackground = () => {
        doc.save()
           .rect(0, 0, doc.page.width, doc.page.height)
           .fill(THEME.bg)
           .restore();
    };

    // Register Font
    const fontPath = path.join(DATA_PATH, 'fonts/Inter-Regular.ttf');
    if (fs.existsSync(fontPath)) {
        doc.font(fontPath);
    } else {
        doc.font('Helvetica');
    }

    // COVER PAGE
    const drawCoverPage = async () => {
        doc.addPage();
        fillBackground();

        // Site Title
        doc.fontSize(16).fillColor(THEME.muted).text(siteTitle, { align: 'center' });
        doc.moveDown(0.5);

        // Project Name
        doc.fontSize(32).fillColor(THEME.text).text(project.name, { align: 'center' });
        doc.moveDown(1);

        // Description
        if (project.description) {
            doc.fontSize(14).fillColor(THEME.muted).text(project.description, { align: 'center' });
            doc.moveDown(2);
        }

        // Thumbnail
        let thumbPath = null;
        if (project.thumbnailPath) {
             thumbPath = path.join(DATA_PATH, 'thumbnails', project.thumbnailPath);
        }

        if (thumbPath && fs.existsSync(thumbPath)) {
             const imgWidth = 400;
             const x = (doc.page.width - imgWidth) / 2;
             try {
                doc.image(thumbPath, x, doc.y, { width: imgWidth });
                doc.y += 240; // Approx height + margin
             } catch(e) {
                 doc.text("[Thumbnail Error]", { align: 'center' });
             }
        }

        doc.moveDown(2);

        // Metadata
        doc.fontSize(12).fillColor(THEME.text);
        const metaY = doc.y;

        const drawMeta = (label, value, x) => {
             doc.font(fs.existsSync(fontPath) ? fontPath : 'Helvetica-Bold').text(label, x, metaY, { width: 150, align: 'center' });
             doc.font(fs.existsSync(fontPath) ? fontPath : 'Helvetica').text(value, x, metaY + 20, { width: 150, align: 'center' });
        };

        // Version
        drawMeta('Version', mediaObject.versionName || 'V01', doc.page.width/2 - 200);

        // Date
        drawMeta('Date', formatDate(new Date(), dateFormat), doc.page.width/2 + 50);

        // Video Specific Metadata
        if (!mediaObject.images) {
            doc.moveDown(4);
            const vY = doc.y;
            if (mediaObject.resolution) drawMeta('Resolution', mediaObject.resolution, doc.page.width/2 - 200); // Need to pass resolution
            if (mediaObject.frameRate) drawMeta('Framerate', `${mediaObject.frameRate} fps`, doc.page.width/2 - 50);
            if (mediaObject.duration) drawMeta('Duration', formatTime(mediaObject.duration, mediaObject.frameRate), doc.page.width/2 + 100);
        }
    };

    await drawCoverPage();

    // CONTENT PAGES

    // Helper: Draw Comment Card
    const drawCommentCard = async (comment, mediaPath = null, isVideo = false, isThreeD = false) => {
        const cardX = 50;
        const cardW = 500;
        const padding = 15;
        const textWidth = cardW - (padding * 2);

        // Calculate Text Height
        doc.fontSize(10);
        const textHeight = doc.heightOfString(comment.content, { width: textWidth });

        let isRange = isVideo && comment.duration && comment.duration > 0;
        let hasImage = isVideo || comment.annotation;

        // Image Dimensions & Preload
        const maxW = cardW - (padding * 2);
        const maxH = 500; // Cap height for single images
        const shotWidth = (maxW - 10) / 3;
        const shotHeight = shotWidth * (9/16);

        let imageAreaHeight = 0;
        let preparedImage = null; // for single image case

        if (isRange) {
             imageAreaHeight = shotHeight + 20; // + label/margin
        } else if (hasImage || comment.screenshotPath) {
             // For single image (video screenshot or image project), we want full scale.
             // We need to determine the height before drawing the card background.
             let imageToDraw = null;
             if (comment.screenshotPath) {
                 // 3D Screenshot or explicit screenshot
                 imageToDraw = path.join(DATA_PATH, 'comments', comment.screenshotPath);
             } else if (isThreeD) {
                 // If 3D and no screenshotPath, we don't have an image to show.
                 // We skip generation because ffmpeg doesn't support GLB.
                 imageToDraw = null;
             } else if (isVideo) {
                 imageToDraw = await generateCommentScreenshot(mediaPath, comment.timestamp, tempDir);
                 if (imageToDraw) tempFiles.push(imageToDraw);
             } else if (comment.annotation) {
                 // For Image projects
                 imageToDraw = mediaPath;
             }

             if (imageToDraw && fs.existsSync(imageToDraw)) {
                 try {
                     const imgObj = doc.openImage(imageToDraw);
                     const scale = Math.min(maxW / imgObj.width, maxH / imgObj.height);
                     const renderW = imgObj.width * scale;
                     const renderH = imgObj.height * scale;

                     preparedImage = {
                         path: imageToDraw,
                         width: renderW,
                         height: renderH,
                         obj: imgObj
                     };
                     imageAreaHeight = renderH;
                 } catch (e) {
                     // Fallback height if error
                     imageAreaHeight = 200;
                 }
             } else {
                 // Fallback if file missing
                 if (isThreeD && !comment.screenshotPath) {
                     // For 3D without screenshot, we reserve small space for "No Preview"
                     imageAreaHeight = 30;
                 } else {
                     imageAreaHeight = 20;
                 }
             }
        }

        // Base Height: Header (25) + Text + PaddingTop(15) + PaddingContent(10) + PaddingBottom(15)
        let requiredHeight = 25 + textHeight + 40;
        if (imageAreaHeight > 0) requiredHeight += imageAreaHeight + 20;

        // Calculate Attachment Height Pre-emptively
        let attachmentHeight = 0;
        if (comment.attachmentPath) {
             const attachmentFullPath = path.join(DATA_PATH, 'media', comment.attachmentPath);
             if (fs.existsSync(attachmentFullPath)) {
                 try {
                     // We need dimensions to scale.
                     // PDFKit openImage is synchronous and cheap if cached?
                     const attachImg = doc.openImage(attachmentFullPath);
                     const attachScale = Math.min(maxW / attachImg.width, maxH / attachImg.height);
                     attachmentHeight = (attachImg.height * attachScale) + 10;
                 } catch(e) {
                     attachmentHeight = 20; // Error text height
                 }
             }
        }
        requiredHeight += attachmentHeight;

        if (doc.y + requiredHeight > doc.page.height - 50) {
            doc.addPage();
            fillBackground();
            doc.y = 50;
        }

        const startY = doc.y;

        // Draw Card Background
        doc.roundedRect(cardX, startY, cardW, requiredHeight, 5)
           .fillColor(THEME.cardBg)
           .fill();

        // Border
        doc.roundedRect(cardX, startY, cardW, requiredHeight, 5)
           .strokeColor(THEME.border)
           .stroke();

        let contentY = startY + padding;

        // Header
        let currentHeaderX = cardX + padding;
        if (isVideo) {
             const timeStr = formatTime(comment.timestamp, mediaObject.frameRate) +
                             (isRange ? ` - ${formatTime(comment.timestamp + comment.duration, mediaObject.frameRate)}` : "");

             doc.fontSize(12).fillColor(THEME.accent).text(timeStr, currentHeaderX, contentY, { continued: false });
             const timeWidth = doc.widthOfString(timeStr);
             currentHeaderX += timeWidth;
        }

        const nameStr = `  •  ${comment.guestName || comment.user?.name || 'Unknown'}`;
        // If video, we append. If not, we start at padding.
        doc.fontSize(12).fillColor(THEME.text).text(nameStr, isVideo ? currentHeaderX : (cardX + padding), contentY);

        const statusText = comment.isResolved ? 'Resolved' : 'Active';
        const statusColor = comment.isResolved ? THEME.success : THEME.muted;

        // Right aligned status
        doc.fillColor(statusColor).text(statusText, cardX + cardW - padding - 60, contentY, { align: 'right', width: 60 });

        contentY += 25;

        // Content
        doc.fontSize(10).fillColor(THEME.text).text(comment.content, cardX + padding, contentY, { width: textWidth });
        contentY = doc.y + 10;

        // Images (Context / Viewer Screenshot)
        if (isRange) {
            const times = [
                comment.timestamp,
                comment.timestamp + (comment.duration / 2),
                comment.timestamp + comment.duration
            ];

            let currentX = cardX + padding;

            for (let i = 0; i < 3; i++) {
                const shotPath = await generateCommentScreenshot(mediaPath, times[i], tempDir);
                if (shotPath) {
                    tempFiles.push(shotPath);
                    try {
                        doc.image(shotPath, currentX, contentY, { fit: [shotWidth, shotHeight], align: 'center', valign: 'center' });

                        // Label
                        doc.fontSize(8).fillColor(THEME.muted).text(formatTime(times[i], mediaObject.frameRate), currentX, contentY + shotHeight + 5, { width: shotWidth, align: 'center' });
                    } catch (e) {
                         doc.text("Img Error", currentX, contentY);
                    }
                }
                currentX += shotWidth + 5;
            }

            if (comment.annotation) {
                try {
                     drawAnnotation(doc, comment.annotation, cardX + padding, contentY, shotWidth, shotHeight);
                } catch (e) {}
            }

            // Increment Y past the range images
            contentY += shotHeight + 20;

        } else if (hasImage) {
            // Single Image - Use Prepared Image
             if (preparedImage) {
                 try {
                     // Center Horizontally
                     const renderX = cardX + padding + (maxW - preparedImage.width) / 2;
                     const renderY = contentY;

                     // Use width/height to force exact size we calculated
                     doc.image(preparedImage.obj, renderX, renderY, { width: preparedImage.width, height: preparedImage.height });

                     if (comment.annotation) {
                         drawAnnotation(doc, comment.annotation, renderX, renderY, preparedImage.width, preparedImage.height);
                     }
                     contentY += preparedImage.height + 10;
                 } catch (e) {
                     console.error("Image render error", e);
                     doc.text("[Image Error]", cardX + padding, contentY);
                     contentY += 30;
                 }
             } else {
                 // Error or missing
                 if (isThreeD && !comment.screenshotPath) {
                      doc.fontSize(10).fillColor(THEME.muted).text("[No 3D Preview Available]", cardX + padding, contentY);
                      contentY += 20;
                 } else if (imageAreaHeight > 10) {
                     doc.text("[Image Error]", cardX + padding, contentY);
                     contentY += 30;
                 }
             }
        }

        // Attachment Image (Stacked Below)
        if (comment.attachmentPath) {
            const attachmentFullPath = path.join(DATA_PATH, 'media', comment.attachmentPath);
            if (fs.existsSync(attachmentFullPath)) {
                try {
                    const attachImg = doc.openImage(attachmentFullPath);
                    const attachScale = Math.min(maxW / attachImg.width, maxH / attachImg.height);
                    const attachW = attachImg.width * attachScale;
                    const attachH = attachImg.height * attachScale;

                    // Center
                    const attachX = cardX + padding + (maxW - attachW) / 2;

                    // Check page break
                    if (doc.y + attachH + 20 > doc.page.height - 50) {
                        doc.addPage();
                        fillBackground();
                        contentY = 50;
                    } else if (contentY + attachH + 20 > doc.y + requiredHeight) {
                        // Dynamic height adjustment if attachment pushed us further
                        // But we already pre-calculated requiredHeight? No, we didn't include attachment in pre-calc!
                        // We must pre-calculate properly or rely on dynamic flow.
                        // PDFKit 'rect' was already drawn.
                        // We need to fix the pre-calculation block first.
                    }

                    doc.image(attachImg, attachX, contentY, { width: attachW });
                    contentY += attachH + 10;
                } catch(e) {
                    console.error("Attachment render error", e);
                    doc.text("[Attachment Error]", cardX + padding, contentY);
                    contentY += 20;
                }
            }
        }

        doc.y = Math.max(doc.y, startY + requiredHeight + 10); // Ensure we move down past the card
    };

    // Determine Mode
    const isImageBundle = !!(mediaObject.images && Array.isArray(mediaObject.images));
    // Check if 3D: either mimeType contains 'model' or 'glb' or checks extension
    const isThreeD = mediaObject.mimeType === 'model/gltf-binary' || (mediaObject.filename && mediaObject.filename.endsWith('.glb'));

    if (isImageBundle) {
         const images = mediaObject.images;

         if (images.length === 0) {
             doc.fontSize(12).text("No images in this version.", 50, doc.y);
         }

         for (const img of images) {
             doc.addPage();
             fillBackground();

             doc.fontSize(16).fillColor(THEME.text).text(`Image ${img.order + 1}: ${img.originalName}`, 50, 50);
             doc.moveDown();

             let imgPath = img.path;
             if (!path.isAbsolute(imgPath)) {
                 imgPath = path.join(DATA_PATH, '..', img.path);
             }

             // Draw Main Image
             if (fs.existsSync(imgPath)) {
                 try {
                     const imgObj = doc.openImage(imgPath);
                     const maxW = 500;
                     const maxH = 300;
                     const scale = Math.min(maxW / imgObj.width, maxH / imgObj.height);
                     const w = imgObj.width * scale;
                     const h = imgObj.height * scale;

                     doc.image(imgObj, 50, doc.y, { width: w });
                     doc.y += h + 20;
                 } catch (e) {
                     doc.text("[Image Missing]");
                 }
             }

             doc.fontSize(14).text("Comments");
             doc.moveDown(0.5);

             if (!img.comments || img.comments.length === 0) {
                 doc.fontSize(10).fillColor(THEME.muted).text("No comments on this image.");
             } else {
                 for (const comment of img.comments) {
                     await drawCommentCard(comment, imgPath, false, false);
                 }
             }
         }
    } else {
         doc.addPage();
         fillBackground();
         doc.y = 50;
         doc.fontSize(16).fillColor(THEME.text).text("Comments Log");
         doc.moveDown(1);

         if (comments.length === 0) {
            doc.text("No comments on this version.");
         } else {
            for (const comment of comments) {
                // Determine if it is actually video. If isThreeD is true, isVideo is false.
                // But fallback logic uses isVideo to attempt screenshot.
                // We pass isVideo=true ONLY if it is NOT 3D and NOT ImageBundle.
                const isVideo = !isThreeD;
                await drawCommentCard(comment, mediaObject.path, isVideo, isThreeD);
            }
        }
    }

    doc.end();
};

const generateCSV = async (project, video, comments, res, dateFormat = "DD/MM/YYYY") => {
    // Sanitize function to prevent CSV Injection (Formula Injection)
    const sanitize = (str) => {
        if (typeof str !== 'string') return str;
        // If string starts with =, +, -, or @, prepend a single quote to force it as text
        if (/^[=+\-@]/.test(str)) {
            return "'" + str;
        }
        return str;
    };

    const records = comments.map(c => ({
        timecode: formatTime(c.timestamp, video.frameRate),
        user: sanitize(c.guestName || c.user?.name || 'Unknown'),
        content: sanitize(c.content),
        status: c.isResolved ? 'Resolved' : 'Active',
        assignee: sanitize(c.assignee ? c.assignee.name : ''),
        duration: c.duration ? c.duration.toFixed(1) : '',
        date: formatDate(c.createdAt, dateFormat)
    }));

    const tempPath = path.join(DATA_PATH, `temp_${Date.now()}.csv`);

    const writer = createObjectCsvWriter({
        path: tempPath,
        header: [
             { id: 'timecode', title: 'Timecode' },
             { id: 'user', title: 'User' },
             { id: 'content', title: 'Comment' },
             { id: 'status', title: 'Status' },
             { id: 'assignee', title: 'Assignee' },
             { id: 'duration', title: 'Duration (s)' },
             { id: 'date', title: 'Date' }
        ]
    });

    await writer.writeRecords(records);

    res.setHeader('Content-Type', 'text/csv');
    // Sanitize filename
    const safeFilename = project.name.replace(/[^a-zA-Z0-9_\- ]/g, '_').trim() || 'project';
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}-comments.csv"`);

    const stream = fs.createReadStream(tempPath);
    stream.pipe(res);
    stream.on('end', () => {
        fs.unlinkSync(tempPath);
    });
};

module.exports = { generatePDF, generateCSV };
