# Demande de Déblocage Réseau - ClearMyDay

## Informations pour le Service Informatique Sorbonne

---

## ⚠️ IMPORTANT : Déblocage par Domaine vs IP

Vercel (hébergeur du site) utilise une infrastructure avec **IPs dynamiques**. Les adresses IP changent régulièrement via leur réseau CDN global.

**Recommandation :** Demander un déblocage par **nom de domaine** plutôt que par IP fixe.

---

## 📋 Formulaire à Remplir

### Option A : Déblocage par Nom de Domaine (RECOMMANDÉ)

```
Source IP       : [LAISSER VIDE] ou "Réseau WiFi Sorbonne (tous les étudiants)"
Destination     : clearmyday.com (DOMAINE)
Port            : 443
Protocole       : HTTPS (TCP)
```

**Justification à ajouter :**
> "Le site est hébergé sur Vercel, qui utilise des IPs dynamiques via CDN. 
> Un déblocage par nom de domaine (clearmyday.com) est nécessaire plutôt 
> qu'une IP fixe."

---

### Option B : Déblocage par IP (si domaine impossible)

Si le service informatique exige absolument une IP :

```
Source IP       : [LAISSER VIDE] ou "Réseau WiFi Sorbonne"
Destination IP  : 216.198.79.1
Port            : 443
Protocole       : TCP/HTTPS
```

**⚠️ Problème :** Cette IP peut changer. Il faudra refaire une demande si Vercel change l'IP.

**Plages IP Vercel (alternatives) :**
- 64.29.17.0/24
- 64.239.109.0/24
- 76.76.21.0/24
- 216.198.79.0/24 (votre IP actuelle est dans cette plage)

**Note :** Ces plages ne sont pas exhaustives et peuvent changer.

---

## 📝 Explication Détaillée des Champs

### 1. Source IP
**À remplir :** `[LAISSER VIDE]` ou `Réseau WiFi étudiant Sorbonne`

**Pourquoi :**
- Vous ne connaissez pas les IPs spécifiques des étudiants
- Le service réseau connaît ses propres plages IP internes
- La demande concerne TOUS les étudiants sur le WiFi

**Alternative :** Si le champ est obligatoire, demandez au service réseau quelle est la plage IP du réseau WiFi étudiant (ex: `10.51.0.0/16`)

---

### 2. Destination IP / Domaine
**À remplir :** `clearmyday.com` (préféré) ou `216.198.79.1` (si IP obligatoire)

**Pourquoi :**
- Le site est hébergé sur Vercel, un CDN global
- Les IPs changent pour optimiser la performance et la disponibilité
- Vercel ne garantit pas d'IPs fixes pour les plans gratuits/hobby

**IP actuelle :** `216.198.79.1` (vérifiée le 2025-10-02)

**Domaines additionnels (optionnel) :**
- `clearmyday.xyz` (domaine de backup)
- `*.vercel.app` (domaines Vercel, si vous voulez débloquer tous les projets Vercel)

---

### 3. Port
**À remplir :** `443` (et optionnellement `80`)

**Pourquoi :**
- Port 443 = HTTPS (chiffré, sécurisé) - **OBLIGATOIRE**
- Port 80 = HTTP (non chiffré) - optionnel, pour redirection automatique vers HTTPS

**Recommandation :** Spécifier `443` uniquement, le site utilise HTTPS exclusivement.

---

### 4. Protocole
**À remplir :** `HTTPS` ou `TCP` (selon les options du formulaire)

**Options possibles :**
- Si liste déroulante propose "HTTPS" → choisir `HTTPS`
- Si liste déroulante propose seulement "TCP/UDP" → choisir `TCP`
- Si champ texte libre → écrire `HTTPS (TCP)`

**Explication :**
- HTTPS fonctionne au-dessus de TCP
- Le pare-feu Sorbonne inspecte déjà HTTPS (MITM), donc ils comprennent ce protocole

---

## 💬 Texte de Demande Complet (Copier-Coller)

```
Objet : Demande de déblocage du site clearmyday.com

Bonjour,

Je suis étudiant en Master DAC à Sorbonne Université et j'ai développé un outil 
web (clearmyday.com) permettant aux étudiants de filtrer et personnaliser leur 
emploi du temps universitaire à partir des calendriers CalDAV de l'université.

Actuellement, le pare-feu de l'université bloque l'accès au site via le WiFi 
Sorbonne. Le site est catégorisé comme "web hosting" car il est hébergé sur 
Vercel, une plateforme d'hébergement pour applications web éducatives.

INFORMATIONS TECHNIQUES POUR LE DÉBLOCAGE :
- Nom de domaine : clearmyday.com
- IP actuelle : 216.198.79.1 (peut changer - hébergement Vercel/CDN)
- Port : 443 (HTTPS)
- Protocole : HTTPS (TCP)
- Source : Réseau WiFi étudiant Sorbonne (tous les utilisateurs)
- Destination : clearmyday.com OU 216.198.79.1

JUSTIFICATION :
⚠️ Note importante : Vercel utilise des IPs dynamiques via leur réseau CDN global. 
Un déblocage par nom de domaine (clearmyday.com) serait plus stable qu'un 
déblocage par IP fixe.

UTILITÉ :
Cet outil aide les étudiants de Master DAC, IMA, et ANDROIDE à :
- Filtrer leur calendrier universitaire par cours
- Sélectionner uniquement leur groupe TD/TME
- S'abonner à un calendrier personnalisé dans leur application calendrier
- Synchronisation automatique avec les données de planning.sorbonne-universite.fr

Le site accède uniquement aux données publiques du serveur CalDAV de l'université 
(planning.sorbonne-universite.fr) et ne collecte aucune donnée personnelle.

Pourriez-vous envisager d'ajouter ce domaine à la liste blanche ?

Domaines à débloquer :
- clearmyday.com (principal)
- clearmyday.xyz (backup optionnel)

Je reste disponible pour toute information complémentaire.

Merci de votre considération.

Cordialement,
[Votre nom]
[Votre numéro étudiant]
[Votre promotion : M1/M2 DAC]
```

---

## 🔍 Informations Techniques Supplémentaires

### Vérifier l'IP Actuelle

Si le service informatique a besoin de l'IP au moment de la demande :

```bash
# Commande pour obtenir l'IP actuelle
dig clearmyday.com +short
# Résultat actuel : 216.198.79.1
```

### Plages IP Vercel Connues

Si déblocage par plage CIDR nécessaire :

```
216.198.79.0/24    (votre site est dans cette plage)
64.29.17.0/24      (réseau Vercel)
64.239.109.0/24    (réseau Vercel)
76.76.21.0/24      (réseau Vercel)
```

**Attention :** Ces plages ne sont pas exhaustives et Vercel peut en ajouter.

---

## ✅ Recommandation Finale

### Remplissage du Formulaire :

| Champ | Valeur Recommandée | Alternative |
|-------|-------------------|-------------|
| **Source IP** | [LAISSER VIDE] | "Réseau WiFi Sorbonne" |
| **Destination** | **clearmyday.com** | 216.198.79.1 |
| **Port** | **443** | 443, 80 |
| **Protocole** | **HTTPS** ou **TCP** | HTTPS (TCP) |

### Ordre de Préférence :

1. ✅ **MEILLEUR** : Déblocage par domaine `clearmyday.com` sur port 443/HTTPS
2. ⚠️ **ACCEPTABLE** : Déblocage IP `216.198.79.1` sur port 443/HTTPS (peut nécessiter mise à jour)
3. ✅ **IDÉAL** : Déblocage de la plage `216.198.79.0/24` sur port 443/HTTPS (plus stable)

---

## 📞 Si Refus ou Questions

### Arguments à Ajouter :

1. **Sécurité :**
   - Site utilise HTTPS exclusivement
   - Hébergé sur Vercel (plateforme professionnelle, utilisée par GitHub, OpenAI, etc.)
   - Pas de collecte de données personnelles
   - Code open source disponible sur GitHub

2. **Légitimité Académique :**
   - Accède uniquement aux données publiques de planning.sorbonne-universite.fr
   - Améliore l'expérience étudiante
   - Développé par un étudiant pour ses pairs
   - Alternative : les étudiants utilisent leurs données mobiles (contournement actuel)

3. **Précédent :**
   - Le site accède au serveur CalDAV de l'université (planning.sorbonne-universite.fr)
   - Si ce serveur est accessible, le site devrait l'être aussi
   - Simple interface web pour données déjà publiques

### Si le Service Réseau Refuse :

**Plan B :** Demander uniquement un déblocage de **catégorie** plutôt que d'IP/domaine spécifique :
- Demander retrait de la catégorie "web hosting" pour `clearmyday.com`
- Demander retrait de la catégorie "newly-registered-domain" pour `clearmyday.xyz`

---

## 📊 Suivi de la Demande

Une fois la demande envoyée :

1. **Tester régulièrement** (tous les 2-3 jours) depuis le WiFi Sorbonne
2. **Relancer** si pas de réponse sous 1 semaine
3. **Documenter** : numéro de ticket, personne contact, dates
4. **Alternative** : Contacter votre responsable de Master pour appuyer la demande

**Contact suggéré si escalade nécessaire :**
- Votre responsable de Master (peut contacter la DSI directement)
- Service pédagogique (peut justifier l'utilité académique)
- Association étudiante (peut relayer la demande collectivement)

---

Bonne chance avec votre demande ! 🚀
