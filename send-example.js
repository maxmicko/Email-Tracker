// final-test.js
require('dotenv').config();
const { send } = require('./send-example');

async function finalTest() {
  console.log('🎯 FINAL EMAIL TRACKING TEST\n');
  
  try {
    const result = await send(
      'maxmicko2905@gmail.com', // Your actual email
      '🚀 Orbitl - Email Tracking Test', 
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Welcome to Orbitl!</h1>
        <p>This is a test email to verify that email tracking is working correctly.</p>
        
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>📊 Tracking Features Test</h3>
          <p>Click the links below to test click tracking:</p>
          <ul>
            <li><a href="{{link0}}" style="color: #2563eb;">Visit Our Website</a></li>
            <li><a href="{{link1}}" style="color: #2563eb;">View Pricing</a></li>
            <li><a href="{{link2}}" style="color: #2563eb;">Contact Support</a></li>
          </ul>
        </div>
        
        <p><strong>Open tracking:</strong> This email contains a hidden tracking pixel that will record when you open it.</p>
        <p><strong>Click tracking:</strong> All links are wrapped with tracking to record clicks.</p>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
          <small style="color: #6b7280;">
            This is a test email from your Orbitl email tracking system.<br>
            You can safely ignore this email if you received it by mistake.
          </small>
        </div>
      </div>
      `,
      [
        'https://orbitl.cc',
        'https://orbitl.cc/pricing',
        'https://orbitl.cc/contact'
      ]
    );
    
    console.log('✅ EMAIL SENT SUCCESSFULLY!');
    console.log('📧 Message ID:', result.messageId);
    console.log('🔗 Tracking enabled for all links and opens');
    console.log('\n📊 Next steps:');
    console.log('   1. Check your email inbox');
    console.log('   2. Open the email (this will be tracked)');
    console.log('   3. Click the links (this will be tracked)');
    console.log('   4. Check the dashboard: http://localhost:3000/dashboard');
    
  } catch (error) {
    console.error('❌ FAILED TO SEND EMAIL:');
    console.error('Error:', error.message);
    
    if (error.response) {
      console.error('SMTP details:', error.response);
    }
  }
}

finalTest();