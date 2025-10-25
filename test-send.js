// test-send.js
require('dotenv').config();
const { send } = require('./send-example');

async function test() {
  try {
    const result = await send(
      'test@example.com', 
      'Test Email', 
      '<p>Hello! Click <a href="{{link0}}">this link</a> to test.</p>',
      ['https://orbitl.cc']
    );
    console.log('Email sent successfully!');
    console.log('Message ID:', result.messageId);
  } catch (error) {
    console.error('Error sending email:', error.message);
    if (error.response) {
      console.error('SMTP response:', error.response);
    }
  }
}

test();