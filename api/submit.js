// Vercel Serverless Function : /api/submit
// Reçoit les soumissions des formulaires Digitallis et envoie l'email via Resend.
// Variables d'environnement requises (configurées dans Vercel):
//   - RESEND_API_KEY    : clé API Resend
//   - RECIPIENT_EMAIL   : info@digitallis.fr (destination des leads)
//   - FROM_EMAIL        : onboarding@resend.dev (defaut) ou noreply@digitallis.fr (si domaine vérifié)

const SOURCE_LABELS = {
  'audit-homepage': "Demande d'audit (Homepage)",
  'audit-page':     "Demande d'audit complète",
  'contact':        "Nouveau message contact",
  'newsletter':     "Nouvelle inscription newsletter",
};

const ALLOWED_ORIGINS = [
  'https://www.digitallis.fr',
  'https://digitallis.fr',
  'https://digitallissite.vercel.app',
];

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtml(source, data, pageUrl) {
  const label = SOURCE_LABELS[source] || 'Nouveau formulaire';
  const rows = Object.entries(data)
    .filter(([k]) => !['botcheck', '_source', '_page'].includes(k))
    .map(([k, v]) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;color:#555;text-align:left;vertical-align:top;width:30%">${escapeHtml(k)}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;color:#111;text-align:left;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`)
    .join('');

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#FAFAF7;margin:0;padding:32px">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05)">
    <div style="background:#1C1F26;color:#fff;padding:24px 32px">
      <div style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#FACC14;margin-bottom:8px">DIGITALLIS · Nouveau lead</div>
      <h1 style="margin:0;font-size:22px;font-weight:600">${escapeHtml(label)}</h1>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
    <div style="padding:16px 32px;background:#F4F2EA;color:#676F7E;font-size:12px;font-family:'JetBrains Mono',monospace">
      Source : ${escapeHtml(source || 'unknown')} · Page : ${escapeHtml(pageUrl || '')}
    </div>
  </div>
</body></html>`;
}

function buildText(source, data, pageUrl) {
  const label = SOURCE_LABELS[source] || 'Nouveau formulaire';
  const lines = [
    `=== DIGITALLIS — ${label} ===`,
    '',
    ...Object.entries(data)
      .filter(([k]) => !['botcheck', '_source', '_page'].includes(k))
      .map(([k, v]) => `${k} : ${v}`),
    '',
    `Source : ${source || 'unknown'}`,
    `Page : ${pageUrl || ''}`,
  ];
  return lines.join('\n');
}

function pickReplyTo(data) {
  return data.email
    || data['Email']
    || data['Email *']
    || data['Email professionnel']
    || data['f-email']
    || null;
}

function buildSubject(source, data) {
  const label = SOURCE_LABELS[source] || 'Nouveau formulaire';
  const who = data.entreprise || data['Entreprise'] || data.prenom || data['Nom complet'] || data['f-company'] || '';
  return `[Digitallis] ${label}${who ? ' — ' + who : ''}`;
}

module.exports = async function handler(req, res) {
  // CORS
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  // Parse body
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  // Honeypot
  if (body.botcheck) {
    // Silent success to avoid telling bots they were caught
    res.status(200).json({ success: true });
    return;
  }

  const source = body._source || 'unknown';
  const pageUrl = body._page || '';

  // Required env
  const apiKey = process.env.RESEND_API_KEY;
  const recipient = process.env.RECIPIENT_EMAIL || 'info@digitallis.fr';
  const from = process.env.FROM_EMAIL || 'Digitallis <onboarding@resend.dev>';

  if (!apiKey) {
    console.error('RESEND_API_KEY missing');
    res.status(500).json({ success: false, error: 'Server not configured' });
    return;
  }

  const subject = buildSubject(source, body);
  const html = buildHtml(source, body, pageUrl);
  const text = buildText(source, body, pageUrl);
  const replyTo = pickReplyTo(body);

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject,
        html,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error('Resend API error', resp.status, data);
      res.status(502).json({ success: false, error: 'Email provider error', details: data });
      return;
    }

    res.status(200).json({ success: true, id: data.id });
  } catch (err) {
    console.error('Submit handler error', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
};
