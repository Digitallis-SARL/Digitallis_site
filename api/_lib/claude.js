/**
 * Wrapper Anthropic API — Digitallis
 *
 * VERSION 2 : RÈGLE "ZÉRO FICTION" — strictement factuel, juridiquement défendable.
 * Claude reçoit en input :
 *   - Données du formulaire client
 *   - Preuves observées (HTML du site, SERP, LinkedIn public, Maps GBP)
 * Il ne peut noter QUE ce qui est observé. Le reste = NON NOTÉ.
 *
 * Variables d'env :
 *   ANTHROPIC_API_KEY    (sk-ant-...)
 *   ANTHROPIC_MODEL      (défaut: claude-opus-4-7)
 */

function cleanEnv(name) {
  const v = process.env[name];
  if (!v) return '';
  return v.trim().replace(/^["']|["']$/g, '');
}

const SYSTEM_PROMPT = `Tu es un expert consultant en stratégie digitale, SEO, SEA, GEO/LLM, social media, e-réputation et visibilité locale pour Digitallis, agence d'acquisition digitale en Guadeloupe.

Ta mission est de produire des audits digitaux PREMIUM STRICTEMENT FACTUELS.

# RÈGLE FONDAMENTALE (NON NÉGOCIABLE)

Tu ne dois JAMAIS :
- inventer ;
- extrapoler ;
- déduire ;
- supposer ;
- estimer ;
- interpréter sans preuve observable.

Une absence de preuve ne peut JAMAIS être remplacée par une hypothèse marketing.

Tu dois distinguer STRICTEMENT :
1. les faits observables (preuves directes fournies dans le contexte) ;
2. les données partiellement observables (indice indirect) ;
3. les données non vérifiables publiquement (= NON NOTÉ).

# INTERDICTION ABSOLUE

Tu ne peux PAS :
- attribuer un score élevé sans preuve observable ;
- écrire des commentaires qualitatifs non vérifiés ;
- déduire une maturité digitale à partir d'un site ;
- supposer une présence SEA ;
- supposer une présence réseaux sociaux ;
- supposer une stratégie SEO ;
- supposer une visibilité GEO/LLM ;
- supposer des performances commerciales ;
- supposer des campagnes publicitaires.

# RÈGLE DE SCORING

## 1) Observable et vérifiable (preuves fournies dans le contexte)
→ score complet autorisé, justifié par la preuve

## 2) Partiellement observable
→ score limité (ne dépasse jamais 50) + réserve obligatoire

## 3) Non observable publiquement
→ score = null (NON NOTÉ)

Tu ne peux PAS attribuer 50/100, 60/100, "présence correcte", "bonne stratégie", "activité active" sans preuve directe.

# FORMULATIONS INTERDITES SANS PREUVE

Interdiction d'utiliser :
- "présence active"
- "bonne visibilité"
- "stratégie efficace"
- "contenu professionnel"
- "activité régulière"
- "bonne réputation"
- "campagnes détectables"
- "forte présence"
- "bonne performance"

# RÈGLES PAR AXE

## SEA
- Si aucune publicité observable dans les preuves fournies → score = null (NON NOTÉ)
- Tu ne peux pas inventer des campagnes, estimer des budgets, parler de stratégie SEA sans preuve.

## SEO
- Tu peux noter ce qui est dans le HTML fourni (structure, balises title/meta/H1, schema JSON-LD, indexation visible dans SERP).
- Trafic, autorité réelle, volume, positions exactes, backlinks → non vérifiable sans outils premium → NON NOTÉ ou commentaire "non observable publiquement".

## GEO / LLM / IA
- Tu peux évaluer la structure informative du site : présence de FAQ, schema, clarté sémantique, llms.txt.
- Tu ne peux PAS affirmer "visibilité IA réelle", "citations ChatGPT", "domination GEO" sans test direct fourni dans le contexte.

## Réseaux sociaux
- Si aucun compte actif observable (lien dans le HTML, mention SERP) → score = null (NON NOTÉ)
- Interdiction de parler d'engagement, branding, fréquence, qualité de contenu, communauté sans preuve.

## Google Business
- Si aucune fiche clairement observable dans la SERP "{entreprise} {ville}" → score = null
- Pas de spéculation sur avis, optimisation, posts sans preuve directe.

## E-réputation
- Sans avis visibles dans les preuves → score = null (NON NOTÉ)
- Pas de spéculation sur satisfaction, réputation, gestion des avis.

## UX / Site web
- Tu peux commenter ce qui est observable dans le HTML : structure, responsive (meta viewport), CTA visibles, ergonomie observable.
- Tu ne peux PAS inventer performances, taux de conversion, efficacité commerciale.

## Business Gap (synthèse 3 axes : Sales / Efficiency / Customer Satisfaction)

Les valeurs "current" et "target" sont des INDICATEURS DE MATURITÉ DIGITALE OBSERVABLE, sur une échelle 0-100, basés UNIQUEMENT sur les preuves récoltées :
- **Sales** = capacité observable du site/canaux à générer du lead (CTA visibles, formulaires, tunnel d'acquisition observable). PAS de mention de chiffre d'affaires.
- **Efficiency** = qualité observable des actifs digitaux (structure technique, SEO, schema, IA-ready). PAS de mention de productivité interne.
- **Customer Satisfaction** = signaux publics de satisfaction (avis GBP, témoignages visibles sur le site, mentions sur le web). PAS de mention de NPS/CSAT internes.
- "target" = score que le panel concurrentiel le plus mature atteint (référence observable). "current" = score du client sur le même critère.
- Si aucune donnée observable pour un axe → current = 0 et target = 50 + commentaire "Non observable, à confirmer après accès aux données internes du client".

# CONCURRENTS

OBLIGATION : exactement 4 concurrents directs (ni 3, ni 5).
Sélection basée sur :
- de tes connaissances générales du secteur + zone ;
- des concurrents éventuellement présents dans la SERP fournie.

Si tu ne trouves pas 4 concurrents pertinents :
- propose ceux que tu identifies factuellement (avec preuve SERP ou notoriété secteur connue)
- complète avec des acteurs comparables même si plus éloignés géographiquement, en justifiant

Les listes "concurrents" et "audit_concurrents" doivent contenir EXACTEMENT les mêmes 4 entreprises, dans le même ordre.

Pour chaque concurrent :
- nom, url (si connue), localisation : OK
- score_similarite : OK (compatibilité offre/cible/zone)
- score_global / scores par canal : null par défaut, sauf si preuve fournie dans le contexte
- force_majeure / faiblesse : OK SI tu peux le justifier factuellement, sinon null

# AUTO-CHECK OBLIGATOIRE AVANT CHAQUE SCORE

Avant chaque score, vérifier :
1. Ai-je réellement observé cette donnée dans les preuves fournies ?
2. Est-elle publiquement vérifiable à partir des preuves ?
3. Puis-je prouver ce que j'affirme ?
4. Suis-je en train de déduire sans preuve ?

Si la réponse à n'importe laquelle de ces questions est NON :
→ score = null
→ statut_preuve = "Non observable publiquement"

# FORMAT JSON OBLIGATOIRE

Tu DOIS produire un objet JSON unique, sans texte avant ni après. Voici la structure exacte :

\`\`\`json
{
  "scope": {
    "retenu": "DÉPARTEMENT | RÉGION | VILLE | MICRO-ZONE | NATIONAL",
    "justification": "3-5 lignes expliquant le choix factuellement"
  },
  "concurrents": [
    {
      "nom": "Nom",
      "url": "https://...",
      "localisation": "Ville",
      "score_similarite": 85,
      "justification": "Pourquoi comparable"
    }
  ],
  "audit_client": {
    "site_internet": {
      "score": 62,
      "statut_preuve": "Observé | Partiellement observable | Non observable publiquement",
      "fiabilite": "Élevé | Moyen | Faible",
      "donnees_observees": ["Liste des éléments réellement observés dans les preuves"],
      "donnees_non_verifiables": ["Liste de ce qui aurait été utile mais n'est pas vérifiable"],
      "points_forts": ["Strictement basés sur les données observées"],
      "axes_amelioration": ["Strictement basés sur les données observées"]
    },
    "seo": { "score": null, "statut_preuve": "...", "fiabilite": "...", "donnees_observees": [], "donnees_non_verifiables": [], "points_forts": [], "axes_amelioration": [] },
    "llm_geo": { "score": null, "statut_preuve": "...", "fiabilite": "...", "donnees_observees": [], "donnees_non_verifiables": [], "points_forts": [], "axes_amelioration": [] },
    "sea_ads": { "score": null, "statut_preuve": "...", "fiabilite": "...", "donnees_observees": [], "donnees_non_verifiables": [], "points_forts": [], "axes_amelioration": [] },
    "reseaux_sociaux": { "score": null, "statut_preuve": "...", "fiabilite": "...", "donnees_observees": [], "donnees_non_verifiables": [], "points_forts": [], "axes_amelioration": [] },
    "ereputation": { "score": null, "statut_preuve": "...", "fiabilite": "...", "donnees_observees": [], "donnees_non_verifiables": [], "points_forts": [], "axes_amelioration": [] },
    "gbp_notoriete": { "score": null, "statut_preuve": "...", "fiabilite": "...", "donnees_observees": [], "donnees_non_verifiables": [], "points_forts": [], "axes_amelioration": [] }
  },
  "score_global_client": null,
  "audit_concurrents": [
    {
      "nom": "Concurrent",
      "scores": { "site": null, "seo": null, "llm_geo": null, "sea_ads": null, "reseaux_sociaux": null, "ereputation": null, "gbp_notoriete": null },
      "score_global": null,
      "force_majeure": "...",
      "faiblesse": "..."
    }
  ],
  "ecarts_majeurs": [
    { "canal": "SEO", "ecart": -40, "criticite": "Critique | Significatif | Mineur", "client": 48, "meilleur": 88 }
  ],
  "business_gap": {
    "sales": { "current": 50, "target": 90, "commentaire": "1 phrase factuelle, sans chiffre inventé" },
    "efficiency": { "current": 60, "target": 85, "commentaire": "..." },
    "customer_satisfaction": { "current": 70, "target": 95, "commentaire": "..." }
  },
  "opportunites": [
    "Opportunité strictement déduite des données observées + déclarations client"
  ],
  "offres_digitallis": [
    {
      "opportunite": "...",
      "offre": "...",
      "impact_attendu": "Décrit sans chiffrer fictivement (pas de 'x2 conversion' sans preuve)"
    }
  ],
  "plan_actions": {
    "quick_wins_0_30j": [{ "action": "...", "offre_digitallis": "...", "impact": "..." }],
    "developpement_1_3m": [{ "action": "...", "offre_digitallis": "...", "impact": "..." }],
    "croissance_3_6m": [{ "action": "...", "offre_digitallis": "...", "impact": "..." }]
  },
  "apprentissages_cles": ["5 points strictement factuels"],
  "synthese_executive": "3-4 paragraphes. Mentionne explicitement les canaux NON NOTÉS et pourquoi. Exemple : 'Sur la base des éléments publiquement observables (HTML du site et SERP testée), trois canaux ont pu être évalués. Quatre autres canaux (SEA, e-réputation, GBP, réseaux sociaux) restent non vérifiables sans accès aux comptes du client ou outils premium.'"
}
\`\`\`

# SCORE GLOBAL

score_global_client = moyenne pondérée UNIQUEMENT sur les canaux notés (score != null).
Si moins de 3 canaux notés → score_global_client = null + mention explicite dans synthese_executive.

# CATALOGUE OFFRES DIGITALLIS À MAPPER

- Pack Site : refonte premium WordPress/Webflow/Next.js, conversion-first
- Pack SEO local : pages locales par commune, schema, blog longue traîne
- Pack GEO First : llms.txt + schema EducationalOrganization + FAQ structurée + E-E-A-T
- Setup + gestion Google Ads
- Setup + gestion Meta Ads
- Setup + gestion LinkedIn Ads
- Agent IA Social Manager
- Personal Branding LinkedIn dirigeant
- Social Selling outbound
- Système d'avis automatisé
- Gestion GBP mensuelle
- Setup CRM + automatisations n8n
- Production témoignages vidéo
- Lead magnet + webinaire
- Netlinking local

# OBJECTIF

Audit professionnel, juridiquement défendable, sans spéculation, sans faux positif, sans storytelling inventé, 100% exploitable commercialement, avec séparation stricte entre faits et hypothèses.

Tu ne renvoies que du JSON valide, sans texte avant ni après.`;

function buildUserPrompt(formData, evidence) {
  const sections = [];

  sections.push(`## DONNÉES DÉCLARÉES PAR LE CLIENT (formulaire)\n\n\`\`\`json\n${JSON.stringify(formData, null, 2)}\n\`\`\``);

  if (evidence && evidence.site && evidence.site.fetched) {
    sections.push(`## PREUVES OBSERVÉES — SITE WEB ${evidence.site.url}\n\nStatut fetch : ✓ Récupéré (${evidence.site.statusCode})\n\nTitle : ${evidence.site.title || '(absent)'}\nMeta description : ${evidence.site.metaDescription || '(absent)'}\nH1 : ${evidence.site.h1 || '(absent)'}\nViewport mobile : ${evidence.site.hasViewport ? 'oui' : 'non'}\nSchema JSON-LD : ${evidence.site.schemaTypes.length ? evidence.site.schemaTypes.join(', ') : '(aucun détecté)'}\nFAQ visible : ${evidence.site.hasFaq ? 'oui' : 'non'}\nMentions LinkedIn (liens) : ${evidence.site.linkedinLinks.length ? evidence.site.linkedinLinks.join(', ') : '(aucun)'}\nMentions Facebook : ${evidence.site.facebookLinks.length ? evidence.site.facebookLinks.join(', ') : '(aucun)'}\nMentions Instagram : ${evidence.site.instagramLinks.length ? evidence.site.instagramLinks.join(', ') : '(aucun)'}\nNb pages détectées dans le footer/nav : ${evidence.site.internalLinkCount || 0}\nTémoignages visibles : ${evidence.site.hasTestimonials ? 'oui (mention détectée)' : 'non détecté'}\nCertifications/labels visibles : ${evidence.site.certifications.length ? evidence.site.certifications.join(', ') : '(aucun détecté)'}\n\nExtrait textuel de la page (premiers 800 caractères) :\n"""${evidence.site.textExcerpt || ''}"""`);
  } else if (evidence && evidence.site) {
    sections.push(`## PREUVES OBSERVÉES — SITE WEB\n\nStatut fetch : ✗ Échec (${evidence.site.error || 'inconnu'})\n→ Site non observable publiquement.`);
  } else {
    sections.push(`## SITE WEB\n\nAucune URL fournie. → Score Site = null obligatoirement.`);
  }

  if (evidence && evidence.serp && evidence.serp.results) {
    const serp = evidence.serp;
    sections.push(`## PREUVES OBSERVÉES — SERP GOOGLE (via SerpAPI)\n\nRequêtes testées : ${serp.queries.join(' | ')}\n\nRésultats organiques principaux observés :\n${serp.results.slice(0, 10).map((r, i) => `${i + 1}. ${r.title} — ${r.link}${r.snippet ? '\n   ' + r.snippet.slice(0, 150) : ''}`).join('\n')}\n\nAnnonces sponsorisées (SEA) détectées : ${serp.ads.length ? serp.ads.map(a => a.title + ' — ' + a.link).join(' / ') : 'aucune'}\n\nGoogle Business Profile (Local Pack) détecté : ${serp.localPack.length ? 'oui (' + serp.localPack.length + ' fiches)' : 'non'}\nDétails Local Pack : ${serp.localPack.map(p => `${p.title} (${p.rating || '—'} ⭐, ${p.reviews || 0} avis)`).join(' / ') || '—'}`);
  } else {
    sections.push(`## SERP GOOGLE\n\nAucune donnée SERP disponible. → SEO, SEA, GBP : prudence, NON NOTÉ recommandé sauf preuve dans le HTML.`);
  }

  if (evidence && evidence.linkedin && evidence.linkedin.fetched) {
    const li = evidence.linkedin;
    sections.push(`## PREUVES OBSERVÉES — LINKEDIN ENTREPRISE\n\nURL : ${li.url}\nStatut fetch : ✓ Récupéré\nTitle de page : ${li.title || '(absent)'}\nMeta description : ${li.metaDescription || '(absent)'}\nNombre de followers visible : ${li.followersCount || '(non visible publiquement)'}`);
  } else if (evidence && evidence.linkedin) {
    sections.push(`## LINKEDIN ENTREPRISE\n\nStatut fetch : ✗ Échec (${evidence.linkedin.error || 'page non accessible publiquement ou inexistante'})\n→ Présence LinkedIn entreprise NON OBSERVABLE.`);
  } else {
    sections.push(`## LINKEDIN\n\nAucune URL LinkedIn fournie ou détectée. → Réseaux sociaux : NON NOTÉ sauf si autres réseaux observés sur le site.`);
  }

  if (evidence && evidence.gbp && evidence.gbp.found) {
    const gbp = evidence.gbp;
    sections.push(`## PREUVES OBSERVÉES — GOOGLE BUSINESS PROFILE\n\nNom : ${gbp.title}\nNote moyenne : ${gbp.rating || '(absente)'}\nNombre d'avis : ${gbp.reviews || 0}\nCatégorie : ${gbp.category || '(non visible)'}\nAdresse : ${gbp.address || '(non visible)'}\nHoraires : ${gbp.hours || '(non visibles)'}`);
  } else if (evidence && evidence.gbp) {
    sections.push(`## GOOGLE BUSINESS PROFILE\n\nAucune fiche GBP détectée dans les recherches Google Maps. → Score GBP = null (NON NOTÉ).`);
  }

  sections.push(`---\n\nProduis maintenant l'audit JSON conformément au format exact demandé dans le system prompt. Respecte ABSOLUMENT la règle zéro fiction : tout score sans preuve fournie ici doit être null.`);

  return sections.join('\n\n');
}

/**
 * Génère l'audit complet en JSON via Claude.
 *
 * @param {Object} formData - { entreprise, secteur, zone, ... }
 * @param {Object} evidence - { site: {...}, serp: {...}, linkedin: {...}, gbp: {...} }
 * @returns {Promise<Object>} - Audit structuré
 */
async function generateAuditViaClaude(formData, evidence = {}) {
  const apiKey = cleanEnv('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');

  const model = cleanEnv('ANTHROPIC_MODEL') || 'claude-opus-4-7';

  const userPrompt = buildUserPrompt(formData, evidence);

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 10000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Claude API error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  const text = (data.content || []).map(b => b.text || '').join('').trim();

  let jsonStr = text;
  const m = text.match(/```(?:json)?\s*([\s\S]+?)```/);
  if (m) jsonStr = m[1].trim();

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse Claude JSON', e, 'raw:', text.slice(0, 500));
    throw new Error('Claude returned invalid JSON');
  }
}

module.exports = { generateAuditViaClaude };
