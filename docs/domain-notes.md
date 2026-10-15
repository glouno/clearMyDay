# Domain Notes

Reference material for Sorbonne network access, incident reporting, and programme catalogues.

---

## Sorbonne Wi-Fi Access

**Status updated 15 October 2026:** Paul confirmed that `clearmyday.com` is accessible on Sorbonne Wi-Fi again. The previous domain-blocking incident is resolved, and the homepage warning is being removed with this change.

Students can use the production website on the university network. The mobile-data workaround and IT unblocking request for the old incident are retired.

Earlier reports of certificate interception and domain-category blocking remain in Git history. The confirmation above covers `clearmyday.com`; it does not establish the current status of every Vercel preview URL.

### Investigating a New Access Incident

1. Record the exact URL, date/time, network, and HTTP or certificate error.
2. Compare the same URL on Sorbonne Wi-Fi and another network, and check the deployment and `/api/health` status.
3. Distinguish browser-to-website access problems from server-side CalDAV fetch failures. See [deployment troubleshooting](deployment.md#caldav-fetch-fails) for the latter.
4. If the evidence identifies a new university-network restriction, contact Sorbonne IT with the details below and update this page with the outcome.

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

When escalating a confirmed new network-access incident to Sorbonne IT:

- Include the affected hostname, timestamp, network, exact error, and comparison with another network.
- Explain that ClearMyDay provides personalised university calendar subscriptions.
- Mention Vercel hosting with dynamic CDN IPs. If IT requests an allow-list entry, supply the affected hostname and HTTPS port 443.

Keep a record of communications (ticket numbers, contacts) to avoid duplicate requests.
