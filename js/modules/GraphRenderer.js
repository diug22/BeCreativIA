import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ConceptUtils } from '../utils/ConceptUtils.js';

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
        
        // Raycaster for mouse picking
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.containerId = containerId;
        this.init();
    }
    
    init() {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        const container = document.getElementById(this.containerId);
        if (container) {
            container.appendChild(this.renderer.domElement);
        }
        
        // Setup camera
        this.camera.position.set(0, 0, 10);
        
        // Setup controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 2;
        this.controls.maxDistance = 50;
        
        // Setup lights
        this.setupLights();
        
        // Event listeners
        this.setupEventListeners();
        
        // Start render loop
        this.animate();
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

    setupEventListeners() {
        // Handle window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
        
        // Mouse events
        this.renderer.domElement.addEventListener('click', (event) => this.onMouseClick(event));
        this.renderer.domElement.addEventListener('mousemove', (event) => this.onMouseMove(event));
        
        // Keyboard events
        window.addEventListener('keydown', (event) => this.onKeyDown(event));
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        
        // Rotate nodes slightly for visual appeal
        this.nodes.forEach(nodeData => {
            if (nodeData.sphere) {
                nodeData.sphere.rotation.y += 0.01;
                if (nodeData.glow) {
                    nodeData.glow.rotation.y -= 0.005;
                }
                
                // Animate selection rings
                if (nodeData.selectionRing && nodeData.selectionRing.visible) {
                    nodeData.selectionRing.rotation.z += 0.02;
                    nodeData.selectionRing.lookAt(this.camera.position);
                }
            }
        });
        
        this.renderer.render(this.scene, this.camera);
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
        // Clear selections first
        this.clearSelection();
        
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

    // Mouse and interaction methods
    onMouseMove(event) {
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
            sphere.material.opacity = 0.9;
            sphere.scale.set(1, 1, 1);
        });
        
        // Highlight hovered sphere
        if (intersects.length > 0) {
            const hoveredSphere = intersects[0].object;
            hoveredSphere.material.opacity = 1.0;
            hoveredSphere.scale.set(1.2, 1.2, 1.2);
            document.body.style.cursor = 'pointer';
        } else {
            document.body.style.cursor = 'default';
        }
    }
    
    onMouseClick(event) {
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
            // Click on empty space - clear selection
            this.clearSelection();
        }
    }

    onKeyDown(event) {
        if (event.key === 'Escape') {
            if (this.isolationMode || this.selectedNodes.size > 0) {
                this.clearSelection();
            }
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
        // Update UI to show current selection
        const selectionInfo = document.getElementById('selectionInfo');
        if (selectionInfo) {
            if (customMessage) {
                selectionInfo.textContent = customMessage;
            } else if (this.selectedNodes.size === 0) {
                selectionInfo.textContent = 'Ningún nodo seleccionado';
            } else if (this.selectedNodes.size === 1) {
                const selected = Array.from(this.selectedNodes)[0];
                selectionInfo.textContent = `Seleccionado: ${selected}`;
            } else if (this.selectedNodes.size === 2) {
                const selectedArray = Array.from(this.selectedNodes);
                selectionInfo.textContent = `Analizando relación: ${selectedArray[0]} ↔ ${selectedArray[1]}`;
            }
        }
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
                this.addPathLabel(nodeData, 'INICIO', '#00ff00');
            } else if (index === path.length - 1) {
                // End node - red
                nodeData.sphere.material.emissive.setHex(0x440000);
                this.addPathLabel(nodeData, 'FIN', '#ff0000');
            } else {
                // Intermediate nodes - blue
                nodeData.sphere.material.emissive.setHex(0x000044);
                this.addPathLabel(nodeData, `PASO ${index}`, '#0088ff');
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
}