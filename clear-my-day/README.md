# ClearMyDay - Personalized Sorbonne Calendar Filter

> **Status**: ✅ Production Ready | **Deployment**: Ready for Vercel | **Last Updated**: Sept 28, 2025

A web application that creates personalized calendar subscriptions from Sorbonne University's master calendars, filtering out 99.5% of calendar noise (4604→21 events).

## 🎯 What It Does

Transform overwhelming university calendars into clean, personalized feeds:

- ✅ **Select your courses** from DAC, IMA, ANDROIDE masters
- ✅ **Pick your TD/TME groups** (automatic detection + manual override)
- ✅ **Generate subscription URL** for any calendar app
- ✅ **Stay automatically updated** with upstream changes
- ✅ **99.5% noise reduction** achieved (4604→21 events)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone and install
git clone <repository-url>
cd clear-my-day
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use the application.

## 📋 How to Use

### Step 1: Select Your Masters
Choose from:
- **DAC** (Data, Apprentissage, Connaissances)
- **IMA** (Informatique Médicale et Applications)  
- **ANDROIDE** (Agents Distribués, Robotique, etc.)

### Step 2: Pick Your Courses
Select specific courses like:
- DALAS, LRC, MLBDA (from DAC)
- MAPSI (from IMA)
- MOGPL (from ANDROIDE)

### Step 3: Set Your Groups
- **TD Group**: TD1, TD2, TD3, TD4, TD5, etc.
- **TME Group**: TME A, TME B, TME C, etc.

### Step 4: Preview & Generate
- Preview your filtered calendar
- Generate a subscription URL
- Add to Apple Calendar, Google Calendar, or Outlook

## 🏗️ Architecture

**Frontend**: Next.js 15 + TypeScript + Tailwind CSS + React Big Calendar  
**Backend**: Next.js API Routes + CalDAV Client + Supabase Storage  
**Deployment**: Vercel (serverless) + Supabase (persistence)

### Calendar Sources (Working)
```
DAC:      2176 events → CalDAV integration ✅
IMA:      910 events  → CalDAV integration ✅  
ANDROIDE: 1518 events → CalDAV integration ✅
Total:    4604 events → Filtered to ~21 events per student
```

## 🛠️ API Endpoints (All Working ✅)

- `POST /api/generate-calendar` - Create personalized calendar
- `GET /api/calendar/[token]` - Serve ICS feeds (4604→21 events)
- `GET /api/analyze-events` - Group detection from calendar data
- `GET /api/health` - System health check

## 📱 Calendar Client Setup

### Apple Calendar
1. Open Calendar app
2. File → New Calendar Subscription  
3. Paste subscription URL → Subscribe

### Google Calendar
1. Open Google Calendar
2. Click "+" next to "Other calendars"
3. Select "From URL" → Paste URL

### Outlook
1. Open Outlook Calendar
2. Add Calendar → From Internet
3. Paste URL → OK

## 🚀 Deployment (Production Ready)

### Environment Variables
```bash
# CalDAV Credentials (required)
CALDAV_USERNAME=student.master
CALDAV_PASSWORD=guest

# Supabase (required for persistence)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
```

### Deploy to Vercel
1. Connect GitHub repo to Vercel
2. Set environment variables in dashboard
3. Deploy (automatic builds)

## 📊 Performance (Achieved ✅)

- ✅ **Setup time**: < 3 minutes
- ✅ **Response time**: < 500ms  
- ✅ **Event reduction**: 99.5% (4604→21 events)
- ✅ **Calendar sources**: 3/3 working
- ✅ **Recurring events**: Fixed timing issues

## 🧪 Testing

```bash
# Run tests
npm test

# Type checking
npm run type-check

# Linting
npm run lint

# Health check
curl http://localhost:3000/api/health
```

## 📁 Current Status

**✅ Production Ready Components:**
- `SimplifiedCalendarSelector` - Main UI (group detection working)
- `WeeklyCalendarPreview` - Calendar with "Today" navigation
- `FilteredEventsPreview` - Event list view

**❌ Deprecated Components:**
- `CalendarSelector`, `CalendarPreview`, `EventAnalyzer` (debug only)

## 📁 Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Main UI
│   └── api/
│       ├── calendar/[token]/       # ICS feed generator
│       ├── fetch-calendar/         # Calendar fetcher
│       └── health/                 # Health check
├── components/
│   ├── CalendarSelector.tsx        # Master/course selection
│   └── CalendarPreview.tsx         # Event preview
└── lib/
    ├── caldav-client.ts            # CalDAV integration
    ├── calendar-parser.ts          # Filtering logic
    ├── ics-generator.ts            # ICS creation
    ├── types.ts                    # TypeScript interfaces
    └── constants.ts                # Configuration
```

## 🔒 Security Features

- ✅ Rate limiting (10 req/min per IP)
- ✅ Token-based calendar access
- ✅ No credentials in URLs
- ✅ CORS protection
- ✅ Input validation

## 🐛 Troubleshooting

### Calendar Not Loading
- Check network connection
- Verify Sorbonne calendar availability
- Check browser console for errors

### Events Not Filtering
- Verify group names match calendar data
- Check course code spelling
- Try broader filter criteria

### Subscription Not Working
- Ensure calendar app supports ICS subscriptions
- Check subscription URL is accessible
- Verify calendar app refresh settings

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 🎓 Sorbonne Specific

This prototype is optimized for Sorbonne University M1 programs:
- **DAC**: DALAS, LRC, MLBDA courses
- **IMA**: MAPSI course  
- **ANDROIDE**: MOGPL course

Default groups: TD5, TME B (easily customizable)

---

**Built for Sorbonne students, by Sorbonne students** 🎓
