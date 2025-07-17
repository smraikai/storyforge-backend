import express from 'express';
import { InventoryService } from '../services/inventoryService';
import { InventoryAction } from '../types/inventory';
import admin from '../config/firebase';

const router = express.Router();
const inventoryService = new InventoryService();

// Firebase authentication middleware
const authenticateFirebase = async (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    req.user = {
      id: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      picture: decodedToken.picture
    };
    
    next();
  } catch (error) {
    console.error('Firebase token verification error:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Apply Firebase authentication middleware to all inventory routes
router.use(authenticateFirebase);

/**
 * GET /api/inventory/:sessionId
 * Get player's inventory for a specific session
 */
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const inventory = await inventoryService.getPlayerInventory(userId, sessionId);
    
    if (!inventory) {
      return res.status(404).json({ error: 'Inventory not found' });
    }

    res.json({
      success: true,
      inventory
    });
  } catch (error) {
    console.error('Error getting inventory:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/inventory/:sessionId/initialize
 * Initialize inventory for a new session
 */
router.post('/:sessionId/initialize', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { storyId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!storyId) {
      return res.status(400).json({ error: 'Story ID is required' });
    }

    const inventory = await inventoryService.initializeInventory(userId, sessionId, storyId);

    res.json({
      success: true,
      inventory,
      message: 'Inventory initialized successfully'
    });
  } catch (error) {
    console.error('Error initializing inventory:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/inventory/:sessionId/add
 * Add item to inventory
 */
router.post('/:sessionId/add', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { itemTemplateId, quantity = 1, source = 'story_event' } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!itemTemplateId) {
      return res.status(400).json({ error: 'Item template ID is required' });
    }

    const result = await inventoryService.addItem(userId, sessionId, itemTemplateId, quantity, source);

    res.json({
      success: result.success,
      inventory: result.inventory,
      changes: result.changes,
      messages: result.messages,
      errors: result.errors
    });
  } catch (error) {
    console.error('Error adding item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/inventory/:sessionId/remove
 * Remove item from inventory
 */
router.post('/:sessionId/remove', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { itemId, quantity = 1 } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!itemId) {
      return res.status(400).json({ error: 'Item ID is required' });
    }

    const result = await inventoryService.removeItem(userId, sessionId, itemId, quantity);

    res.json({
      success: result.success,
      inventory: result.inventory,
      changes: result.changes,
      messages: result.messages,
      errors: result.errors
    });
  } catch (error) {
    console.error('Error removing item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/inventory/:sessionId/use
 * Use item from inventory
 */
router.post('/:sessionId/use', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { itemId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!itemId) {
      return res.status(400).json({ error: 'Item ID is required' });
    }

    const result = await inventoryService.useItem(userId, sessionId, itemId);

    res.json({
      success: result.success,
      inventory: result.inventory,
      changes: result.changes,
      messages: result.messages,
      errors: result.errors
    });
  } catch (error) {
    console.error('Error using item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/inventory/:sessionId/validate
 * Validate inventory action
 */
router.post('/:sessionId/validate', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const action: InventoryAction = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!action.type || !action.itemId) {
      return res.status(400).json({ error: 'Action type and item ID are required' });
    }

    const validation = await inventoryService.validateAction(userId, sessionId, action);

    res.json({
      success: true,
      validation
    });
  } catch (error) {
    console.error('Error validating action:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/inventory/:sessionId/summary
 * Get formatted inventory summary for AI prompts
 */
router.get('/:sessionId/summary', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const summary = await inventoryService.getInventorySummary(userId, sessionId);

    res.json({
      success: true,
      summary
    });
  } catch (error) {
    console.error('Error getting inventory summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/inventory/:sessionId/search
 * Search items in inventory
 */
router.get('/:sessionId/search', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { query } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    const items = await inventoryService.findItems(userId, sessionId, query);

    res.json({
      success: true,
      items,
      count: items.length
    });
  } catch (error) {
    console.error('Error searching inventory:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/inventory/:sessionId/has/:itemName
 * Check if player has specific item
 */
router.get('/:sessionId/has/:itemName', async (req, res) => {
  try {
    const { sessionId, itemName } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const hasItem = await inventoryService.hasItem(userId, sessionId, itemName);

    res.json({
      success: true,
      hasItem,
      itemName
    });
  } catch (error) {
    console.error('Error checking item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/inventory/story/:storyId/items
 * Get available items for a story
 */
router.get('/story/:storyId/items', async (req, res) => {
  try {
    const { storyId } = req.params;
    const items = inventoryService.getStoryItems(storyId);

    res.json({
      success: true,
      items,
      count: items.length
    });
  } catch (error) {
    console.error('Error getting story items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;