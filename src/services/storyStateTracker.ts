interface StoryState {
  currentScene: string;
  tension: 'low' | 'medium' | 'high' | 'critical';
  momentum: 'stalled' | 'slow' | 'steady' | 'fast';
  lastActions: string[];
  lastNarratives: string[];
  sceneCounter: number;
  lastSignificantEvent: string | null;
  playerStatus: {
    alive: boolean;
    deathCount: number;
    lastDeathReason: string | null;
    hasExperiencedDeath: boolean;
  };
  playerChoiceHistory: Array<{
    choice: string;
    timestamp: number;
    consequences: string;
  }>;
  storyBeats: {
    introducedCharacters: string[];
    visitedLocations: string[];
    plotPointsRevealed: string[];
    conflictsIntroduced: string[];
    conflictsResolved: string[];
    deathEvents: string[];
  };
}

export class StoryStateTracker {
  private state: StoryState;
  private storyId: string;

  constructor(storyId: string) {
    this.storyId = storyId;
    this.state = {
      currentScene: 'introduction',
      tension: 'low',
      momentum: 'slow',
      lastActions: [],
      lastNarratives: [],
      sceneCounter: 0,
      lastSignificantEvent: null,
      playerStatus: {
        alive: true,
        deathCount: 0,
        lastDeathReason: null,
        hasExperiencedDeath: false
      },
      playerChoiceHistory: [],
      storyBeats: {
        introducedCharacters: [],
        visitedLocations: [],
        plotPointsRevealed: [],
        conflictsIntroduced: [],
        conflictsResolved: [],
        deathEvents: []
      }
    };
  }

  /**
   * Analyze narrative to update story state
   */
  updateFromNarrative(narrative: string, userAction: string): void {
    this.state.sceneCounter++;
    this.addToHistory(this.state.lastNarratives, narrative, 5);
    this.addToHistory(this.state.lastActions, userAction, 5);

    // Analyze narrative for story beats
    this.analyzeStoryBeats(narrative);
    
    // Update tension based on narrative content
    this.updateTension(narrative);
    
    // Update momentum based on recent patterns
    this.updateMomentum();
    
    // Track significant events
    this.trackSignificantEvents(narrative);
  }

  /**
   * Analyze if story needs intervention
   */
  needsIntervention(): {
    needed: boolean;
    reason: string;
    intervention: string;
  } {
    // Check for stalled momentum
    if (this.state.momentum === 'stalled') {
      return {
        needed: true,
        reason: 'Story momentum has stalled',
        intervention: 'INJECT_COMPLICATION'
      };
    }

    // Check for too many peaceful scenes
    if (this.state.sceneCounter > 3 && this.state.tension === 'low') {
      return {
        needed: true,
        reason: 'Too many peaceful scenes',
        intervention: 'INCREASE_TENSION'
      };
    }

    // Check for repetitive actions
    if (this.hasRepetitiveActions()) {
      return {
        needed: true,
        reason: 'Player actions are repetitive',
        intervention: 'FORCE_CHANGE'
      };
    }

    // Check for lack of plot progression
    if (this.state.sceneCounter > 5 && this.state.storyBeats.plotPointsRevealed.length === 0) {
      return {
        needed: true,
        reason: 'No plot progression detected',
        intervention: 'REVEAL_PLOT'
      };
    }

    return { needed: false, reason: '', intervention: '' };
  }

  /**
   * Get context for prompt generation
   */
  getContextForPrompt(): string {
    const intervention = this.needsIntervention();
    const interventionPrompts = this.getInterventionPrompts();
    
    let context = `STORY STATE ANALYSIS:
- Current Scene: ${this.state.currentScene}
- Tension Level: ${this.state.tension}
- Story Momentum: ${this.state.momentum}
- Scene Count: ${this.state.sceneCounter}
- Recent Actions: ${this.state.lastActions.join(', ')}

STORY BEATS TRACKER:
- Characters Introduced: ${this.state.storyBeats.introducedCharacters.join(', ') || 'None'}
- Locations Visited: ${this.state.storyBeats.visitedLocations.join(', ') || 'None'}
- Plot Points Revealed: ${this.state.storyBeats.plotPointsRevealed.join(', ') || 'None'}
- Active Conflicts: ${this.state.storyBeats.conflictsIntroduced.filter(c => 
    !this.state.storyBeats.conflictsResolved.includes(c)).join(', ') || 'None'}`;

    if (intervention.needed) {
      context += `\n\nDUNGEON MASTER INTERVENTION REQUIRED:
- Reason: ${intervention.reason}
- Intervention Type: ${intervention.intervention}
- Action: ${this.getInterventionAction(intervention.intervention)}`;
    }

    if (interventionPrompts.length > 0) {
      context += `\n\nDUNGEON MASTER GUIDANCE:
${interventionPrompts.map(prompt => `- ${prompt}`).join('\n')}`;
    }

    return context;
  }

  /**
   * Get current story state
   */
  getState(): StoryState {
    return { ...this.state };
  }

  /**
   * Record player choice and its consequences
   */
  recordChoice(choice: string, consequences: string): void {
    this.state.playerChoiceHistory.push({
      choice,
      timestamp: Date.now(),
      consequences
    });

    // Keep only last 10 choices
    if (this.state.playerChoiceHistory.length > 10) {
      this.state.playerChoiceHistory.shift();
    }
  }

  private analyzeStoryBeats(narrative: string): void {
    const lowerNarrative = narrative.toLowerCase();
    
    // Extract character names (simple heuristic)
    const characterPatterns = [
      /([A-Z][a-z]+)\s+(?:says|speaks|tells|whispers|shouts)/g,
      /(?:meet|encounter|see)\s+([A-Z][a-z]+)/g
    ];
    
    characterPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(narrative)) !== null) {
        const character = match[1];
        if (!this.state.storyBeats.introducedCharacters.includes(character)) {
          this.state.storyBeats.introducedCharacters.push(character);
        }
      }
    });

    // Extract locations
    const locationPatterns = [
      /(?:enter|arrive at|reach|find yourself in)\s+(?:the\s+)?([A-Z][a-z\s]+)/g,
      /(?:You are in|You find yourself in|You stand in)\s+(?:the\s+)?([A-Z][a-z\s]+)/g
    ];
    
    locationPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(narrative)) !== null) {
        const location = match[1].trim();
        if (!this.state.storyBeats.visitedLocations.includes(location)) {
          this.state.storyBeats.visitedLocations.push(location);
        }
      }
    });

    // Detect plot revelations
    const plotPatterns = [
      'reveal', 'discover', 'uncover', 'learn', 'realize', 'understand',
      'secret', 'mystery', 'clue', 'evidence', 'truth'
    ];
    
    if (plotPatterns.some(pattern => lowerNarrative.includes(pattern))) {
      const plotPoint = `Scene ${this.state.sceneCounter}: Discovery or revelation`;
      if (!this.state.storyBeats.plotPointsRevealed.includes(plotPoint)) {
        this.state.storyBeats.plotPointsRevealed.push(plotPoint);
      }
    }

    // Detect conflicts
    const conflictPatterns = [
      'attack', 'fight', 'battle', 'combat', 'enemy', 'threat',
      'danger', 'trap', 'ambush', 'pursue', 'chase'
    ];
    
    if (conflictPatterns.some(pattern => lowerNarrative.includes(pattern))) {
      const conflict = `Scene ${this.state.sceneCounter}: Combat or conflict`;
      if (!this.state.storyBeats.conflictsIntroduced.includes(conflict)) {
        this.state.storyBeats.conflictsIntroduced.push(conflict);
      }
    }
  }

  private updateTension(narrative: string): void {
    const lowerNarrative = narrative.toLowerCase();
    
    // High tension indicators
    const highTensionWords = ['attack', 'danger', 'threat', 'enemy', 'fear', 'panic', 'urgent', 'quickly', 'suddenly'];
    // Medium tension indicators
    const mediumTensionWords = ['suspicious', 'mysterious', 'strange', 'unsettling', 'concerning', 'worried'];
    // Low tension indicators
    const lowTensionWords = ['peaceful', 'calm', 'safe', 'rest', 'comfortable', 'relaxed'];

    const highCount = highTensionWords.filter(word => lowerNarrative.includes(word)).length;
    const mediumCount = mediumTensionWords.filter(word => lowerNarrative.includes(word)).length;
    const lowCount = lowTensionWords.filter(word => lowerNarrative.includes(word)).length;

    if (highCount > 0) {
      this.state.tension = 'high';
    } else if (mediumCount > 0) {
      this.state.tension = 'medium';
    } else if (lowCount > 0) {
      this.state.tension = 'low';
    }
    // Otherwise keep current tension
  }

  private updateMomentum(): void {
    // Analyze recent actions for repetition
    if (this.hasRepetitiveActions()) {
      this.state.momentum = 'stalled';
      return;
    }

    // Check plot progression
    const recentPlotPoints = this.state.storyBeats.plotPointsRevealed.length;
    const recentConflicts = this.state.storyBeats.conflictsIntroduced.length;
    
    if (recentPlotPoints > 0 || recentConflicts > 0) {
      this.state.momentum = 'fast';
    } else if (this.state.sceneCounter > 2) {
      this.state.momentum = 'slow';
    } else {
      this.state.momentum = 'steady';
    }
  }

  private trackSignificantEvents(narrative: string): void {
    const significantPatterns = [
      'major discovery', 'plot twist', 'character death', 'new location',
      'important revelation', 'conflict resolution', 'new threat'
    ];
    
    if (significantPatterns.some(pattern => narrative.toLowerCase().includes(pattern))) {
      this.state.lastSignificantEvent = narrative;
    }
  }

  private hasRepetitiveActions(): boolean {
    if (this.state.lastActions.length < 3) return false;
    
    const recent = this.state.lastActions.slice(-3);
    const actionTypes = recent.map(action => this.categorizeAction(action));
    
    // Check if last 3 actions are too similar
    return actionTypes.every(type => type === actionTypes[0]);
  }

  private categorizeAction(action: string): string {
    const lower = action.toLowerCase();
    if (lower.includes('look') || lower.includes('examine')) return 'examine';
    if (lower.includes('move') || lower.includes('go')) return 'move';
    if (lower.includes('talk') || lower.includes('speak')) return 'talk';
    if (lower.includes('take') || lower.includes('use')) return 'interact';
    return 'other';
  }

  private getInterventionAction(intervention: string): string {
    switch (intervention) {
      case 'INJECT_COMPLICATION':
        return 'Introduce an unexpected event, new character, or environmental change that demands immediate attention. Examples: A door slams shut, an NPC arrives with urgent news, the ground shakes, something valuable goes missing, or a sound alerts everyone to danger.';
      case 'INCREASE_TENSION':
        return 'Add time pressure, approaching danger, or mysterious elements to raise stakes. Examples: A timer counting down, footsteps approaching, something stalking the player, weather turning dangerous, or resources becoming scarce.';
      case 'FORCE_CHANGE':
        return 'Have the environment change, NPCs take action, or events unfold that prevent repetitive behavior. Examples: The room layout changes, an NPC leaves or arrives, new paths open/close, or the situation evolves without player input.';
      case 'REVEAL_PLOT':
        return 'Provide clues, reveals, or story developments that advance the main narrative. Examples: Discover a hidden message, overhear important conversation, find a key item, meet a crucial NPC, or witness a significant event.';
      default:
        return 'Continue with engaging narrative';
    }
  }

  /**
   * Get specific intervention prompts based on current story state
   */
  getInterventionPrompts(): string[] {
    const prompts: string[] = [];
    
    // Based on current tension level
    if (this.state.tension === 'low') {
      prompts.push('Consider adding mysterious sounds, strange sights, or unsettling discoveries');
      prompts.push('Introduce time pressure or approaching consequences');
    } else if (this.state.tension === 'high') {
      prompts.push('Maintain tension with escalating stakes or difficult choices');
      prompts.push('Show immediate consequences of high-tension situations');
    }
    
    // Based on momentum
    if (this.state.momentum === 'stalled') {
      prompts.push('URGENT: Something must happen immediately to break the stalemate');
      prompts.push('Have the environment or NPCs take action to force player engagement');
    }
    
    // Based on story beats
    if (this.state.storyBeats.introducedCharacters.length === 0) {
      prompts.push('Consider introducing a memorable NPC who can drive the story forward');
    }
    
    if (this.state.storyBeats.conflictsIntroduced.length === 0 && this.state.sceneCounter > 3) {
      prompts.push('The story needs conflict - introduce opposition, obstacles, or challenges');
    }
    
    return prompts;
  }

  private addToHistory(array: string[], item: string, maxLength: number): void {
    array.push(item);
    if (array.length > maxLength) {
      array.shift();
    }
  }

  /**
   * Check if the user's action should trigger death
   */
  checkForDeathTriggers(userAction: string): {
    isDeath: boolean;
    deathType: string | null;
    deathReason: string | null;
  } {
    const actionLower = userAction.toLowerCase();
    
    // Check for reckless torch actions
    const torchDeathTriggers = ['smash torch', 'break torch', 'destroy torch', 'hit torch', 'kick torch'];
    if (torchDeathTriggers.some(trigger => actionLower.includes(trigger))) {
      return {
        isDeath: true,
        deathType: 'reckless_torch_handling',
        deathReason: 'Reckless torch manipulation caused a fatal fire'
      };
    }

    // Check for dangerous stone actions
    const stoneDeathTriggers = ['smash stone', 'break wall', 'destroy stones', 'hit wall', 'punch stones'];
    if (stoneDeathTriggers.some(trigger => actionLower.includes(trigger))) {
      return {
        isDeath: true,
        deathType: 'dangerous_stone_collapse',
        deathReason: 'Reckless stone manipulation caused a fatal collapse'
      };
    }

    // Check for panic actions
    const panicDeathTriggers = ['panic', 'desperate', 'scream', 'give up', 'break down'];
    if (panicDeathTriggers.some(trigger => actionLower.includes(trigger))) {
      return {
        isDeath: true,
        deathType: 'panic_induced_death',
        deathReason: 'Panic led to fatal poor decisions'
      };
    }

    // Check for exhaustion (time-based)
    if (this.state.sceneCounter > 15) {
      return {
        isDeath: true,
        deathType: 'exhaustion_death',
        deathReason: 'Exhaustion and time pressure led to collapse'
      };
    }

    return {
      isDeath: false,
      deathType: null,
      deathReason: null
    };
  }

  /**
   * Process player death
   */
  recordPlayerDeath(deathType: string, deathReason: string): void {
    this.state.playerStatus.alive = false;
    this.state.playerStatus.deathCount++;
    this.state.playerStatus.lastDeathReason = deathReason;
    this.state.playerStatus.hasExperiencedDeath = true;
    this.state.storyBeats.deathEvents.push(`${deathType}: ${deathReason}`);
    this.state.tension = 'critical';
  }

  /**
   * Process player resurrection
   */
  recordPlayerResurrection(): void {
    this.state.playerStatus.alive = true;
    this.state.currentScene = 'post_resurrection';
    this.state.tension = 'medium';
    this.state.momentum = 'steady';
  }

  /**
   * Check if player needs resurrection
   */
  needsResurrection(): boolean {
    return !this.state.playerStatus.alive;
  }

  /**
   * Reset story state for restart
   */
  resetForRestart(): void {
    const deathCount = this.state.playerStatus.deathCount;
    const hasExperiencedDeath = this.state.playerStatus.hasExperiencedDeath;
    const deathEvents = [...this.state.storyBeats.deathEvents];
    
    this.state = {
      currentScene: 'introduction',
      tension: 'low',
      momentum: 'slow',
      lastActions: [],
      lastNarratives: [],
      sceneCounter: 0,
      lastSignificantEvent: null,
      playerStatus: {
        alive: true,
        deathCount,
        lastDeathReason: null,
        hasExperiencedDeath
      },
      playerChoiceHistory: [],
      storyBeats: {
        introducedCharacters: [],
        visitedLocations: [],
        plotPointsRevealed: [],
        conflictsIntroduced: [],
        conflictsResolved: [],
        deathEvents
      }
    };
  }
}