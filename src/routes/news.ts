import express from 'express';
import { NewsItem, sampleNewsItems } from '../models/News';

const router = express.Router();

/**
 * GET /api/news
 * Get all active news items, sorted by priority (highest first) and date
 */
router.get('/', async (req, res) => {
  try {
    // In a real implementation, this would fetch from a database
    // For now, using sample data
    const activeNews = sampleNewsItems
      .filter(item => item.isActive)
      .sort((a, b) => {
        // First sort by priority (higher first)
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        // Then by date (newer first)
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

    console.log(`📰 Fetched ${activeNews.length} active news items`);
    
    res.json({
      success: true,
      data: activeNews,
      count: activeNews.length
    });
  } catch (error) {
    console.error('❌ Error fetching news:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch news items'
    });
  }
});

/**
 * GET /api/news/:id
 * Get a specific news item by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // In a real implementation, this would fetch from a database
    const newsItem = sampleNewsItems.find(item => item.id === id && item.isActive);
    
    if (!newsItem) {
      return res.status(404).json({
        success: false,
        error: 'News item not found'
      });
    }

    console.log(`📰 Fetched news item: ${newsItem.title}`);
    
    res.json({
      success: true,
      data: newsItem
    });
  } catch (error) {
    console.error('❌ Error fetching news item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch news item'
    });
  }
});

export default router;