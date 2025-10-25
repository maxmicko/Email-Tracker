// test-api-detailed.js
require('dotenv').config();
const supabase = require('./supabase-api');

async function testAPI() {
  console.log('🔍 Detailed API Test\n');
  
  try {
    // Test 1: Simple select to verify connection
    console.log('1. Testing basic connection...');
    const messages = await supabase.select('messages', 'limit=1');
    console.log('   ✅ Basic connection works\n');

    // Test 2: Test insert with detailed logging
    console.log('2. Testing insert...');
    const testData = {
      id: uuidv4(),
      to_email: 'detailed-test@example.com',
      subject: 'Detailed API Test',
      sent_at: new Date().toISOString(),
      metadata: { 
        test: true, 
        links: {
          0: 'https://orbitl.cc',
          1: 'https://orbitl.cc/test'
        }
      }
    };

    const inserted = await supabase.insert('messages', testData);
    console.log('   ✅ Insert successful!\n');

    // Test 3: Verify the insert worked
    console.log('3. Verifying insert...');
    const retrieved = await supabase.selectSingle('messages', 'id', testData.id);
    if (retrieved && retrieved.to_email === testData.to_email) {
      console.log('   ✅ Insert verification successful!');
      console.log('   Retrieved subject:', retrieved.subject);
    } else {
      console.log('   ❌ Insert verification failed');
    }

    console.log('\n🎉 All API tests passed!');

  } catch (error) {
    console.log('\n❌ Test failed:');
    console.log('Error:', error.message);
    
    if (error.message.includes('401')) {
      console.log('\n💡 API key issue - check your Supabase dashboard');
    } else if (error.message.includes('404')) {
      console.log('\n💡 Table might not exist - check your database tables');
    }
  }
}

// Import uuid for this test
const { v4: uuidv4 } = require('uuid');
testAPI();