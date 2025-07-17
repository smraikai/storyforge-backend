import { InventoryItem } from './inventory';

export interface WorldItem {
  id: string;
  originalItem: InventoryItem;  // The actual item that was dropped
  locationId: string;           // Where it was dropped
  droppedAt: Date;             // When it was dropped
  droppedBy: string;           // User ID who dropped it
  sessionId: string;           // Session where it was dropped
}

export interface WorldState {
  locationId: string;
  storyId: string;
  items: WorldItem[];
  lastUpdated: Date;
  version: number;
}

export interface WorldStateOperation {
  type: 'drop' | 'pickup' | 'remove';
  itemId: string;              // For pickup/remove: WorldItem.id, For drop: InventoryItem.id
  locationId: string;
  userId: string;
  sessionId: string;
  timestamp: Date;
}

export interface DropItemRequest {
  inventoryItemId: string;
  sessionId: string;
}

export interface PickupItemRequest {
  worldItemId: string;
  sessionId: string;
}

export interface PickupAllItemsRequest {
  userId: string;
  sessionId: string;
}