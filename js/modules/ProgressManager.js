export class ProgressManager {
    constructor() {
        this.totalNodes = 0;
        this.currentNodes = 0;
        this.generatedConcepts = [];
        this.progressOverlay = document.getElementById('progressOverlay');
        this.progressBar = document.getElementById('progressBar');
        this.progressInfo = document.getElementById('progressInfo');
        this.progressConcepts = document.getElementById('progressConcepts');
    }

    calculateMaxNodes(cycles) {
        // 3^n formula for maximum possible nodes
        let total = 1; // Initial concept
        for (let i = 0; i < cycles; i++) {
            total += Math.pow(3, i + 1);
        }
        return total;
    }

    startProgress(cycles) {
        this.totalNodes = this.calculateMaxNodes(cycles);
        this.currentNodes = 0;
        this.generatedConcepts = [];
        this.updateProgress();
        this.showProgress();
        this.setStatus('Iniciando análisis...');
    }

    addConcept(concept) {
        this.currentNodes++;
        this.generatedConcepts.push(concept);
        //this.addConceptToUI(concept);
        this.updateProgress();
    }

    addConceptToUI(concept) {
        if (this.progressConcepts) {
            const conceptElement = document.createElement('div');
            conceptElement.className = 'progress-concept';
            conceptElement.textContent = concept;
            this.progressConcepts.appendChild(conceptElement);
            
            // Scroll to bottom if needed
            this.progressConcepts.scrollTop = this.progressConcepts.scrollHeight;
        }
    }

    updateProgress() {
        if (this.progressBar) {
            const percentage = Math.min((this.currentNodes / this.totalNodes) * 100, 100);
            this.progressBar.style.width = `${percentage}%`;
        }
    }

    setStatus(message) {
        if (this.progressInfo) {
            this.progressInfo.textContent = message;
        }
    }

    completeProgress() {
        if (this.progressBar) {
            this.progressBar.style.width = '100%';
            this.setStatus(`¡Completado! ${this.currentNodes} conceptos generados`);
            
            setTimeout(() => {
                this.hideProgress();
            }, 2500);
        }
    }

    showProgress() {
        if (this.progressOverlay) {
            this.progressOverlay.style.display = 'block';
        }
    }

    hideProgress() {
        if (this.progressOverlay) {
            this.progressOverlay.style.display = 'none';
        }
        
        // Clear concepts
        if (this.progressConcepts) {
            this.progressConcepts.innerHTML = '';
        }
        
        this.generatedConcepts = [];
        this.currentNodes = 0;
    }
}