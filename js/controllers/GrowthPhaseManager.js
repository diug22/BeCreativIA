export class GrowthPhaseManager {
    constructor(cameraController, progressBar) {
        this.cameraController = cameraController;
        this.progressBar = progressBar;
        
        // Estado de la fase
        this.isActive = false;
        this.initialNode = null;
        this.totalExpectedNodes = 0;
        this.currentNodeCount = 0;
        this.phaseStartTime = null;
        
        // Callbacks
        this.onPhaseStart = null;
        this.onPhaseEnd = null;
        this.onNodeAdded = null;
        this.onProgressUpdate = null;
        
        console.log('GrowthPhaseManager: Initialized');
    }
    
    startPhase(initialNode, expectedTotalNodes) {
        if (this.isActive) {
            console.warn('GrowthPhaseManager: Phase already active');
            return;
        }
        
        console.log(`GrowthPhaseManager: Starting growth phase - initial: ${initialNode?.userData?.concept || 'unknown'}, expected: ${expectedTotalNodes}`);
        
        this.isActive = true;
        this.initialNode = initialNode;
        this.totalExpectedNodes = expectedTotalNodes;
        this.currentNodeCount = 1;
        this.phaseStartTime = Date.now();
        
        // Configure camera for growth mode
        if (this.cameraController) {
            this.cameraController.setMode('growth', {
                centerNode: initialNode,
                nodeCount: this.currentNodeCount
            });
        }
        
        // Show and configure progress bar
        if (this.progressBar) {
            this.progressBar.reset();
            this.progressBar.setProgress(this.currentNodeCount, this.totalExpectedNodes);
            this.progressBar.setStatus('Generando red de conceptos...');
            
            // Add initial concept to progress bar
            if (initialNode?.userData?.concept) {
                this.progressBar.addConcept(initialNode.userData.concept);
            }
            
            this.progressBar.show();
        }
        
        // Emit phase start event
        if (this.onPhaseStart) {
            this.onPhaseStart({
                initialNode: this.initialNode,
                expectedNodes: this.totalExpectedNodes
            });
        }
        
        console.log('GrowthPhaseManager: Growth phase started');
    }
    
    addNode(node, concept) {
        if (!this.isActive) {
            console.warn('GrowthPhaseManager: Cannot add node - phase not active');
            return;
        }
        
        this.currentNodeCount++;
        
        console.log(`GrowthPhaseManager: Node added - ${concept} (${this.currentNodeCount}/${this.totalExpectedNodes})`);
        
        // Update camera with new node count
        if (this.cameraController && this.cameraController.isInGrowthMode()) {
            this.cameraController.updateGrowthPhase(this.currentNodeCount, this.initialNode);
        }
        
        // Update progress bar
        if (this.progressBar) {
            this.progressBar.setProgress(this.currentNodeCount, this.totalExpectedNodes);
            this.progressBar.addConcept(concept);
            
            // Update status based on progress
            const progress = (this.currentNodeCount / this.totalExpectedNodes) * 100;
            if (progress < 50) {
                this.progressBar.setStatus('Explorando conceptos iniciales...');
            } else if (progress < 80) {
                this.progressBar.setStatus('Expandiendo red de relaciones...');
            } else {
                this.progressBar.setStatus('Finalizando estructura...');
            }
        }
        
        // Emit node added event
        if (this.onNodeAdded) {
            this.onNodeAdded({
                node: node,
                concept: concept,
                currentCount: this.currentNodeCount,
                totalExpected: this.totalExpectedNodes,
                progress: (this.currentNodeCount / this.totalExpectedNodes) * 100
            });
        }
        
        // Emit progress update
        if (this.onProgressUpdate) {
            this.onProgressUpdate({
                current: this.currentNodeCount,
                total: this.totalExpectedNodes,
                progress: (this.currentNodeCount / this.totalExpectedNodes) * 100,
                concept: concept
            });
        }
        
        // Check if phase should end
        if (this.currentNodeCount >= this.totalExpectedNodes) {
            this.endPhase();
        }
    }
    
    updateExpectedNodes(newTotal) {
        if (!this.isActive) return;
        
        console.log(`GrowthPhaseManager: Updated expected nodes from ${this.totalExpectedNodes} to ${newTotal}`);
        
        this.totalExpectedNodes = newTotal;
        
        // Update progress bar
        if (this.progressBar) {
            this.progressBar.setProgress(this.currentNodeCount, this.totalExpectedNodes);
        }
        
        // Update camera if needed
        if (this.cameraController && this.cameraController.isInGrowthMode()) {
            this.cameraController.updateGrowthPhase(this.currentNodeCount, this.initialNode);
        }
    }
    
    endPhase() {
        if (!this.isActive) {
            console.warn('GrowthPhaseManager: Cannot end phase - phase not active');
            return;
        }
        
        const duration = Date.now() - this.phaseStartTime;
        console.log(`GrowthPhaseManager: Ending growth phase - duration: ${duration}ms, nodes: ${this.currentNodeCount}`);
        
        this.isActive = false;
        
        // Complete progress bar
        if (this.progressBar) {
            this.progressBar.setComplete();
        }
        
        // Enable interactive mode without moving camera (mantener posición orbital)
        setTimeout(() => {
            if (this.cameraController) {
                this.cameraController.setMode('interactive');
            }
        }, 1000);
        
        // Emit phase end event
        if (this.onPhaseEnd) {
            this.onPhaseEnd({
                finalNodeCount: this.currentNodeCount,
                duration: duration,
                initialNode: this.initialNode
            });
        }
        
        console.log('GrowthPhaseManager: Growth phase completed');
    }
    
    forceEndPhase() {
        if (!this.isActive) return;
        
        console.log('GrowthPhaseManager: Force ending growth phase');
        this.endPhase();
    }
    
    // Status methods
    isPhaseActive() {
        return this.isActive;
    }
    
    getPhaseProgress() {
        if (!this.isActive) return null;
        
        return {
            current: this.currentNodeCount,
            total: this.totalExpectedNodes,
            progress: (this.currentNodeCount / this.totalExpectedNodes) * 100,
            duration: Date.now() - this.phaseStartTime,
            initialNode: this.initialNode
        };
    }
    
    getCurrentNodeCount() {
        return this.currentNodeCount;
    }
    
    getExpectedNodeCount() {
        return this.totalExpectedNodes;
    }
    
    // Event binding methods
    onPhaseStarted(callback) {
        this.onPhaseStart = callback;
    }
    
    onPhaseEnded(callback) {
        this.onPhaseEnd = callback;
    }
    
    onNodeAddedToPhase(callback) {
        this.onNodeAdded = callback;
    }
    
    onPhaseProgressUpdate(callback) {
        this.onProgressUpdate = callback;
    }
    
    // Cleanup
    destroy() {
        if (this.isActive) {
            this.forceEndPhase();
        }
        
        this.cameraController = null;
        this.progressBar = null;
        this.initialNode = null;
        
        this.onPhaseStart = null;
        this.onPhaseEnd = null;
        this.onNodeAdded = null;
        this.onProgressUpdate = null;
        
        console.log('GrowthPhaseManager: Destroyed');
    }
}