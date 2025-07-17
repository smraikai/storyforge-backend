import path from 'path';
import fs from 'fs/promises';

export interface ScenarioData {
  scenario_id: string;
  name: string;
  story_beat: string;
  sequence_order: number;
  type: string;
  description: string;
  setup: {
    player_state: string;
    environment: string;
    immediate_challenge: string;
  };
  objectives: {
    primary: string;
    secondary: string[];
  };
  success_criteria: {
    required_actions: string[];
    success_indicators: string[];
    completion_trigger: string;
  };
  failure_conditions: {
    death_triggers: string[];
    wrong_approach: string[];
    timeout: string;
  };
  available_actions: Array<{
    action: string;
    description: string;
    success_outcome: string | null;
    failure_outcome: string | null;
  }>;
  narrative_elements?: {
    atmosphere?: string;
    tension_level?: string;
    pacing?: string;
    key_moments?: string[];
  };
  progression: {
    next_scenario: string;
    completion_requirements: string[];
    skip_conditions?: string[];
    story_completion?: boolean;
  };
}

export interface StoryStructure {
  story_id: string;
  title: string;
  overall_objective: string;
  success_criteria: {
    primary: string;
    secondary: string[];
  };
  failure_conditions: {
    death: string;
    timeout: string;
    giving_up: string;
  };
  story_beats: Array<{
    id: string;
    name: string;
    description: string;
    objective: string;
    success_criteria: string;
    failure_conditions: string[];
    scenarios: string[];
  }>;
  progression_rules: {
    linear: boolean;
    beat_completion_required: boolean;
    scenario_retry_allowed: boolean;
    death_resets_to_beat_start: boolean;
  };
}

export interface PlayerProgress {
  story_id: string;
  session_id: string;
  current_beat: string;
  current_scenario: string;
  completed_scenarios: string[];
  completed_beats: string[];
  death_count: number;
  success_indicators_met: string[];
  failed_attempts: Array<{
    scenario: string;
    failure_type: string;
    timestamp: Date;
  }>;
}

export class ScenarioProgressionService {
  private storyDataPath: string;

  constructor() {
    this.storyDataPath = path.join(__dirname, '../../data/stories');
  }

  /**
   * Load story structure configuration
   */
  async loadStoryStructure(storyId: string): Promise<StoryStructure> {
    try {
      const structurePath = path.join(this.storyDataPath, storyId, 'story_structure.json');
      const structureData = JSON.parse(await fs.readFile(structurePath, 'utf-8'));
      return structureData;
    } catch (error) {
      console.error(`❌ Error loading story structure for ${storyId}:`, error);
      throw new Error(`Failed to load story structure for ${storyId}`);
    }
  }

  /**
   * Load specific scenario data
   */
  async loadScenario(storyId: string, scenarioId: string): Promise<ScenarioData> {
    try {
      const scenarioPath = path.join(this.storyDataPath, storyId, 'scenarios', `${scenarioId}.json`);
      const scenarioData = JSON.parse(await fs.readFile(scenarioPath, 'utf-8'));
      return scenarioData;
    } catch (error) {
      console.error(`❌ Error loading scenario ${scenarioId} for ${storyId}:`, error);
      throw new Error(`Failed to load scenario ${scenarioId} for ${storyId}`);
    }
  }

  /**
   * Evaluate if player action meets success criteria
   */
  async evaluateAction(
    storyId: string,
    scenarioId: string,
    playerAction: string,
    playerProgress: PlayerProgress
  ): Promise<{
    success: boolean;
    failure: boolean;
    death: boolean;
    scenario_complete: boolean;
    beat_complete: boolean;
    story_complete: boolean;
    next_scenario: string | null;
    feedback: string;
    consequences: string;
  }> {
    const scenario = await this.loadScenario(storyId, scenarioId);
    const actionLower = playerAction.toLowerCase();
    
    // Check for death conditions first
    const deathTriggers = scenario.failure_conditions.death_triggers;
    if (deathTriggers.some(trigger => actionLower.includes(trigger))) {
      return {
        success: false,
        failure: true,
        death: true,
        scenario_complete: false,
        beat_complete: false,
        story_complete: false,
        next_scenario: null,
        feedback: 'Fatal action detected',
        consequences: 'Player death - restart required'
      };
    }

    // Check for wrong approach
    const wrongApproach = scenario.failure_conditions.wrong_approach;
    if (wrongApproach.some(approach => actionLower.includes(approach))) {
      return {
        success: false,
        failure: true,
        death: false,
        scenario_complete: false,
        beat_complete: false,
        story_complete: false,
        next_scenario: null,
        feedback: 'Incorrect approach detected',
        consequences: 'Action failed - try a different method'
      };
    }

    // Check for success conditions
    const requiredActions = scenario.success_criteria.required_actions;
    const actionMatches = requiredActions.some(required => actionLower.includes(required));
    
    if (actionMatches) {
      // Check if this completes the scenario
      const completionTrigger = scenario.success_criteria.completion_trigger;
      const scenarioComplete = actionLower.includes(completionTrigger);
      
      if (scenarioComplete) {
        // Check if this completes the beat
        const structure = await this.loadStoryStructure(storyId);
        const currentBeat = structure.story_beats.find(beat => beat.id === scenario.story_beat);
        const beatComplete = currentBeat ? this.checkBeatCompletion(currentBeat, playerProgress) : false;
        
        // Check if this completes the story
        const storyComplete = scenario.progression.story_completion || false;
        
        return {
          success: true,
          failure: false,
          death: false,
          scenario_complete: true,
          beat_complete: beatComplete,
          story_complete: storyComplete,
          next_scenario: scenario.progression.next_scenario,
          feedback: 'Action successful',
          consequences: 'Scenario objective achieved'
        };
      }
      
      return {
        success: true,
        failure: false,
        death: false,
        scenario_complete: false,
        beat_complete: false,
        story_complete: false,
        next_scenario: null,
        feedback: 'Action successful',
        consequences: 'Progress made toward objective'
      };
    }

    // Neutral action - neither success nor failure
    return {
      success: false,
      failure: false,
      death: false,
      scenario_complete: false,
      beat_complete: false,
      story_complete: false,
      next_scenario: null,
      feedback: 'Action acknowledged',
      consequences: 'No significant progress'
    };
  }

  /**
   * Check if a story beat is complete
   */
  private checkBeatCompletion(beat: any, playerProgress: PlayerProgress): boolean {
    // Simple check - if all scenarios in beat are completed
    const beatScenarios = beat.scenarios || [];
    return beatScenarios.every((scenario: string) => 
      playerProgress.completed_scenarios.includes(scenario)
    );
  }

  /**
   * Get next scenario in progression
   */
  async getNextScenario(
    storyId: string,
    currentScenarioId: string,
    playerProgress: PlayerProgress
  ): Promise<string | null> {
    const currentScenario = await this.loadScenario(storyId, currentScenarioId);
    
    // Check if there's a specific next scenario
    if (currentScenario.progression.next_scenario) {
      return currentScenario.progression.next_scenario;
    }
    
    // Check if we need to progress to next beat
    const structure = await this.loadStoryStructure(storyId);
    const currentBeat = structure.story_beats.find(beat => beat.id === currentScenario.story_beat);
    
    if (currentBeat && this.checkBeatCompletion(currentBeat, playerProgress)) {
      // Find next beat
      const currentBeatIndex = structure.story_beats.findIndex(beat => beat.id === currentBeat.id);
      if (currentBeatIndex < structure.story_beats.length - 1) {
        const nextBeat = structure.story_beats[currentBeatIndex + 1];
        return nextBeat.scenarios[0]; // First scenario of next beat
      }
    }
    
    return null;
  }

  /**
   * Handle death and determine restart point
   */
  async handleDeath(
    storyId: string,
    scenarioId: string,
    playerProgress: PlayerProgress
  ): Promise<{
    restart_scenario: string;
    restart_beat: string;
    reset_progress: boolean;
  }> {
    const structure = await this.loadStoryStructure(storyId);
    const scenario = await this.loadScenario(storyId, scenarioId);
    
    if (structure.progression_rules.death_resets_to_beat_start) {
      // Reset to first scenario of current beat
      const currentBeat = structure.story_beats.find(beat => beat.id === scenario.story_beat);
      if (currentBeat && currentBeat.scenarios.length > 0) {
        return {
          restart_scenario: currentBeat.scenarios[0],
          restart_beat: currentBeat.id,
          reset_progress: true
        };
      }
    }
    
    // Default: restart current scenario
    return {
      restart_scenario: scenarioId,
      restart_beat: scenario.story_beat,
      reset_progress: false
    };
  }

  /**
   * Generate context for AI prompts based on scenario
   */
  async generateScenarioContext(
    storyId: string,
    scenarioId: string,
    playerProgress: PlayerProgress
  ): Promise<string> {
    const scenario = await this.loadScenario(storyId, scenarioId);
    const structure = await this.loadStoryStructure(storyId);
    
    return `CURRENT SCENARIO: ${scenario.name}
STORY BEAT: ${scenario.story_beat}
PLAYER STATE: ${scenario.setup.player_state}
ENVIRONMENT: ${scenario.setup.environment}
IMMEDIATE CHALLENGE: ${scenario.setup.immediate_challenge}

PRIMARY OBJECTIVE: ${scenario.objectives.primary}
SECONDARY OBJECTIVES: ${scenario.objectives.secondary.join(', ')}

SUCCESS CRITERIA: ${scenario.success_criteria.completion_trigger}
REQUIRED ACTIONS: ${scenario.success_criteria.required_actions.join(', ')}

DEATH TRIGGERS: ${scenario.failure_conditions.death_triggers.join(', ')}
WRONG APPROACHES: ${scenario.failure_conditions.wrong_approach.join(', ')}

AVAILABLE ACTIONS:
${scenario.available_actions.map(action => 
  `- ${action.action}: ${action.description}`
).join('\n')}

NARRATIVE GUIDANCE:
- Atmosphere: ${scenario.narrative_elements?.atmosphere || 'neutral'}
- Tension Level: ${scenario.narrative_elements?.tension_level || 'medium'}
- Pacing: ${scenario.narrative_elements?.pacing || 'steady'}

PLAYER PROGRESS:
- Current Beat: ${playerProgress.current_beat}
- Completed Scenarios: ${playerProgress.completed_scenarios.join(', ')}
- Death Count: ${playerProgress.death_count}
- Success Indicators Met: ${playerProgress.success_indicators_met.join(', ')}`;
  }
}