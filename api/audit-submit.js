/**
 * POST /api/audit-submit
 *
 * Endpoint public déclenché à la soumission du formulaire d'audit concurrentiel.
 * Aucune authentification — le formulaire est ouvert.
 *
 * Body JSON :
 *   entreprise, siteWeb, zone, secteur, effectif, typeClientele,
 *   frein, attente, experienceAgence, budget, decisionnaire,
 *   email, telephone
 *
 * Flux :
 *   1) Crée la ligne LEADS dans Airtable (status = Reçu)
 *   2) Génère MD + PDF préliminaires (synchrone, ~1-2 sec)
 *   3) Upload Vercel Blob → URLs publiques
 *   4) Update la ligne LEADS avec les URLs des fichiers
 *   5) Envoie un email récap au client + notif interne (Resend)
 *   6) (Optionnel) Webhook async pour l'orchestrateur IA
 *   7) Retourne pdfUrl, mdUrl, leadId au front
 *
 * Variables d'env :
 *   AIRTABLE_API_KEY, AIRTABLE_BASE_ID
 *   BLOB_READ_WRITE_TOKEN
 *   RESEND_API_KEY, RECIPIENT_EMAIL, FROM_EMAIL
 *   AUDIT_WEBHOOK_URL, AUDIT_WEBHOOK_SECRET   (optionnels)
 */

const { put } = require('@vercel/blob');
const { createLead, updateLeadFiles } = require('./_lib/airtable');
const { generateAuditPdf, generateAuditMarkdown } = require('./_lib/pdf-generator');

const ALLOWED_ORIGINS = [
  'https://www.digitallis.fr',
  'https://digitallis.fr',
  'https://digitallissite.vercel.app',
];

function setCors(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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

function buildEmailHtml(data, pdfUrl, mdUrl) {
  const name = data.entreprise || 'Bonjour';
  return `<!doctype html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#FAFAF7;margin:0;padding:32px;color:#1C1F26">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05)">
    <div style="background:#1C1F26;color:#fff;padding:32px">
      <div style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#FACC14;margin-bottom:12px">DIGITALLIS · Audit concurrentiel</div>
      <h1 style="margin:0;font-size:24px;font-weight:600;line-height:1.3">Votre demande est bien reçue, ${escapeHtml(name)}.</h1>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 16px;line-height:1.6">Nous avons généré un <strong>rapport préliminaire</strong> récapitulant les informations transmises et la méthodologie qui sera appliquée à votre audit.</p>
      <p style="margin:0 0 24px;line-height:1.6">L'<strong>audit complet</strong> — incluant l'analyse de vos concurrents directs, le diagnostic des 7 canaux digitaux, et le plan d'actions priorisé — vous parviendra sous <strong>24 à 72 heures</strong>.</p>

      <div style="background:#F4F2EA;border-left:4px solid #FACC14;padding:18px 22px;border-radius:8px;margin:24px 0">
        <div style="font-size:12px;color:#676F7E;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px">Vos livrables</div>
        <p style="margin:0 0 12px"><a href="${escapeHtml(pdfUrl)}" style="color:#1C1F26;font-weight:600;text-decoration:none">📄  Rapport préliminaire (PDF)</a></p>
        <p style="margin:0"><a href="${escapeHtml(mdUrl)}" style="color:#1C1F26;font-weight:600;text-decoration:none">📝  Version Markdown</a></p>
      </div>

      <p style="margin:24px 0 0;color:#676F7E;font-size:14px;line-height:1.6">Une question ou un complément ? Répondez directement à cet email ou contactez-nous au <a href="tel:+590602182020" style="color:#1C1F26">+590 602 18 20 20</a>.</p>
    </div>
    <div style="padding:18px 32px;background:#F4F2EA;color:#676F7E;font-size:12px;font-family:'JetBrains Mono',monospace">
      Digitallis · 195 rue François Fresneau · Baie-Mahault · Guadeloupe
    </div>
  </div>
</body></html>`;
}

// Defensive : certaines valeurs d'env Vercel sont sauvegardées avec des guillemets
// (selon comment elles ont été saisies). On nettoie systématiquement.
function cleanEnv(name) {
  const v = process.env[name];
  if (!v) return '';
  return v.trim().replace(/^["']|["']$/g, '');
}

async function sendEmails(data, pdfUrl, mdUrl) {
  const apiKey = cleanEnv('RESEND_API_KEY');
  if (!apiKey) {
    console.warn('RESEND_API_KEY missing, skipping emails');
    return { sent: false };
  }
  const from = cleanEnv('FROM_EMAIL') || 'Digitallis <onboarding@resend.dev>';
  const internal = cleanEnv('RECIPIENT_EMAIL') || 'info@digitallis.fr';
  const subject = `[Digitallis] Audit préliminaire — ${data.entreprise || 'nouveau lead'}`;
  const html = buildEmailHtml(data, pdfUrl, mdUrl);

  const recipients = [internal];
  if (data.email && /@/.test(data.email)) recipients.unshift(data.email);

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject,
        html,
        ...(data.email ? { reply_to: internal } : {}),
      }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      console.error('Resend error', resp.status, err);
      return { sent: false, error: err };
    }
    return { sent: true };
  } catch (err) {
    console.error('Email send failed', err);
    return { sent: false, error: String(err) };
  }
}

async function fireWebhook(payload) {
  const url = process.env.AUDIT_WEBHOOK_URL;
  if (!url) return { fired: false, reason: 'no webhook configured' };
  const secret = process.env.AUDIT_WEBHOOK_SECRET;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    return { fired: true };
  } catch (err) {
    console.warn('Webhook fire failed (non-fatal)', err && err.name);
    return { fired: false, error: String(err && err.message) };
  }
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  // ─── Parse body ───
  let data = req.body;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { data = {}; }
  }
  data = data || {};

  // Honeypot
  if (data.botcheck) {
    res.status(200).json({ success: true });
    return;
  }

  // Validation minimale
  if (!data.entreprise || !data.email) {
    res.status(400).json({ success: false, error: 'Entreprise et email obligatoires.' });
    return;
  }

  // ─── 1. Création de la ligne LEADS (avant génération pour avoir un ID) ───
  let leadRecord = null;
  try {
    leadRecord = await createLead(data);
  } catch (err) {
    console.error('Airtable createLead failed', err);
    res.status(502).json({
      success: false,
      error: "Notre système d'enregistrement est temporairement indisponible. Réessayez dans un instant.",
    });
    return;
  }

  // ─── 2. Génération MD + PDF ───
  let mdContent, pdfBuffer;
  try {
    mdContent = generateAuditMarkdown(data);
    pdfBuffer = await generateAuditPdf(data);
  } catch (err) {
    console.error('Generation failed', err);
    res.status(500).json({
      success: false,
      error: 'Erreur de génération du rapport. Notre équipe a été notifiée.',
      leadId: leadRecord.id,
    });
    return;
  }

  // ─── 3. Upload Vercel Blob ───
  const slug = slugify(data.entreprise);
  const stamp = todayStamp();
  const mdKey = `audits/${slug}/AUDIT-${slug}-${stamp}.md`;
  const pdfKey = `audits/${slug}/AUDIT-${slug}-${stamp}.pdf`;

  let mdUrl = null, pdfUrl = null;
  try {
    const [mdBlob, pdfBlob] = await Promise.all([
      put(mdKey, mdContent, {
        access: 'public',
        contentType: 'text/markdown; charset=utf-8',
        addRandomSuffix: false,
        allowOverwrite: true,
      }),
      put(pdfKey, pdfBuffer, {
        access: 'public',
        contentType: 'application/pdf',
        addRandomSuffix: false,
        allowOverwrite: true,
      }),
    ]);
    mdUrl = mdBlob.url;
    pdfUrl = pdfBlob.url;
  } catch (err) {
    console.error('Blob upload failed', err);
    res.status(502).json({
      success: false,
      error: 'Stockage indisponible. Notre équipe a été notifiée.',
      leadId: leadRecord.id,
    });
    return;
  }

  // ─── 4. Update Airtable avec les fichiers (Attachments) ───
  try {
    await updateLeadFiles(leadRecord.id, {
      mdUrl,
      pdfUrl,
      mdFilename: `AUDIT-${slug}-${stamp}.md`,
      pdfFilename: `AUDIT-${slug}-${stamp}.pdf`,
    });
  } catch (err) {
    console.error('Airtable updateLeadFiles failed (non-fatal)', err);
    // On ne bloque pas — le client a déjà ses fichiers
  }

  // ─── 5. Emails ───
  const emailResult = await sendEmails(data, pdfUrl, mdUrl);

  // ─── 6. Webhook async (IA externe) — fire-and-forget ───
  // On ne await PAS : le webhook tourne en background, le client n'a pas à attendre.
  fireWebhook({
    leadId: leadRecord.id,
    entreprise: data.entreprise,
    payload: data,
    pdfUrl,
    mdUrl,
    timestamp: new Date().toISOString(),
  }).catch(() => {});

  // ─── 7. Trigger immédiat du cron pour traitement IA complet — fire-and-forget ───
  // Au lieu d'attendre le cron quotidien (4h du matin), on déclenche le pipeline
  // d'audit complet (Claude + scraping + génération HTML/PDF) immédiatement après
  // la création du lead. Si ça échoue, le cron quotidien servira de filet.
  triggerProcessAudits(req).catch(() => {});

  res.status(200).json({
    success: true,
    leadId: leadRecord.id,
    pdfUrl,
    mdUrl,
    emailSent: emailResult.sent,
  });
};

/**
 * Déclenche le cron process-audits en background.
 * Utilisé après création d'un lead pour traiter immédiatement sans attendre 24h.
 * Fire-and-forget : on n'attend pas la réponse, on log juste les erreurs.
 *
 * Note : ce cron a maxDuration=300s (5 min) et tourne en parallèle de cette
 * fonction sans la bloquer (invocation Vercel séparée).
 */
async function triggerProcessAudits(originalReq) {
  const secret = cleanEnv('CRON_SECRET');
  if (!secret) {
    console.warn('[audit-submit] CRON_SECRET missing, skipping process-audits trigger');
    return;
  }
  // Reconstruit l'URL same-host depuis les headers Vercel
  const host = originalReq.headers['x-forwarded-host'] || originalReq.headers.host;
  const proto = originalReq.headers['x-forwarded-proto'] || 'https';
  const url = `${proto}://${host}/api/cron/process-audits`;
  try {
    // Timeout court : on veut juste lancer, pas attendre la fin (5 min de process)
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 2000);
    await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${secret}` },
      signal: ctrl.signal,
    });
  } catch (err) {
    // AbortError attendu : Vercel garde l'invocation en background même si on disconnect
    if (err.name !== 'AbortError') {
      console.warn('[audit-submit] process-audits trigger failed:', err.message);
    }
  }
}
