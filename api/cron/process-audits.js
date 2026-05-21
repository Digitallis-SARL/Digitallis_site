/**
 * GET /api/cron/process-audits
 *
 * Cron job Vercel : toutes les 5 minutes.
 *
 * 1. Scanne Airtable LEADS pour trouver les lignes avec Status='Lead'
 *    qui n'ont PAS encore reçu d'audit IA complet
 *    (détection : "Audit Markdown" filename commence par "AUDIT-..." sans "-full")
 * 2. Pour chaque lead :
 *    a. Update Status en "En traitement" (race-condition guard)
 *    b. Appelle Claude API avec le payload formulaire
 *    c. Génère PDF + MD complets
 *    d. Upload sur Vercel Blob
 *    e. Update la ligne Airtable (remplace les attachments + Status="Livré")
 *    f. Envoie un email "Votre audit complet est prêt"
 *
 * Sécurité : header Authorization: Bearer ${CRON_SECRET} requis
 * (Vercel Cron passe automatiquement le bon header)
 *
 * Variables d'env :
 *   CRON_SECRET           token aléatoire pour authentifier les invocations
 *   ANTHROPIC_API_KEY     pour Claude
 *   AIRTABLE_API_KEY      pour lire/écrire LEADS
 *   AIRTABLE_BASE_ID
 *   BLOB_READ_WRITE_TOKEN pour upload PDF/MD
 *   RESEND_API_KEY        pour email final
 *   FROM_EMAIL, RECIPIENT_EMAIL
 */

const { put } = require('@vercel/blob');
const Airtable = require('airtable');
const { generateAuditViaClaude } = require('../_lib/claude');
const { generateFullAuditMarkdown } = require('../_lib/pdf-generator-full');
const { generateAuditHtml } = require('../_lib/html-generator');
const { htmlToPdf, closeBrowser } = require('../_lib/pdf-from-html');
const { collectAllEvidence } = require('../_lib/evidence-collector');

function cleanEnv(name) {
  const v = process.env[name];
  if (!v) return '';
  return v.trim().replace(/^["']|["']$/g, '');
}

function slugify(s) {
  return String(s || 'client')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40) || 'client';
}

function todayStamp() {
  const d = new Date();
  const iso = d.toISOString().slice(0, 10);
  const hm = String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
  return `${iso}-${hm}`;
}

function getBase() {
  const apiKey = cleanEnv('AIRTABLE_API_KEY');
  const baseId = cleanEnv('AIRTABLE_BASE_ID');
  if (!apiKey || !baseId) throw new Error('Airtable env vars missing');
  return new Airtable({ apiKey }).base(baseId);
}

const TABLE_LEADS = cleanEnv('AIRTABLE_TABLE_LEADS') || 'LEADS';

/**
 * Détermine si un lead a déjà reçu son audit COMPLET v2 (HTML + PDF Puppeteer).
 * Convention v2 : le champ "Audit HTML" doit contenir une URL.
 * Fallback : si la colonne "Audit HTML" n'existe pas, on retombe sur le filename "-full" du PDF.
 */
function alreadyHasFullAudit(record) {
  // v2 : check le champ Audit HTML
  const htmlUrl = record.get('Audit HTML');
  if (htmlUrl) return true;
  // Fallback v1 : on ne traite que si pas de PDF -full du tout (HTML manque, donc retraitement nécessaire)
  return false;
}

/**
 * Récupère le payload formulaire à partir des champs Airtable.
 */
function recordToFormData(record) {
  return {
    entreprise: record.get('Entreprise') || '',
    siteWeb: record.get('Site web') || '',
    zone: record.get('Zone de chalandise') || '',
    secteur: record.get('Secteur') || '',
    effectif: record.get('Taille entreprise') || '',
    typeClientele: record.get('Type clientele') || '',
    frein: record.get('Frein principal') || '',
    attente: record.get('Attentes') || '',
    experienceAgence: record.get('Experience agence') || '',
    budget: record.get('Budget mensuel') || '',
    decisionnaire: record.get('Decisionnaire') || '',
    email: record.get('Email') || '',
    telephone: record.get('Telephone') || '',
  };
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function buildFinalEmailHtml(formData, htmlUrl, pdfUrl, mdUrl, auditJson) {
  const name = formData.entreprise || 'Bonjour';
  const score = auditJson.score_global_client || '—';
  const opps = (auditJson.opportunites || []).slice(0, 3);
  return `<!doctype html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#FAFAF7;margin:0;padding:32px;color:#1C1F26">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05)">
    <div style="background:#1C1F26;color:#fff;padding:32px">
      <div style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#FACC14;margin-bottom:12px">DIGITALLIS · Votre audit est prêt</div>
      <h1 style="margin:0;font-size:24px;font-weight:600;line-height:1.3">Votre audit concurrentiel complet, ${escapeHtml(name)}.</h1>
    </div>
    <div style="padding:32px">
      <div style="background:#F4F2EA;border-left:4px solid #FACC14;padding:18px 22px;border-radius:8px;margin-bottom:24px">
        <div style="font-size:12px;color:#676F7E;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px">Score global de votre acquisition digitale</div>
        <div style="font-size:42px;font-weight:700;color:#1C1F26;line-height:1">${escapeHtml(score)}<span style="font-size:20px;color:#A8A8A8;font-weight:400">/100</span></div>
      </div>

      <p style="margin:0 0 16px;line-height:1.6">L'audit complet est désormais disponible. Vous y trouverez l'analyse détaillée de votre position sur 7 canaux, comparée à votre panel concurrentiel direct, ainsi qu'un plan d'actions priorisé sur 3 horizons (Quick Wins, Développement, Croissance).</p>

      ${opps.length ? `<p style="margin:24px 0 8px;font-weight:600">Vos 3 opportunités prioritaires :</p>
      <ul style="margin:0 0 20px;padding-left:20px;line-height:1.7">
        ${opps.map(o => `<li>${escapeHtml(o)}</li>`).join('')}
      </ul>` : ''}

      ${htmlUrl ? `<div style="text-align:center;margin:28px 0">
        <a href="${escapeHtml(htmlUrl)}" style="display:inline-block;background:#7C3AED;color:#FFFFFF;font-weight:600;padding:16px 32px;border-radius:10px;text-decoration:none;font-size:15px;box-shadow:0 8px 24px rgba(124,58,237,0.3)">✨  Ouvrir l'audit interactif</a>
      </div>
      <p style="text-align:center;margin:0 0 24px;color:#676F7E;font-size:13px">Présentation 12 slides — navigation au clavier</p>` : ''}

      ${pdfUrl ? `<div style="text-align:center;margin:16px 0">
        <a href="${escapeHtml(pdfUrl)}" style="display:inline-block;background:#FAFAF7;color:#1C1F26;font-weight:600;padding:12px 24px;border-radius:10px;text-decoration:none;border:1px solid #E8E6E0">📄  Télécharger la version PDF</a>
      </div>` : ''}

      <p style="margin:24px 0 0;color:#676F7E;font-size:14px;line-height:1.6">Souhaitez-vous échanger sur ces recommandations ? Répondez à cet email, je vous proposerai un créneau de restitution.</p>
    </div>
    <div style="padding:18px 32px;background:#F4F2EA;color:#676F7E;font-size:12px;font-family:'JetBrains Mono',monospace">
      Digitallis · 195 rue François Fresneau · Baie-Mahault · Guadeloupe
    </div>
  </div>
</body></html>`;
}

async function sendFinalEmail(formData, htmlUrl, pdfUrl, mdUrl, auditJson) {
  const apiKey = cleanEnv('RESEND_API_KEY');
  if (!apiKey) return { sent: false, reason: 'no resend key' };
  const from = cleanEnv('FROM_EMAIL') || 'Digitallis <onboarding@resend.dev>';
  const internal = cleanEnv('RECIPIENT_EMAIL') || 'info@digitallis.fr';
  const recipients = [internal];
  if (formData.email && /@/.test(formData.email)) recipients.unshift(formData.email);

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject: `[Digitallis] Votre audit complet — ${formData.entreprise || 'audit'}`,
      html: buildFinalEmailHtml(formData, htmlUrl, pdfUrl, mdUrl, auditJson),
      ...(formData.email ? { reply_to: internal } : {}),
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    console.error('Final email send failed', resp.status, err);
    return { sent: false, error: err };
  }
  return { sent: true };
}

async function processOneLead(record) {
  const base = getBase();
  const leadId = record.id;
  const formData = recordToFormData(record);
  console.log(`[cron] Processing lead ${leadId} (${formData.entreprise})`);

  // 1. Race condition guard : on tente de passer en "En traitement"
  //    Si une autre instance l'a déjà fait, on skippe.
  //    NB : Airtable n'a pas d'option "En traitement" dans le Status par défaut.
  //    On utilise le simple fait qu'un Status modifié signifie "pris".
  //    Si le user ne veut pas ajouter d'option, on contournera autrement.
  try {
    await base(TABLE_LEADS).update(leadId, { 'Status': 'En traitement' });
  } catch (err) {
    // Si "En traitement" n'existe pas comme option, on log mais on continue.
    // Le risque de double-traitement est faible (cron toutes les 5 min).
    console.warn(`[cron] Could not set Status='En traitement' (option may be missing): ${err.message}`);
  }

  // 2. Collecte des preuves observables (site, SERP, LinkedIn, GBP)
  console.log(`[cron] Collecte des preuves pour ${leadId}...`);
  let evidence = {};
  try {
    evidence = await collectAllEvidence(formData);
    const summary = {
      site: evidence.site?.fetched ? '✓' : '✗',
      serp: evidence.serp?.results ? `✓ (${evidence.serp.results.length} résultats)` : '✗',
      linkedin: evidence.linkedin?.fetched ? '✓' : '✗',
      gbp: evidence.gbp?.found ? '✓' : '✗',
    };
    console.log(`[cron] Preuves collectées :`, summary);
  } catch (err) {
    console.warn(`[cron] Evidence collection partial fail (non-fatal):`, err.message);
  }

  // 3. Génération via Claude avec les preuves
  let auditJson;
  try {
    auditJson = await generateAuditViaClaude(formData, evidence);
  } catch (err) {
    console.error(`[cron] Claude failed for ${leadId}:`, err.message);
    await base(TABLE_LEADS).update(leadId, { 'Status': 'Lead' }).catch(() => {});
    return { ok: false, leadId, error: 'claude_failed' };
  }

  // 3. Génération HTML interactif (toujours) + PDF via Puppeteer + MD
  let htmlContent, pdfBuffer, mdContent;
  try {
    htmlContent = generateAuditHtml(formData, auditJson);
    mdContent = generateFullAuditMarkdown(formData, auditJson);
  } catch (err) {
    console.error(`[cron] HTML/MD gen failed for ${leadId}:`, err);
    await base(TABLE_LEADS).update(leadId, { 'Status': 'Lead' }).catch(() => {});
    return { ok: false, leadId, error: 'html_failed' };
  }

  // PDF Puppeteer : best-effort. Si ça échoue, on continue sans bloquer le client.
  try {
    pdfBuffer = await htmlToPdf(htmlContent);
    console.log(`[cron] PDF Puppeteer généré : ${pdfBuffer.length} bytes`);
  } catch (err) {
    console.warn(`[cron] Puppeteer PDF failed for ${leadId} (non-fatal):`, err.message);
    pdfBuffer = null;
  }

  // 4. Upload Blob (HTML toujours, PDF si dispo, MD toujours)
  const slug = slugify(formData.entreprise);
  const stamp = todayStamp();
  const htmlKey = `audits/${slug}/AUDIT-${slug}-${stamp}-full.html`;
  const pdfKey = `audits/${slug}/AUDIT-${slug}-${stamp}-full.pdf`;
  const mdKey = `audits/${slug}/AUDIT-${slug}-${stamp}-full.md`;
  let htmlUrl, pdfUrl, mdUrl;
  try {
    const uploads = [
      put(htmlKey, htmlContent, {
        access: 'public',
        contentType: 'text/html; charset=utf-8',
        addRandomSuffix: false,
        allowOverwrite: true,
      }),
      put(mdKey, mdContent, {
        access: 'public',
        contentType: 'text/markdown; charset=utf-8',
        addRandomSuffix: false,
        allowOverwrite: true,
      }),
    ];
    if (pdfBuffer) {
      uploads.push(put(pdfKey, pdfBuffer, {
        access: 'public',
        contentType: 'application/pdf',
        addRandomSuffix: false,
        allowOverwrite: true,
      }));
    }
    const results = await Promise.all(uploads);
    htmlUrl = results[0].url;
    mdUrl = results[1].url;
    pdfUrl = results[2] ? results[2].url : null;
  } catch (err) {
    console.error(`[cron] Blob upload failed for ${leadId}:`, err);
    await base(TABLE_LEADS).update(leadId, { 'Status': 'Lead' }).catch(() => {});
    return { ok: false, leadId, error: 'blob_failed' };
  }

  // 5. Update Airtable : remplace les attachments + Status final
  try {
    const updateFields = {
      'Audit Markdown': [{ url: mdUrl, filename: `AUDIT-${slug}-${stamp}-full.md` }],
      'Status': 'Livré',
    };
    if (pdfUrl) {
      updateFields['Audit PDF'] = [{ url: pdfUrl, filename: `AUDIT-${slug}-${stamp}-full.pdf` }];
    }
    // Airtable champ "Audit HTML" (URL) — optionnel, mis à jour seulement si la colonne existe.
    // On l'ajoute toujours, si la colonne n'existe pas Airtable renverra UNKNOWN_FIELD_NAME et on tombera dans le catch ci-dessous.
    updateFields['Audit HTML'] = htmlUrl;
    await base(TABLE_LEADS).update(leadId, updateFields);
  } catch (err) {
    // Si "Audit HTML" n'existe pas, on retry sans ce champ
    if (err.message && err.message.includes('UNKNOWN_FIELD_NAME')) {
      console.warn(`[cron] Champ 'Audit HTML' absent dans Airtable, mise à jour partielle`);
      const updateFields2 = {
        'Audit Markdown': [{ url: mdUrl, filename: `AUDIT-${slug}-${stamp}-full.md` }],
        'Status': 'Livré',
      };
      if (pdfUrl) {
        updateFields2['Audit PDF'] = [{ url: pdfUrl, filename: `AUDIT-${slug}-${stamp}-full.pdf` }];
      }
      try {
        await base(TABLE_LEADS).update(leadId, updateFields2);
      } catch (err2) {
        console.error(`[cron] Airtable update failed for ${leadId}:`, err2);
      }
    } else {
      console.error(`[cron] Airtable update failed for ${leadId}:`, err);
    }
  }

  // 6. Email
  const emailResult = await sendFinalEmail(formData, htmlUrl, pdfUrl, mdUrl, auditJson);

  console.log(`[cron] ✅ Lead ${leadId} processed (html=${htmlUrl}, pdf=${pdfUrl}, email=${emailResult.sent})`);
  return { ok: true, leadId, htmlUrl, pdfUrl, mdUrl, emailSent: emailResult.sent };
}

module.exports = async function handler(req, res) {
  // ─── Auth cron (Vercel passe Authorization: Bearer ${CRON_SECRET}) ───
  const expected = `Bearer ${cleanEnv('CRON_SECRET')}`;
  const got = req.headers.authorization || '';
  if (!cleanEnv('CRON_SECRET') || got !== expected) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }

  try {
    const base = getBase();

    // Récupère uniquement les leads à Status = "Lead"
    const records = await base(TABLE_LEADS)
      .select({
        filterByFormula: `{Status} = 'Lead'`,
        maxRecords: 5, // safety : on traite max 5 leads par run pour rester dans le timeout
      })
      .firstPage();

    const toProcess = records.filter(r => !alreadyHasFullAudit(r));

    console.log(`[cron] Found ${records.length} leads with Status=Lead, ${toProcess.length} need full audit`);

    if (toProcess.length === 0) {
      res.status(200).json({ ok: true, processed: 0, message: 'No leads to process' });
      return;
    }

    // Traitement séquentiel (Claude API + génération PDF Puppeteer = lourd)
    const results = [];
    for (const record of toProcess) {
      const r = await processOneLead(record);
      results.push(r);
    }

    // Libère le browser Puppeteer pour le prochain cold start
    await closeBrowser().catch(() => {});

    res.status(200).json({
      ok: true,
      processed: results.length,
      results,
    });
  } catch (err) {
    console.error('[cron] Fatal error', err);
    await closeBrowser().catch(() => {});
    res.status(500).json({ ok: false, error: err.message });
  }
};

// Vercel : ce module doit avoir un timeout étendu (configuré dans vercel.json)
