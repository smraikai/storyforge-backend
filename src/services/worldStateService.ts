import admin from '../config/firebase';
import { 
  WorldItem, 
  WorldState, 
  WorldStateOperation,
  DropItemRequest,
  PickupItemRequest,
  PickupAllItemsRequest
} from '../types/worldState';
import { InventoryItem } from '../types/inventory';
import { InventoryService } from './inventoryService';

export class WorldStateService {
  private firestore: admin.firestore.Firestore;
  private inventoryService: InventoryService;

  constructor() {
    this.firestore = admin.firestore();
    this.inventoryService = InventoryService.getInstance();
  }

  /**
   * Get world state for a specific location
   */
  async getWorldState(storyId: string, locationId: string): Promise<WorldState | null> {
    try {
      const doc = await this.firestore
        .collection('worldStates')
        .doc(`${storyId}_${locationId}`)
        .get();

      if (!doc.exists) {
        return null;
      }

      const data = doc.data();
      if (!data) {
        return null;
      }
      
      // Helper function to safely convert dates
      const toSafeDate = (dateValue: any): Date => {
        if (!dateValue) return new Date();
        if (dateValue instanceof Date) return dateValue;
        if (typeof dateValue.toDate === 'function') return dateValue.toDate();
        if (typeof dateValue === 'string') return new Date(dateValue);
        return new Date();
      };

      return {
        ...data,
        lastUpdated: toSafeDate(data.lastUpdated),
        items: data.items.map((item: any) => ({
          ...item,
          droppedAt: toSafeDate(item.droppedAt),
          originalItem: {
            ...item.originalItem,
            acquiredAt: toSafeDate(item.originalItem.acquiredAt),
            lastUsed: item.originalItem.lastUsed ? toSafeDate(item.originalItem.lastUsed) : null
          }
        }))
      } as WorldState;
    } catch (error) {
      console.error('❌ Error getting world state:', error);
      throw error;
    }
  }

  /**
   * Initialize empty world state for new location
   */
  async initializeWorldState(storyId: string, locationId: string): Promise<WorldState> {
    const worldState: WorldState = {
      locationId,
      storyId,
      items: [],
      lastUpdated: new Date(),
      version: 1
    };

    await this.saveWorldState(worldState);
    return worldState;
  }

  /**
   * Save world state to Firebase
   */
  async saveWorldState(worldState: WorldState): Promise<void> {
    try {
      const cleanedWorldState = {
        ...worldState,
        items: worldState.items.map(item => {
          const cleanedItem: any = { 
            ...item,
            originalItem: {
              ...item.originalItem,
              // Clean up undefined values in originalItem
              lastUsed: item.originalItem.lastUsed || null
            }
          };
          
          // Remove undefined properties recursively
          const removeUndefined = (obj: any): any => {
            if (obj === null || typeof obj !== 'object') return obj;
            if (Array.isArray(obj)) {
              return obj.map(removeUndefined);
            }
            
            const cleaned: any = {};
            Object.keys(obj).forEach(key => {
              if (obj[key] !== undefined) {
                cleaned[key] = removeUndefined(obj[key]);
              }
            });
            return cleaned;
          };
          
          return removeUndefined(cleanedItem);
        }),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        version: worldState.version + 1
      };

      await this.firestore
        .collection('worldStates')
        .doc(`${worldState.storyId}_${worldState.locationId}`)
        .set(cleanedWorldState);
    } catch (error) {
      console.error('❌ Error saving world state:', error);
      throw error;
    }
  }

  /**
   * Drop item from inventory to world
   */
  async dropItem(
    userId: string, 
    sessionId: string, 
    storyId: string, 
    locationId: string, 
    inventoryItemId: string
  ): Promise<WorldItem> {
    // Get the item from inventory
    const inventory = await this.inventoryService.getPlayerInventory(userId, sessionId);
    if (!inventory) {
      throw new Error('Inventory not found');
    }

    const inventoryItem = inventory.items.find(item => item.id === inventoryItemId);
    if (!inventoryItem) {
      throw new Error('Item not found in inventory');
    }

    // Remove item from inventory
    await this.inventoryService.removeItem(userId, sessionId, inventoryItemId, inventoryItem.quantity);

    // Create world item
    const worldItem: WorldItem = {
      id: `world_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      originalItem: inventoryItem,
      locationId,
      droppedAt: new Date(),
      droppedBy: userId,
      sessionId
    };

    // Get or create world state
    let worldState = await this.getWorldState(storyId, locationId);
    if (!worldState) {
      worldState = await this.initializeWorldState(storyId, locationId);
    }

    // Add item to world state
    worldState.items.push(worldItem);
    await this.saveWorldState(worldState);

    console.log(`📍 Item dropped in world: ${inventoryItem.name} at ${locationId}`);
    return worldItem;
  }

  /**
   * Pick up item from world to inventory
   */
  async pickupItem(
    userId: string, 
    sessionId: string, 
    storyId: string, 
    locationId: string, 
    worldItemId: string
  ): Promise<InventoryItem> {
    // Get world state
    const worldState = await this.getWorldState(storyId, locationId);
    if (!worldState) {
      throw new Error('World state not found');
    }

    // Find the world item
    const worldItemIndex = worldState.items.findIndex(item => item.id === worldItemId);
    if (worldItemIndex === -1) {
      throw new Error('Item not found in world');
    }

    const worldItem = worldState.items[worldItemIndex];

    // Verify the item can be picked up by this user/session
    // For now, allow anyone to pick up items, but could add restrictions later
    
    // Remove item from world state
    worldState.items.splice(worldItemIndex, 1);
    await this.saveWorldState(worldState);

    // Add item back to inventory (restore original item)
    const inventory = await this.inventoryService.getPlayerInventory(userId, sessionId);
    if (!inventory) {
      throw new Error('Inventory not found');
    }

    // Add the original item back to inventory
    inventory.items.push(worldItem.originalItem);
    inventory.currentWeight += worldItem.originalItem.weight * worldItem.originalItem.quantity;
    await this.inventoryService.saveInventory(inventory);

    console.log(`🎒 Item picked up from world: ${worldItem.originalItem.name} from ${locationId}`);
    return worldItem.originalItem;
  }

  /**
   * Pick up all items dropped by a specific user in a location
   */
  async pickupAllItemsForUser(
    userId: string, 
    sessionId: string, 
    storyId: string, 
    locationId: string
  ): Promise<InventoryItem[]> {
    console.log(`🎒 pickupAllItemsForUser called with sessionId: ${sessionId}, userId: ${userId}`);
    // Get world state
    const worldState = await this.getWorldState(storyId, locationId);
    if (!worldState) {
      return [];
    }

    // Find all items dropped by this user in this session
    const userItems = worldState.items.filter(item => 
      item.droppedBy === userId && item.sessionId === sessionId
    );

    if (userItems.length === 0) {
      return [];
    }

    // Remove all user items from world state
    worldState.items = worldState.items.filter(item => 
      !(item.droppedBy === userId && item.sessionId === sessionId)
    );
    await this.saveWorldState(worldState);

    // Add all items back to inventory
    const inventory = await this.inventoryService.getPlayerInventory(userId, sessionId);
    if (!inventory) {
      throw new Error('Inventory not found');
    }

    console.log(`🎒 Current inventory before pickup has ${inventory.items.length} items`);

    const pickedUpItems: InventoryItem[] = [];
    for (const worldItem of userItems) {
      inventory.items.push(worldItem.originalItem);
      inventory.currentWeight += worldItem.originalItem.weight * worldItem.originalItem.quantity;
      pickedUpItems.push(worldItem.originalItem);
    }

    console.log(`🎒 Inventory after adding items has ${inventory.items.length} items`);
    console.log(`🎒 Saving inventory for sessionId: ${sessionId}, userId: ${userId}`);
    
    await this.inventoryService.saveInventory(inventory);
    
    console.log(`🎒 Inventory saved successfully. Verifying save...`);
    
    // Verify the save worked by reading it back
    const verifyInventory = await this.inventoryService.getPlayerInventory(userId, sessionId);
    if (verifyInventory) {
      console.log(`🎒 Verification: Inventory now has ${verifyInventory.items.length} items after save`);
    } else {
      console.log(`❌ Verification failed: Could not retrieve inventory after save`);
    }

    console.log(`🎒 Picked up ${pickedUpItems.length} items from world at ${locationId}`);
    return pickedUpItems;
  }

  /**
   * Get all items in a location
   */
  async getItemsInLocation(storyId: string, locationId: string): Promise<WorldItem[]> {
    const worldState = await this.getWorldState(storyId, locationId);
    return worldState?.items || [];
  }

  /**
   * Get items dropped by a specific user in a location
   */
  async getItemsForUser(storyId: string, locationId: string, userId: string, sessionId?: string): Promise<WorldItem[]> {
    const worldState = await this.getWorldState(storyId, locationId);
    if (!worldState) {
      return [];
    }

    return worldState.items.filter(item => {
      if (sessionId) {
        return item.droppedBy === userId && item.sessionId === sessionId;
      }
      return item.droppedBy === userId;
    });
  }

  /**
   * Clean up expired items (optional feature)
   */
  async cleanupExpiredItems(storyId: string, locationId: string, maxAgeHours: number = 24): Promise<number> {
    const worldState = await this.getWorldState(storyId, locationId);
    if (!worldState) {
      return 0;
    }

    const cutoffTime = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));
    const originalCount = worldState.items.length;

    worldState.items = worldState.items.filter(item => item.droppedAt > cutoffTime);

    const removedCount = originalCount - worldState.items.length;
    if (removedCount > 0) {
      await this.saveWorldState(worldState);
      console.log(`🧹 Cleaned up ${removedCount} expired items from ${locationId}`);
    }

    return removedCount;
  }

  /**
   * Check if a location has any dropped items
   */
  async hasItemsInLocation(storyId: string, locationId: string): Promise<boolean> {
    const worldState = await this.getWorldState(storyId, locationId);
    return worldState ? worldState.items.length > 0 : false;
  }

  /**
   * Get summary of items in location for AI context
   */
  async getLocationItemsSummary(storyId: string, locationId: string): Promise<string> {
    console.log(`🌍 Getting world items for: ${storyId}_${locationId}`);
    const items = await this.getItemsInLocation(storyId, locationId);
    console.log(`🌍 Found ${items.length} items in world state`);
    
    if (items.length === 0) {
      return "WORLD ITEMS: None (location is clear)";
    }

    const itemDescriptions = items.map(item => {
      const quantity = item.originalItem.quantity > 1 ? `${item.originalItem.quantity}x ` : '';
      return `${quantity}${item.originalItem.name}`;
    });

    console.log(`🌍 World items: ${itemDescriptions.join(', ')}`);
    return `WORLD ITEMS (${items.length} on ground): ${itemDescriptions.join(', ')}`;
  }
}