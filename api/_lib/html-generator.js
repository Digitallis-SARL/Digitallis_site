/**
 * Générateur HTML d'audit — Template "Gamma-style" Digitallis
 *
 * Reproduit fidèlement le design de la template assets/Audit-Digital-Premium-Complet.pdf
 * (10 pages A4 portrait, charte bleu marine + bleu vif, polices Inter / Plus Jakarta Sans).
 *
 * Pipeline :
 *   - Claude génère le JSON d'audit (claude.js)
 *   - generateAuditHtml(formData, auditJson) → string HTML auto-contenue
 *   - htmlToPdf(html) → PDF via Puppeteer + chromium-min (pdf-from-html.js)
 *
 * Règle zéro fiction respectée : score === null affiché "NON NOTÉ" en gris.
 * Toujours 4 concurrents (forcé côté prompt Claude).
 *
 * Structure JSON attendue (cf. claude.js) :
 *   - scope, concurrents[], audit_client.{site_internet,seo,llm_geo,sea_ads,reseaux_sociaux,ereputation,gbp_notoriete}
 *   - score_global_client, audit_concurrents[], ecarts_majeurs[]
 *   - business_gap.{sales,efficiency,customer_satisfaction}
 *   - opportunites[], offres_digitallis[], plan_actions
 *   - apprentissages_cles[], synthese_executive
 */

// ════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function isNull(v) { return v === null || v === undefined; }

function fmtScore(v, suffix = '/100') {
  return isNull(v) ? 'N/N' : `${v}${suffix}`;
}

function fmtScoreOrDash(v) {
  return isNull(v) ? '—' : String(v);
}

// Couleur de l'arc/barre selon le score
function scoreColor(score) {
  if (isNull(score)) return '#94A3B8';  // gris
  if (score >= 65) return '#10B981';    // vert (jaunes-verts dans la template Gamma)
  if (score >= 45) return '#1B2A4E';    // bleu marine (médian)
  return '#94A3B8';                     // gris (faible)
}

// Donut SVG pour les jauges circulaires (page 2)
// circumference = 2 * π * 50 = 314.159
function donutCircle(score, label, sublabel) {
  const s = isNull(score) ? 0 : Math.max(0, Math.min(100, score));
  const circ = 314.159;
  const dash = (s / 100) * circ;
  const color = scoreColor(score);
  const displayValue = isNull(score) ? 'N/N' : `${s}%`;
  return `
    <div class="donut">
      <svg viewBox="0 0 120 120" class="donut-svg">
        <circle cx="60" cy="60" r="50" fill="none" stroke="#E5E7EB" stroke-width="10"/>
        <circle cx="60" cy="60" r="50" fill="none" stroke="${color}" stroke-width="10"
          stroke-dasharray="${dash.toFixed(2)} ${circ.toFixed(2)}"
          stroke-linecap="round"
          transform="rotate(-90 60 60)"/>
        <text x="60" y="68" text-anchor="middle" font-size="22" font-weight="600" fill="#1B2A4E">${displayValue}</text>
      </svg>
      <div class="donut-label">${esc(label)}</div>
      <div class="donut-sublabel">${esc(sublabel)}</div>
    </div>`;
}

// Barre horizontale pour scores SEO concurrents (page 6)
function progressBar(score, label, comment) {
  const s = isNull(score) ? 0 : Math.max(0, Math.min(100, score));
  return `
    <div class="progress-item">
      <div class="progress-bar-line">
        <div class="progress-bar-wrap">
          <div class="progress-bar" style="width:${s}%"></div>
        </div>
        <span class="progress-value">${isNull(score) ? 'N/N' : s + '%'}</span>
      </div>
      <div class="progress-label">${esc(label)}</div>
      <div class="progress-comment">${esc(comment || '')}</div>
    </div>`;
}

// Card concurrent (pages 6, 8) : score numérique large + nom + commentaire
function scoreCard(score, name, comment) {
  return `
    <div class="score-card">
      <div class="score-card-value">${fmtScoreOrDash(score)}</div>
      <div class="score-card-name">${esc(name)}</div>
      <div class="score-card-comment">${esc(comment || '')}</div>
    </div>`;
}

// Card concurrent (page 8) : Nom + score + commentaire dans une card grise
function competitorBlock(name, score, comment) {
  return `
    <div class="competitor-block">
      <div class="competitor-name">${esc(name)}</div>
      <div class="competitor-score">${fmtScore(score)}</div>
      <div class="competitor-comment">${esc(comment || '')}</div>
    </div>`;
}

// Quadrant card (page 4) : barre verticale colorée à gauche + contenu
function axisCard(title, score, bullets) {
  return `
    <div class="axis-card">
      <div class="axis-card-title">${esc(title)}</div>
      <div class="axis-card-score">Score : ${fmtScore(score)}</div>
      <ul class="axis-card-list">
        ${(bullets || []).slice(0, 3).map(b => `<li>${esc(b)}</li>`).join('') || '<li><em>Données non observables publiquement.</em></li>'}
      </ul>
    </div>`;
}

// Card horizon (page 10) : titre coloré + liste actions
function horizonCard(title, color, bullets) {
  return `
    <div class="horizon-card">
      <div class="horizon-title" style="color:${color}">${esc(title)}</div>
      <ul class="horizon-list">
        ${(bullets || []).slice(0, 4).map(b => `<li>${esc(b.action || b)}</li>`).join('') || '<li><em>À définir avec le client.</em></li>'}
      </ul>
    </div>`;
}

// Comparatif inline avec barre latérale gauche (encarts pages 6, 7)
function comparatif(text) {
  return `<div class="comparatif"><strong>Comparatif :</strong> ${esc(text)}</div>`;
}

// Barre Business Gap (page 9) : current + target en barres horizontales
function gapBar(label, current, target, color = '#1B2A4E') {
  const c = Math.max(0, Math.min(100, current || 0));
  const t = Math.max(0, Math.min(100, target || 0));
  return `
    <div class="gap-row">
      <div class="gap-label">${esc(label)}</div>
      <div class="gap-bars">
        <div class="gap-bar gap-current" style="width:${c}%;background:${color}">
          <span class="gap-bar-text">Current</span>
        </div>
        <div class="gap-bar gap-target" style="width:${t - c}%;background:#93C5FD">
          <span class="gap-bar-text">Improvement</span>
        </div>
      </div>
    </div>`;
}

// ════════════════════════════════════════════════════════════
// CSS commun (inline pour Puppeteer)
// ════════════════════════════════════════════════════════════

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; color: #1B2A4E; background: #FFF; }

  .page {
    width: 210mm; height: 297mm;
    padding: 24mm 20mm;
    page-break-after: always;
    position: relative;
    background: #FFFFFF;
    color: #1B2A4E;
  }
  .page:last-child { page-break-after: auto; }

  h1, h2, h3, h4 { font-weight: 700; line-height: 1.15; letter-spacing: -0.01em; color: #1B2A4E; }
  h1 { font-size: 32pt; }
  h2 { font-size: 24pt; margin-bottom: 14pt; }
  h3 { font-size: 16pt; margin-bottom: 8pt; }
  h4 { font-size: 13pt; margin-bottom: 6pt; }
  p { font-size: 10pt; line-height: 1.6; color: #475569; }
  strong { color: #1B2A4E; font-weight: 600; }
  em { color: #1E5BFF; font-style: normal; font-weight: 600; }
  ul { padding-left: 0; list-style: none; }
  ul li { font-size: 10pt; line-height: 1.65; color: #475569; padding-left: 14pt; position: relative; margin-bottom: 4pt; }
  ul li::before { content: '•'; color: #1B2A4E; position: absolute; left: 0; top: 0; font-weight: 700; }

  .footer {
    position: absolute; bottom: 14mm; right: 20mm;
    background: #1B2A4E; color: #FFFFFF;
    padding: 5pt 14pt; border-radius: 100pt;
    font-size: 8.5pt; font-weight: 600; letter-spacing: 0.02em;
  }
  .footer-date { color: #93C5FD; margin-left: 6pt; font-weight: 400; }

  /* PAGE 1 — COVER */
  .cover-hero-img {
    width: 100%; height: 100mm; object-fit: cover;
    border-radius: 10pt; margin-bottom: 12pt;
    background: #F1F5F9;
  }
  .cover-meta { font-size: 11pt; color: #475569; line-height: 1.7; margin-top: 12pt; }
  .cover-meta strong { color: #1B2A4E; }
  .cover-tag {
    display: inline-block; background: #1B2A4E; color: #FFF;
    padding: 4pt 10pt; border-radius: 4pt; font-size: 9pt;
    font-weight: 500; margin-bottom: 4pt; margin-right: 3pt;
  }
  .cover-tag.alt { background: #FEF3C7; color: #B45309; }

  /* PAGE 2 — 7 axes / vue d'ensemble */
  .donut-grid-top { display: grid; grid-template-columns: 1fr 1fr; gap: 10pt; margin-top: 10pt; }
  .donut-grid-mid { display: grid; grid-template-columns: 1fr 1fr; gap: 10pt; margin-top: 14pt; }
  .donut-grid-bot { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8pt; margin-top: 14pt; }
  .donut { text-align: center; }
  .donut-svg { width: 75pt; height: 75pt; }
  .donut-label { font-size: 11pt; font-weight: 600; color: #1B2A4E; margin-top: 4pt; }
  .donut-sublabel { font-size: 8.5pt; color: #94A3B8; line-height: 1.4; margin-top: 2pt; }

  /* PAGE 3 — 2 colonnes Site + SEO */
  .two-cols-text { display: grid; grid-template-columns: 1fr 1fr; gap: 16pt; margin-top: 8pt; }
  .col-title { color: #1E5BFF; font-size: 14pt; font-weight: 700; margin-bottom: 4pt; }
  .col-score { font-size: 10pt; font-weight: 700; color: #1B2A4E; margin-bottom: 8pt; }
  .col-block-img { width: 100%; height: 60mm; object-fit: cover; border-radius: 8pt; margin-top: 10pt; background: #F1F5F9; }

  /* PAGE 4 — 3 cards verticales (LLM/SEA/Social) */
  .axis-cards-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8pt; margin-top: 8pt; }
  .axis-card {
    background: #FAFBFC; border-left: 3pt solid #1B2A4E;
    border-radius: 6pt; padding: 10pt 12pt; min-height: 90mm;
  }
  .axis-card-title { font-size: 13pt; font-weight: 700; color: #1B2A4E; line-height: 1.2; margin-bottom: 6pt; }
  .axis-card-score { font-size: 9.5pt; font-weight: 600; color: #1B2A4E; margin-bottom: 8pt; }
  .axis-card-list li { font-size: 9pt; margin-bottom: 5pt; }
  .axis-card-conclusion {
    font-size: 9.5pt; color: #475569; margin-top: 14pt;
    line-height: 1.6;
  }
  .axis-card-conclusion em { color: #1E5BFF; font-weight: 600; }

  /* PAGE 5 — 2 cols : image + text */
  .img-text-grid {
    display: grid; grid-template-columns: 1fr 1.2fr; gap: 18pt;
    margin-top: 10pt; align-items: center;
  }
  .img-text-grid img { width: 100%; border-radius: 8pt; background: #F1F5F9; }
  .img-text-grid .col-title { color: #1E5BFF; font-size: 15pt; margin-bottom: 4pt; }

  /* PAGE 6 — Analyse concurrentielle Site + SEO */
  .axis-label { font-size: 13pt; font-weight: 700; color: #1B2A4E; margin-top: 8pt; margin-bottom: 8pt; }
  .score-cards-row {
    display: grid; grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 8pt; margin-bottom: 10pt;
  }
  .score-card { text-align: center; padding: 4pt 6pt; }
  .score-card-value { font-size: 26pt; font-weight: 700; color: #1B2A4E; line-height: 1; }
  .score-card-name { font-size: 9.5pt; font-weight: 600; color: #1B2A4E; margin-top: 4pt; }
  .score-card-comment { font-size: 8.5pt; color: #94A3B8; margin-top: 3pt; line-height: 1.4; }
  .score-card.center-solo {
    grid-column: 2 / 4;
  }
  .progress-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12pt; margin-top: 4pt; }
  .progress-row.bottom { margin-top: 8pt; }
  .progress-item { }
  .progress-bar-line {
    display: flex; align-items: center; gap: 6pt;
  }
  .progress-bar-wrap {
    flex: 1; height: 8pt; background: #E5E7EB;
    border-radius: 4pt; overflow: hidden;
  }
  .progress-bar {
    height: 100%; background: #1B2A4E; border-radius: 4pt;
  }
  .progress-value {
    font-size: 9pt; font-weight: 600; color: #1B2A4E;
    min-width: 24pt; text-align: right;
  }
  .progress-label { font-size: 10pt; font-weight: 600; color: #1B2A4E; margin-top: 8pt; }
  .progress-comment { font-size: 8.5pt; color: #94A3B8; margin-top: 2pt; line-height: 1.4; }
  .comparatif {
    border-left: 2pt solid #1E5BFF; padding: 6pt 0 6pt 12pt;
    font-size: 9.5pt; color: #475569; margin-top: 10pt;
    line-height: 1.5;
  }
  .comparatif strong { color: #1B2A4E; }

  /* PAGE 7 — LLM/SEA/Social concurrents */
  .axis-detail { margin-top: 10pt; }
  .axis-detail p { font-size: 9.5pt; color: #475569; line-height: 1.7; }
  .axis-divider { border-top: 1pt solid #E5E7EB; margin: 14pt 0; }

  /* PAGE 8 — E-rép + GBP : 2 colonnes × 5 cards */
  .competitors-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 14pt; margin-top: 8pt; }
  .competitor-block {
    background: #F1F5F9; border-radius: 6pt; padding: 10pt 12pt;
    margin-bottom: 6pt;
  }
  .competitor-name { font-size: 10pt; font-weight: 700; color: #1B2A4E; }
  .competitor-score { font-size: 12pt; font-weight: 700; color: #1B2A4E; margin: 3pt 0; }
  .competitor-comment { font-size: 9pt; color: #475569; }

  /* PAGE 9 — Business Gap + 4 cards numérotées */
  .gap-chart {
    background: #FAFBFC; border-radius: 10pt; padding: 14pt;
    margin-top: 10pt; margin-bottom: 14pt;
  }
  .gap-chart-title { font-size: 14pt; font-weight: 700; color: #1B2A4E; }
  .gap-chart-sub { font-size: 10pt; color: #94A3B8; margin-bottom: 12pt; }
  .gap-row {
    display: grid; grid-template-columns: 40mm 1fr;
    align-items: center; gap: 10pt; margin-bottom: 10pt;
  }
  .gap-label { font-size: 10pt; font-weight: 600; color: #1B2A4E; }
  .gap-bars { display: flex; align-items: center; height: 14pt; gap: 1pt; }
  .gap-bar {
    height: 100%; border-radius: 7pt;
    display: flex; align-items: center; justify-content: center;
    color: #FFF; font-size: 8pt; font-weight: 600;
    overflow: hidden; white-space: nowrap;
  }
  .gap-bar-text { padding: 0 6pt; }
  .gap-target { color: #1B2A4E; }
  .axes-retrait-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 8pt;
    margin-top: 10pt;
  }
  .axe-retrait-card {
    background: #F1F5F9; border-radius: 6pt; padding: 10pt 12pt;
    display: grid; grid-template-columns: 24pt 1fr; gap: 10pt;
    align-items: start;
  }
  .axe-num {
    background: #1B2A4E; color: #FFF;
    border-radius: 50%; width: 22pt; height: 22pt;
    display: flex; align-items: center; justify-content: center;
    font-size: 11pt; font-weight: 700;
  }
  .axe-content { }
  .axe-title { font-size: 10.5pt; font-weight: 700; color: #1B2A4E; }
  .axe-sub { font-size: 9pt; color: #475569; margin-top: 2pt; }

  /* PAGE 10 — Plan d'actions 3 horizons */
  .horizons-grid {
    display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10pt;
    margin-top: 8pt;
  }
  .horizon-card { background: #FAFBFC; border-radius: 8pt; padding: 12pt 14pt; }
  .horizon-title { font-size: 12pt; font-weight: 700; margin-bottom: 8pt; }
  .horizon-list li { font-size: 9pt; margin-bottom: 5pt; line-height: 1.55; }
  .timeline-img {
    width: 100%; height: 55mm; object-fit: cover;
    border-radius: 8pt; margin-top: 12pt;
    background: #F1F5F9;
  }

  /* Status preuve badge */
  .status-badge {
    display: inline-block; font-size: 8pt; font-weight: 600;
    padding: 2pt 8pt; border-radius: 100pt; margin-left: 4pt;
  }
  .status-observe { background: #DCFCE7; color: #166534; }
  .status-partial { background: #FEF3C7; color: #92400E; }
  .status-non { background: #F1F5F9; color: #64748B; }
`;

// ════════════════════════════════════════════════════════════
// Pages individuelles
// ════════════════════════════════════════════════════════════

function todayStr() {
  const d = new Date();
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function footerEl() {
  return `<div class="footer">Digitallis<span class="footer-date">· Audit réalisé le ${todayStr()}</span></div>`;
}

function imgUrl(filename) {
  return `https://www.digitallis.fr/assets/audit-template/${filename}`;
}

// PAGE 1 — Cover
function page1(formData, audit) {
  const transparence = audit.audit_client && Object.values(audit.audit_client).filter(a => isNull(a.score)).length;
  return `
    <div class="page page-1">
      <h1>Audit Digital Premium Complet</h1>
      <img src="${imgUrl('01-hero-dashboard.jpg')}" alt="" class="cover-hero-img">
      <div class="cover-meta">
        <strong>Entreprise auditée :</strong> ${esc(formData.entreprise || '—')}${formData.secteur ? ` (${esc(formData.secteur)})` : ''}${formData.zone ? ` — ${esc(formData.zone)}` : ''}<br>
        <strong>Panel concurrentiel cadré :</strong> ${(audit.concurrents || []).slice(0, 4).map(c => esc(c.nom)).join(' · ') || '—'}
      </div>
      <div style="margin-top:16pt">
        <span class="cover-tag">Transparence</span>
        <p style="margin-top:6pt;font-size:10pt;line-height:1.6">L'analyse repose sur des données publiquement observables. Les canaux ${transparence > 0 ? `(${transparence} non noté${transparence > 1 ? 's' : ''})` : ''} non vérifiables publiquement sont signalés comme tels et non scorés à l'aveugle.</p>
      </div>
      ${footerEl()}
    </div>`;
}

// PAGE 2 — Vue d'ensemble : 7 jauges
function page2(formData, audit) {
  const a = audit.audit_client || {};
  return `
    <div class="page page-2">
      <h2>Audit Interne ${esc(formData.entreprise || 'Client')} : Vue d'Ensemble</h2>
      <p>L'audit interne couvre <em>7 axes stratégiques</em> essentiels pour évaluer la performance digitale globale de l'entreprise. Chaque axe a été analysé en profondeur pour identifier les forces et les opportunités d'amélioration.</p>

      <div class="donut-grid-top">
        ${donutCircle(a.site_internet?.score, 'Site Internet', 'UX, design, performance')}
        ${donutCircle(a.seo?.score, 'SEO', 'Sémantique, technique, backlinks')}
      </div>
      <div class="donut-grid-mid">
        ${donutCircle(a.llm_geo?.score, 'Référencement LLM', 'Présence IA, E-E-A-T')}
        ${donutCircle(a.sea_ads?.score, 'SEA', 'Google Ads')}
      </div>
      <div class="donut-grid-bot">
        ${donutCircle(a.reseaux_sociaux?.score, 'Réseaux Sociaux', 'Présence et engagement')}
        ${donutCircle(a.ereputation?.score, 'E-réputation', 'Avis et mentions')}
        ${donutCircle(a.gbp_notoriete?.score, 'Google Business', 'Notoriété locale')}
      </div>
      ${footerEl()}
    </div>`;
}

// PAGE 3 — Fondations solides : Site + SEO
function page3(audit) {
  const a = audit.audit_client || {};
  return `
    <div class="page page-3">
      <h2>Site Internet &amp; SEO : Fondations Solides</h2>
      <div class="two-cols-text">
        <div>
          <div class="col-title">Site Internet</div>
          <div class="col-score">Score : ${fmtScore(a.site_internet?.score)}</div>
          <ul>${(a.site_internet?.points_forts || []).slice(0, 4).map(p => `<li>${esc(p)}</li>`).join('') || '<li><em>Données non observables publiquement.</em></li>'}</ul>
        </div>
        <div>
          <div class="col-title">SEO</div>
          <div class="col-score">Score : ${fmtScore(a.seo?.score)}</div>
          <ul>${(a.seo?.points_forts || []).slice(0, 4).map(p => `<li>${esc(p)}</li>`).join('') || '<li><em>Données non observables publiquement.</em></li>'}</ul>
        </div>
      </div>
      <img src="${imgUrl('03-mockup-multidevice.jpg')}" alt="" class="col-block-img">
      ${footerEl()}
    </div>`;
}

// PAGE 4 — Présence Digitale : Axes à Renforcer (LLM/SEA/Social)
function page4(audit) {
  const a = audit.audit_client || {};
  return `
    <div class="page page-4">
      <h2>Présence Digitale : Axes à Renforcer</h2>
      <div class="axis-cards-grid">
        ${axisCard('Référencement LLM', a.llm_geo?.score, a.llm_geo?.axes_amelioration)}
        ${axisCard('SEA (Google Ads)', a.sea_ads?.score, a.sea_ads?.axes_amelioration)}
        ${axisCard('Réseaux Sociaux', a.reseaux_sociaux?.score, a.reseaux_sociaux?.axes_amelioration)}
      </div>
      <div class="axis-card-conclusion">
        Ces trois axes représentent les <em>opportunités majeures d'amélioration</em> pour ${esc(audit.formData?.entreprise || 'l\'entreprise')} dans sa stratégie digitale.
      </div>
      ${footerEl()}
    </div>`;
}

// PAGE 5 — E-réputation & GBP : Points Forts
function page5(audit) {
  const a = audit.audit_client || {};
  return `
    <div class="page page-5">
      <h2>E-réputation &amp; Google Business : Points Forts</h2>
      <div class="img-text-grid">
        <img src="${imgUrl('05-reviews-phone.jpg')}" alt="">
        <div>
          <div class="col-title">E-réputation</div>
          <div class="col-score">Score : ${fmtScore(a.ereputation?.score)}</div>
          <ul style="margin-bottom:14pt">${(a.ereputation?.points_forts || []).slice(0, 3).map(p => `<li>${esc(p)}</li>`).join('') || '<li><em>Données non observables publiquement.</em></li>'}</ul>

          <div class="col-title">Google Business</div>
          <div class="col-score">Score : ${fmtScore(a.gbp_notoriete?.score)}</div>
          <ul>${(a.gbp_notoriete?.points_forts || []).slice(0, 3).map(p => `<li>${esc(p)}</li>`).join('') || '<li><em>Données non observables publiquement.</em></li>'}</ul>
        </div>
      </div>
      ${footerEl()}
    </div>`;
}

// PAGE 6 — Analyse concurrentielle Site + SEO
function page6(formData, audit) {
  const concs = (audit.audit_concurrents || []).slice(0, 4);
  const client = audit.audit_client?.site_internet?.score;
  const ecartsLine = (audit.ecarts_majeurs || []).find(e => /site/i.test(e.canal));
  const comparatifSite = (ecartsLine && ecartsLine.commentaire) || `Les acteurs lead-gen dominent l'UX conversion. ${esc(formData.entreprise || 'L\'entreprise')} peut combler l'écart par contenus preuves & landing pages locales.`;
  const seoEcart = (audit.ecarts_majeurs || []).find(e => /seo/i.test(e.canal));
  const comparatifSeo = (seoEcart && seoEcart.commentaire) || `${esc(formData.entreprise || 'L\'entreprise')} perd des positions faute de pages locales & guides.`;

  // Pour la rangée du milieu : si > 3 concurrents on n'affiche que le 4e
  const clientCard = scoreCard(client, formData.entreprise || 'Client', 'Niveau actuel');

  return `
    <div class="page page-6">
      <h2>Analyse Concurrentielle : Site Internet &amp; SEO</h2>
      <div class="axis-label">Axe 1 — Site Internet</div>
      <div class="score-cards-row">
        ${clientCard}
        ${concs.slice(0, 3).map(c => scoreCard(c.scores?.site, c.nom, c.force_majeure ? c.force_majeure.slice(0, 60) : '')).join('')}
      </div>
      ${concs[3] ? `<div class="score-cards-row" style="grid-template-columns:1fr 1fr 1fr;margin-bottom:6pt">
        <div></div>
        ${scoreCard(concs[3].scores?.site, concs[3].nom, concs[3].force_majeure ? concs[3].force_majeure.slice(0, 60) : '')}
        <div></div>
      </div>` : ''}
      ${comparatif(comparatifSite)}

      <div class="axis-label" style="margin-top:14pt">Axe 2 — SEO</div>
      <div class="progress-row">
        ${progressBar(audit.audit_client?.seo?.score, formData.entreprise || 'Client', 'Niveau actuel')}
        ${concs.slice(0, 2).map(c => progressBar(c.scores?.seo, c.nom, c.force_majeure ? c.force_majeure.slice(0, 50) : '')).join('')}
      </div>
      ${concs.length >= 4 ? `<div class="progress-row bottom" style="grid-template-columns:1fr 1fr">
        ${progressBar(concs[2].scores?.seo, concs[2].nom, concs[2].force_majeure ? concs[2].force_majeure.slice(0, 50) : '')}
        ${progressBar(concs[3].scores?.seo, concs[3].nom, concs[3].force_majeure ? concs[3].force_majeure.slice(0, 50) : '')}
      </div>` : ''}
      ${comparatif(comparatifSeo)}
      ${footerEl()}
    </div>`;
}

// Helper : ligne texte "Concurrent : score/100 – commentaire."
function scoreLine(name, score, comment) {
  return `${esc(name)} : ${fmtScore(score)}${comment ? ' – ' + esc(comment.slice(0, 40)) : ''}`;
}

// PAGE 7 — Concurrentielle LLM/SEA/Social
function page7(formData, audit) {
  const concs = (audit.audit_concurrents || []).slice(0, 4);
  const client = audit.audit_client || {};
  const buildAxisLine = (clientScore, getScore, getComment) => {
    const all = [
      scoreLine(formData.entreprise || 'Client', clientScore, ''),
      ...concs.map(c => scoreLine(c.nom, getScore(c), getComment(c)))
    ];
    return all.join(' | ');
  };

  const llmComp = audit.ecarts_majeurs?.find(e => /llm|geo|ia/i.test(e.canal))?.commentaire || 'Avantage aux réseaux structurés.';
  const seaComp = audit.ecarts_majeurs?.find(e => /sea|ads/i.test(e.canal))?.commentaire || 'Forte pression payante sur requêtes chaudes.';
  const socialComp = audit.ecarts_majeurs?.find(e => /social|réseau|reseau/i.test(e.canal))?.commentaire || 'Peu différenciant localement, mais utile en rassurance.';

  return `
    <div class="page page-7">
      <h2>Analyse Concurrentielle : LLM, SEA &amp; Social</h2>

      <h3 style="margin-top:12pt">Axe 3 — Référencement LLM</h3>
      <p>${buildAxisLine(client.llm_geo?.score, c => c.scores?.llm_geo, c => '')}.</p>
      ${comparatif(llmComp)}

      <div class="axis-divider"></div>

      <h3>Axe 4 — SEA</h3>
      <p>${buildAxisLine(client.sea_ads?.score, c => c.scores?.sea_ads, c => '')}.</p>
      ${comparatif(seaComp)}

      <div class="axis-divider"></div>

      <h3>Axe 5 — Réseaux Sociaux</h3>
      <p>${buildAxisLine(client.reseaux_sociaux?.score, c => c.scores?.reseaux_sociaux, c => '')}.</p>
      ${comparatif(socialComp)}

      ${footerEl()}
    </div>`;
}

// PAGE 8 — Concurrentielle E-rép + GBP
function page8(formData, audit) {
  const concs = (audit.audit_concurrents || []).slice(0, 4);
  const client = audit.audit_client || {};
  const allEreput = [
    { nom: formData.entreprise || 'Client', score: client.ereputation?.score, comment: 'Niveau actuel' },
    ...concs.map(c => ({ nom: c.nom, score: c.scores?.ereputation, comment: c.force_majeure ? c.force_majeure.slice(0, 30) : '' }))
  ];
  const allGbp = [
    { nom: formData.entreprise || 'Client', score: client.gbp_notoriete?.score, comment: 'Niveau actuel' },
    ...concs.map(c => ({ nom: c.nom, score: c.scores?.gbp_notoriete, comment: c.force_majeure ? c.force_majeure.slice(0, 30) : '' }))
  ];
  const compEreput = audit.ecarts_majeurs?.find(e => /reput/i.test(e.canal))?.commentaire || 'Les avis font la différence en urgence.';
  const compGbp = audit.ecarts_majeurs?.find(e => /gbp|business|maps/i.test(e.canal))?.commentaire || 'Le levier n°1 local reste Maps + avis + posts.';

  return `
    <div class="page page-8">
      <h2>Analyse Concurrentielle : E-réputation &amp; Google Business</h2>
      <div class="competitors-cols">
        <div>
          <div class="axis-label" style="margin-top:0">Axe 6 — E-réputation</div>
          ${allEreput.map(x => competitorBlock(x.nom, x.score, x.comment)).join('')}
          ${comparatif(compEreput)}
        </div>
        <div>
          <div class="axis-label" style="margin-top:0">Axe 7 — Google Business</div>
          ${allGbp.map(x => competitorBlock(x.nom, x.score, x.comment)).join('')}
          ${comparatif(compGbp)}
        </div>
      </div>
      ${footerEl()}
    </div>`;
}

// PAGE 9 — Synthèse Gap + 4 axes en retrait
function page9(audit) {
  const gap = audit.business_gap || {};
  const sales = gap.sales || { current: 0, target: 50 };
  const efficiency = gap.efficiency || { current: 0, target: 50 };
  const satisfaction = gap.customer_satisfaction || { current: 0, target: 50 };

  // 4 cards numérotées : 4 ecarts les plus critiques
  const ecarts = (audit.ecarts_majeurs || []).slice(0, 4);
  while (ecarts.length < 4) {
    ecarts.push({ canal: '—', criticite: '—', ecart: 0 });
  }

  return `
    <div class="page page-9">
      <h2>Synthèse des Écarts &amp; Opportunités</h2>

      <div class="gap-chart">
        <div class="gap-chart-title">Business Gap Analysis</div>
        <div class="gap-chart-sub">Current vs Target Performance</div>
        ${gapBar('Sales', sales.current, sales.target, '#1B2A4E')}
        ${gapBar('Efficiency', efficiency.current, efficiency.target, '#1B2A4E')}
        ${gapBar('Customer Satisfaction', satisfaction.current, satisfaction.target, '#1B2A4E')}
      </div>

      <h3>Axes en Retrait Majeurs</h3>
      <div class="axes-retrait-grid">
        ${ecarts.map((e, i) => `
          <div class="axe-retrait-card">
            <div class="axe-num">${i + 1}</div>
            <div class="axe-content">
              <div class="axe-title">${esc(e.canal || '—')}</div>
              <div class="axe-sub">Client ${fmtScoreOrDash(e.client)} vs meilleur ${fmtScoreOrDash(e.meilleur)} · ${esc(e.criticite || '—')}</div>
            </div>
          </div>
        `).join('')}
      </div>

      <p style="margin-top:14pt">Ces écarts représentent les <em>opportunités stratégiques majeures</em> pour améliorer la position concurrentielle et le marché.</p>
      ${footerEl()}
    </div>`;
}

// PAGE 10 — Plans d'actions
function page10(audit) {
  const p = audit.plan_actions || {};
  return `
    <div class="page page-10">
      <h2>Plans d'Actions Stratégiques</h2>
      <div class="horizons-grid">
        ${horizonCard('Quick Wins (0-30j)', '#1E5BFF', p.quick_wins_0_30j)}
        ${horizonCard('Développement (1-3 mois)', '#1E5BFF', p.developpement_1_3m)}
        ${horizonCard('Croissance (3-6 mois)', '#1E5BFF', p.croissance_3_6m)}
      </div>
      <img src="${imgUrl('10-timeline-quarters.jpg')}" alt="" class="timeline-img">
      ${footerEl()}
    </div>`;
}

// ════════════════════════════════════════════════════════════
// Export principal
// ════════════════════════════════════════════════════════════

function generateAuditHtml(formData, auditJson) {
  const audit = auditJson || {};
  // On enrichit audit avec formData pour les pages qui en ont besoin (page 4)
  audit.formData = formData;

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Audit Digital Premium Complet — ${esc(formData.entreprise || 'Client')}</title>
  <style>${CSS}</style>
</head>
<body>
  ${page1(formData, audit)}
  ${page2(formData, audit)}
  ${page3(audit)}
  ${page4(audit)}
  ${page5(audit)}
  ${page6(formData, audit)}
  ${page7(formData, audit)}
  ${page8(formData, audit)}
  ${page9(audit)}
  ${page10(audit)}
</body>
</html>`;
}

module.exports = { generateAuditHtml };
