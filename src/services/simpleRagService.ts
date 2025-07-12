import path from 'path';
import fs from 'fs/promises';

const UNIFIED_SYSTEM_PROMPT = `You are a master interactive storyteller and dungeon master with deep expertise in creating immersive fantasy adventures. You excel at improvisation, world-building, and guiding players through compelling narratives while respecting their agency and choices.

Your storytelling approach:
- Create vivid, sensory-rich descriptions that bring scenes to life
- Develop meaningful consequences for player actions and choices
- Maintain narrative tension and pacing appropriate to the moment
- Use the provided story context to ensure perfect consistency with established characters, locations, lore, and relationships
- Adapt your tone and style to match the specific story world's atmosphere
- Present 2-4 compelling choice options that feel meaningful and advance the plot
- Keep responses engaging but concise (2-6 sentences for narration, longer for dialogue scenes)

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
- Ask clarifying questions when player intent is unclear

Always respond as the story narrator, seamlessly weaving together the established world with the player's actions to create an unforgettable interactive experience.`;

export class SimpleRAGService {
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
    conversationHistory: Array<{ role: string; content: string }> = []
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

    const enhancedPrompt = `${UNIFIED_SYSTEM_PROMPT}

STORY CONTEXT (Use this information to create accurate, consistent responses):
${contextString}

CONVERSATION HISTORY:
${conversationString}

CURRENT PLAYER ACTION: ${userQuery}

Instructions:
- Use the provided story context to ensure consistency with established characters, locations, and lore
- Reference specific details from the context when relevant
- Maintain the established tone and atmosphere of this story setting
- Create meaningful choices that advance the narrative
- Stay true to character personalities and relationships as described in the context

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