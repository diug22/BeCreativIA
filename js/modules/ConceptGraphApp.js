import { GraphRenderer } from './GraphRenderer.js';
import { ApiService } from '../services/ApiService.js';
import { ConceptUtils } from '../utils/ConceptUtils.js';

export class ConceptGraphApp {
    constructor() {
        this.renderer = new GraphRenderer();
        this.apiService = new ApiService();
        this.isGenerating = false;
        this.cycleCount = 1; // Default to 1 for testing
        
        this.initializeUI();
        this.setupHeaderControls();
        this.initializeExpansionComponents();
        this.checkPendingGeneration();
    }

    initializeUI() {
        // Start with Three.js container hidden
        const container = document.getElementById('container');
        if (container) {
            container.style.opacity = '0';
        }
        
        // Bind global functions for HTML UI
        window.startGeneration = () => this.startGeneration();
        window.resetGraph = () => this.resetGraph();
        window.toggleLabels = () => this.toggleLabels();
        window.clearSelection = () => this.clearSelection();
        
        // Background functions removed - only nebula remains
        
        // Check if we should show header (existing graph data)
        this.checkAndShowHeader();
    }
    
    /**
     * Check if there's existing graph data and show header if needed
     */
    async checkAndShowHeader() {
        try {
            // Check if there's existing graph data
            const response = await this.apiService.getGraph();
            
            if (response && response.nodes && response.nodes.length > 0) {
                // There's existing data, show the header and container
                this.showHeaderAndContainer();
                
                // Hide initial screen
                const initialScreen = document.getElementById('initial-screen');
                if (initialScreen) {
                    initialScreen.classList.add('hidden');
                }
                
                // Show Three.js container
                const container = document.getElementById('container');
                if (container) {
                    container.classList.add('visible');
                    container.style.opacity = '1';
                }
                
                console.log('ConceptGraphApp: Existing graph detected, header shown');
            }
        } catch (error) {
            // No existing data or error - stay on initial screen
            console.log('ConceptGraphApp: No existing graph data, staying on initial screen');
        }
    }
    
    /**
     * Show header and update concept title
     */
    showHeaderAndContainer(concept = null) {
        // Show header
        if (this.headerEl) {
            this.headerEl.classList.remove('hidden');
            console.log('ConceptGraphApp: Header made visible');
            
            // Re-bind SearchManager after header is shown
            setTimeout(() => {
                if (this.renderer && this.renderer.searchManager) {
                    console.log('ConceptGraphApp: Re-binding SearchManager after header show');
                    this.renderer.searchManager.rebindElements();
                }
            }, 100);
        }
        
        // Update concept title if provided or get from existing data
        if (concept && window.updateConceptTitle) {
            window.updateConceptTitle(concept);
        } else if (window.updateConceptTitle) {
            // Try to get concept from existing data
            this.apiService.getGraph().then(response => {
                if (response && response.nodes && response.nodes.length > 0) {
                    // Find the root node or first node as concept
                    const rootNode = response.nodes.find(node => node.id === 'root') || response.nodes[0];
                    if (rootNode) {
                        window.updateConceptTitle(rootNode.name);
                    }
                }
            }).catch(() => {
                // Fallback
                window.updateConceptTitle('Concepto');
            });
        }
    }
    /**
     * Initialize expansion components (SearchManager and ContextMenu)
     */
    initializeExpansionComponents() {
        // Initialize expansion components in the renderer
        this.renderer.initializeExpansionComponents(this.apiService);
        
        console.log('ConceptGraphApp: Expansion components initialized');
        
        // Ensure SearchManager is active immediately for debugging
        if (this.renderer.searchManager) {
            console.log('ConceptGraphApp: SearchManager is ready:', !!this.renderer.searchManager);
        }
    }

    /**
     * Initialize static HTML header button logic
     */
    setupHeaderControls() {
        this.headerEl = document.getElementById('app-header');
        const brandBtn = document.getElementById('header-brand');
        const toggleBtn = document.getElementById('header-toggle');
        
        // Header brand click already handled in HTML script
        // We just need to set up the toggle button
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this.toggleLabels();
                
                // Update icon based on labels visibility  
                if (this.renderer.labelsVisible) {
                    // Labels visible - show closed eye with line (blocked view)
                    toggleBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M2 12s3-7 10-7 10 7 10 7"></path>
                        <path d="M2 12s3 7 10 7 10-7 10-7"></path>
                        <line x1="4" y1="4" x2="20" y2="20"></line>
                    </svg>`;
                } else {
                    // Labels hidden - show open eye (clear view)
                    toggleBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>`;
                }
            });
        }
        
        // Set up video recording button
        const videoBtn = document.getElementById('header-video');
        if (videoBtn) {
            videoBtn.addEventListener('click', () => {
                if (window.openVideoModal) {
                    window.openVideoModal();
                } else {
                    console.log('Video recording not available');
                }
            });
        }
    }
    
    async startGenerationWithConcept(concept) {
        if (this.isGenerating) return;
        
        if (!concept || !concept.trim()) {
            return;
        }
        
        // Track concept generation start
        if (window.va) {
            window.va('track', 'Concept Generation Started', {
                concept: concept.substring(0, 20), // Limit to 20 chars for privacy
                iterations: this.cycleCount
            });
        }
        
        this.isGenerating = true;
        this.generationStartTime = Date.now();
        
        // Hide HTML initial screen
        const initialScreen = document.getElementById('initial-screen');
        if (initialScreen) {
            initialScreen.classList.add('hidden');
        }
        
        
        // Show Three.js container
        const container = document.getElementById('container');
        if (container) {
            console.log('Making container visible');
            container.classList.add('visible');
            // Force visibility with inline styles
            container.style.opacity = '1';
            container.style.zIndex = '1000';
            container.style.position = 'fixed';
            container.style.top = '0';
            container.style.left = '0';
            console.log('Container styles after forcing:', window.getComputedStyle(container).cssText);
        } else {
            console.error('Container not found!');
        }
        // Show header and update concept title
        this.showHeaderAndContainer(concept);
        
        // Start tunnel effect
        this.renderer.setGeneratingState(concept);
                    

        try {
            // Use the same generation logic but with provided concept
            await this.performGeneration(concept.trim());
        } catch (error) {
            console.error('Error during generation:', error);
            
            // Track generation errors
            if (window.va) {
                window.va('track', 'Generation Error', {
                    error: error.message,
                    concept: concept.substring(0, 20)
                });
            }
            
            this.renderer.hideProgress();
        } finally {
            this.isGenerating = false;
        }
    }



    async startGeneration() {
        // Get input from HTML input field
        const conceptInput = document.getElementById('concept-input');
        const inputText = conceptInput ? conceptInput.value.trim() : '';
        
        if (!inputText) {
            return;
        }
        
        // Get iterations from HTML
        if (window.getCurrentIterations) {
            this.cycleCount = window.getCurrentIterations();
        }
        
        await this.startGenerationWithConcept(inputText);
    }
    
    async performGeneration(inputText) {
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

        // Step 2: Clear existing graph and prepare for generation
        this.renderer.clear();
        await this.apiService.resetGraphData();

        // Step 3: Begin concept generation
        let currentConcepts = [initialConcept];
        let allConcepts = new Set([initialConcept]);

        // Calculate expected total nodes for progress tracking
        const expectedTotalNodes = this.calculateMaxNodes(this.cycleCount);
        
        // Add initial concept to graph
        await this.apiService.addConceptToGraph(initialConcept);
        const initialNode = await this.renderer.createNode(initialConcept, { x: 0, y: 0, z: 0 }, true);
        
        // Show nebula when first node appears (after tunnel ends)
        this.renderer.showNebulaOnFirstNode();
        
        // Notify tunnel effect that first node was generated
        if (this.renderer.tunnelEffect) {
            this.renderer.tunnelEffect.addLoadingNode(initialConcept);
        }
        
        // Start growth phase with initial node
        this.renderer.startGrowthPhase(initialNode.sphere, expectedTotalNodes);

        // Step 4: Generate cycles
        for (let cycle = 0; cycle < this.cycleCount; cycle++) {
            console.log(`Explorando ${currentConcepts.length} conceptos...`);
            
            const nextConcepts = [];
            
            for (let i = 0; i < currentConcepts.length; i++) {
                const concept = currentConcepts[i];
                
                console.log(`Generando para: ${concept}`);
                const relatedConcepts = await this.apiService.generateConcepts(concept, this.cycleCount);
                
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
                        
                        // Add concept to tunnel effect for coloring
                        if (this.renderer.tunnelEffect && this.renderer.tunnelEffect.isActive) {
                            this.renderer.tunnelEffect.addLoadingNode(relatedConcept);
                        }
                        
                        // Growth phase will automatically handle the node via createNode
                    }
                }
            }
            
            if (nextConcepts.length === 0) {
                console.log('Finalizando generación...');
                break;
            }
            
            currentConcepts = nextConcepts;
            
            // Small delay between cycles
            await this.delay(300);
        }

        // Step 5: Position nodes and complete growth phase
        console.log('Organizando visualización...');
        
        // End growth phase (this will transition camera to interactive mode)
        this.renderer.endGrowthPhase();
        
        // Position nodes after a short delay
        setTimeout(() => {
            this.renderer.positionNodes();
        }, 1500);
        
        // Step 6: Complete the tunnel effect after all generation is done
        console.log('Generación completada - finalizando efectos visuales...');
        setTimeout(() => {
            this.renderer.clearGeneratingState();
        }, 2000); // Give time for positioning to start
        
        console.log('Generación completada');
        
        // Track generation completion
        if (window.va) {
            window.va('track', 'Concept Generation Completed', {
                totalNodes: Object.keys(this.renderer.nodes || {}).length,
                iterations: this.cycleCount,
                duration: Date.now() - this.generationStartTime
            });
        }
    }
    
    calculateMaxNodes(cycles) {
        // 3^n formula for maximum possible nodes
        let total = 1; // Initial concept
        for (let i = 0; i < cycles; i++) {
            total += Math.pow(3, i + 1);
        }
        return total;
    }

    async resetGraph() {
        if (this.isGenerating) return;

        this.renderer.clear();
        await this.apiService.resetGraphData();
        
        // Return to initial state
        this.returnToInitialState();
    }
    
    checkPendingGeneration() {
        // Check if there's a pending generation from HTML
        if (window.pendingGeneration) {
            const { concept, iterations } = window.pendingGeneration;
            this.cycleCount = iterations;
            this.startGenerationWithConcept(concept);
            window.pendingGeneration = null;
        }
        
        // Hide static header on initial load
        const hdr = document.getElementById('app-header');
        if (hdr) hdr.classList.add('hidden');
    }
    
    returnToInitialState() {
        console.log('ConceptGraphApp: Returning to initial state...');
        
        // Track return to home
        if (window.va) {
            window.va('track', 'Return to Home');
        }
        
        // Reset generation state
        this.isGenerating = false;
        this.cycleCount = 1;
        
        // Clear and reset renderer state
        this.renderer.clear();
        
        // Clear concept title in header
        if (window.clearConceptTitle) {
            window.clearConceptTitle();
        }
        
        // Hide any open context menus
        if (this.renderer.contextMenu && this.renderer.contextMenu.isVisible) {
            this.renderer.contextMenu.hide();
        }
        
        // Clear search suggestions
        if (this.renderer.searchManager) {
            this.renderer.searchManager.hideSuggestions();
            this.renderer.searchManager.clearSearch();
        }
        
        // Reset backend data
        this.apiService.resetGraphData().catch(err => 
            console.warn('Failed to reset backend data:', err)
        );
        
        // Show HTML initial screen
        const initialScreen = document.getElementById('initial-screen');
        if (initialScreen) {
            initialScreen.classList.remove('hidden');
        }
        
        // Reset iterations to default
        if (window.setIterations) {
            window.setIterations(1);
        }
        
        // Clear and focus input
        const conceptInput = document.getElementById('concept-input');
        if (conceptInput) {
            conceptInput.value = '';
            conceptInput.disabled = false;
            // Focus after a small delay to ensure it's visible
            setTimeout(() => {
                conceptInput.focus();
            }, 100);
        }
        
        // Hide Three.js container and static header
        const container = document.getElementById('container');
        if (container) {
            container.classList.remove('visible');
            container.style.opacity = '0';
            container.style.zIndex = '';
            container.style.position = '';
            container.style.top = '';
            container.style.left = '';
        }
        
        if (this.headerEl) {
            this.headerEl.classList.add('hidden');
        }
        
        console.log('ConceptGraphApp: Initial state restored');
    }


    toggleLabels() {
        this.renderer.toggleLabels();
    }

    clearSelection() {
        this.renderer.clearSelection();
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
