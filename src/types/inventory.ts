export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  type: 'weapon' | 'armor' | 'consumable' | 'tool' | 'treasure' | 'quest' | 'misc';
  category: string; // e.g., 'sword', 'potion', 'scroll', 'key'
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  quantity: number;
  maxStack: number;
  value: number; // Gold value
  weight: number;
  
  // Stats and effects
  damage?: number;
  defense?: number;
  healing?: number;
  durability?: number;
  maxDurability?: number;
  
  // Special properties
  magical: boolean;
  cursed: boolean;
  properties: string[]; // e.g., ['fire_damage', 'blessed', 'unbreakable']
  
  // Usage restrictions
  usableInCombat: boolean;
  consumable: boolean;
  equipable: boolean;
  
  // Metadata
  iconUrl?: string;
  source: string; // Where it was obtained
  storyId: string; // Which story it belongs to
  acquiredAt: Date;
  lastUsed?: Date;
}

export interface PlayerInventory {
  userId: string;
  sessionId: string;
  storyId: string;
  items: InventoryItem[];
  gold: number;
  maxWeight: number;
  currentWeight: number;
  
  // Quick access slots
  equippedWeapon?: string; // item id
  equippedArmor?: string; // item id
  quickUseSlots: string[]; // item ids for quick access
  
  // Metadata
  lastUpdated: Date;
  version: number; // For optimistic updates
}

export interface InventoryAction {
  type: 'add' | 'remove' | 'use' | 'equip' | 'unequip' | 'move' | 'split' | 'combine';
  itemId: string;
  quantity?: number;
  targetSlot?: string;
  metadata?: Record<string, any>;
}

export interface InventoryActionResult {
  success: boolean;
  inventory: PlayerInventory;
  changes: {
    itemsAdded: InventoryItem[];
    itemsRemoved: InventoryItem[];
    itemsModified: InventoryItem[];
  };
  messages: string[];
  errors?: string[];
}

export interface StoryItemTemplate {
  id: string;
  name: string;
  description: string;
  type: InventoryItem['type'];
  category: string;
  rarity: InventoryItem['rarity'];
  baseValue: number;
  baseWeight: number;
  maxStack: number;
  
  // Base stats
  baseDamage?: number;
  baseDefense?: number;
  baseHealing?: number;
  baseDurability?: number;
  
  // Properties
  magical: boolean;
  cursed: boolean;
  properties: string[];
  usableInCombat: boolean;
  consumable: boolean;
  equipable: boolean;
  
  // Story context
  storyId: string;
  availableInStory: boolean;
  iconUrl?: string;
  loreText?: string;
}

export interface InventoryValidation {
  canAdd: boolean;
  canRemove: boolean;
  canUse: boolean;
  canEquip: boolean;
  reasons: string[];
  suggestions: string[];
}

export interface DynamicItemSpec {
  name: string;
  description: string;
  category?: string;
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  quantity?: number;
  maxStack?: number;
  magical?: boolean;
  cursed?: boolean;
  properties?: string[];
  usableInCombat?: boolean;
  iconUrl?: string;
  source?: string;
}