from http.server import BaseHTTPRequestHandler
import json
import requests
import os
import re

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Get API key
            OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
            if not OPENROUTER_API_KEY:
                self.send_error(500, "API key not configured")
                return
            
            # Clean API key (remove any whitespace/newlines)
            OPENROUTER_API_KEY = OPENROUTER_API_KEY.strip()

            # Read request body
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            
            concept = data.get('concept', '')
            cycles = data.get('cycles', 3)
            
            # Call OpenRouter API
            headers = {
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://www.becreativia.com",
                "X-Title": "Concept Graph Visualizer"
            }
            
            messages = [
                {
                    "role": "system",
                    "content": """Genera exactamente 3 conceptos relacionados con el concepto dado.

REGLAS ESTRICTAS:
1. Solo devuelve los 3 conceptos, uno por línea
2. Sin números, viñetas, ni explicaciones
3. Solo sustantivos concretos o nombres propios
4. Una sola palabra por concepto (máximo 2 palabras si es necesario)
5. En español
6. Conceptos claros y específicos

FORMATO OBLIGATORIO:
Concepto1
Concepto2
Concepto3"""
                },
                {
                    "role": "user",
                    "content": f"Concepto: {concept}"
                }
            ]
            
            api_data = {
                "model": "openrouter/horizon-beta",
                "messages": messages,
                "max_tokens": 50,
                "temperature": 0.5
            }
            
            response = requests.post("https://openrouter.ai/api/v1/chat/completions", 
                                   headers=headers, json=api_data)
            response.raise_for_status()
            
            concepts_text = response.json()["choices"][0]["message"]["content"].strip()
            raw_concepts = [concept.strip() for concept in concepts_text.split('\n') if concept.strip()]
            
            # Clean and normalize concepts
            related_concepts = []
            for concept in raw_concepts[:3]:  # Take only first 3
                cleaned = self.clean_concept(concept)
                if cleaned and len(cleaned) > 1:  # Valid concept
                    related_concepts.append(cleaned)
            
            # Ensure we have exactly 3 concepts
            while len(related_concepts) < 3:
                fallback = f"Relacionado{len(related_concepts) + 1}"
                related_concepts.append(fallback)
            
            result = {"related_concepts": related_concepts[:3]}
            
            # Send response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            
        except Exception as e:
            self.send_error(500, f"Error generating concepts: {str(e)}")
    
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
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, x-vercel-protection-bypass')
        self.end_headers()
        return