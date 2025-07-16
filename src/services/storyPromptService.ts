import path from 'path';
import fs from 'fs/promises';

const UNIFIED_SYSTEM_PROMPT = `You are a master interactive storyteller and dungeon master with deep expertise in creating immersive fantasy adventures. You excel at improvisation, world-building, and guiding players through compelling narratives while respecting their agency and choices.

CRITICAL: Always acknowledge and describe the player's specific action first, then show its immediate effects and consequences.

Your storytelling approach:
- ALWAYS start by describing what the player does and how they do it
- Show the immediate sensory results of their action (what they see, hear, feel, discover)
- Create vivid, sensory-rich descriptions that bring scenes to life
- Develop meaningful consequences for player actions and choices
- Maintain narrative tension and pacing appropriate to the moment
- Use the provided story context to ensure perfect consistency with established characters, locations, lore, and relationships
- Adapt your tone and style to match the specific story world's atmosphere
- Keep responses engaging but concise (2-6 sentences for narration, longer for dialogue scenes)
- Ensure your writing is at a 9th grade reading level

Player Action Response Framework:
1. Acknowledge the player's action: "You examine the ancient door..." / "You call out into the darkness..." / "You step forward boldly..."
2. Describe the immediate effect: What happens as a direct result of their action
3. Reveal consequences: How the world responds to their action
4. Advance the narrative: Set up the next moment based on what just occurred

Character and world consistency:
- Reference specific details from the story context when relevant
- Stay true to established character personalities, motivations, and relationships  
- Honor the story world's rules, magic systems, and internal logic
- Build upon previous events and player decisions to create narrative continuity

Engagement principles:
- Make every player choice feel impactful and consequential
- Create moments of wonder, tension, discovery, and emotional resonance
- Encourage creative problem-solving and roleplay
- Balance challenge with player agency

CONTENT MODERATION GUIDELINES:
- Never generate graphic violence, torture, or excessive gore
- Avoid sexual content, explicit material, or romantic situations with minors
- Do not provide instructions for illegal activities, even in fantasy context
- Refuse requests for self-harm, substance abuse, or dangerous activities
- Keep conflict age-appropriate - focus on adventure, not trauma
- If a request seems inappropriate, redirect to appropriate fantasy alternatives
- When in doubt, err on the side of caution and keep content family-friendly
- For inappropriate requests, respond with narrative explaining you cannot continue in that direction

You must respond with a JSON object containing:
1. "narrative" - Your story continuation (2-6 sentences)
2. "choices" - Array of exactly 4 choice objects with balanced options for different play styles
3. "context" - Optional metadata (location, mood, danger_level)

Each choice object must have:
- "id" - unique identifier (choice_1, choice_2, choice_3, custom)
- "text" - the action text (3-6 words, first person)

Always provide exactly 3 balanced choices plus 1 custom option:
1. INVESTIGATE/EXAMINE (choice_1) - For cautious players who want to observe, analyze, search, or study
   Example: "Examine the strange symbols"
2. ACT/COMMIT (choice_2) - For decisive players who want to take direct action, enter, attack, or move boldly
   Example: "Enter the dark cave"
3. COMMUNICATE/PROBE (choice_3) - For social/curious players who want to talk, ask, call out, or interact
   Example: "Call out to anyone inside"
4. CUSTOM (custom) - Always "Write your own action"

Ensure each choice fits the current situation while maintaining these three distinct approaches.`;

// Helper function to provide context for action types
function getActionTypeContext(actionType: string): string {
  switch (actionType.toLowerCase()) {
    case 'dialogue':
      return 'The player intends to COMMUNICATE - talk, ask questions, call out, or interact socially. START with "You speak..." or "You call out..." or "You ask..." then describe what they say and how they say it. Show immediate reactions from NPCs, changes in their expressions, body language, and verbal responses. Include dialogue exchanges, emotional reactions, and social consequences.';
    
    case 'decision':
      return 'The player intends to take DECISIVE ACTION - move boldly, enter new areas, commit to a path, or make important choices. START with "You decide to..." or "You move..." or "You step..." then describe their bold action in detail. Show immediate physical consequences, environmental changes, and how the world responds to their decisive movement or choice.';
    
    case 'exploration':
      return 'The player intends to INVESTIGATE - examine carefully, search for clues, observe surroundings, or study objects. START with "You examine..." or "You look closely..." or "You search..." then describe what they do with their hands, eyes, or tools. Reveal specific details they discover, hidden information, environmental clues, and sensory observations as direct results of their investigation.';
    
    case 'combat':
      return 'The player intends to engage in COMBAT - attack, defend, cast offensive spells, or use tactical maneuvers. START with "You attack..." or "You defend..." or "You cast..." then describe their combat action in vivid detail. Show the immediate physical results - did they hit, miss, block? How did enemies react? What changed in the battle situation?';
    
    case 'inventory':
      return 'The player intends to manage ITEMS - take, use, equip, combine, or interact with objects. START with "You take..." or "You use..." or "You equip..." then describe the physical action of handling the item. Show what happens when they interact with it - does it activate, change, reveal something? How does it affect their immediate situation?';
    
    case 'character':
      return 'The player is checking CHARACTER STATUS - reviewing abilities, stats, or personal information. START with "You take a moment to..." or "You assess..." then weave character information naturally into the narrative. Show how this self-reflection affects their understanding of the current situation.';
    
    case 'worldbuilding':
      return 'This is a NARRATIVE MOMENT - setting scenes, describing environments, or establishing atmosphere. Focus on immersive world-building, sensory details, and creating a strong sense of place and mood. Even here, if the player took an action, acknowledge it first.';
    
    default:
      return '';
  }
}

export class StoryPromptService {
  /**
   * Load and combine story content for a specific story into documents for RAG
   */
  async loadStoryContent(storyId: string): Promise<Array<{ content: string; metadata: any }>> {
    const storyDataDir = path.join(__dirname, '../../data/stories', storyId);
    const documents: Array<{ content: string; metadata: any }> = [];

    try {
      // Load characters
      const charactersPath = path.join(storyDataDir, 'characters.json');
      const charactersData = JSON.parse(await fs.readFile(charactersPath, 'utf-8'));

      for (const character of charactersData.characters) {
        documents.push({
          content: `Character: ${character.name}
Type: ${character.type}
Description: ${character.description}
Personality: ${character.personality}
Abilities: ${character.abilities.join(', ')}
Location: ${character.location}
Dialogue Style: ${character.dialogue_style}
Story Role: ${character.story_role}
${character.backstory ? `Backstory: ${character.backstory}` : ''}
Relationships: ${Object.entries(character.relationships || {})
              .map(([key, value]) => `${key}: ${value}`)
              .join('; ')}`,
          metadata: {
            type: 'character',
            id: character.id,
            name: character.name,
            category: 'characters'
          }
        });
      }

      // Load locations
      const locationsPath = path.join(storyDataDir, 'locations.json');
      const locationsData = JSON.parse(await fs.readFile(locationsPath, 'utf-8'));

      for (const location of locationsData.locations) {
        documents.push({
          content: `Location: ${location.name}
Type: ${location.type}
Description: ${location.description}
Atmosphere: ${location.atmosphere}
Notable Features: ${location.notable_features.join('; ')}
Inhabitants: ${location.inhabitants.join(', ')}
Danger Level: ${location.dangers}
Story Significance: ${location.story_significance}
Connections: ${Object.entries(location.connections || {})
              .map(([key, value]) => `${key}: ${value}`)
              .join('; ')}`,
          metadata: {
            type: 'location',
            id: location.id,
            name: location.name,
            category: 'locations'
          }
        });
      }

      // Load story beats (optional - not all stories may have this)
      try {
        const storyBeatsPath = path.join(storyDataDir, 'story_beats.json');
        const storyBeatsData = JSON.parse(await fs.readFile(storyBeatsPath, 'utf-8'));

        for (const beat of storyBeatsData.story_beats) {
          let content = `Story Beat: ${beat.name}
Type: ${beat.type}
Description: ${beat.description}
Story Significance: ${beat.story_significance}`;

          if (beat.choices) {
            content += `\nChoices Available: ${beat.choices
              .map((choice: any) => `${choice.option} -> ${choice.consequences}`)
              .join('; ')}`;
          }

          if (beat.key_information_revealed) {
            content += `\nKey Information: ${beat.key_information_revealed.join('; ')}`;
          }

          documents.push({
            content,
            metadata: {
              type: 'story_beat',
              id: beat.id,
              name: beat.name,
              category: 'story_beats'
            }
          });
        }
      } catch (error) {
        console.log(`ℹ️ No story beats file found for ${storyId} (optional)`);
      }

      // Load lore (optional - not all stories may have this)
      try {
        const lorePath = path.join(storyDataDir, 'lore.json');
        const loreData = JSON.parse(await fs.readFile(lorePath, 'utf-8'));

        for (const loreEntry of loreData.lore) {
          documents.push({
            content: `Lore: ${loreEntry.title}
Category: ${loreEntry.category}
Content: ${loreEntry.content}`,
            metadata: {
              type: 'lore',
              id: loreEntry.id,
              title: loreEntry.title,
              category: loreEntry.category
            }
          });
        }
      } catch (error) {
        console.log(`ℹ️ No lore file found for ${storyId} (optional)`);
      }

      console.log(`✅ Loaded ${documents.length} story documents for RAG from ${storyId}`);
      return documents;

    } catch (error) {
      console.error(`❌ Error loading story content for ${storyId}:`, error);
      return [];
    }
  }

  /**
   * Search story content for relevant context
   */
  async searchStoryContext(storyId: string, query: string, maxResults: number = 5): Promise<Array<{
    content: string;
    relevanceScore: number;
    metadata: any;
  }>> {
    try {
      const documents = await this.loadStoryContent(storyId);

      const queryLower = query.toLowerCase();
      const scoredResults = documents
        .map(doc => {
          const contentLower = doc.content.toLowerCase();
          let score = 0;

          // Simple scoring based on keyword matches
          const queryWords = queryLower.split(' ').filter(word => word.length > 2);
          for (const word of queryWords) {
            const matches = (contentLower.match(new RegExp(word, 'g')) || []).length;
            score += matches;
          }

          return {
            content: doc.content,
            relevanceScore: score,
            metadata: doc.metadata
          };
        })
        .filter(result => result.relevanceScore > 0)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, maxResults);

      console.log(`🔍 Found ${scoredResults.length} relevant story documents for query: "${query}" in ${storyId}`);
      return scoredResults;

    } catch (error) {
      console.error(`❌ Error searching story context for ${storyId}:`, error);
      return [];
    }
  }

  /**
   * Generate enhanced prompt with story context
   */
  async generateEnhancedPrompt(
    storyId: string,
    userQuery: string,
    conversationHistory: Array<{ role: string; content: string }> = [],
    actionType?: string
  ): Promise<{
    enhancedPrompt: string;
    contextUsed: Array<{ content: string; metadata: any }>;
  }> {
    const storyContext = await this.searchStoryContext(storyId, userQuery, 5);

    const contextString = storyContext
      .map(ctx => `[${ctx.metadata.category}] ${ctx.content}`)
      .join('\n\n');

    const conversationString = conversationHistory
      .map(msg => `${msg.role === 'user' ? 'Player' : 'Narrator'}: ${msg.content}`)
      .join('\n');

    // Create action type context
    const actionTypeContext = actionType ? getActionTypeContext(actionType) : '';

    const enhancedPrompt = `${UNIFIED_SYSTEM_PROMPT}

STORY CONTEXT (Use this information to create accurate, consistent responses):
${contextString}

CONVERSATION HISTORY:
${conversationString}

CURRENT PLAYER ACTION: ${userQuery}${actionTypeContext ? `\nACTION TYPE: ${actionTypeContext}` : ''}

CRITICAL INSTRUCTIONS:
- MANDATORY: Begin your narrative response by acknowledging and describing the player's specific action
- Show exactly what the player does and how they do it
- Describe the immediate sensory results of their action (what they see, hear, feel, discover)
- Then show how the world and characters respond to their action
- Use the provided story context to ensure consistency with established characters, locations, and lore
- Reference specific details from the context when relevant
- Maintain the established tone and atmosphere of this story setting
- Create meaningful choices that advance the narrative based on what just happened
- Stay true to character personalities and relationships as described in the context

RESPONSE FORMAT EXAMPLE:
"You [describe their action]. [Immediate sensory results]. [How the world responds]. [Advance the narrative]."

Respond as the story narrator:`;

    return {
      enhancedPrompt: enhancedPrompt.trim(),
      contextUsed: storyContext.map(ctx => ({
        content: ctx.content,
        metadata: ctx.metadata
      }))
    };
  }
}