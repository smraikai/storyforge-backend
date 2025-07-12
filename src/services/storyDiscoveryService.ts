import path from 'path';
import fs from 'fs/promises';

export interface StoryMetadata {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  estimatedDuration: string;
  tags: string[];
  systemPrompt: string;
  startingPrompt: string;
  created: string;
  updated: string;
}

export class StoryDiscoveryService {
  private storiesPath: string;

  constructor() {
    this.storiesPath = path.join(__dirname, '../../data/stories');
  }

  /**
   * Get all available stories
   */
  async getAllStories(): Promise<StoryMetadata[]> {
    try {
      const storyDirectories = await fs.readdir(this.storiesPath, { withFileTypes: true });
      const stories: StoryMetadata[] = [];

      for (const dir of storyDirectories) {
        if (dir.isDirectory()) {
          try {
            const storyPath = path.join(this.storiesPath, dir.name, 'story.json');
            const storyData = JSON.parse(await fs.readFile(storyPath, 'utf-8'));
            stories.push(storyData);
          } catch (error) {
            console.warn(`⚠️ Could not load story from ${dir.name}:`, (error as Error).message);
          }
        }
      }

      console.log(`✅ Loaded ${stories.length} available stories`);
      return stories.sort((a, b) => a.name.localeCompare(b.name));

    } catch (error) {
      console.error('❌ Error loading stories:', error);
      return [];
    }
  }

  /**
   * Get specific story metadata
   */
  async getStory(storyId: string): Promise<StoryMetadata | null> {
    try {
      const storyPath = path.join(this.storiesPath, storyId, 'story.json');
      const storyData = JSON.parse(await fs.readFile(storyPath, 'utf-8'));
      
      console.log(`✅ Loaded story: ${storyData.name}`);
      return storyData;

    } catch (error) {
      console.error(`❌ Error loading story ${storyId}:`, error);
      return null;
    }
  }

  /**
   * Check if story exists
   */
  async storyExists(storyId: string): Promise<boolean> {
    try {
      const storyPath = path.join(this.storiesPath, storyId, 'story.json');
      await fs.access(storyPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get story summary for menu display
   */
  async getStorySummaries(): Promise<Array<{
    id: string;
    name: string;
    description: string;
    thumbnail: string;
    estimatedDuration: string;
    tags: string[];
  }>> {
    const stories = await this.getAllStories();
    
    return stories.map(story => ({
      id: story.id,
      name: story.name,
      description: story.description,
      thumbnail: story.thumbnail,
      estimatedDuration: story.estimatedDuration,
      tags: story.tags
    }));
  }
}