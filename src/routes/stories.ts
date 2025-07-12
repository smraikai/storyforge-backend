import { Router } from 'express';
import { StoryDiscoveryService } from '../services/storyDiscoveryService';

const router = Router();
const storyDiscovery = new StoryDiscoveryService();

// Get all available stories
router.get('/', async (req, res) => {
  try {
    const stories = await storyDiscovery.getAllStories();
    
    res.json({
      success: true,
      count: stories.length,
      stories
    });

  } catch (error) {
    console.error('❌ Error fetching stories:', error);
    res.status(500).json({
      error: 'Failed to fetch available stories',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

// Get specific story details
router.get('/:storyId', async (req, res) => {
  try {
    const { storyId } = req.params;
    
    const story = await storyDiscovery.getStory(storyId);
    
    if (!story) {
      return res.status(404).json({
        error: 'Story not found',
        storyId
      });
    }

    res.json({
      success: true,
      story
    });

  } catch (error) {
    console.error('❌ Error fetching story details:', error);
    res.status(500).json({
      error: 'Failed to fetch story details',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

// Check if story exists (lightweight endpoint)
router.head('/:storyId', async (req, res) => {
  try {
    const { storyId } = req.params;
    const exists = await storyDiscovery.storyExists(storyId);
    
    if (exists) {
      res.status(200).end();
    } else {
      res.status(404).end();
    }

  } catch (error) {
    console.error('❌ Error checking story existence:', error);
    res.status(500).end();
  }
});

module.exports = router;