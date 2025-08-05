/**
 * VideoRecorder - Módulo desacoplable para grabar videos del grafo 3D
 * Puede eliminarse completamente sin afectar la funcionalidad principal
 */
import * as THREE from 'three';
export class VideoRecorder {
    constructor(renderer, scene, camera) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.isRecording = false;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.originalCameraPosition = null;
        this.originalCameraTarget = null;
        this.animationId = null;
        
        // Configuraciones por defecto
        this.settings = {
            duration: 10, // segundos
            fps: 30,
            quality: 'high', // 'high', 'medium', 'low'
            rotationSpeed: 1, // velocidad de rotación
            format: 'webm' // 'webm', 'mp4'
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
            
            // Configurar canvas para video (cuadrado para Instagram)
            this.setupVideoCanvas();
            
            // Guardar posición original de la cámara
            this.saveOriginalCameraState();
            
            // Configurar MediaRecorder
            const stream = this.renderer.domElement.captureStream(this.settings.fps);
            
            const mimeType = this.settings.format === 'mp4' ? 'video/mp4' : 'video/webm';
            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType: mimeType,
                videoBitsPerSecond: this.getVideoBitrate()
            });
            
            this.recordedChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                this.finishRecording();
            };
            
            // Inicar grabación
            this.mediaRecorder.start();
            this.isRecording = true;
            
            // Iniciar animación circular
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
        
        this.isRecording = false;
        
        // Detener animación
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Detener grabación
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        
        console.log('VideoRecorder: Recording stopped');
    }
    
    setupVideoCanvas() {
        // Configurar canvas para formato cuadrado (Instagram)
        const size = Math.min(window.innerWidth, window.innerHeight, 1080);
        this.renderer.setSize(size, size);
        this.camera.aspect = 1; // Aspecto cuadrado
        this.camera.updateProjectionMatrix();
    }
    
    restoreOriginalCanvas() {
        // Restaurar tamaño original del canvas
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
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
        const radius = 25; // Radio de la órbita
        const centerY = 0;   // Centro Y
        let angle = 0;
        
        const animate = () => {
            if (!this.isRecording) return;
            
            // Rotación circular suave
            angle += 0.02 * this.settings.rotationSpeed;
            
            // Posición de cámara en círculo
            this.camera.position.x = Math.cos(angle) * radius;
            this.camera.position.z = Math.sin(angle) * radius;
            this.camera.position.y = centerY + Math.sin(angle * 0.5) * 3; // Ligero movimiento vertical
            
            // Mirar siempre al centro
            this.camera.lookAt(0, 0, 0);
            
            this.animationId = requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    getVideoBitrate() {
        const bitrates = {
            low: 1000000,    // 1 Mbps
            medium: 2500000, // 2.5 Mbps
            high: 5000000    // 5 Mbps
        };
        return bitrates[this.settings.quality] || bitrates.high;
    }
    
    finishRecording() {
        if (this.recordedChunks.length === 0) {
            console.error('VideoRecorder: No data recorded');
            this.cleanup();
            return;
        }
        
        // Crear blob del video
        const blob = new Blob(this.recordedChunks, {
            type: this.settings.format === 'mp4' ? 'video/mp4' : 'video/webm'
        });
        
        // Descargar automáticamente
        this.downloadVideo(blob);
        
        // Limpiar
        this.cleanup();
    }
    
    downloadVideo(blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `becreativia-concept-${Date.now()}.${this.settings.format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('VideoRecorder: Video downloaded successfully');
        
        // Disparar evento personalizado
        window.dispatchEvent(new CustomEvent('videoRecorded', {
            detail: { success: true, format: this.settings.format }
        }));
    }
    
    cleanup() {
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