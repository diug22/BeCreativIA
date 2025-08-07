import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ConceptUtils } from '../utils/ConceptUtils.js';
import { TunnelEffect } from '../effects/TunnelEffect.js';
import { CameraController } from '../controllers/CameraController.js';
import { ProgressBar } from '../components/ProgressBar.js';
import { GrowthPhaseManager } from '../controllers/GrowthPhaseManager.js';
import { SearchManager } from '../components/SearchManager.js';
import { ContextMenu } from '../components/ContextMenu.js';

// Video recording modules - loaded conditionally
let VideoRecorder = null;
let VideoModal = null;

// Dynamic import for video recording (desacoplable)
async function loadVideoModules() {
    try {
        const [recorderModule, modalModule] = await Promise.all([
            import('../components/VideoRecorder.js'),
            import('../components/VideoModal.js')
        ]);
        VideoRecorder = recorderModule.VideoRecorder;
        VideoModal = modalModule.VideoModal;
        return true;
    } catch (error) {
        console.warn('GraphRenderer: Video modules not available:', error);
        return false;
    }
}

export class GraphRenderer {
    constructor(containerId = 'container') {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.controls = null;
        this.nodes = new Map();
        this.edges = [];
        this.relationships = new Map();
        
        // Labels visibility
        this.labelsVisible = true;
        
        // Node selection system
        this.selectedNodes = new Set();
        this.isolationMode = false;
        this.hiddenNodes = new Set();
        this.hiddenEdges = new Set();
        
        // Background system - only nebula
        this.backgroundElements = {
            nebula: null
        };
        this.nebulaVisible = false; // Initially hidden until first node appears
        
        // Raycaster for mouse picking
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Tunnel effect for transitions
        this.tunnelEffect = null;
        
        // New phase management components
        this.cameraController = null;
        this.progressBar = null;
        this.growthPhaseManager = null;
        
        // Node expansion components
        this.searchManager = null;
        this.contextMenu = null;
        
        // Video recording components (loaded conditionally)
        this.videoRecorder = null;
        this.videoModal = null;
        this.videoModulesLoaded = false;
        
        this.containerId = containerId;
        this.init();
    }
    
    init() {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000); // Black background
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        console.log('Renderer setup - size:', window.innerWidth, 'x', window.innerHeight);
        
        const container = document.getElementById(this.containerId);
        if (container) {
            container.appendChild(this.renderer.domElement);
            console.log('Canvas added to container. Container size:', container.offsetWidth, 'x', container.offsetHeight);
            console.log('Canvas size:', this.renderer.domElement.width, 'x', this.renderer.domElement.height);
        } else {
            console.error('Container not found:', this.containerId);
        }
        
        // Setup camera
        this.camera.position.set(0, 0, 5);
        
        // Setup controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 2;
        this.controls.maxDistance = 50;
        
        // Setup lights
        this.setupLights();
        
        // Setup background and atmosphere
        this.setupBackground();
        
        // Initialize tunnel effect
        this.tunnelEffect = new TunnelEffect(this.scene, this.camera);
        
        // Initialize new phase management components
        this.setupPhaseManagement();
        
        // Event listeners for node interaction
        this.setupEventListeners();
        
        // Start render loop
        this.animate();
        
        console.log('GraphRenderer: Initialized with phase management components');
        
        // Initialize video button state (disabled by default)
        this.updateVideoButtonState();
        
        // Add global debug function
        window.debugVideoButtonState = () => {
            console.log('Debug Video Button State:', {
                hasVideoBtn: !!document.getElementById('header-video'),
                nodesCount: this.nodes.size,
                videoModulesLoaded: this.videoModulesLoaded,
                nodes: Array.from(this.nodes.keys())
            });
            this.updateVideoButtonState();
        };
        
        // Add periodic check to ensure button state is correct
        setInterval(() => {
            const hasNodes = this.nodes.size > 0;
            const videoBtn = document.getElementById('header-video');
            if (videoBtn && hasNodes && videoBtn.disabled) {
                console.log('GraphRenderer: Periodic check - forcing video button enable');
                this.updateVideoButtonState();
            }
        }, 2000);
        
        // Try to load video modules (non-blocking)
        this.initializeVideoModules();
    }
    
    async initializeVideoModules() {
        try {
            // Check if video recording should be enabled
            const shouldLoad = !window.location.search.includes('no-video') && 
                             typeof MediaRecorder !== 'undefined';
            
            if (!shouldLoad) {
                console.log('GraphRenderer: Video recording disabled or not supported');
                return;
            }
            
            const loaded = await loadVideoModules();
            
            if (loaded && VideoRecorder && VideoModal) {
                this.videoRecorder = new VideoRecorder(this.renderer, this.scene, this.camera, this);
                this.videoModal = new VideoModal(this.videoRecorder);
                this.videoModulesLoaded = true;                
                console.log('GraphRenderer: Video recording modules loaded successfully');
                
                // Add global access for video functionality
                window.openVideoModal = () => this.openVideoModal();
                
                // Debug function to manually enable video button
                window.debugEnableVideoButton = () => {
                    const btn = document.getElementById('header-video');
                    if (btn) {
                        btn.disabled = false;
                        btn.classList.add('video-enabled');
                        btn.title = 'Crear video para redes sociales';
                        console.log('Video button force enabled with CSS class');
                    }
                };
                
                // Update button state now that modules are loaded
                this.updateVideoButtonState();
                
                // Track analytics
                if (window.va) {
                    window.va('track', 'Video Modules Loaded');
                }
            } else {
                console.warn('GraphRenderer: Video modules failed to load properly');
            }
        } catch (error) {
            console.warn('GraphRenderer: Failed to load video modules:', error);
        }
    }
    
    async openVideoModal() {
        // Check if we have nodes first
        if (this.nodes.size === 0) {
            console.warn('GraphRenderer: No nodes to record');
            this.showVideoError('Crea un grafo antes de grabar video');
            return;
        }

        // If modules are not loaded, try to load them now
        if (!this.videoModulesLoaded) {
            console.log('GraphRenderer: Video modules not loaded, trying to load them now...');
            
            // Show loading state
            const videoBtn = document.getElementById('header-video');
            if (videoBtn) {
                videoBtn.disabled = true;
                videoBtn.classList.add('loading');
                videoBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="2" x2="12" y2="6"></line>
                    <line x1="12" y1="18" x2="12" y2="22"></line>
                    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                    <line x1="2" y1="12" x2="6" y2="12"></line>
                    <line x1="18" y1="12" x2="22" y2="12"></line>
                    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                </svg>`;
                videoBtn.title = 'Cargando módulos de video...';
            }
            
            try {
                await this.initializeVideoModules();
                
                // Reset button
                if (videoBtn) {
                    videoBtn.classList.remove('loading');
                    videoBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="23 7 16 12 23 17 23 7"></polygon>
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                    </svg>`;
                    this.updateVideoButtonState();
                }
                
                // Try again now that modules should be loaded
                if (this.videoModulesLoaded && this.videoModal) {
                    this.videoModal.show();
                } else {
                    throw new Error('Failed to load video modules');
                }
            } catch (error) {
                console.error('GraphRenderer: Failed to load video modules on demand:', error);
                
                // Reset button
                if (videoBtn) {
                    videoBtn.classList.remove('loading');
                    videoBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="23 7 16 12 23 17 23 7"></polygon>
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                    </svg>`;
                    this.updateVideoButtonState();
                }
                
                this.showVideoError('Error cargando los módulos de video. Intenta recargando la página.');
            }
        } else if (this.videoModal) {
            this.videoModal.show();
        } else {
            console.warn('GraphRenderer: Video modules loaded but modal not available');
            this.showVideoError('Módulos de video no disponibles');
        }
    }
    
    showVideoError(message) {
        // Mostrar mensaje temporal al usuario
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: rgba(255, 68, 68, 0.9);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            z-index: 10000;
            font-family: 'Inter', sans-serif;
            border: 1px solid rgba(255, 68, 68, 0.3);
            backdrop-filter: blur(10px);
            box-shadow: 0 4px 20px rgba(255, 68, 68, 0.2);
        `;
        errorDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span>⚠️</span>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(errorDiv);
        
        // Eliminar después de 3 segundos
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.remove();
            }
        }, 3000);
    }
    
    updateVideoButtonState() {
        const videoBtn = document.getElementById('header-video');
        
        if (!videoBtn) {
            console.warn('GraphRenderer: Video button not found!');
            return;
        }
        
        const hasNodes = this.nodes.size > 0;
        const isLoaded = this.videoModulesLoaded;
        
        console.log('GraphRenderer: Updating video button', { hasNodes, nodesCount: this.nodes.size, isLoaded });
        
        if (hasNodes) {
            // FORCE enable the button by removing disabled attribute and setting all properties
            videoBtn.removeAttribute('disabled');
            videoBtn.disabled = false;
            videoBtn.classList.add('video-enabled');
            
            // Clear any inline styles that might be interfering
            videoBtn.style.removeProperty('opacity');
            videoBtn.style.removeProperty('cursor');
            videoBtn.style.removeProperty('pointer-events');
            
            videoBtn.title = isLoaded ? 'Crear video para redes sociales' : 'Crear video (cargar módulos si es necesario)';
            
            console.log('GraphRenderer: Video button ENABLED');
        } else {
            videoBtn.setAttribute('disabled', 'true');
            videoBtn.disabled = true;
            videoBtn.classList.remove('video-enabled');
            videoBtn.style.setProperty('opacity', '0.5', 'important');
            videoBtn.style.setProperty('cursor', 'not-allowed', 'important');
            videoBtn.style.setProperty('pointer-events', 'none', 'important');
            videoBtn.title = 'Crea un grafo para grabar video';
            
            console.log('GraphRenderer: Video button DISABLED');
        }
    }

    setupLights() {
        // Enhanced ambient light for better base illumination
        const ambientLight = new THREE.AmbientLight(0x202040, 0.6);
        this.scene.add(ambientLight);
        
        // Main dramatic directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(10, 15, 8);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 4096;
        directionalLight.shadow.mapSize.height = 4096;
        directionalLight.shadow.camera.near = 0.1;
        directionalLight.shadow.camera.far = 100;
        directionalLight.shadow.camera.left = -50;
        directionalLight.shadow.camera.right = 50;
        directionalLight.shadow.camera.top = 50;
        directionalLight.shadow.camera.bottom = -50;
        directionalLight.shadow.bias = -0.0001;
        this.scene.add(directionalLight);
        
        // Primary accent light (blue)
        const accentLight1 = new THREE.PointLight(0x00aaff, 1.5, 200);
        accentLight1.position.set(-15, 10, 15);
        this.scene.add(accentLight1);
        
        // Secondary accent light (warmer)
        const accentLight2 = new THREE.PointLight(0x4080ff, 1.0, 150);
        accentLight2.position.set(15, -5, 10);
        this.scene.add(accentLight2);
        
        // Rim light for depth
        const rimLight = new THREE.DirectionalLight(0x8888ff, 0.8);
        rimLight.position.set(-10, -10, -10);
        this.scene.add(rimLight);
        
        // Store references for potential animation
        this.lights = {
            ambient: ambientLight,
            directional: directionalLight,
            accent1: accentLight1,
            accent2: accentLight2,
            rim: rimLight
        };
        
        console.log('GraphRenderer: Enhanced dramatic lighting setup complete');
    }

    setupBackground() {
        // Keep black background
        this.renderer.setClearColor(0x000000);
        
        // Create volumetric nebula surrounding the graph (initially hidden)
        this.createVolumetricNebula();
        
        console.log('GraphRenderer: Background setup complete');
    }
    
    // Removed fog and gradient background methods - only nebula remains
    
    createVolumetricNebula() {
        // Create modern atmospheric bokeh layers with depth-of-field effect
        this.createBokehLayer(150, 0.15, 200, 'far');       // Far depth layer - more visible
        this.createBokehLayer(100, 0.25, 150, 'medium');    // Medium depth layer - clearer
        this.createBokehLayer(60, 0.35, 100, 'near');       // Near depth layer - prominent
        
        // Initially hide all nebula layers
        this.hideNebula();
        
        console.log('GraphRenderer: Modern atmospheric bokeh nebula created with 3 depth layers');
    }
    
    createBokehLayer(radius, baseOpacity, particleCount, depthType) {
        const nebulaGroup = new THREE.Group();
        
        // Modern atmospheric color palette - más brillante pero elegante
        const modernColors = [
            0x1e2a3a, // Azul noche más claro
            0x2a3441, // Gris espacial más visible
            0x3d4852, // Gris moderno más brillante
            0x5bb3f0  // Azul acento más vibrante pero elegante
        ];
        
        // Create bokeh texture canvas for soft circular particles
        const createBokehTexture = (size = 64) => {
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const context = canvas.getContext('2d');
            
            // Create radial gradient (opaque center → transparent edge)
            const gradient = context.createRadialGradient(
                size / 2, size / 2, 0,
                size / 2, size / 2, size / 2
            );
            gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
            gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
            gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.3)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
            
            context.fillStyle = gradient;
            context.fillRect(0, 0, size, size);
            
            return new THREE.CanvasTexture(canvas);
        };
        
        const bokehTexture = createBokehTexture();
        
        // Generate particles with organic clustering
        for (let i = 0; i < particleCount; i++) {
            // Spherical coordinates with organic clustering
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            // Add some clustering using bias toward certain regions
            const clusterBias = Math.sin(theta * 3) * Math.cos(phi * 2) * 0.3;
            const r = radius + (Math.random() - 0.5) * 15 + clusterBias * 10;
            
            const x = r * Math.sin(phi) * Math.cos(theta);
            const y = r * Math.sin(phi) * Math.sin(theta);
            const z = r * Math.cos(phi);
            
            // Distance from camera for depth-based effects
            const distanceFromCenter = Math.sqrt(x*x + y*y + z*z);
            
            // Size inversely proportional to distance (perspective effect) - más visible
            const perspectiveSize = Math.max(1.2, 5.5 - (distanceFromCenter * 0.025));
            const finalSize = perspectiveSize * (0.8 + Math.random() * 0.8);
            
            // Choose color from modern palette
            const colorIndex = Math.floor(Math.random() * modernColors.length);
            const baseColor = new THREE.Color(modernColors[colorIndex]);
            
            // Depth-based opacity (farther = more transparent) - menos agresivo
            const depthOpacity = Math.max(0.3, 1.0 - (distanceFromCenter * 0.005));
            const finalOpacity = baseOpacity * depthOpacity * (0.8 + Math.random() * 0.4);
            
            // Create sprite material with bokeh texture
            const material = new THREE.SpriteMaterial({
                map: bokehTexture,
                color: baseColor,
                transparent: true,
                opacity: finalOpacity,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                alphaTest: 0.01
            });
            
            const particle = new THREE.Sprite(material);
            particle.position.set(x, y, z);
            particle.scale.setScalar(finalSize);
            
            // Store original properties for animation
            particle.userData = {
                originalOpacity: finalOpacity,
                depthFactor: depthOpacity,
                originalScale: finalSize
            };
            
            nebulaGroup.add(particle);
        }
        
        nebulaGroup.name = `bokehLayer_${depthType}_${radius}`;
        nebulaGroup.renderOrder = -2;
        this.scene.add(nebulaGroup);
        
        // Store reference for control
        if (!this.backgroundElements.nebula) {
            this.backgroundElements.nebula = [];
        }
        this.backgroundElements.nebula.push(nebulaGroup);
        
        return nebulaGroup;
    }


    setupEventListeners() {
        // Handle window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            
        });
        
        // Mouse events for node interaction
        this.renderer.domElement.addEventListener('click', (event) => this.onNodeClick(event));
        this.renderer.domElement.addEventListener('mousemove', (event) => this.onNodeHover(event));
        this.renderer.domElement.addEventListener('contextmenu', (event) => this.onNodeRightClick(event));
        
        // Keyboard events
        window.addEventListener('keydown', (event) => this.onKeyDown(event));
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        
        // Calculate delta time
        const currentTime = Date.now();
        const deltaTime = currentTime - (this.lastTime || currentTime);
        this.lastTime = currentTime;
        
        // Enhanced visual effects
        this.updateVisualEffects(currentTime, deltaTime);
        
        // Animate background nebula
        this.animateNebula();
        
        this.renderer.render(this.scene, this.camera);
    }
    
    updateVisualEffects(currentTime, deltaTime) {
        const time = currentTime * 0.001; // Convert to seconds
        
        // Animate atomic node effects
        this.nodes.forEach((nodeData, concept) => {
            // Animate atomic nodes
            if (nodeData.crystalGroup) { // keeping crystalGroup name for compatibility
                this.animateAtomicNode(nodeData, time);
            }
            // Fallback for old sphere nodes (compatibility)
            else if (nodeData.sphere && nodeData.sphere.material) {
                // Subtle breathing effect on nodes
                const breathe = Math.sin(time * 1.2 + nodeData.hue * 10) * 0.05 + 0.95;
                nodeData.sphere.scale.setScalar(breathe);
                
                // Dynamic emissive intensity
                const emissivePulse = Math.sin(time * 2 + nodeData.hue * 15) * 0.1 + 0.2;
                nodeData.sphere.material.emissiveIntensity = emissivePulse;
                
                // Animate glow layers
                if (nodeData.innerGlow) {
                    const innerPulse = Math.sin(time * 1.8 + nodeData.hue * 12) * 0.2 + 0.6;
                    nodeData.innerGlow.material.opacity = innerPulse;
                    nodeData.innerGlow.scale.setScalar(breathe * 1.1);
                }
                
                if (nodeData.outerGlow) {
                    const outerPulse = Math.sin(time * 1.4 + nodeData.hue * 8) * 0.15 + 0.3;
                    nodeData.outerGlow.material.opacity = outerPulse;
                    nodeData.outerGlow.scale.setScalar(breathe * 1.2);
                }
            }
        });
        
        // Animate edge particles
        this.edges.forEach(edgeData => {
            if (edgeData.line && edgeData.line.children) {
                edgeData.line.children.forEach(child => {
                    if (child.userData && child.userData.curve) {
                        // Move particles along the curve
                        child.userData.progress += child.userData.speed * deltaTime * 0.001;
                        if (child.userData.progress > 1) {
                            child.userData.progress = 0; // Loop back to start
                        }
                        
                        const position = child.userData.curve.getPoint(child.userData.progress);
                        child.position.copy(position);
                        
                        // Fade particles in/out along the curve
                        const fadeDistance = 0.1;
                        let opacity = child.userData.originalOpacity;
                        
                        if (child.userData.progress < fadeDistance) {
                            opacity *= child.userData.progress / fadeDistance;
                        } else if (child.userData.progress > 1 - fadeDistance) {
                            opacity *= (1 - child.userData.progress) / fadeDistance;
                        }
                        
                        child.material.opacity = opacity;
                    }
                });
            }
        });
        
        // Animate lighting for dynamic atmosphere
        if (this.lights) {
            // Subtle light movement
            if (this.lights.accent1) {
                this.lights.accent1.intensity = 1.5 + Math.sin(time * 0.7) * 0.3;
                this.lights.accent1.position.x = -15 + Math.sin(time * 0.5) * 2;
            }
            
            if (this.lights.accent2) {
                this.lights.accent2.intensity = 1.0 + Math.cos(time * 0.9) * 0.2;
                this.lights.accent2.position.z = 10 + Math.cos(time * 0.3) * 3;
            }
        }
    }
    
    setupPhaseManagement() {
        // Initialize camera controller
        this.cameraController = new CameraController(this.camera, this.controls);
        
        // Initialize progress bar
        this.progressBar = new ProgressBar();
        
        // Initialize growth phase manager
        this.growthPhaseManager = new GrowthPhaseManager(this.cameraController, this.progressBar);
        
        // Set up event listeners for phase management
        this.growthPhaseManager.onPhaseStarted((data) => {
            console.log('GraphRenderer: Growth phase started', data);
        });
        
        this.growthPhaseManager.onPhaseEnded((data) => {
            console.log('GraphRenderer: Growth phase ended', data);
        });
        
        this.growthPhaseManager.onNodeAddedToPhase((data) => {
            console.log(`GraphRenderer: Node added to growth phase: ${data.concept}`);
        });
        
        console.log('GraphRenderer: Phase management components initialized');
        
        // Initialize expansion components
        this.setupExpansionComponents();
    }
    
    setupExpansionComponents() {
        // This will be initialized by ConceptGraphApp with apiService
        console.log('GraphRenderer: Ready for expansion components initialization');
    }
    
    initializeExpansionComponents(apiService) {
        // Initialize search manager
        this.searchManager = new SearchManager(this, apiService);
        
        // Initialize context menu
        this.contextMenu = new ContextMenu(this, apiService);
        
        // Set up event listeners for expansion components
        this.searchManager.onSearchStarted((data) => {
            console.log('GraphRenderer: Search started', data);
        });
        
        this.searchManager.onSearchCompleted((data) => {
            console.log('GraphRenderer: Search completed', data);
        });
        
        this.contextMenu.onExpansionStarted((data) => {
            console.log('GraphRenderer: Node expansion started', data);
        });
        
        this.contextMenu.onExpansionCompleted((data) => {
            console.log('GraphRenderer: Node expansion completed', data);
        });
        
        console.log('GraphRenderer: Expansion components initialized');
    }
    
    async createNode(concept, position = { x: 0, y: 0, z: 0 }, animated = true) {
        // Check if node already exists
        if (this.nodes.has(concept)) {
            return this.nodes.get(concept);
        }
        
        const hue = ConceptUtils.getConceptHue(concept);
        const baseColor = new THREE.Color().setHSL(hue, 0.9, 0.7);
        const accentColor = new THREE.Color().setHSL(hue, 1.0, 0.9);
        const cyanColor = new THREE.Color(0x00aaff);
        
        // Create Atomic Node Structure
        const atomicNode = this.createAtomicNode(baseColor, accentColor, cyanColor, position, concept, animated);
        
        // Create external label above atom
        const label = this.createTextLabel(concept, hue);
        label.visible = this.labelsVisible;
        if (animated) {
            label.material.opacity = 0;
        }
        
        // Make atom clickable - use the main nucleus
        atomicNode.nucleus.userData = { concept, type: 'node' };
        
        // Add label to atom group so it moves together
        atomicNode.group.add(label);
        label.position.set(0, 1.0, 0); // Above the atom
        
        // Add atom group to scene
        this.scene.add(atomicNode.group);
        
        const nodeData = { 
            sphere: atomicNode.nucleus, // For compatibility with existing code
            label: label, // External label above atom
            innerGlow: atomicNode.orbits, 
            outerGlow: null, // No electrons anymore
            crystalGroup: atomicNode.group, // Full atom structure (keeping name for compatibility)
            coreRotation: atomicNode.orbits, // For animation
            position, 
            hue 
        };
        this.nodes.set(concept, nodeData);
        
        // Add loading node to tunnel if tunnel is active
        if (this.tunnelEffect && this.tunnelEffect.isActive) {
            const nodeColor = new THREE.Color().setHSL(hue, 0.8, 0.6).getHex();
            this.tunnelEffect.addLoadingNode(concept, nodeColor);
        }
        
        // Add node to growth phase if active
        if (this.growthPhaseManager && this.growthPhaseManager.isPhaseActive()) {
            this.growthPhaseManager.addNode(atomicNode.nucleus, concept);
        }
        
        // Animate appearance if requested
        if (animated) {
            this.animateAtomicNodeAppearance(nodeData);
        }
        
        // Update video button state since we now have nodes
        console.log('GraphRenderer: About to update video button state after adding node');
        this.updateVideoButtonState();
        
        // Force update with delay to ensure DOM is ready
        setTimeout(() => {
            console.log('GraphRenderer: Force updating video button state after delay');
            this.updateVideoButtonState();
        }, 100);
        
        return nodeData;
    }

    createAtomicNode(baseColor, accentColor, cyanColor, position, concept, animated) {
        // Create main atom group
        const atomGroup = new THREE.Group();
        atomGroup.position.set(position.x, position.y, position.z);
        
        // 1. Nucleus - Soft glowing sphere (clean, no text)
        const nucleus = this.createNucleus(baseColor, accentColor, animated);
        nucleus.position.set(0, 0, 0);
        atomGroup.add(nucleus);
        
        // 2. Electron Orbits - Rotating rings (simplified to 2 rings)
        const orbitsGroup = this.createElectronOrbits(cyanColor, animated);
        orbitsGroup.position.set(0, 0, 0);
        atomGroup.add(orbitsGroup);
        
        return {
            group: atomGroup,
            nucleus: nucleus,
            orbits: orbitsGroup,
            electrons: null // No individual electrons
        };
    }
    
    createNucleus(baseColor, accentColor, animated) {
        // Create clean nucleus sphere - no text
        const nucleusGeometry = new THREE.SphereGeometry(0.35, 32, 32); // Slightly smaller since no text
        const nucleusMaterial = new THREE.MeshPhysicalMaterial({
            color: baseColor,
            metalness: 0.2,
            roughness: 0.3,
            clearcoat: 0.8,
            clearcoatRoughness: 0.2,
            emissive: accentColor,
            emissiveIntensity: animated ? 0 : 0.3,
            transparent: true,
            opacity: animated ? 0 : 0.8
        });
        
        const nucleus = new THREE.Mesh(nucleusGeometry, nucleusMaterial);
        nucleus.castShadow = true;
        nucleus.receiveShadow = true;
        
        return nucleus;
    }
    
    
    createElectronOrbits(cyanColor, animated) {
        const orbitsGroup = new THREE.Group();
        
        // Create 2 orbital rings at different angles and sizes - simplified
        const orbitConfigs = [
            { radius: 0.9, tilt: 0, speed: 0.002 },
            { radius: 1.3, tilt: Math.PI / 4, speed: 0.003 }
        ];
        
        orbitConfigs.forEach((config, index) => {
            const orbitGeometry = new THREE.RingGeometry(config.radius - 0.02, config.radius + 0.02, 64);
            const orbitMaterial = new THREE.MeshBasicMaterial({
                color: cyanColor,
                transparent: true,
                opacity: animated ? 0 : 0.3,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            
            const orbit = new THREE.Mesh(orbitGeometry, orbitMaterial);
            orbit.rotation.x = config.tilt;
            orbit.rotation.y = Math.random() * Math.PI * 2;
            
            orbit.userData = {
                rotationSpeed: config.speed,
                axis: 'y'
            };
            
            orbitsGroup.add(orbit);
        });
        
        return orbitsGroup;
    }
    
    
    createCrystalEdges(geometry, cyanColor, animated) {
        const edgesGroup = new THREE.Group();
        
        // Create wireframe for edges
        const edges = new THREE.EdgesGeometry(geometry);
        
        // Animated energy flow material
        const edgeMaterial = new THREE.LineBasicMaterial({
            color: cyanColor,
            transparent: true,
            opacity: animated ? 0 : 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        const wireframe = new THREE.LineSegments(edges, edgeMaterial);
        edgesGroup.add(wireframe);
        
        // Add glow effect to edges
        const glowMaterial = new THREE.LineBasicMaterial({
            color: cyanColor,
            transparent: true,
            opacity: animated ? 0 : 0.4,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        const glowWireframe = new THREE.LineSegments(edges.clone(), glowMaterial);
        glowWireframe.scale.setScalar(1.05); // Slightly larger for glow effect
        edgesGroup.add(glowWireframe);
        
        return edgesGroup;
    }
    
    createHolographicCore(accentColor, cyanColor, animated) {
        const coreGroup = new THREE.Group();
        
        // Remove the solid inner sphere - keep only the rotating rings for a cleaner look
        
        // Rotating ring elements inside
        for (let i = 0; i < 3; i++) {
            const ringGeometry = new THREE.RingGeometry(0.15 + i * 0.05, 0.18 + i * 0.05, 16);
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: i % 2 === 0 ? cyanColor : accentColor,
                transparent: true,
                opacity: animated ? 0 : 0.5,
                blending: THREE.AdditiveBlending,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.rotation.x = Math.random() * Math.PI;
            ring.rotation.y = Math.random() * Math.PI;
            ring.userData = { 
                rotationSpeed: (Math.random() + 0.5) * 0.02,
                axis: Math.random() > 0.5 ? 'x' : 'y'
            };
            
            coreGroup.add(ring);
        }
        
        return coreGroup;
    }
    
    createTechPatterns(geometry, cyanColor, animated) {
        const patternsGroup = new THREE.Group();
        
        // Create subtle circuit-like patterns on crystal faces
        const patternMaterial = new THREE.MeshBasicMaterial({
            color: cyanColor,
            transparent: true,
            opacity: animated ? 0 : 0.2,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        // Create smaller geometric shapes as tech patterns
        const patternGeometry = new THREE.OctahedronGeometry(0.65);
        const patterns = new THREE.Mesh(patternGeometry, patternMaterial);
        patterns.scale.setScalar(1.02); // Slightly larger than main crystal
        
        patternsGroup.add(patterns);
        
        return patternsGroup;
    }
    
    animateAtomicNodeAppearance(nodeData) {
        const duration = 1200; // 1.2 seconds for smooth organic appearance
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease-out animation with organic timing
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            // Animate nucleus (main sphere)
            if (nodeData.sphere && nodeData.sphere.material) {
                nodeData.sphere.material.opacity = easeProgress * 0.8;
                nodeData.sphere.material.emissiveIntensity = easeProgress * 0.3;
            }
            
            // Animate electron orbits
            if (nodeData.innerGlow && nodeData.innerGlow.children) {
                nodeData.innerGlow.children.forEach(child => {
                    if (child.material) {
                        child.material.opacity = easeProgress * 0.3;
                    }
                });
            }
            
            // Animate label
            if (nodeData.label && nodeData.label.material) {
                nodeData.label.material.opacity = easeProgress;
            }
            
            // Scale animation for organic growth effect
            const scale = easeProgress;
            if (nodeData.crystalGroup) { // keeping crystalGroup name for compatibility
                nodeData.crystalGroup.scale.set(scale, scale, scale);
            }
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }
    
    animateAtomicNode(nodeData, time) {
        // 1. Animate electron orbits rotation - much slower and smoother
        if (nodeData.innerGlow && nodeData.innerGlow.children) {
            nodeData.innerGlow.children.forEach(child => {
                if (child.userData && child.userData.rotationSpeed) {
                    if (child.userData.axis === 'y') {
                        child.rotation.y += child.userData.rotationSpeed;
                    } else {
                        child.rotation.x += child.userData.rotationSpeed;
                    }
                }
            });
        }
        
        // 2. No individual electrons to animate anymore
        
        // 3. Animate nucleus - very gentle pulsing
        if (nodeData.sphere && nodeData.sphere.material) {
            // Very gentle emissive pulsing
            const emissivePulse = Math.sin(time * 0.5 + nodeData.hue * 3) * 0.05 + 0.3;
            nodeData.sphere.material.emissiveIntensity = emissivePulse;
            
            // Extremely subtle scale breathing
            const breathe = Math.sin(time * 0.3 + nodeData.hue * 2) * 0.015 + 1;
            nodeData.sphere.scale.set(breathe, breathe, breathe);
        }
        
        // 4. Animate label if present
        if (nodeData.label && nodeData.label.material) {
            // Subtle label opacity pulsing
            const labelPulse = Math.sin(time * 0.4 + nodeData.hue * 2) * 0.1 + 0.9;
            nodeData.label.material.opacity = labelPulse;
        }
    }

    createTextLabel(concept, hue, state = 'normal') {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 128;
        
        // State-based styling configuration
        const states = {
            normal: {
                bgOpacity: 0.65,
                borderOpacity: 0.6,
                glowIntensity: 0.3,
                fontSize: 28,
                fontWeight: '400'
            },
            selected: {
                bgOpacity: 0.8,
                borderOpacity: 1.0,
                glowIntensity: 0.6,
                fontSize: 30,
                fontWeight: '500'
            },
            hovered: {
                bgOpacity: 0.75,
                borderOpacity: 0.8,
                glowIntensity: 0.45,
                fontSize: 29,
                fontWeight: '450'
            }
        };
        
        const currentState = states[state];
        
        // Apply enhanced styling
        this.applyGlassmorphismBackground(context, canvas, currentState);
        this.applyEnhancedBorder(context, canvas, currentState);
        this.applyEnhancedTypography(context, canvas, concept, currentState);
        
        const texture = new THREE.CanvasTexture(canvas);
        const labelMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            alphaTest: 0.001
        });
        const label = new THREE.Sprite(labelMaterial);
        label.scale.set(3, 0.75, 1);
        
        return label;
    }

    applyGlassmorphismBackground(context, canvas, state) {
        // No background - labels will be text-only with glow effect
        // This method is now empty but kept for compatibility
    }
    
    applyEnhancedBorder(context, canvas, state) {
        // No border - text-only labels
        // This method is now empty but kept for compatibility
    }
    
    applyEnhancedTypography(context, canvas, concept, state) {
        // Dynamic font sizing based on text length
        const displayText = concept.toUpperCase();
        const fontSize = this.calculateOptimalFontSize(displayText, state.fontSize);
        
        // Use Inter font with fallbacks - make it bold like the logo
        context.font = `600 ${fontSize}px Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // Clear the canvas first
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Create BeCreativIA logo-style gradient effect
        // 1. First layer - strong glow background
        context.shadowColor = 'rgba(0, 170, 255, 0.8)';
        context.shadowBlur = 20;
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;
        
        // White base text
        context.fillStyle = '#ffffff';
        context.fillText(displayText, canvas.width / 2, canvas.height / 2);
        
        // 2. Second layer - cyan glow
        context.shadowColor = 'rgba(0, 170, 255, 0.6)';
        context.shadowBlur = 10;
        context.fillText(displayText, canvas.width / 2, canvas.height / 2);
        
        // 3. Third layer - strong white core
        context.shadowColor = 'transparent';
        context.shadowBlur = 0;
        context.fillStyle = '#ffffff';
        context.fillText(displayText, canvas.width / 2, canvas.height / 2);
        
        // 4. Final layer - subtle cyan outline
        context.strokeStyle = 'rgba(0, 170, 255, 0.3)';
        context.lineWidth = 1;
        context.strokeText(displayText, canvas.width / 2, canvas.height / 2);
    }
    
    calculateOptimalFontSize(text, baseFontSize) {
        const textLength = text.length;
        let fontSize = baseFontSize;
        
        // Adjust font size based on text length for better fit
        if (textLength > 12) {
            fontSize = Math.max(18, baseFontSize - (textLength - 12) * 1.2);
        } else if (textLength < 6) {
            fontSize = Math.min(34, baseFontSize + (6 - textLength) * 1);
        }
        
        return fontSize;
    }

    animateNodeAppearance(nodeData) {
        const duration = 1000; // 1 second
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease-out animation
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            // Animate opacity with enhanced glow layers
            nodeData.sphere.material.opacity = easeProgress * 0.95;
            if (nodeData.innerGlow) nodeData.innerGlow.material.opacity = easeProgress * 0.6;
            if (nodeData.outerGlow) nodeData.outerGlow.material.opacity = easeProgress * 0.3;
            nodeData.label.material.opacity = easeProgress;
            
            // Animate scale with staggered glow effect
            const scale = easeProgress;
            nodeData.sphere.scale.set(scale, scale, scale);
            if (nodeData.innerGlow) nodeData.innerGlow.scale.set(scale * 1.1, scale * 1.1, scale * 1.1);
            if (nodeData.outerGlow) nodeData.outerGlow.scale.set(scale * 1.2, scale * 1.2, scale * 1.2);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }
    
    createEdge(fromConcept, toConcept, animated = true) {
        const fromNode = this.nodes.get(fromConcept);
        const toNode = this.nodes.get(toConcept);
        
        if (!fromNode || !toNode) return;
        
        // Create enhanced curved connection with multiple control points
        // Get actual node positions (crystal group position or fallback to stored position)
        const startPos = fromNode.crystalGroup ? fromNode.crystalGroup.position : fromNode.position;
        const endPos = toNode.crystalGroup ? toNode.crystalGroup.position : toNode.position;
        
        const start = new THREE.Vector3(startPos.x, startPos.y, startPos.z);
        const end = new THREE.Vector3(endPos.x, endPos.y, endPos.z);
        const distance = start.distanceTo(end);
        
        // Create more organic curve with multiple control points
        const midPoint = new THREE.Vector3().lerpVectors(start, end, 0.5);
        const arcHeight = (Math.random() - 0.5) * Math.min(distance * 0.3, 3);
        const arcDirection = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            arcHeight,
            (Math.random() - 0.5) * 2
        ).normalize().multiplyScalar(Math.abs(arcHeight));
        midPoint.add(arcDirection);
        
        const curve = new THREE.QuadraticBezierCurve3(start, midPoint, end);
        const points = curve.getPoints(100); // Higher resolution for smoother curves
        
        // Create gradient color based on parent-child relationship
        const parentHue = fromNode.hue;
        const childHue = toNode.hue;
        const averageHue = (parentHue + childHue) / 2;
        const edgeColor = new THREE.Color().setHSL(averageHue, 0.9, 0.8);
        
        // Enhanced line with glow effect
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        
        // Main line
        const mainMaterial = new THREE.LineBasicMaterial({ 
            color: edgeColor,
            transparent: true,
            opacity: animated ? 0 : 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const mainLine = new THREE.Line(geometry, mainMaterial);
        
        // Glow line (wider and softer)
        const glowMaterial = new THREE.LineBasicMaterial({
            color: edgeColor,
            transparent: true,
            opacity: animated ? 0 : 0.4,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const glowLine = new THREE.Line(geometry.clone(), glowMaterial);
        
        // Create edge group for better management
        const edgeGroup = new THREE.Group();
        edgeGroup.add(glowLine);
        edgeGroup.add(mainLine);
        
        // Add subtle animated particles along the edge
        this.addEdgeParticles(edgeGroup, curve, edgeColor, animated);
        
        this.scene.add(edgeGroup);
        this.edges.push({ 
            line: edgeGroup, 
            mainLine, 
            glowLine,
            from: fromConcept, 
            to: toConcept 
        });
        
        // Store relationship for duplicate detection
        if (!this.relationships.has(fromConcept)) {
            this.relationships.set(fromConcept, new Set());
        }
        this.relationships.get(fromConcept).add(toConcept);
        
        // Animate edge appearance
        if (animated) {
            this.animateEdgeAppearance(edgeGroup, mainMaterial, glowMaterial);
        }
    }
    
    addEdgeParticles(edgeGroup, curve, color, animated) {
        // Create subtle flowing particles along the edge
        const particleCount = 3;
        const particleGeometry = new THREE.SphereGeometry(0.02, 8, 8);
        
        for (let i = 0; i < particleCount; i++) {
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: animated ? 0 : 0.6,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            
            // Random starting position along the curve
            const t = Math.random();
            const position = curve.getPoint(t);
            particle.position.copy(position);
            
            // Store animation data
            particle.userData = {
                curve: curve,
                progress: t,
                speed: 0.2 + Math.random() * 0.3,
                originalOpacity: 0.6
            };
            
            edgeGroup.add(particle);
        }
    }

    animateEdgeAppearance(edgeGroup, mainMaterial, glowMaterial) {
        const duration = 1200;
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            // Animate main line and glow
            mainMaterial.opacity = easeProgress * 0.9;
            glowMaterial.opacity = easeProgress * 0.4;
            
            // Animate particles
            edgeGroup.children.forEach(child => {
                if (child.userData && child.userData.originalOpacity !== undefined) {
                    child.material.opacity = easeProgress * child.userData.originalOpacity;
                }
            });
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }
    
    clear() {
        console.log('GraphRenderer: Clearing all graph data...');
        
        // Clear selections first
        this.clearSelection();
        
        // Stop any active tunnel effect
        if (this.tunnelEffect && this.tunnelEffect.isActive) {
            this.tunnelEffect.stopTunnel(); // Only stop tunnel, keep loading UI
        }
        
        // Stop any active growth phase
        if (this.growthPhaseManager && this.growthPhaseManager.isPhaseActive()) {
            this.growthPhaseManager.forceEndPhase();
        }
        
        // Hide progress bar
        if (this.progressBar) {
            this.progressBar.hide();
        }
        
        // Remove all nodes
        this.nodes.forEach(node => {
            // Remove crystal nodes or fallback to sphere nodes
            if (node.crystalGroup) {
                this.scene.remove(node.crystalGroup);
            } else if (node.sphere) {
                this.scene.remove(node.sphere);
                if (node.innerGlow) this.scene.remove(node.innerGlow);
                if (node.outerGlow) this.scene.remove(node.outerGlow);
            }
            
            this.scene.remove(node.label);
            if (node.selectionRing) this.scene.remove(node.selectionRing);
            if (node.pathLabel) this.scene.remove(node.pathLabel);
        });
        this.nodes.clear();
        
        // Remove all edges properly
        this.edges.forEach(edgeData => {
            if (edgeData.line) {
                this.scene.remove(edgeData.line);
                // Dispose of geometry and material to prevent memory leaks
                if (edgeData.line.geometry) {
                    edgeData.line.geometry.dispose();
                }
                if (edgeData.line.material) {
                    edgeData.line.material.dispose();
                }
            }
        });
        this.edges = [];
        
        // Clear relationships
        this.relationships.clear();
        
        // Reset selection state
        this.selectedNodes.clear();
        this.isolationMode = false;
        this.hiddenNodes.clear();
        this.hiddenEdges.clear();
        
        // Reset camera to inactive mode
        if (this.cameraController) {
            this.cameraController.setMode('inactive');
        }
        
        // Hide any open context menus
        if (this.contextMenu && this.contextMenu.isVisible) {
            this.contextMenu.hide();
        }
        
        // Update video button state since we no longer have nodes
        this.updateVideoButtonState();
        
        console.log('GraphRenderer: Graph cleared successfully');
    }

    positionNodes() {
        const concepts = Array.from(this.nodes.keys());
        if (concepts.length === 0) return;
        
        // Use improved force-directed layout
        const nodes = concepts.map(concept => {
            const existingPos = this.nodes.get(concept).position;
            return {
                concept,
                x: existingPos.x || (Math.random() - 0.5) * 10,
                y: existingPos.y || (Math.random() - 0.5) * 10,
                z: existingPos.z || (Math.random() - 0.5) * 10,
                vx: 0,
                vy: 0,
                vz: 0
            };
        });
        
        // Run physics simulation
        for (let iteration = 0; iteration < 150; iteration++) {
            // Repulsion between all nodes
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const dx = nodes[i].x - nodes[j].x;
                    const dy = nodes[i].y - nodes[j].y;
                    const dz = nodes[i].z - nodes[j].z;
                    const distance = Math.sqrt(dx*dx + dy*dy + dz*dz) || 0.1;
                    
                    if (distance < 4) {
                        const force = 0.15 / (distance * distance);
                        const fx = (dx / distance) * force;
                        const fy = (dy / distance) * force;
                        const fz = (dz / distance) * force;
                        
                        nodes[i].vx += fx;
                        nodes[i].vy += fy;
                        nodes[i].vz += fz;
                        nodes[j].vx -= fx;
                        nodes[j].vy -= fy;
                        nodes[j].vz -= fz;
                    }
                }
            }
            
            // Attraction for connected nodes
            this.relationships.forEach((targets, source) => {
                const sourceNode = nodes.find(n => n.concept === source);
                if (!sourceNode) return;
                
                targets.forEach(target => {
                    const targetNode = nodes.find(n => n.concept === target);
                    if (!targetNode) return;
                    
                    const dx = targetNode.x - sourceNode.x;
                    const dy = targetNode.y - sourceNode.y;
                    const dz = targetNode.z - sourceNode.z;
                    const distance = Math.sqrt(dx*dx + dy*dy + dz*dz) || 0.1;
                    
                    const idealDistance = 3;
                    const force = (distance - idealDistance) * 0.02;
                    const fx = (dx / distance) * force;
                    const fy = (dy / distance) * force;
                    const fz = (dz / distance) * force;
                    
                    sourceNode.vx += fx;
                    sourceNode.vy += fy;
                    sourceNode.vz += fz;
                    targetNode.vx -= fx;
                    targetNode.vy -= fy;
                    targetNode.vz -= fz;
                });
            });
            
            // Apply velocities with damping
            nodes.forEach(node => {
                node.x += node.vx;
                node.y += node.vy;
                node.z += node.vz;
                node.vx *= 0.85;
                node.vy *= 0.85;
                node.vz *= 0.85;
            });
        }
        
        // Apply calculated positions with smooth animation
        nodes.forEach(nodeData => {
            const node = this.nodes.get(nodeData.concept);
            if (node) {
                // Animate to new position
                this.animateNodeToPosition(node, {
                    x: nodeData.x,
                    y: nodeData.y,
                    z: nodeData.z
                });
            }
        });
        
        // Update edges after positioning
        setTimeout(() => {
            this.updateEdges();
        }, 1000);
    }

    animateNodeToPosition(nodeData, targetPosition, duration = 1000) {
        // Get correct starting position based on node type
        let startPosition;
        
        if (nodeData.crystalGroup) {
            // Crystal nodes - use crystalGroup position
            startPosition = {
                x: nodeData.crystalGroup.position.x,
                y: nodeData.crystalGroup.position.y,
                z: nodeData.crystalGroup.position.z
            };
        } else {
            // Fallback for sphere nodes
            startPosition = {
                x: nodeData.sphere.position.x,
                y: nodeData.sphere.position.y,
                z: nodeData.sphere.position.z
            };
        }
        
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease-in-out animation
            const easeProgress = progress < 0.5 
                ? 2 * progress * progress 
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;
            
            const currentPosition = {
                x: startPosition.x + (targetPosition.x - startPosition.x) * easeProgress,
                y: startPosition.y + (targetPosition.y - startPosition.y) * easeProgress,
                z: startPosition.z + (targetPosition.z - startPosition.z) * easeProgress
            };
            
            if (nodeData.crystalGroup) {
                // Move entire crystal group (includes label)
                nodeData.crystalGroup.position.set(currentPosition.x, currentPosition.y, currentPosition.z);
            } else {
                // Fallback for sphere nodes
                nodeData.sphere.position.set(currentPosition.x, currentPosition.y, currentPosition.z);
                if (nodeData.innerGlow) {
                    nodeData.innerGlow.position.set(currentPosition.x, currentPosition.y, currentPosition.z);
                }
                if (nodeData.outerGlow) {
                    nodeData.outerGlow.position.set(currentPosition.x, currentPosition.y, currentPosition.z);
                }
                nodeData.label.position.set(currentPosition.x, currentPosition.y + 0.8, currentPosition.z);
            }
            
            // Update stored position
            nodeData.position = currentPosition;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }
    
    updateEdges() {
        // Remove old edges properly
        this.edges.forEach(edgeData => {
            if (edgeData.line) {
                this.scene.remove(edgeData.line);
                // Dispose of geometry and material to prevent memory leaks
                if (edgeData.line.geometry) {
                    edgeData.line.geometry.dispose();
                }
                if (edgeData.line.material) {
                    edgeData.line.material.dispose();
                }
            }
        });
        this.edges = [];
        
        // Recreate edges with updated positions
        this.relationships.forEach((targets, source) => {
            targets.forEach(target => {
                this.createEdge(source, target, false);
            });
        });
        
        console.log('GraphRenderer: Edges updated after node repositioning');
    }

    // Mouse and interaction methods (separated for nodes only)
    onNodeHover(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const spheres = [];
        this.nodes.forEach(node => {
            if (node.sphere) spheres.push(node.sphere);
        });
        
        const intersects = this.raycaster.intersectObjects(spheres);
        
        // Reset all spheres
        spheres.forEach(sphere => {
            if (!this.selectedNodes.has(sphere.userData.concept)) {
                sphere.material.opacity = 0.9;
                sphere.scale.set(1, 1, 1);
            }
        });
        
        // Highlight hovered sphere
        if (intersects.length > 0) {
            const hoveredSphere = intersects[0].object;
            if (!this.selectedNodes.has(hoveredSphere.userData.concept)) {
                hoveredSphere.material.opacity = 1.0;
                hoveredSphere.scale.set(1.2, 1.2, 1.2);
            }
        }
    }
    
    onNodeClick(event) {
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const spheres = [];
        this.nodes.forEach(node => {
            if (node.sphere && node.sphere.visible) spheres.push(node.sphere);
        });
        
        const intersects = this.raycaster.intersectObjects(spheres);
        
        if (intersects.length > 0) {
            const clickedSphere = intersects[0].object;
            const concept = clickedSphere.userData.concept;
            
            // Regular click for node selection
            this.selectNode(concept);
        } else {
            // Click on empty space - clear selection and hide context menu
            this.clearSelection();
            if (this.contextMenu) {
                this.contextMenu.hide();
            }
        }
    }

    onKeyDown(event) {
        if (event.key === 'Escape') {
            if (this.isolationMode || this.selectedNodes.size > 0) {
                this.clearSelection();
            }
            // Also hide context menu
            if (this.contextMenu) {
                this.contextMenu.hide();
            }
        }
    }
    
    onNodeRightClick(event) {
        event.preventDefault();
        
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const spheres = [];
        this.nodes.forEach(node => {
            if (node.sphere && node.sphere.visible) spheres.push(node.sphere);
        });
        
        const intersects = this.raycaster.intersectObjects(spheres);
        
        if (intersects.length > 0 && this.contextMenu) {
            const clickedSphere = intersects[0].object;
            const concept = clickedSphere.userData.concept;
            
            // Show context menu for the clicked node
            this.contextMenu.show(concept, event.clientX, event.clientY);
            
            console.log(`GraphRenderer: Context menu shown for '${concept}'`);
        }
    }


    toggleLabels() {
        this.labelsVisible = !this.labelsVisible;
        
        this.nodes.forEach(node => {
            if (node.label) {
                node.label.visible = this.labelsVisible;
            }
        });
    }
    
    // Nebula control methods (simplified - only nebula now)
    showNebulaOnFirstNode() {
        if (!this.nebulaVisible) {
            this.showNebula();
            this.nebulaVisible = true;
            console.log('GraphRenderer: Nebula made visible with first node');
        }
    }
    
    showNebula() {
        if (this.backgroundElements.nebula) {
            this.backgroundElements.nebula.forEach(layer => {
                layer.visible = true;
            });
        }
    }
    
    hideNebula() {
        if (this.backgroundElements.nebula) {
            this.backgroundElements.nebula.forEach(layer => {
                layer.visible = false;
            });
        }
    }
    
    // Add subtle atmospheric animation to bokeh layers
    animateNebula() {
        if (!this.backgroundElements.nebula || !this.nebulaVisible) return;
        
        const time = Date.now() * 0.00003; // Much slower, more atmospheric
        
        this.backgroundElements.nebula.forEach((layer, index) => {
            // Ultra-subtle rotation - barely perceptible
            const rotationSpeed = (index % 2 === 0 ? 1 : -1) * 0.02;
            layer.rotation.y = time * rotationSpeed;
            
            // Add subtle depth breathing effect
            layer.children.forEach((particle, particleIndex) => {
                if (particle.userData) {
                    // Subtle scale breathing
                    const breathingOffset = (particleIndex * 0.1) + time * 2;
                    const breathingFactor = 1 + Math.sin(breathingOffset) * 0.05;
                    particle.scale.setScalar(particle.userData.originalScale * breathingFactor);
                    
                    // Subtle opacity breathing
                    const opacityOffset = (particleIndex * 0.15) + time * 1.5;
                    const opacityFactor = 1 + Math.sin(opacityOffset) * 0.2;
                    particle.material.opacity = particle.userData.originalOpacity * opacityFactor;
                }
            });
        });
    }
    
    // Toggle background functionality removed - only nebula remains

    // Node selection methods
    selectNode(concept) {
        if (this.selectedNodes.has(concept)) {
            // Deselect node
            this.selectedNodes.delete(concept);
            this.updateNodeSelection(concept, false);
            
            // If no nodes selected, exit isolation mode
            if (this.selectedNodes.size === 0) {
                this.exitIsolationMode();
            } else if (this.selectedNodes.size === 1) {
                // Only one node selected, show all again
                this.exitIsolationMode();
            }
        } else {
            // Select node
            this.selectedNodes.add(concept);
            this.updateNodeSelection(concept, true);
            
            // Check if we have exactly 2 nodes selected
            if (this.selectedNodes.size === 2) {
                this.enterIsolationMode();
            } else if (this.selectedNodes.size > 2) {
                // More than 2 nodes, clear previous selections and keep only the latest
                const nodesArray = Array.from(this.selectedNodes);
                const previousNode = nodesArray[nodesArray.length - 2];
                
                this.selectedNodes.delete(previousNode);
                this.updateNodeSelection(previousNode, false);
                
                // Now we have exactly 2 nodes, enter isolation mode
                this.enterIsolationMode();
            }
        }
        
        this.updateSelectionUI();
    }

    updateNodeSelection(concept, selected) {
        const nodeData = this.nodes.get(concept);
        if (!nodeData) return;

        if (selected) {
            // Visual feedback for selected node
            nodeData.sphere.material.emissive.setHex(0x444444);
            nodeData.sphere.scale.set(1.3, 1.3, 1.3);
            
            // Add selection ring
            if (!nodeData.selectionRing) {
                const ringGeometry = new THREE.RingGeometry(0.8, 0.9, 32); // Slightly larger for atoms
                const ringMaterial = new THREE.MeshBasicMaterial({
                    color: 0x00aaff, // Cyan color to match design
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.8,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                });
                nodeData.selectionRing = new THREE.Mesh(ringGeometry, ringMaterial);
                
                // Use correct position based on node type
                if (nodeData.crystalGroup) {
                    // Atomic nodes - add ring to the atomic group so it moves with it
                    nodeData.crystalGroup.add(nodeData.selectionRing);
                    nodeData.selectionRing.position.set(0, 0, 0); // Relative to group center
                } else {
                    // Fallback for old sphere nodes
                    nodeData.selectionRing.position.copy(nodeData.sphere.position);
                    this.scene.add(nodeData.selectionRing);
                }
                
                nodeData.selectionRing.lookAt(this.camera.position);
            }
            nodeData.selectionRing.visible = true;
        } else {
            // Remove selection visual feedback
            nodeData.sphere.material.emissive.setHex(0x000000);
            nodeData.sphere.scale.set(1, 1, 1);
            
            if (nodeData.selectionRing) {
                nodeData.selectionRing.visible = false;
            }
        }
    }

    enterIsolationMode() {
        if (this.selectedNodes.size !== 2) return;
        
        this.isolationMode = true;
        const selectedArray = Array.from(this.selectedNodes);
        const concept1 = selectedArray[0];
        const concept2 = selectedArray[1];
        
        // Find path between the two selected nodes
        const connectionPath = this.findPath(concept1, concept2);
        
        if (!connectionPath) {
            console.log(`No path found between ${concept1} and ${concept2}`);
            // If no path, just show the two nodes
            this.nodes.forEach((nodeData, concept) => {
                if (!this.selectedNodes.has(concept)) {
                    this.hideNode(concept);
                }
            });
            
            // Hide all edges
            this.edges.forEach((edgeData, index) => {
                this.hideEdge(index);
            });
            
            this.updateSelectionUI(`Sin conexión encontrada entre ${concept1} y ${concept2}`);
            return;
        }
        
        // Get edges that are part of the path
        const pathEdges = this.getPathEdges(connectionPath);
        
        // Hide all nodes that are NOT in the connection path
        this.nodes.forEach((nodeData, concept) => {
            if (!connectionPath.includes(concept)) {
                this.hideNode(concept);
            }
        });
        
        // Hide all edges that are NOT part of the connection path
        this.edges.forEach((edgeData, index) => {
            if (!pathEdges.includes(index)) {
                this.hideEdge(index);
            }
        });
        
        // Apply visual styling to path nodes
        this.highlightPath(connectionPath);
        
        console.log(`Isolation mode: showing path between ${concept1} and ${concept2}:`, connectionPath);
        this.updateSelectionUI(`Camino: ${connectionPath.join(' → ')}`);
    }

    exitIsolationMode() {
        if (!this.isolationMode) return;
        
        this.isolationMode = false;
        
        // Clean up path highlighting
        this.clearPathHighlighting();
        
        // Show all hidden nodes
        this.hiddenNodes.forEach(concept => {
            this.showNode(concept);
        });
        this.hiddenNodes.clear();
        
        // Show all hidden edges
        this.hiddenEdges.forEach(edgeIndex => {
            this.showEdge(edgeIndex);
        });
        this.hiddenEdges.clear();
        
        console.log('Exited isolation mode - showing full graph');
    }

    clearPathHighlighting() {
        // Remove path-specific styling and labels
        this.nodes.forEach((nodeData, concept) => {
            // Reset emissive color (keep selection emissive if selected)
            if (this.selectedNodes.has(concept)) {
                nodeData.sphere.material.emissive.setHex(0x444444); // Selected color
            } else {
                nodeData.sphere.material.emissive.setHex(0x000000); // Normal color
            }
            
            // Reset scale (keep selection scale if selected)
            if (this.selectedNodes.has(concept)) {
                nodeData.sphere.scale.set(1.3, 1.3, 1.3); // Selected scale
            } else {
                nodeData.sphere.scale.set(1, 1, 1); // Normal scale
            }
            
            // Remove path labels
            if (nodeData.pathLabel) {
                this.scene.remove(nodeData.pathLabel);
                delete nodeData.pathLabel;
            }
        });
    }

    hideNode(concept) {
        const nodeData = this.nodes.get(concept);
        if (nodeData) {
            // Hide crystal nodes or fallback to sphere nodes
            if (nodeData.crystalGroup) {
                nodeData.crystalGroup.visible = false;
            } else {
                nodeData.sphere.visible = false;
                if (nodeData.innerGlow) nodeData.innerGlow.visible = false;
                if (nodeData.outerGlow) nodeData.outerGlow.visible = false;
            }
            nodeData.label.visible = false;
            this.hiddenNodes.add(concept);
        }
    }

    showNode(concept) {
        const nodeData = this.nodes.get(concept);
        if (nodeData) {
            // Show crystal nodes or fallback to sphere nodes
            if (nodeData.crystalGroup) {
                nodeData.crystalGroup.visible = true;
            } else {
                nodeData.sphere.visible = true;
                if (nodeData.innerGlow) nodeData.innerGlow.visible = true;
                if (nodeData.outerGlow) nodeData.outerGlow.visible = true;
            }
            nodeData.label.visible = this.labelsVisible;
        }
    }

    hideEdge(edgeIndex) {
        if (this.edges[edgeIndex] && this.edges[edgeIndex].line) {
            this.edges[edgeIndex].line.visible = false;
            this.hiddenEdges.add(edgeIndex);
        }
    }

    showEdge(edgeIndex) {
        if (this.edges[edgeIndex] && this.edges[edgeIndex].line) {
            this.edges[edgeIndex].line.visible = true;
        }
    }

    clearSelection() {
        // Deselect all nodes
        this.selectedNodes.forEach(concept => {
            this.updateNodeSelection(concept, false);
        });
        this.selectedNodes.clear();
        
        // Exit isolation mode
        this.exitIsolationMode();
        this.updateSelectionUI();
    }

    updateSelectionUI(customMessage = null) {
        // Selection info now handled by HTML UI
        if (customMessage) {
            console.log('Selection:', customMessage);
        } else if (this.selectedNodes.size === 0) {
            console.log('Selection: Ningún nodo seleccionado');
        } else if (this.selectedNodes.size === 1) {
            const selected = Array.from(this.selectedNodes)[0];
            console.log(`Selection: ${selected}`);
        } else if (this.selectedNodes.size === 2) {
            const selectedArray = Array.from(this.selectedNodes);
            console.log(`Selection: ${selectedArray[0]} ↔ ${selectedArray[1]}`);
        }
    }
    
    // UI state management methods
    setGeneratingState(concept) {
        console.log('Starting generation with concept-colored tunnel:', concept);
        
        // Start tunnel effect with concept colors
        if (this.tunnelEffect) {
            this.tunnelEffect.start();
            
            // Pre-seed tunnel with initial concept for consistent colors
            if (concept) {
                this.tunnelEffect.setInitialConcept(concept);
            }
        }
        
        // Set camera to tunnel mode
        if (this.cameraController) {
            this.cameraController.setMode('tunnel');
        }
        
        // Force immediate render to show tunnel
        this.renderer.render(this.scene, this.camera);
    }
    
    clearGeneratingState() {
        // Complete tunnel effect gracefully - call complete regardless of tunnel state
        // because loading UI should be hidden when graph generation is done
        if (this.tunnelEffect) {
            this.tunnelEffect.complete();
        }
        
        // Camera mode will be handled by growth phase or set to interactive
        console.log('GraphRenderer: Cleared generating state - tunnel completing');
    }
    
    showProgress() {
        // Progress now handled by tunnel effect
    }
    
    hideProgress() {
        // Progress now handled by tunnel effect  
    }
    
    setProgress(percentage) {
        // Update tunnel progress
        if (this.tunnelEffect && this.tunnelEffect.isActive) {
            this.tunnelEffect.setProgress(percentage);
        }
    }
    
    setProgressStatus(status) {
        // Update tunnel status
        if (this.tunnelEffect && this.tunnelEffect.isActive) {
            this.tunnelEffect.setStatus(status);
        }
    }
    
    addProgressConcept(concept) {
        // Concepts tracked by tunnel effect
    }
    
    completeProgress() {
        // Progress completion handled by tunnel effect
    }
    

    highlightPath(path) {
        if (!path || path.length === 0) return;

        path.forEach((concept, index) => {
            const nodeData = this.nodes.get(concept);
            if (!nodeData) return;

            // Different styling for start, end, and intermediate nodes
            if (index === 0) {
                // Start node - green
                nodeData.sphere.material.emissive.setHex(0x004400);
            } else if (index === path.length - 1) {
                // End node - red
                nodeData.sphere.material.emissive.setHex(0x440000);
            } else {
                // Intermediate nodes - blue
                nodeData.sphere.material.emissive.setHex(0x000044);
            }

            // Make intermediate nodes slightly larger
            if (index > 0 && index < path.length - 1) {
                nodeData.sphere.scale.set(1.1, 1.1, 1.1);
            }
        });
    }

    addPathLabel(nodeData, text, color) {
        // Create small label above the node
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;
        
        // Background
        context.fillStyle = 'rgba(0, 0, 0, 0.8)';
        context.fillRect(5, 5, canvas.width - 10, canvas.height - 10);
        
        // Border
        context.strokeStyle = color;
        context.lineWidth = 2;
        context.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
        
        // Text
        context.fillStyle = color;
        context.font = 'bold 16px Arial';
        context.textAlign = 'center';
        context.fillText(text, canvas.width / 2, canvas.height / 2 + 4);
        
        const texture = new THREE.CanvasTexture(canvas);
        const labelMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true
        });
        const pathLabel = new THREE.Sprite(labelMaterial);
        pathLabel.scale.set(2, 0.5, 1);
        pathLabel.position.set(
            nodeData.sphere.position.x, 
            nodeData.sphere.position.y + 1.5, 
            nodeData.sphere.position.z
        );
        
        this.scene.add(pathLabel);
        nodeData.pathLabel = pathLabel; // Store reference for cleanup
    }

    // Check if two nodes have a direct relationship
    hasDirectRelationship(concept1, concept2) {
        return this.edges.some(edge => 
            (edge.from === concept1 && edge.to === concept2) ||
            (edge.from === concept2 && edge.to === concept1)
        );
    }

    // Find shortest path between two nodes using BFS
    findPath(startConcept, endConcept) {
        if (startConcept === endConcept) {
            return [startConcept];
        }

        // Build adjacency list for faster lookup
        const adjacencyList = new Map();
        
        // Initialize adjacency list
        this.nodes.forEach((_, concept) => {
            adjacencyList.set(concept, new Set());
        });

        // Populate adjacency list (bidirectional)
        this.edges.forEach(edge => {
            adjacencyList.get(edge.from).add(edge.to);
            adjacencyList.get(edge.to).add(edge.from);
        });

        // BFS to find shortest path
        const queue = [[startConcept]];
        const visited = new Set([startConcept]);

        while (queue.length > 0) {
            const path = queue.shift();
            const currentNode = path[path.length - 1];

            // Check all neighbors
            const neighbors = adjacencyList.get(currentNode) || new Set();
            for (const neighbor of neighbors) {
                if (neighbor === endConcept) {
                    return [...path, neighbor]; // Found path!
                }

                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push([...path, neighbor]);
                }
            }
        }

        return null; // No path found
    }

    // Find all edges that are part of the path
    getPathEdges(path) {
        if (!path || path.length < 2) return [];

        const pathEdges = [];
        for (let i = 0; i < path.length - 1; i++) {
            const from = path[i];
            const to = path[i + 1];
            
            // Find the edge index that connects these nodes
            const edgeIndex = this.edges.findIndex(edge => 
                (edge.from === from && edge.to === to) ||
                (edge.from === to && edge.to === from)
            );
            
            if (edgeIndex !== -1) {
                pathEdges.push(edgeIndex);
            }
        }
        
        return pathEdges;
    }
    
    // Growth Phase Management Methods
    startGrowthPhase(initialNode, expectedTotalNodes) {
        if (this.growthPhaseManager) {
            this.growthPhaseManager.startPhase(initialNode, expectedTotalNodes);
        }
    }
    
    updateGrowthPhaseProgress(nodeCount) {
        if (this.growthPhaseManager && this.growthPhaseManager.isPhaseActive()) {
            this.growthPhaseManager.updateExpectedNodes(nodeCount);
        }
    }
    
    endGrowthPhase() {
        if (this.growthPhaseManager && this.growthPhaseManager.isPhaseActive()) {
            this.growthPhaseManager.endPhase();
        }
    }
    
    isGrowthPhaseActive() {
        return this.growthPhaseManager ? this.growthPhaseManager.isPhaseActive() : false;
    }
    
    // Camera Management Methods
    setCameraMode(mode, options = {}) {
        if (this.cameraController) {
            this.cameraController.setMode(mode, options);
        }
    }
    
    getCameraMode() {
        return this.cameraController ? this.cameraController.getCurrentMode() : 'inactive';
    }
    
    // Cleanup
    destroy() {
        // Destroy phase management components
        if (this.growthPhaseManager) {
            this.growthPhaseManager.destroy();
            this.growthPhaseManager = null;
        }
        
        if (this.cameraController) {
            this.cameraController.destroy();
            this.cameraController = null;
        }
        
        if (this.progressBar) {
            this.progressBar.destroy();
            this.progressBar = null;
        }
        
        if (this.tunnelEffect) {
            this.tunnelEffect.cleanup();
            this.tunnelEffect = null;
        }
        
        // Clear graph
        this.clear();
        
        console.log('GraphRenderer: Destroyed');
    }
}
