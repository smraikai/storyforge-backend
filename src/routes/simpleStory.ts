import { Router } from 'express';
import { GeminiRAGService } from '../services/geminiRagService';
import { StoryDiscoveryService } from '../services/storyDiscoveryService';
import { InventoryService } from '../services/inventoryService';
import { WorldStateService } from '../services/worldStateService';
import admin from '../config/firebase';

const router = Router();
const geminiRAG = new GeminiRAGService();
const storyDiscovery = new StoryDiscoveryService();
const inventoryService = InventoryService.getInstance();
const worldStateService = new WorldStateService();

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

    // Extract user ID from Firebase token (required for inventory operations)
    let userId: string | undefined;
    const authHeader = req.headers.authorization;
    console.log('🔍 Auth header:', authHeader ? 'Bearer token present' : 'No auth header');
    console.log('🔍 Request sessionId:', sessionId);
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        console.log('🔍 Attempting to verify Firebase token...');
        
        // Always try to verify the token - this ensures consistency with inventory API
        const decodedToken = await admin.auth().verifyIdToken(token);
        userId = decodedToken.uid;
        console.log('✅ User ID extracted from token:', userId);
      } catch (error) {
        console.log('⚠️ Firebase token verification failed:', error);
        console.log('⚠️ This might be due to missing Firebase service account credentials');
        
        // Only fall back to test user in development if explicitly needed
        // But warn that this might cause inventory sync issues
        if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
          userId = 'test-user-dev';
          console.log('🧪 Development mode: Using test user ID - WARNING: This may cause inventory sync issues');
        } else {
          console.log('❌ Production mode: Authentication required for inventory features');
        }
      }
    } else {
      console.log('⚠️ No Firebase token provided - inventory validation will be skipped');
      // In production, we might want to require auth, but for now allow anonymous stories
      if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
        userId = 'test-user-dev';
        console.log('🧪 Development mode: Using test user ID for non-authenticated request');
      }
    }

    console.log('🔍 Final userId for story processing:', userId);

    const result = await geminiRAG.generateStoryWithRAG(
      storyId,
      userMessage,
      conversationHistory || [],
      actionType,
      sessionId,
      userId
    );

    // Process inventory changes if present and user is authenticated
    if (userId && sessionId && result.inventoryChanges) {
      console.log('🎒 Processing inventory changes:', result.inventoryChanges);
      
      try {
        // Process items gained
        if (result.inventoryChanges.items_gained && result.inventoryChanges.items_gained.length > 0) {
          // Check if any items are pickups from world state
          const pickupItems = result.inventoryChanges.items_gained.filter((item: any) => 
            item.source?.includes('picked up') || 
            item.source?.includes('from floor') ||
            item.source?.includes('from ground')
          );
          
          // If there are pickup items, handle them as a batch
          if (pickupItems.length > 0) {
            console.log(`🌍 Found ${pickupItems.length} pickup items, attempting bulk pickup from world state`);
            try {
              const defaultLocation = 'training_grounds'; // Use same default as story generation
              const pickedUpItems = await worldStateService.pickupAllItemsForUser(
                userId,
                sessionId,
                storyId,
                defaultLocation
              );
              
              if (pickedUpItems.length > 0) {
                console.log(`✅ Picked up ${pickedUpItems.length} items from world state`);
                // Remove pickup items from processing list since they're handled
                const nonPickupItems = result.inventoryChanges.items_gained.filter((item: any) => 
                  !item.source?.includes('picked up') && 
                  !item.source?.includes('from floor') &&
                  !item.source?.includes('from ground')
                );
                result.inventoryChanges.items_gained = nonPickupItems;
              } else {
                console.log(`⚠️ No items found in world state to pick up, will create new items`);
              }
            } catch (error) {
              console.error(`❌ Failed to pick up from world state: ${error}`);
              console.log(`⚠️ Will create new items instead`);
            }
          }
          
          // Process remaining items (non-pickup or fallback items)
          for (const item of result.inventoryChanges.items_gained) {
            console.log(`📦 Adding item to inventory: ${item.name} (${item.quantity || 1})`);
            
            // Check if this is a template item (predefined) or dynamic item (AI-generated)
            const existingTemplate = inventoryService.getStoryItems(storyId)
              .find(template => template.id === item.id);
            
            if (existingTemplate) {
              // Use existing template system
              await inventoryService.addItem(
                userId,
                sessionId,
                item.id,
                item.quantity || 1,
                item.source || 'story_event'
              );
            } else {
              // Create dynamic item from AI specifications
              const dynamicItemSpec = {
                name: item.name,
                description: item.description || `A ${item.name} discovered during your adventure.`,
                quantity: item.quantity || 1,
                source: item.source || 'found_in_world',
                // Extract additional properties from the item if provided
                rarity: item.rarity || 'common',
                category: item.category,
                magical: item.magical || false,
                properties: item.properties || []
              };
              
              console.log(`🎲 Creating dynamic item: ${item.name}`);
              await inventoryService.addDynamicItem(userId, sessionId, dynamicItemSpec);
            }
          }
        }

        // Process items lost
        if (result.inventoryChanges.items_lost && result.inventoryChanges.items_lost.length > 0) {
          for (const item of result.inventoryChanges.items_lost) {
            console.log(`🗑️ Processing item loss: ${item.name} (${item.quantity || 1}) - ${item.reason || 'no reason given'}`);
            const inventory = await inventoryService.getPlayerInventory(userId, sessionId);
            if (inventory) {
              const inventoryItem = inventory.items.find(invItem => 
                invItem.name.toLowerCase() === item.name.toLowerCase()
              );
              if (inventoryItem) {
                // Check if this is a "drop" action based on the reason
                const isDrop = item.reason?.includes('drop') || 
                              item.reason?.includes('voluntarily') ||
                              item.reason?.includes('placed on ground') ||
                              item.reason?.includes('set down');
                
                if (isDrop) {
                  // Move item to world state instead of just removing it
                  console.log(`📍 Dropping item to world state: ${item.name}`);
                  try {
                    const defaultLocation = 'training_grounds'; // Use same default as story generation
                    await worldStateService.dropItem(
                      userId,
                      sessionId,
                      storyId,
                      defaultLocation,
                      inventoryItem.id
                    );
                    console.log(`✅ Item dropped to world state successfully: ${item.name}`);
                  } catch (error) {
                    console.error(`❌ Failed to drop item to world state: ${error}`);
                    // Fallback to regular removal if world state fails
                    await inventoryService.removeItem(userId, sessionId, inventoryItem.id, item.quantity || 1);
                  }
                } else {
                  // Regular removal (consumed, destroyed, etc.)
                  console.log(`🗑️ Removing item from inventory: ${item.name}`);
                  await inventoryService.removeItem(userId, sessionId, inventoryItem.id, item.quantity || 1);
                }
              }
            }
          }
        }

        // Process gold changes
        if (result.inventoryChanges.gold_change && result.inventoryChanges.gold_change !== 0) {
          console.log(`💰 Gold change: ${result.inventoryChanges.gold_change > 0 ? '+' : ''}${result.inventoryChanges.gold_change}`);
          // TODO: Implement gold change logic
        }

        console.log('✅ Inventory changes processed successfully');
      } catch (error) {
        console.error('❌ Error processing inventory changes:', error);
        // Don't fail the response if inventory processing fails
      }
    }

    res.json({
      success: true,
      response: result.response,
      contextUsed: result.contextUsed,
      metadata: {
        sources: result.sources,
        contextRelevant: result.contextUsed.length > 0,
        inventoryChanges: result.inventoryChanges
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