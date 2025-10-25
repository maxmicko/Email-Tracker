// server.js
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');
const { verifyString } = require('./signer');
const supabase = require('./supabase-api'); // Use the API client directly

const app = express();
app.use(helmet());
app.set('trust proxy', true);

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
  const isTrackingEndpoint = req.path === '/pixel' || req.path === '/click';
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

const ONE_PIXEL_GIF = Buffer.from('R0lGODlhAQABAPAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    const { data, error } = await supabase.select('messages', 'limit=1');
    res.json({ 
      status: 'ok', 
      database: error ? 'error' : 'connected',
      message: error ? error.message : 'All systems operational',
      domain: 'email-tracker-flax-psi.vercel.app'
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

// Pixel tracking endpoint
app.get('/pixel', async (req, res) => {
  const { m, sig } = req.query;
  
  if (!m || !sig || !verifyString(`m=${m}`, sig)) {
    return res.status(400).end();
  }
  
  // Track the open asynchronously
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
      console.error('Error tracking open:', error.message);
    }
  })();
  
  // Return the tracking pixel
  res.set({
    'Content-Type': 'image/gif',
    'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.send(ONE_PIXEL_GIF);
});

// Click tracking endpoint
app.get('/click', async (req, res) => {
  const { m, l, sig } = req.query;
  
  if (!m || !l || !sig || !verifyString(`m=${m}|l=${l}`, sig)) {
    return res.status(400).send('Invalid tracking link');
  }
  
  try {
    // Get the message to find the original URL
    const message = await supabase.selectSingle('messages', 'id', m);
    
    if (!message) {
      return res.status(404).send('Message not found');
    }
    
    const links = message.metadata?.links || {};
    const url = links[l] || links[Number(l)] || 'https://orbitl.cc/';
    
    // Track the click asynchronously
    (async () => {
      try {
        await supabase.insert('clicks', {
          id: uuidv4(),
          message_id: m,
          url: url,
          clicked_at: new Date().toISOString(),
          ip: clientIp(req),
          ua: req.get('User-Agent') || ''
        });
      } catch (error) {
        console.error('Error tracking click:', error.message);
      }
    })();
    
    // Redirect to the original URL
    res.redirect(url);
    
  } catch (error) {
    console.error('Click tracking error:', error);
    res.status(500).send('Server error');
  }
});

// Simple dashboard endpoint - restricted to allowed domains
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
      domain: 'email-tracker-flax-psi.vercel.app'
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
    domain: 'email-tracker-flax-psi.vercel.app',
    endpoints: {
      health: '/health',
      dashboard: '/dashboard',
      pixel: '/pixel?m=MESSAGE_ID&sig=SIGNATURE',
      click: '/click?m=MESSAGE_ID&l=LINK_INDEX&sig=SIGNATURE'
    },
    status: 'operational'
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Email tracker server running on port ${PORT}`);
  console.log(`✅ Restricted to: https://email-tracker-flax-psi.vercel.app`);
  console.log(`📊 Health check: https://email-tracker-flax-psi.vercel.app/health`);
  console.log(`📈 Dashboard: https://email-tracker-flax-psi.vercel.app/dashboard`);
  console.log(`📧 Tracking ready at: ${process.env.APP_BASE || 'https://email-tracker-flax-psi.vercel.app'}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  process.exit(0);
});