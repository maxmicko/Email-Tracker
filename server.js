// server.js - DEBUG VERSION FOR OPENS
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');
const { verifyString } = require('./signer');
const supabase = require('./supabase-api');

const app = express();
app.use(helmet());
app.set('trust proxy', true);

// Your Vercel domain
const APP_DOMAIN = 'https://email-tracker-flax-psi.vercel.app';

const ONE_PIXEL_GIF = Buffer.from('R0lGODlhAQABAPAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const { data, error } = await supabase.select('messages', 'limit=1');
    res.json({ 
      status: 'ok', 
      database: error ? 'error' : 'connected',
      message: error ? error.message : 'All systems operational',
      domain: APP_DOMAIN
    });
  } catch (error) {
    res.json({ 
      status: 'error', 
      database: 'disconnected',
      message: error.message 
    });
  }
});

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
}

// Pixel tracking endpoint - DEBUG VERSION
app.get('/pixel', async (req, res) => {
  console.log('🔍 Pixel hit - Query params:', req.query);
  console.log('🔍 Headers - User-Agent:', req.get('User-Agent'));
  console.log('🔍 Headers - Referer:', req.get('Referer'));
  
  const { m, sig } = req.query;
  
  if (!m) {
    console.log('❌ Missing message ID (m) parameter');
    return res.status(400).end();
  }
  
  if (!sig) {
    console.log('❌ Missing signature (sig) parameter');
    return res.status(400).end();
  }
  
  const verificationString = `m=${m}`;
  const isValidSig = verifyString(verificationString, sig);
  
  console.log('🔍 Signature verification:', {
    messageId: m,
    signature: sig,
    verificationString: verificationString,
    isValid: isValidSig
  });
  
  if (!isValidSig) {
    console.log('❌ Invalid signature');
    return res.status(400).end();
  }
  
  console.log('✅ Signature valid, tracking open...');
  
  // Track the open
  try {
    const openData = {
      id: uuidv4(),
      message_id: m,
      opened_at: new Date().toISOString(),
      ip: clientIp(req),
      ua: req.get('User-Agent') || '',
      referer: req.get('Referer') || ''
    };
    
    console.log('💾 Saving open data:', openData);
    
    const result = await supabase.insert('opens', openData);
    console.log('✅ Open tracked successfully:', result);
    
  } catch (error) {
    console.error('❌ Error tracking open:', error.message);
    console.error('Full error:', error);
  }
  
  // Return the tracking pixel
  res.set({
    'Content-Type': 'image/gif',
    'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Access-Control-Allow-Origin': '*'
  });
  res.send(ONE_PIXEL_GIF);
});

// Click tracking endpoint
app.get('/click', async (req, res) => {
  console.log('🔍 Click hit - Query params:', req.query);
  
  const { m, l, sig } = req.query;
  
  if (!m || !l || !sig) {
    console.log('❌ Missing required parameters');
    return res.status(400).send('Invalid tracking link');
  }
  
  const verificationString = `m=${m}|l=${l}`;
  const isValidSig = verifyString(verificationString, sig);
  
  console.log('🔍 Click signature verification:', {
    isValid: isValidSig,
    verificationString: verificationString
  });
  
  if (!isValidSig) {
    console.log('❌ Invalid click signature');
    return res.status(400).send('Invalid tracking link');
  }
  
  try {
    // Get the message to find the original URL
    console.log('🔍 Fetching message:', m);
    const message = await supabase.selectSingle('messages', 'id', m);
    
    if (!message) {
      console.log('❌ Message not found:', m);
      return res.status(404).send('Message not found');
    }
    
    const links = message.metadata?.links || {};
    const url = links[l] || links[Number(l)] || 'https://orbitl.cc/';
    
    console.log('🔍 Redirecting to:', url);
    
    // Track the click
    try {
      const clickData = {
        id: uuidv4(),
        message_id: m,
        url: url,
        clicked_at: new Date().toISOString(),
        ip: clientIp(req),
        ua: req.get('User-Agent') || ''
      };
      
      console.log('💾 Saving click data:', clickData);
      await supabase.insert('clicks', clickData);
      console.log('✅ Click tracked successfully');
      
    } catch (error) {
      console.error('❌ Error tracking click:', error.message);
    }
    
    // Redirect to the original URL
    res.redirect(url);
    
  } catch (error) {
    console.error('❌ Click tracking error:', error);
    res.status(500).send('Server error');
  }
});

// Test endpoint to verify pixel works
app.get('/test-pixel', (req, res) => {
  const testHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Pixel Test</title>
</head>
<body>
    <h1>Pixel Test Page</h1>
    <p>This page includes a tracking pixel.</p>
    
    <!-- Test tracking pixel -->
    <img src="${APP_DOMAIN}/pixel?m=test-message-123&sig=test-signature" 
         alt="" width="1" height="1" style="display:none;" />
    
    <p>Check your server logs to see if the pixel was hit.</p>
    
    <script>
        console.log('Test page loaded');
    </script>
</body>
</html>
  `;
  res.send(testHtml);
});

// Dashboard endpoint
app.get('/dashboard', async (req, res) => {
  try {
    const { data: messages, error } = await supabase.select('messages', 'order=sent_at.desc&limit=20');
    
    if (error) throw error;
    
    let dashboardData = [];
    
    for (const message of messages) {
      const { data: opens } = await supabase.select('opens', `message_id=eq.${message.id}`);
      const { data: clicks } = await supabase.select('clicks', `message_id=eq.${message.id}`);
      
      dashboardData.push({
        ...message,
        opens: opens?.length || 0,
        clicks: clicks?.length || 0
      });
    }
    
    res.json({
      status: 'success',
      data: dashboardData,
      domain: APP_DOMAIN
    });
    
  } catch (error) {
    res.json({
      status: 'error',
      message: error.message
    });
  }
});

// Debug endpoint to see all opens
app.get('/debug-opens', async (req, res) => {
  try {
    const { data: opens, error } = await supabase.select('opens', 'order=opened_at.desc&limit=50');
    
    if (error) throw error;
    
    res.json({
      status: 'success',
      count: opens?.length || 0,
      opens: opens || []
    });
    
  } catch (error) {
    res.json({
      status: 'error',
      message: error.message
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Email Tracker API',
    domain: APP_DOMAIN,
    endpoints: {
      health: '/health',
      dashboard: '/dashboard', 
      pixel: '/pixel?m=MESSAGE_ID&sig=SIGNATURE',
      click: '/click?m=MESSAGE_ID&l=LINK_INDEX&sig=SIGNATURE',
      test: '/test-pixel',
      debug: '/debug-opens'
    },
    status: 'operational'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Email tracker server running on port ${PORT}`);
  console.log(`✅ Domain: ${APP_DOMAIN}`);
  console.log(`📊 Health: ${APP_DOMAIN}/health`);
  console.log(`📈 Dashboard: ${APP_DOMAIN}/dashboard`);
  console.log(`🐛 Test Pixel: ${APP_DOMAIN}/test-pixel`);
  console.log(`🔍 Debug Opens: ${APP_DOMAIN}/debug-opens`);
});