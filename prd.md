# VoxAn Booking System - Product Requirements Document

## Overview
Build an AI-powered voice booking system that allows dental practices to book demos via voice conversations. Users can trigger outbound calls via Telegram, and the AI agent handles booking, rescheduling, and support via voice calls.

## Project Info
- **Repo:** https://github.com/Odiabackend099/openclaw-bopoking-system-2026
- **Live URL:** openclaw-bopoking-system-2026.vercel.app
- **Tech Stack:** Node.js, VAPI, Twilio, Google Calendar, Supabase

---

## User Experience Flow

### 1. Trigger Outbound Call (Telegram)
```
User sends Telegram message: "Call +447123456789"
                     ↓
Server receives webhook from Telegram
                     ↓
Server calls VAPI API: POST /call
                     ↓
VAPI initiates call to phone number
                     ↓
AI Assistant answers using ElevenLabs voice
```

**Required:**
- Telegram bot webhook endpoint
- VAPI private key + public key (NOT just API key)
- Twilio API credentials (SMS alerts)
- Google Calendar credentials (booking)

### 2. Assistant Configuration
Each assistant needs:

```json
{
  "name": "VoxAn Booking Agent",
  "voice": {
    "provider": "elevenlabs",
    "voiceId": "Savannah", // or custom voice clone
    "model": "eleven_turbo_v2_5"
  },
  "transcriber": {
    "provider": "deepgram",
    "model": "nova-2",
    "language": "en"
  },
  "model": {
    "provider": "openai",
    "model": "gpt-4o",
    "systemPrompt": "..." // See conversation flow below
  },
  "functions": [
    "checkAvailability",
    "bookAppointment",
    "rescheduleAppointment",
    "cancelAppointment",
    "getPracticeInfo"
  ],
  "serverUrl": "https://openclaw-bopoking-system-2026.vercel.app/webhook/vapi"
}
```

### 3. Conversation Flow

**First Message:**
```
"Hi, this is VoxAn calling. Am I speaking with the practice manager?
[Wait for confirmation]

Great! I'm calling about helping dental practices capture missed calls 
and increase bookings. Could I get your name and practice name?"
```

**Collect Information:**
1. Name
2. Practice name
3. Email
4. Interest level (Hot/Warm/Cold)

**Booking State:**
```
"I can show you how we help practices like yours capture an extra 
15-20 bookings per month. Worth a quick 10-minute demo?"

[If YES]
"I have slots tomorrow at 10 AM or Thursday at 2 PM. What works?"
[Call checkAvailability function]

[Get date/time]
"Perfect! I'll send a calendar invite to [EMAIL]. You'll get a 
reminder before our call."
[Call bookAppointment function]
```

### 4. End-of-Call Data Extraction

The AI should extract and return:
```json
{
  "callOutcome": "booked_demo",
  "leadTemperature": "hot",
  "collectedInfo": {
    "name": "Dr. Sarah Smith",
    "practice": "Harley Street Dental",
    "email": "sarah@harleystreet.example",
    "phone": "+447123456789",
    "painPoints": ["missed calls", "after hours"]
  },
  "appointmentBooked": true,
  "appointmentTime": "2026-02-25T14:00:00Z",
  "followUpRequired": false
}
```

### 5. Inbound Calls (Practice calls VoxAn)

Same assistant handles inbound:
```
"Thank you for calling VoxAn. I can help you book a demo or 
connect you with our team. What would you prefer?"
```

---

## API Endpoints

### Webhooks
```
POST /webhook/vapi          # VAPI voice events
POST /webhook/calendar      # Google Calendar changes
POST /webhook/telegram      # Telegram bot messages
```

### Functions (VAPI calls these)
```
POST /vapi-functions/checkAvailability
POST /vapi-functions/bookAppointment
```

### API
```
GET  /health                # Server status
GET  /api/dashboard         # Call metrics & bookings
POST /api/trigger-call      # Manual outbound call trigger
```

---

## Data Schema

### Calls Table
```sql
id: uuid
vapi_call_id: string (unique)
phone_number: string
customer_name: string
practice_name: string
status: enum (queued|in-progress|completed|failed)
transcript: text
recording_url: string
cost: decimal
duration: int (seconds)
success: boolean
outcome: text
lead_temperature: enum (hot|warm|cold)
created_at: timestamp
```

### Appointments Table
```sql
id: uuid
call_id: references calls
email: string
appointment_time: timestamp
calendar_event_id: string
status: enum (confirmed|cancelled|completed)
created_at: timestamp
```

---

## End-of-Call Functions

The AI must handle:

| Function | Purpose |
|----------|---------|
| `endCallSummary()` | Returns collected data |
| `askAreYouThere()` | Detects silence, pauses >10s |
| `detectHotLead()` | Determines interest level |
| `collectContactInfo()` | Gets email/phone/name |
| `bookSlot()` | Calendar booking |
| `sendSMSConfirmation()` | Twilio SMS to caller |
| `alertOwner()` | SMS alert for hot leads |

---

## Best Practices

### Voice AI
- **Turn-taking:** Wait 400ms after user stops speaking
- **Interruption:** Allow user to interrupt, stop TTS
- **Barge-in:** Enable backchannel words ("uh-huh", "right")
- **Silence detection:** Ask "Are you there?" after 10s silence
- **Natural speech:** Add "um", "ah", pauses for realism

### Security
- Webhook signature verification (HMAC)
- All env vars in Vercel dashboard
- No secrets in code/logs
- Rate limiting (5 calls/min per number)

### Error Handling
- Graceful fallbacks for API failures
- Retry with exponential backoff
- Queue failed operations
- Alert owner on critical errors

---

## Environment Variables Template

```env
# VAPI
VAPI_PRIVATE_KEY=your-private-key
VAPI_PUBLIC_KEY=your-public-key
VAPI_ASSISTANT_ID=your-assistant-id
VAPI_PHONE_NUMBER_ID=your-phone-number-id

# Google Calendar (Service Account)
GOOGLE_CLIENT_EMAIL=service-account@...gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
GOOGLE_CALENDAR_ID=austyneguale@gmail.com

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# Twilio (SMS)
TWILIO_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1470...
TWILIO_MESSAGING_SID=M...

# Owner Notifications (to Austyn)
OWNER_PHONE=+2348141995397
OWNER_EMAIL=austyneguale@gmail.com

# Webhook Security
WEBHOOK_SECRET=whsec-...

# Telegram Bot
TELEGRAM_BOT_TOKEN=bot-token
TELEGRAM_WEBHOOK_SECRET=webhook-secret
```

---

## Success Criteria

1. ✅ User can trigger call via Telegram
2. ✅ AI makes outbound call within seconds
3. ✅ AI handles inbound calls correctly
4. ✅ Booking created in Google Calendar
5. ✅ SMS sent to caller with confirmation
6. ✅ Hot leads trigger SMS alert to owner
7. ✅ End-of-call data extracted
8. ✅ Dashboard shows metrics
9. ✅ 500 errors resolved

---

## Architecture Diagram

```
User (Telegram) → Webhook → VAPI → Voice Call → Dental Practice
                       ↓
                 Google Calendar (booking)
                       ↓
                 Supabase (logging)
                       ↓
                 Twilio SMS (alerts)
```

## Deliverables Expected

1. Working HTTP 200 on health endpoint
2. VAPI webhook responding correctly
3. Calendar booking functional
4. SMS alerts working
5. All 500 errors fixed
6. Documentation updated

---

End of PRD
