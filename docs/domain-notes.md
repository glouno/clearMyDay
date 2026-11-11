# Domain Notes

Reference material for issues tied to Sorbonne infrastructure, network restrictions, and programme catalogues.

---

## Firewall Behaviour (Sorbonne Wi-Fi)

- HTTPS traffic is inspected and re-signed by `pare-feu.sorbonne-universite.fr`, causing certificate warnings for `clearmyday.com`.
- Domains categorised as “newly-registered” or “web hosting” are blocked outright; Vercel preview URLs fall into this bucket.
- Workarounds for students:
  - Use mobile data once to generate the subscription URL (calendars continue syncing afterwards).
  - Connect through a personal hotspot or any off-campus network.
  - Provide a QR code linking to the app for quick mobile access.

### Long-term Fix (IT Whitelisting)

Email template (French) to request domain whitelisting:

```
Objet : Demande de déblocage du site clearmyday.com

Bonjour,

Je suis étudiant en Master Informatique à Sorbonne Université. J'ai développé
l'outil https://www.clearmyday.com qui permet de filtrer les calendriers
des masters (DAC, IMA, ANDROIDE) et de générer un lien compatible Apple/Google
Calendar.

Le pare-feu bloque actuellement le site (catégorie « web hosting » ou
« newly-registered domain ») et remplace le certificat SSL. Pourriez-vous ajouter
ces domaines à la liste blanche ?
  - clearmyday.com
  - clearmyday.xyz

Hébergement : Vercel (IP dynamiques via CDN). Déblocage recommandé par nom de
domaine plutôt que par IP fixe.

Merci pour votre aide.

Cordialement,
Paul Béglin – Master Informatique MIND
```

Fields often required on firewall forms:

```
Destination : clearmyday.com
Port        : 443
Protocole   : HTTPS (TCP)
Note        : Hébergé sur Vercel (IP dynamiques), mieux vaut autoriser le domaine.
```

---

## Master/Course Catalogue Reference

Source of truth is `src/lib/sorbonne-masters.ts`. For quick lookups, the supported masters include (non-exhaustive):

- **M1:** AI2D/ANDROIDE, BIM, CCA/SFPN, IMA, IQ, MIND/DAC, RES, RES EIT Digital, RES ITESCIA, SAR, SESI, SSI-ALT/SFPN-ALT, STL.
- **M2:** AI2D/ANDROIDE, BIM, CCA/SFPN, IMA, IQ, MIND/DAC, RES (incl. EIT Digital / ITESCIA / INSTA), SAR, SESI, SSI-ALT/SFPN-ALT, STL (incl. INSTA).

Notable special cases:

- `OIP` / `INOIP` events behave like regular courses; they are available across all relevant M2 masters and expose group variants (e.g., `OIP-AI2D-Gr2`).
- General institutional events (SOI, Conférence Métiers, Réunions de rentrée) bypass the course filter but still respect date and group constraints.

For the complete, up-to-date list, consult the codebase file mentioned above.

---

## Contact Checklist

When escalating to Sorbonne IT:

- Highlight that ClearMyDay reduces load on the CalDAV servers by filtering (>99% noise reduction).
- Mention that calendars are hosted on Vercel with dynamic IPs; domain-based allow-listing is necessary.
- Provide both domains (`clearmyday.com`, `clearmyday.xyz`) and explain the educational use case.

Keep a record of communications (ticket numbers, contacts) to avoid duplicate requests.
