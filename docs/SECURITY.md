# VoxAn Booking System — Security & Edge Cases

## 🔴 Critical Vulnerabilities to Address

### 1. Webhook Spoofing
**Risk**: Attacker sends fake VAPI events, books fake appointments
**Mitigation**:
```javascript
// Verify VAPI signature
const signature = req.headers['x-vapi-signature'];
const expected = crypto.createHmac('sha256', WEBHOOK_SECRET)
  .update(JSON.stringify(req.body))
  .digest('hex');

if (signature !== expected) {
  return res.status(401).json({ error: 'Invalid signature' });
}
```

### 2. Google Calendar Abuse
**Risk**: Bot books hundreds of fake appointments
**Mitigation**:
- Rate limit: Max 5 bookings per phone number per day
- Duplicate detection: Check if slot already booked
- Phone validation: Regex + Twilio lookup for UK numbers
- Confirmation requirement: "Say yes to confirm"

### 3. Data Leakage
**Risk**: Call recordings/transcripts exposed
**Mitigation**:
- Supabase RLS: Users only see their own call data
- Recording URLs expire after 7 days
- No PII in logs (mask emails/phones in transcripts)

### 4. OAuth Token Exposure
**Risk**: Google refresh token in logs/environment
**Mitigation**:
- Store tokens encrypted in Supabase (not .env)
- Rotate monthly
- Revoke on suspicious activity

---

## 🟡 Edge Cases & Handling

### 1. No Slots Available
**Scenario**: Calendar fully booked next 2 weeks
**Response**:
```
"We're pretty booked up—how about I put you on the waitlist and 
call you if something opens up? Or should I check next month?"
```
**Action**: Add to `waitlist` table, check for cancellations hourly

### 2. Double Booking Race Condition
**Scenario**: Two calls book same slot simultaneously
**Prevention**:
```javascript
// Use transaction + constraint
const { data, error } = await supabase.rpc('book_slot', {
  p_slot: slot_time,
  p_call_id: call_id
});
// RPC handles atomic check+insert
```

### 3. No-Email Capture
**Scenario**: Practice doesn't want to share email
**Fallback**:
- "No problem, I'll text you the details instead"
- Send SMS via Twilio with calendar .ics file
- Store phone-only booking

### 4. Invalid Phone/Email
**Scenario**: User provides garbage data
**Validation**:
```javascript
// Phone: UK format
const isValid = /^\+44[1-9]\d{9}$/.test(phone);
// Email: Basic check
const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
```

### 5. Cancellations Out-of-Band
**Scenario**: User cancels via email after booking via voice
**Prevention**:
```javascript
// Google Calendar webhook watches for cancellations
app.post('/webhook/calendar', async (req, res) => {
  const { eventId, status } = req.body;
  if (status === 'cancelled') {
    await supabase.from('appointments')
      .update({ status: 'cancelled', updated_at: new Date() })
      .eq('calendar_event_id', eventId);
  }
});
```

### 6. Timezone Hell
**Scenario**: Practice in London, Austin in Austin, server UTC
**Solution**: Store all times in UTC, display in practice's timezone
```javascript
const slot = DateTime.fromISO('2026-02-20T14:00:00Z')
  .setZone('Europe/London');
```

### 7. VAPI Functions Failing
**Scenario**: `bookAppointment` throws error
**Fallback**:
```javascript
try {
  const result = await bookAppointment(args);
} catch (err) {
  return {
    message: "I'm having trouble with the calendar right now. Let me take your number and call you back in 10 minutes with a confirmed time."
  };
}
```

---

## 🟢 Monitoring & Alerts

### Critical Errors (PagerDuty-worthy):
- Webhook server down > 5 min
- Google Calendar API auth failure
- Database connection timeout
- >5 failed bookings in 1 hour

### Alert Channels:
- Telegram bot message to @Austyn099
- PagerDuty integration (optional)
- Supabase realtime dashboard

---

## 🔐 Secrets Management

### Required ENV Variables:
```env
# VAPI
VAPI_KEY=98b3d87c-...
VAPI_ASSISTANT_ID=...

# Google Calendar
GOOGLE_CLIENT_EMAIL=voxan@...gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
GOOGLE_CALENDAR_ID=austyneguale@gmail.com

# Supabase
SUPABASE_URL=https://...
SUPABASE_KEY=eyJ...

# Webhook
WEBHOOK_SECRET=whsec_...

# Twilio (fallback SMS)
TWILIO_SID=AC...
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=+1470...
```

### Where to Store:
- **Development**: `.env` file (gitignored)
- **Production**: Vercel/Vault secrets or AWS Secrets Manager
- **Never**: GitHub, logs, error messages
