export class ApiService {
    constructor(baseUrl = null) {
        // Better environment detection
        this.isProduction = typeof window !== 'undefined' && 
                           (window.location.hostname === 'www.becreativia.com' || 
                            window.location.hostname === 'becreativia.com' ||
                            window.location.hostname.includes('vercel.app'));
        
        this.baseUrl = baseUrl || (this.isProduction ? '/api' : 'http://localhost:8000');
        this.bypassToken = null;
        
        // Load production config if needed
        if (this.isProduction) {
            this.loadProductionConfig();
        }
        
        console.log('ApiService initialized with baseUrl:', this.baseUrl, '(isProduction:', this.isProduction + ')');
    }
    
    async loadProductionConfig() {
        try {
            const { productionConfig } = await import('../config/production.js');
            this.bypassToken = productionConfig.bypassToken;
        } catch (error) {
            console.warn('Could not load production config:', error);
        }
    }
    
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Only add bypass token in production
        if (this.isProduction && this.bypassToken) {
            headers['x-vercel-protection-bypass'] = this.bypassToken;
        }
        
        return headers;
    }

    async analyzeInput(text) {
        try {
            const response = await fetch(`${this.baseUrl}/analyze-concept`, {
                method: 'POST',
                headers: this.getHeaders(),
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
                headers: this.getHeaders(),
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
            const headers = this.getHeaders();
            delete headers['Content-Type']; // No need for JSON content type in GET-like request
            
            const response = await fetch(`${this.baseUrl}/add-concept?concept=${encodeURIComponent(concept)}${parent ? `&parent=${encodeURIComponent(parent)}` : ''}`, {
                method: 'POST',
                headers: headers
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
            const headers = this.getHeaders();
            delete headers['Content-Type']; // No need for JSON content type in DELETE request
            
            const response = await fetch(`${this.baseUrl}/reset-graph`, {
                method: 'DELETE',
                headers: headers
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