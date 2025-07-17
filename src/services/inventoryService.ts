import admin from '../config/firebase';
import { 
  InventoryItem, 
  PlayerInventory, 
  InventoryAction, 
  InventoryActionResult,
  StoryItemTemplate,
  InventoryValidation,
  DynamicItemSpec
} from '../types/inventory';
import fs from 'fs/promises';
import path from 'path';

export class InventoryService {
  private firestore: admin.firestore.Firestore;
  private storyItemTemplates: Map<string, StoryItemTemplate[]> = new Map();

  constructor() {
    this.firestore = admin.firestore();
    this.loadStoryItemTemplates();
  }

  /**
   * Load item templates from story data files
   */
  private async loadStoryItemTemplates(): Promise<void> {
    try {
      const storiesDir = path.join(__dirname, '../../data/stories');
      const storyFolders = await fs.readdir(storiesDir);

      for (const storyFolder of storyFolders) {
        const itemsPath = path.join(storiesDir, storyFolder, 'items.json');
        
        try {
          const itemsData = JSON.parse(await fs.readFile(itemsPath, 'utf-8'));
          const templates: StoryItemTemplate[] = itemsData.items.map((item: any) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            type: item.type,
            category: item.category,
            rarity: item.rarity,
            baseValue: item.base_value || 0,
            baseWeight: item.base_weight || 1,
            maxStack: item.max_stack || 1,
            baseDamage: item.base_damage || 0,
            baseDefense: item.base_defense || 0,
            baseHealing: item.base_healing || 0,
            baseDurability: item.base_durability || 100,
            magical: item.magical || false,
            cursed: item.cursed || false,
            properties: item.properties || [],
            usableInCombat: item.usable_in_combat || false,
            consumable: item.consumable || false,
            equipable: item.equipable || false,
            storyId: storyFolder,
            availableInStory: true,
            iconUrl: item.icon_url || '',
            loreText: item.lore_text || ''
          }));

          this.storyItemTemplates.set(storyFolder, templates);
          console.log(`✅ Loaded ${templates.length} item templates for story: ${storyFolder}`);
        } catch (error) {
          console.log(`ℹ️ No items.json found for story: ${storyFolder} (optional)`);
        }
      }
    } catch (error) {
      console.error('❌ Error loading story item templates:', error);
    }
  }

  /**
   * Get player inventory from Firebase
   */
  async getPlayerInventory(userId: string, sessionId: string): Promise<PlayerInventory | null> {
    try {
      const doc = await this.firestore
        .collection('inventories')
        .doc(`${userId}_${sessionId}`)
        .get();

      if (!doc.exists) {
        return null;
      }

      const data = doc.data();
      if (!data) {
        return null;
      }
      
      return {
        ...data,
        lastUpdated: data.lastUpdated.toDate(),
        items: data.items.map((item: any) => ({
          ...item,
          acquiredAt: item.acquiredAt.toDate(),
          lastUsed: item.lastUsed?.toDate()
        }))
      } as PlayerInventory;
    } catch (error) {
      console.error('❌ Error getting player inventory:', error);
      throw error;
    }
  }

  /**
   * Initialize empty inventory for new session
   */
  async initializeInventory(userId: string, sessionId: string, storyId: string): Promise<PlayerInventory> {
    const inventory: PlayerInventory = {
      userId,
      sessionId,
      storyId,
      items: [],
      gold: 100, // Starting gold
      maxWeight: 50, // Starting carry capacity
      currentWeight: 0,
      quickUseSlots: [],
      lastUpdated: new Date(),
      version: 1
    };

    // Add starting items based on story
    const startingItems = await this.getStartingItems(storyId);
    for (const itemTemplate of startingItems) {
      const item = this.createItemFromTemplate(itemTemplate);
      inventory.items.push(item);
      inventory.currentWeight += item.weight * item.quantity;
    }

    await this.saveInventory(inventory);
    return inventory;
  }

  /**
   * Get starting items for a story
   */
  private async getStartingItems(storyId: string): Promise<StoryItemTemplate[]> {
    const templates = this.storyItemTemplates.get(storyId) || [];
    return templates.filter(template => template.properties.includes('starting_item'));
  }

  /**
   * Create item instance from template
   */
  private createItemFromTemplate(template: StoryItemTemplate, customProperties?: Partial<InventoryItem>): InventoryItem {
    return {
      id: `${template.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: template.name,
      description: template.description,
      type: template.type,
      category: template.category,
      rarity: template.rarity,
      quantity: 1,
      maxStack: template.maxStack || 1,
      value: template.baseValue || 0,
      weight: template.baseWeight || 1,
      damage: template.baseDamage || 0,
      defense: template.baseDefense || 0,
      healing: template.baseHealing || 0,
      durability: template.baseDurability || 100,
      maxDurability: template.baseDurability || 100,
      magical: template.magical || false,
      cursed: template.cursed || false,
      properties: [...(template.properties || [])],
      usableInCombat: template.usableInCombat || false,
      consumable: template.consumable || false,
      equipable: template.equipable || false,
      iconUrl: template.iconUrl || '',
      source: 'story_start',
      storyId: template.storyId,
      acquiredAt: new Date(),
      ...customProperties
    };
  }

  /**
   * Save inventory to Firebase
   */
  async saveInventory(inventory: PlayerInventory): Promise<void> {
    try {
      // Clean up inventory items to remove undefined values
      const cleanedInventory = {
        ...inventory,
        items: inventory.items.map(item => {
          const cleanedItem: any = { ...item };
          // Remove undefined properties
          Object.keys(cleanedItem).forEach(key => {
            if (cleanedItem[key] === undefined) {
              delete cleanedItem[key];
            }
          });
          return cleanedItem;
        }),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        version: inventory.version + 1
      };

      // Remove undefined top-level properties
      if (cleanedInventory.equippedWeapon === undefined) delete cleanedInventory.equippedWeapon;
      if (cleanedInventory.equippedArmor === undefined) delete cleanedInventory.equippedArmor;

      await this.firestore
        .collection('inventories')
        .doc(`${inventory.userId}_${inventory.sessionId}`)
        .set(cleanedInventory);
    } catch (error) {
      console.error('❌ Error saving inventory:', error);
      throw error;
    }
  }

  /**
   * Add item to inventory
   */
  async addItem(
    userId: string, 
    sessionId: string, 
    itemTemplateId: string, 
    quantity: number = 1,
    source: string = 'story_event'
  ): Promise<InventoryActionResult> {
    const inventory = await this.getPlayerInventory(userId, sessionId);
    if (!inventory) {
      throw new Error('Inventory not found');
    }

    const template = this.findItemTemplate(inventory.storyId, itemTemplateId);
    if (!template) {
      return {
        success: false,
        inventory,
        changes: { itemsAdded: [], itemsRemoved: [], itemsModified: [] },
        messages: [],
        errors: [`Item template ${itemTemplateId} not found in story ${inventory.storyId}`]
      };
    }

    // Check if item can be stacked
    const existingItem = inventory.items.find(item => 
      item.name === template.name && 
      item.type === template.type &&
      item.quantity < item.maxStack
    );

    const changes = {
      itemsAdded: [] as InventoryItem[],
      itemsRemoved: [] as InventoryItem[],
      itemsModified: [] as InventoryItem[]
    };

    if (existingItem && template.maxStack > 1) {
      // Stack with existing item
      const addAmount = Math.min(quantity, existingItem.maxStack - existingItem.quantity);
      existingItem.quantity += addAmount;
      changes.itemsModified.push(existingItem);
      quantity -= addAmount;
    }

    // Create new item instances for remaining quantity
    while (quantity > 0) {
      const itemQuantity = Math.min(quantity, template.maxStack);
      const newItem = this.createItemFromTemplate(template, { 
        quantity: itemQuantity,
        source 
      });
      
      inventory.items.push(newItem);
      inventory.currentWeight += newItem.weight * newItem.quantity;
      changes.itemsAdded.push(newItem);
      quantity -= itemQuantity;
    }

    await this.saveInventory(inventory);

    return {
      success: true,
      inventory,
      changes,
      messages: [`Added ${template.name} to inventory`],
    };
  }

  /**
   * Remove item from inventory
   */
  async removeItem(userId: string, sessionId: string, itemId: string, quantity: number = 1): Promise<InventoryActionResult> {
    const inventory = await this.getPlayerInventory(userId, sessionId);
    if (!inventory) {
      throw new Error('Inventory not found');
    }

    const itemIndex = inventory.items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
      return {
        success: false,
        inventory,
        changes: { itemsAdded: [], itemsRemoved: [], itemsModified: [] },
        messages: [],
        errors: ['Item not found in inventory']
      };
    }

    const item = inventory.items[itemIndex];
    const changes = {
      itemsAdded: [] as InventoryItem[],
      itemsRemoved: [] as InventoryItem[],
      itemsModified: [] as InventoryItem[]
    };

    if (item.quantity <= quantity) {
      // Remove entire item
      inventory.items.splice(itemIndex, 1);
      inventory.currentWeight -= item.weight * item.quantity;
      changes.itemsRemoved.push(item);
    } else {
      // Reduce quantity
      item.quantity -= quantity;
      inventory.currentWeight -= item.weight * quantity;
      changes.itemsModified.push(item);
    }

    await this.saveInventory(inventory);

    return {
      success: true,
      inventory,
      changes,
      messages: [`Removed ${quantity} ${item.name} from inventory`],
    };
  }

  /**
   * Use item from inventory
   */
  async useItem(userId: string, sessionId: string, itemId: string): Promise<InventoryActionResult> {
    const inventory = await this.getPlayerInventory(userId, sessionId);
    if (!inventory) {
      throw new Error('Inventory not found');
    }

    const item = inventory.items.find(item => item.id === itemId);
    if (!item) {
      return {
        success: false,
        inventory,
        changes: { itemsAdded: [], itemsRemoved: [], itemsModified: [] },
        messages: [],
        errors: ['Item not found in inventory']
      };
    }

    if (!item.consumable) {
      return {
        success: false,
        inventory,
        changes: { itemsAdded: [], itemsRemoved: [], itemsModified: [] },
        messages: [],
        errors: ['Item is not consumable']
      };
    }

    // Update last used time
    item.lastUsed = new Date();
    
    let result: InventoryActionResult;
    if (item.quantity <= 1) {
      // Remove item after use
      result = await this.removeItem(userId, sessionId, itemId, 1);
    } else {
      // Reduce quantity
      result = await this.removeItem(userId, sessionId, itemId, 1);
    }

    result.messages = [`Used ${item.name}`];
    return result;
  }

  /**
   * Validate if action can be performed
   */
  async validateAction(userId: string, sessionId: string, action: InventoryAction): Promise<InventoryValidation> {
    const inventory = await this.getPlayerInventory(userId, sessionId);
    if (!inventory) {
      return {
        canAdd: false,
        canRemove: false,
        canUse: false,
        canEquip: false,
        reasons: ['Inventory not found'],
        suggestions: []
      };
    }

    const item = inventory.items.find(item => item.id === action.itemId);
    
    switch (action.type) {
      case 'use':
        if (!item) {
          return {
            canAdd: false,
            canRemove: false,
            canUse: false,
            canEquip: false,
            reasons: ['Item not found in inventory'],
            suggestions: ['Check your inventory for available items']
          };
        }
        
        if (!item.consumable) {
          return {
            canAdd: false,
            canRemove: false,
            canUse: false,
            canEquip: false,
            reasons: ['Item is not consumable'],
            suggestions: ['Try equipping the item instead']
          };
        }
        
        return {
          canAdd: false,
          canRemove: false,
          canUse: true,
          canEquip: false,
          reasons: [],
          suggestions: []
        };

      case 'equip':
        if (!item) {
          return {
            canAdd: false,
            canRemove: false,
            canUse: false,
            canEquip: false,
            reasons: ['Item not found in inventory'],
            suggestions: ['Check your inventory for available items']
          };
        }
        
        if (!item.equipable) {
          return {
            canAdd: false,
            canRemove: false,
            canUse: false,
            canEquip: false,
            reasons: ['Item is not equipable'],
            suggestions: ['Try using the item instead']
          };
        }
        
        return {
          canAdd: false,
          canRemove: false,
          canUse: false,
          canEquip: true,
          reasons: [],
          suggestions: []
        };

      default:
        return {
          canAdd: true,
          canRemove: true,
          canUse: true,
          canEquip: true,
          reasons: [],
          suggestions: []
        };
    }
  }

  /**
   * Get formatted inventory summary for AI prompts
   */
  async getInventorySummary(userId: string, sessionId: string): Promise<string> {
    const inventory = await this.getPlayerInventory(userId, sessionId);
    if (!inventory || inventory.items.length === 0) {
      return "INVENTORY: Empty (no items)";
    }

    const itemsByType = inventory.items.reduce((acc, item) => {
      const key = item.type;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {} as Record<string, InventoryItem[]>);

    let summary = `INVENTORY (${inventory.items.length} items, ${inventory.gold} gold):\n`;
    
    for (const [type, items] of Object.entries(itemsByType)) {
      summary += `${type.toUpperCase()}: `;
      summary += items.map(item => 
        `${item.name}${item.quantity > 1 ? ` (${item.quantity})` : ''}`
      ).join(', ');
      summary += '\n';
    }

    if (inventory.equippedWeapon) {
      const weapon = inventory.items.find(item => item.id === inventory.equippedWeapon);
      if (weapon) summary += `EQUIPPED WEAPON: ${weapon.name}\n`;
    }

    if (inventory.equippedArmor) {
      const armor = inventory.items.find(item => item.id === inventory.equippedArmor);
      if (armor) summary += `EQUIPPED ARMOR: ${armor.name}\n`;
    }

    return summary.trim();
  }

  /**
   * Find item template by ID
   */
  private findItemTemplate(storyId: string, itemId: string): StoryItemTemplate | undefined {
    const templates = this.storyItemTemplates.get(storyId) || [];
    return templates.find(template => template.id === itemId);
  }

  /**
   * Get available items for a story
   */
  getStoryItems(storyId: string): StoryItemTemplate[] {
    return this.storyItemTemplates.get(storyId) || [];
  }

  /**
   * Check if player has specific item
   */
  async hasItem(userId: string, sessionId: string, itemName: string): Promise<boolean> {
    const inventory = await this.getPlayerInventory(userId, sessionId);
    if (!inventory) return false;
    
    return inventory.items.some(item => 
      item.name.toLowerCase().includes(itemName.toLowerCase()) ||
      item.category.toLowerCase().includes(itemName.toLowerCase())
    );
  }

  /**
   * Get items matching a query (for AI validation)
   */
  async findItems(userId: string, sessionId: string, query: string): Promise<InventoryItem[]> {
    const inventory = await this.getPlayerInventory(userId, sessionId);
    if (!inventory) return [];
    
    const queryLower = query.toLowerCase();
    return inventory.items.filter(item => 
      item.name.toLowerCase().includes(queryLower) ||
      item.category.toLowerCase().includes(queryLower) ||
      item.type.toLowerCase().includes(queryLower) ||
      item.properties.some(prop => prop.toLowerCase().includes(queryLower))
    );
  }

  /**
   * Create dynamic item from AI-generated specifications
   */
  private createDynamicItem(itemSpec: DynamicItemSpec, storyId: string): InventoryItem {
    // Generate unique ID for dynamic item
    const id = `dynamic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Determine item type based on context clues
    const itemType = this.determineItemType(itemSpec.name, itemSpec.description || '');
    
    // Generate stats based on context and rarity
    const stats = this.generateItemStats(itemSpec, itemType);
    
    return {
      id,
      name: itemSpec.name,
      description: itemSpec.description || `A ${itemSpec.name} discovered during your adventure.`,
      type: itemType,
      category: itemSpec.category || this.getCategoryFromType(itemType),
      rarity: itemSpec.rarity || 'common',
      quantity: itemSpec.quantity || 1,
      maxStack: itemSpec.maxStack || (itemType === 'consumable' ? 10 : 1),
      value: stats.value,
      weight: stats.weight,
      damage: stats.damage,
      defense: stats.defense,
      healing: stats.healing,
      durability: stats.durability,
      maxDurability: stats.maxDurability,
      magical: itemSpec.magical || false,
      cursed: itemSpec.cursed || false,
      properties: itemSpec.properties || [],
      usableInCombat: itemSpec.usableInCombat || false,
      consumable: itemType === 'consumable',
      equipable: itemType === 'weapon' || itemType === 'armor',
      iconUrl: itemSpec.iconUrl || '',
      source: itemSpec.source || 'found_in_world',
      storyId,
      acquiredAt: new Date()
    };
  }

  /**
   * Determine item type from name and description
   */
  private determineItemType(name: string, description: string): InventoryItem['type'] {
    const text = (name + ' ' + description).toLowerCase();
    
    if (text.includes('sword') || text.includes('blade') || text.includes('dagger') || 
        text.includes('axe') || text.includes('bow') || text.includes('staff') ||
        text.includes('weapon') || text.includes('sharp') || text.includes('blade')) {
      return 'weapon';
    }
    
    if (text.includes('armor') || text.includes('shield') || text.includes('helm') ||
        text.includes('breastplate') || text.includes('gauntlet') || text.includes('boots') ||
        text.includes('protection') || text.includes('defend')) {
      return 'armor';
    }
    
    if (text.includes('potion') || text.includes('elixir') || text.includes('drink') ||
        text.includes('consume') || text.includes('heal') || text.includes('restore')) {
      return 'consumable';
    }
    
    if (text.includes('tool') || text.includes('hammer') || text.includes('pick') ||
        text.includes('rope') || text.includes('utility') || text.includes('device')) {
      return 'tool';
    }
    
    if (text.includes('gem') || text.includes('jewel') || text.includes('gold') ||
        text.includes('treasure') || text.includes('valuable') || text.includes('precious')) {
      return 'treasure';
    }
    
    if (text.includes('key') || text.includes('letter') || text.includes('note') ||
        text.includes('document') || text.includes('scroll') || text.includes('map') ||
        text.includes('quest') || text.includes('important') || text.includes('tablet') ||
        text.includes('rune') || text.includes('symbol')) {
      return 'quest';
    }
    
    return 'misc';
  }

  /**
   * Generate item stats based on context and rarity
   */
  private generateItemStats(itemSpec: DynamicItemSpec, itemType: InventoryItem['type']): {
    value: number;
    weight: number;
    damage: number;
    defense: number;
    healing: number;
    durability: number;
    maxDurability: number;
  } {
    const rarity = itemSpec.rarity || 'common';
    const rarityMultiplier = {
      'common': 1,
      'uncommon': 1.5,
      'rare': 2,
      'epic': 3,
      'legendary': 5
    }[rarity] || 1;

    // Base stats by item type
    const baseStats = {
      weapon: { value: 50, weight: 2.5, damage: 10, defense: 0, healing: 0, durability: 100 },
      armor: { value: 75, weight: 5, damage: 0, defense: 10, healing: 0, durability: 150 },
      consumable: { value: 25, weight: 0.5, damage: 0, defense: 0, healing: 20, durability: 1 },
      tool: { value: 30, weight: 1.5, damage: 2, defense: 0, healing: 0, durability: 80 },
      treasure: { value: 100, weight: 1, damage: 0, defense: 0, healing: 0, durability: 999 },
      quest: { value: 0, weight: 0.1, damage: 0, defense: 0, healing: 0, durability: 999 },
      misc: { value: 10, weight: 1, damage: 0, defense: 0, healing: 0, durability: 50 }
    }[itemType];

    // Apply rarity multiplier and add some randomness
    const variance = 0.2; // ±20% variance
    const randomFactor = () => 1 + (Math.random() - 0.5) * variance;

    return {
      value: Math.round(baseStats.value * rarityMultiplier * randomFactor()),
      weight: Math.round(baseStats.weight * randomFactor() * 10) / 10,
      damage: Math.round(baseStats.damage * rarityMultiplier * randomFactor()),
      defense: Math.round(baseStats.defense * rarityMultiplier * randomFactor()),
      healing: Math.round(baseStats.healing * rarityMultiplier * randomFactor()),
      durability: Math.round(baseStats.durability * randomFactor()),
      maxDurability: Math.round(baseStats.durability * randomFactor())
    };
  }

  /**
   * Get category from item type
   */
  private getCategoryFromType(itemType: InventoryItem['type']): string {
    const categoryMap = {
      weapon: 'weapons',
      armor: 'armor',
      consumable: 'consumables',
      tool: 'tools',
      treasure: 'treasures',
      quest: 'quest_items',
      misc: 'miscellaneous'
    };
    return categoryMap[itemType] || 'miscellaneous';
  }

  /**
   * Add dynamic item to inventory (for AI-generated items)
   */
  async addDynamicItem(userId: string, sessionId: string, itemSpec: DynamicItemSpec): Promise<InventoryActionResult> {
    const inventory = await this.getPlayerInventory(userId, sessionId);
    if (!inventory) {
      throw new Error('Inventory not found');
    }

    // Create dynamic item
    const dynamicItem = this.createDynamicItem(itemSpec, inventory.storyId);
    
    const changes = {
      itemsAdded: [dynamicItem] as InventoryItem[],
      itemsRemoved: [] as InventoryItem[],
      itemsModified: [] as InventoryItem[]
    };

    // Add to inventory
    inventory.items.push(dynamicItem);
    inventory.currentWeight += dynamicItem.weight * dynamicItem.quantity;

    await this.saveInventory(inventory);

    return {
      success: true,
      inventory,
      changes,
      messages: [`Found ${dynamicItem.name}!`],
    };
  }
}