import * as THREE from 'three';

/**
 * Camera Controller - Desacoplado
 * Maneja diferentes modos de cámara: tunnel, growth, interactive
 */
export class CameraController {
    constructor(camera, controls) {
        this.camera = camera;
        this.controls = controls;
        
        // Estados de la cámara
        this.mode = 'inactive'; // inactive, tunnel, growth, interactive
        this.isAnimating = false;
        this.animationId = null;
        
        // Configuraciones para cada modo
        this.modes = {
            tunnel: {
                position: { x: 0, y: 0, z: 15 },
                lookAt: { x: 0, y: 0, z: -1 },
                controlsEnabled: false
            },
            growth: {
                distance: 8,
                height: 2,
                rotationSpeed: 0.2, // radianes por segundo (más lento)
                zoomOutFactor: 0.3, // Factor de zoom más sutil
                controlsEnabled: false
            },
            interactive: {
                position: { x: 0, y: 0, z: 5 },
                lookAt: { x: 0, y: 0, z: 0 },
                controlsEnabled: true
            }
        };
        
        // Estado del modo growth
        this.growthState = {
            centerNode: null,
            nodeCount: 0,
            rotationAngle: 0,
            baseDistance: 8,
            currentDistance: 8,
            initialPosition: null, // Para recordar posición del túnel
            hasStartedRotation: false
        };
        
        // Callbacks
        this.onModeChange = null;
    }
    
    setMode(mode, options = {}) {
        if (this.mode === mode) return;
        
        console.log(`CameraController: Switching to ${mode} mode`);
        
        const previousMode = this.mode;
        this.mode = mode;
        
        // Stop any current animation
        this.stopAnimation();
        
        switch (mode) {
            case 'tunnel':
                this.enterTunnelMode();
                break;
            case 'growth':
                this.enterGrowthMode(options);
                break;
            case 'interactive':
                this.enterInteractiveMode();
                break;
            case 'inactive':
                this.enterInactiveMode();
                break;
        }
        
        // Emit mode change event
        if (this.onModeChange) {
            this.onModeChange(mode, previousMode);
        }
    }
    
    enterTunnelMode() {
        const config = this.modes.tunnel;
        
        this.camera.position.set(config.position.x, config.position.y, config.position.z);
        this.camera.lookAt(config.lookAt.x, config.lookAt.y, config.lookAt.z);
        
        if (this.controls) {
            this.controls.enabled = config.controlsEnabled;
        }
    }
    
    enterGrowthMode(options = {}) {
        const { centerNode, nodeCount = 1 } = options;
        
        this.growthState.centerNode = centerNode;
        this.growthState.nodeCount = nodeCount;
        this.growthState.rotationAngle = 0;
        this.growthState.hasStartedRotation = false;
        
        // Store current camera position as initial position (from tunnel)
        this.growthState.initialPosition = {
            x: this.camera.position.x,
            y: this.camera.position.y,
            z: this.camera.position.z
        };
        
        // Calculate dynamic distance based on node count (más sutil)
        const config = this.modes.growth;
        this.growthState.currentDistance = config.distance + (nodeCount * config.zoomOutFactor);
        this.growthState.baseDistance = this.growthState.currentDistance;
        
        // Disable controls during growth
        if (this.controls) {
            this.controls.enabled = config.controlsEnabled;
        }
        
        // Start growth animation (inicialmente desde posición del túnel)
        this.startGrowthAnimation();
        
        console.log(`CameraController: Growth mode - distance: ${this.growthState.currentDistance}, nodes: ${nodeCount}`);
        console.log('CameraController: Starting from tunnel position:', this.growthState.initialPosition);
    }
    
    startGrowthAnimation() {
        if (this.isAnimating) return;
        
        this.isAnimating = true;
        let lastTime = performance.now();
        const startTime = performance.now();
        const transitionDuration = 2000; // 2 segundos para comenzar rotación
        
        const animate = (currentTime) => {
            if (!this.isAnimating || this.mode !== 'growth') {
                return;
            }
            
            const deltaTime = (currentTime - lastTime) / 1000;
            const elapsedTime = currentTime - startTime;
            lastTime = currentTime;
            
            const config = this.modes.growth;
            const centerPos = this.growthState.centerNode 
                ? this.growthState.centerNode.position 
                : { x: 0, y: 0, z: 0 };
            
            // Si aún no ha empezado la rotación, mantener posición inicial por un momento
            if (elapsedTime < transitionDuration && this.growthState.initialPosition) {
                // Transición suave desde posición del túnel hacia posición orbital inicial
                const progress = elapsedTime / transitionDuration;
                const easeProgress = progress < 0.5 
                    ? 2 * progress * progress 
                    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
                
                // Calcular posición orbital inicial (sin rotación aún)
                const initialOrbitalX = centerPos.x + this.growthState.currentDistance;
                const initialOrbitalY = centerPos.y + config.height;
                const initialOrbitalZ = centerPos.z;
                
                // Interpolar desde posición del túnel a posición orbital inicial
                const x = this.growthState.initialPosition.x + (initialOrbitalX - this.growthState.initialPosition.x) * easeProgress;
                const y = this.growthState.initialPosition.y + (initialOrbitalY - this.growthState.initialPosition.y) * easeProgress;
                const z = this.growthState.initialPosition.z + (initialOrbitalZ - this.growthState.initialPosition.z) * easeProgress;
                
                this.camera.position.set(x, y, z);
                this.camera.lookAt(centerPos.x, centerPos.y, centerPos.z);
                
                // Establecer ángulo inicial para cuando comience la rotación
                this.growthState.rotationAngle = 0;
            } else {
                // Ya pasó el tiempo de transición, comenzar rotación orbital
                if (!this.growthState.hasStartedRotation) {
                    this.growthState.hasStartedRotation = true;
                    console.log('CameraController: Starting orbital rotation');
                }
                
                // Update rotation angle
                this.growthState.rotationAngle += this.modes.growth.rotationSpeed * deltaTime;
                
                // Calculate camera position in orbit around center
                const x = centerPos.x + Math.cos(this.growthState.rotationAngle) * this.growthState.currentDistance;
                const z = centerPos.z + Math.sin(this.growthState.rotationAngle) * this.growthState.currentDistance;
                const y = centerPos.y + config.height;
                
                this.camera.position.set(x, y, z);
                this.camera.lookAt(centerPos.x, centerPos.y, centerPos.z);
            }
            
            this.animationId = requestAnimationFrame(animate);
        };
        
        this.animationId = requestAnimationFrame(animate);
        console.log('CameraController: Growth animation started from tunnel position');
    }
    
    updateGrowthPhase(nodeCount, centerNode = null) {
        if (this.mode !== 'growth') return;
        
        this.growthState.nodeCount = nodeCount;
        
        // Update center node if provided
        if (centerNode) {
            this.growthState.centerNode = centerNode;
        }
        
        // Zoom out más sutil - solo cuando hay cambios significativos
        const config = this.modes.growth;
        const targetDistance = config.distance + (nodeCount * config.zoomOutFactor);
        
        // Solo hacer zoom si la diferencia es significativa
        const distanceDiff = Math.abs(targetDistance - this.growthState.currentDistance);
        if (distanceDiff > 0.5) {
            this.animateDistanceChange(targetDistance, 1500); // Transición más lenta
        }
        
        console.log(`CameraController: Updated growth phase - nodes: ${nodeCount}, distance: ${targetDistance.toFixed(2)}`);
    }
    
    animateDistanceChange(targetDistance, duration = 1000) {
        const startDistance = this.growthState.currentDistance;
        const startTime = performance.now();
        
        const animateDistance = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease-in-out interpolation
            const easeProgress = progress < 0.5 
                ? 2 * progress * progress 
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;
            
            this.growthState.currentDistance = startDistance + (targetDistance - startDistance) * easeProgress;
            
            if (progress < 1) {
                requestAnimationFrame(animateDistance);
            }
        };
        
        requestAnimationFrame(animateDistance);
    }
    
    enterInteractiveMode() {
        const config = this.modes.interactive;
        
        // Stop growth animation
        this.stopAnimation();
        
        // Enable controls from current position (no camera movement)
        if (this.controls) {
            this.controls.enabled = config.controlsEnabled;
        }
        
        console.log('CameraController: Interactive mode enabled from current position');
    }
    
    enterInactiveMode() {
        this.stopAnimation();
        
        if (this.controls) {
            this.controls.enabled = false;
        }
    }
    
    animateCameraTo(targetPosition, targetLookAt, duration = 1000, onComplete = null) {
        const startPosition = this.camera.position.clone();
        const startLookAt = new THREE.Vector3();
        this.camera.getWorldDirection(startLookAt);
        startLookAt.multiplyScalar(-1).add(this.camera.position);
        
        const startTime = performance.now();
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease-in-out interpolation
            const easeProgress = progress < 0.5 
                ? 2 * progress * progress 
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;
            
            // Interpolate position
            this.camera.position.lerpVectors(startPosition, new THREE.Vector3(targetPosition.x, targetPosition.y, targetPosition.z), easeProgress);
            
            // Interpolate lookAt
            const currentLookAt = new THREE.Vector3().lerpVectors(startLookAt, new THREE.Vector3(targetLookAt.x, targetLookAt.y, targetLookAt.z), easeProgress);
            this.camera.lookAt(currentLookAt);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else if (onComplete) {
                onComplete();
            }
        };
        
        requestAnimationFrame(animate);
    }
    
    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.isAnimating = false;
    }
    
    getCurrentMode() {
        return this.mode;
    }
    
    isInGrowthMode() {
        return this.mode === 'growth';
    }
    
    getGrowthState() {
        return { ...this.growthState };
    }
    
    // Event binding
    onModeChanged(callback) {
        this.onModeChange = callback;
    }
    
    // Cleanup
    destroy() {
        this.stopAnimation();
        this.onModeChange = null;
        this.growthState.centerNode = null;
    }
}