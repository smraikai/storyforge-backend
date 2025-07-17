import express from 'express';
import { WorldStateService } from '../services/worldStateService';
import { DropItemRequest, PickupItemRequest, PickupAllItemsRequest } from '../types/worldState';
import admin from '../config/firebase';

const router = express.Router();
const worldStateService = new WorldStateService();

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

// Apply Firebase authentication middleware to all world state routes
router.use(authenticateFirebase);

/**
 * GET /api/world/:storyId/:locationId
 * Get world state for a specific location
 */
router.get('/:storyId/:locationId', async (req, res) => {
  try {
    const { storyId, locationId } = req.params;

    const worldState = await worldStateService.getWorldState(storyId, locationId);
    
    res.json({
      success: true,
      worldState: worldState || { locationId, storyId, items: [], lastUpdated: new Date(), version: 1 }
    });
  } catch (error) {
    console.error('Error getting world state:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/world/:storyId/:locationId/drop
 * Drop item from inventory to world
 */
router.post('/:storyId/:locationId/drop', async (req, res) => {
  try {
    const { storyId, locationId } = req.params;
    const { inventoryItemId, sessionId }: DropItemRequest = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!inventoryItemId || !sessionId) {
      return res.status(400).json({ error: 'Inventory item ID and session ID are required' });
    }

    const worldItem = await worldStateService.dropItem(
      userId, 
      sessionId, 
      storyId, 
      locationId, 
      inventoryItemId
    );

    res.json({
      success: true,
      worldItem,
      message: `${worldItem.originalItem.name} dropped in ${locationId}`
    });
  } catch (error) {
    console.error('Error dropping item:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

/**
 * POST /api/world/:storyId/:locationId/pickup
 * Pick up item from world to inventory
 */
router.post('/:storyId/:locationId/pickup', async (req, res) => {
  try {
    const { storyId, locationId } = req.params;
    const { worldItemId, sessionId }: PickupItemRequest = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!worldItemId || !sessionId) {
      return res.status(400).json({ error: 'World item ID and session ID are required' });
    }

    const inventoryItem = await worldStateService.pickupItem(
      userId, 
      sessionId, 
      storyId, 
      locationId, 
      worldItemId
    );

    res.json({
      success: true,
      inventoryItem,
      message: `${inventoryItem.name} picked up from ${locationId}`
    });
  } catch (error) {
    console.error('Error picking up item:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

/**
 * POST /api/world/:storyId/:locationId/pickup-all
 * Pick up all items dropped by user in location
 */
router.post('/:storyId/:locationId/pickup-all', async (req, res) => {
  try {
    const { storyId, locationId } = req.params;
    const { userId: requestUserId, sessionId }: PickupAllItemsRequest = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Use the authenticated user's ID, not the one from request body for security
    const targetUserId = requestUserId || userId;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const inventoryItems = await worldStateService.pickupAllItemsForUser(
      targetUserId, 
      sessionId, 
      storyId, 
      locationId
    );

    res.json({
      success: true,
      inventoryItems,
      count: inventoryItems.length,
      message: `Picked up ${inventoryItems.length} items from ${locationId}`
    });
  } catch (error) {
    console.error('Error picking up all items:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  }
});

/**
 * GET /api/world/:storyId/:locationId/items
 * Get all items in a location
 */
router.get('/:storyId/:locationId/items', async (req, res) => {
  try {
    const { storyId, locationId } = req.params;

    const items = await worldStateService.getItemsInLocation(storyId, locationId);

    res.json({
      success: true,
      items,
      count: items.length
    });
  } catch (error) {
    console.error('Error getting items in location:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/world/:storyId/:locationId/user-items
 * Get items dropped by current user in location
 */
router.get('/:storyId/:locationId/user-items', async (req, res) => {
  try {
    const { storyId, locationId } = req.params;
    const { sessionId } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const items = await worldStateService.getItemsForUser(
      storyId, 
      locationId, 
      userId, 
      sessionId as string
    );

    res.json({
      success: true,
      items,
      count: items.length
    });
  } catch (error) {
    console.error('Error getting user items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/world/:storyId/:locationId/summary
 * Get location items summary for AI context
 */
router.get('/:storyId/:locationId/summary', async (req, res) => {
  try {
    const { storyId, locationId } = req.params;

    const summary = await worldStateService.getLocationItemsSummary(storyId, locationId);

    res.json({
      success: true,
      summary
    });
  } catch (error) {
    console.error('Error getting location summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/world/:storyId/:locationId/cleanup
 * Clean up expired items (admin feature)
 */
router.delete('/:storyId/:locationId/cleanup', async (req, res) => {
  try {
    const { storyId, locationId } = req.params;
    const { maxAgeHours } = req.query;

    const removedCount = await worldStateService.cleanupExpiredItems(
      storyId, 
      locationId, 
      maxAgeHours ? parseInt(maxAgeHours as string) : 24
    );

    res.json({
      success: true,
      removedCount,
      message: `Cleaned up ${removedCount} expired items`
    });
  } catch (error) {
    console.error('Error cleaning up items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;