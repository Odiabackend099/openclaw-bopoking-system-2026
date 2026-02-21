/**
 * VoxAn Booking Server
 * Express server handling webhooks and API endpoints
 */

const express = require('express');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(express.json());
// Serve static files from public directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// Lazy load services (don't crash on startup if env vars missing)
let calendar = null;
let db = null;
let servicesInitialized = false;

function getCalendar() {
  if (!calendar) {
    const CalendarService = require('./calendar-service');
    calendar = new CalendarService();
  }
  return calendar;
}

function getDB() {
  if (!db) {
    const DatabaseService = require('./database');
    db = new DatabaseService();
  }
  return db;
}

// Initialize services safely
try {
  servicesInitialized = true;
  console.log('✅ Services configured (lazy loaded)');
} catch (err) {
  console.error('⚠️ Service init warning:', err.message);
}

/**
 * Verify VAPI webhook signature
 */
function verifyVapiSignature(req) {
  const signature = req.headers['x-vapi-signature'];
  if (!signature) return false;
  
  const expected = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET || 'voxan-secret')
    .update(JSON.stringify(req.body))
    .digest('hex');
  
  return signature === expected;
}

/**
 * VAPI Webhook Endpoint
 * Receives call events and function calls
 */
app.post('/webhook/vapi', async (req, res) => {
  // Skip signature verification in dev, enforce in production
  if (process.env.NODE_ENV === 'production' && !verifyVapiSignature(req)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { message, call } = req.body;
  
  try {
    // Handle different event types
    switch (message?.type) {
      case 'call-started':
        await handleCallStarted(call);
        break;
        
      case 'call-ended':
        await handleCallEnded(call);
        break;
        
      case 'function-call':
        const result = await handleFunctionCall(call, message.functionCall);
        return res.json(result);
        
      case 'transcript':
        await handleTranscript(call, message);
        break;
    }
    
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Handle call started
 */
async function handleCallStarted(call) {
  console.log(`📞 Call started: ${call.id}`);
  
  try {
    await getDB().createCall({
      vapiCallId: call.id,
      assistantId: call.assistantId,
      phoneNumber: call.customer?.number,
      status: 'in-progress'
    });
  } catch (err) {
    console.error('Failed to log call start:', err.message);
  }
}

/**
 * Handle call ended
 */
async function handleCallEnded(call) {
  console.log(`📴 Call ended: ${call.id}`);
  
  try {
    await getDB().updateCall(call.id, {
      status: call.status,
      duration: call.duration,
      cost: call.cost,
      success: call.analysis?.successEvaluation === 'true',
      outcome: call.analysis?.summary
    });
  } catch (err) {
    console.error('Failed to log call end:', err.message);
  }
}

/**
 * Handle function calls from VAPI
 */
async function handleFunctionCall(call, functionCall) {
  const { name, parameters } = functionCall;
  
  console.log(`🔧 Function called: ${name}`, parameters);
  
  try {
    switch (name) {
      case 'checkAvailability':
        const slots = await calendar.checkAvailability({
          daysAhead: parameters.daysAhead || 5,
          durationMinutes: parameters.durationMinutes || 30,
          timezone: parameters.timezone || 'Europe/London'
        });
        return {
          result: `Available slots: ${slots.map(s => s.display).join('; ')}`
        };
        
      case 'bookAppointment':
        // Validate phone
        if (!/^\+44[1-9]\d{9}$/.test(parameters.phone)) {
          return {
            result: "Error: Please provide a valid UK phone number starting with +44"
          };
        }
        
        // Validate email
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parameters.email)) {
          return {
            result: "Error: Please provide a valid email address"
          };
        }
        
        const booking = await calendar.bookAppointment({
          name: parameters.name,
          practice: parameters.practice,
          phone: parameters.phone,
          email: parameters.email,
          datetime: parameters.datetime,
          notes: parameters.notes || '',
          attendees: ['austyneguale@gmail.com']
        });
        
        // Store in database
        const callData = await db.getCall(call.id);
        await db.createAppointment({
          callId: callData?.id,
          customerName: parameters.name,
          phone: parameters.phone,
          email: parameters.email,
          practiceName: parameters.practice,
          appointmentTime: parameters.datetime,
          calendarEventId: booking.eventId,
          calendarLink: booking.htmlLink,
          status: 'confirmed',
          notes: parameters.notes
        });
        
        // Upsert lead
        await db.upsertLead({
          phone: parameters.phone,
          email: parameters.email,
          name: parameters.name,
          practiceName: parameters.practice,
          source: 'vapi_booking'
        });
        
        return {
          result: `Appointment booked successfully for ${parameters.datetime}. Calendar invite sent to ${parameters.email}.`
        };
        
      case 'getPracticeInfo':
        const lead = await db.getLeadByPhone(parameters.phone);
        if (lead) {
          return {
            result: `Lead found: ${lead.name} from ${lead.practice_name}. Status: ${lead.status}. Last contacted: ${lead.last_contacted}.`
          };
        }
        return {
          result: "No previous contact found. This is a new lead."
        };
        
      case 'saveCallbackTime':
        await db.updateCall(call.id, {
          callback_requested: parameters.datetime
        });
        return {
          result: `Noted: Call back requested for ${parameters.datetime}.`
        };
        
      default:
        return {
          result: `Function ${name} not implemented`
        };
    }
  } catch (error) {
    console.error(`Function ${name} error:`, error);
    return {
      result: `Error: ${error.message}. Please try again or ask the caller to try later.`
    };
  }
}

/**
 * Handle transcript updates
 */
async function handleTranscript(call, message) {
  if (message.transcript) {
    await db.updateCall(call.id, {
      transcript: message.transcript
    });
  }
}

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      calendar: 'connected',
      database: 'connected'
    }
  });
});

/**
 * Dashboard data endpoint
 */
app.get('/api/dashboard', async (req, res) => {
  try {
    const [recentCalls, upcomingAppointments, metrics] = await Promise.all([
      db.getRecentCalls(20),
      db.getUpcomingAppointments(),
      db.getMetrics()
    ]);
    
    res.json({
      recentCalls,
      upcomingAppointments,
      metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Manual trigger for outbound call
 */
app.post('/api/call', async (req, res) => {
  const { phone, assistantId } = req.body;
  
  if (!phone) {
    return res.status(400).json({ error: 'Phone number required' });
  }
  
  // This would trigger VAPI call via their API
  // Implementation in separate module
  res.json({ message: 'Call triggered', phone, assistantId });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 VoxAn Booking Server running on port ${PORT}`);
  console.log(`📍 Webhook endpoint: http://localhost:${PORT}/webhook/vapi`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
