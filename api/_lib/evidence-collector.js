/**
 * Collecteur de preuves observables — Digitallis
 *
 * Récupère et extrait des preuves vérifiables depuis :
 *   - Le site web du lead (HTML brut → balises, schema, liens sortants)
 *   - LinkedIn entreprise (page publique)
 *   - SERP Google via SerpAPI (positions, ads, Local Pack GBP)
 *
 * Chaque méthode renvoie un objet avec des FAITS, jamais d'interprétation.
 * Claude reçoit ces faits et note ce qui est observable.
 *
 * Variables d'env :
 *   SERPAPI_KEY  (https://serpapi.com)
 */

function cleanEnv(name) {
  const v = process.env[name];
  if (!v) return '';
  return v.trim().replace(/^["']|["']$/g, '');
}

const FETCH_TIMEOUT_MS = 8000;
const USER_AGENT = 'Mozilla/5.0 (compatible; DigitallisAuditBot/1.0; +https://digitallis.fr)';

async function fetchWithTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeout || FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
      signal: ctrl.signal,
      ...opts,
    });
  } finally {
    clearTimeout(t);
  }
}

function extractMeta(html, name) {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i');
  const m = html.match(re);
  return m ? m[1].trim() : null;
}

function extractTag(html, tagRe) {
  const m = html.match(tagRe);
  return m ? m[1].trim().replace(/\s+/g, ' ').slice(0, 200) : null;
}

function extractAllMatches(html, re) {
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

function uniqueLimited(arr, limit = 5) {
  return [...new Set(arr)].slice(0, limit);
}

/**
 * Analyse le HTML d'un site et extrait les signaux observables.
 *
 * @param {string} url - URL canonique à fetcher
 * @returns {Promise<Object>} - Signaux extraits
 */
async function collectSiteEvidence(url) {
  if (!url) return null;

  // Normalise l'URL
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  try {
    const resp = await fetchWithTimeout(url);
    if (!resp.ok) {
      return { fetched: false, url, error: `HTTP ${resp.status}` };
    }
    const html = await resp.text();

    // Extractions ciblées
    const title = extractTag(html, /<title[^>]*>([^<]+)<\/title>/i);
    const metaDescription = extractMeta(html, 'description');
    const h1 = extractTag(html, /<h1[^>]*>([^<]+)<\/h1>/i);
    const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);

    // Schema JSON-LD
    const schemaBlocks = extractAllMatches(html, /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    const schemaTypes = [];
    schemaBlocks.forEach((block) => {
      try {
        const parsed = JSON.parse(block.trim());
        const items = Array.isArray(parsed) ? parsed : [parsed];
        items.forEach((it) => {
          if (it['@type']) schemaTypes.push(Array.isArray(it['@type']) ? it['@type'].join(',') : it['@type']);
          if (it['@graph']) {
            it['@graph'].forEach((g) => g['@type'] && schemaTypes.push(g['@type']));
          }
        });
      } catch {}
    });

    // FAQ / Témoignages / Certifications (heuristiques sur le texte)
    const lowerHtml = html.toLowerCase();
    const hasFaq = /<\w+[^>]*\bclass=["'][^"']*\bfaq\b[^"']*["']/i.test(html)
                || schemaTypes.includes('FAQPage')
                || /\bquestions? fr[ée]quentes?\b/i.test(html);
    const hasTestimonials = /témoignage|testimonial|avis client|customer story/i.test(html);
    const certifications = [];
    if (lowerHtml.includes('qualiopi')) certifications.push('Qualiopi');
    if (lowerHtml.includes('iso ')) certifications.push('ISO (mention)');
    if (lowerHtml.includes('google partner')) certifications.push('Google Partner');
    if (lowerHtml.includes('opco')) certifications.push('OPCO (mention)');

    // Liens sortants vers réseaux sociaux
    const linkedinLinks = uniqueLimited(extractAllMatches(html, /href=["'](https?:\/\/(?:www\.)?linkedin\.com\/[^"']+)["']/gi));
    const facebookLinks = uniqueLimited(extractAllMatches(html, /href=["'](https?:\/\/(?:www\.)?facebook\.com\/[^"']+)["']/gi));
    const instagramLinks = uniqueLimited(extractAllMatches(html, /href=["'](https?:\/\/(?:www\.)?instagram\.com\/[^"']+)["']/gi));
    const tiktokLinks = uniqueLimited(extractAllMatches(html, /href=["'](https?:\/\/(?:www\.)?tiktok\.com\/[^"']+)["']/gi));

    // Nombre de liens internes (proxy pour profondeur de site)
    const internalLinkCount = (html.match(/<a\s[^>]*href=["'][^"']+["']/gi) || []).length;

    // Extrait textuel : tag-strip naïf pour donner à Claude un échantillon
    const textOnly = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const textExcerpt = textOnly.slice(0, 800);

    return {
      fetched: true,
      url,
      statusCode: resp.status,
      title,
      metaDescription,
      h1,
      hasViewport,
      schemaTypes: [...new Set(schemaTypes)],
      hasFaq,
      hasTestimonials,
      certifications,
      linkedinLinks,
      facebookLinks,
      instagramLinks,
      tiktokLinks,
      internalLinkCount,
      textExcerpt,
    };
  } catch (err) {
    return { fetched: false, url, error: err.message || String(err) };
  }
}

/**
 * Tente de récupérer la page publique LinkedIn de l'entreprise.
 * LinkedIn bloque souvent les bots → échec attendu dans ~70% des cas, on le signale.
 *
 * @param {string|null} linkedinUrl - URL fournie par le site (linkedinLinks[0])
 * @param {string} entrepriseName - fallback : tente linkedin.com/company/{slug}
 */
async function collectLinkedinEvidence(linkedinUrl, entrepriseName) {
  let url = linkedinUrl;
  if (!url && entrepriseName) {
    const slug = entrepriseName.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    url = `https://www.linkedin.com/company/${slug}`;
  }
  if (!url) return null;

  try {
    const resp = await fetchWithTimeout(url, { timeout: 5000 });
    if (!resp.ok) {
      return { fetched: false, url, error: `HTTP ${resp.status} (LinkedIn bloque souvent les bots)` };
    }
    const html = await resp.text();
    const title = extractTag(html, /<title[^>]*>([^<]+)<\/title>/i);
    const metaDescription = extractMeta(html, 'description');
    // Tentative d'extraction du nombre de followers (rarement accessible côté bot)
    const followersMatch = html.match(/(\d[\d\s,.]*)\s*(?:followers?|abonnés?)/i);
    const followersCount = followersMatch ? followersMatch[1].trim() : null;
    return {
      fetched: true,
      url,
      title,
      metaDescription,
      followersCount,
    };
  } catch (err) {
    return { fetched: false, url, error: err.message || String(err) };
  }
}

/**
 * Interroge SerpAPI pour récupérer la SERP Google (positions, ads, Local Pack).
 *
 * @param {string[]} queries - Liste de requêtes à tester (max 2 pour économiser)
 * @param {string} location - Localisation (ex: "Guadeloupe, France")
 */
async function collectSerpEvidence(queries, location = 'France') {
  const apiKey = cleanEnv('SERPAPI_KEY');
  if (!apiKey) return null;
  if (!queries || queries.length === 0) return null;

  // Pour économiser : on prend 1 requête principale uniquement (la plus représentative)
  const q = queries[0];

  try {
    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.set('engine', 'google');
    url.searchParams.set('q', q);
    url.searchParams.set('location', location);
    url.searchParams.set('hl', 'fr');
    url.searchParams.set('gl', 'fr');
    url.searchParams.set('api_key', apiKey);

    const resp = await fetchWithTimeout(url.toString(), { timeout: 12000 });
    if (!resp.ok) return { error: `SerpAPI HTTP ${resp.status}` };
    const data = await resp.json();

    return {
      queries: [q],
      results: (data.organic_results || []).slice(0, 10).map(r => ({
        position: r.position,
        title: r.title,
        link: r.link,
        snippet: r.snippet,
      })),
      ads: (data.ads || []).map(a => ({
        title: a.title,
        link: a.link,
        source: a.source,
      })),
      localPack: ((data.local_results && data.local_results.places) || []).map(p => ({
        title: p.title,
        rating: p.rating,
        reviews: p.reviews,
        type: p.type,
        address: p.address,
      })),
      relatedSearches: (data.related_searches || []).slice(0, 5).map(r => r.query),
    };
  } catch (err) {
    return { error: err.message || String(err) };
  }
}

/**
 * Détecte une fiche GBP via SerpAPI sur "[entreprise] [zone]".
 * Si présente dans Local Pack ou Knowledge Graph → preuve.
 */
async function collectGbpEvidence(entrepriseName, zone) {
  const apiKey = cleanEnv('SERPAPI_KEY');
  if (!apiKey || !entrepriseName) return null;

  const q = `${entrepriseName} ${zone || ''}`.trim();

  try {
    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.set('engine', 'google');
    url.searchParams.set('q', q);
    url.searchParams.set('hl', 'fr');
    url.searchParams.set('gl', 'fr');
    url.searchParams.set('api_key', apiKey);

    const resp = await fetchWithTimeout(url.toString(), { timeout: 12000 });
    if (!resp.ok) return { found: false, error: `HTTP ${resp.status}` };
    const data = await resp.json();

    // Knowledge Graph
    const kg = data.knowledge_graph;
    if (kg && (kg.title || kg.local_address)) {
      return {
        found: true,
        source: 'knowledge_graph',
        title: kg.title,
        rating: kg.rating,
        reviews: kg.review_count || kg.reviews,
        category: kg.type,
        address: kg.address || (kg.local_address && kg.local_address.formatted),
        hours: kg.hours,
      };
    }

    // Local Pack
    const lp = (data.local_results && data.local_results.places) || [];
    const match = lp.find(p => (p.title || '').toLowerCase().includes(entrepriseName.toLowerCase().slice(0, 6)));
    if (match) {
      return {
        found: true,
        source: 'local_pack',
        title: match.title,
        rating: match.rating,
        reviews: match.reviews,
        category: match.type,
        address: match.address,
      };
    }

    return { found: false, queryUsed: q };
  } catch (err) {
    return { found: false, error: err.message || String(err) };
  }
}

/**
 * Orchestrateur : collecte toutes les preuves en parallèle (avec timeouts courts).
 *
 * @param {Object} formData - Données du formulaire
 * @returns {Promise<Object>} - { site, linkedin, serp, gbp }
 */
async function collectAllEvidence(formData) {
  const { entreprise, siteWeb, zone, secteur } = formData;

  // Construit les requêtes SERP les plus pertinentes pour le secteur/zone
  const secteurShort = (secteur || '').split(/[,;-]/)[0].trim();
  const zoneShort = (zone || '').split(/[,;]/)[0].trim();
  const serpQueries = [];
  if (secteurShort && zoneShort) serpQueries.push(`${secteurShort} ${zoneShort}`);
  else if (secteurShort) serpQueries.push(secteurShort);

  // Lance toutes les collectes en parallèle
  const [siteResult, serpResult, gbpResult] = await Promise.all([
    siteWeb ? collectSiteEvidence(siteWeb).catch(e => ({ fetched: false, error: e.message })) : Promise.resolve(null),
    serpQueries.length ? collectSerpEvidence(serpQueries, zoneShort + ', France').catch(e => ({ error: e.message })) : Promise.resolve(null),
    collectGbpEvidence(entreprise, zoneShort).catch(e => ({ found: false, error: e.message })),
  ]);

  // Si on a un site fetché, on essaie aussi LinkedIn via le lien trouvé dans le HTML
  let linkedinResult = null;
  if (siteResult && siteResult.fetched && siteResult.linkedinLinks && siteResult.linkedinLinks.length) {
    linkedinResult = await collectLinkedinEvidence(siteResult.linkedinLinks[0], entreprise).catch(e => ({ fetched: false, error: e.message }));
  } else {
    // Tentative aveugle sur linkedin.com/company/{slug}
    linkedinResult = await collectLinkedinEvidence(null, entreprise).catch(e => ({ fetched: false, error: e.message }));
  }

  return {
    site: siteResult,
    linkedin: linkedinResult,
    serp: serpResult,
    gbp: gbpResult,
  };
}

module.exports = {
  collectAllEvidence,
  collectSiteEvidence,
  collectLinkedinEvidence,
  collectSerpEvidence,
  collectGbpEvidence,
};
