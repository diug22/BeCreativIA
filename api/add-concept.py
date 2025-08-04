from http.server import BaseHTTPRequestHandler
import json
import urllib.parse
import re

# In-memory storage for the concept graph
concept_graph = {
    "nodes": {},
    "edges": []
}

# Store all generated concepts for cross-referencing
all_generated_concepts = set()

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Parse query parameters
            parsed = urllib.parse.urlparse(self.path)
            query_params = urllib.parse.parse_qs(parsed.query)
            
            concept = query_params.get('concept', [''])[0]
            parent = query_params.get('parent', [None])[0]
            
            # Clean the concept
            concept = self.clean_concept(concept)
            if parent:
                parent = self.clean_concept(parent)
            
            # Add to global concepts
            all_generated_concepts.add(concept)
            
            concept_id = len(concept_graph["nodes"])
            
            # Check if concept already exists
            existing_id = None
            for node_id, node in concept_graph["nodes"].items():
                if node["label"] == concept:
                    existing_id = node_id
                    break
            
            # Add node if it doesn't exist
            if existing_id is None:
                concept_graph["nodes"][concept_id] = {
                    "id": concept_id,
                    "label": concept,
                    "x": 0,
                    "y": 0,
                    "z": 0
                }
                node_id = concept_id
            else:
                node_id = existing_id
            
            # Add edge if parent is provided
            if parent:
                parent_id = None
                for pid, node in concept_graph["nodes"].items():
                    if node["label"] == parent:
                        parent_id = pid
                        break
                
                if parent_id is not None:
                    # Check if edge already exists
                    edge_exists = any(
                        edge["source"] == parent_id and edge["target"] == node_id
                        for edge in concept_graph["edges"]
                    )
                    
                    if not edge_exists:
                        concept_graph["edges"].append({
                            "source": parent_id,
                            "target": node_id
                        })
            
            # Find and create connections to existing similar concepts
            existing_concepts = [node["label"] for node in concept_graph["nodes"].values()]
            similar_concepts = self.find_existing_concepts(concept, existing_concepts)
            
            for similar in similar_concepts:
                if similar != concept and similar != parent:
                    similar_id = None
                    for sid, node in concept_graph["nodes"].items():
                        if node["label"] == similar:
                            similar_id = sid
                            break
                    
                    if similar_id is not None:
                        # Add bidirectional connection for similar concepts
                        edge_exists = any(
                            (edge["source"] == node_id and edge["target"] == similar_id) or
                            (edge["source"] == similar_id and edge["target"] == node_id)
                            for edge in concept_graph["edges"]
                        )
                        
                        if not edge_exists:
                            concept_graph["edges"].append({
                                "source": node_id,
                                "target": similar_id
                            })
            
            result = {
                "status": "success", 
                "concept_id": node_id, 
                "similar_connections": len(similar_concepts)
            }
            
            # Send response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            
        except Exception as e:
            self.send_error(500, f"Error adding concept: {str(e)}")
    
    def clean_concept(self, concept):
        """Clean and normalize concept text"""
        if not concept:
            return ""
        
        # Remove numbers, bullets, and special characters at start
        concept = re.sub(r'^[\d\-\*\•\.\)]+\s*', '', concept)
        
        # Remove extra whitespace
        concept = re.sub(r'\s+', ' ', concept).strip()
        
        # Capitalize first letter
        concept = concept.capitalize()
        
        # Remove unwanted characters
        concept = re.sub(r'[^\w\sáéíóúüñ]', '', concept)
        
        return concept.strip()
    
    def find_existing_concepts(self, new_concept, existing_concepts):
        """Find existing concepts that could be connected to the new one"""
        connections = []
        new_lower = new_concept.lower()
        
        for existing in existing_concepts:
            existing_lower = existing.lower()
            
            # Check for semantic relationships
            if (new_lower in existing_lower or existing_lower in new_lower or
                abs(len(new_lower) - len(existing_lower)) <= 2):
                # Calculate similarity
                similarity = self.calculate_similarity(new_lower, existing_lower)
                if similarity > 0.6:  # 60% similarity threshold
                    connections.append(existing)
        
        return connections
    
    def calculate_similarity(self, str1, str2):
        """Calculate string similarity using Levenshtein distance"""
        if len(str1) == 0: return len(str2)
        if len(str2) == 0: return len(str1)
        
        matrix = [[0] * (len(str2) + 1) for _ in range(len(str1) + 1)]
        
        for i in range(len(str1) + 1):
            matrix[i][0] = i
        for j in range(len(str2) + 1):
            matrix[0][j] = j
            
        for i in range(1, len(str1) + 1):
            for j in range(1, len(str2) + 1):
                if str1[i-1] == str2[j-1]:
                    matrix[i][j] = matrix[i-1][j-1]
                else:
                    matrix[i][j] = min(
                        matrix[i-1][j] + 1,
                        matrix[i][j-1] + 1,
                        matrix[i-1][j-1] + 1
                    )
        
        max_len = max(len(str1), len(str2))
        return 1 - (matrix[len(str1)][len(str2)] / max_len)
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, x-vercel-protection-bypass')
        self.end_headers()
        return