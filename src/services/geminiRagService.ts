import { SimpleRAGService } from './simpleRagService';

export class GeminiRAGService {
  private ragService: SimpleRAGService;
  private apiKey: string;
  private baseURL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

  constructor() {
    this.ragService = new SimpleRAGService();
    this.apiKey = process.env.GOOGLE_GENAI_API_KEY || '';
  }

  /**
   * Generate story response with RAG enhancement using streaming
   * Uses streaming for faster response times
   */
  async generateStoryWithRAGStream(
    storyId: string,
    userMessage: string,
    conversationHistory: Array<{ role: string; content: string }> = [],
    actionType?: string
  ): Promise<{
    stream: ReadableStream<Uint8Array>;
    contextUsed: Array<{ content: string; metadata: any }>;
    sources: string[];
  }> {
    try {
      // Get enhanced prompt with story context
      const { enhancedPrompt, contextUsed } = await this.ragService.generateEnhancedPrompt(
        storyId,
        userMessage,
        conversationHistory,
        actionType
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
                    }
                  },
                  required: ['id', 'text']
                },
                minItems: 4,
                maxItems: 4
              },
              context: {
                type: 'object',
                properties: {
                  location: { type: 'string' },
                  mood: { type: 'string' },
                  danger_level: { type: 'string' }
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

      // Make API call to Gemini with streaming
      const streamingURL = this.baseURL.replace(':generateContent', ':streamGenerateContent');
      const response = await fetch(`${streamingURL}?key=${this.apiKey}`, {
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

      if (!response.body) {
        throw new Error('No response body received from Gemini streaming API');
      }

      const sources = contextUsed.map(ctx => 
        `${ctx.metadata.category}: ${ctx.metadata.name || ctx.metadata.title || ctx.metadata.id}`
      );

      // Create a transform stream to process the Gemini streaming response
      const transformStream = new TransformStream({
        transform(chunk, controller) {
          // Process streaming JSON chunks from Gemini API
          const decoder = new TextDecoder();
          const text = decoder.decode(chunk);
          
          // Handle Gemini's streaming format
          const lines = text.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            try {
              // Parse the JSON response from Gemini
              const data = JSON.parse(line);
              
              if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                const content = data.candidates[0].content.parts[0]?.text;
                if (content) {
                  // Forward the raw JSON content for incremental parsing
                  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({
                    type: 'content',
                    content: content
                  })}\n\n`));
                }
              }
            } catch (error) {
              // Try parsing as individual chunks if full JSON parsing fails
              if (line.trim()) {
                // Forward raw content for accumulation
                controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({
                  type: 'content',
                  content: line
                })}\n\n`));
              }
            }
          }
        }
      });

      console.log('✅ RAG-enhanced streaming started successfully');

      return {
        stream: response.body.pipeThrough(transformStream),
        contextUsed,
        sources
      };

    } catch (error) {
      console.error('❌ Error in Gemini RAG streaming:', error);
      throw error;
    }
  }

  /**
   * Generate story response with RAG enhancement (non-streaming fallback)
   * Uses the same Gemini API pattern as your iOS app
   */
  async generateStoryWithRAG(
    storyId: string,
    userMessage: string,
    conversationHistory: Array<{ role: string; content: string }> = [],
    actionType?: string
  ): Promise<{
    response: string;
    contextUsed: Array<{ content: string; metadata: any }>;
    sources: string[];
  }> {
    try {
      // Get enhanced prompt with story context
      const { enhancedPrompt, contextUsed } = await this.ragService.generateEnhancedPrompt(
        storyId,
        userMessage,
        conversationHistory,
        actionType
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
                    }
                  },
                  required: ['id', 'text']
                },
                minItems: 4,
                maxItems: 4
              },
              context: {
                type: 'object',
                properties: {
                  location: { type: 'string' },
                  mood: { type: 'string' },
                  danger_level: { type: 'string' }
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

      // Make API call to Gemini (non-streaming)
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

      if (storyResponse.choices.length !== 4) {
        throw new Error(`Expected exactly 4 choices, got ${storyResponse.choices.length}`);
      }

      const sources = contextUsed.map(ctx => 
        `${ctx.metadata.category}: ${ctx.metadata.name || ctx.metadata.title || ctx.metadata.id}`
      );

      console.log('✅ RAG-enhanced story generation completed successfully');

      return {
        response: storyResponse,
        contextUsed,
        sources
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