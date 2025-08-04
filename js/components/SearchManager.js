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
        this.currentIterations = 2;
        this.minIterations = 1;
        this.maxIterations = 4;
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
        this.updateIterationDisplay();
        
        console.log('SearchManager: Initialized');
    }
    
    bindElements() {
        this.searchInput = document.getElementById('header-search-input');
        this.iterationCount = document.getElementById('header-iteration-count');
        this.decreaseBtn = document.getElementById('header-decrease-iterations');
        this.increaseBtn = document.getElementById('header-increase-iterations');
        
        if (!this.searchInput) {
            console.error('SearchManager: Search input not found');
            return;
        }
        
        // Debug: Check if input is accessible
        console.log('SearchManager: Input found:', !!this.searchInput);
        console.log('SearchManager: Input disabled?', this.searchInput.disabled);
        console.log('SearchManager: Input display:', window.getComputedStyle(this.searchInput).display);
        
        // Ensure input is enabled and accessible
        this.searchInput.disabled = false;
        this.searchInput.style.pointerEvents = 'all';
        
        console.log('SearchManager: Elements bound successfully');
    }
    
    createSuggestions() {
        if (!this.searchInput) return;
        
        // Create suggestions container
        this.suggestionsContainer = document.createElement('div');
        this.suggestionsContainer.id = 'search-suggestions';
        this.suggestionsContainer.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, rgba(0, 0, 0, 0.95), rgba(0, 0, 0, 0.98));
            border: 2px solid rgba(0, 170, 255, 0.2);
            border-top: none;
            border-radius: 0 0 18px 18px;
            max-height: 250px;
            overflow-y: auto;
            z-index: 10000;
            display: none;
            backdrop-filter: blur(20px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 4px 16px rgba(0, 170, 255, 0.1);
        `;
        
        // Insert after search wrapper
        const searchWrapper = document.getElementById('header-search-wrapper');
        if (searchWrapper) {
            searchWrapper.style.position = 'relative';
            searchWrapper.appendChild(this.suggestionsContainer);
        } else {
            // Fallback to search input parent
            const searchContainer = this.searchInput.parentElement;
            searchContainer.style.position = 'relative';
            searchContainer.appendChild(this.suggestionsContainer);
        }
        
        console.log('SearchManager: Suggestions container created');
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
        
        // Iteration controls
        if (this.decreaseBtn) {
            this.decreaseBtn.addEventListener('click', () => {
                this.decreaseIterations();
            });
        }
        
        if (this.increaseBtn) {
            this.increaseBtn.addEventListener('click', () => {
                this.increaseIterations();
            });
        }
        
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
        
        if (query.length === 0) {
            this.hideSuggestions();
            return;
        }
        
        // Get all node concepts from the graph
        const allConcepts = this.graphRenderer && this.graphRenderer.nodes ? 
            Array.from(this.graphRenderer.nodes.keys()) : [];
        
        // Filter concepts that match the query
        const suggestions = allConcepts
            .filter(concept => concept.toLowerCase().includes(query))
            .slice(0, this.maxSuggestions);
        
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
        if (!this.suggestionsContainer) return;
        
        this.suggestionsContainer.style.display = 'block';
        this.suggestionsVisible = true;
        
        // Add suggestion item styles
        if (!document.getElementById('suggestion-styles')) {
            const style = document.createElement('style');
            style.id = 'suggestion-styles';
            style.textContent = `
                .suggestion-item {
                    padding: 0.75rem 1rem;
                    color: #ffffff;
                    cursor: pointer;
                    font-size: 0.8rem;
                    font-weight: 300;
                    letter-spacing: 0.02em;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                    overflow: hidden;
                    background: transparent;
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
                    background: rgba(0, 170, 255, 0.08);
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
        }
    }
    
    hideSuggestions() {
        if (!this.suggestionsContainer) return;
        
        this.suggestionsContainer.style.display = 'none';
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
            const expectedNodes = this.calculateExpectedNodes(this.currentIterations);
            
            // Generate concepts from the new node
            await this.generateSubgraph(cleanConcept, expectedNodes);
        } else {
            // If growth phase is active, just add the single node
            await this.addSingleNode(cleanConcept);
        }
        
        this.showSuccess(`Nuevo concepto creado: ${cleanConcept}`);
        
        // Emit node created event
        if (this.onNodeCreated) {
            this.onNodeCreated({ concept: cleanConcept, iterations: this.currentIterations });
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
        
        for (let cycle = 0; cycle < this.currentIterations; cycle++) {
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
    
    calculateExpectedNodes(iterations) {
        let total = 1; // Root node
        for (let i = 0; i < iterations; i++) {
            total += Math.pow(3, i + 1);
        }
        return total;
    }
    
    // Iteration management
    decreaseIterations() {
        if (this.currentIterations > this.minIterations) {
            this.currentIterations--;
            this.updateIterationDisplay();
        }
    }
    
    increaseIterations() {
        if (this.currentIterations < this.maxIterations) {
            this.currentIterations++;
            this.updateIterationDisplay();
        }
    }
    
    updateIterationDisplay() {
        if (this.iterationCount) {
            this.iterationCount.textContent = this.currentIterations;
        }
        
        if (this.decreaseBtn) {
            this.decreaseBtn.disabled = this.currentIterations <= this.minIterations;
        }
        
        if (this.increaseBtn) {
            this.increaseBtn.disabled = this.currentIterations >= this.maxIterations;
        }
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