// server.js - NO LOCALHOST REFERENCES
const express = require('express');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const path = require('path');

// Hardcoded configuration - ONLY VERCEL URL
const CONFIG = {
  SUPABASE_URL: 'https://jfzzxfzwsgxwurgbbjvw.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impmenp4Znp3c2d4d3VyZ2JianZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEzOTAwMzgsImV4cCI6MjA3Njk2NjAzOH0.RWOWjMkCAHoFAwEm2CuMu9ZbEfzImUNtCvx_tXRn40',
  TRACK_SECRET: '3a5d12e9f61f4a88c9a39a51f3a879b2',
  APP_BASE: 'https://email-tracker-flax-psi.vercel.app' // ONLY VERCEL URL
};

console.log('🚀 Starting Orbitl Tracker...');

const app = express();

// Middleware
app.use(helmet());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.set('trust proxy', true);

// Supabase client
const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const ONE_PIXEL_GIF = Buffer.from('R0lGODlhAQABAPAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');

// Signer functions
function signString(str) {
  return crypto.createHmac('sha256', CONFIG.TRACK_SECRET).update(str).digest('hex');
}

function verifyString(str, sig) {
  if (!str || !sig) return false;
  const mac = signString(str);
  try {
    const a = Buffer.from(mac, 'hex');
    const b = Buffer.from(sig, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch { return false; }
}

// Serve HTML files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/generate.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'generate.html'));
});

app.get('/campaign.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'campaign.html'));
});

// Health check
app.get('/health', async (req, res) => {
  try {
    const { data, error } = await supabase.from('messages').select('id').limit(1);
    res.json({ 
      status: 'ok', 
      database: error ? 'disconnected' : 'connected',
      base_url: CONFIG.APP_BASE,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({ status: 'error', error: error.message });
  }
});

// API endpoint to get all stats
app.get('/api/stats', async (req, res) => {
  console.log('📊 API called - fetching data...');
  
  try {
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .order('sent_at', { ascending: false });

    if (error) {
      return res.json({
        total_campaigns: 0,
        total_opens: 0,
        total_clicks: 0,
        campaigns: [],
        error: error.message
      });
    }

    const campaigns = [];
    
    for (const message of messages || []) {
      const { data: opens } = await supabase
        .from('opens')
        .select('id')
        .eq('message_id', message.id);

      const { data: clicks } = await supabase
        .from('clicks')
        .select('id')
        .eq('message_id', message.id);

      campaigns.push({
        id: message.id,
        subject: message.subject || 'Unnamed Campaign',
        sent_at: message.sent_at,
        opens: opens?.length || 0,
        clicks: clicks?.length || 0,
        open_rate: ((opens?.length || 0) * 100).toFixed(1) + '%'
      });
    }

    const totalOpens = campaigns.reduce((sum, c) => sum + c.opens, 0);
    const totalClicks = campaigns.reduce((sum, c) => sum + c.clicks, 0);

    const response = {
      total_campaigns: campaigns.length,
      total_opens: totalOpens,
      total_clicks: totalClicks,
      campaigns: campaigns
    };

    console.log('✅ Sending response with:', response.total_campaigns, 'campaigns');
    res.json(response);

  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      total_campaigns: 0,
      total_opens: 0,
      total_clicks: 0,
      campaigns: []
    });
  }
});

// API endpoint for campaign details
app.get('/api/campaign/:id', async (req, res) => {
  try {
    const campaignId = req.params.id;
    
    const { data: campaign, error: campaignError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const { data: opens } = await supabase
      .from('opens')
      .select('*')
      .eq('message_id', campaignId)
      .order('opened_at', { ascending: false });

    const { data: clicks } = await supabase
      .from('clicks')
      .select('*')
      .eq('message_id', campaignId)
      .order('clicked_at', { ascending: false });

    res.json({
      campaign: campaign,
      opens: opens || [],
      clicks: clicks || [],
      base_url: CONFIG.APP_BASE
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to generate tracking snippet - ONLY VERCEL URL
app.post('/api/generate-snippet', async (req, res) => {
  console.log('🎯 Generating tracking snippet...');
  
  try {
    const { campaignName } = req.body;
    const campaign = campaignName || 'Manual Campaign';
    
    // Generate tracking data - ONLY VERCEL URL
    const messageId = uuidv4();
    const pixelSig = signString(`m=${messageId}`);
    const pixelUrl = `${CONFIG.APP_BASE}/pixel?m=${messageId}&sig=${pixelSig}`;
    
    const trackingHtml = `
<!-- Orbitl Email Tracking -->
<img src="${pixelUrl}" width="1" height="1" style="display:none;max-height:1px;max-width:1px" alt="" />
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
          base_url: CONFIG.APP_BASE,
          tracking_snippet: trackingHtml
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
      tracking_url: CONFIG.APP_BASE
    });
    
  } catch (error) {
    console.log('❌ Generation error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Get client IP
function clientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.headers['x-real-ip'] || 
         req.connection.remoteAddress || 
         'unknown';
}

// Pixel tracking
app.get('/pixel', async (req, res) => {
  const { m, sig } = req.query;
  
  console.log('📨 Pixel accessed:', { messageId: m });
  
  if (!m || !sig || !verifyString(`m=${m}`, sig)) {
    console.log('❌ Invalid pixel signature');
    return res.status(400).end();
  }
  
  try {
    const openId = uuidv4();
    const ip = clientIp(req);
    
    console.log('💾 Tracking open:', { messageId: m, ip: ip });
    
    const { error } = await supabase.from('opens').insert([{
      id: openId,
      message_id: m,
      opened_at: new Date().toISOString(),
      ip: ip,
      ua: req.get('User-Agent') || '',
      referer: req.get('Referer') || ''
    }]);

    if (error) console.log('❌ Open tracking error:', error);
    else console.log('✅ Open tracked successfully');
    
  } catch (error) {
    console.log('❌ Pixel error:', error);
  }
  
  res.set({
    'Content-Type': 'image/gif',
    'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.send(ONE_PIXEL_GIF);
});

// Click tracking
app.get('/click', async (req, res) => {
  const { m, l, sig } = req.query;
  
  console.log('🔗 Click accessed:', { messageId: m, linkIndex: l });
  
  if (!m || !l || !sig || !verifyString(`m=${m}|l=${l}`, sig)) {
    console.log('❌ Invalid click signature');
    return res.status(400).send('Invalid tracking link');
  }
  
  try {
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('metadata')
      .eq('id', m)
      .single();

    let url = 'https://orbitl.cc';

    if (!messageError && message && message.metadata?.links) {
      const links = message.metadata.links;
      url = links[l] || links[Number(l)] || url;
    }

    const clickId = uuidv4();
    const ip = clientIp(req);
    
    console.log('💾 Tracking click:', { messageId: m, url: url, ip: ip });
    
    const { error } = await supabase.from('clicks').insert([{
      id: clickId,
      message_id: m,
      url: url,
      clicked_at: new Date().toISOString(),
      ip: ip,
      ua: req.get('User-Agent') || ''
    }]);

    if (error) console.log('❌ Click tracking error:', error);
    else console.log('✅ Click tracked successfully');
    
    console.log('🔗 Redirecting to:', url);
    res.redirect(url);
    
  } catch (error) {
    console.error('❌ Click error:', error);
    res.redirect('https://orbitl.cc');
  }
});

// Handle all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;

// Export for Vercel
module.exports = app;