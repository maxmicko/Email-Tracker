const { generate } = require('./html-generator');
const { signString } = require('./signer');
const { v4: uuidv4 } = require('uuid');

const message = {
  id: uuidv4(),
  links: [],
  htmlBody: '<p>Your email content here.</p>'
};

const result = generate(message);
console.log('Generated Snippet:');
console.log(result.html);
console.log('Message ID:', result.id);
console.log('Pixel URL:', result.html.match(/src="([^"]+)"/)[1]);