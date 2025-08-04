/**
 * VideoModal - Modal desacoplable para configurar la grabación de video
 * Puede eliminarse junto con VideoRecorder sin afectar la app principal
 */
export class VideoModal {
    constructor(videoRecorder) {
        this.videoRecorder = videoRecorder;
        this.modal = null;
        this.isVisible = false;
        
        this.createModal();
        this.setupEventListeners();
        
        console.log('VideoModal: Initialized as standalone component');
    }
    
    createModal() {
        // Crear modal HTML
        this.modal = document.createElement('div');
        this.modal.id = 'video-modal';
        this.modal.className = 'video-modal hidden';
        
        this.modal.innerHTML = `
            <div class="video-modal-backdrop" data-action="close"></div>
            <div class="video-modal-content">
                <div class="video-modal-header">
                    <h2>📹 Crear Video para Redes Sociales</h2>
                    <button class="video-modal-close" data-action="close">×</button>
                </div>
                
                <div class="video-modal-body">
                    <div class="video-setting">
                        <label>⏱️ Duración</label>
                        <select id="video-duration">
                            <option value="5">5 segundos (Stories)</option>
                            <option value="10" selected>10 segundos (Recomendado)</option>
                            <option value="15">15 segundos (TikTok)</option>
                            <option value="20">20 segundos (LinkedIn)</option>
                        </select>
                    </div>
                    
                    <div class="video-setting">
                        <label>🎨 Calidad</label>
                        <select id="video-quality">
                            <option value="medium">Media (Rápido)</option>
                            <option value="high" selected>Alta (Recomendado)</option>
                            <option value="low">Baja (Pruebas)</option>
                        </select>
                    </div>
                    
                    <div class="video-setting">
                        <label>🔄 Velocidad de Rotación</label>
                        <select id="video-speed">
                            <option value="0.5">Lenta (Contemplativa)</option>
                            <option value="1" selected>Normal</option>
                            <option value="1.5">Rápida (Dinámica)</option>
                            <option value="2">Muy Rápida</option>
                        </select>
                    </div>
                    
                    <div class="video-setting">
                        <label>📱 Formato</label>
                        <select id="video-format">
                            <option value="webm" selected>WebM (Recomendado)</option>
                            <option value="mp4">MP4 (Experimental)</option>
                        </select>
                    </div>
                    
                    <div class="video-preview">
                        <div class="video-preview-icon">🎬</div>
                        <p>Tu grafo girará 360° con una cámara suave y se descargará automáticamente</p>
                        <small>Perfecto para Instagram, TikTok, LinkedIn y Twitter</small>
                    </div>
                </div>
                
                <div class="video-modal-footer">
                    <button class="video-btn video-btn-secondary" data-action="close">
                        Cancelar
                    </button>
                    <button class="video-btn video-btn-primary" id="start-recording">
                        <span class="video-btn-text">🎬 Crear Video</span>
                        <span class="video-btn-loading hidden">🎥 Grabando...</span>
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(this.modal);
        this.addStyles();
    }
    
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .video-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 1;
                visibility: visible;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .video-modal.hidden {
                opacity: 0;
                visibility: hidden;
                pointer-events: none;
            }
            
            .video-modal-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(10px);
            }
            
            .video-modal-content {
                position: relative;
                background: linear-gradient(135deg, rgba(0, 0, 0, 0.95), rgba(20, 20, 20, 0.95));
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 16px;
                padding: 0;
                max-width: 500px;
                width: 90vw;
                max-height: 90vh;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(20px);
                transform: scale(1);
                transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .video-modal.hidden .video-modal-content {
                transform: scale(0.9);
            }
            
            .video-modal-header {
                padding: 2rem 2rem 1rem 2rem;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .video-modal-header h2 {
                margin: 0;
                color: #ffffff;
                font-size: 1.5rem;
                font-weight: 600;
                background: linear-gradient(135deg, #ffffff, #00aaff);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            
            .video-modal-close {
                background: none;
                border: none;
                color: #888;
                font-size: 2rem;
                cursor: pointer;
                padding: 0;
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 8px;
                transition: all 0.2s ease;
            }
            
            .video-modal-close:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #ffffff;
            }
            
            .video-modal-body {
                padding: 1.5rem 2rem;
                max-height: 400px;
                overflow-y: auto;
            }
            
            .video-setting {
                margin-bottom: 1.5rem;
            }
            
            .video-setting label {
                display: block;
                margin-bottom: 0.5rem;
                color: #ffffff;
                font-weight: 500;
                font-size: 0.95rem;
            }
            
            .video-setting select {
                width: 100%;
                padding: 0.75rem 1rem;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                color: #ffffff;
                font-size: 0.9rem;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .video-setting select:hover {
                background: rgba(255, 255, 255, 0.08);
                border-color: rgba(0, 170, 255, 0.3);
            }
            
            .video-setting select:focus {
                outline: none;
                border-color: rgba(0, 170, 255, 0.5);
                box-shadow: 0 0 0 3px rgba(0, 170, 255, 0.2);
            }
            
            .video-preview {
                background: rgba(0, 170, 255, 0.1);
                border: 1px solid rgba(0, 170, 255, 0.2);
                border-radius: 12px;
                padding: 1.5rem;
                text-align: center;
                margin-top: 1.5rem;
            }
            
            .video-preview-icon {
                font-size: 2.5rem;
                margin-bottom: 0.5rem;
            }
            
            .video-preview p {
                margin: 0 0 0.5rem 0;
                color: #ffffff;
                font-size: 0.9rem;
            }
            
            .video-preview small {
                color: #00aaff;
                font-size: 0.8rem;
            }
            
            .video-modal-footer {
                padding: 1.5rem 2rem 2rem 2rem;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                display: flex;
                gap: 1rem;
                justify-content: flex-end;
            }
            
            .video-btn {
                padding: 0.75rem 1.5rem;
                border-radius: 8px;
                font-size: 0.9rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                border: none;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .video-btn-secondary {
                background: rgba(255, 255, 255, 0.1);
                color: #ffffff;
                border: 1px solid rgba(255, 255, 255, 0.2);
            }
            
            .video-btn-secondary:hover {
                background: rgba(255, 255, 255, 0.15);
            }
            
            .video-btn-primary {
                background: linear-gradient(135deg, #00aaff, #0088cc);
                color: #ffffff;
                border: none;
                box-shadow: 0 4px 15px rgba(0, 170, 255, 0.3);
            }
            
            .video-btn-primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(0, 170, 255, 0.4);
            }
            
            .video-btn-primary:disabled {
                opacity: 0.7;
                transform: none;
                cursor: not-allowed;
            }
            
            .hidden {
                display: none !important;
            }
            
            /* Mobile responsive */
            @media (max-width: 600px) {
                .video-modal-content {
                    width: 95vw;
                    margin: 0 10px;
                }
                
                .video-modal-header {
                    padding: 1.5rem 1.5rem 1rem 1.5rem;
                }
                
                .video-modal-header h2 {
                    font-size: 1.3rem;
                }
                
                .video-modal-body {
                    padding: 1rem 1.5rem;
                }
                
                .video-modal-footer {
                    padding: 1rem 1.5rem 1.5rem 1.5rem;
                    flex-direction: column;
                }
                
                .video-btn {
                    width: 100%;
                    justify-content: center;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    setupEventListeners() {
        // Cerrar modal
        this.modal.addEventListener('click', (e) => {
            if (e.target.dataset.action === 'close') {
                this.hide();
            }
        });
        
        // Iniciar grabación
        const startBtn = this.modal.querySelector('#start-recording');
        startBtn.addEventListener('click', () => {
            this.startRecording();
        });
        
        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }
    
    show() {
        this.isVisible = true;
        this.modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        
        // Track analytics if available
        if (window.va) {
            window.va('track', 'Video Modal Opened');
        }
    }
    
    hide() {
        this.isVisible = false;
        this.modal.classList.add('hidden');
        document.body.style.overflow = '';
        
        // Reset form
        this.resetForm();
    }
    
    async startRecording() {
        // Obtener configuraciones del formulario
        const settings = this.getFormSettings();
        
        // UI de cargando
        this.setRecordingState(true);
        
        try {
            const success = await this.videoRecorder.startRecording(settings);
            
            if (success) {
                // Cerrar modal y mostrar progreso
                this.hide();
                this.showRecordingProgress(settings.duration);
                
                // Track analytics
                if (window.va) {
                    window.va('track', 'Video Recording Started', {
                        duration: settings.duration,
                        quality: settings.quality,
                        format: settings.format
                    });
                }
            } else {
                throw new Error('Failed to start recording');
            }
        } catch (error) {
            console.error('VideoModal: Recording failed:', error);
            alert('Error al iniciar la grabación. Por favor, intenta de nuevo.');
            
            // Track error
            if (window.va) {
                window.va('track', 'Video Recording Error', {
                    error: error.message
                });
            }
        } finally {
            this.setRecordingState(false);
        }
    }
    
    getFormSettings() {
        return {
            duration: parseInt(this.modal.querySelector('#video-duration').value),
            quality: this.modal.querySelector('#video-quality').value,
            rotationSpeed: parseFloat(this.modal.querySelector('#video-speed').value),
            format: this.modal.querySelector('#video-format').value
        };
    }
    
    setRecordingState(isRecording) {
        const btn = this.modal.querySelector('#start-recording');
        const textSpan = btn.querySelector('.video-btn-text');
        const loadingSpan = btn.querySelector('.video-btn-loading');
        
        btn.disabled = isRecording;
        
        if (isRecording) {
            textSpan.classList.add('hidden');
            loadingSpan.classList.remove('hidden');
        } else {
            textSpan.classList.remove('hidden');
            loadingSpan.classList.add('hidden');
        }
    }
    
    showRecordingProgress(duration) {
        // Crear indicador de progreso temporal
        const progress = document.createElement('div');
        progress.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            z-index: 10001;
            font-family: 'Inter', sans-serif;
            border: 1px solid rgba(0, 170, 255, 0.3);
            backdrop-filter: blur(10px);
        `;
        progress.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <div style="width: 12px; height: 12px; background: #ff4444; border-radius: 50%; animation: pulse 1s infinite;"></div>
                <span>Grabando video... <span id="countdown">${duration}</span>s</span>
            </div>
        `;
        
        document.body.appendChild(progress);
        
        // Countdown
        let remaining = duration;
        const interval = setInterval(() => {
            remaining--;
            const countdownEl = progress.querySelector('#countdown');
            if (countdownEl) countdownEl.textContent = remaining;
            
            if (remaining <= 0) {
                clearInterval(interval);
                progress.remove();
            }
        }, 1000);
        
        // Limpiar en caso de que algo falle
        setTimeout(() => {
            clearInterval(interval);
            if (progress.parentElement) progress.remove();
        }, (duration + 2) * 1000);
    }
    
    resetForm() {
        // Resetear formulario a valores por defecto
        this.modal.querySelector('#video-duration').value = '10';
        this.modal.querySelector('#video-quality').value = 'high';
        this.modal.querySelector('#video-speed').value = '1';
        this.modal.querySelector('#video-format').value = 'webm';
    }
    
    // Destructor
    destroy() {
        if (this.modal && this.modal.parentElement) {
            this.modal.remove();
        }
        document.body.style.overflow = '';
        console.log('VideoModal: Component destroyed');
    }
}