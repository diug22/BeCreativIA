import * as THREE from 'three';
import { ConceptUtils } from '../utils/ConceptUtils.js';

/**
 * Tunnel Effect for Loading State
 * Creates a dynamic tunnel with traveling concept-colored rays - stops when first node is generated
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
        
        // Ray tunnel parameters
        this.centerZ = -60;
        this.holeRadius = 30;
        this.rayCount = 300; // Reduced for better performance with colored rays
        this.rays = [];
        this.maxDist = 160;
        this.minDist = 50;
        this.centerPoint = new THREE.Vector3(0, 0, this.centerZ);
        
        // Concept-based colors
        this.conceptQueue = [];
        this.conceptColors = new Map();
        this.initialConcept = null;
        
        // Base ray material template
        this.baseMaterial = {
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        };
    }
    
    create() {
        console.log('TunnelEffect: Creating ray convergence tunnel effect');
        this.setupBackground();
        this.setupLighting();
        this.createRays();
        this.setupAnimation();
        console.log('TunnelEffect: Ray tunnel created with', this.rays.length, 'rays');
    }
    
    setupLighting() {
        // Soft ambient lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        // Directional light for better sphere visibility
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
        directionalLight.position.set(2, 3, 4);
        this.scene.add(directionalLight);
        
        this.ambientLight = ambientLight;
        this.directionalLight = directionalLight;
        
        console.log('TunnelEffect: Lighting setup complete');
    }
    
    setupBackground() {
        // Dark gradient background like the example
        this.scene.background = new THREE.Color(0x000000);
        
        // Exponential fog for depth
        this.scene.fog = new THREE.FogExp2(0x00030f, 0.0025);
        
        console.log('TunnelEffect: Background and fog set');
    }
    
    createRays() {
        // Create initial set of rays with random concept colors
        for (let i = 0; i < this.rayCount; i++) {
            this.createSingleRay();
        }
        
        console.log('TunnelEffect: Created', this.rayCount, 'concept-colored rays');
    }
    
    computeEndPoint(origin) {
        const dirToCenter = new THREE.Vector3().subVectors(this.centerPoint, origin).normalize();
        // Move away from center in opposite direction so the end is at holeRadius distance
        return new THREE.Vector3().copy(this.centerPoint).addScaledVector(dirToCenter.clone().negate(), this.holeRadius);
    }
    
    createSingleRay() {
        // Origin on sphere around the center
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const radius = Math.random() * (this.maxDist - this.minDist) + this.minDist;
        const x = Math.sin(phi) * Math.cos(theta) * radius;
        const y = Math.sin(phi) * Math.sin(theta) * radius;
        const z = Math.cos(phi) * radius;
        const origin = new THREE.Vector3(x, y, z + this.centerZ);
        
        // Calculate end point before the hole
        const endPoint = this.computeEndPoint(origin);
        const dir = new THREE.Vector3().subVectors(endPoint, origin).normalize();
        const length = origin.distanceTo(endPoint);
        
        // Get color for this ray (concept-based or random)
        const rayColor = this.getNextRayColor();
        
        // Create ray geometry with concept-based color
        const geometry = new THREE.CylinderGeometry(0.02, 0.02, length, 6, 1, true);
        const material = new THREE.MeshBasicMaterial({
            ...this.baseMaterial,
            color: rayColor
        });
        const mesh = new THREE.Mesh(geometry, material);
        
        // Position and orient the ray
        const mid = new THREE.Vector3().addVectors(origin, endPoint).multiplyScalar(0.5);
        mesh.position.copy(mid);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
        
        const speed = 20 + Math.random() * 15;
        
        const rayData = {
            mesh,
            origin: origin.clone(),
            dir,
            speed,
            length,
            endPoint,
            color: rayColor
        };
        
        this.rays.push(rayData);
        this.scene.add(mesh);
    }
    
    getNextRayColor() {
        // If we have concept colors, use them
        if (this.conceptColors.size > 0) {
            const concepts = Array.from(this.conceptColors.keys());
            const randomConcept = concepts[Math.floor(Math.random() * concepts.length)];
            return this.conceptColors.get(randomConcept);
        }
        
        // Fallback to generating random concept-style colors
        const randomWord = ['idea', 'innovación', 'creatividad', 'inspiración', 'concepto'][Math.floor(Math.random() * 5)];
        const hue = ConceptUtils.getConceptHue(randomWord);
        return new THREE.Color().setHSL(hue, 0.8, 0.6).getHex();
    }
    
    // Method to pre-seed with initial concept for better color consistency
    setInitialConcept(concept) {
        if (concept && !this.conceptColors.has(concept)) {
            const conceptHue = ConceptUtils.getConceptHue(concept);
            const conceptColor = new THREE.Color().setHSL(conceptHue, 0.8, 0.6);
            this.conceptColors.set(concept, conceptColor.getHex());
            this.initialConcept = concept;
            console.log(`TunnelEffect: Pre-seeded with concept '${concept}' color`, conceptColor.getHexString());
        }
    }

    
    setupAnimation() {
        let lastTime = performance.now();
        
        const animate = (currentTime) => {
            if (!this.isActive) return;
            
            const deltaTime = (currentTime - lastTime) / 1000;
            lastTime = currentTime;
            
            // Update concept-colored rays
            this.rays.forEach((r,i)=>{
                r.origin.addScaledVector(r.dir, r.speed * deltaTime);
                const dist = r.origin.distanceTo(r.endPoint);
                if(dist <= 1){
                    this.scene.remove(r.mesh);
                    r.mesh.geometry.dispose();
                    r.mesh.material.dispose();
                    this.rays.splice(i,1);
                    this.createSingleRay();
                    return;
                }
                const mid = new THREE.Vector3().addVectors(r.origin, r.endPoint).multiplyScalar(0.5);
                r.mesh.position.copy(mid);
                const newLen = r.origin.distanceTo(r.endPoint);
                r.mesh.scale.set(1, newLen / r.length, 1);
                
                // Dynamic opacity based on distance
                const opacity = Math.min(1, Math.max(0.2, dist / this.maxDist));
                r.mesh.material.opacity = 0.3 + (1 - opacity) * 0.4;
                
                // Subtle color pulse effect
                const pulse = Math.sin(currentTime * 0.003) * 0.1 + 0.9;
                r.mesh.material.color.setHex(r.color);
                r.mesh.material.color.multiplyScalar(pulse);
            });
            
            this.animationId = requestAnimationFrame(animate);
        };
        
        animate(performance.now());
        console.log('TunnelEffect: Calm orbital animation started');
    }

    
    addLoadingNode(concept, color = null) {
        console.log('TunnelEffect: Concept traveling through tunnel:', concept);
        
        // Add concept to queue for ray coloring
        if (!this.conceptColors.has(concept)) {
            const conceptHue = ConceptUtils.getConceptHue(concept);
            const conceptColor = new THREE.Color().setHSL(conceptHue, 0.8, 0.6);
            this.conceptColors.set(concept, conceptColor.getHex());
            this.conceptQueue.push(concept);
            
            console.log(`TunnelEffect: Added concept '${concept}' with color`, conceptColor.getHexString());
        }
        
        // Store initial concept
        if (!this.initialConcept) {
            this.initialConcept = concept;
        }
        
        // Stop tunnel when first node is generated
        if (!this.firstNodeGenerated) {
            this.firstNodeGenerated = true;
            setTimeout(() => {
                this.stop();
            }, 1000); // Longer delay to see the concept colors
        }
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
        if (this.progressText) {
            this.progressText.textContent = status;
        }
    }
    
    start() {
        console.log('TunnelEffect: Starting concept-colored tunnel');
        this.isActive = true;
        this.time = 0;
        this.finishing = false;
        this.firstNodeGenerated = false;
        this.conceptQueue = [];
        this.conceptColors.clear();
        this.initialConcept = null;
        
        if (!this.rays || this.rays.length === 0) {
            this.create();
        }
        
        console.log('TunnelEffect: Concept tunnel active with', this.rays?.length || 0, 'colored rays');
    }
    
    stop() {
    console.log('TunnelEffect: Initiating smooth stop');

    const fadeDuration = 3000; // 1 segundo
    const startTime = performance.now();

    const fadeOut = (currentTime) => {
        const t = Math.min(1, (currentTime - startTime) / fadeDuration);

        this.rays.forEach(ray => {
            if (ray.mesh.material.opacity > 0) {
                ray.mesh.material.opacity = ray.mesh.material.opacity * (1 - t);
            }
        });

        if (this.progressText) {
            this.progressText.style.opacity = `${1 - t}`;
        }

        if (t < 1) {
            requestAnimationFrame(fadeOut);
        } else {
            // Termina la animación y limpia
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
                this.animationId = null;
            }
                this.isActive = false;

            this.cleanup();
        }
    };

    requestAnimationFrame(fadeOut);
}
    
    cleanup() {
        console.log('TunnelEffect: Cleaning up concept-colored tunnel');
        
        // Remove all rings
        if (this.rays) {
            this.rays.forEach(ray => {
                this.scene.remove(ray.mesh);
                ray.mesh.geometry.dispose();
                ray.mesh.material.dispose();
            });
            this.rays = [];
        }
        
        // Dispose of shared geometry
        if (this.sphereGeometry) {
            this.sphereGeometry.dispose();
            this.sphereGeometry = null;
        }
        
        // Remove lighting
        if (this.ambientLight) {
            this.scene.remove(this.ambientLight);
            this.ambientLight = null;
        }
        if (this.directionalLight) {
            this.scene.remove(this.directionalLight);
            this.directionalLight = null;
        }
        
        // Remove progress text
        if (this.progressText && this.progressText.remove) {
            this.progressText.remove();
            this.progressText = null;
        }
        
        // Reset scene background and fog
        this.scene.background = null;
        this.scene.fog = null;
        
        // Clear concept data
        this.conceptQueue = [];
        this.conceptColors.clear();
        this.initialConcept = null;
        
        console.log('TunnelEffect: Concept tunnel cleanup complete');
    }
}