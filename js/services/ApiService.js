export class ApiService {
    constructor(baseUrl = 'http://localhost:8000') {
        this.baseUrl = baseUrl;
    }

    async analyzeInput(text) {
        try {
            const response = await fetch(`${this.baseUrl}/analyze-concept`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error analyzing input:', error);
            return null;
        }
    }

    async generateConcepts(concept, cycles = 3) {
        try {
            const response = await fetch(`${this.baseUrl}/generate-concepts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ concept, cycles })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return data.related_concepts;
        } catch (error) {
            console.error('Error generating concepts:', error);
            return [];
        }
    }

    async addConceptToGraph(concept, parent = null) {
        try {
            const response = await fetch(`${this.baseUrl}/add-concept?concept=${encodeURIComponent(concept)}${parent ? `&parent=${encodeURIComponent(parent)}` : ''}`, {
                method: 'POST'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error adding concept to graph:', error);
            return null;
        }
    }

    async resetGraphData() {
        try {
            const response = await fetch(`${this.baseUrl}/reset-graph`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error resetting graph:', error);
            return null;
        }
    }

}