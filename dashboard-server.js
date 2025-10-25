// dashboard-server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const supabase = require('./supabase-api');

const app = express();
app.use(express.static('public'));
app.set('view engine', 'ejs');
// Add this route to dashboard-server.js
app.get('/generate', (req, res) => {
  res.render('generate');
});

app.post('/generate-snippet', async (req, res) => {
  const campaignName = req.body.campaignName || 'Manual Campaign';
  const { generateTrackingSnippet } = require('./generate-tracking');
  const result = generateTrackingSnippet(campaignName);
  
  res.render('snippet-result', { 
    snippet: result.trackingHtml,
    messageId: result.messageId,
    campaignName 
  });
});
// Main dashboard
app.get('/', async (req, res) => {
  try {
    const { data: messages, error } = await supabase.select('messages', 'order=sent_at.desc');
    
    if (error) throw error;

    // Get stats for each message
    const campaigns = await Promise.all(
      messages.map(async (message) => {
        const { data: opens } = await supabase.select('opens', `message_id=eq.${message.id}`);
        const { data: clicks } = await supabase.select('clicks', `message_id=eq.${message.id}`);
        
        return {
          ...message,
          opens: opens || [],
          clicks: clicks || [],
          openCount: opens?.length || 0,
          clickCount: clicks?.length || 0,
          openRate: ((opens?.length || 0) * 100).toFixed(1),
          clickRate: ((clicks?.length || 0) * 100).toFixed(1)
        };
      })
    );

    res.render('dashboard', { 
      campaigns,
      totalCampaigns: campaigns.length,
      totalOpens: campaigns.reduce((sum, c) => sum + c.openCount, 0),
      totalClicks: campaigns.reduce((sum, c) => sum + c.clickCount, 0)
    });

  } catch (error) {
    res.render('error', { error: error.message });
  }
});

// Campaign detail view
app.get('/campaign/:id', async (req, res) => {
  try {
    const messageId = req.params.id;
    
    const [message, opens, clicks] = await Promise.all([
      supabase.selectSingle('messages', 'id', messageId),
      supabase.select('opens', `message_id=eq.${messageId}&order=opened_at.desc`),
      supabase.select('clicks', `message_id=eq.${messageId}&order=clicked_at.desc`)
    ]);

    if (!message) {
      return res.status(404).render('error', { error: 'Campaign not found' });
    }

    res.render('campaign', {
      campaign: message,
      opens: opens || [],
      clicks: clicks || []
    });

  } catch (error) {
    res.render('error', { error: error.message });
  }
});

// API endpoints for real-time data
app.get('/api/stats', async (req, res) => {
  try {
    const { data: messages } = await supabase.select('messages');
    const { data: opens } = await supabase.select('opens');
    const { data: clicks } = await supabase.select('clicks');

    res.json({
      totalCampaigns: messages?.length || 0,
      totalOpens: opens?.length || 0,
      totalClicks: clicks?.length || 0,
      openRate: messages?.length ? ((opens?.length || 0) / messages.length * 100).toFixed(1) : '0.0'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.DASHBOARD_PORT || 3001;
app.listen(PORT, () => {
  console.log(`📊 Dashboard running on http://localhost:${PORT}`);
});