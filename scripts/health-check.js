#!/usr/bin/env node
/**
 * Health Check Script
 * Run this every 10 minutes to verify VoxAn booking server is alive
 * Usage: node health-check.js
 */

const https = require('https');

const HEALTH_URL = process.env.HEALTH_URL || 'https://voxan-booking.vercel.app/health';
const ALERT_WEBHOOK = process.env.ALERT_WEBHOOK; // Optional: Telegram/Discord webhook

function checkHealth() {
  return new Promise((resolve, reject) => {
    const url = new URL(HEALTH_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'GET',
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: json });
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function main() {
  const timestamp = new Date().toISOString();
  
  try {
    const result = await checkHealth();
    
    if (result.statusCode === 200 && result.data.status === 'ok') {
      console.log(`✅ [${timestamp}] Server healthy`);
      console.log(`   Services: ${JSON.stringify(result.data.services)}`);
      process.exit(0);
    } else {
      throw new Error(`Unexpected response: ${JSON.stringify(result.data)}`);
    }
  } catch (error) {
    console.error(`❌ [${timestamp}] Health check FAILED`);
    console.error(`   Error: ${error.message}`);
    
    // Alert could be sent here
    if (ALERT_WEBHOOK) {
      console.log(`   Alert webhook: ${ALERT_WEBHOOK}`);
      // Send alert via webhook
    }
    
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { checkHealth };
