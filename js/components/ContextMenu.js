/**
 * Context Menu - Desacoplado
 * Menú contextual para expandir nodos seleccionados
 */
export class ContextMenu {
    constructor(graphRenderer, apiService) {
        this.graphRenderer = graphRenderer;
        this.apiService = apiService;
        
        // DOM elements
        this.menu = null;
        this.currentNode = null;
        this.isVisible = false;
        
        // State
        this.expandIterations = 2;
        this.minIterations = 1;
        this.maxIterations = 5;
        this.isExpanding = false;
        
        // Callbacks
        this.onExpansionStart = null;
        this.onExpansionComplete = null;
        
        this.createMenu();
        this.setupEventListeners();
        
        // Make force close available globally for debugging
        if (typeof window !== 'undefined') {
            window.closeContextMenu = () => this.forceClose();
        }
        
        console.log('ContextMenu: Initialized');
    }
    
    createMenu() {
        this.menu = document.createElement('div');
        this.menu.id = 'context-menu';
        this.menu.style.cssText = `
            position: fixed;
            background: rgba(0, 0, 0, 0.95);
            border: 1px solid #333333;
            border-radius: 8px;
            padding: 0.75rem;
            z-index: 99999;
            min-width: 200px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            transform: scale(0.8);
            opacity: 0;
            pointer-events: none;
            transition: all 0.2s ease;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            color: #ffffff;
        `;
        
        this.menu.innerHTML = `
            <div class="context-menu-header">
                <span class="context-menu-title">Expandir desde: <strong id="context-node-name"></strong></span>
            </div>
            
            <div class="context-menu-content">
                <div class="context-concept">
                    <label class="context-label">Concepto base:</label>
                    <input type="text" id="context-concept-input" class="context-concept-input" placeholder="Concepto específico..." maxlength="30">
                </div>
                
                <div class="context-iterations">
                    <label class="context-label">Iteraciones:</label>
                    <div class="context-iterations-control">
                        <button id="context-decrease" type="button">‹</button>
                        <span id="context-iteration-count">2</span>
                        <button id="context-increase" type="button">›</button>
                    </div>
                </div>
                
                <div class="context-actions">
                    <button id="context-expand" class="context-expand-btn" type="button">Expandir</button>
                    <button id="context-cancel" class="context-cancel-btn" type="button">Cancelar</button>
                </div>
            </div>
        `;
        
        this.addMenuStyles();
        document.body.appendChild(this.menu);
        
        // Debug: Verify cancel button exists
        const cancelBtn = this.menu.querySelector('#context-cancel');
        console.log('ContextMenu: Cancel button found:', !!cancelBtn);
    }
    
    addMenuStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #context-menu.visible {
                transform: scale(1);
                opacity: 1;
                pointer-events: all;
            }
            
            .context-menu-header {
                margin-bottom: 0.75rem;
                padding-bottom: 0.5rem;
                border-bottom: 1px solid var(--border-color);
            }
            
            .context-menu-title {
                color: var(--primary-color);
                font-size: 0.875rem;
                font-weight: 300;
            }
            
            .context-menu-title strong {
                color: var(--accent-color);
                font-weight: 500;
            }
            
            .context-menu-content {
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
            }
            
            .context-concept {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }
            
            .context-concept-input {
                width: 100%;
                height: 2rem;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid #333333;
                border-radius: 4px;
                color: #ffffff;
                font-size: 0.75rem;
                padding: 0 0.5rem;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                transition: all 0.2s ease;
            }
            
            .context-concept-input:focus {
                outline: none;
                border-color: #00aaff;
                background: rgba(255, 255, 255, 0.1);
            }
            
            .context-concept-input::placeholder {
                color: #888888;
                opacity: 0.7;
            }
            
            .context-iterations {
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            
            .context-label {
                color: var(--secondary-color);
                font-size: 0.75rem;
                font-weight: 300;
            }
            
            .context-iterations-control {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid var(--border-color);
                border-radius: 4px;
                padding: 0.25rem 0.5rem;
            }
            
            .context-iterations-control button {
                background: none;
                border: none;
                color: var(--secondary-color);
                font-size: 0.875rem;
                cursor: pointer;
                padding: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 2px;
                transition: all 0.2s ease;
            }
            
            .context-iterations-control button:hover {
                color: var(--primary-color);
                background: rgba(255, 255, 255, 0.1);
            }
            
            .context-iterations-control button:disabled {
                color: rgba(136, 136, 136, 0.3);
                cursor: not-allowed;
            }
            
            .context-iterations-control button:disabled:hover {
                background: none;
            }
            
            .context-iterations-control span {
                color: var(--primary-color);
                font-size: 0.875rem;
                min-width: 16px;
                text-align: center;
                font-weight: 500;
            }
            
            .context-actions {
                display: flex;
                gap: 0.5rem;
            }
            
            .context-expand-btn, .context-cancel-btn {
                flex: 1;
                padding: 0.5rem 1rem;
                border: none;
                border-radius: 4px;
                font-size: 0.75rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            }
            
            .context-expand-btn {
                background: var(--accent-color);
                color: #ffffff;
            }
            
            .context-expand-btn:hover {
                background: #0088cc;
                transform: translateY(-1px);
            }
            
            .context-expand-btn:disabled {
                background: var(--secondary-color);
                cursor: not-allowed;
                transform: none;
            }
            
            .context-cancel-btn {
                background: rgba(255, 255, 255, 0.1);
                color: var(--primary-color);
                border: 1px solid var(--border-color);
            }
            
            .context-cancel-btn:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: translateY(-1px);
            }
        `;
        
        document.head.appendChild(style);
    }
    
    setupEventListeners() {
        // Concept input
        const conceptInput = this.menu.querySelector('#context-concept-input');
        
        // Iteration controls
        const decreaseBtn = this.menu.querySelector('#context-decrease');
        const increaseBtn = this.menu.querySelector('#context-increase');
        const expandBtn = this.menu.querySelector('#context-expand');
        const cancelBtn = this.menu.querySelector('#context-cancel');
        
        if (conceptInput) {
            // Enter key to expand
            conceptInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    this.expandNode();
                }
            });
            
            // Focus styling
            conceptInput.addEventListener('focus', () => {
                conceptInput.style.borderColor = '#00aaff';
            });
            
            conceptInput.addEventListener('blur', () => {
                conceptInput.style.borderColor = '#333333';
            });
        }
        
        if (decreaseBtn) {
            decreaseBtn.addEventListener('click', () => this.decreaseIterations());
        }
        
        if (increaseBtn) {
            increaseBtn.addEventListener('click', () => this.increaseIterations());
        }
        
        if (expandBtn) {
            expandBtn.addEventListener('click', () => this.expandNode());
        }
        
        if (cancelBtn) {
            console.log('ContextMenu: Adding cancel button listener');
            cancelBtn.addEventListener('click', (event) => {
                console.log('ContextMenu: Cancel button clicked');
                event.preventDefault();
                event.stopPropagation();
                this.hide();
            });
        } else {
            console.error('ContextMenu: Cancel button not found!');
        }
        
        // Close menu when clicking outside
        document.addEventListener('click', (event) => {
            if (this.isVisible && !this.menu.contains(event.target)) {
                this.hide();
            }
        });
        
        // Close menu on escape
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
        
        console.log('ContextMenu: Event listeners set up');
    }
    
    show(nodeConcept, x, y) {
        if (this.isExpanding) return;
        
        this.currentNode = nodeConcept;
        this.isVisible = true;
        
        // Update menu content
        const nodeNameEl = this.menu.querySelector('#context-node-name');
        const conceptInput = this.menu.querySelector('#context-concept-input');
        
        if (nodeNameEl) {
            nodeNameEl.textContent = nodeConcept;
        }
        
        if (conceptInput) {
            conceptInput.value = nodeConcept; // Prellenar con el concepto del nodo seleccionado
            // Focus the input for easy editing
            setTimeout(() => conceptInput.select(), 100);
        }
        
        // Position menu
        this.positionMenu(x, y);
        
        // FORCE VISIBILITY - Override all styles temporarily for debugging
        this.menu.style.opacity = '1';
        this.menu.style.transform = 'scale(1)';
        this.menu.style.pointerEvents = 'all';
        this.menu.style.display = 'block';
        this.menu.style.visibility = 'visible';
        
        // Show menu
        this.menu.classList.add('visible');
        
        console.log(`ContextMenu: Shown for node '${nodeConcept}' at (${x}, ${y})`);
    }
    
    hide() {
        if (!this.isVisible) return;
        
        this.isVisible = false;
        this.currentNode = null;
        
        // Force hide immediately
        this.menu.style.opacity = '0';
        this.menu.style.transform = 'scale(0.8)';
        this.menu.style.pointerEvents = 'none';
        this.menu.style.display = 'none';
        this.menu.style.visibility = 'hidden';
        
        this.menu.classList.remove('visible');
        
        console.log('ContextMenu: Hidden');
    }
    
    // Force close method for debugging
    forceClose() {
        console.log('ContextMenu: Force closing...');
        this.isVisible = false;
        this.currentNode = null;
        this.menu.style.display = 'none !important';
        this.menu.classList.remove('visible');
        
        // Make the method globally accessible for debugging
        if (typeof window !== 'undefined') {
            window.closeContextMenu = () => this.forceClose();
        }
    }
    
    positionMenu(x, y) {
        const menuRect = this.menu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Adjust position to keep menu in viewport
        let menuX = x;
        let menuY = y;
        
        if (menuX + menuRect.width > viewportWidth) {
            menuX = viewportWidth - menuRect.width - 10;
        }
        
        if (menuY + menuRect.height > viewportHeight) {
            menuY = viewportHeight - menuRect.height - 10;
        }
        
        const finalX = Math.max(10, menuX);
        const finalY = Math.max(10, menuY);
        
        this.menu.style.left = `${finalX}px`;
        this.menu.style.top = `${finalY}px`;
    }
    
    async expandNode() {
        if (!this.currentNode || this.isExpanding) return;
        
        // Get the concept from the input field
        const conceptInput = this.menu.querySelector('#context-concept-input');
        const expansionConcept = conceptInput ? conceptInput.value.trim() : this.currentNode;
        
        if (!expansionConcept) {
            console.warn('ContextMenu: No concept specified for expansion');
            return;
        }
        
        this.isExpanding = true;
        this.setExpandingState(true);
        
        try {
            console.log(`ContextMenu: Expanding from concept '${expansionConcept}' with ${this.expandIterations} iterations`);
            
            // Emit expansion start event
            if (this.onExpansionStart) {
                this.onExpansionStart({
                    node: this.currentNode,
                    concept: expansionConcept,
                    iterations: this.expandIterations
                });
            }
            
            // Perform expansion using the input concept
            await this.performExpansion(expansionConcept, this.expandIterations);
            
            // Hide menu
            this.hide();
            
            // Emit expansion complete event
            if (this.onExpansionComplete) {
                this.onExpansionComplete({
                    node: this.currentNode,
                    concept: expansionConcept,
                    iterations: this.expandIterations
                });
            }
            
            console.log(`ContextMenu: Expansion completed for '${expansionConcept}'`);
            
        } catch (error) {
            console.error('ContextMenu: Expansion failed:', error);
        } finally {
            this.isExpanding = false;
            this.setExpandingState(false);
        }
    }
    
    async performExpansion(fromConcept, iterations) {
        // Calculate expected nodes for this expansion
        const expectedNodes = this.calculateExpectedNodes(iterations);
        
        // Get the source node data - if it doesn't exist, we'll create it
        let sourceNodeData = this.graphRenderer.nodes.get(fromConcept);
        
        if (!sourceNodeData) {
            console.log(`ContextMenu: Source concept '${fromConcept}' not found in graph, creating it...`);
            
            // Add to backend first, connecting it to the original node
            await this.apiService.addConceptToGraph(fromConcept, this.currentNode);
            
            // Create the node at a random position
            const randomPos = {
                x: (Math.random() - 0.5) * 8,
                y: (Math.random() - 0.5) * 8,
                z: (Math.random() - 0.5) * 8
            };
            
            const newNode = await this.graphRenderer.createNode(fromConcept, randomPos, true);
            sourceNodeData = this.graphRenderer.nodes.get(fromConcept);
            
            // Create visual connection between original node and new concept
            this.graphRenderer.createEdge(this.currentNode, fromConcept, true);
            
            console.log(`ContextMenu: Created relationship: ${this.currentNode} → ${fromConcept}`);
        }
        
        // Start growth phase from source node
        if (this.graphRenderer.growthPhaseManager && !this.graphRenderer.growthPhaseManager.isPhaseActive()) {
            this.graphRenderer.startGrowthPhase(sourceNodeData.sphere, expectedNodes);
        }
        
        // Generate related concepts
        let currentConcepts = [fromConcept];
        let allNewConcepts = new Set();
        
        for (let cycle = 0; cycle < iterations; cycle++) {
            const nextConcepts = [];
            
            for (const concept of currentConcepts) {
                const relatedConcepts = await this.apiService.generateConcepts(concept, 3);
                
                for (const relatedConcept of relatedConcepts) {
                    await this.delay(100);
                    
                    // Check if concept already exists in the entire graph
                    const existingNodes = Array.from(this.graphRenderer.nodes.keys());
                    const existingConcept = this.findSimilarConcept(relatedConcept, existingNodes);
                    
                    if (existingConcept && existingConcept !== concept) {
                        // Connect to existing node
                        this.graphRenderer.createEdge(concept, existingConcept, true);
                    } else if (!existingConcept && !allNewConcepts.has(relatedConcept)) {
                        allNewConcepts.add(relatedConcept);
                        nextConcepts.push(relatedConcept);
                        
                        // Add to backend and visualization
                        await this.apiService.addConceptToGraph(relatedConcept, concept);
                        
                        // Position near source node
                        const sourcePos = sourceNodeData.position;
                        const newPos = {
                            x: sourcePos.x + (Math.random() - 0.5) * 6,
                            y: sourcePos.y + (Math.random() - 0.5) * 6,
                            z: sourcePos.z + (Math.random() - 0.5) * 6
                        };
                        
                        await this.graphRenderer.createNode(relatedConcept, newPos, true);
                        this.graphRenderer.createEdge(concept, relatedConcept, true);
                    }
                }
            }
            
            if (nextConcepts.length === 0) break;
            currentConcepts = nextConcepts;
        }
        
        // End growth phase and reposition nodes
        setTimeout(() => {
            this.graphRenderer.endGrowthPhase();
            this.graphRenderer.positionNodes();
        }, 500);
    }
    
    findSimilarConcept(concept, existingConcepts) {
        // Use ConceptUtils to find similar concepts
        if (this.graphRenderer && this.graphRenderer.ConceptUtils) {
            return this.graphRenderer.ConceptUtils.findSimilarConcept(concept, existingConcepts, 0.7);
        }
        
        // Fallback: exact match
        return existingConcepts.find(existing => 
            existing.toLowerCase() === concept.toLowerCase()
        );
    }
    
    calculateExpectedNodes(iterations) {
        let total = 0; // Don't count source node
        for (let i = 0; i < iterations; i++) {
            total += Math.pow(3, i + 1);
        }
        return total;
    }
    
    // Iteration management
    decreaseIterations() {
        if (this.expandIterations > this.minIterations) {
            this.expandIterations--;
            this.updateIterationDisplay();
        }
    }
    
    increaseIterations() {
        if (this.expandIterations < this.maxIterations) {
            this.expandIterations++;
            this.updateIterationDisplay();
        }
    }
    
    updateIterationDisplay() {
        const countEl = this.menu.querySelector('#context-iteration-count');
        const decreaseBtn = this.menu.querySelector('#context-decrease');
        const increaseBtn = this.menu.querySelector('#context-increase');
        
        if (countEl) {
            countEl.textContent = this.expandIterations;
        }
        
        if (decreaseBtn) {
            decreaseBtn.disabled = this.expandIterations <= this.minIterations;
        }
        
        if (increaseBtn) {
            increaseBtn.disabled = this.expandIterations >= this.maxIterations;
        }
    }
    
    setExpandingState(expanding) {
        const expandBtn = this.menu.querySelector('#context-expand');
        
        if (expandBtn) {
            expandBtn.disabled = expanding;
            expandBtn.textContent = expanding ? 'Expandiendo...' : 'Expandir Nodo';
        }
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Event binding
    onExpansionStarted(callback) {
        this.onExpansionStart = callback;
    }
    
    onExpansionCompleted(callback) {
        this.onExpansionComplete = callback;
    }
    
    // Cleanup
    destroy() {
        if (this.menu && this.menu.parentNode) {
            this.menu.parentNode.removeChild(this.menu);
        }
        
        this.menu = null;
        this.currentNode = null;
        this.graphRenderer = null;
        this.apiService = null;
        
        this.onExpansionStart = null;
        this.onExpansionComplete = null;
        
        console.log('ContextMenu: Destroyed');
    }
}