import path from 'path';
import fs from 'fs/promises';
import { InventoryService } from './inventoryService';
import { WorldStateService } from './worldStateService';
// Removed complex story progression services for sandbox approach

const UNIFIED_SYSTEM_PROMPT = `You are an expert DUNGEON MASTER running a solo adventure. Your primary role is to:
1. ACKNOWLEDGE what the player does
2. DESCRIBE the immediate results
3. ADVANCE the story forward
4. MAINTAIN dramatic tension

CRITICAL DUNGEON MASTER RULES:
- ALWAYS start your response by describing the player's action: "You [their action]..."
- Show IMMEDIATE consequences of their action before anything else
- Keep the story MOVING FORWARD - never let it stagnate
- Make player choices MATTER - show how their actions change the world
- Create DRAMATIC MOMENTS that demand player decisions

PACING & PROGRESSION:
- If nothing significant happened for 2+ turns, introduce a complication
- When players explore aimlessly, have something find THEM
- Use environmental changes to force movement (doors closing, water rising, enemies approaching)
- Every 3-4 peaceful scenes, add tension or conflict
- Track "story momentum" - if it drops, inject drama

RESPONSE STRUCTURE:
1. "You [describe their exact action in detail]..."
2. Immediate sensory result (what changes, what they discover)
3. World's reaction (NPCs respond, environment shifts, consequences unfold)
4. Story progression (new challenge, revelation, or opportunity)
5. Generate contextually appropriate choices that push the story forward

CHARACTER & WORLD CONSISTENCY:
- Use provided context for accuracy
- Remember player's previous actions and choices
- Show how the world changes based on player decisions
- NPCs should have goals and react believably

CHOICE GENERATION RULES:
- Generate 2-5 choices based on situation (not always 4!)
- Choices should offer different narrative paths, not just different styles
- Include at least one choice that significantly advances the plot
- Add consequence hints: "Draw your sword (the guards will likely attack)"
- In tense moments, add time pressure: "The door is closing..."

DUNGEON MASTER INTERVENTIONS:
- If player is stuck: Provide environmental clues or NPC hints
- If story stalls: Introduce unexpected events
- If tension drops: Add time limits, pursuing enemies, or environmental dangers
- If player repeats actions: Show escalating consequences

DEATH & CONSEQUENCES:
- Player actions can lead to death through reckless behavior
- Death should be dramatic and educational - show why the action was fatal
- Always provide a clear restart option after death
- Resurrection/revival should acknowledge lessons learned from failure
- Use death as a teaching tool, not just punishment

INVENTORY & WORLD STATE INTEGRATION:
- Track item usage: When players use items, add them to "items_lost" with reason "used" or "consumed"
- Track item discovery: When players find NEW items, add them to "items_gained" with descriptive source
- Handle pickup from ground: When picking up existing items, use source "picked up", "from ground", "from floor"
- Handle item drops: When items are dropped/discarded, use reason "dropped", "placed on ground", "set down"
- Respect inventory limitations: Check if player has required items for actions
- World state awareness: Reference items on the ground when describing locations
- Item interactions: Allow creative use of available items in player inventory
- Logical sources: Use "found in chest", "discovered in ruins", "received from NPC", "crafted", etc. for new items
- Smart pickup language: Use phrases like "gathered from the floor", "picked up from the ground" for existing items

CONTENT GUIDELINES:
- Family-friendly adventure content
- Focus on exploration, mystery, and heroic challenges
- Redirect inappropriate requests narratively

JSON RESPONSE FORMAT:
{
  "narrative": "Your story continuation focusing on player action acknowledgment and consequences",
  "choices": [
    {
      "id": "choice_1",
      "text": "Contextually appropriate action",
      "hint": "Optional consequence hint"
    }
    // Generate 2-5 choices based on situation
  ],
  "context": {
    "location": "current location",
    "tension": "low/medium/high/critical",
    "momentum": "stalled/slow/steady/fast"
  },
  "inventory_changes": {
    "items_gained": [{"id": "item_id", "name": "name", "quantity": 1, "source": "how obtained"}],
    "items_lost": [{"id": "item_id", "name": "name", "quantity": 1, "reason": "how lost"}]
  }
}`;

// Helper function to provide context for action types
function getActionTypeContext(actionType: string): string {
  switch (actionType.toLowerCase()) {
    case 'dialogue':
      return `PLAYER ACTION: Speaking/Communicating
MANDATORY: Start with "You say..." or "You call out..." or "You ask..."
- Quote their exact words in dialogue
- Show NPC reactions immediately (facial expressions, body language)
- Create back-and-forth dialogue exchanges
- Advance plot through conversation revelations
- End with a moment requiring player response`;

    case 'decision':
      return `PLAYER ACTION: Taking Decisive Action
MANDATORY: Start with "You [their exact action]..."
- Describe their movement/action in vivid detail
- Show immediate environmental changes
- Create consequences that ripple outward
- Introduce new challenges from their boldness
- Generate choices that build on this momentum`;

    case 'exploration':
      return `PLAYER ACTION: Investigating/Examining
MANDATORY: Start with "You examine..." or "You search..." or "You study..."
- Describe their investigation method (touch, sight, tools)
- Reveal discoveries progressively (obvious → hidden → significant)
- Connect findings to larger mysteries
- Create "aha!" moments that advance understanding
- Lead to new questions or paths forward`;

    case 'combat':
      return `PLAYER ACTION: Combat/Conflict
MANDATORY: Start with "You swing..." or "You dodge..." or "You cast..."
- Describe the physicality of combat vividly
- Show immediate results (hit/miss/block)
- Enemy reactions and counterattacks
- Environmental combat factors
- Keep combat moving toward resolution`;

    case 'worldbuilding':
      return `NARRATIVE MOMENT: Environmental Storytelling
- Set the scene with rich sensory details
- Build atmosphere and tension
- Introduce new story elements naturally
- Even here, acknowledge any player action first
- Create moments that demand player attention`;

    case 'continue':
      return `STORY PROGRESSION: Time Passes
MANDATORY: Show change and progression
- Start with temporal transition: "Moments later..." or "As time passes..."
- Something NEW must happen (environment shifts, NPCs act, situations evolve)
- Introduce complications or opportunities
- Never just repeat the previous scene
- Force player engagement with new developments`;

    default:
      return 'PLAYER ACTION: Acknowledge their specific action and show its consequences.';
  }
}

export class StoryPromptService {
  // Simplified for sandbox approach - removed complex state tracking
  private inventoryService: InventoryService;
  private worldStateService: WorldStateService;
  
  constructor() {
    // Simplified constructor
    this.inventoryService = InventoryService.getInstance();
    this.worldStateService = new WorldStateService();
  }

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
    actionType?: string,
    userId?: string,
    sessionId?: string,
    locationId?: string
  ): Promise<{
    enhancedPrompt: string;
    contextUsed: Array<{ content: string; metadata: any }>;
    inventoryValidation?: {
      hasRequiredItems: boolean;
      missingItems: string[];
      availableItems: string[];
      suggestions: string[];
    };
  }> {
    const storyContext = await this.searchStoryContext(storyId, userQuery, 5);
    // Removed state tracker for sandbox approach

    const contextString = storyContext
      .map(ctx => `[${ctx.metadata.category}] ${ctx.content}`)
      .join('\n\n');

    // Enhanced conversation history with sliding window
    const conversationString = this.buildOptimalConversationHistory(conversationHistory);

    // Create action type context
    const actionTypeContext = actionType ? getActionTypeContext(actionType) : '';

    // Get inventory context and validation
    let inventoryContext = '';
    let inventoryValidation: {
      hasRequiredItems: boolean;
      missingItems: string[];
      availableItems: string[];
      suggestions: string[];
    } | undefined;
    
    // Get available item templates for this story
    const availableItems = this.inventoryService.getStoryItems(storyId);
    let availableItemsContext = '';
    if (availableItems.length > 0) {
      availableItemsContext = `\n\nAVAILABLE STORY ITEMS:\n`;
      availableItems.forEach(item => {
        availableItemsContext += `- ${item.id}: ${item.name} (${item.type}) - ${item.description}\n`;
      });
    }

    if (userId && sessionId) {
      console.log('🎒 Loading inventory context for user:', userId, 'session:', sessionId);
      try {
        // Check if inventory exists, if not initialize it
        let inventory = await this.inventoryService.getPlayerInventory(userId, sessionId);
        if (!inventory) {
          console.log('📦 Initializing new inventory for user:', userId, 'session:', sessionId);
          inventory = await this.inventoryService.initializeInventory(userId, sessionId, storyId);
          console.log('✅ Inventory initialized successfully');
        }
        
        // Get inventory summary for context
        const inventorySummary = await this.inventoryService.getInventorySummary(userId, sessionId);
        inventoryContext = `\n\nPLAYER INVENTORY:\n${inventorySummary}`;
        console.log('✅ Inventory summary loaded:', inventorySummary);

        // Validate inventory for action-related items
        const inventoryValidationResult = await this.validateInventoryForAction(userId, sessionId, userQuery);
        inventoryValidation = inventoryValidationResult;
        console.log('🔍 Inventory validation result:', inventoryValidationResult);

        // Add inventory validation to context if there are issues
        if (!inventoryValidationResult.hasRequiredItems) {
          inventoryContext += `\n\nINVENTORY VALIDATION:\n`;
          inventoryContext += `Missing Items: ${inventoryValidationResult.missingItems.join(', ')}\n`;
          inventoryContext += `Available Items: ${inventoryValidationResult.availableItems.join(', ')}\n`;
          inventoryContext += `Suggestions: ${inventoryValidationResult.suggestions.join('; ')}\n`;
          console.log('❌ Player is missing required items:', inventoryValidationResult.missingItems);
        }
      } catch (error) {
        console.error('❌ Error getting inventory context:', error);
        inventoryContext = '\n\nINVENTORY: Unable to load inventory';
      }
    } else {
      console.log('⚠️ No userId or sessionId provided - skipping inventory validation');
    }

    // Get world state context (items on the ground)
    let worldStateContext = '';
    if (locationId) {
      try {
        console.log('🌍 Loading world state for location:', locationId, 'story:', storyId);
        const worldStateSummary = await this.worldStateService.getLocationItemsSummary(storyId, locationId);
        worldStateContext = `\n\n${worldStateSummary}`;
        console.log('✅ World state summary loaded:', worldStateSummary);
      } catch (error) {
        console.error('❌ Error getting world state context:', error);
        worldStateContext = '\n\nWORLD ITEMS: Unable to load world state';
      }
    } else {
      console.log('⚠️ No locationId provided - skipping world state context');
    }

    // Build enhanced prompt with all context
    const enhancedPrompt = `PLAYER ACTION: "${userQuery}"

${UNIFIED_SYSTEM_PROMPT}

${actionTypeContext ? `\nACTION TYPE GUIDANCE:\n${actionTypeContext}\n` : ''}

STORY CONTEXT:
${contextString}

RECENT EVENTS:
${conversationString}${inventoryContext}${worldStateContext}${availableItemsContext}

Start with "You [action]..." then show consequences and advance story.`;

    return {
      enhancedPrompt: enhancedPrompt.trim(),
      contextUsed: storyContext.map(ctx => ({
        content: ctx.content,
        metadata: ctx.metadata
      })),
      inventoryValidation
    };
  }

  /**
   * Build optimal conversation history with sliding window and importance scoring
   */
  private buildOptimalConversationHistory(history: Array<{ role: string; content: string }>): string {
    if (history.length === 0) return '';

    // Score messages by importance
    const scoredMessages = history.map((msg, index) => {
      let score = 0;
      const content = msg.content.toLowerCase();
      
      // Recent messages are more important
      score += Math.max(0, 10 - (history.length - index));
      
      // Important content gets higher scores
      if (content.includes('discover') || content.includes('reveal') || content.includes('find')) score += 5;
      if (content.includes('character') || content.includes('npc')) score += 3;
      if (content.includes('item') || content.includes('weapon') || content.includes('treasure')) score += 3;
      if (content.includes('location') || content.includes('room') || content.includes('area')) score += 2;
      if (content.includes('combat') || content.includes('attack') || content.includes('fight')) score += 4;
      if (content.includes('dialogue') || content.includes('conversation')) score += 2;
      
      // Penalize repetitive content
      if (content.includes('look around') || content.includes('examine')) score -= 1;
      
      return { ...msg, score, index };
    });

    // Sort by score and take top messages, ensuring we keep recent context
    const recentMessages = scoredMessages.slice(-6); // Always keep last 6 messages
    const importantMessages = scoredMessages
      .filter(msg => msg.score >= 5 && !recentMessages.includes(msg))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4); // Up to 4 additional important messages

    // Combine and sort by original order
    const selectedMessages = [...importantMessages, ...recentMessages]
      .sort((a, b) => a.index - b.index)
      .map(msg => ({ role: msg.role, content: msg.content }));

    return selectedMessages
      .map(msg => `${msg.role === 'user' ? 'Player' : 'Narrator'}: ${msg.content}`)
      .join('\n');
  }

  /**
   * Validate inventory for player action
   */
  private async validateInventoryForAction(userId: string, sessionId: string, userQuery: string): Promise<{
    hasRequiredItems: boolean;
    missingItems: string[];
    availableItems: string[];
    suggestions: string[];
  }> {
    try {
      const queryLower = userQuery.toLowerCase();
      
      // Common item keywords and their alternatives
      const itemKeywords = {
        'sword': ['weapon', 'blade', 'dagger', 'knife'],
        'axe': ['weapon', 'hatchet', 'tomahawk'],
        'bow': ['weapon', 'crossbow', 'ranged'],
        'arrow': ['projectile', 'bolt', 'ammunition'],
        'shield': ['armor', 'protection', 'guard'],
        'potion': ['consumable', 'elixir', 'flask', 'bottle'],
        'rope': ['tool', 'cord', 'string'],
        'torch': ['light', 'lantern', 'fire'],
        'key': ['tool', 'opener'],
        'map': ['navigation', 'chart', 'guide'],
        'book': ['tome', 'scroll', 'text'],
        'coin': ['gold', 'money', 'currency'],
        'gem': ['jewel', 'treasure', 'stone'],
        'food': ['ration', 'bread', 'meal'],
        'water': ['drink', 'beverage', 'flask']
      };

      // Extract potential item references from user query
      const referencedItems: string[] = [];
      const missingItems: string[] = [];
      
      // Check for explicit item mentions
      for (const [item, alternatives] of Object.entries(itemKeywords)) {
        const itemPattern = new RegExp(`\\b(${item}|${alternatives.join('|')})\\b`, 'i');
        if (itemPattern.test(queryLower)) {
          referencedItems.push(item);
          
          // Check if player has this item or alternatives
          const hasItem = await this.inventoryService.hasItem(userId, sessionId, item);
          if (!hasItem) {
            // Check for alternatives
            let hasAlternative = false;
            for (const alt of alternatives) {
              if (await this.inventoryService.hasItem(userId, sessionId, alt)) {
                hasAlternative = true;
                break;
              }
            }
            if (!hasAlternative) {
              missingItems.push(item);
            }
          }
        }
      }

      // Check for action-based item requirements
      const actionItemMap = {
        'attack': ['weapon', 'sword', 'axe', 'bow'],
        'throw': ['weapon', 'stone', 'dagger', 'axe'],
        'shoot': ['bow', 'crossbow', 'arrow'],
        'cut': ['sword', 'knife', 'axe'],
        'light': ['torch', 'lantern', 'fire'],
        'climb': ['rope', 'grappling hook'],
        'unlock': ['key', 'lockpick'],
        'heal': ['potion', 'bandage', 'herb'],
        'read': ['book', 'scroll', 'map'],
        'drink': ['potion', 'water', 'flask'],
        'eat': ['food', 'ration', 'fruit']
      };

      for (const [action, items] of Object.entries(actionItemMap)) {
        if (queryLower.includes(action)) {
          let hasRequiredItem = false;
          for (const item of items) {
            if (await this.inventoryService.hasItem(userId, sessionId, item)) {
              hasRequiredItem = true;
              break;
            }
          }
          if (!hasRequiredItem) {
            missingItems.push(...items.slice(0, 2)); // Add first 2 alternatives
          }
        }
      }

      // Get available items for suggestions
      const availableItems = await this.inventoryService.findItems(userId, sessionId, '');
      const availableItemNames = availableItems.map(item => item.name);

      // Generate suggestions based on available items
      const suggestions: string[] = [];
      if (missingItems.length > 0 && availableItemNames.length > 0) {
        suggestions.push(`You don't have ${missingItems.join(' or ')}, but you could try using your ${availableItemNames.slice(0, 3).join(', ')}`);
        
        // Suggest specific alternatives
        const weaponItems = availableItems.filter(item => item.type === 'weapon');
        if (weaponItems.length > 0 && missingItems.some(item => ['sword', 'axe', 'weapon'].includes(item))) {
          suggestions.push(`Use your ${weaponItems[0].name} instead`);
        }
        
        const toolItems = availableItems.filter(item => item.type === 'tool');
        if (toolItems.length > 0 && missingItems.some(item => ['rope', 'torch', 'key'].includes(item))) {
          suggestions.push(`Try using your ${toolItems[0].name}`);
        }
      }

      return {
        hasRequiredItems: missingItems.length === 0,
        missingItems: [...new Set(missingItems)],
        availableItems: availableItemNames,
        suggestions
      };

    } catch (error) {
      console.error('Error validating inventory for action:', error);
      return {
        hasRequiredItems: true, // Assume success if validation fails
        missingItems: [],
        availableItems: [],
        suggestions: []
      };
    }
  }

  // Removed story state tracking methods for sandbox approach

  // Removed complex scenario progression methods for sandbox approach
  // The main generateEnhancedPrompt method remains to support RAG functionality
}