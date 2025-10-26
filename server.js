// server.js - COMPLETE VERSION WITH PNG PIXELS
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');
const { verifyString, signString } = require('./signer');
const supabase = require('./supabase-api');

const app = express();
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));
app.set('trust proxy', true);

// Your local domain
const APP_DOMAIN = 'http://localhost:3000';

// PNG tracking pixel - more reliable than GIF
const PNG_PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

// Security: Restrict to your Vercel domain
const ALLOWED_DOMAINS = [
  'https://email-tracker-flax-psi.vercel.app',
  'email-tracker-flax-psi.vercel.app'
];

// Middleware to restrict access to allowed domains only
app.use((req, res, next) => {
  const origin = req.get('origin');
  const host = req.get('host');
  const referer = req.get('referer');
  
  const isAllowedOrigin = origin && ALLOWED_DOMAINS.some(domain => origin.includes(domain));
  const isAllowedHost = host && ALLOWED_DOMAINS.some(domain => host.includes(domain));
  const isAllowedReferer = !referer || ALLOWED_DOMAINS.some(domain => referer.includes(domain));
  
  // Allow health checks and tracking endpoints (pixel/click) from anywhere since they're called from emails
  const isTrackingEndpoint = req.path === '/pixel' || req.path === '/click' || req.path === '/track';
  const isHealthCheck = req.path === '/health';
  
  if (isTrackingEndpoint || isHealthCheck) {
    return next();
  }
  
  // For all other endpoints, restrict to allowed domains
  if (!isAllowedOrigin && !isAllowedHost && !isAllowedReferer) {
    return res.status(403).json({
      error: 'Access forbidden',
      message: 'This service is only accessible from the authorized domain'
    });
  }
  
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const { data, error } = await supabase.select('messages', 'limit=1');
    res.json({ 
      status: 'ok', 
      database: error ? 'error' : 'connected',
      message: error ? error.message : 'All systems operational',
      domain: APP_DOMAIN,
      pixel_type: 'PNG'
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

// SVG Pixel tracking endpoint
app.get('/pixel', async (req, res) => {
  const { m, sig } = req.query;
  
  console.log('🔍 PNG Pixel hit:', { m, sig, ip: clientIp(req) });
  
  if (!m || !sig || !verifyString(`m=${m}`, sig)) {
    console.log('❌ Invalid PNG pixel request');
    // Still return a valid PNG but don't track
    res.set({
      'Content-Type': 'image/png',
      'Content-Length': PNG_PIXEL.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Access-Control-Allow-Origin': '*'
    });
    return res.send(PNG_PIXEL);
  }
  
  // Track the open asynchronously
  (async () => {
    try {
      const openData = {
        id: uuidv4(),
        message_id: m,
        opened_at: new Date().toISOString(),
        ip: clientIp(req),
        ua: req.get('User-Agent') || '',
        referer: req.get('Referer') || ''
      };
      
      console.log('💾 Tracking open:', { message_id: m, ip: openData.ip });
      const result = await supabase.insert('opens', openData);
      console.log('✅ Open tracked successfully');
      
    } catch (error) {
      console.error('❌ Error tracking open:', error.message);
    }
  })();
  
  // Return the PNG tracking pixel
  res.set({
    'Content-Type': 'image/png',
    'Content-Length': PNG_PIXEL.length,
    'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Access-Control-Allow-Origin': '*'
  });
  
  res.send(PNG_PIXEL);
});

// Alternative tracking endpoint (backward compatibility)
app.get('/track', async (req, res) => {
  const { m, sig } = req.query;
  
  console.log('🔍 Track endpoint hit:', { m, sig });
  
  if (!m || !sig || !verifyString(`m=${m}`, sig)) {
    res.set({
      'Content-Type': 'image/png',
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0'
    });
    return res.send(PNG_PIXEL);
  }
  
  // Track the open
  (async () => {
    try {
      await supabase.insert('opens', {
        id: uuidv4(),
        message_id: m,
        opened_at: new Date().toISOString(),
        ip: clientIp(req),
        ua: req.get('User-Agent') || '',
        referer: req.get('Referer') || ''
      });
    } catch (error) {
      console.error('Error tracking open (track endpoint):', error.message);
    }
  })();
  
  res.set({
    'Content-Type': 'image/png',
    'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0'
  });
  res.send(PNG_PIXEL);
});

// Click tracking endpoint
app.get('/click', async (req, res) => {
  const { m, l, sig } = req.query;
  
  console.log('🔍 Click hit:', { m, l, sig, ip: clientIp(req) });
  
  if (!m || !l || !sig || !verifyString(`m=${m}|l=${l}`, sig)) {
    console.log('❌ Invalid click signature');
    return res.status(400).send('Invalid tracking link');
  }
  
  try {
    // Get the message to find the original URL
    const message = await supabase.selectSingle('messages', 'id', m);
    
    if (!message) {
      console.log('❌ Message not found:', m);
      return res.status(404).send('Message not found');
    }
    
    const links = message.metadata?.links || {};
    const url = links[l] || links[Number(l)] || 'https://orbitl.cc/';
    
    console.log('🔍 Redirecting to:', url);
    
    // Track the click asynchronously
    (async () => {
      try {
        const clickData = {
          id: uuidv4(),
          message_id: m,
          url: url,
          clicked_at: new Date().toISOString(),
          ip: clientIp(req),
          ua: req.get('User-Agent') || ''
        };
        
        console.log('💾 Tracking click:', { message_id: m, url: url });
        await supabase.insert('clicks', clickData);
        console.log('✅ Click tracked successfully');
        
      } catch (error) {
        console.error('❌ Error tracking click:', error.message);
      }
    })();
    
    // Redirect to the original URL
    res.redirect(url);
    
  } catch (error) {
    console.error('❌ Click tracking error:', error);
    res.status(500).send('Server error');
  }
});

// API endpoints for dashboard
app.get('/api/stats', async (req, res) => {
  console.log('📊 API called - fetching stats...');
  
  try {
    const { data: messages, error } = await supabase.select('messages', 'order=sent_at.desc&limit=50');
    
    if (error) {
      console.log('❌ Database error:', error);
      return res.json({
        total_campaigns: 0,
        total_opens: 0,
        total_clicks: 0,
        campaigns: [],
        error: error.message
      });
    }

    console.log(`✅ Found ${messages?.length || 0} messages`);

    if (!messages || messages.length === 0) {
      return res.json({
        total_campaigns: 0,
        total_opens: 0,
        total_clicks: 0,
        campaigns: []
      });
    }

    const campaigns = [];
    let totalOpens = 0;
    let totalClicks = 0;
    
    for (const message of messages) {
      // Get opens count
      const { count: opensCount, error: opensError } = await supabase
        .from('opens')
        .select('*', { count: 'exact', head: true })
        .eq('message_id', message.id);

      // Get clicks count  
      const { count: clicksCount, error: clicksError } = await supabase
        .from('clicks')
        .select('*', { count: 'exact', head: true })
        .eq('message_id', message.id);

      const opens = opensError ? 0 : (opensCount || 0);
      const clicks = clicksError ? 0 : (clicksCount || 0);
      
      totalOpens += opens;
      totalClicks += clicks;

      campaigns.push({
        id: message.id,
        subject: message.subject || 'Unnamed Campaign',
        sent_at: message.sent_at,
        opens: opens,
        clicks: clicks,
        open_rate: opens > 0 ? ((opens * 100).toFixed(1) + '%') : '0%'
      });
    }

    const response = {
      total_campaigns: campaigns.length,
      total_opens: totalOpens,
      total_clicks: totalClicks,
      campaigns: campaigns,
      pixel_type: 'PNG'
    };

    console.log('✅ Sending stats response');
    res.json(response);

  } catch (error) {
    console.log('❌ API error:', error);
    res.status(500).json({ 
      error: error.message,
      total_campaigns: 0,
      total_opens: 0,
      total_clicks: 0,
      campaigns: []
    });
  }
});

// Get detailed opens for a specific campaign
app.get('/api/campaign/:id/opens', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 Fetching opens for campaign: ${id}`);
    
    const { data: opens, error } = await supabase
      .from('opens')
      .select('*')
      .eq('message_id', id)
      .order('opened_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('❌ Error fetching opens:', error);
      throw error;
    }

    console.log(`✅ Found ${opens?.length || 0} opens for campaign ${id}`);
    
    res.json({
      status: 'success',
      campaign_id: id,
      opens: opens || []
    });
    
  } catch (error) {
    console.error('❌ Error in /api/campaign/:id/opens:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Get detailed clicks for a specific campaign
app.get('/api/campaign/:id/clicks', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔍 Fetching clicks for campaign: ${id}`);
    
    const { data: clicks, error } = await supabase
      .from('clicks')
      .select('*')
      .eq('message_id', id)
      .order('clicked_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('❌ Error fetching clicks:', error);
      throw error;
    }

    console.log(`✅ Found ${clicks?.length || 0} clicks for campaign ${id}`);
    
    res.json({
      status: 'success',
      campaign_id: id,
      clicks: clicks || []
    });
    
  } catch (error) {
    console.error('❌ Error in /api/campaign/:id/clicks:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Generate tracking snippet endpoint
app.post('/api/generate-snippet', async (req, res) => {
  console.log('🎯 Generating tracking snippet...');
  
  try {
    const { campaignName } = req.body;
    const campaign = campaignName || 'Manual Campaign';
    
    // Generate tracking data
    const messageId = uuidv4();
    const pixelSig = signString(`m=${messageId}`);
    const pixelUrl = `${APP_DOMAIN}/pixel?m=${messageId}&sig=${pixelSig}`;
    
    const trackingHtml = `
<!-- Orbitl Email Tracking (PNG) -->
<img src="${pixelUrl}" width="1" height="1" style="display:none;max-height:1px;max-width:1px;opacity:0;border:0;" alt="" />
<!-- End Orbitl Tracking -->
    `.trim();

    // Save to database
    console.log('💾 Saving to database...');
    const { error } = await supabase
      .from('messages')
      .insert([{
        id: messageId,
        to_email: 'manual@campaign.com',
        subject: campaign,
        sent_at: new Date().toISOString(),
        metadata: {
          campaign: campaign,
          manual: true,
          sent_at: new Date().toISOString(),
          pixel_type: 'PNG'
        }
      }]);

    if (error) {
      console.log('❌ Database save error:', error);
      throw error;
    }

    console.log('✅ Snippet generated and saved');
    
    res.json({
      success: true,
      snippet: trackingHtml,
      messageId: messageId,
      campaignName: campaign,
      pixelUrl: pixelUrl,
      domain: APP_DOMAIN
    });
    
  } catch (error) {
    console.log('❌ Generation error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Debug endpoint to test SVG pixel
app.get('/debug-pixel', (req, res) => {
  const testHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>SVG Pixel Debug Test</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .pixel-test { background: #f0f0f0; padding: 10px; margin: 10px 0; }
        img { border: 1px solid #ccc; }
    </style>
</head>
<body>
    <h1>SVG Pixel Debug Test</h1>
    
    <div class="pixel-test">
        <h2>PNG Tracking Pixel:</h2>
        <img src="/pixel?m=test-debug-123&sig=debug-signature" alt="PNG Pixel" />
        <p>URL: /pixel?m=test-debug-123&sig=debug-signature</p>
    </div>
    
    <div class="pixel-test">
        <h2>Direct PNG:</h2>
        <img src="data:image/png;base64,${PNG_PIXEL.toString('base64')}" alt="Direct PNG" />
        <p>Inline PNG Base64</p>
    </div>
    
    <p>Check your server logs for tracking data.</p>
    
    <script>
        console.log('Debug page loaded');
        // Test the pixel load
        const img = new Image();
        img.src = '/pixel?m=test-js-123&sig=js-signature';
        img.onload = () => console.log('PNG pixel loaded successfully');
        img.onerror = () => console.log('PNG pixel failed to load');
    </script>
</body>
</html>
  `;
  res.send(testHtml);
});

// Serve static files
app.use(express.static('public'));

// Serve the main dashboard
app.get('/dashboard', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Serve the generator page
app.get('/generate.html', (req, res) => {
  res.sendFile(__dirname + '/public/generate.html');
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Email Tracker API',
    domain: APP_DOMAIN,
    pixel_type: 'PNG',
    endpoints: {
      health: '/health',
      dashboard: '/dashboard',
      pixel: '/pixel?m=MESSAGE_ID&sig=SIGNATURE',
      click: '/click?m=MESSAGE_ID&l=LINK_INDEX&sig=SIGNATURE',
      debug: '/debug-pixel',
      api_stats: '/api/stats'
    },
    status: 'operational'
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Email tracker server running on port ${PORT}`);
  console.log(`✅ Domain: ${APP_DOMAIN}`);
  console.log(`📊 Health: ${APP_DOMAIN}/health`);
  console.log(`📈 Dashboard: ${APP_DOMAIN}/dashboard`);
  console.log(`🎯 Generator: ${APP_DOMAIN}/generate.html`);
  console.log(`🐛 Debug: ${APP_DOMAIN}/debug-pixel`);
  console.log(`📧 PNG Tracking ready at: ${APP_DOMAIN}/pixel`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  process.exit(0);
});