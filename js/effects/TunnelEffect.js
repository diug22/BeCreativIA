import * as THREE from 'three';
import { ConceptUtils } from '../utils/ConceptUtils.js';

/**
 * Modern Prismatic Tunnel Effect for Loading State
 * Creates an elegant glassmorphic flow with translucent geometric particles
 */
export class TunnelEffect {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.progressText = null;
        this.isActive = false;
        this.animationId = null;
        this.progress = 0;
        this.finishing = false;
        this.firstNodeGenerated = false;
        this.keepLoadingUI = true; // Loading UI independent from tunnel
        
        // Cylindrical tunnel parameters - surrounds camera
        this.tunnelLength = 120;
        this.tunnelRadius = 8; // Distance from camera center
        this.particleCount = 200; // Dense particles for tunnel walls
        this.particles = [];
        this.cameraPosition = new THREE.Vector3(0, 0, 0); // Will be updated to camera position
        
        // Concept-based colors
        this.conceptQueue = [];
        this.conceptColors = new Map();
        this.initialConcept = null;
        this.currentConceptHue = 0.6; // Default blue
        
        // Enhanced material templates for dramatic visibility
        this.materials = {
            crystal: {
                transparent: true,
                opacity: 0.6, // Increased visibility
                blending: THREE.AdditiveBlending, // More dramatic glow
                depthWrite: false,
                side: THREE.DoubleSide,
                roughness: 0.1,
                metalness: 0.0
            },
            sphere: {
                transparent: true,
                opacity: 0.7, // More visible
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                roughness: 0.0,
                metalness: 0.1
            },
            particle: {
                transparent: true,
                opacity: 0.8, // Much more visible
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                sizeAttenuation: true
            }
        };
        
        // Geometries (reused for performance)
        this.geometries = {};
        this.time = 0;
    }
    
    create() {
        console.log('TunnelEffect: Creating prismatic flow effect');
        this.setupBackground();
        this.setupLighting();
        this.createGeometries();
        this.createParticles();
        this.createLoadingUI();
        this.setupAnimation();
        console.log('TunnelEffect: Prismatic tunnel created with', this.particles.length, 'particles');
    }
    
    createLoadingUI() {
        // Create loading container positioned at top
        this.loadingContainer = document.createElement('div');
        this.loadingContainer.style.cssText = `
            position: fixed;
            top: 100px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10000;
            text-align: center;
            pointer-events: none;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            color: #ffffff;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(25px);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 20px;
            padding: 1.5rem 2.5rem;
            box-shadow: 0 8px 40px rgba(0, 170, 255, 0.25);
            opacity: 0;
            transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
            min-width: 300px;
        `;
        
        // Main loading text - more compact for top position
        this.loadingText = document.createElement('div');
        this.loadingText.style.cssText = `
            font-size: 1.1rem;
            font-weight: 400;
            margin-bottom: 0.75rem;
            background: linear-gradient(135deg, #ffffff, #00aaff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            letter-spacing: 0.03em;
            text-transform: uppercase;
        `;
        this.loadingText.textContent = 'Generando Grafo';
        
        // Current concept being processed
        this.currentConceptText = document.createElement('div');
        this.currentConceptText.style.cssText = `
            font-size: 0.9rem;
            font-weight: 400;
            color: rgba(255, 255, 255, 0.85);
            margin-bottom: 1rem;
            min-height: 1rem;
            letter-spacing: 0.02em;
        `;
        this.currentConceptText.textContent = '';
        
        // Progress indicator with dots
        this.progressIndicator = document.createElement('div');
        this.progressIndicator.style.cssText = `
            display: flex;
            justify-content: center;
            gap: 0.4rem;
            margin-bottom: 0.75rem;
        `;
        
        // Create animated dots - smaller for top position
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.style.cssText = `
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: #00aaff;
                opacity: 0.3;
                animation: pulse-dot 1.5s ease-in-out infinite;
                animation-delay: ${i * 0.2}s;
            `;
            this.progressIndicator.appendChild(dot);
        }
        
        // Status text - more compact
        this.statusText = document.createElement('div');
        this.statusText.style.cssText = `
            font-size: 0.75rem;
            font-weight: 300;
            color: rgba(0, 170, 255, 0.9);
            letter-spacing: 0.08em;
            text-transform: uppercase;
        `;
        this.statusText.textContent = 'Procesando conceptos...';
        
        // Add CSS animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse-dot {
                0%, 80%, 100% { opacity: 0.3; transform: scale(1); }
                40% { opacity: 1; transform: scale(1.2); }
            }
            
            @keyframes glow-pulse {
                0%, 100% { box-shadow: 0 8px 40px rgba(0, 170, 255, 0.2); }
                50% { box-shadow: 0 8px 40px rgba(0, 170, 255, 0.4); }
            }
        `;
        document.head.appendChild(style);
        this.loadingStyle = style;
        
        // Assemble the UI
        this.loadingContainer.appendChild(this.loadingText);
        this.loadingContainer.appendChild(this.currentConceptText);
        this.loadingContainer.appendChild(this.progressIndicator);
        this.loadingContainer.appendChild(this.statusText);
        
        document.body.appendChild(this.loadingContainer);
        
        // Fade in the loading UI
        setTimeout(() => {
            this.loadingContainer.style.opacity = '1';
            this.loadingContainer.style.animation = 'glow-pulse 2s ease-in-out infinite';
        }, 100);
        
        console.log('TunnelEffect: Loading UI created');
    }
    
    setupLighting() {
        // Enhanced ambient lighting for tunnel visibility
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);
        
        // Tunnel wall illumination - multiple point lights around camera
        const tunnelLights = [];
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const x = Math.cos(angle) * (this.tunnelRadius * 0.7);
            const y = Math.sin(angle) * (this.tunnelRadius * 0.7);
            
            const tunnelLight = new THREE.PointLight(0x00aaff, 1.5, this.tunnelRadius * 3);
            tunnelLight.position.set(x, y, 0);
            this.scene.add(tunnelLight);
            tunnelLights.push(tunnelLight);
        }
        
        // Forward/backward tunnel illumination
        const forwardLight = new THREE.PointLight(0x4080ff, 2.0, this.tunnelLength * 0.6);
        forwardLight.position.set(0, 0, this.tunnelLength * 0.3);
        this.scene.add(forwardLight);
        
        const backwardLight = new THREE.PointLight(0x4080ff, 2.0, this.tunnelLength * 0.6);
        backwardLight.position.set(0, 0, -this.tunnelLength * 0.3);
        this.scene.add(backwardLight);
        
        this.ambientLight = ambientLight;
        this.tunnelLights = tunnelLights;
        this.forwardLight = forwardLight;
        this.backwardLight = backwardLight;
        this.centerLight = forwardLight; // Keep reference for animation
        
        console.log('TunnelEffect: Cylindrical tunnel lighting setup complete');
    }
    
    setupBackground() {
        // Deep black background
        this.scene.background = new THREE.Color(0x000000);
        
        // Enhanced fog for tunnel depth effect
        this.scene.fog = new THREE.FogExp2(0x000818, 0.003);
        
        console.log('TunnelEffect: Cylindrical tunnel background set');
    }
    
    createGeometries() {
        // Create reusable geometries for performance
        this.geometries.hexagonalPrism = new THREE.CylinderGeometry(0.3, 0.3, 1.2, 6);
        this.geometries.sphere = new THREE.SphereGeometry(0.4, 16, 12);
        this.geometries.particle = new THREE.PlaneGeometry(0.2, 0.2);
        
        console.log('TunnelEffect: Prismatic geometries created');
    }
    
    createParticles() {
        // Create initial set of prismatic particles
        for (let i = 0; i < this.particleCount; i++) {
            this.createSingleParticle();
        }
        
        console.log('TunnelEffect: Created', this.particleCount, 'prismatic particles');
    }
    
    createSingleParticle() {
        // Create particle on tunnel wall (cylindrical around camera)
        const angle = Math.random() * Math.PI * 2; // Around camera
        const zPosition = Math.random() * this.tunnelLength - this.tunnelLength / 2; // Along tunnel length
        
        // Position on tunnel wall
        const x = Math.cos(angle) * this.tunnelRadius;
        const y = Math.sin(angle) * this.tunnelRadius;
        const z = zPosition;
        const position = new THREE.Vector3(x, y, z);
        
        // Choose particle type
        const particleType = this.getRandomParticleType();
        const geometry = this.geometries[particleType];
        const material = this.createParticleMaterial(particleType);
        const mesh = new THREE.Mesh(geometry, material);
        
        mesh.position.copy(position);
        
        // Random rotation for crystals
        if (particleType === 'hexagonalPrism') {
            mesh.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
        }
        
        const particleData = {
            mesh,
            type: particleType,
            cylinderAngle: angle,
            zStart: zPosition,
            zDirection: Math.random() > 0.5 ? 1 : -1, // Flow direction along tunnel
            speed: 15 + Math.random() * 10, // Speed along Z axis
            rotationSpeed: new THREE.Vector3(
                (Math.random() - 0.5) * 0.03,
                (Math.random() - 0.5) * 0.03,
                (Math.random() - 0.5) * 0.03
            ),
            scale: 0.3 + Math.random() * 0.6,
            pulsePhase: Math.random() * Math.PI * 2,
            // Add slight radius variation for more organic tunnel
            radiusOffset: (Math.random() - 0.5) * 2
        };
        
        mesh.scale.setScalar(particleData.scale);
        
        this.particles.push(particleData);
        this.scene.add(mesh);
    }
    
    getRandomParticleType() {
        const types = ['hexagonalPrism', 'sphere', 'particle'];
        const weights = [0.4, 0.35, 0.25]; // Prefer crystals, then spheres, then particles
        const random = Math.random();
        
        let cumulative = 0;
        for (let i = 0; i < types.length; i++) {
            cumulative += weights[i];
            if (random < cumulative) {
                return types[i];
            }
        }
        return types[0];
    }
    
    createParticleMaterial(type) {
        const baseColor = new THREE.Color().setHSL(this.currentConceptHue, 0.6, 0.7);
        const accentColor = new THREE.Color().setHSL(this.currentConceptHue, 0.8, 0.9);
        
        switch (type) {
            case 'hexagonalPrism':
                return new THREE.MeshBasicMaterial({
                    ...this.materials.crystal,
                    color: accentColor,
                    emissive: accentColor,
                    emissiveIntensity: 0.4
                });
            
            case 'sphere':
                return new THREE.MeshBasicMaterial({
                    ...this.materials.sphere,
                    color: accentColor,
                    emissive: accentColor,
                    emissiveIntensity: 0.5
                });
            
            case 'particle':
                return new THREE.MeshBasicMaterial({
                    ...this.materials.particle,
                    color: accentColor,
                    transparent: true,
                    opacity: 0.6
                });
            
            default:
                return new THREE.MeshBasicMaterial({ color: baseColor });
        }
    }
    
    updateConceptColors() {
        // Update current concept hue based on latest concept
        if (this.conceptColors.size > 0) {
            const latestConcept = Array.from(this.conceptColors.keys()).pop();
            this.currentConceptHue = ConceptUtils.getConceptHue(latestConcept);
        }
    }
    
    respawnParticle(particle, index) {
        // Reset particle to new position on tunnel wall
        particle.cylinderAngle = Math.random() * Math.PI * 2;
        particle.zStart = Math.random() * this.tunnelLength - this.tunnelLength / 2;
        particle.zDirection = Math.random() > 0.5 ? 1 : -1;
        
        // Position on tunnel wall
        const x = Math.cos(particle.cylinderAngle) * (this.tunnelRadius + particle.radiusOffset);
        const y = Math.sin(particle.cylinderAngle) * (this.tunnelRadius + particle.radiusOffset);
        const z = particle.zStart;
        
        particle.mesh.position.set(x, y, z);
        particle.speed = 15 + Math.random() * 10;
        particle.pulsePhase = Math.random() * Math.PI * 2;
    }
    
    // Method to pre-seed with initial concept for better color consistency
    setInitialConcept(concept) {
        if (concept && !this.conceptColors.has(concept)) {
            const conceptHue = ConceptUtils.getConceptHue(concept);
            const conceptColor = new THREE.Color().setHSL(conceptHue, 0.8, 0.6);
            this.conceptColors.set(concept, conceptColor.getHex());
            this.initialConcept = concept;
            this.currentConceptHue = conceptHue;
            console.log(`TunnelEffect: Pre-seeded with concept '${concept}' color`, conceptColor.getHexString());
        }
    }

    
    setupAnimation() {
        let lastTime = performance.now();
        
        const animate = (currentTime) => {
            if (!this.isActive) return;
            
            const deltaTime = (currentTime - lastTime) / 1000;
            lastTime = currentTime;
            this.time = currentTime * 0.001;
            
            // Update tunnel particles
            this.particles.forEach((particle, index) => {
                // Move particle along Z axis (tunnel flow)
                const currentZ = particle.mesh.position.z;
                const newZ = currentZ + (particle.zDirection * particle.speed * deltaTime);
                
                // Check if particle has exited tunnel bounds
                const halfTunnel = this.tunnelLength / 2;
                if (newZ > halfTunnel || newZ < -halfTunnel) {
                    this.respawnParticle(particle, index);
                    return;
                }
                
                // Update position while maintaining tunnel wall position
                const radius = this.tunnelRadius + particle.radiusOffset;
                const x = Math.cos(particle.cylinderAngle) * radius;
                const y = Math.sin(particle.cylinderAngle) * radius;
                
                particle.mesh.position.set(x, y, newZ);
                
                // Elegant rotation
                particle.mesh.rotation.x += particle.rotationSpeed.x;
                particle.mesh.rotation.y += particle.rotationSpeed.y;
                particle.mesh.rotation.z += particle.rotationSpeed.z;
                
                // Breathing scale effect
                const breathe = Math.sin(this.time * 1.5 + particle.pulsePhase) * 0.1 + 0.9;
                const scaleMultiplier = particle.scale * breathe;
                particle.mesh.scale.setScalar(scaleMultiplier);
                
                // Dynamic opacity based on distance from tunnel center
                const distanceFromTunnelCenter = Math.abs(newZ) / halfTunnel;
                const fadeOpacity = 1 - (distanceFromTunnelCenter * 0.3); // Fade near tunnel ends
                
                particle.mesh.material.opacity = Math.max(0.2, fadeOpacity);
                
                // Update emissive intensity for glow effect
                if (particle.mesh.material.emissive) {
                    const glowIntensity = (Math.sin(this.time * 2 + particle.pulsePhase) * 0.05 + 0.15);
                    particle.mesh.material.emissiveIntensity = Math.max(0, glowIntensity);
                }
            });
            
            // Update tunnel lighting with dynamic effects
            if (this.centerLight) {
                const pulse = Math.sin(this.time * 1.2) * 0.3 + 1.0;
                this.centerLight.intensity = pulse * 2.0;
                
                // Update color based on current concept
                const conceptColor = new THREE.Color().setHSL(this.currentConceptHue, 0.8, 0.6);
                this.centerLight.color.copy(conceptColor);
            }
            
            this.animationId = requestAnimationFrame(animate);
        };
        
        animate(performance.now());
        console.log('TunnelEffect: Prismatic flow animation started');
    }

    
    addLoadingNode(concept, color = null) {
        console.log('TunnelEffect: Concept flowing through prismatic tunnel:', concept);
        
        // Update loading UI with current concept
        this.updateLoadingConcept(concept);
        
        // Add concept to color system
        if (!this.conceptColors.has(concept)) {
            const conceptHue = ConceptUtils.getConceptHue(concept);
            const conceptColor = new THREE.Color().setHSL(conceptHue, 0.8, 0.6);
            this.conceptColors.set(concept, conceptColor.getHex());
            this.conceptQueue.push(concept);
            this.currentConceptHue = conceptHue;
            
            // Update existing particles with new concept color
            this.updateParticleColors();
            
            console.log(`TunnelEffect: Added concept '${concept}' with hue`, conceptHue);
        }
        
        // Store initial concept
        if (!this.initialConcept) {
            this.initialConcept = concept;
        }
        
        // Stop tunnel when first node is generated (but keep loading UI)
        if (!this.firstNodeGenerated) {
            this.firstNodeGenerated = true;
            setTimeout(() => {
                this.stopTunnel(); // Only stop tunnel, not loading UI
            }, 1500);
            console.log('TunnelEffect: First node generated, stopping tunnel but keeping loading UI');
        }
    }
    
    updateLoadingConcept(concept) {
        if (this.currentConceptText) {
            // Add smooth transition effect
            this.currentConceptText.style.opacity = '0';
            this.currentConceptText.style.transform = 'translateY(10px)';
            
            setTimeout(() => {
                this.currentConceptText.textContent = `Procesando: "${concept}"`;
                this.currentConceptText.style.opacity = '1';
                this.currentConceptText.style.transform = 'translateY(0)';
                this.currentConceptText.style.transition = 'all 0.3s ease';
            }, 150);
        }
    }
    
    updateParticleColors() {
        // Gradually update particle materials with new concept colors
        this.particles.forEach(particle => {
            const material = particle.mesh.material;
            const baseColor = new THREE.Color().setHSL(this.currentConceptHue, 0.6, 0.7);
            const accentColor = new THREE.Color().setHSL(this.currentConceptHue, 0.8, 0.9);
            
            if (material.color) material.color.copy(baseColor);
            if (material.emissive) material.emissive.copy(accentColor);
        });
    }
    
    setProgress(percentage) {
        this.progress = percentage;
        
        if (this.progressText) {
            this.progressText.textContent = `Cargando... ${Math.round(percentage)}%`;
            
            // Add subtle pulse effect every 10%
            if (Math.floor(percentage) % 10 === 0) {
                this.progressText.style.transform = 'translate(-50%, -50%) scale(1.02)';
            } else {
                this.progressText.style.transform = 'translate(-50%, -50%) scale(1)';
            }
        }
        
        // Tunnel will stop when first node is generated, not by progress
        // No automatic finish by percentage
    }
    
    beginFinish() {
        this.finishing = true;
        const startTime = performance.now();
        const duration = 1200; // 1.2 seconds slowdown
        
        const step = (currentTime) => {
            const t = Math.min(1, (currentTime - startTime) / duration);
            
            // Gradually slow down all ring rotations
            this.rays.forEach(group => {
                group.userData.speed *= (1 - t * 0.7);
            });
            
            if (t >= 1) {
                // Fade out and complete
                if (this.progressText) {
                    this.progressText.style.transition = 'opacity 0.6s ease';
                    this.progressText.style.opacity = '0';
                    
                    setTimeout(() => {
                        this.stop();
                    }, 600);
                }
            } else {
                requestAnimationFrame(step);
            }
        };
        
        requestAnimationFrame(step);
        console.log('TunnelEffect: Beginning finish sequence');
    }
    
    setStatus(status) {
        // Update both old progressText and new statusText for compatibility
        if (this.progressText) {
            this.progressText.textContent = status;
        }
        if (this.statusText) {
            this.statusText.style.opacity = '0';
            setTimeout(() => {
                this.statusText.textContent = status;
                this.statusText.style.opacity = '1';
                this.statusText.style.transition = 'opacity 0.3s ease';
            }, 150);
        }
    }
    
    // Method to stop only the tunnel particles (keep loading UI)
    stopTunnel() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.isActive = false;
        
        // Fade out particles only
        this.fadeOutParticles();
        
        console.log('TunnelEffect: Tunnel particles stopped, loading UI continues');
    }
    
    fadeOutParticles() {
        const fadeDuration = 2000;
        const startTime = performance.now();

        const fadeOut = (currentTime) => {
            const t = Math.min(1, (currentTime - startTime) / fadeDuration);
            const easeOut = 1 - Math.pow(1 - t, 3);

            // Fade particles with different timings for organic feel
            this.particles.forEach((particle, index) => {
                const stagger = (index / this.particles.length) * 0.3;
                const adjustedT = Math.max(0, Math.min(1, (t - stagger) / (1 - stagger)));
                
                if (particle.mesh.material.opacity > 0) {
                    particle.mesh.material.opacity *= (1 - adjustedT * 0.1);
                }
                
                // Scale down elegantly
                const scale = particle.scale * (1 - easeOut * 0.5);
                particle.mesh.scale.setScalar(scale);
            });
            
            // Fade tunnel lights
            if (this.tunnelLights) {
                this.tunnelLights.forEach(light => {
                    light.intensity *= (1 - t * 0.05);
                });
            }

            if (t < 1) {
                requestAnimationFrame(fadeOut);
            } else {
                // Remove particles and lights, but keep loading UI
                this.cleanupTunnel();
            }
        };

        requestAnimationFrame(fadeOut);
    }
    
    cleanupTunnel() {
        // Remove particles only
        if (this.particles) {
            this.particles.forEach(particle => {
                this.scene.remove(particle.mesh);
                particle.mesh.material.dispose();
            });
            this.particles = [];
        }
        
        // Remove tunnel-specific lighting
        if (this.tunnelLights) {
            this.tunnelLights.forEach(light => {
                this.scene.remove(light);
            });
            this.tunnelLights = [];
        }
        if (this.forwardLight) {
            this.scene.remove(this.forwardLight);
            this.forwardLight = null;
        }
        if (this.backwardLight) {
            this.scene.remove(this.backwardLight);
            this.backwardLight = null;
        }
        if (this.ambientLight) {
            this.scene.remove(this.ambientLight);
            this.ambientLight = null;
        }
        
        // Reset scene effects
        this.scene.background = null;
        this.scene.fog = null;
        
        console.log('TunnelEffect: Tunnel particles and lights cleaned up, UI remains');
        
        // IMPORTANT: DO NOT touch loading UI here - it should persist
        // Loading UI will only be removed when complete() is called
        if (this.loadingContainer) {
            console.log('TunnelEffect: Loading UI is preserved and will continue until complete()');
        }
    }
    
    // Method to complete the loading process externally  
    complete() {
        console.log('TunnelEffect: complete() called, keepLoadingUI:', this.keepLoadingUI, 'isActive:', this.isActive);
        if (this.keepLoadingUI) {
            console.log('TunnelEffect: Graph generation completed, hiding loading UI');
            this.setStatus('Grafo completado');
            
            // Brief delay to show completion message
            setTimeout(() => {
                this.hideLoadingUI();
            }, 1000);
        } else {
            console.log('TunnelEffect: complete() called but keepLoadingUI is false - UI already hidden');
        }
    }
    
    hideLoadingUI() {
        const fadeDuration = 1000;
        const startTime = performance.now();

        const fadeOut = (currentTime) => {
            const t = Math.min(1, (currentTime - startTime) / fadeDuration);
            const easeOut = 1 - Math.pow(1 - t, 3);

            // Fade loading UI only
            if (this.loadingContainer) {
                this.loadingContainer.style.opacity = `${1 - easeOut}`;
                this.loadingContainer.style.transform = `translateX(-50%) translateY(${easeOut * -20}px) scale(${1 - easeOut * 0.1})`;
            }

            if (t < 1) {
                requestAnimationFrame(fadeOut);
            } else {
                // Remove loading UI
                this.cleanupLoadingUI();
                this.keepLoadingUI = false;
            }
        };

        requestAnimationFrame(fadeOut);
    }
    
    cleanupLoadingUI() {
        // Remove loading UI elements only
        if (this.loadingContainer && this.loadingContainer.parentElement) {
            this.loadingContainer.remove();
            this.loadingContainer = null;
        }
        
        if (this.loadingStyle && this.loadingStyle.parentElement) {
            this.loadingStyle.remove();
            this.loadingStyle = null;
        }
        
        this.loadingText = null;
        this.currentConceptText = null;
        this.progressIndicator = null;
        this.statusText = null;
        
        console.log('TunnelEffect: Loading UI cleaned up');
    }
    
    start() {
        console.log('TunnelEffect: Starting prismatic flow');
        this.isActive = true;
        this.time = 0;
        this.finishing = false;
        this.firstNodeGenerated = false;
        this.keepLoadingUI = true;
        this.conceptQueue = [];
        this.conceptColors.clear();
        this.initialConcept = null;
        this.currentConceptHue = 0.6;
        
        if (!this.particles || this.particles.length === 0) {
            this.create();
        }
        
        console.log('TunnelEffect: Prismatic tunnel active with', this.particles?.length || 0, 'particles');
    }
    
    stop() {
        // Legacy method - now just stops everything
        console.log('TunnelEffect: Full stop requested');
        this.stopTunnel();
        this.hideLoadingUI();
    }
    
    cleanup() {
        console.log('TunnelEffect: Cleaning up prismatic tunnel');
        
        // Remove all particles
        if (this.particles) {
            this.particles.forEach(particle => {
                this.scene.remove(particle.mesh);
                particle.mesh.material.dispose();
            });
            this.particles = [];
        }
        
        // Dispose of shared geometries
        Object.values(this.geometries).forEach(geometry => {
            if (geometry) geometry.dispose();
        });
        this.geometries = {};
        
        // Remove lighting
        if (this.ambientLight) {
            this.scene.remove(this.ambientLight);
            this.ambientLight = null;
        }
        if (this.tunnelLights) {
            this.tunnelLights.forEach(light => {
                this.scene.remove(light);
            });
            this.tunnelLights = [];
        }
        if (this.forwardLight) {
            this.scene.remove(this.forwardLight);
            this.forwardLight = null;
        }
        if (this.backwardLight) {
            this.scene.remove(this.backwardLight);
            this.backwardLight = null;
        }
        this.centerLight = null;
        
        // Remove progress text and loading UI
        if (this.progressText && this.progressText.remove) {
            this.progressText.remove();
            this.progressText = null;
        }
        
        // Remove loading UI elements
        if (this.loadingContainer && this.loadingContainer.parentElement) {
            this.loadingContainer.remove();
            this.loadingContainer = null;
        }
        
        if (this.loadingStyle && this.loadingStyle.parentElement) {
            this.loadingStyle.remove();
            this.loadingStyle = null;
        }
        
        this.loadingText = null;
        this.currentConceptText = null;
        this.progressIndicator = null;
        this.statusText = null;
        
        // Reset scene background and fog
        this.scene.background = null;
        this.scene.fog = null;
        
        // Clear concept data
        this.conceptQueue = [];
        this.conceptColors.clear();
        this.initialConcept = null;
        this.currentConceptHue = 0.6;
        
        console.log('TunnelEffect: Prismatic tunnel cleanup complete');
    }
}