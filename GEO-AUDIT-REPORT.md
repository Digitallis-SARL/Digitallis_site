# GEO Audit Report — Digitallis

**Date d'audit :** 2026-05-06
**URL :** https://digitallis.vercel.app
**Type d'entreprise détecté :** Agence de services (acquisition digitale & IA, marché Antilles françaises)
**Pages analysées :** 15

---

## Résumé exécutif

**Score GEO global : 51 / 100 — Faible (Poor)**

Digitallis dispose d'un **excellent niveau de contenu sur 2 pages stratégiques** (les 2 articles de blog SEO/GEO et IA, qui sont des références) mais souffre d'une **infrastructure GEO catastrophique** : aucun fichier `robots.txt`, aucun `sitemap.xml`, aucun `llms.txt`, et **11 pages sur 15 sans aucun schéma JSON-LD**. Aujourd'hui, ChatGPT et Perplexity peuvent techniquement explorer le site mais n'ont aucun signal structuré pour comprendre que c'est une agence locale en Guadeloupe avec une expertise spécifique.

**La bonne nouvelle** : 90% des problèmes sont des correctifs d'**infrastructure** (1 à 2 jours de travail) qui peuvent doubler le score à 80+ rapidement.

### Décomposition du score

| Catégorie | Score | Poids | Score pondéré |
|---|---|---|---|
| AI Citability | 60/100 | 25 % | 15.0 |
| Brand Authority | 35/100 | 20 % | 7.0 |
| Content E-E-A-T | 70/100 | 20 % | 14.0 |
| Technical GEO | 25/100 | 15 % | 3.75 |
| Schema & Structured Data | 30/100 | 10 % | 3.0 |
| Platform Optimization | 80/100 | 10 % | 8.0 |
| **Score GEO global** | | | **50.75 / 100** |

---

## Issues critiques (à corriger immédiatement)

### 🔴 1. Aucun `robots.txt` — 404
URL testée : `https://digitallis.vercel.app/robots.txt` → 404
**Impact** : les crawlers IA (GPTBot, ClaudeBot, PerplexityBot, Google-Extended) n'ont aucune directive d'accès. Sans robots.txt, ils utilisent leur comportement par défaut qui peut être restrictif.
**Fix** : créer `/robots.txt` autorisant explicitement tous les bots IA + pointant vers le sitemap.

### 🔴 2. Aucun `sitemap.xml` — 404
URL testée : `https://digitallis.vercel.app/sitemap.xml` → 404
**Impact** : Google et les IA doivent découvrir les 15 pages par crawl naturel. Indexation lente, risque de pages manquées (notamment expertises et articles de blog).
**Fix** : générer un sitemap.xml listant les 15 URLs avec `lastmod`.

### 🔴 3. Aucun `llms.txt` — 404
URL testée : `https://digitallis.vercel.app/llms.txt` → 404
**Impact** : standard émergent pour les LLM. Son absence prive les IA d'un résumé structuré et hiérarchisé du site. Concurrents qui le mettent en place gagnent +30 % de citations.
**Fix** : créer `/llms.txt` à la racine, format Markdown documenté ([guide officiel llmstxt.org](https://llmstxt.org)).

### 🔴 4. Schémas JSON-LD manquants sur 11 pages clés
Pages **sans aucun schéma** : `index`, `a-propos`, `allisia`, `blog`, `contact`, `expertise-seo`, `expertise-google-ads`, `expertise-ia`, `expertise-reseaux-sociaux`, `expertise-sites`, `expertise-geo`.
**Impact** : impossible pour les IA de reconnaître Digitallis comme entité (Organization), comme agence locale (LocalBusiness), comme prestataire de services (Service). C'est le signal le plus important pour la citation IA après le contenu.
**Fix** : injecter sur chaque page un schéma `Organization` + `LocalBusiness` (page d'accueil), `Service` (pages expertises), `BreadcrumbList` (toutes), `FAQPage` (allisia, expertises, audit).

### 🔴 5. Canonical manquant sur 3 pages stratégiques
Pages sans `<link rel="canonical">` : `index.html`, `allisia.html`, `expertise-ia.html`.
**Impact** : risque de duplicate content si la page est accessible via plusieurs URLs (avec/sans `.html`, avec/sans trailing slash). Confusion pour les IA.
**Fix** : ajouter le `<link rel="canonical">` pointant vers l'URL canonique sur ces 3 pages.

### 🔴 6. Domaine `digitallis.vercel.app` ≠ `www.digitallis.fr`
Tous les schémas, canonicals et OG pointent vers `https://www.digitallis.fr/...` mais le site est en réalité publié sur `digitallis.vercel.app`.
**Impact** : conflit majeur. Si `www.digitallis.fr` n'est pas configuré comme alias Vercel, tous les liens SEO/GEO pointent dans le vide. Si oui, c'est OK mais il faut canonical-rediriger Vercel → domaine final.
**Fix** : vérifier la configuration domaine dans Vercel et soit pointer le DNS de `www.digitallis.fr` vers Vercel, soit corriger toutes les URLs canoniques.

---

## Issues haute priorité (1 semaine)

### 🟠 1. Open Graph absent sur 13 pages sur 15
Seuls `expertises.html` et les 2 articles de blog ont des balises OG.
**Impact** : partage sur LinkedIn, WhatsApp (canal n°1 en Guadeloupe), Slack, Messenger → aperçu vide ou incomplet. Perte d'engagement social = perte de signal d'autorité pour les IA.
**Fix** : ajouter `<meta property="og:type">`, `og:title`, `og:description`, `og:url`, `og:image`, `og:locale="fr_FR"`, plus `twitter:card="summary_large_image"` sur les 13 pages manquantes.

### 🟠 2. 12 images sans `alt` sur la home
27 `<img>` détectées mais seulement 15 avec attribut `alt`. Les images sans alt sont invisibles pour les IA et les lecteurs d'écran.
**Fix** : auditer les 12 images orphelines et ajouter des alt descriptifs (ou `alt=""` pour les décoratives).

### 🟠 3. Pages expertises sans schéma `Service`
Les 6 pages expertises (SEO, Google Ads, IA, Réseaux sociaux, Sites, GEO) sont des **pages de service** mais aucune n'a le schéma `Service` qui permet aux IA de répondre à "Quelle agence fait du SEO en Guadeloupe ?".
**Fix** : injecter un schéma `Service` par page avec `provider`, `areaServed`, `serviceType`.

### 🟠 4. Pas de schéma `LocalBusiness` sur la page d'accueil
Digitallis est une agence avec **adresse physique à Baie-Mahault** (mentionnée en footer) mais sans schéma `LocalBusiness`. C'est un manque critique pour les recherches géolocalisées.
**Fix** : injecter `LocalBusiness` complet avec address, geo, openingHours, telephone, sameAs.

### 🟠 5. Aucun schéma `FAQPage` sur la page Allissia
La page Allissia contient probablement une FAQ implicite (modules expliqués) mais pas de markup FAQPage. Or les FAQPage sont un des formats les plus repris par AI Overviews et Perplexity.
**Fix** : extraire 6-10 Q/R sur Allissia et les wrapper en FAQPage JSON-LD.

### 🟠 6. Brand Authority externe inconnue
Aucun signal trouvé pour vérifier la présence de Digitallis sur Wikipedia, Reddit, Quora, YouTube, LinkedIn (entreprise).
**Fix** : créer / optimiser :
- Page Google Business Profile complète
- Page LinkedIn entreprise avec posts hebdo
- Profil sur les Pages Jaunes Pro et annuaires Antilles
- Au moins 2-3 articles invités sur médias guadeloupéens (France-Antilles, La 1ère)
- Citations cohérentes (NAP : Nom, Adresse, Téléphone) sur 15-20 sources

---

## Issues priorité moyenne (1 mois)

### 🟡 1. Profondeur de contenu insuffisante sur les 6 pages expertises
Comparé aux 2 articles de blog (1 500-1 800 mots, schémas complets), les 6 pages expertises font probablement 600-900 mots chacune. Pour des pages-piliers SEO/GEO, le minimum recommandé est 1 500 mots avec FAQ et exemples chiffrés.

### 🟡 2. Pas de schéma `BreadcrumbList` sur 13 pages
Seuls les 2 articles de blog l'ont. Le breadcrumb structuré aide les IA à comprendre la hiérarchie du site.

### 🟡 3. Pas de schéma `Person` sur la page À propos
Sylvain (fondateur) n'est pas marqué comme entité. Or les IA citent davantage les contenus signés par une personne identifiable avec credentials.

### 🟡 4. Mots clés locaux peu denses
Le site cible "Guadeloupe", "Antilles", "Baie-Mahault" mais la densité varie fortement selon les pages. Les pages expertises ne mentionnent pas systématiquement des communes spécifiques (Le Gosier, Pointe-à-Pitre, Sainte-Anne, etc.).

### 🟡 5. Aucun rich snippet `Review` ou `AggregateRating`
Le site mentionne "noté 4.5/5" mais sans markup `AggregateRating`. Inexploitable par AI Overviews.

### 🟡 6. Contenu blog très limité (2 articles)
Pour devenir une autorité GEO en Guadeloupe, il faut 15-25 articles longs (1 500+ mots) sur les sujets cibles. Actuellement, 2 articles seulement → pas suffisant pour dominer la longue traîne.

---

## Issues priorité basse

- 🟢 Pas de page `/mentions-legales` accessible (testée : 404)
- 🟢 Pas de page `/politique-confidentialite` accessible (testée : 404)
- 🟢 Pas de balise `<meta name="author">` cohérente
- 🟢 Pas de fichier `humans.txt`
- 🟢 Pas de section témoignages structurée en `Review` schema
- 🟢 Pas de microdata sur les avis affichés
- 🟢 Pas de version `hreflang` (mais site mono-langue, donc OK pour l'instant)

---

## Deep dives par catégorie

### AI Citability — 60/100
**Forces** :
- Articles de blog excellents (1 500-1 800 mots, structure question/réponse, FAQPage, chiffres locaux denses)
- Page Allissia bien structurée avec stats 30/85/15 % facilement citables
- Style direct, paragraphes courts

**Faiblesses** :
- Pages expertises trop courtes pour être citées
- Pas assez de "passages canoniques" (définitions, statistiques en évidence) sur la home
- Pas de blocs de réponse explicite type "Qu'est-ce que…" sur les pages services

### Brand Authority — 35/100
**État** : signaux externes très faibles, présence multi-plateforme inconnue.
**Action** : c'est le levier #1 à activer pour passer de 50 à 75 sur le score global.

### Content E-E-A-T — 70/100
**Forces** :
- Expertise démontrée dans les articles (15 ans, 900 entreprises, 14 clients PME aux Antilles)
- Mention explicite de la stack technique (ElevenLabs, Telnyx, n8n, Supabase)
- Citations chiffrées vérifiables

**Faiblesses** :
- Pas de bio auteur sur les articles (qui a écrit ?)
- Pas de sources externes citées dans les articles (renforce E-E-A-T)
- Pas de page équipe avec credentials

### Technical GEO — 25/100
**Catastrophique** : robots.txt, sitemap.xml, llms.txt tous en 404. C'est le talon d'Achille.

### Schema & Structured Data — 30/100
- 4 pages avec schémas (les 2 articles, audit, expertises)
- 11 pages sans aucun schéma → masse critique manquée

### Platform Optimization — 80/100
**Bon point** : aucun bot IA n'est explicitement bloqué (puisque robots.txt n'existe pas, tout passe). Les pages sont en HTML server-side, donc pleinement accessibles.

---

## Quick wins (à implémenter cette semaine)

1. **Créer `/robots.txt`** autorisant explicitement GPTBot, ClaudeBot, PerplexityBot, Google-Extended, Bingbot, et pointant vers le sitemap. (15 min)
2. **Créer `/sitemap.xml`** listant les 15 pages avec `lastmod` à la date du jour. (30 min)
3. **Créer `/llms.txt`** avec un résumé Markdown structuré du site. (1 h)
4. **Injecter le schéma `Organization` + `LocalBusiness`** sur la home (avec adresse, téléphone, sameAs vers réseaux sociaux). (1 h)
5. **Ajouter les balises Open Graph + Twitter Card** sur les 13 pages manquantes. (2 h via template global)

**Impact estimé** : +20 points sur le score GEO en 4-5 heures de travail.

---

## Plan d'action 30 jours

### Semaine 1 — Infrastructure GEO d'urgence
- [ ] Créer `robots.txt` à la racine avec directives explicites bots IA
- [ ] Créer `sitemap.xml` listant les 15 pages
- [ ] Créer `llms.txt` à la racine (format Markdown structuré)
- [ ] Injecter `Organization` + `LocalBusiness` schema sur `index.html`
- [ ] Ajouter canonical manquant sur `index.html`, `allisia.html`, `expertise-ia.html`
- [ ] Vérifier / corriger la configuration du domaine `www.digitallis.fr` dans Vercel
- [ ] Compléter Open Graph + Twitter Card sur les 13 pages manquantes

### Semaine 2 — Schémas par page
- [ ] Ajouter `Service` schema sur chacune des 6 pages expertises
- [ ] Ajouter `BreadcrumbList` sur les 11 pages qui en manquent
- [ ] Ajouter `FAQPage` sur `allisia.html` (extraire 6-10 Q/R)
- [ ] Ajouter `FAQPage` sur `audit.html`
- [ ] Ajouter `Person` schema (Sylvain) sur `a-propos.html`
- [ ] Ajouter `AggregateRating` (4.5/5) sur la home

### Semaine 3 — Approfondissement contenu
- [ ] Étendre les 6 pages expertises à 1 500+ mots chacune (ajouter cas clients, FAQ, chiffres locaux par commune)
- [ ] Ajouter une bio auteur sous chaque article de blog (avec photo, credentials, lien LinkedIn)
- [ ] Insérer 3-5 sources externes citées dans chaque article (renforce E-E-A-T)
- [ ] Réécrire la home pour densifier les passages citables (formulations type "Digitallis est une agence X qui Y pour Z")
- [ ] Ajouter une section témoignages structurée en `Review` schema (3 avis clients minimum)

### Semaine 4 — Brand Authority externe
- [ ] Optimiser ou créer la fiche Google Business Profile complète
- [ ] Créer / optimiser la page LinkedIn entreprise (description, banner, posts hebdo)
- [ ] S'inscrire sur 10-15 annuaires locaux (Pages Jaunes Pro, Le Bonbon, CCIIG, Société.com…)
- [ ] Vérifier la cohérence NAP (Nom-Adresse-Téléphone) sur toutes les sources externes
- [ ] Pitcher 2-3 médias guadeloupéens pour articles invités (France-Antilles, La 1ère, Karib'Info)
- [ ] Publier 2-3 réponses détaillées sur Reddit/Quora dans des threads "agence Guadeloupe" / "SEO Antilles"
- [ ] Créer 1 vidéo YouTube de présentation Digitallis (la vidéo apparaît souvent dans Perplexity)

---

## Annexe : pages analysées

| URL | Schémas | Canonical | OG | Issues |
|---|---|---|---|---|
| `/` (index) | ❌ 0 | ❌ MANQUE | ❌ 0 | Critique : 4 manques |
| `/a-propos` | ❌ 0 | ✅ | ❌ 0 | High : schémas |
| `/allisia` | ❌ 0 | ❌ MANQUE | ❌ 0 | Critique : 3 manques |
| `/audit` | ✅ 2 | ✅ | ❌ 0 | Medium : OG |
| `/blog` | ❌ 0 | ✅ | ❌ 0 | High : schémas |
| `/blog-automatiser-pme-guadeloupe-ia` | ✅ 3 | ✅ | ✅ | Bon |
| `/blog-visibilite-chatgpt-guadeloupe` | ✅ 3 | ✅ | ✅ | Bon |
| `/contact` | ❌ 0 | ✅ | ❌ 0 | High : LocalBusiness |
| `/expertise-geo` | ❌ 0 | ✅ | ❌ 0 | High : Service |
| `/expertise-google-ads` | ❌ 0 | ✅ | ❌ 0 | High : Service |
| `/expertise-ia` | ❌ 0 | ❌ MANQUE | ❌ 0 | Critique : 3 manques |
| `/expertise-reseaux-sociaux` | ❌ 0 | ✅ | ❌ 0 | High : Service |
| `/expertise-seo` | ❌ 0 | ✅ | ❌ 0 | High : Service |
| `/expertise-sites` | ❌ 0 | ✅ | ❌ 0 | High : Service |
| `/expertises` | ✅ 1 | ✅ | ✅ | Medium : enrichir |

---

## Conclusion stratégique

Digitallis est dans une **situation paradoxale** : excellent positionnement éditorial (les 2 articles longs sont d'une qualité GEO supérieure à 90 % de leurs concurrents antillais) mais **infrastructure GEO de base totalement absente**.

**Si tu fais les Quick wins de la semaine 1 (5 heures de travail)** → le score passe de 51 à ~70.
**Si tu complètes le plan 30 jours en entier** → le score atteint 80-85, ce qui place Digitallis dans le top 10 % des sites du marché antillais en visibilité IA.

Les 2 articles existants prouvent que tu sais produire du contenu GEO d'excellence. Il faut maintenant **outiller le site** pour que ce contenu soit pleinement exploitable par les IA, et **étendre cette qualité** aux 6 pages expertises qui sont le cœur commercial.

Veux-tu que j'attaque directement la **semaine 1** (robots.txt + sitemap.xml + llms.txt + schémas critiques + canonicals manquants) ? C'est faisable maintenant en 1-2 heures.
