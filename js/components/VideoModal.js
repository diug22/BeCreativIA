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
    
    // Función para crear iconos SVG consistentes
    createIcon(type, size = 16) {
        const icons = {
            video: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>`,
            clock: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12,6 12,12 16,14"></polyline>
            </svg>`,
            settings: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1m17.5-2.5L20 12l2.5 2.5M6.5 9.5L4 12l2.5 2.5"></path>
            </svg>`,
            rotate: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>`,
            smartphone: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                <line x1="12" y1="18" x2="12.01" y2="18"></line>
            </svg>`,
            play: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>`,
            x: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>`
        };
        return icons[type] || '';
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
                    <h2>${this.createIcon('video', 18)} Crear Video para Redes Sociales</h2>
                    <button class="video-modal-close" data-action="close">${this.createIcon('x', 16)}</button>
                </div>
                
                <div class="video-modal-body">
                    <div class="video-setting">
                        <label>${this.createIcon('clock', 14)} Duración</label>
                        <select id="video-duration">
                            <option value="5">5 segundos (Stories)</option>
                            <option value="10" selected>10 segundos (Recomendado)</option>
                            <option value="15">15 segundos (TikTok)</option>
                            <option value="20">20 segundos (LinkedIn)</option>
                        </select>
                    </div>
                    
                    <div class="video-setting">
                        <label>${this.createIcon('settings', 14)} Calidad</label>
                        <select id="video-quality">
                            <option value="medium">Media (Rápido)</option>
                            <option value="high" selected>Alta (Recomendado)</option>
                            <option value="low">Baja (Pruebas)</option>
                        </select>
                    </div>
                    
                    <div class="video-setting">
                        <label>${this.createIcon('rotate', 14)} Velocidad de Rotación</label>
                        <select id="video-speed">
                            <option value="0.3">Muy Lenta (Elegante)</option>
                            <option value="0.5" selected>Lenta (Contemplativa)</option>
                            <option value="0.8">Normal</option>
                            <option value="1.2">Rápida (Dinámica)</option>
                        </select>
                    </div>
                    
                    <div class="video-setting">
                        <label>${this.createIcon('smartphone', 14)} Formato</label>
                        <select id="video-format">
                            <option value="webm" selected>WebM (Recomendado)</option>
                            <option value="mp4">MP4 (Experimental)</option>
                        </select>
                    </div>
                    
                    <div class="video-preview">
                        <div class="video-preview-icon">${this.createIcon('video', 32)}</div>
                        <p>Tu grafo girará 360° con una cámara suave y se descargará automáticamente</p>
                        <small>Perfecto para Instagram, TikTok, LinkedIn y Twitter</small>
                    </div>
                </div>
                
                <div class="video-modal-footer">
                    <button class="video-btn video-btn-secondary" data-action="close">
                        Cancelar
                    </button>
                    <button class="video-btn video-btn-primary" id="start-recording">
                        <span class="video-btn-text">${this.createIcon('play', 14)} Crear Video</span>
                        <span class="video-btn-loading hidden">${this.createIcon('video', 14)} Grabando...</span>
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
                background: rgba(0, 0, 0, 0.92);
                backdrop-filter: blur(25px);
            }
            
            .video-modal-content {
                position: relative;
                background: rgba(0, 0, 0, 0.95);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                padding: 0;
                max-width: 480px;
                width: 90vw;
                max-height: 90vh;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(25px);
                transform: scale(1);
                transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .video-modal.hidden .video-modal-content {
                transform: scale(0.95);
            }
            
            .video-modal-header {
                padding: 1.5rem 1.5rem 1rem 1.5rem;
                border-bottom: 1px solid var(--border-color);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .video-modal-header h2 {
                margin: 0;
                color: var(--primary-color);
                font-size: 1.25rem;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            
            .video-modal-header h2 svg {
                color: var(--accent-color);
                -webkit-text-fill-color: var(--accent-color);
            }
            
            .video-modal-close {
                background: none;
                border: none;
                color: var(--secondary-color);
                font-size: 1.5rem;
                cursor: pointer;
                padding: 0;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 6px;
                transition: all 0.2s ease;
            }
            
            .video-modal-close:hover {
                background: rgba(255, 255, 255, 0.08);
                color: var(--primary-color);
            }
            
            .video-modal-body {
                padding: 1rem 1.5rem;
                max-height: 400px;
                overflow-y: auto;
            }
            
            .video-setting {
                margin-bottom: 1.25rem;
            }
            
            .video-setting label {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                margin-bottom: 0.5rem;
                color: var(--primary-color);
                font-weight: 400;
                font-size: 0.9rem;
            }
            
            .video-setting label svg {
                opacity: 0.8;
            }
            
            .video-setting select {
                width: 100%;
                padding: 0.75rem 1rem;
                background: rgba(255, 255, 255, 0.04);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                color: var(--primary-color);
                font-size: 0.9rem;
                font-family: 'Inter', sans-serif;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .video-setting select:hover {
                background: rgba(255, 255, 255, 0.06);
                border-color: rgba(0, 170, 255, 0.4);
            }
            
            .video-setting select:focus {
                outline: none;
                border-color: var(--accent-color);
                box-shadow: 0 0 0 2px rgba(0, 170, 255, 0.2);
            }
            
            .video-setting select option {
                background: var(--background-color);
                color: var(--primary-color);
                padding: 0.5rem;
            }
            
            .video-preview {
                background: rgba(0, 170, 255, 0.08);
                border: 1px solid rgba(0, 170, 255, 0.2);
                border-radius: 8px;
                padding: 1.25rem;
                text-align: center;
                margin-top: 1rem;
            }
            
            .video-preview-icon {
                font-size: 2rem;
                margin-bottom: 0.5rem;
            }
            
            .video-preview p {
                margin: 0 0 0.5rem 0;
                color: var(--primary-color);
                font-size: 0.85rem;
            }
            
            .video-preview small {
                color: var(--accent-color);
                font-size: 0.75rem;
            }
            
            .video-modal-footer {
                padding: 1.25rem 1.5rem 1.5rem 1.5rem;
                border-top: 1px solid var(--border-color);
                display: flex;
                gap: 0.75rem;
                justify-content: flex-end;
            }
            
            .video-btn {
                padding: 0.75rem 1.25rem;
                border-radius: 8px;
                font-size: 0.85rem;
                font-weight: 400;
                font-family: 'Inter', sans-serif;
                cursor: pointer;
                transition: all 0.2s ease;
                border: none;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .video-btn svg {
                opacity: 0.9;
            }
            
            .video-btn-secondary {
                background: rgba(255, 255, 255, 0.06);
                color: var(--primary-color);
                border: 1px solid var(--border-color);
            }
            
            .video-btn-secondary:hover {
                background: rgba(255, 255, 255, 0.1);
                border-color: rgba(255, 255, 255, 0.3);
            }
            
            .video-btn-primary {
                background: var(--accent-color);
                color: var(--primary-color);
                border: none;
                box-shadow: 0 2px 8px rgba(0, 170, 255, 0.25);
            }
            
            .video-btn-primary:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(0, 170, 255, 0.35);
                background: #0099ee;
            }
            
            .video-btn-primary:disabled {
                opacity: 0.6;
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
        // Get current concept from header
        const conceptTitleEl = document.getElementById('concept-title') || document.getElementById('mobile-concept-title');
        const currentConcept = conceptTitleEl ? conceptTitleEl.textContent.trim() : 'Concepto';
        
        return {
            duration: parseInt(this.modal.querySelector('#video-duration').value),
            quality: this.modal.querySelector('#video-quality').value,
            rotationSpeed: parseFloat(this.modal.querySelector('#video-speed').value),
            format: this.modal.querySelector('#video-format').value,
            concept: currentConcept // Pass current concept to video recorder
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
        this.modal.querySelector('#video-speed').value = '0.5';
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