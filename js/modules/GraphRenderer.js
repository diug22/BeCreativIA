import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ConceptUtils } from '../utils/ConceptUtils.js';
import { TunnelEffect } from '../effects/TunnelEffect.js';
import { CameraController } from '../controllers/CameraController.js';
import { ProgressBar } from '../components/ProgressBar.js';
import { GrowthPhaseManager } from '../controllers/GrowthPhaseManager.js';
import { SearchManager } from '../components/SearchManager.js';
import { ContextMenu } from '../components/ContextMenu.js';

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
    }

    setupLights() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(ambientLight);
        
        // Main directional light
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
        
        // Additional point light for better visibility
        const pointLight = new THREE.PointLight(0x00aaff, 0.3, 100);
        pointLight.position.set(-10, -10, 10);
        this.scene.add(pointLight);
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
        // Create multiple layers of colorful nebula at different distances for depth
        this.createNebulaLayer(120, 0.03, 800, 'distant');   // Purple/violet distant layer
        this.createNebulaLayer(90, 0.05, 600, 'medium');     // Blue/cyan medium layer  
        this.createNebulaLayer(65, 0.07, 500, 'close');      // Pink/magenta close layer
        this.createNebulaLayer(45, 0.09, 400, 'inner');      // Orange/yellow inner layer
        
        // Initially hide all nebula layers
        this.hideNebula();
        
        console.log('GraphRenderer: Colorful volumetric nebula created with 4 layers');
    }
    
    createNebulaLayer(radius, opacity, particleCount, layerType) {
        // Create individual sphere geometries instead of points
        const nebulaGroup = new THREE.Group();
        
        // Color schemes for different layers
        const colorSchemes = {
            distant: { r: 0.4, g: 0.2, b: 0.8 },  // Purple/violet
            medium: { r: 0.1, g: 0.4, b: 0.9 },   // Blue/cyan
            close: { r: 0.8, g: 0.3, b: 0.6 },    // Pink/magenta  
            inner: { r: 0.9, g: 0.5, b: 0.2 }     // Orange/yellow
        };
        
        const baseColor = colorSchemes[layerType] || colorSchemes.medium;
        
        // Generate particles in spherical distribution
        for (let i = 0; i < particleCount; i++) {
            // Spherical coordinates for even distribution
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = radius + (Math.random() - 0.5) * 25; // Increased radius variation
            
            const x = r * Math.sin(phi) * Math.cos(theta);
            const y = r * Math.sin(phi) * Math.sin(theta);
            const z = r * Math.cos(phi);
            
            // Create small sphere geometry for more nebula-like appearance
            const particleSize = 0.3 + Math.random() * 0.8;
            const sphereGeometry = new THREE.SphereGeometry(particleSize, 8, 6);
            
            // Color variation within the layer's scheme
            const colorVariation = 0.3;
            const finalColor = {
                r: Math.max(0, Math.min(1, baseColor.r + (Math.random() - 0.5) * colorVariation)),
                g: Math.max(0, Math.min(1, baseColor.g + (Math.random() - 0.5) * colorVariation)),
                b: Math.max(0, Math.min(1, baseColor.b + (Math.random() - 0.5) * colorVariation))
            };
            
            // Distance-based intensity
            const distanceFactor = 1 - (r - radius + 12) / 25;
            const intensity = (0.3 + Math.random() * 0.4) * Math.max(0.4, distanceFactor);
            
            const material = new THREE.MeshBasicMaterial({
                color: new THREE.Color(
                    finalColor.r * intensity,
                    finalColor.g * intensity, 
                    finalColor.b * intensity
                ),
                transparent: true,
                opacity: opacity * (0.7 + Math.random() * 0.3),
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            
            const particle = new THREE.Mesh(sphereGeometry, material);
            particle.position.set(x, y, z);
            
            // Add slight random rotation for more organic look
            particle.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            
            nebulaGroup.add(particle);
        }
        
        nebulaGroup.name = `nebulaLayer_${layerType}_${radius}`;
        nebulaGroup.renderOrder = -2; // Render before other elements
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
        
        // Animate background nebula
        this.animateNebula();
        
        this.renderer.render(this.scene, this.camera);
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
        
        // Create sphere geometry with higher quality
        const geometry = new THREE.SphereGeometry(0.4, 32, 32);
        const material = new THREE.MeshPhongMaterial({ 
            color: new THREE.Color().setHSL(hue, 0.8, 0.6),
            shininess: 100,
            transparent: true,
            opacity: animated ? 0 : 0.9
        });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.set(position.x, position.y, position.z);
        sphere.castShadow = true;
        sphere.receiveShadow = true;
        
        // Add glow effect
        const glowGeometry = new THREE.SphereGeometry(0.5, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(hue, 0.8, 0.8),
            transparent: true,
            opacity: animated ? 0 : 0.3
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.copy(sphere.position);
        
        // Create text label with improved styling
        const label = this.createTextLabel(concept, hue);
        label.position.set(position.x, position.y + 0.8, position.z);
        if (animated) {
            label.material.opacity = 0;
        }
        
        // Make sphere clickable
        sphere.userData = { concept, type: 'node' };
        
        this.scene.add(sphere);
        this.scene.add(glow);
        this.scene.add(label);
        
        const nodeData = { sphere, label, glow, position, hue };
        this.nodes.set(concept, nodeData);
        
        // Add loading node to tunnel if tunnel is active
        if (this.tunnelEffect && this.tunnelEffect.isActive) {
            const nodeColor = new THREE.Color().setHSL(hue, 0.8, 0.6).getHex();
            this.tunnelEffect.addLoadingNode(concept, nodeColor);
        }
        
        // Add node to growth phase if active
        if (this.growthPhaseManager && this.growthPhaseManager.isPhaseActive()) {
            this.growthPhaseManager.addNode(sphere, concept);
        }
        
        // Animate appearance if requested
        if (animated) {
            this.animateNodeAppearance(nodeData);
        }
        
        return nodeData;
    }

    createTextLabel(concept, hue) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 128;
        
        // Background for text
        context.fillStyle = 'rgba(0, 0, 0, 0.8)';
        context.roundRect(10, 20, canvas.width - 20, canvas.height - 40, 15);
        context.fill();
        
        // Border
        context.strokeStyle = `hsl(${hue * 360}, 80%, 60%)`;
        context.lineWidth = 3;
        context.roundRect(10, 20, canvas.width - 20, canvas.height - 40, 15);
        context.stroke();
        
        // Text
        context.fillStyle = '#ffffff';
        context.font = 'bold 32px Arial';
        context.textAlign = 'center';
        context.fillText(concept, canvas.width / 2, canvas.height / 2 + 8);
        
        const texture = new THREE.CanvasTexture(canvas);
        const labelMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true
        });
        const label = new THREE.Sprite(labelMaterial);
        label.scale.set(3, 0.75, 1);
        
        return label;
    }

    animateNodeAppearance(nodeData) {
        const duration = 1000; // 1 second
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease-out animation
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            // Animate opacity
            nodeData.sphere.material.opacity = easeProgress * 0.9;
            nodeData.glow.material.opacity = easeProgress * 0.3;
            nodeData.label.material.opacity = easeProgress;
            
            // Animate scale
            const scale = easeProgress;
            nodeData.sphere.scale.set(scale, scale, scale);
            nodeData.glow.scale.set(scale, scale, scale);
            
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
        
        // Create curved line for better visualization
        const start = new THREE.Vector3(fromNode.position.x, fromNode.position.y, fromNode.position.z);
        const end = new THREE.Vector3(toNode.position.x, toNode.position.y, toNode.position.z);
        const middle = new THREE.Vector3().lerpVectors(start, end, 0.5);
        middle.y += Math.random() * 2 - 1; // Random arc height
        
        const curve = new THREE.QuadraticBezierCurve3(start, middle, end);
        const points = curve.getPoints(50);
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        
        // Create gradient color based on parent-child relationship
        const parentHue = fromNode.hue;
        const childHue = toNode.hue;
        const averageHue = (parentHue + childHue) / 2;
        
        const material = new THREE.LineBasicMaterial({ 
            color: new THREE.Color().setHSL(averageHue, 0.8, 0.7),
            linewidth: 2,
            transparent: true,
            opacity: animated ? 0 : 0.8
        });
        
        const line = new THREE.Line(geometry, material);
        
        this.scene.add(line);
        this.edges.push({ line, from: fromConcept, to: toConcept });
        
        // Store relationship for duplicate detection
        if (!this.relationships.has(fromConcept)) {
            this.relationships.set(fromConcept, new Set());
        }
        this.relationships.get(fromConcept).add(toConcept);
        
        // Animate edge appearance
        if (animated) {
            this.animateEdgeAppearance(material);
        }
    }

    animateEdgeAppearance(material) {
        const duration = 800;
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            material.opacity = progress * 0.8;
            
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
            this.tunnelEffect.stop();
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
            this.scene.remove(node.sphere);
            this.scene.remove(node.label);
            if (node.glow) this.scene.remove(node.glow);
            if (node.selectionRing) this.scene.remove(node.selectionRing);
            if (node.pathLabel) this.scene.remove(node.pathLabel);
        });
        this.nodes.clear();
        
        // Remove all edges
        this.edges.forEach(edgeData => {
            if (edgeData.line) this.scene.remove(edgeData.line);
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
        const startPosition = {
            x: nodeData.sphere.position.x,
            y: nodeData.sphere.position.y,
            z: nodeData.sphere.position.z
        };
        
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
            
            nodeData.sphere.position.set(currentPosition.x, currentPosition.y, currentPosition.z);
            if (nodeData.glow) {
                nodeData.glow.position.set(currentPosition.x, currentPosition.y, currentPosition.z);
            }
            nodeData.label.position.set(currentPosition.x, currentPosition.y + 0.8, currentPosition.z);
            nodeData.position = currentPosition;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }
    
    updateEdges() {
        // Remove old edges
        this.edges.forEach(edgeData => {
            if (edgeData.line) this.scene.remove(edgeData.line);
        });
        this.edges = [];
        
        // Recreate edges with updated positions
        this.relationships.forEach((targets, source) => {
            targets.forEach(target => {
                this.createEdge(source, target, false);
            });
        });
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
    
    // Add subtle animation to nebula layers
    animateNebula() {
        if (!this.backgroundElements.nebula || !this.nebulaVisible) return;
        
        const time = Date.now() * 0.00008; // Slightly slower animation
        this.backgroundElements.nebula.forEach((layer, index) => {
            // Very slow rotation for each layer in different directions
            const rotationSpeed = (index % 2 === 0 ? 1 : -1) * 0.08;
            layer.rotation.y = time * rotationSpeed;
            layer.rotation.x = time * rotationSpeed * 0.25;
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
                const ringGeometry = new THREE.RingGeometry(0.6, 0.7, 32);
                const ringMaterial = new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.8
                });
                nodeData.selectionRing = new THREE.Mesh(ringGeometry, ringMaterial);
                nodeData.selectionRing.position.copy(nodeData.sphere.position);
                nodeData.selectionRing.lookAt(this.camera.position);
                this.scene.add(nodeData.selectionRing);
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
            nodeData.sphere.visible = false;
            nodeData.label.visible = false;
            if (nodeData.glow) nodeData.glow.visible = false;
            this.hiddenNodes.add(concept);
        }
    }

    showNode(concept) {
        const nodeData = this.nodes.get(concept);
        if (nodeData) {
            nodeData.sphere.visible = true;
            nodeData.label.visible = this.labelsVisible;
            if (nodeData.glow) nodeData.glow.visible = true;
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
        // Stop tunnel effect
        if (this.tunnelEffect) {
            this.tunnelEffect.stop();
        }
        
        // Camera mode will be handled by growth phase or set to interactive
        console.log('GraphRenderer: Cleared generating state');
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