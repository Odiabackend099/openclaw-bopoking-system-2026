/**
 * Twilio SMS Service
 * Sends SMS alerts for hot leads, confirmations, and reminders
 */

const https = require('https');
const querystring = require('querystring');

class SMSService {
  constructor() {
    this.accountSid = process.env.TWILIO_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
    this.ownerNumber = process.env.OWNER_PHONE || '+2348141995397'; // Austyn's number
  }

  /**
   * Send SMS via Twilio API
   */
  async sendSMS(to, message) {
    return new Promise((resolve, reject) => {
      if (!this.accountSid || !this.authToken) {
        console.log('⚠️ Twilio not configured, logging message only:');
        console.log(`To: ${to}, Message: ${message}`);
        resolve({ sid: 'mock-sid', status: 'sent' });
        return;
      }

      const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
      const data = querystring.stringify({
        To: to,
        From: this.fromNumber,
        Body: message
      });

      const options = {
        hostname: 'api.twilio.com',
        port: 443,
        path: `/2010-04-01/Accounts/${this.accountSid}/Messages.json`,
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': data.length
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            if (res.statusCode === 201) {
              resolve({ sid: json.sid, status: json.status });
            } else {
              reject(new Error(`Twilio error: ${json.message}`));
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  /**
   * Send booking confirmation to caller
   */
  async sendBookingConfirmation(phone, name, practice, datetime) {
    const dateObj = new Date(datetime);
    const dateStr = dateObj.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
    const timeStr = dateObj.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const message = `Hi ${name}, your VoxAn demo is confirmed for ${dateStr} at ${timeStr}. You'll receive a calendar invite shortly. Questions? Reply to this number. - VoxAn Team`;

    return this.sendSMS(phone, message);
  }

  /**
   * Send hot lead alert to business owner
   */
  async sendHotLeadAlert(leadInfo) {
    const message = `🔥 HOT LEAD!

${leadInfo.name}
${leadInfo.practice}
📞 ${leadInfo.phone}
📧 ${leadInfo.email}

📅 Booked: ${leadInfo.appointmentTime}
💰 Potential: ${leadInfo.estimatedValue || 'High'}

AI detected strong interest. Follow up ASAP!`;

    return this.sendSMS(this.ownerNumber, message);
  }

  /**
   * Send missed call alert
   */
  async sendMissedCallAlert(phone, name, transcript) {
    const snippet = transcript ? transcript.substring(0, 80) + '...' : 'N/A';
    const message = `📞 Missed opportunity

${name} (${phone})
Didn't complete booking.

Last said: "${snippet}"

Call back?`;

    return this.sendSMS(this.ownerNumber, message);
  }

  /**
   * Send daily summary
   */
  async sendDailySummary(stats) {
    const message = `📊 VoxAn Daily Report

Calls: ${stats.totalCalls}
Successful: ${stats.successfulCalls}
Bookings: ${stats.bookings}
Cost: $${stats.totalCost.toFixed(2)}

Hot leads: ${stats.hotLeads}
Follow-ups needed: ${stats.followups}

🚀 Keep going!`;

    return this.sendSMS(this.ownerNumber, message);
  }

  /**
   * Send appointment reminder
   */
  async sendAppointmentReminder(phone, name, practice, datetime) {
    const dateObj = new Date(datetime);
    const timeStr = dateObj.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const message = `Hi ${name}, reminder: Your VoxAn demo with ${practice} is today at ${timeStr}. See you then!`;

    return this.sendSMS(phone, message);
  }

  /**
   * Alert for voicemail received
   */
  async sendVoicemailAlert(phone, transcription) {
    const snippet = transcription ? transcription.substring(0, 100) : 'No transcription';
    const message = `📼 Voicemail received from ${phone}

"${snippet}..."

Check dashboard for full recording.`;

    return this.sendSMS(this.ownerNumber, message);
  }

  /**
   * Trigger outbound call via VAPI
   * This initiates a call from the AI to the specified number
   */
  async triggerOutboundCall(phoneNumber, assistantId, metadata = {}) {
    return new Promise((resolve, reject) => {
      const vapiKey = process.env.VAPI_KEY;
      
      if (!vapiKey) {
        reject(new Error('VAPI_KEY not configured'));
        return;
      }

      const data = JSON.stringify({
        assistantId: assistantId,
        phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
        customer: {
          number: phoneNumber,
          ...metadata
        }
      });

      const options = {
        hostname: 'api.vapi.ai',
        port: 443,
        path: '/call',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${vapiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            if (res.statusCode === 201 || json.id) {
              resolve({
                callId: json.id,
                status: json.status,
                assistantId: json.assistantId
              });
            } else {
              reject(new Error(`VAPI error: ${json.message || body}`));
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }
}

module.exports = SMSService;
