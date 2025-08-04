/**
 * Progress Bar Component - Desacoplado
 * Maneja la barra de progreso durante la fase de crecimiento del grafo
 */
export class ProgressBar {
    constructor() {
        this.container = null;
        this.progressBar = null;
        this.progressFill = null;
        this.statusText = null;
        this.conceptsList = null;
        this.isVisible = false;
        
        // Estado interno
        this.progress = 0;
        this.maxNodes = 0;
        this.currentNodes = 0;
        this.loadedConcepts = [];
        
        this.createElements();
    }
    
    createElements() {
        // Container principal
        this.container = document.createElement('div');
        this.container.id = 'growth-progress-container';
        this.container.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            width: 100%;
            background: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.9) 100%);
            padding: 2rem 2rem 1.5rem;
            z-index: 999;
            transform: translateY(100%);
            transition: transform 0.5s ease-in-out;
            backdrop-filter: blur(10px);
        `;
        
        // Contenedor de la barra de progreso
        const progressContainer = document.createElement('div');
        progressContainer.style.cssText = `
            max-width: 800px;
            margin: 0 auto;
            display: flex;
            flex-direction: column;
            gap: 1rem;
        `;
        
        // Status text
        this.statusText = document.createElement('div');
        this.statusText.style.cssText = `
            color: #ffffff;
            font-size: 0.875rem;
            font-weight: 300;
            text-align: center;
            opacity: 0.8;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        `;
        this.statusText.textContent = 'Generando conceptos...';
        
        // Progress bar background
        this.progressBar = document.createElement('div');
        this.progressBar.style.cssText = `
            width: 100%;
            height: 4px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 2px;
            overflow: hidden;
            position: relative;
        `;
        
        // Progress bar fill
        this.progressFill = document.createElement('div');
        this.progressFill.style.cssText = `
            height: 100%;
            background: linear-gradient(90deg, #00aaff, #0088cc);
            border-radius: 2px;
            width: 0%;
            transition: width 0.3s ease-out;
            position: relative;
            overflow: hidden;
        `;
        
        // Progress bar glow effect
        const progressGlow = document.createElement('div');
        progressGlow.style.cssText = `
            position: absolute;
            top: -2px;
            left: -10px;
            right: -10px;
            bottom: -2px;
            background: linear-gradient(90deg, transparent, rgba(0, 170, 255, 0.4), transparent);
            border-radius: 4px;
            animation: progressGlow 2s ease-in-out infinite alternate;
        `;
        
        // Concepts list
        this.conceptsList = document.createElement('div');
        this.conceptsList.style.cssText = `
            display: flex;
            justify-content: center;
            gap: 0.5rem;
            flex-wrap: wrap;
            margin-top: 0.5rem;
            min-height: 1.5rem;
        `;
        
        // Progress counter
        this.progressCounter = document.createElement('div');
        this.progressCounter.style.cssText = `
            color: #888888;
            font-size: 0.75rem;
            font-weight: 300;
            text-align: center;
            margin-top: 0.25rem;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        `;
        
        // Ensamblaje
        this.progressFill.appendChild(progressGlow);
        this.progressBar.appendChild(this.progressFill);
        
        progressContainer.appendChild(this.statusText);
        progressContainer.appendChild(this.progressBar);
        progressContainer.appendChild(this.progressCounter);
        progressContainer.appendChild(this.conceptsList);
        
        this.container.appendChild(progressContainer);
        
        // Agregar estilos de animación
        this.addStyles();
        
        // Agregar al DOM
        document.body.appendChild(this.container);
    }
    
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes progressGlow {
                0% { opacity: 0.5; }
                100% { opacity: 1; }
            }
            
            @keyframes conceptAppear {
                0% {
                    opacity: 0;
                    transform: translateY(10px) scale(0.8);
                }
                100% {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
            
            .concept-tag {
                background: rgba(0, 170, 255, 0.1);
                border: 1px solid rgba(0, 170, 255, 0.3);
                color: #00aaff;
                padding: 0.25rem 0.75rem;
                border-radius: 12px;
                font-size: 0.75rem;
                font-weight: 300;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                animation: conceptAppear 0.5s ease-out;
                transition: all 0.2s ease;
            }
            
            .concept-tag:hover {
                background: rgba(0, 170, 255, 0.2);
                transform: scale(1.05);
            }
            
            @media (max-width: 768px) {
                #growth-progress-container {
                    padding: 1.5rem 1rem 1rem;
                }
                
                .concept-tag {
                    font-size: 0.7rem;
                    padding: 0.2rem 0.6rem;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    show() {
        if (this.isVisible) return;
        
        this.isVisible = true;
        this.container.style.transform = 'translateY(0)';
        console.log('ProgressBar: Shown');
    }
    
    hide() {
        if (!this.isVisible) return;
        
        this.isVisible = false;
        this.container.style.transform = 'translateY(100%)';
        
        // Reset after hide animation
        setTimeout(() => {
            this.reset();
        }, 500);
        
        console.log('ProgressBar: Hidden');
    }
    
    setProgress(current, max) {
        this.currentNodes = current;
        this.maxNodes = max;
        this.progress = max > 0 ? (current / max) * 100 : 0;
        
        // Update progress bar
        this.progressFill.style.width = `${this.progress}%`;
        
        // Update counter
        this.progressCounter.textContent = `${current} / ${max} conceptos`;
        
        console.log(`ProgressBar: Progress ${current}/${max} (${this.progress.toFixed(1)}%)`);
    }
    
    setStatus(status) {
        this.statusText.textContent = status;
    }
    
    addConcept(concept) {
        if (this.loadedConcepts.includes(concept)) return;
        
        this.loadedConcepts.push(concept);
        
        // Create concept tag
        const conceptTag = document.createElement('span');
        conceptTag.className = 'concept-tag';
        conceptTag.textContent = concept;
        conceptTag.title = `Concepto: ${concept}`;
        
        // Add to concepts list
        this.conceptsList.appendChild(conceptTag);
        
        // Limit visible concepts (keep last 10)
        while (this.conceptsList.children.length > 10) {
            this.conceptsList.removeChild(this.conceptsList.firstChild);
        }
        
        console.log(`ProgressBar: Added concept '${concept}'`);
    }
    
    updateStatus(status, progress = null) {
        this.setStatus(status);
        
        if (progress !== null) {
            this.setProgress(progress.current, progress.max);
        }
    }
    
    setComplete() {
        this.setProgress(this.maxNodes, this.maxNodes);
        this.setStatus('¡Generación completada!');
        
        // Auto-hide after a delay
        setTimeout(() => {
            this.hide();
        }, 2000);
    }
    
    reset() {
        this.progress = 0;
        this.maxNodes = 0;
        this.currentNodes = 0;
        this.loadedConcepts = [];
        
        this.progressFill.style.width = '0%';
        this.statusText.textContent = 'Generando conceptos...';
        this.progressCounter.textContent = '0 / 0 conceptos';
        this.conceptsList.innerHTML = '';
        
        console.log('ProgressBar: Reset');
    }
    
    getProgress() {
        return {
            progress: this.progress,
            current: this.currentNodes,
            max: this.maxNodes,
            concepts: [...this.loadedConcepts]
        };
    }
    
    isShown() {
        return this.isVisible;
    }
    
    // Cleanup
    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        
        this.container = null;
        this.progressBar = null;
        this.progressFill = null;
        this.statusText = null;
        this.conceptsList = null;
        this.loadedConcepts = [];
        
        console.log('ProgressBar: Destroyed');
    }
}