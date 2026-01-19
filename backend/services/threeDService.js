const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const http = require('http');
const ffmpeg = require('fluent-ffmpeg');
const pLimit = require('p-limit');

// Concurrency Limit: 1 concurrent generation
const limit = pLimit(1);

/**
 * Starts a temporary HTTP server to serve the model file.
 * @param {string} modelPath - Absolute path to the 3D model file.
 * @returns {Promise<{server: http.Server, port: number}>}
 */
const startTempServer = (modelPath) => {
    return new Promise((resolve, reject) => {
        const ext = path.extname(modelPath).toLowerCase();

        // Determine correct MIME type for the 3D file
        let contentType = 'application/octet-stream';
        if (ext === '.glb') {
            contentType = 'model/gltf-binary';
        } else if (ext === '.gltf') {
            contentType = 'model/gltf+json';
        } else if (ext === '.fbx') {
            contentType = 'application/octet-stream';
        }

        const server = http.createServer((req, res) => {
            if (req.url === '/model') {
                const stat = fs.statSync(modelPath);
                res.writeHead(200, {
                    'Content-Type': contentType,
                    'Content-Length': stat.size,
                    'Access-Control-Allow-Origin': '*'
                });
                fs.createReadStream(modelPath).pipe(res);
            } else {
                res.writeHead(404);
                res.end();
            }
        });

        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            resolve({ server, port });
        });

        server.on('error', reject);
    });
};


/**
 * Generates a GIF turnaround from a 3D model.
 * @param {string} modelPath - Absolute path to the 3D model file (GLB or FBX).
 * @param {string} outputDir - Directory to save the GIF.
 * @returns {Promise<string>} - The filename of the generated GIF.
 */
const generateGifTurnaround = (modelPath, outputDir) => {
    return limit(async () => {
        // Start temp server to serve the model file (avoids CORS issues)
        const { server, port } = await startTempServer(modelPath);
        console.log(`[3D GIF] Temp server started on port ${port}`);

        const browser = await puppeteer.launch({
            executablePath: '/usr/bin/chromium',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--allow-file-access-from-files',
                '--enable-unsafe-swiftshader' // Fix for deprecated software GL warning
            ],
            headless: 'new'
        });

        try {
            const page = await browser.newPage();
            page.on('console', msg => console.log('[Puppeteer Browser Log]:', msg.text()));

            // 16:9 Aspect Ratio
            await page.setViewport({ width: 640, height: 360 });

            const modelUrl = `http://127.0.0.1:${port}/model`;

            const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>body { margin: 0; overflow: hidden; background: transparent; }</style>
                <script async src="https://unpkg.com/es-module-shims@1.6.3/dist/es-module-shims.js"></script>
                
                <script type="importmap">
                  {
                    "imports": {
                      "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
                      "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
                    }
                  }
                </script>
            </head>
            <body>
                <script type="module">
                    import * as THREE from 'three';
                    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
                    import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

                    const scene = new THREE.Scene();
                    scene.background = new THREE.Color(0xffffff);

                    const width = 640;
                    const height = 360;
                    const aspect = width / height;

                    const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
                    camera.position.set(0, 0, 3);

                    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
                    renderer.setSize(width, height);
                    renderer.outputColorSpace = THREE.SRGBColorSpace;
                    document.body.appendChild(renderer.domElement);

                    // Lights
                    const ambientLight = new THREE.AmbientLight(0xffffff, 2);
                    scene.add(ambientLight);
                    
                    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
                    dirLight.position.set(2, 2, 5);
                    scene.add(dirLight);

                    window.loadModel = async (ext, modelUrl) => {
                        return new Promise((resolve, reject) => {
                            let loader;
                            
                            if (ext === '.fbx') {
                                loader = new FBXLoader();
                            } else {
                                loader = new GLTFLoader();
                            }
                            
                            loader.load(modelUrl, (object) => {
                                let model = object;
                                // GLTFLoader returns object with .scene, FBX returns Group directly
                                if (object.scene) model = object.scene;

                                model.updateMatrixWorld(true);

                                const box = new THREE.Box3().setFromObject(model);
                                const size = box.getSize(new THREE.Vector3());
                                const center = box.getCenter(new THREE.Vector3());

                                const wrapper = new THREE.Object3D();
                                scene.add(wrapper);
                                wrapper.add(model);
                                
                                model.position.sub(center);
                                
                                window.model = wrapper;

                                const maxDim = Math.max(size.x, size.y, size.z);
                                const fov = camera.fov * (Math.PI / 180);
                                let cameraZ = (maxDim / 2) / Math.tan(fov / 2);
                                cameraZ *= 1.2; 
                                
                                camera.position.set(0, 0, cameraZ);
                                camera.lookAt(0, 0, 0);

                                dirLight.position.set(cameraZ, cameraZ, cameraZ);
                                camera.near = cameraZ / 100;
                                camera.far = cameraZ * 100;
                                camera.updateProjectionMatrix();

                                resolve();
                            }, undefined, reject);
                        });
                    };

                    window.renderFrame = (angleRad) => {
                        if (window.model) {
                            window.model.rotation.y = angleRad;
                        }
                        renderer.render(scene, camera);
                    };
                </script>
            </body>
            </html>
            `;

            await page.setContent(htmlContent);

            // Determine extension to choose loader
            const ext = path.extname(modelPath).toLowerCase();

            // Trigger load via temp server
            await page.evaluate((ext, url) => window.loadModel(ext, url), ext, modelUrl);

            const frameCount = 24;
            const tempDir = path.join(outputDir, 'temp_gif_frames_' + Date.now());
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

            for (let i = 0; i < frameCount; i++) {
                const angle = (i / frameCount) * Math.PI * 2;
                await page.evaluate((a) => window.renderFrame(a), angle);
                const screenshotPath = path.join(tempDir, `frame_${i.toString().padStart(3, '0')}.png`);
                await page.screenshot({ path: screenshotPath, type: 'png' });
            }

            const gifFilename = path.basename(modelPath, path.extname(modelPath)) + '-turnaround.gif';
            const gifPath = path.join(outputDir, gifFilename);

            await new Promise((resolve, reject) => {
                ffmpeg()
                    .input(path.join(tempDir, 'frame_%03d.png'))
                    .inputFPS(12)
                    .outputOptions([
                        '-vf', 'scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
                        '-loop', '0'
                    ])
                    .output(gifPath)
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
            });

            fs.rmSync(tempDir, { recursive: true, force: true });
            await page.close();

            return gifFilename;

        } catch (error) {
            console.error('ThreeDService Error:', error);
            if (browser) await browser.close();
            throw error;
        } finally {
            if (browser) await browser.close();
            server.close();
            console.log('[3D GIF] Temp server closed');
        }
    });
};

module.exports = { generateGifTurnaround };
