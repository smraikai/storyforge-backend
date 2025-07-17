import { Router } from 'express';
import { GeminiRAGService } from '../services/geminiRagService';
import { StoryDiscoveryService } from '../services/storyDiscoveryService';
import { InventoryService } from '../services/inventoryService';
import admin from '../config/firebase';

const router = Router();
const geminiRAG = new GeminiRAGService();
const storyDiscovery = new StoryDiscoveryService();
const inventoryService = new InventoryService();

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
        console.log('🔍 Attempting to verify Firebase token...');
        
        // Check if we have proper Firebase auth setup
        if (!admin.apps.length) {
          console.log('⚠️ Firebase Admin not initialized - skipping token verification');
        } else {
          const decodedToken = await admin.auth().verifyIdToken(token);
          userId = decodedToken.uid;
          console.log('✅ User ID extracted from token:', userId);
        }
      } catch (error) {
        console.log('⚠️ Firebase token verification failed:', error);
        console.log('⚠️ This might be due to missing Firebase service account credentials');
        console.log('⚠️ Continuing without user authentication - inventory features will be limited');
        
        // For development: use a test user ID when Firebase auth fails
        if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
          userId = 'test-user-dev';
          console.log('🧪 Development mode: Using test user ID for inventory testing');
        }
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

    // Process inventory changes if present and user is authenticated
    if (userId && sessionId && result.inventoryChanges) {
      console.log('🎒 Processing inventory changes:', result.inventoryChanges);
      
      try {
        // Process items gained
        if (result.inventoryChanges.items_gained && result.inventoryChanges.items_gained.length > 0) {
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
            console.log(`🗑️ Removing item from inventory: ${item.name} (${item.quantity || 1})`);
            const inventory = await inventoryService.getPlayerInventory(userId, sessionId);
            if (inventory) {
              const inventoryItem = inventory.items.find(invItem => 
                invItem.name.toLowerCase() === item.name.toLowerCase()
              );
              if (inventoryItem) {
                await inventoryService.removeItem(userId, sessionId, inventoryItem.id, item.quantity || 1);
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