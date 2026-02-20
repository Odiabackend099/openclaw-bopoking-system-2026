#!/usr/bin/env node
/**
 * Zoho Mail REST API Checker
 * Checks support@voxanne.ai inbox without IMAP
 * Uses Zoho's basic Auth + Token API
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Load credentials from .env
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const ZOHO_REFRESH_TOKEN = process.env.ZOHO_REFRESH_TOKEN;
const ZOHO_CLIENT_ID = process.env.ZOHO_CLIENT_ID;
const ZOHO_CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET;

async function getAccessToken() {
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: ZOHO_REFRESH_TOKEN,
      client_id: ZOHO_CLIENT_ID,
      client_secret: ZOHO_CLIENT_SECRET
    });

    const options = {
      hostname: 'accounts.zoho.com',
      path: '/oauth/v2/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.access_token) {
            resolve(json.access_token);
          } else {
            reject(new Error(`Token error: ${JSON.stringify(json)}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data.toString());
    req.end();
  });
}

async function fetchEmails(accessToken, folder = 'inbox', limit = 20) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'mail.zoho.com',
      path: `/api/accounts/support@voxanne.ai/messages/${folder}?limit=${limit}&sortorder=desc`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(json);
        } catch (e) {
          reject(new Error(`JSON parse error: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function getMessageContent(accessToken, messageId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'mail.zoho.com',
      path: `/api/accounts/support@voxanne.ai/messages/${messageId}/content`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(json);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

function analyzeReply(subject, content) {
  const text = (subject + ' ' + content).toLowerCase();
  
  // Positive indicators
  if (text.includes('interested') || text.includes('book') || text.includes('demo') || 
      text.includes('call') || text.includes('meeting')) {
    return { sentiment: 'positive', priority: 'high' };
  }
  
  // Questions
  if (text.includes('?') || text.includes('how') || text.includes('what') || 
      text.includes('price') || text.includes('cost')) {
    return { sentiment: 'question', priority: 'medium' };
  }
  
  // Unsubscribe/negative
  if (text.includes('unsubscribe') || text.includes('remove') || 
      text.includes('not interested') || text.includes('spam')) {
    return { sentiment: 'negative', priority: 'low' };
  }
  
  // Neutral
  return { sentiment: 'neutral', priority: 'low' };
}

async function main() {
  console.log('🔍 Zoho Mail Checker (REST API)\n');
  
  if (!ZOHO_REFRESH_TOKEN) {
    console.error('❌ Missing ZOHO_REFRESH_TOKEN in .env');
    console.log('\nTo set up Zoho API access:');
    console.log('1. Go to https://api-console.zoho.com/');
    console.log('2. Create "Self Client" app');
    console.log('3. Generate refresh token with scope: ZohoMail.accounts.ALL,ZohoMail.messages.ALL');
    console.log('4. Add to .env: ZOHO_REFRESH_TOKEN=...');
    process.exit(1);
  }

  try {
    console.log('⏳ Getting access token...');
    const accessToken = await getAccessToken();
    console.log('✅ Connected to Zoho Mail\n');
    
    console.log('📧 Fetching inbox...');
    const inbox = await fetchEmails(accessToken, 'inbox', 20);
    
    if (!inbox.data || inbox.data.length === 0) {
      console.log('📭 Inbox is empty');
      return;
    }
    
    console.log(`\n📬 Found ${inbox.data.length} messages\n`);
    
    // Check for replies (subjects starting with "Re:")
    const replies = inbox.data.filter(msg => 
      msg.subject?.startsWith('Re:') || 
      msg.from?.includes('dentist') ||
      msg.from?.includes('dental')
    );
    
    if (replies.length === 0) {
      console.log('ℹ️ No reply emails found (looking for "Re:" subjects)');
    } else {
      console.log(`🎯 Found ${replies.length} potential replies:\n`);
      
      for (const msg of replies.slice(0, 5)) {
        console.log('─'.repeat(60));
        console.log(`From: ${msg.from}`);
        console.log(`Subject: ${msg.subject}`);
        console.log(`Date: ${msg.receivedTime}`);
        
        // Analyze sentiment
        const analysis = analyzeReply(msg.subject, msg.content || '');
        console.log(`Sentiment: ${analysis.sentiment.toUpperCase()} (${analysis.priority} priority)`);
        
        if (analysis.sentiment === 'positive') {
          console.log('⚡ ACTION: Follow up immediately!');
        } else if (analysis.sentiment === 'question') {
          console.log('❓ ACTION: Send info/pricing');
        }
        console.log('');
      }
    }
    
    // Summary
    const stats = {
      total: inbox.data.length,
      replies: replies.length,
      positive: replies.filter(r => analyzeReply(r.subject, '').sentiment === 'positive').length,
      questions: replies.filter(r => analyzeReply(r.subject, '').sentiment === 'question').length,
      negative: replies.filter(r => analyzeReply(r.subject, '').sentiment === 'negative').length
    };
    
    console.log('\n' + '═'.repeat(60));
    console.log('📊 SUMMARY');
    console.log('═'.repeat(60));
    console.log(`Total emails: ${stats.total}`);
    console.log(`Replies to campaign: ${stats.replies}`);
    console.log(`  ✅ Positive: ${stats.positive}`);
    console.log(`  ❓ Questions: ${stats.questions}`);
    console.log(`  ❌ Negative: ${stats.negative}`);
    console.log(`  📊 Neutral: ${stats.replies - stats.positive - stats.questions - stats.negative}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('invalid')) {
      console.log('\n💡 The refresh token may be expired. Generate a new one at:');
      console.log('   https://api-console.zoho.com/');
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = { fetchEmails, analyzeReply };
