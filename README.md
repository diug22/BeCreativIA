# Concept Graph Visualization

A 3D interactive graph that generates concept relationships using OpenAI's API and visualizes them with Three.js.

## Setup

1. **Backend Setup:**
   ```bash
   cd backend
   pip install -r ../requirements.txt
   cp ../.env.example .env
   # Edit .env and add your OpenAI API key
   python main.py
   ```

2. **Frontend Setup:**
   ```bash
   npm install
   npm run dev
   ```

## Usage

1. Start the Python backend (runs on localhost:8000)
2. Start the frontend (runs on localhost:3000)
3. Enter a concept (e.g., "Tomate")
4. Set number of cycles (default: 5)
5. Click "Generate Graph"

The system will:
- Generate 3 related concepts for each input
- Create relationships between concepts
- Visualize as a 3D graph with nodes and connections
- Continue for the specified number of cycles

## API Endpoints

- `POST /generate-concepts` - Generate related concepts
- `POST /add-concept` - Add concept to graph
- `GET /graph` - Get current graph data
- `DELETE /reset-graph` - Reset the graph