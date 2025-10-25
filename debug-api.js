// debug-api.js
require('dotenv').config();

async function debugAPI() {
  console.log('🔍 Debugging API Connection\n');
  
  try {
    // Test the API endpoint directly
    const response = await fetch('http://localhost:3001/api/stats');
    console.log('📡 API Response Status:', response.status);
    
    const data = await response.json();
    console.log('📦 API Response Data:', JSON.stringify(data, null, 2));
    
    if (data.campaigns && data.campaigns.length > 0) {
      console.log('\n✅ Campaigns found in API response');
    } else {
      console.log('\n❌ No campaigns in API response');
    }
    
  } catch (error) {
    console.log('❌ API call failed:', error.message);
  }
}

debugAPI();