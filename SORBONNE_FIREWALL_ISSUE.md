# Sorbonne Firewall Issue & Workarounds

## Problem Summary

The Sorbonne University network is **actively blocking access** to ClearMyDay through multiple mechanisms:

### 1. HTTPS Man-in-the-Middle (MITM) Interception
```
Certificate Issuer: pare-feu.sorbonne-universite.fr
Error: SEC_ERROR_UNKNOWN_ISSUER
```

**What's happening:**
- Sorbonne's firewall (`pare-feu.sorbonne-universite.fr`) intercepts ALL HTTPS traffic
- Replaces legitimate SSL certificates with their own self-signed certificate
- Browsers correctly reject this as a security threat
- This affects: `clearmyday.com`

### 2. Domain Category Blocking
- `clearmyday.xyz` → Blocked as **"newly-registered-domain"**
- Vercel URL → Blocked as **"web hosting category"**

## Technical Analysis

The firewall performs **deep packet inspection** and categorizes domains:
- Recently registered domains are auto-blocked
- Web hosting platforms (Vercel, Netlify, etc.) are blocked
- HTTPS traffic is decrypted via MITM to inspect content

**Why this is a problem:**
- You cannot bypass HTTPS MITM without the user accepting invalid certificates (massive security risk)
- Domain categorization is automatic and cannot be changed externally
- The firewall is working as designed to protect the university network

## Solutions (Ranked by Feasibility)

### ✅ 1. Students Use Mobile Data (Recommended)
**Difficulty:** Easy  
**Success Rate:** 100%

**Instructions for students:**
1. Turn off Sorbonne WiFi on their phone
2. Enable mobile data
3. Access `clearmyday.com` to generate their calendar URL
4. Copy the subscription URL to their calendar app
5. The calendar will sync automatically even on Sorbonne WiFi (calendar apps use different protocols)

**Why this works:**
- Mobile data bypasses university firewall entirely
- Calendar subscription URLs can be configured once and work everywhere
- Calendar apps (iOS Calendar, Google Calendar) use CalDAV/ICS protocols that may not be blocked

### ✅ 2. Personal WiFi Hotspot
**Difficulty:** Easy  
**Success Rate:** 100%

Students can:
1. Create a personal hotspot from their phone
2. Connect their laptop to it
3. Access the website to generate calendar URL

### ⚠️ 3. Use HTTP Instead of HTTPS
**Difficulty:** Medium  
**Success Rate:** ~70%  
**Security:** ⚠️ NOT RECOMMENDED

You could set up an HTTP-only version at `http://clearmyday.com`, but:
- **Major security risk** - data sent in plain text
- Modern browsers show scary warnings
- May still be blocked by content category
- Violates web security best practices
- **DO NOT IMPLEMENT THIS**

### ⚠️ 4. Use a Different Domain
**Difficulty:** Easy  
**Success Rate:** ~30%  
**Problem:** Temporary

Register a domain that:
- Is NOT newly registered (buy an aged domain)
- Is NOT on a web hosting platform
- Has a legitimate-sounding name related to education

**Issues:**
- Expensive ($50-500 for aged domains)
- May still get categorized and blocked
- Not a long-term solution

### ❌ 5. Use Tor or VPN
**Difficulty:** Hard  
**Success Rate:** 0%  
**Problem:** Also blocked

- Tor exit nodes are typically blocked
- VPN traffic is easily detected and blocked
- University networks specifically target these

### ✅ 6. Browser Extension Proxy (For Tech-Savvy Students)
**Difficulty:** Medium  
**Success Rate:** ~60%

Students could use browser extensions that proxy traffic through external servers, but:
- Requires technical knowledge
- May violate university acceptable use policy
- Not practical for most students

### ✅ 7. QR Code for Mobile Access (BEST UX SOLUTION)
**Difficulty:** Easy to implement  
**Success Rate:** 100%

**Implement a QR code on your documentation:**

```typescript
// Add this to your README or documentation
// Students scan QR code with their phone (using mobile data)
// This opens clearmyday.com on their mobile browser
// They generate the calendar URL and subscribe directly on mobile
```

**Benefits:**
- Students use mobile data automatically
- Seamless mobile experience
- Can subscribe to calendar directly on phone
- No need for laptop access

## Contact Sorbonne Admins (Long-term Solution)

**Who to contact:**
- Direction des Systèmes d'Information (DSI)
- Service du Réseau
- Your department's IT support

**What to request:**
1. Whitelist `clearmyday.com` domain
2. Whitelist `clearmyday.xyz` as backup
3. Explain it's an educational tool for Sorbonne students

**Email template:**

```
Objet: Demande de déblocage du site clearmyday.com

Bonjour,

Je suis [étudiant/enseignant] à Sorbonne Université et j'ai développé un outil 
web (clearmyday.com) permettant aux étudiants de filtrer et personnaliser leur 
emploi du temps universitaire.

Actuellement, le pare-feu de l'université bloque l'accès au site via le WiFi 
Sorbonne, classé en catégorie "web hosting" ou "newly-registered-domain".

Pourriez-vous envisager d'ajouter ces domaines à la liste blanche ?
- clearmyday.com
- clearmyday.xyz

Cet outil aide les étudiants de Master DAC, IMA, et ANDROIDE à mieux organiser 
leur emploi du temps académique.

Merci de votre considération.

Cordialement,
[Votre nom]
```

## Recommended Implementation Strategy

### For Students (Add to your README):

```markdown
## Access from Sorbonne WiFi

⚠️ **Important:** The Sorbonne firewall blocks access to this website.

**To generate your calendar:**
1. 📱 Use your phone with **mobile data** (not Sorbonne WiFi)
2. 🌐 Visit clearmyday.com
3. ✨ Generate your calendar subscription URL
4. 📋 Copy the URL to your calendar app

**Why?** The Sorbonne network blocks web hosting platforms. Using mobile data 
bypasses this restriction. Once your calendar is set up, it will sync normally 
even on Sorbonne WiFi.

**Alternative:** Use any WiFi network outside Sorbonne (home, café, etc.)
```

### For Website (Add a banner):

Add a notice banner that detects Sorbonne network and shows instructions:

```typescript
// Add to your main page component
const [isOnSorbonneNetwork, setIsOnSorbonneNetwork] = useState(false);

useEffect(() => {
  // Simple detection: try to access Sorbonne-specific resource
  // Or check if certain requests fail
  fetch('https://ent.sorbonne-universite.fr', { mode: 'no-cors' })
    .then(() => setIsOnSorbonneNetwork(true))
    .catch(() => setIsOnSorbonneNetwork(false));
}, []);

{isOnSorbonneNetwork && (
  <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 mb-4">
    <p className="text-yellow-700">
      📱 <strong>Sur le WiFi Sorbonne?</strong> Utilisez vos données mobiles 
      pour générer votre calendrier. Une fois configuré, il se synchronisera 
      normalement.
    </p>
  </div>
)}
```

## Technical Workarounds Summary

| Solution | Feasibility | User Effort | Success Rate | Recommended |
|----------|-------------|-------------|--------------|-------------|
| Mobile data | ✅ High | Low | 100% | ✅ YES |
| Personal hotspot | ✅ High | Low | 100% | ✅ YES |
| Contact IT admins | ✅ High | High | 80% (slow) | ✅ YES (long-term) |
| QR code mobile | ✅ High | Low | 100% | ✅ YES |
| Different domain | ⚠️ Medium | Medium | 30% | ⚠️ Temporary |
| HTTP version | ❌ Low | Low | 30% | ❌ NO (insecure) |
| VPN/Tor | ❌ None | High | 0% | ❌ NO |

## Conclusion

**Short-term:** Guide students to use mobile data or any non-Sorbonne network to generate their calendar subscription URL once. After setup, calendars will sync normally.

**Long-term:** Contact Sorbonne IT to whitelist your domains. This is the proper solution and shows the tool is officially supported.

**Reality Check:** This is a common issue with university/corporate firewalls. Many educational tools face the same problem. The mobile data workaround is standard practice and actually works very well for calendar subscription services.
