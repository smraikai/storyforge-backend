import { getDatabase } from '../config/database';
import { GeminiRAGService } from './geminiRagService';

export interface StorySession {
  id: string;
  user_id: string;
  story_id: string;
  session_name: string | null;
  status: 'active' | 'completed' | 'abandoned';
  story_summary: string | null;
  key_events: any[];
  character_relationships: any;
  total_messages: number;
  last_message_at: Date;
  started_at: Date;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface SessionMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: any;
  message_order: number;
  created_at: Date;
}

export interface SessionSummary {
  summary: string;
  keyEvents: string[];
  characterRelationships: { [key: string]: string };
  lastScene: string;
}

export class StorySessionService {
  private geminiRAG = new GeminiRAGService();

  async createSession(userId: string, storyId: string, sessionName?: string): Promise<StorySession> {
    const db = getDatabase();
    
    const result = await db.query(
      `INSERT INTO story_sessions (user_id, story_id, session_name, status) 
       VALUES ($1, $2, $3, 'active') 
       RETURNING *`,
      [userId, storyId, sessionName || null]
    );

    return result.rows[0];
  }

  async getUserSessions(userId: string): Promise<StorySession[]> {
    const db = getDatabase();
    
    const result = await db.query(
      `SELECT * FROM story_sessions 
       WHERE user_id = $1 
       ORDER BY last_message_at DESC`,
      [userId]
    );

    return result.rows;
  }

  async getSession(sessionId: string, userId: string): Promise<StorySession | null> {
    const db = getDatabase();
    
    const result = await db.query(
      'SELECT * FROM story_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );

    return result.rows[0] || null;
  }

  async getSessionMessages(sessionId: string, userId: string): Promise<SessionMessage[]> {
    const db = getDatabase();
    
    // Verify user owns this session
    const session = await this.getSession(sessionId, userId);
    if (!session) {
      throw new Error('Session not found or access denied');
    }

    const result = await db.query(
      `SELECT * FROM session_messages 
       WHERE session_id = $1 
       ORDER BY message_order ASC`,
      [sessionId]
    );

    return result.rows;
  }

  async addMessage(
    sessionId: string, 
    userId: string, 
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata: any = {}
  ): Promise<SessionMessage> {
    const db = getDatabase();
    
    // Verify user owns this session
    const session = await this.getSession(sessionId, userId);
    if (!session) {
      throw new Error('Session not found or access denied');
    }

    // Get next message order
    const orderResult = await db.query(
      'SELECT COALESCE(MAX(message_order), 0) + 1 as next_order FROM session_messages WHERE session_id = $1',
      [sessionId]
    );
    const messageOrder = orderResult.rows[0].next_order;

    // Add message
    const messageResult = await db.query(
      `INSERT INTO session_messages (session_id, role, content, metadata, message_order) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [sessionId, role, content, JSON.stringify(metadata), messageOrder]
    );

    // Update session last_message_at and total_messages
    await db.query(
      `UPDATE story_sessions 
       SET last_message_at = CURRENT_TIMESTAMP, 
           total_messages = total_messages + 1 
       WHERE id = $1`,
      [sessionId]
    );

    return messageResult.rows[0];
  }

  async generateSessionSummary(sessionId: string, userId: string): Promise<SessionSummary> {
    const db = getDatabase();
    
    // Get session and messages
    const session = await this.getSession(sessionId, userId);
    if (!session) {
      throw new Error('Session not found or access denied');
    }

    const messages = await this.getSessionMessages(sessionId, userId);
    
    // Build conversation history for AI summarization
    const conversationText = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => `${msg.role === 'user' ? 'Player' : 'Narrator'}: ${msg.content}`)
      .join('\n\n');

    // Generate AI summary
    const summaryPrompt = `Please create a detailed but concise summary of this D&D/story session. Focus on:
1. Key story beats and plot developments
2. Important character interactions and relationships
3. Major decisions made by the player
4. Current situation/location
5. Unresolved plot threads

Format as JSON with these fields:
- summary: Overall narrative summary (2-3 paragraphs)
- keyEvents: Array of 5-7 most important events
- characterRelationships: Object mapping character names to relationship status
- lastScene: Description of where the story left off

Conversation:
${conversationText}`;

    try {
      const aiResponse = await this.geminiRAG.generateStoryWithRAG(
        session.story_id,
        summaryPrompt,
        []
      );

      // Parse AI response as JSON
      const summaryData = JSON.parse(aiResponse.response);
      
      // Save summary to database
      await db.query(
        `UPDATE story_sessions 
         SET story_summary = $1, 
             key_events = $2, 
             character_relationships = $3 
         WHERE id = $4`,
        [
          summaryData.summary,
          JSON.stringify(summaryData.keyEvents),
          JSON.stringify(summaryData.characterRelationships),
          sessionId
        ]
      );

      return {
        summary: summaryData.summary,
        keyEvents: summaryData.keyEvents,
        characterRelationships: summaryData.characterRelationships,
        lastScene: summaryData.lastScene
      };

    } catch (error) {
      console.error('Error generating session summary:', error);
      
      // Fallback manual summary
      const fallbackSummary = {
        summary: `Session with ${messages.length} messages in ${session.story_id}. Last active: ${session.last_message_at}`,
        keyEvents: ['Session started', 'Story in progress'],
        characterRelationships: {},
        lastScene: 'Story in progress...'
      };

      return fallbackSummary;
    }
  }

  async updateSessionStatus(
    sessionId: string, 
    userId: string, 
    status: 'active' | 'completed' | 'abandoned'
  ): Promise<void> {
    const db = getDatabase();
    
    const completedAt = status === 'completed' ? 'CURRENT_TIMESTAMP' : 'NULL';
    
    await db.query(
      `UPDATE story_sessions 
       SET status = $1, completed_at = ${completedAt}
       WHERE id = $2 AND user_id = $3`,
      [status, sessionId, userId]
    );
  }

  async deleteSession(sessionId: string, userId: string): Promise<void> {
    const db = getDatabase();
    
    // This will cascade delete all messages due to foreign key constraint
    await db.query(
      'DELETE FROM story_sessions WHERE id = $1 AND user_id = $2',
      [sessionId, userId]
    );
  }

  async restartSession(sessionId: string, userId: string): Promise<StorySession> {
    const db = getDatabase();
    
    // Verify user owns this session
    const session = await this.getSession(sessionId, userId);
    if (!session) {
      throw new Error('Session not found or access denied');
    }

    // Delete all messages in this session
    await db.query(
      'DELETE FROM session_messages WHERE session_id = $1',
      [sessionId]
    );

    // Reset session state
    const result = await db.query(
      `UPDATE story_sessions 
       SET status = 'active',
           story_summary = NULL,
           key_events = '[]'::json,
           character_relationships = '{}'::json,
           total_messages = 0,
           last_message_at = CURRENT_TIMESTAMP,
           started_at = CURRENT_TIMESTAMP,
           completed_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [sessionId, userId]
    );

    // Add restart notification message
    await this.addMessage(
      sessionId,
      userId,
      'system',
      'Story has been restarted. You have learned from your previous experience.',
      { restart: true, timestamp: new Date().toISOString() }
    );

    return result.rows[0];
  }
}