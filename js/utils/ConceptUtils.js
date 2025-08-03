export class ConceptUtils {
    static cleanConcept(concept) {
        if (!concept) return "";
        
        // Remove numbers, bullets, and special characters at start
        concept = concept.replace(/^[\d\-\*\•\.\)]+\s*/, '');
        
        // Remove extra whitespace
        concept = concept.replace(/\s+/g, ' ').trim();
        
        // Capitalize first letter
        concept = concept.charAt(0).toUpperCase() + concept.slice(1);
        
        // Remove unwanted characters but keep accents
        concept = concept.replace(/[^\w\sáéíóúüñÁÉÍÓÚÜÑ]/g, '');
        
        return concept.trim();
    }

    static calculateSimilarity(str1, str2) {
        if (str1.length === 0) return str2.length;
        if (str2.length === 0) return str1.length;
        
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        const maxLen = Math.max(str1.length, str2.length);
        return 1 - (matrix[str2.length][str1.length] / maxLen);
    }

    static findSimilarConcept(newConcept, existingConcepts, threshold = 0.8) {
        let bestMatch = null;
        let bestSimilarity = 0;
        
        const newLower = newConcept.toLowerCase();
        
        for (const existing of existingConcepts) {
            const existingLower = existing.toLowerCase();
            const similarity = this.calculateSimilarity(newLower, existingLower);
            
            if (similarity > threshold && similarity > bestSimilarity) {
                bestSimilarity = similarity;
                bestMatch = existing;
            }
        }
        
        return bestMatch;
    }

    static getConceptHue(concept) {
        // Generate consistent color based on concept name
        let hash = 0;
        for (let i = 0; i < concept.length; i++) {
            hash = concept.charCodeAt(i) + ((hash << 5) - hash);
        }
        return (Math.abs(hash) % 360) / 360;
    }

    static validateCycleRange(cycles) {
        const parsed = parseInt(cycles);
        if (isNaN(parsed) || parsed < 2 || parsed > 5) {
            return 3; // Default value
        }
        return parsed;
    }

    static generateNodeId() {
        return 'node_' + Math.random().toString(36).substr(2, 9);
    }
}