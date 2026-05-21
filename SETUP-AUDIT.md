# Setup — Système d'audit concurrentiel

> Guide opérationnel pour activer la page `/audit-concurrentiel` en production sur Vercel.

---

## 1 — Architecture livrée

```
digitallis/
├── audit-concurrentiel.html        ← formulaire public, 4 étapes
├── api/
│   ├── audit-submit.js             ← POST /api/audit-submit
│   └── _lib/
│       ├── airtable.js             ← module Airtable (1 table LEADS)
│       └── pdf-generator.js        ← générateur PDF + Markdown
└── package.json                    ← deps : airtable, @vercel/blob, pdfkit
```

**Flux end-to-end :**

```
[Visiteur] → /audit-concurrentiel → formulaire 4 étapes → submit
        ↓
[/api/audit-submit] :
   1. Création ligne LEADS dans Airtable (status = Reçu)
   2. Génération MD + PDF instantanée (PDFKit)
   3. Upload Vercel Blob → 2 URLs publiques
   4. Update ligne LEADS avec Audit Markdown + Audit PDF
   5. Email client + notif info@digitallis.fr (Resend)
   6. Webhook async optionnel (n8n → Claude API)
        ↓
[UI] Écran de succès avec liens téléchargement
```

---

## 2 — Schéma Airtable « DIGITALLIS »

**Base :** DIGITALLIS
**Table :** LEADS (déjà créée)

| Champ Airtable | Type | Source |
|---|---|---|
| `Entreprise` | Single line text | Question 1 du formulaire |
| `Site web` | URL | Question 2 |
| `Zone de chalandise` | Single line text | Question 3 |
| `Secteur` | Single line text | Question 4 |
| `Taille entreprise` | Single select | Question 5 |
| `Type clientele` | Single select | Question 6 |
| `Frein principal` | Long text | Question 7 |
| `Attente` | Long text | Question 8 — « Qu'attendez-vous de cet audit ? » |
| `Experience agence` | Single select | Question 9 |
| `Budget mensuel` | Single select | Question 10 |
| `Decisionnaire` | Single select | Question 11 |
| `Email` | Email | Question 12 |
| `Telephone` | Phone | Question 13 |
| `Status` | Single select | Auto — `Reçu` au démarrage |
| `Audit Markdown` | URL | Auto — URL Vercel Blob du rapport MD |
| `Audit PDF` | URL | Auto — URL Vercel Blob du rapport PDF |

### Options Single Select recommandées

**Taille entreprise** : `1 (solo)`, `2 à 4`, `5 à 10`, `11 à 25`, `26 à 50`, `50 +`

**Type clientele** : `B2C local (particuliers, proximité)`, `B2C destination (showroom, ticket élevé)`, `B2B pur`, `Mix B2C + B2B`, `E-commerce`, `Service en ligne`

**Experience agence** : `Jamais`, `Une fois`, `Plusieurs fois`

**Budget mensuel** : `Pas encore défini`, `Moins de 2 000 € / mois`, `2 000 – 5 000 € / mois`, `5 000 – 10 000 € / mois`, `Plus de 10 000 € / mois`, `Projet ponctuel (one-shot)`

**Decisionnaire** : `Oui, décisionnaire unique`, `Oui, codécisionnaire`, `Non, je consulte avant décision`, `Non, simple repérage`

**Status** : `Reçu`, `En traitement`, `Livré`, `Archivé`

> 💡 Si tu nommes une option différemment dans Airtable, l'API renvoie une erreur silencieuse à la création. Les libellés doivent matcher **exactement** ceux que le formulaire envoie.

---

## 3 — Personal Access Token Airtable

1. Va sur [airtable.com/create/tokens](https://airtable.com/create/tokens)
2. **Create new token** → nom : `Digitallis Site`
3. **Scopes** : coche `data.records:read` + `data.records:write`
4. **Access** : ajoute la base **DIGITALLIS**
5. Copie le token (`pat...`) — il ne sera plus visible après

### Base ID

Ouvre la table LEADS, regarde l'URL :
```
https://airtable.com/appXXXXXXXXXXXXXX/tbl...
                    ^^^^^^^^^^^^^^^^^^
                    AIRTABLE_BASE_ID
```

---

## 4 — Variables d'environnement Vercel

Va dans **Vercel → projet `digitallissite` → Settings → Environment Variables** et ajoute :

| Variable | Valeur | Notes |
|---|---|---|
| `AIRTABLE_API_KEY` | `pat...` | PAT créé étape 3 |
| `AIRTABLE_BASE_ID` | `app...` | Base ID |
| `AIRTABLE_TABLE_LEADS` | `LEADS` | défaut, à ajuster si nom différent |
| `BLOB_READ_WRITE_TOKEN` | `vercel_blob_rw_...` | voir étape 5 |
| `RESEND_API_KEY` | `re_...` | déjà configuré pour `/api/submit` |
| `RECIPIENT_EMAIL` | `info@digitallis.fr` | déjà configuré |
| `FROM_EMAIL` | `Digitallis <onboarding@resend.dev>` | déjà configuré |
| `AUDIT_WEBHOOK_URL` | _(optionnel)_ | URL n8n pour l'audit IA async |
| `AUDIT_WEBHOOK_SECRET` | _(optionnel)_ | bearer envoyé au webhook |

Coche les 3 environnements (Production / Preview / Development).

---

## 5 — Activer Vercel Blob

1. Dans Vercel, ton projet **digitallissite**
2. Onglet **Storage** → **Create Database** → **Blob**
3. Nom : `digitallis-audits` → Create
4. Vercel ajoute automatiquement `BLOB_READ_WRITE_TOKEN` à ton projet
5. **Redéploie** pour qu'elle soit prise en compte

> 📦 Plan Hobby : 1 GB stockage + 1 GB bande passante gratuits par mois. Largement suffisant.

---

## 6 — Déploiement

```bash
cd "AGENTS WEBSITE BUILDER/AGENT SITE 3D VIP/cinematic-sites-agent-kit-master/cinematic-sites/digitallis"

# Installer les nouvelles deps (déjà fait localement)
npm install

# Tester en local (nécessite Vercel CLI)
vercel dev

# Déployer en preview
vercel

# Déployer en production
vercel --prod
```

**Routes accessibles après déploiement :**
- `https://www.digitallis.fr/audit-concurrentiel` — formulaire public
- `https://www.digitallis.fr/api/audit-submit` — endpoint POST

---

## 7 — Test end-to-end

1. Ouvre `https://www.digitallis.fr/audit-concurrentiel`
2. Remplis les 4 étapes (Entreprise → Clientèle → Attentes → Contact)
3. Soumets → vérifie :
   - ✅ Écran de succès avec liens PDF + MD téléchargeables
   - ✅ Email reçu sur l'adresse renseignée + sur `info@digitallis.fr`
   - ✅ Nouvelle ligne dans la table **LEADS** Airtable :
     - 13 champs remplis (Entreprise → Telephone)
     - `Status` = `Reçu`
     - `Audit Markdown` + `Audit PDF` contiennent les URLs Vercel Blob
4. Clique sur les URLs Airtable → le PDF doit s'ouvrir

---

## 8 — Orchestration IA async (optionnel)

Le webhook `AUDIT_WEBHOOK_URL` reçoit dès la soumission ce payload :

```json
{
  "leadId": "recXXXXXXXXXX",
  "entreprise": "OIDANEOS",
  "payload": { /* toutes les réponses formulaire */ },
  "pdfUrl": "https://...vercel-blob.com/audits/oidaneos/AUDIT-...pdf",
  "mdUrl": "https://...vercel-blob.com/audits/oidaneos/AUDIT-...md",
  "timestamp": "2026-05-13T14:32:00.000Z"
}
```

**Workflow n8n suggéré :**
1. Trigger Webhook entrant
2. HTTP Request → Claude API avec le system prompt de la skill `audit-concurrentiel`
3. WebSearch en parallèle pour collecter les concurrents
4. Génération MD final + PDF complet (ReportLab ou Puppeteer)
5. Upload Vercel Blob (PUT sur l'URL existante = overwrite)
6. Update Airtable :
   - `Status` → `Livré`
   - `Audit Markdown` + `Audit PDF` mis à jour
7. Resend → email au client avec le PDF complet

---

## 9 — Sécurité

- **CORS** : whitelist stricte (`digitallis.fr` + preview Vercel)
- **Honeypot** : champ `botcheck` invisible
- **Robots.txt** : `/audit-concurrentiel` + `/api/` en Disallow
- **Meta robots** : `noindex, nofollow` sur la page
- **Validation** : entreprise + email obligatoires côté serveur

**Limites assumées (V1) :**
- Formulaire public sans captcha → si spam, ajouter Cloudflare Turnstile
- Pas de rate limiting sur l'IP → ajouter Upstash Redis si abus
- Le PDF est un template — l'IA enrichira en async

---

## 10 — Évolutions V2 possibles

- Cloudflare Turnstile sur le formulaire (anti-spam invisible)
- Détection de doublons (même email = update plutôt que création)
- Page de tracking client : `/mon-audit?id=recXXXX` pour voir le statut
- Workflow n8n complet pour l'audit IA (24-72h)
- Notification Slack interne via webhook Resend
- Champ « Source » (UTM tracking) ajouté à LEADS

---

*Setup conçu pour Digitallis · Asana Web · v1.1 · mai 2026*
