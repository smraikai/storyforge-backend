import { EnhancedStoryPromptService } from '../services/enhancedStoryPromptService';

/**
 * Test suite for Enhanced RAG System
 */
async function testEnhancedRAG() {
  console.log('🧪 Starting Enhanced RAG System Tests...\n');

  const service = new EnhancedStoryPromptService();
  const storyId = 'whispering-woods';
  const sessionId = 'test-session-1';

  try {
    // Test 1: Load story content
    console.log('📚 Test 1: Loading story content...');
    const documents = await service.loadStoryContent(storyId);
    console.log(`✅ Loaded ${documents.length} documents`);
    console.log(`   - Characters: ${documents.filter(d => d.metadata.type === 'character').length}`);
    console.log(`   - Locations: ${documents.filter(d => d.metadata.type === 'location').length}`);
    console.log(`   - Story Beats: ${documents.filter(d => d.metadata.type === 'story_beat').length}`);
    console.log(`   - Lore: ${documents.filter(d => d.metadata.type === 'lore').length}\n`);

    // Test 2: Search story context
    console.log('🔍 Test 2: Searching story context...');
    const searchResults = await service.searchStoryContext(
      storyId,
      sessionId,
      'look around the forest',
      5
    );
    console.log(`✅ Found ${searchResults.length} context results`);
    searchResults.forEach((result, index) => {
      console.log(`   ${index + 1}. ${result.metadata.category}:${result.metadata.name || result.metadata.title} (Score: ${result.relevanceScore + result.relationshipScore + result.storyRelevanceScore})`);
    });
    console.log('');

    // Test 3: Generate enhanced prompt (exploration)
    console.log('🎭 Test 3: Generating enhanced prompt (exploration)...');
    const promptResult1 = await service.generateEnhancedPrompt(
      storyId,
      sessionId,
      'I look around the forest carefully',
      [],
      'exploration'
    );
    console.log(`✅ Generated prompt with ${promptResult1.contextUsed.length} context items`);
    console.log(`   - Triggered beats: ${promptResult1.triggeredBeats.join(', ') || 'None'}`);
    console.log(`   - Story state: ${JSON.stringify(promptResult1.storyState)}`);
    console.log('');

    // Test 4: Generate enhanced prompt (dialogue)
    console.log('🗣️ Test 4: Generating enhanced prompt (dialogue)...');
    const promptResult2 = await service.generateEnhancedPrompt(
      storyId,
      sessionId,
      'I call out "Hello, is anyone there?"',
      [
        { role: 'narrator', content: 'You find yourself in a mystical forest.' },
        { role: 'user', content: 'I look around the forest carefully' }
      ],
      'dialogue'
    );
    console.log(`✅ Generated prompt with ${promptResult2.contextUsed.length} context items`);
    console.log(`   - Triggered beats: ${promptResult2.triggeredBeats.join(', ') || 'None'}`);
    console.log(`   - Story state: ${JSON.stringify(promptResult2.storyState)}`);
    console.log('');

    // Test 5: Check story state debugging
    console.log('🔬 Test 5: Story state debugging...');
    const storyState = await service.getStoryStateDebug(storyId, sessionId);
    console.log(`✅ Story state retrieved:`);
    console.log(`   - Current location: ${storyState.currentLocation}`);
    console.log(`   - Known characters: ${storyState.discoveredCharacters.join(', ') || 'None'}`);
    console.log(`   - Completed beats: ${storyState.completedBeats.length}`);
    console.log(`   - Player choices: ${storyState.playerChoices.length}`);
    console.log('');

    // Test 6: Check available beats
    console.log('🎯 Test 6: Available story beats...');
    const availableBeats = await service.getAvailableBeatsDebug(storyId, sessionId);
    console.log(`✅ Found ${availableBeats.length} available beats:`);
    availableBeats.forEach((beat, index) => {
      console.log(`   ${index + 1}. ${beat.name} (${beat.type})`);
    });
    console.log('');

    // Test 7: Context quality test
    console.log('🎯 Test 7: Context quality for specific scenarios...');
    const testScenarios = [
      { query: 'Whiskers the cat', expected: 'character' },
      { query: 'Shadow Vale', expected: 'location' },
      { query: 'Crystal of Eternal Spring', expected: 'story_beat' },
      { query: 'Thornwick corruption', expected: 'character' }
    ];

    for (const scenario of testScenarios) {
      const results = await service.searchStoryContext(storyId, sessionId, scenario.query, 3);
      const topResult = results[0];
      console.log(`   Query: "${scenario.query}" -> Top result: ${topResult?.metadata.category}:${topResult?.metadata.name || topResult?.metadata.title}`);
    }
    console.log('');

    console.log('🎉 All Enhanced RAG tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testEnhancedRAG();
}

export { testEnhancedRAG };