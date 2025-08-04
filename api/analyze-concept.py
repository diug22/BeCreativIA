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
            
            text = data.get('text', '')
            
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
                    "content": """Analiza si el texto dado es un concepto simple o una frase/texto complejo.

REGLAS:
1. Si es un concepto simple (1-2 palabras): responde "CONCEPTO" seguido del concepto normalizado
2. Si es una frase o texto: responde "FRASE" seguido del concepto principal extraído
3. El concepto extraído debe ser 1-2 palabras máximo
4. En español
5. Formato: TIPO|concepto_extraído|explicación_breve

EJEMPLOS:
- "Tomate" → "CONCEPTO|Tomate|Es un concepto simple"
- "Me gusta la programación" → "FRASE|Programación|Extraído el concepto principal"
- "Inteligencia artificial" → "CONCEPTO|Inteligencia artificial|Concepto compuesto válido"
"""
                },
                {
                    "role": "user",
                    "content": f"Analiza: {text}"
                }
            ]
            
            api_data = {
                "model": "openrouter/horizon-beta",
                "messages": messages,
                "max_tokens": 100,
                "temperature": 0.3
            }
            
            response = requests.post("https://openrouter.ai/api/v1/chat/completions", 
                                   headers=headers, json=api_data)
            response.raise_for_status()
            
            content = response.json()["choices"][0]["message"]["content"].strip()
            
            # Parse response
            parts = content.split("|")
            if len(parts) >= 3:
                concept_type = parts[0].strip()
                extracted = parts[1].strip()
                explanation = parts[2].strip()
                
                is_concept = concept_type == "CONCEPTO"
                cleaned_concept = self.clean_concept(extracted)
                
                result = {
                    "is_concept": is_concept,
                    "extracted_concept": cleaned_concept,
                    "explanation": explanation
                }
            else:
                # Fallback
                cleaned = self.clean_concept(text.split()[0]) if text.split() else "Concepto"
                result = {
                    "is_concept": True,
                    "extracted_concept": cleaned,
                    "explanation": "Análisis automático aplicado"
                }
            
            # Send response
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            
        except Exception as e:
            # Fallback on error
            cleaned = self.clean_concept(data.get('text', '').split()[0]) if data.get('text', '').split() else "Concepto"
            result = {
                "is_concept": True,
                "extracted_concept": cleaned,
                "explanation": f"Error en análisis: {str(e)}"
            }
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
    
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