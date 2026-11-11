# ClearMyDay - Vercel Deployment Guide

## 🚀 **Quick Start**

Your ClearMyDay application is now **production-ready** and optimized for Vercel deployment! This guide will walk you through the deployment process.

## 📋 **Prerequisites**

- Vercel account (free tier works)
- Supabase account (free tier works)
- GitHub repository with your code

## 🗄️ **Step 1: Set Up Supabase Database**

### 1.1 Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create a new project (free tier: 500MB storage + 2GB bandwidth/month)
3. Wait for project initialization (~2 minutes)

### 1.2 Create Database Table
1. Go to **SQL Editor** in your Supabase dashboard
2. Run this SQL script:

```sql
CREATE TABLE calendar_configs (
  id SERIAL PRIMARY KEY,
  token VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  filter_json JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast token lookups
CREATE INDEX idx_calendar_configs_token ON calendar_configs(token);

-- Index for cleanup queries  
CREATE INDEX idx_calendar_configs_created_at ON calendar_configs(created_at);

-- Enable Row Level Security (optional, for additional security)
ALTER TABLE calendar_configs ENABLE ROW LEVEL SECURITY;

-- Policy to allow all operations (adjust as needed for your security requirements)
CREATE POLICY "Allow all operations on calendar_configs" ON calendar_configs
  FOR ALL USING (true);
```

### 1.3 Get Supabase Credentials
1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (e.g., `https://abcdefgh.supabase.co`)
   - **anon public key** (starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

## 🌐 **Step 2: Deploy to Vercel**

### 2.1 Connect Repository
1. Go to [vercel.com](https://vercel.com)
2. Click **"New Project"**
3. Import your GitHub repository
4. Vercel will auto-detect it's a Next.js project

### 2.2 Configure Environment Variables
Before deploying, add these environment variables in Vercel:

```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

**How to add them:**
1. In Vercel project settings → **Environment Variables**
2. Add each variable with **Production**, **Preview**, and **Development** scopes

### 2.3 Deploy
1. Click **"Deploy"**
2. Wait for build to complete (~2-3 minutes)
3. Your app will be live at `https://your-project-name.vercel.app`

## 🔧 **Step 3: Update Base URL**

After deployment, update the base URL in your code:

1. Edit `src/app/api/generate-calendar/route.ts`
2. Replace line 46-47:
```typescript
const baseUrl = process.env.NODE_ENV === 'production' 
  ? 'https://your-actual-domain.vercel.app'  // ← Update this
  : `http://localhost:${process.env.PORT || 3000}`;
```

3. Commit and push - Vercel will auto-deploy

## ✅ **Step 4: Test Your Deployment**

### 4.1 Test the Web Interface
1. Visit your Vercel URL
2. Select a master program (DAC, IMA, or ANDROIDE)
3. Select courses and groups
4. Click **"Generate Calendar"**
5. You should get a subscription URL

### 4.2 Test Calendar Subscription
1. Copy the generated subscription URL
2. Add it to your calendar app:
   - **Apple Calendar**: File → New Calendar Subscription
   - **Google Calendar**: Add calendar → From URL
3. Events should appear in your calendar

## 🔍 **Troubleshooting**

### Build Errors
- Check Vercel build logs for specific errors
- Ensure all TypeScript types are correct
- Run `npm run build` locally first

### Database Connection Issues
- Verify Supabase environment variables are correct
- Check Supabase project is active (not paused)
- Verify SQL table was created successfully

### Calendar Subscription Issues
- Check that the subscription URL returns valid ICS content
- Verify Sorbonne CalDAV servers are accessible
- Test with different calendar apps

## 📊 **Monitoring & Maintenance**

### Database Cleanup
The system automatically cleans up expired calendar configurations (older than 1 year). You can also run manual cleanup:

```sql
-- Delete configurations older than 1 year
DELETE FROM calendar_configs 
WHERE created_at < NOW() - INTERVAL '1 year';
```

### Usage Monitoring
- **Vercel**: Monitor function invocations and bandwidth
- **Supabase**: Monitor database usage and API calls
- Both services provide generous free tiers for this use case

## 🎯 **Free Tier Limits**

### Vercel Free Tier
- ✅ **100GB bandwidth/month** (more than enough)
- ✅ **Unlimited function invocations**
- ✅ **Automatic HTTPS**

### Supabase Free Tier  
- ✅ **500MB database storage** (thousands of calendar configs)
- ✅ **2GB bandwidth/month** (plenty for calendar subscriptions)
- ✅ **50,000 monthly active users**

## 🚀 **Next Steps**

Your ClearMyDay application is now:
- ✅ **Production-ready** with persistent storage
- ✅ **Scalable** with Vercel's global CDN
- ✅ **Cost-effective** using free tiers
- ✅ **Reliable** with simplified, tested codebase

**Calendar subscriptions will:**
- Update automatically when Sorbonne calendars change
- Work for months/years (persistent storage)
- Refresh every 15-60 minutes in calendar apps
- Handle thousands of users on free tier

Enjoy your streamlined Sorbonne calendar experience! 🎉
