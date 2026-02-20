# VoxAn Booking - Deployment Guide

## Quick Deploy (One Command)

```bash
# From the voxan-booking directory
cd /home/node/.openclaw/workspace/voxan-booking

# Install Vercel CLI globally
npm i -g vercel

# Login to Vercel (you'll need to authenticate)
vercel login

# Deploy!
vercel --prod
```

## Step-by-Step Instructions

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Set Environment Variables

When deploying, Vercel will ask for env vars. Add these:

```
VAPI_KEY=98b3d87c-e362-4550-9a6e-1378a0761454
VAPI_ASSISTANT_ID=
GOOGLE_CLIENT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_CALENDAR_ID=austyneguale@gmail.com
SUPABASE_URL=
SUPABASE_KEY=
WEBHOOK_SECRET=voxan-webhook-secret-2026
```

### Step 3: Deploy

```bash
vercel
```

This creates a preview deployment. Test it, then:

```bash
vercel --prod
```

### Step 4: Update VAPI Webhook URL

After deployment, get your URL (e.g., `https://voxan-booking.vercel.app`)

In VAPI dashboard:
1. Go to your assistant
2. Add server URL: `https://voxan-booking.vercel.app/webhook/vapi`

### Step 5: Verify

```bash
curl https://your-deployment.vercel.app/health
```

Should return:
```json
{
  "status": "ok",
  "services": {
    "calendar": "connected",
    "database": "connected"
  }
}
```

## Troubleshooting

**"Command not found: vercel"**
→ Run: `npm i -g vercel`

**"Authentication error"**
→ Run: `vercel login` and follow browser prompts

**"Project already exists"**
→ This is fine, just confirms deployment

**"Webhook not receiving"**
→ Check VAPI assistant has correct serverUrl
→ Verify WEBHOOK_SECRET is set correctly

## Local Testing First

Before deploying, test locally:

```bash
npm install
npm run dev

# In another terminal:
curl http://localhost:3000/health
```

## Required Secrets

You MUST set these in Vercel dashboard after deploy:

1. **VAPI_KEY** - Get from VAPI dashboard
2. **GOOGLE_CLIENT_EMAIL** - Service account email
3. **GOOGLE_PRIVATE_KEY** - From service account JSON
4. **SUPABASE_URL** - From Supabase project settings
5. **SUPABASE_KEY** - Service role key (not anon key)

## SSL/Webhook

Vercel provides HTTPS automatically - perfect for VAPI webhooks.

No additional SSL configuration needed.

---

Last updated: Feb 20, 2026
