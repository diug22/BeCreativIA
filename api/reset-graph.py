from http.server import BaseHTTPRequestHandler
import json

# In-memory storage for the concept graph
concept_graph = {
    "nodes": {},
    "edges": []
}

class handler(BaseHTTPRequestHandler):
    def do_DELETE(self):
        try:
            # Reset the graph
            concept_graph["nodes"] = {}
            concept_graph["edges"] = []
            
            result = {"status": "Graph reset successfully"}
            
            # Send response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            
        except Exception as e:
            self.send_error(500, f"Error resetting graph: {str(e)}")
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, x-vercel-protection-bypass')
        self.end_headers()
        return