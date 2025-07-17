import { Router } from 'express';
import { GeminiRAGService } from '../services/geminiRagService';
import { StoryDiscoveryService } from '../services/storyDiscoveryService';
import admin from '../config/firebase';

const router = Router();
const geminiRAG = new GeminiRAGService();
const storyDiscovery = new StoryDiscoveryService();

// RAG-enhanced story generation using direct Gemini API
router.post('/:storyId/generate-rag', async (req, res) => {
  try {
    const { storyId } = req.params;
    const { userMessage, conversationHistory, actionType, sessionId } = req.body;

    // Validate story exists
    const storyExists = await storyDiscovery.storyExists(storyId);
    if (!storyExists) {
      return res.status(404).json({
        error: 'Story not found',
        storyId
      });
    }

    if (!userMessage) {
      return res.status(400).json({
        error: 'Missing required field: userMessage'
      });
    }

    console.log(`🎭 Processing RAG story request for ${storyId}:`, userMessage, actionType ? `(${actionType})` : '');

    // Extract user ID from Firebase token if available
    let userId: string | undefined;
    const authHeader = req.headers.authorization;
    console.log('🔍 Auth header:', authHeader ? 'Bearer token present' : 'No auth header');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decodedToken = await admin.auth().verifyIdToken(token);
        userId = decodedToken.uid;
        console.log('✅ User ID extracted from token:', userId);
      } catch (error) {
        console.log('⚠️ Invalid Firebase token:', error);
        // Continue without user ID
      }
    } else {
      console.log('⚠️ No Firebase token provided - inventory validation will be skipped');
    }

    const result = await geminiRAG.generateStoryWithRAG(
      storyId,
      userMessage,
      conversationHistory || [],
      actionType,
      sessionId,
      userId
    );

    res.json({
      success: true,
      response: result.response,
      contextUsed: result.contextUsed,
      metadata: {
        sources: result.sources,
        contextRelevant: result.contextUsed.length > 0
      }
    });

  } catch (error) {
    console.error('❌ RAG story generation error:', error);
    res.status(500).json({
      error: 'Failed to generate RAG-enhanced story response',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

// Search story context (for testing/debugging)
router.post('/:storyId/search-context', async (req, res) => {
  try {
    const { storyId } = req.params;
    const { query, maxResults } = req.body;

    // Validate story exists
    const storyExists = await storyDiscovery.storyExists(storyId);
    if (!storyExists) {
      return res.status(404).json({
        error: 'Story not found',
        storyId
      });
    }

    if (!query) {
      return res.status(400).json({
        error: 'Missing required field: query'
      });
    }

    const results = await geminiRAG.searchContext(storyId, query, maxResults || 5);

    res.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('❌ Story context search error:', error);
    res.status(500).json({
      error: 'Failed to search story context',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

module.exports = router;