import { ConceptUtils } from '../utils/ConceptUtils.js';

/**
 * Search Manager - Desacoplado
 * Maneja búsqueda y adición de nodos desde el header
 */
export class SearchManager {
    constructor(graphRenderer, apiService) {
        this.graphRenderer = graphRenderer;
        this.apiService = apiService;
        
        // DOM elements
        this.searchInput = null;
        this.iterationCount = null;
        this.decreaseBtn = null;
        this.increaseBtn = null;
        this.suggestionsContainer = null;
        
        // State
        this.currentIterations = 1; // Will sync with global state
        this.minIterations = 1;
        this.maxIterations = 5;
        this.isSearching = false;
        this.suggestionsVisible = false;
        this.maxSuggestions = 5;
        
        // Callbacks
        this.onSearchStart = null;
        this.onSearchComplete = null;
        this.onNodeFound = null;
        this.onNodeCreated = null;
        
        this.init();
    }
    
    init() {
        this.bindElements();
        this.createSuggestions();
        this.setupEventListeners();
        
        console.log('SearchManager: Initialized');
    }
    
    bindElements() {
        this.searchInput = document.getElementById('header-search-input');
        
        if (!this.searchInput) {
            console.error('SearchManager: Search input not found - element with ID "header-search-input" does not exist');
            console.log('SearchManager: Available inputs:', document.querySelectorAll('input'));
            
            // Retry binding after a short delay (DOM might not be ready)
            setTimeout(() => {
                console.log('SearchManager: Retrying element binding...');
                this.bindElements();
            }, 1000);
            return;
        }
        
        // Debug: Check if input is accessible
        console.log('SearchManager: Input found:', !!this.searchInput);
        console.log('SearchManager: Input disabled?', this.searchInput.disabled);
        console.log('SearchManager: Input display:', window.getComputedStyle(this.searchInput).display);
        console.log('SearchManager: Header visibility:', document.getElementById('app-header')?.classList.contains('hidden'));
        
        // Ensure input is enabled and accessible
        this.searchInput.disabled = false;
        this.searchInput.style.pointerEvents = 'all';
        
        // Set up event listeners
        this.setupEventListeners();
        
        console.log('SearchManager: Elements bound successfully');
    }
    
    // Add method to re-bind if needed
    rebindElements() {
        console.log('SearchManager: Re-binding elements...');
        this.bindElements();
    }
    
    createSuggestions() {
        if (!this.searchInput) return;
        
        // Create suggestions container
        this.suggestionsContainer = document.createElement('div');
        this.suggestionsContainer.id = 'search-suggestions';
        
        // Get positioning elements first
        const headerControls = document.querySelector('.header-controls');
        const headerSearchContainer = document.querySelector('.header-search-container');
        
        // Dynamic CSS based on positioning strategy
        const isFixed = headerSearchContainer === null && headerControls === null;
        
        this.suggestionsContainer.style.cssText = `
            position: ${isFixed ? 'fixed' : 'absolute'} !important;
            top: ${isFixed ? '0px' : '100%'} !important;
            left: ${isFixed ? '0px' : '0'} !important;
            right: ${isFixed ? 'auto' : '0'} !important;
            width: ${isFixed ? '280px' : '100%'} !important;
            background: linear-gradient(135deg, rgba(0, 0, 0, 0.95), rgba(0, 0, 0, 0.98)) !important;
            border: 2px solid rgba(0, 170, 255, 0.2) !important;
            border-top: none !important;
            border-radius: 0 0 18px 18px !important;
            max-height: 250px !important;
            overflow-y: auto !important;
            z-index: 99999 !important;
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            backdrop-filter: blur(20px) !important;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 4px 16px rgba(0, 170, 255, 0.1) !important;
            pointer-events: all !important;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
        `;
        
        // Insert after header controls container to avoid overflow issues
        
        if (headerSearchContainer) {
            // Position relative to search container, not wrapper (to avoid overflow: hidden)
            headerSearchContainer.style.position = 'relative';
            headerSearchContainer.appendChild(this.suggestionsContainer);
            console.log('SearchManager: Suggestions container added to search container');
        } else if (headerControls) {
            // Fallback to header controls
            headerControls.style.position = 'relative';
            headerControls.appendChild(this.suggestionsContainer);
            console.log('SearchManager: Suggestions container added to header controls');
        } else {
            // Last fallback - add to body with fixed positioning
            document.body.appendChild(this.suggestionsContainer);
            this.suggestionsContainer.style.position = 'fixed !important';
            console.log('SearchManager: Suggestions container added to body with fixed positioning');
        }
        
        console.log('SearchManager: Suggestions container created and positioned');
    }
    
    updateFixedPosition() {
        if (!this.searchInput) return;
        
        // Get the input's position relative to viewport
        const inputRect = this.searchInput.getBoundingClientRect();
        
        // Position the suggestions container right below the input
        this.suggestionsContainer.style.top = `${inputRect.bottom}px`;
        this.suggestionsContainer.style.left = `${inputRect.left}px`;
        this.suggestionsContainer.style.width = `${inputRect.width}px`;
        this.suggestionsContainer.style.right = 'auto';
        
        console.log('SearchManager: Fixed position updated - top:', inputRect.bottom, 'left:', inputRect.left, 'width:', inputRect.width);
    }
    
    setupEventListeners() {
        if (!this.searchInput) return;
        
        // Search input events
        this.searchInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.performSearch();
            }
        });
        
        this.searchInput.addEventListener('input', (event) => {
            this.updateSearchState();
            this.updateSuggestions();
        });
        
        this.searchInput.addEventListener('focus', () => {
            const wrapper = document.getElementById('header-search-wrapper');
            if (wrapper) wrapper.classList.add('focused');
            this.updateSuggestions();
        });
        
        this.searchInput.addEventListener('blur', () => {
            const wrapper = document.getElementById('header-search-wrapper');
            if (wrapper) wrapper.classList.remove('focused');
            // Hide suggestions after a small delay to allow clicking on them
            setTimeout(() => this.hideSuggestions(), 150);
        });
        
        // Iteration controls - Let HTML handle these, just sync state
        // The iteration controls are already handled by the HTML script
        
        console.log('SearchManager: Event listeners set up');
    }
    
    updateSearchState() {
        const query = this.getSearchQuery();
        
        if (query.length === 0) {
            this.searchInput.style.backgroundColor = 'rgba(255,255,255,0.05)';
        } else {
            // Check if node exists
            const existingNode = this.findExistingNode(query);
            if (existingNode) {
                this.searchInput.style.backgroundColor = 'rgba(0, 255, 0, 0.1)'; // Green tint
                this.searchInput.title = `Nodo encontrado: ${existingNode}`;
            } else {
                this.searchInput.style.backgroundColor = 'rgba(0, 170, 255, 0.1)'; // Blue tint
                this.searchInput.title = 'Presiona Enter para crear nuevo nodo';
            }
        }
    }
    
    updateSuggestions() {
        if (!this.suggestionsContainer) return;
        
        const query = this.getSearchQuery().toLowerCase();
        
        if (query.length < 2) { // Show suggestions only after 2 characters
            this.hideSuggestions();
            return;
        }
        
        // Get all node concepts from the graph
        let allConcepts = this.graphRenderer && this.graphRenderer.nodes ? 
            Array.from(this.graphRenderer.nodes.keys()) : [];
        
        // For testing purposes, if no nodes exist, use some sample concepts
        if (allConcepts.length === 0) {
            allConcepts = ['CREATIVIDAD', 'INNOVACIÓN', 'DISEÑO', 'ARTE', 'TECNOLOGÍA', 'CIENCIA'];
            console.log('SearchManager: Using sample concepts for testing');
        }
        
        console.log('SearchManager: Available concepts:', allConcepts.length);
        console.log('SearchManager: Query:', query);
        console.log('SearchManager: All concepts:', allConcepts);
        console.log('SearchManager: GraphRenderer nodes exist?', !!this.graphRenderer?.nodes);
        
        // Filter concepts that match the query (more flexible matching)
        const suggestions = allConcepts
            .filter(concept => {
                const conceptLower = concept.toLowerCase();
                // Check for partial matches
                return conceptLower.includes(query) || 
                       query.includes(conceptLower) ||
                       ConceptUtils.calculateSimilarity(conceptLower, query) > 0.6;
            })
            .slice(0, this.maxSuggestions);
        
        console.log('SearchManager: Found suggestions:', suggestions);
        
        if (suggestions.length === 0) {
            this.hideSuggestions();
            return;
        }
        
        // Build suggestions HTML
        let suggestionsHTML = '';
        suggestions.forEach(concept => {
            // Highlight matching text
            const highlightedConcept = concept.replace(
                new RegExp(`(${query})`, 'gi'),
                '<span style="color: #00aaff; font-weight: 500;">$1</span>'
            );
            
            suggestionsHTML += `
                <div class="suggestion-item" data-concept="${concept}">
                    ${highlightedConcept}
                </div>
            `;
        });
        
        this.suggestionsContainer.innerHTML = suggestionsHTML;
        console.log('SearchManager: Suggestions HTML:', suggestionsHTML);
        console.log('SearchManager: Container innerHTML set, showing suggestions...');
        this.showSuggestions();
        
        // Add click listeners to suggestions
        this.suggestionsContainer.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const concept = e.target.getAttribute('data-concept');
                this.selectSuggestion(concept);
            });
        });
    }
    
    showSuggestions() {
        if (!this.suggestionsContainer) {
            console.error('SearchManager: Suggestions container not found when trying to show');
            return;
        }
        
        // Calculate position if using fixed positioning
        if (this.suggestionsContainer.style.position === 'fixed') {
            this.updateFixedPosition();
        }
        
        console.log('SearchManager: Showing suggestions container');
        this.suggestionsContainer.style.display = 'block';
        this.suggestionsContainer.style.visibility = 'visible';
        this.suggestionsContainer.style.opacity = '1';
        this.suggestionsVisible = true;
        
        // Force the container to be visible and above everything
        this.suggestionsContainer.style.zIndex = '99999';
        this.suggestionsContainer.style.pointerEvents = 'all';
        
        console.log('SearchManager: Suggestions container display:', this.suggestionsContainer.style.display);
        console.log('SearchManager: Suggestions container visibility:', this.suggestionsContainer.style.visibility);
        
        // Add suggestion item styles
        if (!document.getElementById('suggestion-styles')) {
            const style = document.createElement('style');
            style.id = 'suggestion-styles';
            style.textContent = `
                .suggestion-item {
                    padding: 0.75rem 1rem;
                    color: #ffffff !important;
                    cursor: pointer;
                    font-size: 0.8rem;
                    font-weight: 300;
                    letter-spacing: 0.02em;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    overflow: hidden;
                    background: transparent;
                    text-transform: uppercase;
                    display: block !important;
                    width: 100%;
                    box-sizing: border-box;
                }
                
                .suggestion-item::before {
                    content: '';
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 0;
                    height: 100%;
                    background: linear-gradient(90deg, rgba(0, 170, 255, 0.3), rgba(0, 170, 255, 0.1));
                    transition: width 0.3s ease;
                    z-index: -1;
                }
                
                .suggestion-item:hover::before {
                    width: 100%;
                }
                
                .suggestion-item:hover {
                    background: rgba(0, 170, 255, 0.08) !important;
                    transform: translateX(4px);
                    padding-left: 1.25rem;
                    text-shadow: 0 0 10px rgba(0, 170, 255, 0.4);
                }
                
                .suggestion-item:last-child {
                    border-bottom: none;
                    border-radius: 0 0 16px 16px;
                }
                
                .suggestion-item:first-child {
                    margin-top: 0.25rem;
                }
            `;
            document.head.appendChild(style);
            console.log('SearchManager: Suggestion styles added to document');
        }
    }
    
    hideSuggestions() {
        if (!this.suggestionsContainer) {
            console.log('SearchManager: No suggestions container to hide');
            return;
        }
        
        console.log('SearchManager: Hiding suggestions container');
        this.suggestionsContainer.style.display = 'none';
        this.suggestionsContainer.style.visibility = 'hidden';
        this.suggestionsContainer.style.opacity = '0';
        this.suggestionsVisible = false;
    }
    
    selectSuggestion(concept) {
        if (this.searchInput) {
            this.searchInput.value = concept;
            this.updateSearchState();
        }
        this.hideSuggestions();
        
        // Trigger search for the selected concept
        this.performSearch();
    }
    
    async performSearch() {
        const query = this.getSearchQuery();
        
        if (!query || this.isSearching) {
            return;
        }
        
        // Sync with global iterations
        this.currentIterations = this.getCurrentIterations();
        
        this.isSearching = true;
        this.setSearching(true);
        
        try {
            console.log(`SearchManager: Searching for "${query}" with ${this.currentIterations} iterations`);
            
            // Emit search start event
            if (this.onSearchStart) {
                this.onSearchStart({ query, iterations: this.currentIterations });
            }
            
            // Step 1: Check if node exists
            const existingNode = this.findExistingNode(query);
            
            if (existingNode) {
                // Node found - select it
                await this.selectExistingNode(existingNode);
            } else {
                // Node doesn't exist - create new subgraph
                await this.createNewSubgraph(query);
            }
            
            // Clear search input
            this.clearSearch();
            
            // Emit search complete event
            if (this.onSearchComplete) {
                this.onSearchComplete({ query, existed: !!existingNode });
            }
            
        } catch (error) {
            console.error('SearchManager: Search failed:', error);
            this.showError('Error al buscar concepto');
        } finally {
            this.isSearching = false;
            this.setSearching(false);
        }
    }
    
    findExistingNode(query) {
        if (!this.graphRenderer || !this.graphRenderer.nodes) {
            return null;
        }
        
        const cleanQuery = ConceptUtils.cleanConcept(query);
        const nodes = Array.from(this.graphRenderer.nodes.keys());
        
        // Exact match first
        const exactMatch = nodes.find(node => 
            node.toLowerCase() === cleanQuery.toLowerCase()
        );
        
        if (exactMatch) {
            return exactMatch;
        }
        
        // Similar match using ConceptUtils
        const similarMatch = ConceptUtils.findSimilarConcept(cleanQuery, nodes, 0.7);
        return similarMatch;
    }
    
    async selectExistingNode(nodeConcept) {
        console.log(`SearchManager: Selecting existing node: ${nodeConcept}`);
        
        // Select the node in the graph
        if (this.graphRenderer.selectNode) {
            this.graphRenderer.selectNode(nodeConcept);
        }
        
        // Focus camera on the node
        const nodeData = this.graphRenderer.nodes.get(nodeConcept);
        if (nodeData && this.graphRenderer.cameraController) {
            // Could add camera focus functionality here
        }
        
        this.showSuccess(`Nodo encontrado: ${nodeConcept}`);
        
        // Emit node found event
        if (this.onNodeFound) {
            this.onNodeFound({ concept: nodeConcept, nodeData });
        }
    }
    
    async createNewSubgraph(query) {
        console.log(`SearchManager: Creating new subgraph for: ${query}`);
        
        const cleanConcept = ConceptUtils.cleanConcept(query);
        
        // Start a mini growth phase for the new subgraph
        if (this.graphRenderer.growthPhaseManager && !this.graphRenderer.growthPhaseManager.isPhaseActive()) {
            // Calculate expected nodes for this expansion
            const expectedNodes = this.calculateExpectedNodes();
            
            // Generate concepts from the new node
            await this.generateSubgraph(cleanConcept, expectedNodes);
        } else {
            // If growth phase is active, just add the single node
            await this.addSingleNode(cleanConcept);
        }
        
        this.showSuccess(`Nuevo concepto creado: ${cleanConcept}`);
        
        // Emit node created event
        if (this.onNodeCreated) {
            this.onNodeCreated({ concept: cleanConcept, iterations: this.getCurrentIterations() });
        }
    }
    
    async generateSubgraph(rootConcept, expectedNodes) {
        // Add root concept to backend
        await this.apiService.addConceptToGraph(rootConcept);
        
        // Create root node at a random position (will be repositioned)
        const randomPos = {
            x: (Math.random() - 0.5) * 12,
            y: (Math.random() - 0.5) * 12,
            z: (Math.random() - 0.5) * 12
        };
        
        const rootNode = await this.graphRenderer.createNode(rootConcept, randomPos, true);
        
        // Start new growth phase for this subgraph
        this.graphRenderer.startGrowthPhase(rootNode.sphere, expectedNodes);
        
        // Generate related concepts
        let currentConcepts = [rootConcept];
        let allConcepts = new Set([rootConcept]);
        
        for (let cycle = 0; cycle < this.getCurrentIterations(); cycle++) {
            const nextConcepts = [];
            
            for (const concept of currentConcepts) {
                const relatedConcepts = await this.apiService.generateConcepts(concept, 3);
                
                for (const relatedConcept of relatedConcepts) {
                    await this.delay(100);
                    
                    // Check for similar concepts in entire graph
                    const existingConcept = ConceptUtils.findSimilarConcept(
                        relatedConcept, 
                        Array.from(this.graphRenderer.nodes.keys())
                    );
                    
                    if (existingConcept && existingConcept !== concept) {
                        // Connect to existing node
                        this.graphRenderer.createEdge(concept, existingConcept, true);
                    } else if (!allConcepts.has(relatedConcept)) {
                        allConcepts.add(relatedConcept);
                        nextConcepts.push(relatedConcept);
                        
                        // Add to backend and visualization
                        await this.apiService.addConceptToGraph(relatedConcept, concept);
                        
                        const newPos = {
                            x: (Math.random() - 0.5) * 12,
                            y: (Math.random() - 0.5) * 12,
                            z: (Math.random() - 0.5) * 12
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
    
    async addSingleNode(concept) {
        await this.apiService.addConceptToGraph(concept);
        
        const randomPos = {
            x: (Math.random() - 0.5) * 10,
            y: (Math.random() - 0.5) * 10,
            z: (Math.random() - 0.5) * 10
        };
        
        await this.graphRenderer.createNode(concept, randomPos, true);
    }
    
    calculateExpectedNodes(iterations = null) {
        const actualIterations = iterations || this.getCurrentIterations();
        let total = 1; // Root node
        for (let i = 0; i < actualIterations; i++) {
            total += Math.pow(3, i + 1);
        }
        return total;
    }
    
    // Iteration management - handled by HTML script, just sync when needed
    getCurrentIterations() {
        return window.getCurrentIterations ? window.getCurrentIterations() : this.currentIterations;
    }
    
    // UI State management
    setSearching(searching) {
        if (this.searchInput) {
            this.searchInput.disabled = searching;
            this.searchInput.placeholder = searching ? 'Buscando...' : 'Buscar o añadir concepto...';
        }
    }
    
    getSearchQuery() {
        return this.searchInput ? this.searchInput.value.trim() : '';
    }
    
    clearSearch() {
        if (this.searchInput) {
            this.searchInput.value = '';
            this.updateSearchState();
            this.hideSuggestions();
        }
    }
    
    showSuccess(message) {
        console.log('SearchManager Success:', message);
        // Could add toast notification here
    }
    
    showError(message) {
        console.error('SearchManager Error:', message);
        // Could add toast notification here
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Event binding
    onSearchStarted(callback) {
        this.onSearchStart = callback;
    }
    
    onSearchCompleted(callback) {
        this.onSearchComplete = callback;
    }
    
    onNodeFoundCallback(callback) {
        this.onNodeFound = callback;
    }
    
    onNodeCreatedCallback(callback) {
        this.onNodeCreated = callback;
    }
    
    // Cleanup
    destroy() {
        if (this.suggestionsContainer && this.suggestionsContainer.parentNode) {
            this.suggestionsContainer.parentNode.removeChild(this.suggestionsContainer);
        }
        
        this.graphRenderer = null;
        this.apiService = null;
        this.searchInput = null;
        this.iterationCount = null;
        this.decreaseBtn = null;
        this.increaseBtn = null;
        this.suggestionsContainer = null;
        
        this.onSearchStart = null;
        this.onSearchComplete = null;
        this.onNodeFound = null;
        this.onNodeCreated = null;
        
        console.log('SearchManager: Destroyed');
    }
}