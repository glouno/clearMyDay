# ClearMyDay - Deployment Guide

> **Status**: ✅ Ready for Production Deployment  
> **Target**: Vercel + Supabase (Free Tier)  
> **Estimated Cost**: $0/month for 200 users

## 🚀 Quick Deploy to Vercel

### Prerequisites ✅
- ✅ All code is production-ready
- ✅ All major bugs fixed (recurring events, timing issues)
- ✅ Calendar preview working with "Today" navigation
- ✅ Supabase storage implemented

### Step 1: Deploy to Vercel
1. **Connect GitHub repo** to Vercel
2. **Framework**: Next.js (auto-detected)
3. **Build Command**: `npm run build` (default)
4. **Deploy** (first deployment)

### Step 2: Set Environment Variables
In Vercel Dashboard → Project → Settings → Environment Variables:

```bash
# CalDAV Credentials (Required)
CALDAV_USERNAME=student.master
CALDAV_PASSWORD=guest

# Supabase (Required for persistence)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Step 3: Configure Supabase
1. **Create Supabase project** (if not done)
2. **Copy URL and anon key** to Vercel env vars
3. **Database tables** are created automatically by the app

### Step 4: Test Deployment
1. **Visit deployed URL**
2. **Test calendar generation**: Select masters → courses → generate
3. **Test subscription URL**: Copy URL → add to calendar app
4. **Verify events appear** in calendar client

## 📊 Expected Performance

### Metrics (Achieved in Development)
- ✅ **Response Time**: < 500ms for calendar generation
- ✅ **Event Filtering**: 4604 → 21 events (99.5% reduction)
- ✅ **Calendar Sources**: 3/3 Masters working (DAC, IMA, ANDROIDE)
- ✅ **Group Detection**: ~95% accuracy with manual override

### Scalability
- **Target Users**: 200+ Sorbonne M1 students
- **Vercel Limits**: Well within free tier
- **Supabase Limits**: 500MB storage, 2GB bandwidth (sufficient)

## 🔧 Post-Deployment

### Monitor
- **Vercel Analytics**: Track response times and errors
- **Supabase Dashboard**: Monitor database usage
- **Calendar Client Testing**: Verify subscription URLs work

### Maintenance
- **Automatic Updates**: GitHub pushes trigger Vercel rebuilds
- **Calendar Source Health**: Monitor Sorbonne CalDAV availability
- **User Feedback**: Collect usage data for improvements

## 🚨 Known Considerations

### Calendar Client Behavior
- **Apple Calendar**: Refreshes every 15 minutes ✅
- **Google Calendar**: Refreshes every 1-24 hours ⚠️
- **Outlook**: Refreshes every 3-24 hours ⚠️

### Sorbonne Dependencies
- **CalDAV Availability**: Dependent on university infrastructure
- **Credentials**: Using public student.master/guest access
- **Calendar Updates**: Upstream changes flow through automatically

## 📞 Support

### If Issues Occur
1. **Check Vercel logs** for API errors
2. **Test CalDAV endpoints** manually
3. **Verify environment variables** are set correctly
4. **Check Supabase connection** in dashboard

### Common Issues
- **Calendar not loading**: Check CalDAV credentials
- **Events not filtering**: Verify group detection patterns
- **Subscription not working**: Test ICS URL directly in browser

---

**Ready to deploy!** 🚀 All code is production-ready and tested.
