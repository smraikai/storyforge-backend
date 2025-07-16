export interface StoryState {
  storyId: string;
  sessionId: string;
  currentLocation: string;
  completedBeats: string[];
  activeBeats: string[];
  discoveredCharacters: string[];
  knownLocations: string[];
  playerChoices: Array<{
    beatId: string;
    choice: string;
    consequence: string;
    timestamp: Date;
  }>;
  relationshipStates: Record<string, {
    characterId: string;
    relationshipLevel: 'unknown' | 'met' | 'friendly' | 'hostile' | 'allied' | 'romance';
    lastInteraction: Date;
    keyEvents: string[];
  }>;
  inventoryItems: string[];
  revealedLore: string[];
  storyFlags: Record<string, boolean>;
  metadata: {
    lastUpdated: Date;
    totalPlayTime: number;
    majorDecisions: number;
  };
}

export interface StoryBeat {
  id: string;
  name: string;
  type: 'decision_point' | 'character_introduction' | 'major_conflict' | 'climax' | 'exposition_lore';
  triggers: string[];
  prerequisites: string[];
  consequences: string[];
  repeatable: boolean;
  story_significance: string;
}

export interface StoryContext {
  currentNarrative: string;
  availableBeats: StoryBeat[];
  relevantCharacters: string[];
  activeLocations: string[];
  suggestedActions: string[];
  storyMomentum: 'low' | 'medium' | 'high' | 'climactic';
}

export class StoryStateManager {
  private storyStates: Map<string, StoryState> = new Map();

  /**
   * Initialize or retrieve story state for a session
   */
  async getOrCreateStoryState(
    storyId: string,
    sessionId: string,
    initialLocation: string = 'whispering_woods'
  ): Promise<StoryState> {
    const stateKey = `${storyId}-${sessionId}`;
    
    if (this.storyStates.has(stateKey)) {
      return this.storyStates.get(stateKey)!;
    }

    const newState: StoryState = {
      storyId,
      sessionId,
      currentLocation: initialLocation,
      completedBeats: [],
      activeBeats: ['opening_choice'], // Start with opening beat
      discoveredCharacters: [],
      knownLocations: [initialLocation],
      playerChoices: [],
      relationshipStates: {},
      inventoryItems: [],
      revealedLore: [],
      storyFlags: {},
      metadata: {
        lastUpdated: new Date(),
        totalPlayTime: 0,
        majorDecisions: 0
      }
    };

    this.storyStates.set(stateKey, newState);
    return newState;
  }

  /**
   * Update story state based on player action and consequences
   */
  async updateStoryState(
    storyId: string,
    sessionId: string,
    updates: Partial<StoryState>
  ): Promise<StoryState> {
    const stateKey = `${storyId}-${sessionId}`;
    const currentState = await this.getOrCreateStoryState(storyId, sessionId);

    const updatedState: StoryState = {
      ...currentState,
      ...updates,
      metadata: {
        ...currentState.metadata,
        lastUpdated: new Date()
      }
    };

    this.storyStates.set(stateKey, updatedState);
    return updatedState;
  }

  /**
   * Record a player choice and its consequences
   */
  async recordPlayerChoice(
    storyId: string,
    sessionId: string,
    beatId: string,
    choice: string,
    consequence: string
  ): Promise<void> {
    const state = await this.getOrCreateStoryState(storyId, sessionId);
    
    state.playerChoices.push({
      beatId,
      choice,
      consequence,
      timestamp: new Date()
    });

    // Mark beat as completed if it's not repeatable
    if (!state.completedBeats.includes(beatId)) {
      state.completedBeats.push(beatId);
    }

    // Remove from active beats
    state.activeBeats = state.activeBeats.filter(id => id !== beatId);

    // Increment major decisions counter
    state.metadata.majorDecisions++;

    await this.updateStoryState(storyId, sessionId, state);
  }

  /**
   * Check if a story beat should be triggered based on current state
   */
  shouldTriggerBeat(
    beat: StoryBeat,
    state: StoryState,
    currentAction: string
  ): boolean {
    // Check if already completed and not repeatable
    if (state.completedBeats.includes(beat.id) && !beat.repeatable) {
      return false;
    }

    // Check prerequisites
    if (beat.prerequisites.length > 0) {
      const hasPrerequisites = beat.prerequisites.every(prereq => 
        state.completedBeats.includes(prereq) || 
        state.storyFlags[prereq] === true
      );
      if (!hasPrerequisites) {
        return false;
      }
    }

    // Check triggers against current action
    if (beat.triggers.length > 0) {
      const actionLower = currentAction.toLowerCase();
      const hasMatchingTrigger = beat.triggers.some(trigger => 
        actionLower.includes(trigger.toLowerCase()) ||
        trigger.toLowerCase().includes(actionLower)
      );
      if (!hasMatchingTrigger) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get story context for enhanced narrative generation
   */
  async getStoryContext(
    storyId: string,
    sessionId: string,
    currentAction: string
  ): Promise<StoryContext> {
    const state = await this.getOrCreateStoryState(storyId, sessionId);
    
    // This would be enhanced with actual story beat data
    const mockAvailableBeats: StoryBeat[] = [
      {
        id: 'whiskers_first_meeting',
        name: 'The Mysterious Guide',
        type: 'character_introduction',
        triggers: ['look around', 'search', 'explore'],
        prerequisites: [],
        consequences: ['Meet Whiskers', 'Learn about Crystal'],
        repeatable: false,
        story_significance: 'Introduces mentor figure'
      }
    ];

    const availableBeats = mockAvailableBeats.filter(beat => 
      this.shouldTriggerBeat(beat, state, currentAction)
    );

    // Determine story momentum based on recent activity
    const recentChoices = state.playerChoices.slice(-3);
    const storyMomentum = this.calculateStoryMomentum(recentChoices, state.completedBeats);

    return {
      currentNarrative: this.generateCurrentNarrative(state),
      availableBeats,
      relevantCharacters: state.discoveredCharacters,
      activeLocations: state.knownLocations,
      suggestedActions: this.generateSuggestedActions(state, currentAction),
      storyMomentum
    };
  }

  /**
   * Calculate story momentum based on recent activity
   */
  private calculateStoryMomentum(
    recentChoices: StoryState['playerChoices'],
    completedBeats: string[]
  ): 'low' | 'medium' | 'high' | 'climactic' {
    // Check for climactic beats
    const climacticBeats = ['thornwick_confrontation', 'crystal_discovery'];
    if (climacticBeats.some(beat => completedBeats.includes(beat))) {
      return 'climactic';
    }

    // Check recent activity level
    if (recentChoices.length >= 3) {
      return 'high';
    } else if (recentChoices.length >= 2) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Generate current narrative summary
   */
  private generateCurrentNarrative(state: StoryState): string {
    const choicesCount = state.playerChoices.length;
    const charactersCount = state.discoveredCharacters.length;
    
    return `Story Progress: ${choicesCount} major decisions made, ${charactersCount} characters encountered. Currently in ${state.currentLocation}.`;
  }

  /**
   * Generate suggested actions based on story state
   */
  private generateSuggestedActions(
    state: StoryState,
    currentAction: string
  ): string[] {
    const suggestions: string[] = [];

    // Based on current location
    if (state.currentLocation === 'whispering_woods') {
      suggestions.push('Explore the forest paths', 'Look for magical creatures', 'Search for clues about the Crystal');
    } else if (state.currentLocation === 'shadow_vale') {
      suggestions.push('Proceed cautiously', 'Call out to Thornwick', 'Look for another path');
    }

    // Based on discovered characters
    if (state.discoveredCharacters.includes('whiskers')) {
      suggestions.push('Ask Whiskers for guidance', 'Follow Whiskers deeper into the woods');
    }

    return suggestions;
  }

  /**
   * Get character relationship context
   */
  async getCharacterRelationshipContext(
    storyId: string,
    sessionId: string,
    characterId: string
  ): Promise<string> {
    const state = await this.getOrCreateStoryState(storyId, sessionId);
    const relationship = state.relationshipStates[characterId];

    if (!relationship) {
      return `You have not yet met ${characterId}.`;
    }

    const level = relationship.relationshipLevel;
    const events = relationship.keyEvents.join(', ');
    
    return `Your relationship with ${characterId} is ${level}. Key events: ${events}`;
  }

  /**
   * Clean up old story states (for memory management)
   */
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): void { // 24 hours default
    const now = new Date();
    const keysToDelete: string[] = [];

    for (const [key, state] of this.storyStates.entries()) {
      const age = now.getTime() - state.metadata.lastUpdated.getTime();
      if (age > maxAge) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.storyStates.delete(key));
    
    if (keysToDelete.length > 0) {
      console.log(`🧹 Cleaned up ${keysToDelete.length} old story states`);
    }
  }
}

// Global instance
export const storyStateManager = new StoryStateManager();