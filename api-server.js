// fixed-api-server.js - NO AUTO-REFRESH VERSION
require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const { signString } = require('./signer');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Create Supabase client directly
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// API endpoint to get all stats
app.get('/api/stats', async (req, res) => {
  console.log('📊 API called - fetching data...');
  
  try {
    // Get messages directly
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .order('sent_at', { ascending: false });

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

    // If no messages, return empty
    if (!messages || messages.length === 0) {
      return res.json({
        total_campaigns: 0,
        total_opens: 0,
        total_clicks: 0,
        campaigns: []
      });
    }

    // Get opens and clicks for each message
    const campaigns = [];
    
    for (const message of messages) {
      // Get opens count
      const { data: opens } = await supabase
        .from('opens')
        .select('id')
        .eq('message_id', message.id);

      // Get clicks count  
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

// API endpoint for campaign details
app.get('/api/campaign/:id', async (req, res) => {
  console.log('📋 Fetching campaign details:', req.params.id);
  
  try {
    const campaignId = req.params.id;
    
    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Get opens for this campaign
    const { data: opens, error: opensError } = await supabase
      .from('opens')
      .select('*')
      .eq('message_id', campaignId)
      .order('opened_at', { ascending: false });

    // Get clicks for this campaign  
    const { data: clicks, error: clicksError } = await supabase
      .from('clicks')
      .select('*')
      .eq('message_id', campaignId)
      .order('clicked_at', { ascending: false });

    res.json({
      campaign: campaign,
      opens: opens || [],
      clicks: clicks || []
    });

  } catch (error) {
    console.log('❌ Campaign details error:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to generate tracking snippet
app.post('/api/generate-snippet', async (req, res) => {
  console.log('🎯 Generating tracking snippet...');
  
  try {
    const { campaignName } = req.body;
    const campaign = campaignName || 'Manual Campaign';
    
    // Generate tracking data
    const messageId = uuidv4();
    const pixelSig = signString(`m=${messageId}`);
    const pixelUrl = `${process.env.APP_BASE}/pixel?m=${messageId}&sig=${pixelSig}`;
    
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
          sent_at: new Date().toISOString()
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
      campaignName: campaign
    });
    
  } catch (error) {
    console.log('❌ Generation error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Serve the main dashboard
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Serve the generator page
app.get('/generate.html', (req, res) => {
  res.sendFile(__dirname + '/public/generate.html');
});

// Serve campaign details page
app.get('/campaign.html', (req, res) => {
  res.sendFile(__dirname + '/public/campaign.html');
});

const PORT = process.env.DASHBOARD_PORT || 3001;
app.listen(PORT, () => {
  console.log(`📊 Dashboard running on http://localhost:${PORT}`);
  console.log(`🎯 Generator: http://localhost:${PORT}/generate.html`);
});