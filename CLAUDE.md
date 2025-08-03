# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Frontend (Vite + Three.js)
- `npm install` - Install dependencies
- `npm run dev` - Start development server (runs on localhost:3000)
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Backend (FastAPI + Python)
- `pip install -r requirements.txt` - Install Python dependencies
- `cd backend && python main.py` - Start FastAPI server (runs on localhost:8000)
- Alternative: `uvicorn main:app --host 0.0.0.0 --port 8000` (from backend directory)

## Architecture Overview

This is a 3D concept graph visualization application that generates relationship networks using OpenRouter HorizonBeta LLM:

### Backend (FastAPI)
- **Main file**: `backend/main.py`
- **API Server**: Handles concept generation via OpenRouter HorizonBeta LLM
- **Data Management**: In-memory storage for graph nodes/edges
- **Key Features**:
  - Concept similarity detection using Levenshtein distance
  - Cross-referencing to prevent duplicates
  - RESTful API with CORS enabled

### Frontend (Three.js - Modular Architecture)
- **Main file**: `js/main.js` (Entry point)
- **Modules**:
  - `js/modules/ConceptGraphApp.js` - Main application controller
  - `js/modules/GraphRenderer.js` - 3D visualization engine
  - `js/modules/ProgressManager.js` - Progress tracking and UI
  - `js/services/ApiService.js` - Backend communication
  - `js/utils/ConceptUtils.js` - Utility functions
- **Key Features**:
  - Concept vs phrase analysis before processing
  - Progressive node creation with animations
  - Progress bar with 3^n calculation
  - Generation limits (2-5 cycles)
  - Node selection system for relationship isolation
  - OrbitControls for camera navigation
  - Color-coded nodes based on concept hash
  - Dynamic edge creation with curved connections
  - Interactive node selection with visual feedback

### Key API Endpoints
- `POST /analyze-concept` - Analyze if input is concept or phrase
- `POST /generate-concepts` - Generate 3 related concepts from input
- `POST /add-concept` - Add concept to graph with parent relationship
- `GET /graph` - Retrieve current graph data
- `DELETE /reset-graph` - Reset the graph

## Environment Setup

### Required Environment Variables
- `OPENROUTER_API_KEY` - Required for concept generation via OpenRouter
- Create `.env` file in root directory (copy from `.env.example` if available)

### Startup Sequence
1. Start backend server first (port 8000)
2. Start frontend development server (port 3000)
3. Frontend connects to backend via `http://localhost:8000`

## Key Algorithms

### Force-Directed Layout
The application uses a custom force simulation in `positionNodes()` method:
- Repulsion forces between all nodes (minimum 4 unit separation)
- Attraction forces for connected nodes
- 150 iterations of physics simulation for optimal positioning

### Concept Similarity
Uses Levenshtein distance with 60% similarity threshold to detect related concepts and prevent duplicates.

### Node Selection System
- Click nodes to select/deselect with visual feedback (selection rings)
- Select exactly 2 nodes to enter path visualization mode
- Uses BFS algorithm to find shortest path between selected nodes
- Shows complete connection chain including all intermediate steps
- Visual distinctions: INICIO (green), PASO N (blue), FIN (red)
- Displays path in UI as "Camino: Node1 → Node2 → ... → NodeN"
- ESC or click empty space to clear selection
- Handles disconnected nodes gracefully

## File Structure Notes
- Frontend is a single-page application with modular Three.js architecture
- Backend uses Pydantic models for request validation
- All visualization logic is contained in the `ConceptGraph` class
- Global functions exposed to HTML for UI interaction