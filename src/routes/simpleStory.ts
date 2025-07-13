import { Router } from 'express';
import { GeminiRAGService } from '../services/geminiRagService';
import { StoryDiscoveryService } from '../services/storyDiscoveryService';

const router = Router();
const geminiRAG = new GeminiRAGService();
const storyDiscovery = new StoryDiscoveryService();

// RAG-enhanced story generation with streaming
router.post('/:storyId/generate-rag-stream', async (req, res) => {
  try {
    const { storyId } = req.params;
    const { userMessage, conversationHistory, actionType } = req.body;

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

    console.log(`🎭 Processing RAG streaming request for ${storyId}:`, userMessage, actionType ? `(${actionType})` : '');

    // Set up Server-Sent Events headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    const result = await geminiRAG.generateStoryWithRAGStream(
      storyId,
      userMessage,
      conversationHistory || [],
      actionType
    );

    // Send initial metadata
    res.write(`data: ${JSON.stringify({
      type: 'metadata',
      contextUsed: result.contextUsed,
      sources: result.sources
    })}\n\n`);

    // Set up streaming
    const reader = result.stream.getReader();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
          break;
        }
        
        // Forward the chunk to client
        res.write(value);
      }
    } finally {
      reader.releaseLock();
      res.end();
    }

  } catch (error) {
    console.error('❌ RAG streaming error:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: 'Failed to generate RAG-enhanced story response',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    })}\n\n`);
    res.end();
  }
});

// RAG-enhanced story generation using direct Gemini API (non-streaming fallback)
router.post('/:storyId/generate-rag', async (req, res) => {
  try {
    const { storyId } = req.params;
    const { userMessage, conversationHistory, actionType } = req.body;

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

    const result = await geminiRAG.generateStoryWithRAG(
      storyId,
      userMessage,
      conversationHistory || [],
      actionType
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