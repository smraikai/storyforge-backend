export interface NewsItem {
  id: string;
  title: string;
  subtitle: string;
  content: string;
  date: string; // ISO date string
  type: NewsType;
  imageURL?: string;
  backgroundImage: string;
  isActive: boolean;
  priority: number; // Higher numbers shown first
}

export enum NewsType {
  NEW_STORY = 'new_story',
  UPDATE = 'update',
  EVENT = 'event',
  FEATURE = 'feature'
}

export const sampleNewsItems: NewsItem[] = [
  {
    id: '1',
    title: 'New Fantasy Epic: The Dragon\'s Crown',
    subtitle: 'An epic tale of magic and dragons awaits!',
    content: `Embark on an epic fantasy adventure in "The Dragon's Crown," a thrilling tale that combines classic storytelling with cutting-edge AI narrative generation.

In this immersive experience, you'll navigate through ancient kingdoms, encounter mystical creatures, and make choices that shape the destiny of entire realms. The story adapts to your decisions, creating a unique adventure every time you play.

Our advanced AI storytelling engine ensures that every character interaction feels authentic, every plot twist serves the greater narrative, and every choice you make has meaningful consequences that ripple throughout your journey.`,
    date: new Date().toISOString(),
    type: NewsType.NEW_STORY,
    backgroundImage: 'fantasy-bg',
    isActive: true,
    priority: 100
  },
  {
    id: '2',
    title: 'StoryForge 2.0 Released',
    subtitle: 'Enhanced AI storytelling with deeper narratives',
    content: `StoryForge 2.0 represents a major leap forward in AI-powered interactive storytelling. This update introduces several groundbreaking features that will transform how you experience narrative adventures.

Key improvements include enhanced character development systems, more sophisticated plot branching, improved dialogue generation, and a completely redesigned user interface that puts the story first.

The new engine can now handle complex multi-character scenes, generate more nuanced emotional responses, and create deeper, more interconnected storylines that respond dynamically to your choices.`,
    date: new Date(Date.now() - 86400000).toISOString(),
    type: NewsType.UPDATE,
    backgroundImage: 'tech-bg',
    isActive: true,
    priority: 90
  },
  {
    id: '3',
    title: 'Community Event: Write Your Story',
    subtitle: 'Join our creative writing challenge this weekend',
    content: `Join thousands of creative writers and storytelling enthusiasts in our biggest community event yet! "Write Your Story" is a weekend-long celebration of creativity, imagination, and the art of narrative.

Participate in writing challenges, attend virtual workshops led by renowned authors, and collaborate with other writers on exciting group projects. Whether you're a seasoned storyteller or just starting your writing journey, this event has something for everyone.

Winners of our writing challenges will have their stories featured in the StoryForge community gallery and receive exclusive access to advanced storytelling tools.`,
    date: new Date(Date.now() - 172800000).toISOString(),
    type: NewsType.EVENT,
    backgroundImage: 'community-bg',
    isActive: true,
    priority: 80
  },
  {
    id: '4',
    title: 'Featured Author: Sarah Chen',
    subtitle: 'Discover the mind behind \'Cyber Dreams\'',
    content: `Meet Sarah Chen, the brilliant mind behind "Cyber Dreams" and one of StoryForge's most celebrated community authors. Sarah's innovative approach to science fiction storytelling has captivated thousands of readers and set new standards for interactive narrative design.

In this exclusive feature, Sarah shares her creative process, discusses the inspiration behind her most popular stories, and offers advice for aspiring writers looking to make their mark in the world of interactive fiction.

"The key to great interactive storytelling," Sarah explains, "is understanding that every choice the reader makes is an opportunity to deepen their connection with the characters and world you've created."`,
    date: new Date(Date.now() - 259200000).toISOString(),
    type: NewsType.FEATURE,
    backgroundImage: 'author-bg',
    isActive: true,
    priority: 70
  }
];