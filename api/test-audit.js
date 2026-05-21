/**
 * POST /api/test-audit
 *
 * Endpoint de TEST — pipeline complet sans Airtable.
 * Reçoit un formData directement, lance evidence + Claude + HTML + PDF + email.
 * Retourne les URLs au caller (HTML, PDF, MD).
 *
 * Sécurité : header Authorization: Bearer ${CRON_SECRET}
 * (réutilise le secret cron pour ne pas créer une nouvelle variable)
 *
 * Body JSON requis :
 *   { entreprise, secteur, zone, siteWeb, effectif, typeClientele,
 *     frein, attente, experienceAgence, budget, decisionnaire, email, telephone }
 *
 * À supprimer / désactiver une fois Airtable débloqué.
 */

const { put } = require('@vercel/blob');
const { generateAuditViaClaude } = require('./_lib/claude');
const { generateFullAuditMarkdown } = require('./_lib/pdf-generator-full');
const { generateAuditHtml } = require('./_lib/html-generator');
const { htmlToPdf, closeBrowser } = require('./_lib/pdf-from-html');
const { collectAllEvidence } = require('./_lib/evidence-collector');

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

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function buildEmailHtml(formData, htmlUrl, pdfUrl, auditJson) {
  const name = formData.entreprise || 'Bonjour';
  const score = auditJson.score_global_client;
  const scoreDisplay = (score === null || score === undefined) ? 'NON NOTÉ' : `${score}/100`;
  const opps = (auditJson.opportunites || []).slice(0, 3);
  return `<!doctype html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#F5F1E8;margin:0;padding:32px;color:#1A1A1A">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05)">
    <div style="background:#1A1A1A;color:#fff;padding:32px">
      <div style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#FFC700;margin-bottom:12px">DIGITALLIS · Audit prêt</div>
      <h1 style="margin:0;font-size:22px;font-weight:800;line-height:1.2">Votre audit ${escapeHtml(name)} est disponible.</h1>
    </div>
    <div style="padding:32px">
      <div style="background:#FAF9F4;border-left:4px solid #FFC700;padding:16px 20px;border-radius:8px;margin-bottom:24px">
        <div style="font-size:11px;color:#6B6B6B;text-transform:uppercase;letter-spacing:0.1em">Score global observable</div>
        <div style="font-size:32px;font-weight:800;color:#1A1A1A;margin-top:4px">${escapeHtml(scoreDisplay)}</div>
      </div>
      <p style="line-height:1.6;margin:0 0 16px">Audit produit selon la méthodologie zéro fiction : tous les scores sont basés sur des éléments publiquement observables. Les canaux marqués NON NOTÉ correspondent à des données non vérifiables sans accès aux comptes.</p>
      ${opps.length ? `<p style="font-weight:700;margin:24px 0 8px">Vos opportunités prioritaires :</p><ul style="line-height:1.7">${opps.map(o => `<li>${escapeHtml(o)}</li>`).join('')}</ul>` : ''}
      <div style="text-align:center;margin:32px 0">
        <a href="${escapeHtml(htmlUrl)}" style="display:inline-block;background:#FFC700;color:#1A1A1A;font-weight:700;padding:16px 32px;border-radius:10px;text-decoration:none;font-size:15px">✨ Ouvrir l'audit complet</a>
      </div>
      ${pdfUrl ? `<div style="text-align:center"><a href="${escapeHtml(pdfUrl)}" style="display:inline-block;color:#6B6B6B;font-weight:500;padding:8px 16px;text-decoration:none;font-size:13px">📄 Télécharger la version PDF</a></div>` : ''}
    </div>
    <div style="padding:14px 32px;background:#FAF9F4;color:#6B6B6B;font-size:11px">
      Digitallis · 195 rue François Fresneau · Baie-Mahault · Guadeloupe
    </div>
  </div>
</body></html>`;
}

async function sendEmail(formData, htmlUrl, pdfUrl, auditJson) {
  const apiKey = cleanEnv('RESEND_API_KEY');
  if (!apiKey) return { sent: false };
  const from = cleanEnv('FROM_EMAIL') || 'Digitallis <onboarding@resend.dev>';
  const internal = cleanEnv('RECIPIENT_EMAIL') || 'info@digitallis.fr';
  const recipients = [internal];
  if (formData.email && /@/.test(formData.email)) recipients.unshift(formData.email);

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: recipients,
      subject: `[Digitallis] Audit ${formData.entreprise || 'test'} prêt`,
      html: buildEmailHtml(formData, htmlUrl, pdfUrl, auditJson),
    }),
  });
  return { sent: resp.ok };
}

module.exports = async function handler(req, res) {
  // Auth
  const expected = `Bearer ${cleanEnv('CRON_SECRET')}`;
  if (req.headers.authorization !== expected) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'POST only' });
  }

  let formData = req.body;
  if (typeof formData === 'string') {
    try { formData = JSON.parse(formData); } catch { formData = {}; }
  }
  formData = formData || {};

  if (!formData.entreprise) {
    return res.status(400).json({ ok: false, error: 'formData.entreprise requis' });
  }

  const t0 = Date.now();
  const slug = slugify(formData.entreprise);
  const stamp = todayStamp();

  try {
    // 1. Evidence
    console.log('[test-audit] Collecte preuves...');
    const evidence = await collectAllEvidence(formData);
    const evSummary = {
      site: evidence.site?.fetched ? '✓' : '✗',
      serp: evidence.serp?.results ? `✓ (${evidence.serp.results.length} resultats)` : '✗',
      linkedin: evidence.linkedin?.fetched ? '✓' : '✗',
      gbp: evidence.gbp?.found ? '✓' : '✗',
    };
    console.log('[test-audit] Evidence:', evSummary);

    // 2. Claude
    console.log('[test-audit] Génération Claude...');
    const auditJson = await generateAuditViaClaude(formData, evidence);
    console.log('[test-audit] Score global:', auditJson.score_global_client);

    // 3. HTML + MD
    const htmlContent = generateAuditHtml(formData, auditJson);
    const mdContent = generateFullAuditMarkdown(formData, auditJson);

    // 4. PDF via Puppeteer (best-effort)
    let pdfBuffer = null;
    try {
      pdfBuffer = await htmlToPdf(htmlContent);
      console.log('[test-audit] PDF:', pdfBuffer.length, 'bytes');
    } catch (e) {
      console.warn('[test-audit] PDF failed (non-fatal):', e.message);
    }

    // 5. Upload Blob
    const htmlKey = `audits/${slug}/AUDIT-${slug}-${stamp}-full.html`;
    const mdKey = `audits/${slug}/AUDIT-${slug}-${stamp}-full.md`;
    const pdfKey = `audits/${slug}/AUDIT-${slug}-${stamp}-full.pdf`;
    const uploads = [
      put(htmlKey, htmlContent, { access: 'public', contentType: 'text/html; charset=utf-8', addRandomSuffix: false, allowOverwrite: true }),
      put(mdKey, mdContent, { access: 'public', contentType: 'text/markdown; charset=utf-8', addRandomSuffix: false, allowOverwrite: true }),
    ];
    if (pdfBuffer) {
      uploads.push(put(pdfKey, pdfBuffer, { access: 'public', contentType: 'application/pdf', addRandomSuffix: false, allowOverwrite: true }));
    }
    const results = await Promise.all(uploads);
    const htmlUrl = results[0].url;
    const mdUrl = results[1].url;
    const pdfUrl = results[2] ? results[2].url : null;

    // 6. Email
    const emailResult = await sendEmail(formData, htmlUrl, pdfUrl, auditJson);

    // Cleanup Puppeteer
    await closeBrowser().catch(() => {});

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    return res.status(200).json({
      ok: true,
      elapsed: elapsed + 's',
      entreprise: formData.entreprise,
      score_global: auditJson.score_global_client,
      scores_par_canal: {
        site: auditJson.audit_client?.site_internet?.score,
        seo: auditJson.audit_client?.seo?.score,
        llm_geo: auditJson.audit_client?.llm_geo?.score,
        sea_ads: auditJson.audit_client?.sea_ads?.score,
        reseaux_sociaux: auditJson.audit_client?.reseaux_sociaux?.score,
        ereputation: auditJson.audit_client?.ereputation?.score,
        gbp_notoriete: auditJson.audit_client?.gbp_notoriete?.score,
      },
      evidence: evSummary,
      htmlUrl,
      pdfUrl,
      mdUrl,
      emailSent: emailResult.sent,
    });
  } catch (err) {
    console.error('[test-audit] Fatal:', err);
    await closeBrowser().catch(() => {});
    return res.status(500).json({ ok: false, error: err.message });
  }
};
