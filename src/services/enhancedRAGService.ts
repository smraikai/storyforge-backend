import { StoryStateManager, StoryState } from './storyStateManager';

export interface EnhancedContext {
  content: string;
  relevanceScore: number;
  relationshipScore: number;
  storyRelevanceScore: number;
  metadata: {
    type: string;
    id: string;
    name?: string;
    title?: string;
    category: string;
    connections?: string[];
    storyWeight?: number;
  };
}

export interface StoryDocument {
  content: string;
  metadata: {
    type: string;
    id: string;
    name?: string;
    title?: string;
    category: string;
    connections?: string[];
    storyWeight?: number;
  };
}

export class EnhancedRAGService {
  private storyStateManager: StoryStateManager;

  constructor(storyStateManager: StoryStateManager) {
    this.storyStateManager = storyStateManager;
  }

  /**
   * Enhanced search with relationship-aware context
   */
  async searchStoryContextEnhanced(
    storyId: string,
    sessionId: string,
    query: string,
    documents: StoryDocument[],
    maxResults: number = 8
  ): Promise<EnhancedContext[]> {
    const storyState = await this.storyStateManager.getOrCreateStoryState(storyId, sessionId);
    const queryLower = query.toLowerCase();
    const queryWords = this.extractKeywords(queryLower);

    // Score each document
    const scoredResults = documents.map(doc => {
      const baseScore = this.calculateBaseScore(doc, queryWords);
      const relationshipScore = this.calculateRelationshipScore(doc, storyState, queryWords);
      const storyRelevanceScore = this.calculateStoryRelevanceScore(doc, storyState);
      
      const totalScore = baseScore + relationshipScore + storyRelevanceScore;

      return {
        content: doc.content,
        relevanceScore: baseScore,
        relationshipScore,
        storyRelevanceScore,
        metadata: doc.metadata
      } as EnhancedContext;
    });

    // Sort by total score and apply story-aware filtering
    const filteredResults = scoredResults
      .filter(result => this.getTotalScore(result) > 0)
      .sort((a, b) => this.getTotalScore(b) - this.getTotalScore(a));

    // Apply context expansion for highly relevant results
    const expandedResults = await this.expandRelatedContext(
      filteredResults.slice(0, maxResults),
      documents,
      storyState
    );

    console.log(`🔍 Enhanced RAG search found ${expandedResults.length} results for "${query}"`);
    
    return expandedResults;
  }

  /**
   * Calculate base relevance score using improved keyword matching
   */
  private calculateBaseScore(doc: StoryDocument, queryWords: string[]): number {
    const content = doc.content.toLowerCase();
    let score = 0;

    for (const word of queryWords) {
      // Exact matches get higher score
      const exactMatches = (content.match(new RegExp(`\\b${word}\\b`, 'g')) || []).length;
      score += exactMatches * 3;

      // Partial matches get lower score
      const partialMatches = (content.match(new RegExp(word, 'g')) || []).length - exactMatches;
      score += partialMatches * 1;

      // Boost score for matches in key fields
      const nameMatch = (doc.metadata.name?.toLowerCase().includes(word) || 
                        doc.metadata.title?.toLowerCase().includes(word)) ? 5 : 0;
      score += nameMatch;
    }

    return score;
  }

  /**
   * Calculate relationship-aware scoring
   */
  private calculateRelationshipScore(
    doc: StoryDocument,
    storyState: StoryState,
    queryWords: string[]
  ): number {
    let score = 0;

    // Boost score for discovered characters
    if (doc.metadata.type === 'character' && 
        storyState.discoveredCharacters.includes(doc.metadata.id)) {
      score += 10;
    }

    // Boost score for known locations
    if (doc.metadata.type === 'location' && 
        storyState.knownLocations.includes(doc.metadata.id)) {
      score += 8;
    }

    // Boost score for current location
    if (doc.metadata.type === 'location' && 
        doc.metadata.id === storyState.currentLocation) {
      score += 15;
    }

    // Boost score for characters with established relationships
    if (doc.metadata.type === 'character' && 
        storyState.relationshipStates[doc.metadata.id]) {
      const relationship = storyState.relationshipStates[doc.metadata.id];
      const relationshipBonus = this.getRelationshipBonus(relationship.relationshipLevel);
      score += relationshipBonus;
    }

    // Boost score for completed story beats
    if (doc.metadata.type === 'story_beat' && 
        storyState.completedBeats.includes(doc.metadata.id)) {
      score += 5;
    }

    // Boost score for revealed lore
    if (doc.metadata.type === 'lore' && 
        storyState.revealedLore.includes(doc.metadata.id)) {
      score += 6;
    }

    return score;
  }

  /**
   * Calculate story relevance based on current narrative state
   */
  private calculateStoryRelevanceScore(
    doc: StoryDocument,
    storyState: StoryState
  ): number {
    let score = 0;

    // Boost score based on story progression
    const progressionBonus = Math.min(storyState.completedBeats.length * 2, 10);
    score += progressionBonus;

    // Boost score for active story beats
    if (doc.metadata.type === 'story_beat' && 
        storyState.activeBeats.includes(doc.metadata.id)) {
      score += 20;
    }

    // Apply story weight if available
    if (doc.metadata.storyWeight) {
      score += doc.metadata.storyWeight;
    }

    return score;
  }

  /**
   * Get relationship bonus based on relationship level
   */
  private getRelationshipBonus(level: string): number {
    switch (level) {
      case 'allied': return 12;
      case 'friendly': return 8;
      case 'romance': return 10;
      case 'met': return 5;
      case 'hostile': return 7; // Still relevant for conflict
      case 'unknown': return 0;
      default: return 0;
    }
  }

  /**
   * Expand context with related documents
   */
  private async expandRelatedContext(
    results: EnhancedContext[],
    allDocuments: StoryDocument[],
    storyState: StoryState
  ): Promise<EnhancedContext[]> {
    const expandedResults = [...results];
    const includedIds = new Set(results.map(r => r.metadata.id));

    for (const result of results) {
      // Find related documents based on connections
      const relatedDocs = this.findRelatedDocuments(result, allDocuments, storyState);
      
      for (const relatedDoc of relatedDocs) {
        if (!includedIds.has(relatedDoc.metadata.id) && expandedResults.length < 12) {
          const enhancedRelated: EnhancedContext = {
            content: relatedDoc.content,
            relevanceScore: 0,
            relationshipScore: this.calculateRelationshipScore(relatedDoc, storyState, []),
            storyRelevanceScore: this.calculateStoryRelevanceScore(relatedDoc, storyState),
            metadata: relatedDoc.metadata
          };

          expandedResults.push(enhancedRelated);
          includedIds.add(relatedDoc.metadata.id);
        }
      }
    }

    return expandedResults;
  }

  /**
   * Find documents related to a given result
   */
  private findRelatedDocuments(
    result: EnhancedContext,
    allDocuments: StoryDocument[],
    storyState: StoryState
  ): StoryDocument[] {
    const related: StoryDocument[] = [];

    for (const doc of allDocuments) {
      // Skip if same document
      if (doc.metadata.id === result.metadata.id) continue;

      // Character relationships
      if (result.metadata.type === 'character' && doc.metadata.type === 'character') {
        if (this.hasCharacterRelationship(result.metadata.id, doc.metadata.id, doc.content)) {
          related.push(doc);
        }
      }

      // Location connections
      if (result.metadata.type === 'location' && doc.metadata.type === 'location') {
        if (this.hasLocationConnection(result.metadata.id, doc.metadata.id, doc.content)) {
          related.push(doc);
        }
      }

      // Character-location relationships
      if (result.metadata.type === 'character' && doc.metadata.type === 'location') {
        if (doc.content.toLowerCase().includes(result.metadata.name?.toLowerCase() || '')) {
          related.push(doc);
        }
      }

      // Story beat connections
      if (result.metadata.type === 'story_beat') {
        if (doc.content.toLowerCase().includes(result.metadata.name?.toLowerCase() || '')) {
          related.push(doc);
        }
      }
    }

    return related;
  }

  /**
   * Check if two characters have a relationship
   */
  private hasCharacterRelationship(char1Id: string, char2Id: string, content: string): boolean {
    return content.toLowerCase().includes(char1Id.toLowerCase()) ||
           content.toLowerCase().includes(char2Id.toLowerCase());
  }

  /**
   * Check if two locations are connected
   */
  private hasLocationConnection(loc1Id: string, loc2Id: string, content: string): boolean {
    const connections = ['connection', 'connected', 'border', 'path', 'entrance', 'exit'];
    const hasConnectionKeyword = connections.some(keyword => 
      content.toLowerCase().includes(keyword)
    );
    
    return hasConnectionKeyword && (
      content.toLowerCase().includes(loc1Id.toLowerCase()) ||
      content.toLowerCase().includes(loc2Id.toLowerCase())
    );
  }

  /**
   * Extract meaningful keywords from query
   */
  private extractKeywords(query: string): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them']);
    
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .filter(word => /^[a-z]+$/.test(word)); // Only alphabetic words
  }

  /**
   * Get total score for sorting
   */
  private getTotalScore(result: EnhancedContext): number {
    return result.relevanceScore + result.relationshipScore + result.storyRelevanceScore;
  }

  /**
   * Get context summary for debugging
   */
  getContextSummary(results: EnhancedContext[]): string {
    return results.map(r => 
      `${r.metadata.category}:${r.metadata.name || r.metadata.title || r.metadata.id} (${this.getTotalScore(r)})`
    ).join(', ');
  }
}