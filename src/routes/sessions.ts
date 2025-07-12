import { Router } from 'express';
import { StorySessionService } from '../services/storySessionService';
import { AuthMiddleware } from '../middleware/auth';
import { StoryDiscoveryService } from '../services/storyDiscoveryService';

const router = Router();
const sessionService = new StorySessionService();
const authMiddleware = new AuthMiddleware();
const storyDiscovery = new StoryDiscoveryService();

// All routes require authentication
router.use(authMiddleware.authenticate.bind(authMiddleware));

// Get all user's story sessions
router.get('/', async (req, res) => {
  try {
    const sessions = await sessionService.getUserSessions(req.user!.id);
    
    // Enrich sessions with story metadata
    const enrichedSessions = await Promise.all(
      sessions.map(async (session) => {
        const storyMetadata = await storyDiscovery.getStory(session.story_id);
        return {
          ...session,
          story: storyMetadata
        };
      })
    );

    res.json({
      success: true,
      sessions: enrichedSessions
    });

  } catch (error) {
    console.error('Error fetching user sessions:', error);
    res.status(500).json({
      error: 'Failed to fetch sessions',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

// Create new story session
router.post('/', async (req, res) => {
  try {
    const { storyId, sessionName } = req.body;

    if (!storyId) {
      return res.status(400).json({
        error: 'Story ID is required'
      });
    }

    // Verify story exists
    const storyExists = await storyDiscovery.storyExists(storyId);
    if (!storyExists) {
      return res.status(404).json({
        error: 'Story not found',
        storyId
      });
    }

    const session = await sessionService.createSession(
      req.user!.id,
      storyId,
      sessionName
    );

    res.status(201).json({
      success: true,
      session
    });

  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({
      error: 'Failed to create session',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

// Get specific session details
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await sessionService.getSession(sessionId, req.user!.id);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found'
      });
    }

    // Get story metadata
    const storyMetadata = await storyDiscovery.getStory(session.story_id);

    res.json({
      success: true,
      session: {
        ...session,
        story: storyMetadata
      }
    });

  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({
      error: 'Failed to fetch session',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

// Get session messages (conversation history)
router.get('/:sessionId/messages', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const messages = await sessionService.getSessionMessages(sessionId, req.user!.id);

    res.json({
      success: true,
      messages
    });

  } catch (error) {
    console.error('Error fetching session messages:', error);
    
    if ((error as Error).message === 'Session not found or access denied') {
      return res.status(404).json({
        error: 'Session not found or access denied'
      });
    }

    res.status(500).json({
      error: 'Failed to fetch session messages',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

// Generate session summary
router.post('/:sessionId/summary', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const summary = await sessionService.generateSessionSummary(sessionId, req.user!.id);

    res.json({
      success: true,
      summary
    });

  } catch (error) {
    console.error('Error generating session summary:', error);
    
    if ((error as Error).message === 'Session not found or access denied') {
      return res.status(404).json({
        error: 'Session not found or access denied'
      });
    }

    res.status(500).json({
      error: 'Failed to generate session summary',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

// Update session status
router.patch('/:sessionId/status', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { status } = req.body;

    if (!['active', 'completed', 'abandoned'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status. Must be: active, completed, or abandoned'
      });
    }

    await sessionService.updateSessionStatus(sessionId, req.user!.id, status);

    res.json({
      success: true,
      message: 'Session status updated'
    });

  } catch (error) {
    console.error('Error updating session status:', error);
    res.status(500).json({
      error: 'Failed to update session status',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

// Delete session
router.delete('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    await sessionService.deleteSession(sessionId, req.user!.id);

    res.json({
      success: true,
      message: 'Session deleted'
    });

  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({
      error: 'Failed to delete session',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

module.exports = router;