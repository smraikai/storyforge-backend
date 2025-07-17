// Simple test script to verify inventory system
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testInventorySystem() {
  console.log('🧪 Testing Inventory System...');
  
  try {
    // Test 1: Get story items
    console.log('1. Getting story items...');
    const storyItemsResponse = await axios.get(`${BASE_URL}/api/inventory/story/training-grounds/items`);
    console.log(`✅ Found ${storyItemsResponse.data.count} items for training-grounds story`);
    
    // Test 2: Initialize inventory (this would require auth in real usage)
    console.log('2. Testing inventory initialization...');
    const testSessionId = 'test-session-' + Date.now();
    
    // Skip auth-required tests in this simple script
    console.log('⚠️ Skipping auth-required tests (initialize, add, remove, use items)');
    console.log('   These would require proper Firebase authentication');
    
    // Test 3: Test story generation with inventory context
    console.log('3. Testing story generation with inventory context...');
    const storyResponse = await axios.post(`${BASE_URL}/api/story/training-grounds/generate-rag`, {
      userMessage: "I want to attack the training dummy with my sword",
      conversationHistory: [],
      actionType: "combat",
      sessionId: testSessionId
    });
    
    console.log('✅ Story generated successfully');
    console.log('📖 Response:', storyResponse.data.response.narrative.substring(0, 200) + '...');
    
    console.log('\n🎉 Inventory system test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

// Run the test
testInventorySystem();