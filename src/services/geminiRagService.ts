import { StoryPromptService } from './storyPromptService';

export class GeminiRAGService {
  private ragService: StoryPromptService;
  private apiKey: string;
  private baseURL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

  constructor() {
    this.ragService = new StoryPromptService();
    this.apiKey = process.env.GOOGLE_GENAI_API_KEY || '';
  }

  /**
   * Generate story response with RAG enhancement
   * Uses the same Gemini API pattern as your iOS app
   */
  async generateStoryWithRAG(
    storyId: string,
    userMessage: string,
    conversationHistory: Array<{ role: string; content: string }> = [],
    actionType?: string,
    sessionId?: string,
    userId?: string
  ): Promise<{
    response: string;
    contextUsed: Array<{ content: string; metadata: any }>;
    sources: string[];
    inventoryChanges?: any;
  }> {
    try {
      // Get enhanced prompt with story context
      // For now, use a default location - this can be enhanced later to extract from context
      const defaultLocation = 'training_grounds';
      const { enhancedPrompt, contextUsed } = await this.ragService.generateEnhancedPrompt(
        storyId,
        userMessage,
        conversationHistory,
        actionType,
        userId,
        sessionId,
        defaultLocation
      );

      // Build conversation contents (same as iOS GeminiService)
      const contents: any[] = [];

      // Add conversation history
      for (const message of conversationHistory.slice(-10)) { // Limit history
        const role = message.role === 'user' ? 'user' : 'model';
        contents.push({
          role: role,
          parts: [{ text: message.content }]
        });
      }

      // Add current user message with enhanced context
      contents.push({
        role: 'user',
        parts: [{ text: enhancedPrompt }]
      });

      const requestBody = {
        contents: contents,
        generationConfig: {
          temperature: 0.85,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
          candidateCount: 1,
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              narrative: {
                type: 'string',
                description: 'The story continuation narration'
              },
              choices: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: {
                      type: 'string',
                      description: 'Unique identifier for the choice'
                    },
                    text: {
                      type: 'string',
                      description: 'The action text for the choice'
                    },
                    hint: {
                      type: 'string',
                      description: 'Optional hint about consequences'
                    }
                  },
                  required: ['id', 'text']
                },
                minItems: 2,
                maxItems: 5
              },
              context: {
                type: 'object',
                properties: {
                  location: { type: 'string' },
                  tension: { 
                    type: 'string',
                    enum: ['low', 'medium', 'high', 'critical']
                  },
                  momentum: {
                    type: 'string', 
                    enum: ['stalled', 'slow', 'steady', 'fast']
                  }
                }
              },
              inventory_changes: {
                type: 'object',
                properties: {
                  items_gained: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        description: { type: 'string' },
                        quantity: { type: 'number', default: 1 },
                        source: { type: 'string' },
                        rarity: { 
                          type: 'string', 
                          enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
                          default: 'common'
                        },
                        category: { type: 'string' },
                        magical: { type: 'boolean', default: false },
                        properties: { 
                          type: 'array', 
                          items: { type: 'string' }
                        }
                      },
                      required: ['id', 'name']
                    }
                  },
                  items_lost: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        quantity: { type: 'number', default: 1 },
                        reason: { type: 'string' }
                      },
                      required: ['id', 'name']
                    }
                  },
                  gold_change: { type: 'number', default: 0 }
                }
              }
            },
            required: ['narrative', 'choices']
          }
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
        ]
      };

      // Make API call to Gemini (same pattern as iOS)
      const response = await fetch(`${this.baseURL}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Gemini API error: ${response.status} - ${(errorData as any)?.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();

      if (!(data as any).candidates || !(data as any).candidates[0] || !(data as any).candidates[0].content) {
        throw new Error('No response content received from Gemini');
      }

      const generatedText = (data as any).candidates[0].content.parts[0]?.text || '';
      
      // Parse the JSON response
      let storyResponse;
      try {
        storyResponse = JSON.parse(generatedText);
      } catch (error) {
        throw new Error(`Failed to parse JSON response: ${error}`);
      }

      // Validate required fields
      if (!storyResponse.narrative || !storyResponse.choices || !Array.isArray(storyResponse.choices)) {
        throw new Error('Invalid response format: missing narrative or choices');
      }

      if (storyResponse.choices.length < 2 || storyResponse.choices.length > 5) {
        throw new Error(`Expected 2-5 choices, got ${storyResponse.choices.length}`);
      }

      const sources = contextUsed.map(ctx => 
        `${ctx.metadata.category}: ${ctx.metadata.name || ctx.metadata.title || ctx.metadata.id}`
      );

      console.log('✅ RAG-enhanced story generation completed successfully');

      // Removed story state tracking for sandbox approach

      return {
        response: storyResponse,
        contextUsed,
        sources,
        inventoryChanges: storyResponse.inventory_changes
      };

    } catch (error) {
      console.error('❌ Error in Gemini RAG story generation:', error);
      throw error;
    }
  }

  /**
   * Search story context (for debugging/testing)
   */
  async searchContext(storyId: string, query: string, maxResults: number = 5) {
    return await this.ragService.searchStoryContext(storyId, query, maxResults);
  }
}