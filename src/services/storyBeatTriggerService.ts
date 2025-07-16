import { StoryStateManager, StoryState } from './storyStateManager';
import path from 'path';
import fs from 'fs/promises';

export interface StoryBeatData {
  id: string;
  name: string;
  type: 'decision_point' | 'character_introduction' | 'major_conflict' | 'climax' | 'exposition_lore';
  description: string;
  triggers?: string[];
  prerequisites?: string[];
  choices?: Array<{
    option: string;
    leads_to?: string;
    consequences: string;
    character_impact?: string;
  }>;
  dialogue_triggers?: string[];
  dialogue_branches?: Array<{
    condition: string;
    response: string;
    outcome: string;
  }>;
  key_information_revealed?: string[];
  story_significance: string;
  repeatable?: boolean;
  multiple_outcomes?: boolean;
  final_choices?: Array<{
    option: string;
    consequences: string;
    ending: string;
  }>;
  wisdom_shared?: string[];
  optional_quest?: {
    name: string;
    description: string;
    reward: string;
  };
}

export interface TriggerResult {
  triggeredBeats: StoryBeatData[];
  contextModifications: {
    newActiveBeats: string[];
    completedBeats: string[];
    discoveredCharacters: string[];
    knownLocations: string[];
    storyFlags: Record<string, boolean>;
  };
  narrativeHints: string[];
  urgentActions: string[];
}

export class StoryBeatTriggerService {
  private storyStateManager: StoryStateManager;
  private storyBeatsCache: Map<string, StoryBeatData[]> = new Map();

  constructor(storyStateManager: StoryStateManager) {
    this.storyStateManager = storyStateManager;
  }

  /**
   * Load story beats from JSON file
   */
  async loadStoryBeats(storyId: string): Promise<StoryBeatData[]> {
    if (this.storyBeatsCache.has(storyId)) {
      return this.storyBeatsCache.get(storyId)!;
    }

    try {
      const storyBeatsPath = path.join(__dirname, `../../data/stories/${storyId}/story_beats.json`);
      const storyBeatsData = JSON.parse(await fs.readFile(storyBeatsPath, 'utf-8'));
      const beats = storyBeatsData.story_beats as StoryBeatData[];
      
      this.storyBeatsCache.set(storyId, beats);
      console.log(`📚 Loaded ${beats.length} story beats for ${storyId}`);
      return beats;
    } catch (error) {
      console.log(`ℹ️ No story beats file found for ${storyId} (optional)`);
      return [];
    }
  }

  /**
   * Analyze player action and trigger appropriate story beats
   */
  async analyzeAndTriggerBeats(
    storyId: string,
    sessionId: string,
    playerAction: string,
    actionType?: string
  ): Promise<TriggerResult> {
    const storyState = await this.storyStateManager.getOrCreateStoryState(storyId, sessionId);
    const storyBeats = await this.loadStoryBeats(storyId);
    
    const triggeredBeats: StoryBeatData[] = [];
    const contextModifications = {
      newActiveBeats: [...storyState.activeBeats],
      completedBeats: [...storyState.completedBeats],
      discoveredCharacters: [...storyState.discoveredCharacters],
      knownLocations: [...storyState.knownLocations],
      storyFlags: { ...storyState.storyFlags }
    };

    // Check each story beat for trigger conditions
    for (const beat of storyBeats) {
      if (this.shouldTriggerBeat(beat, storyState, playerAction, actionType)) {
        triggeredBeats.push(beat);
        
        // Apply beat consequences
        this.applyBeatConsequences(beat, contextModifications, storyState);
      }
    }

    // Generate narrative hints and urgent actions
    const narrativeHints = this.generateNarrativeHints(triggeredBeats, storyState);
    const urgentActions = this.generateUrgentActions(triggeredBeats, storyState);

    // Update story state if there were changes
    if (triggeredBeats.length > 0) {
      await this.storyStateManager.updateStoryState(storyId, sessionId, {
        activeBeats: contextModifications.newActiveBeats,
        completedBeats: contextModifications.completedBeats,
        discoveredCharacters: contextModifications.discoveredCharacters,
        knownLocations: contextModifications.knownLocations,
        storyFlags: contextModifications.storyFlags
      });
    }

    console.log(`🎭 Triggered ${triggeredBeats.length} story beats for action: "${playerAction}"`);
    
    return {
      triggeredBeats,
      contextModifications,
      narrativeHints,
      urgentActions
    };
  }

  /**
   * Check if a story beat should be triggered
   */
  private shouldTriggerBeat(
    beat: StoryBeatData,
    storyState: StoryState,
    playerAction: string,
    actionType?: string
  ): boolean {
    // Check if already completed and not repeatable
    if (storyState.completedBeats.includes(beat.id) && !beat.repeatable) {
      return false;
    }

    // Check prerequisites
    if (beat.prerequisites && beat.prerequisites.length > 0) {
      const hasPrerequisites = beat.prerequisites.every(prereq => 
        storyState.completedBeats.includes(prereq) || 
        storyState.storyFlags[prereq] === true
      );
      if (!hasPrerequisites) {
        return false;
      }
    }

    // Check action-based triggers
    if (beat.triggers && beat.triggers.length > 0) {
      const actionMatch = this.matchesActionTriggers(beat.triggers, playerAction, actionType);
      if (!actionMatch) {
        return false;
      }
    }

    // Check dialogue triggers
    if (beat.dialogue_triggers && beat.dialogue_triggers.length > 0) {
      const dialogueMatch = this.matchesDialogueTriggers(beat.dialogue_triggers, playerAction);
      if (!dialogueMatch) {
        return false;
      }
    }

    // Check for character introduction triggers
    if (beat.type === 'character_introduction') {
      const characterId = this.extractCharacterIdFromBeat(beat);
      if (characterId && storyState.discoveredCharacters.includes(characterId)) {
        return false; // Already introduced
      }
    }

    // Check location-based triggers
    if (beat.type === 'exposition_lore') {
      return this.checkLocationBasedTriggers(beat, storyState, playerAction);
    }

    return true;
  }

  /**
   * Check if player action matches beat triggers
   */
  private matchesActionTriggers(triggers: string[], playerAction: string, actionType?: string): boolean {
    const actionLower = playerAction.toLowerCase();
    
    return triggers.some(trigger => {
      const triggerLower = trigger.toLowerCase();
      
      // Direct text match
      if (actionLower.includes(triggerLower) || triggerLower.includes(actionLower)) {
        return true;
      }

      // Action type match
      if (actionType && this.matchesActionType(trigger, actionType)) {
        return true;
      }

      // Semantic matching for common actions
      return this.semanticActionMatch(trigger, actionLower);
    });
  }

  /**
   * Check if dialogue triggers match
   */
  private matchesDialogueTriggers(triggers: string[], playerAction: string): boolean {
    const actionLower = playerAction.toLowerCase();
    
    return triggers.some(trigger => {
      const triggerLower = trigger.toLowerCase();
      
      // Check for key phrases
      if (triggerLower.includes('searching') && actionLower.includes('search')) return true;
      if (triggerLower.includes('crystal') && actionLower.includes('crystal')) return true;
      if (triggerLower.includes('lost') && (actionLower.includes('lost') || actionLower.includes('confused'))) return true;
      
      return actionLower.includes(triggerLower);
    });
  }

  /**
   * Semantic matching for action types
   */
  private matchesActionType(trigger: string, actionType: string): boolean {
    const triggerLower = trigger.toLowerCase();
    const actionTypeLower = actionType.toLowerCase();
    
    const actionTypeMap: Record<string, string[]> = {
      'exploration': ['look', 'search', 'examine', 'investigate', 'observe'],
      'dialogue': ['speak', 'talk', 'ask', 'call', 'say'],
      'decision': ['go', 'move', 'enter', 'take', 'choose'],
      'combat': ['attack', 'fight', 'defend', 'cast']
    };

    return actionTypeMap[actionTypeLower]?.some(keyword => 
      triggerLower.includes(keyword)
    ) || false;
  }

  /**
   * Semantic action matching
   */
  private semanticActionMatch(trigger: string, action: string): boolean {
    const synonyms: Record<string, string[]> = {
      'look': ['examine', 'observe', 'inspect', 'study'],
      'search': ['look for', 'find', 'seek', 'hunt'],
      'speak': ['talk', 'say', 'tell', 'ask'],
      'move': ['go', 'walk', 'travel', 'proceed'],
      'take': ['grab', 'pick up', 'collect', 'get']
    };

    for (const [key, values] of Object.entries(synonyms)) {
      if (trigger.includes(key)) {
        if (values.some(synonym => action.includes(synonym))) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Apply consequences of triggered beat
   */
  private applyBeatConsequences(
    beat: StoryBeatData,
    contextModifications: TriggerResult['contextModifications'],
    storyState: StoryState
  ): void {
    // Character introductions
    if (beat.type === 'character_introduction') {
      const characterId = this.extractCharacterIdFromBeat(beat);
      if (characterId && !contextModifications.discoveredCharacters.includes(characterId)) {
        contextModifications.discoveredCharacters.push(characterId);
      }
    }

    // Location discoveries
    if (beat.description.includes('location') || beat.type === 'exposition_lore') {
      const locationId = this.extractLocationIdFromBeat(beat);
      if (locationId && !contextModifications.knownLocations.includes(locationId)) {
        contextModifications.knownLocations.push(locationId);
      }
    }

    // Mark beat as active or completed
    if (beat.repeatable) {
      if (!contextModifications.newActiveBeats.includes(beat.id)) {
        contextModifications.newActiveBeats.push(beat.id);
      }
    } else {
      contextModifications.completedBeats.push(beat.id);
      contextModifications.newActiveBeats = contextModifications.newActiveBeats.filter(id => id !== beat.id);
    }

    // Set story flags based on beat consequences
    if (beat.choices) {
      beat.choices.forEach(choice => {
        if (choice.leads_to) {
          contextModifications.storyFlags[`can_access_${choice.leads_to}`] = true;
        }
      });
    }
  }

  /**
   * Extract character ID from beat
   */
  private extractCharacterIdFromBeat(beat: StoryBeatData): string | null {
    const beatIdLower = beat.id.toLowerCase();
    if (beatIdLower.includes('whiskers')) return 'whiskers';
    if (beatIdLower.includes('thornwick')) return 'thornwick';
    if (beatIdLower.includes('elder_oak')) return 'elder_oak';
    
    return null;
  }

  /**
   * Extract location ID from beat
   */
  private extractLocationIdFromBeat(beat: StoryBeatData): string | null {
    const description = beat.description.toLowerCase();
    if (description.includes('shadow vale')) return 'shadow_vale';
    if (description.includes('crystal chamber')) return 'crystal_chamber';
    if (description.includes('forgotten glade')) return 'forgotten_glade';
    
    return null;
  }

  /**
   * Check location-based triggers
   */
  private checkLocationBasedTriggers(
    beat: StoryBeatData,
    storyState: StoryState,
    playerAction: string
  ): boolean {
    // Elder Oak wisdom requires being in the woods and seeking guidance
    if (beat.id === 'elder_oak_wisdom') {
      return storyState.currentLocation === 'whispering_woods' && 
             (playerAction.includes('guidance') || playerAction.includes('wisdom') || 
              playerAction.includes('help') || playerAction.includes('advice'));
    }

    return true;
  }

  /**
   * Generate narrative hints based on triggered beats
   */
  private generateNarrativeHints(beats: StoryBeatData[], storyState: StoryState): string[] {
    const hints: string[] = [];

    for (const beat of beats) {
      if (beat.story_significance) {
        hints.push(`Story Significance: ${beat.story_significance}`);
      }

      if (beat.key_information_revealed) {
        hints.push(`Key Information: ${beat.key_information_revealed.join(', ')}`);
      }

      if (beat.wisdom_shared) {
        hints.push(`Wisdom Available: ${beat.wisdom_shared.join(', ')}`);
      }
    }

    return hints;
  }

  /**
   * Generate urgent actions based on triggered beats
   */
  private generateUrgentActions(beats: StoryBeatData[], storyState: StoryState): string[] {
    const urgentActions: string[] = [];

    for (const beat of beats) {
      if (beat.type === 'major_conflict') {
        urgentActions.push('CONFLICT: Major confrontation is imminent');
      }

      if (beat.type === 'climax') {
        urgentActions.push('CLIMAX: This is a crucial story moment');
      }

      if (beat.multiple_outcomes) {
        urgentActions.push('CHOICE: Multiple story paths available');
      }

      if (beat.final_choices) {
        urgentActions.push('FINAL: Story conclusion depends on this choice');
      }
    }

    return urgentActions;
  }

  /**
   * Get available story beats for current state
   */
  async getAvailableBeats(storyId: string, sessionId: string): Promise<StoryBeatData[]> {
    const storyState = await this.storyStateManager.getOrCreateStoryState(storyId, sessionId);
    const allBeats = await this.loadStoryBeats(storyId);

    return allBeats.filter(beat => {
      // Not completed (unless repeatable)
      if (storyState.completedBeats.includes(beat.id) && !beat.repeatable) {
        return false;
      }

      // Prerequisites met
      if (beat.prerequisites && beat.prerequisites.length > 0) {
        return beat.prerequisites.every(prereq => 
          storyState.completedBeats.includes(prereq) || 
          storyState.storyFlags[prereq] === true
        );
      }

      return true;
    });
  }
}