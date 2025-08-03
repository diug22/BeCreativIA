from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import requests
import os
from dotenv import load_dotenv
import json
from datetime import datetime
import re

load_dotenv()

app = FastAPI(title="Concept Graph API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions"

class ConceptRequest(BaseModel):
    concept: str
    cycles: Optional[int] = 5

class ConceptResponse(BaseModel):
    related_concepts: List[str]

class ConceptAnalysisRequest(BaseModel):
    text: str

class ConceptAnalysisResponse(BaseModel):
    is_concept: bool
    extracted_concept: str
    explanation: str

class GraphData(BaseModel):
    nodes: List[Dict]
    edges: List[Dict]


# In-memory storage for the concept graph
concept_graph = {
    "nodes": {},
    "edges": []
}


# Store all generated concepts for cross-referencing
all_generated_concepts = set()

def clean_concept(concept):
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

def find_existing_concepts(new_concept, existing_concepts):
    """Find existing concepts that could be connected to the new one"""
    connections = []
    new_lower = new_concept.lower()
    
    for existing in existing_concepts:
        existing_lower = existing.lower()
        
        # Check for semantic relationships
        if (new_lower in existing_lower or existing_lower in new_lower or
            abs(len(new_lower) - len(existing_lower)) <= 2):
            # Calculate similarity
            similarity = calculate_similarity(new_lower, existing_lower)
            if similarity > 0.6:  # 60% similarity threshold
                connections.append(existing)
    
    return connections

def calculate_similarity(str1, str2):
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

def call_openrouter_api(messages, max_tokens=50, temperature=0.5):
    """Helper function to call OpenRouter API"""
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Concept Graph Visualizer"
    }
    
    data = {
        "model": "openrouter/horizon-beta",
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature
    }
    
    response = requests.post(OPENROUTER_BASE_URL, headers=headers, json=data)
    response.raise_for_status()
    return response.json()

@app.post("/analyze-concept", response_model=ConceptAnalysisResponse)
async def analyze_concept(request: ConceptAnalysisRequest):
    try:
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
                "content": f"Analiza: {request.text}"
            }
        ]
        
        response = call_openrouter_api(messages, max_tokens=100, temperature=0.3)
        content = response["choices"][0]["message"]["content"].strip()
        
        # Parse response
        parts = content.split("|")
        if len(parts) >= 3:
            concept_type = parts[0].strip()
            extracted = parts[1].strip()
            explanation = parts[2].strip()
            
            is_concept = concept_type == "CONCEPTO"
            cleaned_concept = clean_concept(extracted)
            
            return ConceptAnalysisResponse(
                is_concept=is_concept,
                extracted_concept=cleaned_concept,
                explanation=explanation
            )
        else:
            # Fallback if parsing fails
            cleaned = clean_concept(request.text.split()[0])  # Take first word
            return ConceptAnalysisResponse(
                is_concept=True,
                extracted_concept=cleaned,
                explanation="Análisis automático aplicado"
            )
    
    except Exception as e:
        # Fallback on error
        cleaned = clean_concept(request.text.split()[0]) if request.text.split() else "Concepto"
        return ConceptAnalysisResponse(
            is_concept=True,
            extracted_concept=cleaned,
            explanation=f"Error en análisis: {str(e)}"
        )

@app.post("/generate-concepts", response_model=ConceptResponse)
async def generate_concepts(request: ConceptRequest):
    try:
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
                "content": f"Concepto: {request.concept}"
            }
        ]
        
        response = call_openrouter_api(messages, max_tokens=50, temperature=0.5)
        concepts_text = response["choices"][0]["message"]["content"].strip()
        raw_concepts = [concept.strip() for concept in concepts_text.split('\n') if concept.strip()]
        
        # Clean and normalize concepts
        related_concepts = []
        for concept in raw_concepts[:3]:  # Take only first 3
            cleaned = clean_concept(concept)
            if cleaned and len(cleaned) > 1:  # Valid concept
                # Add to global concept store
                all_generated_concepts.add(cleaned)
                related_concepts.append(cleaned)
        
        # Ensure we have exactly 3 concepts
        while len(related_concepts) < 3:
            fallback = f"Relacionado{len(related_concepts) + 1}"
            all_generated_concepts.add(fallback)
            related_concepts.append(fallback)
        
        return ConceptResponse(related_concepts=related_concepts[:3])
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating concepts: {str(e)}")

@app.post("/add-concept")
async def add_concept(concept: str, parent: Optional[str] = None):
    # Clean the concept
    concept = clean_concept(concept)
    if parent:
        parent = clean_concept(parent)
    
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
    similar_concepts = find_existing_concepts(concept, existing_concepts)
    
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
    
    return {"status": "success", "concept_id": node_id, "similar_connections": len(similar_concepts)}

@app.get("/graph", response_model=GraphData)
async def get_graph():
    return GraphData(
        nodes=list(concept_graph["nodes"].values()),
        edges=concept_graph["edges"]
    )

@app.delete("/reset-graph")
async def reset_graph():
    concept_graph["nodes"] = {}
    concept_graph["edges"] = []
    # Don't clear all_generated_concepts to maintain cross-session connections
    return {"status": "Graph reset successfully"}

@app.get("/all-concepts")
async def get_all_concepts():
    return {"concepts": list(all_generated_concepts)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)