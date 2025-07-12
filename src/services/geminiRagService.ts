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
   * Generate story response with RAG enhancement
   * Uses the same Gemini API pattern as your iOS app
   */
  async generateStoryWithRAG(
    storyId: string,
    systemPrompt: string,
    userMessage: string,
    conversationHistory: Array<{ role: string; content: string }> = []
  ): Promise<{
    response: string;
    contextUsed: Array<{ content: string; metadata: any }>;
    sources: string[];
  }> {
    try {
      // Get enhanced prompt with story context
      const { enhancedPrompt, contextUsed } = await this.ragService.generateEnhancedPrompt(
        storyId,
        systemPrompt,
        userMessage,
        conversationHistory
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
          responseMimeType: 'text/plain'
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
      const sources = contextUsed.map(ctx => 
        `${ctx.metadata.category}: ${ctx.metadata.name || ctx.metadata.title || ctx.metadata.id}`
      );

      console.log('✅ RAG-enhanced story generation completed successfully');

      return {
        response: generatedText,
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