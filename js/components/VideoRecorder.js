/**
 * VideoRecorder - Módulo desacoplable para grabar videos del grafo 3D
 * Puede eliminarse completamente sin afectar la funcionalidad principal
 */
import * as THREE from 'three';
export class VideoRecorder {
    constructor(renderer, scene, camera, graphRenderer = null) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.graphRenderer = graphRenderer; // Reference to GraphRenderer for node access
        this.isRecording = false;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.originalCameraPosition = null;
        this.originalCameraTarget = null;
        this.animationId = null;
        this.labelsWereVisible = true; // Store label state
        this.currentConcept = null; // Current concept for overlay
        
        // UI overlay will be drawn on a separate composition canvas
        this.compositeCanvas = null;
        this.compositeCtx = null;
        
        // Temporary renderer with preserveDrawingBuffer for video recording
        this.videoRenderer = null;
        
        // Configuraciones por defecto para formato móvil 9:16
        this.settings = {
            duration: 10, // segundos
            fps: 60, // Increased for better quality
            quality: 'ultra', // 'ultra', 'high', 'medium', 'low'
            rotationSpeed: 0.8, // velocidad de rotación más suave
            format: 'webm', // 'webm', 'mp4'
            aspectRatio: 9/16, // Mobile format
            resolution: { width: 1080, height: 1920 } // Full HD mobile
        };
        
        this.setupCanvas();
        console.log('VideoRecorder: Initialized as standalone module');
    }
    
    setupCanvas() {
        // Asegurar que el canvas tenga las dimensiones correctas para video
        this.originalCanvasSize = {
            width: this.renderer.domElement.width,
            height: this.renderer.domElement.height
        };
    }
    
    async startRecording(options = {}) {
        if (this.isRecording) {
            console.warn('VideoRecorder: Already recording');
            return false;
        }
        
        try {
            // Combinar configuraciones
            this.settings = { ...this.settings, ...options };
            
            // Store current concept for overlay
            this.currentConcept = options.concept || 'Concepto';
            
            // Hide labels during recording
            this.hideLabelsForRecording();
            
            // Configurar canvas para video (formato móvil 9:16)
            this.setupVideoCanvas();
            
            // Guardar posición original de la cámara
            this.saveOriginalCameraState();
            
            // Create composite canvas for combining 3D scene + overlay
            this.createCompositeCanvas();
            
            // Configurar MediaRecorder with composite stream
            const stream = this.compositeCanvas.captureStream(this.settings.fps);
            console.log('VideoRecorder: Canvas stream created with fps:', this.settings.fps);
            
            const mimeType = this.getBestMimeType();
            console.log('VideoRecorder: Creating MediaRecorder with:', { mimeType, stream: !!stream });
            
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: mimeType,
                videoBitsPerSecond: this.getVideoBitrate()
            });
            
            this.recordedChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                console.log('VideoRecorder: Data available:', event.data.size, 'bytes');
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                console.log('VideoRecorder: MediaRecorder stopped, chunks:', this.recordedChunks.length);
                this.finishRecording();
            };
            
            this.mediaRecorder.onerror = (event) => {
                console.error('VideoRecorder: MediaRecorder error:', event.error);
            };
            
            this.mediaRecorder.onstart = () => {
                console.log('VideoRecorder: MediaRecorder started');
            };
            
            // Inicar grabación
            console.log('VideoRecorder: Starting MediaRecorder...');
            this.mediaRecorder.start(1000); // Request data every 1000ms
            this.isRecording = true;
            
            // Start the composition loop AFTER setting isRecording = true
            this.startCompositionLoop();
            
            // Iniciar animación circular con overlay
            this.startCircularAnimation();
            
            // Detener automáticamente después del tiempo configurado
            setTimeout(() => {
                this.stopRecording();
            }, this.settings.duration * 1000);
            
            console.log(`VideoRecorder: Started recording for ${this.settings.duration}s`);
            return true;
            
        } catch (error) {
            console.error('VideoRecorder: Error starting recording:', error);
            this.cleanup();
            return false;
        }
    }
    
    stopRecording() {
        if (!this.isRecording) return;
        
        console.log('VideoRecorder: Stopping recording...');
        this.isRecording = false;
        
        // Detener animación
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Detener composición
        if (this.compositionAnimationId) {
            cancelAnimationFrame(this.compositionAnimationId);
            this.compositionAnimationId = null;
        }
        
        // Detener grabación
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            console.log('VideoRecorder: MediaRecorder state:', this.mediaRecorder.state);
            this.mediaRecorder.stop();
        } else {
            console.warn('VideoRecorder: MediaRecorder is already inactive or null');
        }
        
        console.log('VideoRecorder: Recording stopped');
    }
    
    setupVideoCanvas() {
        // Configurar canvas para formato móvil 9:16
        const { width, height } = this.settings.resolution;
        
        this.renderer.setSize(width, height);
        this.camera.aspect = width / height; // Aspecto móvil 9:16
        this.camera.updateProjectionMatrix();
        
        // Position camera to frame all nodes properly
        this.positionCameraForOptimalFraming();
        
        // Create temporary renderer for video recording
        this.createVideoRenderer();
    }
    
    createVideoRenderer() {
        const { width, height } = this.settings.resolution;
        
        // Create a temporary WebGL renderer with preserveDrawingBuffer enabled
        this.videoRenderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            preserveDrawingBuffer: true,
            alpha: false
        });
        
        this.videoRenderer.setSize(width, height);
        this.videoRenderer.setClearColor(0x000000, 1);
        
        // Make sure the scene has lighting for the video renderer
        this.ensureSceneLighting();
        
        // Hide the video renderer canvas (only used for capture)
        this.videoRenderer.domElement.style.display = 'none';
        document.body.appendChild(this.videoRenderer.domElement);
        
        console.log('VideoRecorder: Temporary video renderer created');
    }
    
    ensureSceneLighting() {
        // Check if the scene already has lights
        const existingLights = this.scene.children.filter(child => child.isLight);
        console.log('VideoRecorder: Found', existingLights.length, 'lights in scene');
        
        if (existingLights.length === 0) {
            console.log('VideoRecorder: No lights found, adding ambient light');
            // Add basic lighting if none exists
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(1, 1, 1);
            
            this.scene.add(ambientLight);
            this.scene.add(directionalLight);
            
            console.log('VideoRecorder: Added basic lighting to scene');
        }
    }
    
    createCompositeCanvas() {
        const { width, height } = this.settings.resolution;
        
        // Create composition canvas
        this.compositeCanvas = document.createElement('canvas');
        this.compositeCanvas.width = width;
        this.compositeCanvas.height = height;
        this.compositeCtx = this.compositeCanvas.getContext('2d');
        
        // Hide the composite canvas (only used for recording)
        this.compositeCanvas.style.display = 'none';
        
        document.body.appendChild(this.compositeCanvas);
        
        // Test drawing something immediately to make sure the canvas works
        this.compositeCtx.fillStyle = '#ff0000';
        this.compositeCtx.fillRect(0, 0, 100, 100);
        this.compositeCtx.fillStyle = '#000000';
        this.compositeCtx.font = '20px Arial';
        this.compositeCtx.fillText('TEST', 10, 30);
        
        console.log('VideoRecorder: Composite canvas created', { width, height });
        console.log('VideoRecorder: Test drawing completed');
    }
    
    startCompositionLoop() {
        let frameCount = 0;
        console.log('VideoRecorder: Starting composition loop');
        
        const compose = () => {
            if (!this.isRecording) {
                console.log('VideoRecorder: Composition loop stopped, isRecording:', this.isRecording);
                return;
            }
            
            frameCount++;
            
            // Clear composite canvas - set to black background first  
            this.compositeCtx.fillStyle = '#000000';
            this.compositeCtx.fillRect(0, 0, this.compositeCanvas.width, this.compositeCanvas.height);
            
            // Draw the 3D scene using the video renderer
            try {
                // Check if we have all the components needed
                if (!this.videoRenderer) {
                    console.error('VideoRecorder: Video renderer is null at frame', frameCount);
                    return;
                }
                
                if (!this.scene) {
                    console.error('VideoRecorder: Scene is null at frame', frameCount);
                    return;
                }
                
                if (!this.camera) {
                    console.error('VideoRecorder: Camera is null at frame', frameCount);
                    return;
                }
                
                // Log every 120 frames for debugging (every 2 seconds at 60fps)
                if (frameCount % 120 === 1) {
                    console.log('VideoRecorder: About to render frame', frameCount, {
                        scene: !!this.scene,
                        camera: !!this.camera,
                        videoRenderer: !!this.videoRenderer,
                        sceneChildren: this.scene.children.length,
                        cameraPosition: {
                            x: this.camera.position.x.toFixed(2),
                            y: this.camera.position.y.toFixed(2), 
                            z: this.camera.position.z.toFixed(2)
                        },
                        cameraTarget: {
                            x: this.camera.getWorldDirection(new THREE.Vector3()).x.toFixed(2),
                            y: this.camera.getWorldDirection(new THREE.Vector3()).y.toFixed(2),
                            z: this.camera.getWorldDirection(new THREE.Vector3()).z.toFixed(2)
                        }
                    });
                    
                    // Log the first few children of the scene
                    console.log('VideoRecorder: Scene children:', this.scene.children.slice(0, 5).map(child => ({
                        type: child.type,
                        name: child.name,
                        visible: child.visible,
                        position: child.position ? `${child.position.x.toFixed(1)}, ${child.position.y.toFixed(1)}, ${child.position.z.toFixed(1)}` : 'N/A'
                    })));
                }
                
                // Test cube removed - renderer is working correctly
                
                // Render to the video renderer (which has preserveDrawingBuffer: true)
                this.videoRenderer.render(this.scene, this.camera);
                
                const videoCanvas = this.videoRenderer.domElement;
                
                // Check if video canvas is ready and has content
                if (videoCanvas.width > 0 && videoCanvas.height > 0) {
                    // Try to read a pixel to see if there's actually content
                    const gl = videoCanvas.getContext('webgl');
                    if (gl) {
                        const pixels = new Uint8Array(4);
                        gl.readPixels(videoCanvas.width/2, videoCanvas.height/2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
                        
                        if (frameCount % 30 === 1) {
                            console.log('VideoRecorder: Center pixel:', pixels);
                        }
                    }
                    
                    this.compositeCtx.drawImage(videoCanvas, 0, 0, this.compositeCanvas.width, this.compositeCanvas.height);
                } else {
                    console.warn('VideoRecorder: Video canvas not ready', { width: videoCanvas.width, height: videoCanvas.height });
                }
                
                // Draw overlay elements
                this.drawOverlayElements();
                
                // Draw frame counter for debugging
                this.compositeCtx.fillStyle = '#ffffff';
                this.compositeCtx.font = '20px Arial';
                this.compositeCtx.fillText(`Frame: ${frameCount}`, 10, this.compositeCanvas.height - 30);
                
                // Log every 60 frames (roughly 1 second at 60fps)
                if (frameCount % 30 === 1) { // Log more frequently for debugging
                    console.log('VideoRecorder: Composition frame', frameCount, 'drawing successful');
                }
                
            } catch (error) {
                console.error('VideoRecorder: Composition error at frame', frameCount, ':', error);
            }
            
            this.compositionAnimationId = requestAnimationFrame(compose);
        };
        
        // Start immediately
        compose();
    }
    
    drawOverlayElements() {
        const ctx = this.compositeCtx;
        const canvas = this.compositeCanvas;
        
        ctx.save();
        
        // Draw centered logo and concept text
        this.drawCenteredBranding(ctx, canvas);
        
        ctx.restore();
    }
    
    drawCenteredBranding(ctx, canvas) {
        const centerX = canvas.width / 2;
        const topMargin = 140; // Moved down more
        
        // Create gradient for BeCreativIA title (matching header style)
        const gradient = ctx.createLinearGradient(
            centerX - 200, topMargin, 
            centerX + 200, topMargin + 50
        );
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(1, '#00aaff');
        
        // Draw BeCreativIA title centered (matching header .brand-logo style)
        ctx.font = '600 72px Inter, Arial, sans-serif'; // Larger and matching weight
        ctx.fillStyle = gradient;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        
        ctx.fillText('BeCreativIA', centerX, topMargin);
        
        // Draw concept section below if available
        if (this.currentConcept && this.currentConcept !== 'Concepto') {
            // "EXPLORANDO" label (matching header .concept-label style)
            ctx.font = '300 28px Inter, Arial, sans-serif'; // Matching font-weight: 300
            ctx.fillStyle = 'rgba(136, 136, 136, 0.7)'; // Using --secondary-color with opacity
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            
            const conceptLabelY = topMargin + 120;
            ctx.fillText('EXPLORANDO', centerX, conceptLabelY);
            
            // Create gradient for concept value (matching header .concept-title style)
            const conceptGradient = ctx.createLinearGradient(
                centerX - 150, conceptLabelY + 50, 
                centerX + 150, conceptLabelY + 90
            );
            conceptGradient.addColorStop(0, '#ffffff');
            conceptGradient.addColorStop(1, '#00aaff');
            
            // Concept value (matching header styling)
            ctx.font = '400 48px Inter, Arial, sans-serif'; // Matching font-weight: 400
            ctx.fillStyle = conceptGradient;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            
            const conceptValueY = conceptLabelY + 50;
            ctx.fillText(this.currentConcept.toUpperCase(), centerX, conceptValueY);
        }
    }
    
    positionCameraForOptimalFraming() {
        if (!this.graphRenderer || !this.graphRenderer.nodes) {
            return;
        }
        
        const nodes = Array.from(this.graphRenderer.nodes.values());
        if (nodes.length === 0) return;
        
        // Calculate bounding box of all nodes
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        
        nodes.forEach(nodeData => {
            const pos = nodeData.sphere.position;
            minX = Math.min(minX, pos.x);
            maxX = Math.max(maxX, pos.x);
            minY = Math.min(minY, pos.y);
            maxY = Math.max(maxY, pos.y);
            minZ = Math.min(minZ, pos.z);
            maxZ = Math.max(maxZ, pos.z);
        });
        
        // Calculate center and size
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const centerZ = (minZ + maxZ) / 2;
        
        const sizeX = maxX - minX;
        const sizeY = maxY - minY;
        const sizeZ = maxZ - minZ;
        
        // Calculate optimal distance considering 9:16 aspect ratio
        const maxSize = Math.max(sizeX, sizeY, sizeZ);
        const distance = Math.max(35, maxSize * 1.8); // Ensure proper framing
        
        // Store the center for orbit animation
        this.orbitCenter = new THREE.Vector3(centerX, centerY, centerZ);
        this.orbitRadius = distance;
        
        console.log('VideoRecorder: Optimal framing calculated', {
            center: this.orbitCenter,
            radius: this.orbitRadius,
            nodeCount: nodes.length
        });
    }
    
    restoreOriginalCanvas() {
        // Restaurar tamaño original del canvas
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        
        // Restore labels
        this.restoreLabelsAfterRecording();
    }
    
    saveOriginalCameraState() {
        this.originalCameraPosition = this.camera.position.clone();
        this.originalCameraTarget = this.camera.getWorldDirection(new THREE.Vector3());
    }
    
    restoreOriginalCameraState() {
        if (this.originalCameraPosition) {
            this.camera.position.copy(this.originalCameraPosition);
        }
    }
    
    startCircularAnimation() {
        const center = this.orbitCenter || new THREE.Vector3(0, 0, 0);
        const radius = this.orbitRadius || 35;
        let angle = 0;
        
        const animate = () => {
            if (!this.isRecording) return;
            
            // Rotación circular suave alrededor del centro calculado
            angle += 0.015 * this.settings.rotationSpeed;
            
            // Posición de cámara en círculo alrededor del centro
            this.camera.position.x = center.x + Math.cos(angle) * radius;
            this.camera.position.z = center.z + Math.sin(angle) * radius;
            this.camera.position.y = center.y + Math.sin(angle * 0.3) * (radius * 0.2); // Ligero movimiento vertical suave
            
            // Mirar siempre al centro de los nodos
            this.camera.lookAt(center);
            
            // Render to the main renderer to keep the UI updated
            this.renderer.render(this.scene, this.camera);
            // Note: The composition loop will handle rendering to the video renderer
            
            this.animationId = requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    
    getVideoBitrate() {
        const bitrates = {
            low: 2000000,     // 2 Mbps
            medium: 5000000,  // 5 Mbps
            high: 8000000,    // 8 Mbps
            ultra: 12000000   // 12 Mbps para máxima calidad
        };
        return bitrates[this.settings.quality] || bitrates.ultra;
    }
    
    getBestMimeType() {
        // Try to use the best available codec
        const types = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus', 
            'video/webm;codecs=h264,opus',
            'video/webm',
            'video/mp4;codecs=h264,aac',
            'video/mp4'
        ];
        
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                console.log('VideoRecorder: Using codec', type);
                return type;
            }
        }
        
        return 'video/webm'; // fallback
    }
    
    finishRecording() {
        console.log('VideoRecorder: finishRecording called with chunks:', this.recordedChunks.length);
        
        if (this.recordedChunks.length === 0) {
            console.error('VideoRecorder: No data recorded');
            this.cleanup();
            return;
        }
        
        // Calculate total size
        const totalSize = this.recordedChunks.reduce((sum, chunk) => sum + chunk.size, 0);
        console.log('VideoRecorder: Total recorded size:', totalSize, 'bytes');
        
        // Crear blob del video
        const mimeType = this.getBestMimeType();
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        
        console.log('VideoRecorder: Created blob:', blob.size, 'bytes, type:', blob.type);
        
        // Descargar automáticamente
        this.downloadVideo(blob);
        
        // Limpiar
        this.cleanup();
    }
    
    downloadVideo(blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const conceptName = this.currentConcept ? this.currentConcept.replace(/\s+/g, '-').toLowerCase() : 'concepto';
        a.href = url;
        a.download = `becreativia-${conceptName}-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('VideoRecorder: Video downloaded successfully in 9:16 mobile format');
        
        // Disparar evento personalizado
        window.dispatchEvent(new CustomEvent('videoRecorded', {
            detail: { 
                success: true, 
                format: this.settings.format,
                concept: this.currentConcept,
                resolution: this.settings.resolution,
                aspectRatio: '9:16'
            }
        }));
    }
    
    cleanup() {
        // Restore original render function
        if (this.originalRender) {
            this.renderer.render = this.originalRender;
            this.originalRender = null;
        }
        
        // Clean up composite canvas
        if (this.compositeCanvas && this.compositeCanvas.parentNode) {
            this.compositeCanvas.parentNode.removeChild(this.compositeCanvas);
        }
        this.compositeCanvas = null;
        this.compositeCtx = null;
        
        // Clean up video renderer
        if (this.videoRenderer) {
            if (this.videoRenderer.domElement && this.videoRenderer.domElement.parentNode) {
                this.videoRenderer.domElement.parentNode.removeChild(this.videoRenderer.domElement);
            }
            this.videoRenderer.dispose();
            this.videoRenderer = null;
        }
        
        // Restaurar estado original
        this.restoreOriginalCanvas();
        this.restoreOriginalCameraState();
        
        // Limpiar variables
        this.recordedChunks = [];
        this.mediaRecorder = null;
        this.isRecording = false;
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        if (this.compositionAnimationId) {
            cancelAnimationFrame(this.compositionAnimationId);
            this.compositionAnimationId = null;
        }
    }
    
    // Método estático para verificar compatibilidad
    static isSupported() {
        return !!(navigator.mediaDevices && 
                 navigator.mediaDevices.getDisplayMedia && 
                 window.MediaRecorder &&
                 HTMLCanvasElement.prototype.captureStream);
    }
    
    // Método para obtener configuraciones disponibles
    getAvailableSettings() {
        return {
            durations: [5, 10, 15, 20],
            qualities: ['low', 'medium', 'high'],
            formats: ['webm', 'mp4'],
            rotationSpeeds: [0.3, 0.5, 0.8, 1.2]
        };
    }
    
    // New methods for handling labels and overlays
    hideLabelsForRecording() {
        if (this.graphRenderer && typeof this.graphRenderer.toggleLabels === 'function') {
            // Store current state
            this.labelsWereVisible = this.graphRenderer.labelsVisible;
            
            // Hide labels if they are currently visible
            if (this.labelsWereVisible) {
                this.graphRenderer.toggleLabels();
                console.log('VideoRecorder: Labels hidden for recording');
            }
        }
    }
    
    restoreLabelsAfterRecording() {
        if (this.graphRenderer && typeof this.graphRenderer.toggleLabels === 'function') {
            // Restore labels if they were visible before recording
            if (this.labelsWereVisible && !this.graphRenderer.labelsVisible) {
                this.graphRenderer.toggleLabels();
                console.log('VideoRecorder: Labels restored after recording');
            }
        }
    }
    
    
    // Destructor para eliminar completamente el módulo
    destroy() {
        this.stopRecording();
        this.cleanup();
        
        console.log('VideoRecorder: Module destroyed');
    }
}

// Función de utilidad para verificar si el módulo debe cargarse
export const shouldLoadVideoRecorder = () => {
    return VideoRecorder.isSupported() && 
           !window.location.search.includes('no-video');
};