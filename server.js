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

const ONE_PIXEL_GIF = Buffer.from('R0lGODlhAQABAPAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    const { data, error } = await supabase.select('messages', 'limit=1');
    res.json({ 
      status: 'ok', 
      database: error ? 'error' : 'connected',
      message: error ? error.message : 'All systems operational'
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

// Simple dashboard endpoint
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
      data: dashboardData
    });
    
  } catch (error) {
    res.json({
      status: 'error',
      message: error.message
    });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Email tracker server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📈 Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`📧 Tracking ready at: ${process.env.APP_BASE}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  process.exit(0);
});