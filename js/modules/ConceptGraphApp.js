import { GraphRenderer } from './GraphRenderer.js';
import { ProgressManager } from './ProgressManager.js';
import { ApiService } from '../services/ApiService.js';
import { ConceptUtils } from '../utils/ConceptUtils.js';

export class ConceptGraphApp {
    constructor() {
        this.renderer = new GraphRenderer();
        this.progressManager = new ProgressManager();
        this.apiService = new ApiService();
        this.isGenerating = false;
        
        this.initializeUI();
    }

    initializeUI() {
        // Initialize cycle counter
        this.cycleCount = 3;
        this.updateCycleDisplay();

        // Bind event listeners
        this.bindEventListeners();

        // Bind global functions for backward compatibility
        window.startGeneration = () => this.startGeneration();
        window.resetGraph = () => this.resetGraph();
        window.toggleLabels = () => this.toggleLabels();
        window.clearSelection = () => this.clearSelection();
    }

    bindEventListeners() {
        // Cycle controls
        document.getElementById('decreaseCycles').addEventListener('click', () => this.adjustCycles(-1));
        document.getElementById('increaseCycles').addEventListener('click', () => this.adjustCycles(1));
        
        // Action buttons
        document.getElementById('generateBtn').addEventListener('click', () => this.startGeneration());
        //document.getElementById('toggleLabelsBtn').addEventListener('click', () => this.toggleLabels());
        document.getElementById('clearSelectionBtn').addEventListener('click', () => this.resetGraph());

        // Enter key on input
        document.getElementById('conceptInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.startGeneration();
            }
        });
    }

    adjustCycles(delta) {
        this.cycleCount = Math.max(2, Math.min(5, this.cycleCount + delta));
        this.updateCycleDisplay();
    }

    updateCycleDisplay() {
        const display = document.getElementById('cycleCount');
        const decreaseBtn = document.getElementById('decreaseCycles');
        const increaseBtn = document.getElementById('increaseCycles');
        
        if (display) display.textContent = this.cycleCount;
        if (decreaseBtn) decreaseBtn.disabled = this.cycleCount <= 2;
        if (increaseBtn) increaseBtn.disabled = this.cycleCount >= 5;
    }

    showGeneratingState(concept) {
        const container = document.querySelector('#container');
        const conceptTitle = document.getElementById('conceptTitle');
        const generateIcon = document.getElementById('generateIcon');
        
        // Add generating class
        container.classList.add('generating');
        
        // Update title
        if (conceptTitle) conceptTitle.textContent = concept;
        
        // Change generate button to loading
        if (generateIcon) generateIcon.textContent = '⏸';
        
        // Disable generate button
        const generateBtn = document.getElementById('generateBtn');
        if (generateBtn) generateBtn.disabled = true;
    }

    hideGeneratingState() {
        const container = document.querySelector('#container');
        const generateIcon = document.getElementById('generateIcon');
        
        // Remove generating class
        container.classList.remove('generating');
        
        // Reset generate button
        if (generateIcon) generateIcon.textContent = '▶';
        
        // Enable generate button
        const generateBtn = document.getElementById('generateBtn');
        if (generateBtn) generateBtn.disabled = false;
    }

    async startGeneration() {
        if (this.isGenerating) return;

        const conceptInput = document.getElementById('conceptInput');
        const inputText = conceptInput.value.trim();
        
        if (!inputText) {
            alert('Por favor introduce un concepto o frase');
            return;
        }

        this.isGenerating = true;
        this.showGeneratingState(inputText);
        
        try {
            // Step 1: Analyze input to determine if it's a concept or phrase
            const analysis = await this.apiService.analyzeInput(inputText);
            let initialConcept;
            
            if (analysis) {
                initialConcept = analysis.extracted_concept;
                // Show analysis result briefly
                await this.delay(1000);
            } else {
                // Fallback if analysis fails
                initialConcept = ConceptUtils.cleanConcept(inputText.split(' ')[0]);
                await this.delay(500);
            }

            // Step 2: Clear existing graph and start progress
            this.renderer.clear();
            await this.apiService.resetGraphData();
            this.progressManager.startProgress(this.cycleCount);

            // Step 3: Begin concept generation
            let currentConcepts = [initialConcept];
            let allConcepts = new Set([initialConcept]);

            // Add initial concept to graph
            await this.apiService.addConceptToGraph(initialConcept);
            await this.renderer.createNode(initialConcept, { x: 0, y: 0, z: 0 }, true);
            this.progressManager.addConcept(initialConcept);

            // Step 4: Generate cycles
            for (let cycle = 0; cycle < this.cycleCount; cycle++) {
                this.progressManager.setStatus(`Explorando ${currentConcepts.length} conceptos...`);
                
                const nextConcepts = [];
                
                for (let i = 0; i < currentConcepts.length; i++) {
                    const concept = currentConcepts[i];
                    
                    this.progressManager.setStatus(`${concept}`);
                    const relatedConcepts = await this.apiService.generateConcepts(concept);
                    
                    for (const relatedConcept of relatedConcepts) {
                        await this.delay(150); // Small delay for visual effect
                        
                        // Check for similar concepts
                        const existingConcept = ConceptUtils.findSimilarConcept(
                            relatedConcept, 
                            Array.from(allConcepts)
                        );
                        
                        if (existingConcept && existingConcept !== concept) {
                            // Connect to existing similar concept
                            this.renderer.createEdge(concept, existingConcept, true);
                        } else if (!allConcepts.has(relatedConcept)) {
                            allConcepts.add(relatedConcept);
                            nextConcepts.push(relatedConcept);
                            
                            // Add to backend and visualization
                            await this.apiService.addConceptToGraph(relatedConcept, concept);
                            
                            // Create node with random position (will be repositioned later)
                            const randomPos = {
                                x: (Math.random() - 0.5) * 8,
                                y: (Math.random() - 0.5) * 8,
                                z: (Math.random() - 0.5) * 8
                            };
                            
                            await this.renderer.createNode(relatedConcept, randomPos, true);
                            this.renderer.createEdge(concept, relatedConcept, true);
                            this.progressManager.addConcept(relatedConcept);
                        }
                    }
                }
                
                if (nextConcepts.length === 0) {
                    this.progressManager.setStatus('Finalizando generación...');
                    break;
                }
                
                currentConcepts = nextConcepts;
                
                // Small delay between cycles
                await this.delay(300);
            }

            // Step 5: Position nodes and complete
            this.progressManager.setStatus('Organizando visualización...');
            this.renderer.positionNodes();
            
            await this.delay(1000);
            this.progressManager.completeProgress();
            
        } catch (error) {
            console.error('Error during generation:', error);
            alert(`Error: ${error.message}`);
            this.progressManager.hideProgress();
        } finally {
            this.isGenerating = false;
            this.hideGeneratingState();
        }
    }

    async resetGraph() {
        if (this.isGenerating) return;

        this.renderer.clear();
        await this.apiService.resetGraphData();
        this.hideGeneratingState();
        
        // Clear the input
        const conceptInput = document.getElementById('conceptInput');
        if (conceptInput) conceptInput.value = '';
    }


    toggleLabels() {
        this.renderer.toggleLabels();
        
        const eyeIcon = document.getElementById('eyeIcon');
        if (eyeIcon) {
            eyeIcon.textContent = this.renderer.labelsVisible ? '👀' : '🙈';
        }
    }

    clearSelection() {
        this.renderer.clearSelection();
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}