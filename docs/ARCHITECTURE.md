# VoxAn Booking System — Technical Architecture

## Overview
Voice-enabled appointment booking system for dental practices using VAPI + Google Calendar + Supabase.

## System Components

### 1. VAPI Voice Layer
- **Provider**: VAPI (orchestrates STT/TTS/LLM)
- **Transcriber**: Deepgram Nova-2 (English) / Nova-2 (multi-language)
- **Voice**: ElevenLabs (custom cloned voice) or VAPI built-in (Savannah)
- **LLM**: GPT-4o with function calling

### 2. Calendar Integration
- **Provider**: Google Calendar API v3
- **Auth**: OAuth 2.0 with service account
- **Features**:
  - Check availability (freebusy query)
  - Create events with attendees
  - Update/cancel appointments
  - Send calendar invites

### 3. Database Layer
- **Provider**: Supabase (PostgreSQL + realtime)
- **Tables**:
  - `calls` — Call metadata, transcripts, outcomes
  - `appointments` — Booking confirmations, calendar event IDs
  - `leads` — Practice information, contact details
  - `availability_slots` — Cached free slots

### 4. Webhook Handlers
- **VAPI Events**: `call.started`, `call.ended`, `transcript.completed`
- **Calendar Webhooks**: Event changes, cancellations

## Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│   Dental    │────▶│    VAPI     │────▶│  Webhook Server │
│   Practice  │◀────│   (Voice)   │◀────│  (Express.js)   │
└─────────────┘     └─────────────┘     └─────────────────┘
                                                    │
                       ┌──────────────┬─────────────┴──────────────┐
                       ▼              ▼                            ▼
              ┌─────────────┐ ┌──────────────┐           ┌───────────────┐
              │  Supabase   │ │   Google     │           │  ElevenLabs   │
              │ (Database)  │ │   Calendar   │           │  (Voice Cloning)│
              └─────────────┘ └──────────────┘           └───────────────┘
```

## API Endpoints

### Webhooks
- `POST /webhook/vapi` — VAPI call events
- `POST /webhook/calendar` — Google Calendar push notifications

### Functions (exposed to VAPI)
- `checkAvailability(date, duration)` → Returns free slots
- `bookAppointment(name, phone, datetime, notes)` → Creates calendar event
- `rescheduleAppointment(eventId, newDatetime)` → Updates event
- `cancelAppointment(eventId)` → Deletes event
- `getPracticeInfo(phone)` → Looks up lead in database

## Security Considerations
- API keys stored in environment variables (never committed)
- Webhook verification (HMAC signatures)
- OAuth refresh token rotation
- Supabase RLS policies for data access
- Rate limiting on endpoints (prevent abuse)

## Deployment
- **Runtime**: Node.js 18+
- **Hosting**: Vercel / Railway / AWS Lambda
- **Required ENV vars**:
  ```env
  VAPI_KEY=
  VAPI_ASSISTANT_ID=
  GOOGLE_CLIENT_EMAIL=
  GOOGLE_PRIVATE_KEY=
  GOOGLE_CALENDAR_ID=
  SUPABASE_URL=
  SUPABASE_KEY=
  WEBHOOK_SECRET=
  ```
