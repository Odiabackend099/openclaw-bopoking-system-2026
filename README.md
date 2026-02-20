# VoxAn Booking System

AI-powered voice appointment booking for dental practices using VAPI + Google Calendar + Supabase.

## Quick Start

### 1. Clone & Install

```bash
git clone <repo>
cd voxan-booking
npm install
```

### 2. Environment Setup

Create `.env` file:

```env
# VAPI Configuration
VAPI_KEY=your_vapi_key
VAPI_ASSISTANT_ID=your_assistant_id

# Google Calendar
GOOGLE_CLIENT_EMAIL=voxan@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
GOOGLE_CALENDAR_ID=austyneguale@gmail.com

# Supabase Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-or-service-key

# Webhook Security
WEBHOOK_SECRET=voxan-webhook-secret

# Server
PORT=3000
NODE_ENV=development
```

### 3. Database Setup

1. Create Supabase project at supabase.com
2. Run SQL from `supabase-schema.sql` in SQL Editor
3. Copy URL and anon key to `.env`

### 4. Google Calendar Setup

1. Go to Google Cloud Console → Service Accounts
2. Create service account with Calendar API access
3. Download JSON key → extract client_email and private_key
4. Share your calendar with the service account email

### 5. VAPI Configuration

Create assistant with tools from `config/vapi-functions.json`:

```javascript
{
  "model": {
    "provider": "openai",
    "model": "gpt-4o",
    "systemPrompt": "... from booking-agent.md ..."
  },
  "voice": {
    "provider": "vapi",
    "voiceId": "Savannah"
  },
  "transcriber": {
    "provider": "deepgram",
    "model": "nova-2"
  },
  "functions": [
    {
      "name": "checkAvailability",
      "description": "Check available appointment slots",
      "parameters": {...}
    },
    {
      "name": "bookAppointment", 
      "description": "Book and send calendar invite",
      "parameters": {...}
    }
  ],
  "serverUrl": "https://your-server.com/webhook/vapi"
}
```

### 6. Run Locally

```bash
npm run dev
```

Server runs on http://localhost:3000

### 7. Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Add environment variables in Vercel dashboard.

## API Endpoints

### Webhooks

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/webhook/vapi` | POST | VAPI call events & function calls |
| `/webhook/calendar` | POST | Google Calendar push notifications |

### API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/dashboard` | GET | Dashboard data (calls, appointments, metrics) |
| `/api/call` | POST | Trigger outbound call |

## Function Reference

### checkAvailability

```javascript
{
  "daysAhead": 5,
  "durationMinutes": 30,
  "timezone": "Europe/London"
}
// Returns: "Available slots: Thursday, Feb 20 at 2:00 PM; Friday, Feb 21 at 10:00 AM..."
```

### bookAppointment

```javascript
{
  "name": "Dr. Sarah Smith",
  "practice": "Harley Street Dental",
  "phone": "+441234567890",
  "email": "sarah@harleystreet.example",
  "datetime": "2026-02-20T14:00:00Z",
  "notes": "Demo: AI voice agent for missed calls"
}
// Returns: "Appointment booked successfully. Calendar invite sent."
```

### getPracticeInfo

```javascript
{
  "phone": "+441234567890"
}
// Returns: "Lead found: Dr. Smith from Harley Street Dental. Status: contacted."
```

## Monitoring

### Dashboard

Visit `/api/dashboard` for real-time metrics:
- Total calls
- Successful bookings
- Upcoming appointments
- Cost tracking

### Supabase Dashboard

View tables directly:
- `calls` — All call records
- `appointments` — Booked demos
- `leads` — Practice contact info

## Conversation Flow

See `config/assistant-prompts/booking-agent.md` for full conversation script including:

1. **Opening** — Qualify decision-maker
2. **Pitch** — Identify missed call pain
3. **Booking** — Check availability & book slot
4. **FAQ** — Handle objections
5. **Close** — Confirm & next steps

## Cost Breakdown

Per call (~2 minutes):
- VAPI platform: ~$0.07
- Deepgram STT: ~$0.01
- OpenAI GPT-4o: ~$0.02
- ElevenLabs TTS: ~$0.04
- **Total: ~$0.14 per call**

## Troubleshooting

### Webhook not receiving

1. Check VAPI assistant `serverUrl` points to live server
2. Verify `WEBHOOK_SECRET` matches
3. Check server logs: `vercel logs --all`

### Calendar booking fails

1. Verify service account has calendar access
2. Check `GOOGLE_CALENDAR_ID` is your email
3. Ensure calendar is shared with service account

### No available slots showing

1. Check calendar has free time slots
2. Verify timezone is correct
3. Confirm working hours (9 AM - 5 PM, Mon-Fri)

## Support

Questions? Check:
- Architecture: `docs/ARCHITECTURE.md`
- Security: `docs/SECURITY.md`
- VAPI docs: https://docs.vapi.ai
