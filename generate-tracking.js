// generate-tracking.js
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const { signString } = require('./signer');

function generateTrackingSnippet(campaignName = 'Manual Campaign') {
  const messageId = uuidv4();
  const pixelSig = signString(`m=${messageId}`);
  const pixelUrl = `${process.env.APP_BASE}/pixel?m=${messageId}&sig=${pixelSig}`;
  
  const trackingHtml = `
<!-- Orbitl Email Tracking -->
<img src="${pixelUrl}" width="1" height="1" style="display:none;max-height:1px;max-width:1px" alt="" />
<!-- End Orbitl Tracking -->
  `.trim();

  // Save to database
  const supabase = require('./supabase-api');
  supabase.insert('messages', {
    id: messageId,
    to_email: 'manual@campaign.com', // Placeholder
    subject: campaignName,
    sent_at: new Date().toISOString(),
    metadata: {
      campaign: campaignName,
      manual: true,
      sent_at: new Date().toISOString()
    }
  }).catch(console.error);

  return {
    messageId,
    trackingHtml,
    instructions: `
Copy and paste this code into your email HTML:

${trackingHtml}

Track opens at: ${process.env.APP_BASE}/dashboard
    `.trim()
  };
}

// Also create a link wrapper function
function wrapLinkWithTracking(url, messageId, linkIndex) {
  const sig = signString(`m=${messageId}|l=${linkIndex}`);
  return `${process.env.APP_BASE}/click?m=${messageId}&l=${linkIndex}&sig=${sig}&url=${encodeURIComponent(url)}`;
}

module.exports = { generateTrackingSnippet, wrapLinkWithTracking };

// CLI usage
if (require.main === module) {
  const campaignName = process.argv[2] || 'Manual Campaign';
  const result = generateTrackingSnippet(campaignName);
  
  console.log('🎯 Orbitl Tracking Snippet\n');
  console.log('Campaign:', campaignName);
  console.log('Message ID:', result.messageId);
  console.log('\n📧 HTML Snippet:');
  console.log(result.trackingHtml);
  console.log('\n📊 View tracking at:', `${process.env.APP_BASE}/dashboard`);
}