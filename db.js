// check-deps.js
console.log('🔍 Checking dependencies...');

try {
  const fs = require('fs');
  
  // Check which files require db.js
  const files = ['server.js', 'send-example.js', 'html-generator.js'];
  
  files.forEach(file => {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes("require('./db')")) {
        console.log(`❌ ${file} still requires db.js`);
      } else {
        console.log(`✅ ${file} does not require db.js`);
      }
    }
  });
  
} catch (error) {
  console.log('Error:', error.message);
}