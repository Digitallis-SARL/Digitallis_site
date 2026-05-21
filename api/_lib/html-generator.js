/**
 * Générateur HTML d'audit — template officiel Digitallis
 *
 * Structure :
 *   PAGE 1 = Vue d'ensemble (grille 3x3 calquée sur le template Digitallis)
 *           Charte : beige #F5F1E8 + cards blanches + accents jaune #FFC700
 *   SLIDES 2-11 = Vue détaillée (paysage 16:9, conservation du look pro clair)
 *
 * Navigation : flèches + dots, swipe mobile.
 * Print : chaque slide devient une page A4 paysage.
 *
 * Règle zéro fiction : tout score null devient "NON NOTÉ" + couleur grise.
 */

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Score helpers
function isNull(v) { return v === null || v === undefined; }
function fmtScore(v) { return isNull(v) ? 'NON NOTÉ' : `${v}/100`; }
function fmtScoreOnly(v) { return isNull(v) ? '—' : String(v); }

// Couleurs sémantiques cohérentes avec le template
function scoreColor(score) {
  if (isNull(score)) return '#9CA3AF';  // gris
  if (score >= 70) return '#16A34A';    // vert
  if (score >= 50) return '#FFC700';    // jaune Digitallis
  return '#DC2626';                     // rouge
}

function scoreLabel(score) {
  if (isNull(score)) return 'non noté';
  if (score >= 70) return 'élevé';
  if (score >= 50) return 'moyen';
  if (score >= 30) return 'faible';
  return 'critique';
}

function scoreStatusText(axis) {
  if (!axis || isNull(axis.score)) return 'Non observable publiquement';
  const s = axis.score;
  if (s >= 70) return 'Vérifiable élevée';
  if (s >= 50) return 'Faible moyenne';
  return 'Partiellement observable';
}

// Pour le donut SVG : circumference 251.33 (r=40)
function donutDashArray(score) {
  const circumference = 251.33;
  if (isNull(score)) return `0 ${circumference}`;
  const filled = (score / 100) * circumference;
  return `${filled} ${circumference - filled}`;
}

// Logo Digitallis (texte stylisé, autonome — pas de dépendance externe)
const LOGO_DIGITALLIS = `<span style="font-family:'Inter',sans-serif;font-weight:800;font-size:13px;color:#1A1A1A;letter-spacing:-.02em"><span style="color:#1A1A1A">digit</span><span style="color:#FFC700">Allis</span></span>`;

/**
 * Card mini-score pour la grille "Vue d'ensemble"
 */
function renderMiniScoreCard(label, axis, sublabel = '') {
  const score = axis ? axis.score : null;
  const color = scoreColor(score);
  const labelStatus = scoreStatusText(axis);
  return `
    <div class="mini-score">
      <div class="mini-score-value" style="color:${color}">${isNull(score) ? '—' : score}</div>
      <div class="mini-score-label">${escapeHtml(label)}</div>
      <div class="mini-score-status">Statut : ${escapeHtml(labelStatus)}</div>
    </div>
  `;
}

/**
 * Bar chart simple pour les benchmarks (Axe 1, Axe 2)
 */
function renderBenchBar(label, score, isHighlighted = false) {
  const safeScore = isNull(score) ? 0 : score;
  const displayScore = isNull(score) ? 'NN' : score;
  const color = isHighlighted ? '#FFC700' : '#1F2937';
  return `
    <div class="bench-row">
      <div class="bench-label">${escapeHtml(label)}</div>
      <div class="bench-track">
        <div class="bench-fill" style="width:${safeScore}%;background:${color}"></div>
      </div>
      <div class="bench-value">${displayScore}</div>
    </div>
  `;
}

/**
 * Card recommandation colorée pour la matrice (bas du template)
 */
function renderRecoCard(title, items, color, priority = 'Élevée') {
  return `
    <div class="reco-card" style="background:${color}">
      <div class="reco-title">${escapeHtml(title)}</div>
      <ul class="reco-list">
        ${items.slice(0, 4).map(item => `<li>${escapeHtml(item)}</li>`).join('')}
      </ul>
      <div class="reco-priority">Priorité : <strong>${escapeHtml(priority)}</strong></div>
    </div>
  `;
}

/**
 * GÉNÉRATEUR PRINCIPAL
 */
function generateAuditHtml(formData, auditJson) {
  const entreprise = formData.entreprise || 'Client';
  const secteur = formData.secteur || '';
  const zone = formData.zone || '';
  const date = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const ac = auditJson.audit_client || {};
  const concs = (auditJson.audit_concurrents || []).slice(0, 3); // max 3 concurrents pour le bench
  const sg = auditJson.score_global_client;

  // Forces principales (extraites des points_forts de tous les canaux notés)
  const allPointsForts = [];
  Object.values(ac).forEach(axis => {
    if (axis && axis.points_forts && Array.isArray(axis.points_forts)) {
      allPointsForts.push(...axis.points_forts);
    }
  });
  const forces = allPointsForts.slice(0, 3);

  // Faiblesses
  const allAxes = [];
  Object.values(ac).forEach(axis => {
    if (axis && axis.axes_amelioration && Array.isArray(axis.axes_amelioration)) {
      allAxes.push(...axis.axes_amelioration);
    }
  });
  const faiblesses = allAxes.slice(0, 3);

  // Points clés observés (forces SEO si présentes, sinon premiers points forts)
  const pointsClesObserves = (ac.seo && ac.seo.points_forts && ac.seo.points_forts.length)
    ? ac.seo.points_forts.slice(0, 4)
    : allPointsForts.slice(0, 4);
  const limitesVigilance = allAxes.slice(0, 4);

  // Plan d'actions
  const quickWins = (auditJson.plan_actions?.quick_wins_0_30j || []).slice(0, 3);
  const developpement = (auditJson.plan_actions?.developpement_1_3m || []).slice(0, 3);
  const croissance = (auditJson.plan_actions?.croissance_3_6m || []).slice(0, 3);

  // Matrice recommandations clés (4 cards)
  const offres = auditJson.offres_digitallis || [];
  const recoColors = ['#FCE38A', '#A8E6CF', '#88D8C0', '#B19CD9']; // jaune, vert, vert-bleu, violet
  const recoCards = [
    { title: offres[0]?.opportunite?.slice(0, 25) || 'Optimisation Google Business',
      items: [offres[0]?.offre || 'À définir'].concat(offres[0]?.impact_attendu ? [offres[0].impact_attendu] : []),
      color: recoColors[0] },
    { title: offres[1]?.opportunite?.slice(0, 25) || 'Amélioration SEO Site',
      items: [offres[1]?.offre || 'À définir'].concat(offres[1]?.impact_attendu ? [offres[1].impact_attendu] : []),
      color: recoColors[1] },
    { title: offres[2]?.opportunite?.slice(0, 25) || 'Campagnes SEA Ciblées',
      items: [offres[2]?.offre || 'À définir'].concat(offres[2]?.impact_attendu ? [offres[2].impact_attendu] : []),
      color: recoColors[2] },
    { title: offres[3]?.opportunite?.slice(0, 25) || 'Stratégie de Contenu GEO',
      items: [offres[3]?.offre || 'À définir'].concat(offres[3]?.impact_attendu ? [offres[3].impact_attendu] : []),
      color: recoColors[3] },
  ];

  // Score global pour donut
  const donutScore = isNull(sg) ? 0 : sg;
  const donutLabel = isNull(sg) ? 'NON NOTÉ' : `${sg}/100`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Audit Digital de Référence — ${escapeHtml(entreprise)} — Digitallis</title>
<meta name="robots" content="noindex, nofollow">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">

<style>
  :root {
    --bg: #F5F1E8;
    --card-bg: #FFFFFF;
    --ink: #1A1A1A;
    --ink-soft: #4B5563;
    --muted: #9CA3AF;
    --accent: #FFC700;
    --accent-dk: #1A1A1A;
    --success: #16A34A;
    --success-soft: #DCFCE7;
    --danger: #DC2626;
    --danger-soft: #FEE2E2;
    --border: #E5E1D6;
  }
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    color: var(--ink);
    background: var(--bg);
    overflow: hidden;
    height: 100vh;
    width: 100vw;
  }

  .deck { position: relative; width: 100vw; height: 100vh; }
  .slide {
    position: absolute; inset: 0;
    opacity: 0; pointer-events: none;
    transition: opacity 0.5s ease;
    overflow: auto;
    display: flex; align-items: center; justify-content: center;
    padding: 24px;
  }
  .slide.active { opacity: 1; pointer-events: all; }

  /* ────────────────────────────────────── */
  /* SLIDE 1 : Grille template Digitallis   */
  /* ────────────────────────────────────── */
  .grid-template {
    width: 100%; max-width: 1280px;
    display: grid;
    grid-template-columns: 1fr 1.2fr 1fr;
    grid-template-rows: auto auto auto;
    gap: 14px;
  }
  .card {
    background: var(--card-bg);
    border-radius: 14px;
    padding: 16px 18px;
    box-shadow: 0 1px 3px rgba(0,0,0,.04), 0 1px 2px rgba(0,0,0,.06);
    position: relative;
    display: flex; flex-direction: column;
  }
  .card-logo {
    position: absolute; top: 12px; right: 14px;
  }
  .card-title {
    font-size: 14px; font-weight: 800; color: var(--ink);
    text-align: center; text-transform: uppercase;
    letter-spacing: .04em; margin: 0 0 12px;
    padding-bottom: 8px; border-bottom: 1px solid var(--border);
  }
  .card-footer {
    margin-top: auto; padding-top: 8px;
    font-size: 9px; color: var(--muted); text-align: center;
  }

  /* Card 1 : Hero */
  .hero-card {
    background: var(--ink);
    color: #FFF;
    display: flex; flex-direction: column;
    justify-content: space-between;
    min-height: 200px;
    background-image: linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 100%);
    overflow: hidden; position: relative;
  }
  .hero-card::after {
    content: ''; position: absolute; right: -20px; top: 30px;
    width: 90px; height: 90px;
    background: linear-gradient(45deg, transparent 48%, rgba(255,199,0,.3) 48%, rgba(255,199,0,.3) 52%, transparent 52%);
    background-size: 12px 12px;
    transform: rotate(15deg); opacity: .4;
  }
  .hero-title {
    font-weight: 900; font-size: 28px;
    line-height: 1; letter-spacing: -.02em;
    margin: 0 0 6px;
  }
  .hero-sub {
    font-size: 13px; color: rgba(255,255,255,.85);
    margin: 6px 0;
  }
  .hero-meta {
    font-size: 11px; color: rgba(255,255,255,.6);
    font-weight: 400; margin-top: 4px;
  }
  .hero-powered {
    font-size: 9px; color: rgba(255,255,255,.5);
    text-align: center; margin-top: auto; padding-top: 12px;
  }
  .hero-logo-mark {
    color: var(--accent);
  }

  /* Card 2 : Executive Summary */
  .summary-content {
    display: grid; grid-template-columns: 130px 1fr; gap: 14px;
    align-items: center;
  }
  .donut-wrap {
    width: 110px; height: 110px; margin: 0 auto;
    position: relative;
  }
  .donut-svg { transform: rotate(-90deg); }
  .donut-center {
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
  }
  .donut-score {
    font-size: ${isNull(sg) ? '13' : '24'}px;
    font-weight: 800; color: var(--ink); line-height: 1;
  }
  .donut-sublabel {
    font-size: 8px; color: var(--muted);
    text-align: center; margin-top: 4px;
    text-transform: uppercase; letter-spacing: .05em;
  }
  .summary-side h4 {
    margin: 0 0 4px;
    font-size: 10px; text-transform: uppercase; letter-spacing: .05em;
    font-weight: 700;
  }
  .summary-forces h4 { color: var(--success); }
  .summary-faiblesses h4 { color: var(--danger); }
  .summary-side ul {
    margin: 0 0 10px; padding-left: 14px;
    font-size: 10px; color: var(--ink-soft); line-height: 1.4;
  }
  .summary-side li { margin-bottom: 2px; }
  .summary-side .empty { color: var(--muted); font-style: italic; font-size: 9px; }
  .forces-box {
    background: var(--success-soft); border-radius: 6px;
    padding: 6px 8px; margin-bottom: 6px;
  }
  .faiblesses-box {
    background: var(--danger-soft); border-radius: 6px;
    padding: 6px 8px;
  }

  /* Card 3 : Scores internes */
  .mini-grid {
    display: grid; grid-template-columns: 1fr 1fr 1fr;
    gap: 10px;
  }
  .mini-score {
    text-align: center;
    padding: 8px 4px;
    background: #FAF9F4;
    border-radius: 8px;
  }
  .mini-score-value {
    font-size: 26px; font-weight: 800; line-height: 1;
  }
  .mini-score-label {
    font-size: 9px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .04em; color: var(--ink); margin-top: 4px;
  }
  .mini-score-status {
    font-size: 7.5px; color: var(--muted);
    margin-top: 2px; line-height: 1.2;
  }

  /* Card 4-5 : Bench Axe 1 / Axe 2 */
  .bench-axes {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 18px;
  }
  .bench-axis h4 {
    font-size: 11px; font-weight: 700; margin: 0 0 8px;
    color: var(--ink); text-transform: uppercase; letter-spacing: .03em;
    display: flex; justify-content: space-between;
  }
  .bench-axis h4 span { color: var(--muted); font-weight: 400; font-size: 9px; }
  .bench-row {
    display: grid; grid-template-columns: 80px 1fr 28px;
    gap: 8px; align-items: center; margin-bottom: 5px;
  }
  .bench-label { font-size: 10px; color: var(--ink-soft); font-weight: 500; }
  .bench-track {
    height: 14px; background: #EFEAD9; border-radius: 4px; overflow: hidden;
  }
  .bench-fill {
    height: 100%; border-radius: 4px;
    transition: width .8s ease;
  }
  .bench-value {
    font-size: 10px; font-weight: 700; color: var(--ink);
    text-align: right;
  }
  .bench-comment {
    font-size: 9px; color: var(--muted);
    margin-top: 10px; line-height: 1.4;
  }

  /* Card 6 : Points clés + Limites */
  .observations {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 14px; height: 100%;
  }
  .obs-block {
    border-radius: 8px; padding: 8px 10px;
    display: flex; flex-direction: column;
  }
  .obs-positive { background: var(--success-soft); }
  .obs-negative { background: var(--danger-soft); }
  .obs-title {
    font-size: 9px; font-weight: 800; text-transform: uppercase;
    letter-spacing: .05em; margin-bottom: 6px;
  }
  .obs-positive .obs-title { color: var(--success); }
  .obs-negative .obs-title { color: var(--danger); }
  .obs-list {
    margin: 0; padding-left: 14px;
    font-size: 9.5px; color: var(--ink-soft); line-height: 1.45;
  }
  .obs-list li { margin-bottom: 3px; }

  /* Card 7 : Plan d'action */
  .plan-flow {
    display: flex; align-items: stretch; gap: 4px;
  }
  .plan-step {
    flex: 1; background: var(--ink); color: #FFF;
    border-radius: 6px; padding: 8px 10px;
    position: relative;
  }
  .plan-step::after {
    content: ''; position: absolute;
    right: -6px; top: 50%; transform: translateY(-50%);
    border-style: solid; border-width: 12px 0 12px 8px;
    border-color: transparent transparent transparent var(--ink);
    z-index: 1;
  }
  .plan-step:last-child::after { display: none; }
  .plan-step-title {
    background: var(--accent); color: var(--ink);
    padding: 3px 8px; border-radius: 4px;
    font-size: 9px; font-weight: 800; text-transform: uppercase;
    letter-spacing: .03em; margin-bottom: 6px;
    display: inline-block;
  }
  .plan-step-time {
    font-size: 8px; color: rgba(255,255,255,.7);
    margin-bottom: 6px;
  }
  .plan-step ul {
    margin: 0; padding-left: 14px;
    font-size: 8.5px; color: rgba(255,255,255,.9); line-height: 1.35;
  }
  .plan-step li { margin-bottom: 2px; }

  /* Card 8 : Matrice recommandations */
  .reco-grid {
    display: grid; grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 6px; height: 100%;
  }
  .reco-card {
    border-radius: 8px;
    padding: 10px 8px;
    display: flex; flex-direction: column;
  }
  .reco-title {
    font-size: 10px; font-weight: 800;
    color: var(--ink); margin-bottom: 6px;
    line-height: 1.15;
  }
  .reco-list {
    margin: 0 0 8px; padding-left: 12px;
    font-size: 8.5px; color: var(--ink); line-height: 1.4;
    flex: 1;
  }
  .reco-list li { margin-bottom: 2px; }
  .reco-priority {
    font-size: 8px; color: var(--ink); margin-top: auto;
    padding-top: 4px; border-top: 1px solid rgba(0,0,0,.1);
  }
  .reco-priority strong { font-weight: 800; }

  /* Card 9 : Merci */
  .thanks-card {
    background: var(--ink);
    color: #FFF;
    display: flex; flex-direction: column;
    justify-content: center; align-items: center;
    text-align: center;
    padding: 20px 16px;
  }
  .thanks-title {
    font-size: 18px; font-weight: 800;
    margin: 0 0 14px; letter-spacing: -.01em;
    line-height: 1.1;
  }
  .thanks-text {
    font-size: 10px; color: rgba(255,255,255,.7);
    line-height: 1.5; margin-bottom: 14px;
  }
  .thanks-contact {
    font-size: 10px; color: rgba(255,255,255,.9);
    line-height: 1.5;
  }
  .thanks-contact strong { color: var(--accent); }
  .thanks-contact a { color: rgba(255,255,255,.9); text-decoration: none; }
  .thanks-disclaimer {
    font-size: 7.5px; color: rgba(255,255,255,.5);
    margin-top: 14px; line-height: 1.4;
    border-top: 1px solid rgba(255,255,255,.1);
    padding-top: 8px;
  }

  /* ────────────────────────────────────── */
  /* SLIDES 2-11 : Vue détaillée            */
  /* ────────────────────────────────────── */
  .detail-slide {
    width: 100%; max-width: 1180px;
    background: var(--card-bg);
    border-radius: 18px;
    padding: 32px 44px;
    box-shadow: 0 2px 8px rgba(0,0,0,.05);
    max-height: 90vh;
    overflow-y: auto;
  }
  .detail-slide h1 {
    font-size: 28px; font-weight: 800; color: var(--ink);
    margin: 0 0 8px; letter-spacing: -.02em;
  }
  .detail-slide .subtitle {
    font-size: 12px; text-transform: uppercase; letter-spacing: .15em;
    color: var(--muted); margin-bottom: 24px;
    border-bottom: 2px solid var(--accent); padding-bottom: 12px;
    display: inline-block;
  }
  .detail-slide h2 {
    font-size: 18px; color: var(--ink); margin: 24px 0 12px;
    font-weight: 700;
  }
  .detail-slide p { color: var(--ink-soft); line-height: 1.6; font-size: 13px; }
  .detail-slide ul { color: var(--ink-soft); line-height: 1.7; font-size: 13px; }

  .kv-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .kv-table tr { border-bottom: 1px solid var(--border); }
  .kv-table td { padding: 8px 12px; }
  .kv-table td:first-child { font-weight: 600; color: var(--ink); width: 220px; }
  .kv-table td:last-child { color: var(--ink-soft); }

  .channel-detail {
    background: #FAF9F4; border-radius: 12px;
    padding: 16px 20px; margin-bottom: 14px;
    border-left: 4px solid var(--accent);
  }
  .channel-detail.null { border-left-color: var(--muted); opacity: .85; }
  .channel-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 10px;
  }
  .channel-name { font-size: 15px; font-weight: 700; color: var(--ink); }
  .channel-score { font-size: 18px; font-weight: 800; }
  .badge {
    display: inline-block; padding: 2px 10px;
    border-radius: 999px; font-size: 10px; font-weight: 600;
    text-transform: uppercase; letter-spacing: .04em;
    margin-right: 6px;
  }
  .badge-obs { background: var(--success-soft); color: var(--success); }
  .badge-partial { background: #FEF3C7; color: #92400E; }
  .badge-non { background: #F3F4F6; color: var(--muted); }

  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .col-block { font-size: 12px; }
  .col-block h4 {
    font-size: 10px; text-transform: uppercase; letter-spacing: .05em;
    margin: 0 0 8px; font-weight: 700;
  }
  .col-positive h4 { color: var(--success); }
  .col-negative h4 { color: var(--danger); }
  .col-block ul { margin: 0; padding-left: 16px; line-height: 1.55; }

  /* Comparatif détaillé */
  .compare-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 12px; }
  .compare-table th { background: var(--ink); color: #FFF; padding: 8px; font-weight: 700; text-align: left; }
  .compare-table td { padding: 8px; border-bottom: 1px solid var(--border); color: var(--ink-soft); }
  .compare-table tr.client-row { background: #FEF3C7; font-weight: 600; }
  .compare-table tr.client-row td { color: var(--ink); }

  /* ────────────────────────────────────── */
  /* Navigation                              */
  /* ────────────────────────────────────── */
  .nav-controls {
    position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%);
    display: flex; align-items: center; gap: 14px;
    background: rgba(26,26,26,.92); padding: 8px 18px;
    border-radius: 999px; z-index: 100;
    box-shadow: 0 4px 16px rgba(0,0,0,.15);
  }
  .nav-btn {
    width: 32px; height: 32px; border: none;
    background: rgba(255,255,255,.1); color: var(--accent);
    border-radius: 50%; cursor: pointer; font-size: 1rem;
  }
  .nav-btn:hover { background: rgba(255,199,0,.2); }
  .slide-dots { display: flex; gap: 6px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,.25); cursor: pointer; }
  .dot.active { background: var(--accent); transform: scale(1.3); }
  .slide-counter {
    font-size: 11px; color: rgba(255,255,255,.7);
    font-family: 'Inter', monospace; min-width: 40px; text-align: center;
  }

  /* ────────────────────────────────────── */
  /* Print A4 paysage : 1 slide = 1 page    */
  /* ────────────────────────────────────── */
  @media print {
    @page { size: A4 landscape; margin: 0; }
    body { overflow: visible; height: auto; background: var(--bg); }
    .deck { height: auto; }
    .slide {
      position: relative !important; opacity: 1 !important;
      pointer-events: auto !important;
      page-break-after: always;
      min-height: 210mm; height: 210mm; width: 297mm;
      padding: 12mm;
    }
    .slide:last-of-type { page-break-after: auto; }
    .nav-controls { display: none !important; }
  }
</style>
</head>
<body>

<div class="deck">

<!-- ════════════════════════════════════════════ -->
<!-- SLIDE 1 : Grille template Digitallis        -->
<!-- ════════════════════════════════════════════ -->
<section class="slide active" data-slide="1">
  <div class="grid-template">

    <!-- 1. Hero -->
    <div class="card hero-card">
      ${LOGO_DIGITALLIS.replace('color:#1A1A1A', 'color:#FFF')}
      <div style="margin-top: 18px;">
        <div class="hero-title">AUDIT DIGITAL<br>DE RÉFÉRENCE</div>
        <div class="hero-sub" style="background:rgba(255,199,0,.15);display:inline-block;padding:4px 10px;border-radius:6px;font-size:11px;margin-top:8px">${escapeHtml(entreprise)} | ${date}</div>
        <div class="hero-meta">Analyses & Recommandations Stratégiques</div>
      </div>
      <div class="hero-powered">Powered by <span class="hero-logo-mark">Digitallis</span></div>
    </div>

    <!-- 2. Executive Summary -->
    <div class="card">
      <div class="card-logo">${LOGO_DIGITALLIS}</div>
      <h3 class="card-title">AUDIT EXECUTIVE SUMMARY</h3>
      <div class="summary-content">
        <div>
          <div class="donut-wrap">
            <svg class="donut-svg" width="110" height="110" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#EFEAD9" stroke-width="10"/>
              <circle cx="50" cy="50" r="40" fill="none" stroke="${scoreColor(sg)}" stroke-width="10"
                stroke-dasharray="${donutDashArray(sg)}"
                stroke-linecap="round"/>
            </svg>
            <div class="donut-center">
              <div class="donut-score">${donutLabel}</div>
              <div class="donut-sublabel">Score Global</div>
            </div>
          </div>
        </div>
        <div>
          <div class="summary-side summary-forces">
            <div class="forces-box">
              <h4>Forces Principales</h4>
              ${forces.length ? `<ul>${forces.map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul>` : '<div class="empty">Aucune force majeure observable publiquement.</div>'}
            </div>
          </div>
          <div class="summary-side summary-faiblesses">
            <div class="faiblesses-box">
              <h4>Zones de Faiblesse & Risques</h4>
              ${faiblesses.length ? `<ul>${faiblesses.map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul>` : '<div class="empty">Aucune faiblesse majeure observée.</div>'}
            </div>
          </div>
        </div>
      </div>
      <div class="card-footer">Powered by Digitallis</div>
    </div>

    <!-- 3. Vue d'ensemble des scores internes -->
    <div class="card">
      <div class="card-logo">${LOGO_DIGITALLIS}</div>
      <h3 class="card-title">VUE D'ENSEMBLE DES SCORES INTERNES</h3>
      <div class="mini-grid">
        ${renderMiniScoreCard('Site Internet', ac.site_internet)}
        ${renderMiniScoreCard('SEO', ac.seo)}
        ${renderMiniScoreCard('E-Réputation', ac.ereputation)}
        ${renderMiniScoreCard('Google Business', ac.gbp_notoriete)}
        ${renderMiniScoreCard('Réseaux Sociaux', ac.reseaux_sociaux)}
        ${renderMiniScoreCard('GEO / LLM', ac.llm_geo)}
      </div>
      <div class="card-footer">Powered by Digitallis</div>
    </div>

    <!-- 4. Bench Axe 1 + Axe 2 -->
    <div class="card" style="grid-column: 1 / 3;">
      <div class="card-logo">${LOGO_DIGITALLIS}</div>
      <h3 class="card-title">POSITIONNEMENT CONCURRENTIEL</h3>
      <div class="bench-axes">
        <div class="bench-axis">
          <h4>Axe 1 — Site Internet <span>Score /100</span></h4>
          ${renderBenchBar(escapeHtml(entreprise), ac.site_internet?.score, true)}
          ${concs.slice(0, 3).map((c, i) => renderBenchBar(`Compétiteur ${String.fromCharCode(65 + i)}`, c.scores?.site)).join('')}
          <div class="bench-comment">Comparaison strictement basée sur les éléments observables publiquement (HTML du site, indices SERP).</div>
        </div>
        <div class="bench-axis">
          <h4>Axe 2 — SEO <span>Score /100</span></h4>
          ${renderBenchBar(escapeHtml(entreprise), ac.seo?.score, true)}
          ${concs.slice(0, 3).map((c, i) => renderBenchBar(`Compétiteur ${String.fromCharCode(65 + i)}`, c.scores?.seo)).join('')}
          <div class="bench-comment">Aucun acteur ne semble dominer fortement le SEO local. Citations non vérifiables faute de données observables.</div>
        </div>
      </div>
      <div class="card-footer">Powered by Digitallis</div>
    </div>

    <!-- 5. Points clés observés + Limites -->
    <div class="card">
      <div class="card-logo">${LOGO_DIGITALLIS}</div>
      <h3 class="card-title">OBSERVATIONS FACTUELLES</h3>
      <div class="observations">
        <div class="obs-block obs-positive">
          <div class="obs-title">Points Clés Observés</div>
          <ul class="obs-list">
            ${pointsClesObserves.length ? pointsClesObserves.map(p => `<li>${escapeHtml(p)}</li>`).join('') : '<li><em>Aucun point fort observable publiquement.</em></li>'}
          </ul>
        </div>
        <div class="obs-block obs-negative">
          <div class="obs-title">Limites & Points de Vigilance</div>
          <ul class="obs-list">
            ${limitesVigilance.length ? limitesVigilance.map(l => `<li>${escapeHtml(l)}</li>`).join('') : '<li><em>Diagnostic à approfondir avec accès aux comptes du client.</em></li>'}
          </ul>
        </div>
      </div>
      <div class="card-footer">Vous avez constaté plusieurs limites et points de vigilance lors de notre analyse.</div>
    </div>

    <!-- 6. Plan d'action -->
    <div class="card">
      <div class="card-logo">${LOGO_DIGITALLIS}</div>
      <h3 class="card-title">PLAN D'ACTION — FEUILLE DE ROUTE DIGITALE</h3>
      <div class="plan-flow">
        <div class="plan-step">
          <div class="plan-step-title">QUICK WINS</div>
          <div class="plan-step-time">(0-30 jours)</div>
          <ul>
            ${quickWins.length ? quickWins.map(q => `<li>${escapeHtml((q.action || q).slice(0, 60))}</li>`).join('') : '<li>À cadrer en RDV</li>'}
          </ul>
        </div>
        <div class="plan-step">
          <div class="plan-step-title">DÉVELOPPEMENT</div>
          <div class="plan-step-time">(1-3 mois)</div>
          <ul>
            ${developpement.length ? developpement.map(d => `<li>${escapeHtml((d.action || d).slice(0, 60))}</li>`).join('') : '<li>À cadrer</li>'}
          </ul>
        </div>
        <div class="plan-step" style="border-right:none">
          <div class="plan-step-title" style="background:#FCE38A">CROISSANCE</div>
          <div class="plan-step-time">(3-6 mois)</div>
          <ul>
            ${croissance.length ? croissance.map(c => `<li>${escapeHtml((c.action || c).slice(0, 60))}</li>`).join('') : '<li>À cadrer</li>'}
          </ul>
        </div>
      </div>
      <div class="card-footer">Powered by Digitallis</div>
    </div>

    <!-- 7. Matrice recommandations -->
    <div class="card" style="grid-column: 2 / 3;">
      <div class="card-logo">${LOGO_DIGITALLIS}</div>
      <h3 class="card-title">MATRIX DES RECOMMANDATIONS CLÉS</h3>
      <div class="reco-grid">
        ${recoCards.map(r => renderRecoCard(r.title, r.items.filter(Boolean), r.color, 'Élevée')).join('')}
      </div>
      <div class="card-footer">Powered by Digitallis</div>
    </div>

    <!-- 8. Merci -->
    <div class="card thanks-card">
      ${LOGO_DIGITALLIS.replace('color:#1A1A1A', 'color:#FFF')}
      <div class="thanks-title">MERCI POUR<br>VOTRE CONFIANCE</div>
      <div class="thanks-text">L'équipe Digitallis reste à votre disposition pour échanger sur ces recommandations.</div>
      <div class="thanks-contact">
        <strong>Email :</strong> <a href="mailto:info@digitallis.fr">info@digitallis.fr</a><br>
        <strong>Tél :</strong> +590 602 18 20 20<br>
        <strong>Web :</strong> www.digitallis.fr
      </div>
      <div class="thanks-disclaimer">Ce document est un rapport d'audit préliminaire basé sur les données observables. Une analyse plus approfondie pourra être réalisée.</div>
    </div>

  </div>
</section>

<!-- ════════════════════════════════════════════ -->
<!-- SLIDE 2 : Synthèse exécutive complète       -->
<!-- ════════════════════════════════════════════ -->
<section class="slide" data-slide="2">
  <div class="detail-slide">
    <div class="subtitle">Section 1</div>
    <h1>Synthèse exécutive</h1>
    <p>${escapeHtml(auditJson.synthese_executive || '(non disponible)')}</p>

    <h2>Méthodologie zéro fiction</h2>
    <p style="background:#FEF3C7;padding:14px 18px;border-radius:8px;border-left:4px solid var(--accent);font-size:12px">
      <strong>Cet audit ne note que les données strictement observables publiquement</strong> (HTML du site, SERP Google, profils sociaux publics). Les canaux marqués <strong>NON NOTÉ</strong> correspondent à des éléments non vérifiables sans accès aux comptes du client ou outils premium. Aucune extrapolation, aucune supposition.
    </p>
  </div>
</section>

<!-- ════════════════════════════════════════════ -->
<!-- SLIDE 3 : Profil de référence & scope       -->
<!-- ════════════════════════════════════════════ -->
<section class="slide" data-slide="3">
  <div class="detail-slide">
    <div class="subtitle">Section 2</div>
    <h1>Profil de référence & scope</h1>
    <table class="kv-table">
      <tr><td>Entreprise</td><td>${escapeHtml(entreprise)}</td></tr>
      <tr><td>Secteur</td><td>${escapeHtml(secteur)}</td></tr>
      <tr><td>Zone</td><td>${escapeHtml(zone)}</td></tr>
      <tr><td>Site web</td><td>${escapeHtml(formData.siteWeb || '—')}</td></tr>
      <tr><td>Effectif</td><td>${escapeHtml(formData.effectif || '—')}</td></tr>
      <tr><td>Type de clientèle</td><td>${escapeHtml(formData.typeClientele || '—')}</td></tr>
      <tr><td>Frein principal déclaré</td><td>${escapeHtml(formData.frein || '—')}</td></tr>
      <tr><td>Attente déclarée</td><td>${escapeHtml(formData.attente || '—')}</td></tr>
      <tr><td>SCOPE retenu</td><td><strong>${escapeHtml(auditJson.scope?.retenu || '—')}</strong></td></tr>
    </table>
    <h2>Justification du scope</h2>
    <p>${escapeHtml(auditJson.scope?.justification || '—')}</p>
  </div>
</section>

<!-- ════════════════════════════════════════════ -->
<!-- SLIDE 4 : Panel concurrentiel               -->
<!-- ════════════════════════════════════════════ -->
<section class="slide" data-slide="4">
  <div class="detail-slide">
    <div class="subtitle">Section 3</div>
    <h1>Panel concurrentiel</h1>
    <p>${auditJson.concurrents?.length || 0} concurrent(s) direct(s) identifié(s).</p>
    ${(auditJson.concurrents || []).map((c, i) => `
      <div class="channel-detail">
        <div class="channel-header">
          <div class="channel-name">${i + 1}. ${escapeHtml(c.nom || '—')}</div>
          <div class="channel-score" style="color:var(--accent-dk)">${fmtScoreOnly(c.score_similarite)}/100</div>
        </div>
        <p style="margin:0;font-size:12px">${escapeHtml(c.justification || '—')}</p>
        ${c.url ? `<p style="margin:6px 0 0;font-size:11px"><a href="${escapeHtml(c.url)}" target="_blank" style="color:var(--ink-soft)">${escapeHtml(c.url)}</a></p>` : ''}
      </div>
    `).join('')}
  </div>
</section>

<!-- ════════════════════════════════════════════ -->
<!-- SLIDE 5 : Audit détaillé 7 canaux            -->
<!-- ════════════════════════════════════════════ -->
<section class="slide" data-slide="5">
  <div class="detail-slide">
    <div class="subtitle">Section 4</div>
    <h1>Audit détaillé par canal</h1>
    ${renderChannelDetail('Site Internet', ac.site_internet)}
    ${renderChannelDetail('SEO local & technique', ac.seo)}
    ${renderChannelDetail('Référencement LLM / GEO', ac.llm_geo)}
    ${renderChannelDetail('Publicité digitale (SEA / Social Ads)', ac.sea_ads)}
    ${renderChannelDetail('Réseaux sociaux', ac.reseaux_sociaux)}
    ${renderChannelDetail('E-réputation', ac.ereputation)}
    ${renderChannelDetail('Google Business & Notoriété locale', ac.gbp_notoriete)}
  </div>
</section>

<!-- ════════════════════════════════════════════ -->
<!-- SLIDE 6 : Comparatif complet                -->
<!-- ════════════════════════════════════════════ -->
<section class="slide" data-slide="6">
  <div class="detail-slide">
    <div class="subtitle">Section 5</div>
    <h1>Analyse comparative complète</h1>
    <table class="compare-table">
      <thead>
        <tr><th>Canal</th><th>${escapeHtml(entreprise)}</th>${concs.map(c => `<th>${escapeHtml(c.nom || '—')}</th>`).join('')}</tr>
      </thead>
      <tbody>
        <tr class="client-row"><td>Site Internet</td><td>${fmtScoreOnly(ac.site_internet?.score)}</td>${concs.map(c => `<td>${fmtScoreOnly(c.scores?.site)}</td>`).join('')}</tr>
        <tr><td>SEO</td><td>${fmtScoreOnly(ac.seo?.score)}</td>${concs.map(c => `<td>${fmtScoreOnly(c.scores?.seo)}</td>`).join('')}</tr>
        <tr><td>LLM / GEO</td><td>${fmtScoreOnly(ac.llm_geo?.score)}</td>${concs.map(c => `<td>${fmtScoreOnly(c.scores?.llm_geo)}</td>`).join('')}</tr>
        <tr><td>SEA / Social Ads</td><td>${fmtScoreOnly(ac.sea_ads?.score)}</td>${concs.map(c => `<td>${fmtScoreOnly(c.scores?.sea_ads)}</td>`).join('')}</tr>
        <tr><td>Réseaux sociaux</td><td>${fmtScoreOnly(ac.reseaux_sociaux?.score)}</td>${concs.map(c => `<td>${fmtScoreOnly(c.scores?.reseaux_sociaux)}</td>`).join('')}</tr>
        <tr><td>E-réputation</td><td>${fmtScoreOnly(ac.ereputation?.score)}</td>${concs.map(c => `<td>${fmtScoreOnly(c.scores?.ereputation)}</td>`).join('')}</tr>
        <tr><td>GBP</td><td>${fmtScoreOnly(ac.gbp_notoriete?.score)}</td>${concs.map(c => `<td>${fmtScoreOnly(c.scores?.gbp_notoriete)}</td>`).join('')}</tr>
        <tr style="font-weight:800"><td>GLOBAL</td><td>${fmtScoreOnly(sg)}</td>${concs.map(c => `<td>${fmtScoreOnly(c.score_global)}</td>`).join('')}</tr>
      </tbody>
    </table>
    <h2>Écarts majeurs identifiés</h2>
    ${(auditJson.ecarts_majeurs || []).length ? (auditJson.ecarts_majeurs || []).map(e => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#FAF9F4;border-radius:8px;margin-bottom:6px;font-size:12px">
        <span><strong>${escapeHtml(e.canal || '—')}</strong> — ${e.client} vs ${e.meilleur}</span>
        <span style="color:${e.criticite === 'Critique' ? 'var(--danger)' : 'var(--ink-soft)'};font-weight:700">${e.ecart > 0 ? '+' : ''}${e.ecart} pts (${e.criticite})</span>
      </div>
    `).join('') : '<p>Pas suffisamment de données comparables pour identifier des écarts chiffrés.</p>'}
  </div>
</section>

<!-- ════════════════════════════════════════════ -->
<!-- SLIDE 7 : Opportunités prioritaires         -->
<!-- ════════════════════════════════════════════ -->
<section class="slide" data-slide="7">
  <div class="detail-slide">
    <div class="subtitle">Section 6</div>
    <h1>Opportunités prioritaires</h1>
    <ul>${(auditJson.opportunites || []).map(o => `<li>${escapeHtml(o)}</li>`).join('')}</ul>
    <h2>Mapping opportunité → offre Digitallis</h2>
    ${(auditJson.offres_digitallis || []).map((o, i) => `
      <div class="channel-detail">
        <div class="channel-name">${i + 1}. ${escapeHtml(o.opportunite || '—')}</div>
        <p style="margin:6px 0;font-size:12px;color:var(--ink)"><strong>Offre :</strong> ${escapeHtml(o.offre || '—')}</p>
        <p style="margin:0;font-size:11px;color:var(--muted);font-style:italic">Impact attendu : ${escapeHtml(o.impact_attendu || '—')}</p>
      </div>
    `).join('')}
  </div>
</section>

<!-- ════════════════════════════════════════════ -->
<!-- SLIDE 8 : Plan d'actions détaillé           -->
<!-- ════════════════════════════════════════════ -->
<section class="slide" data-slide="8">
  <div class="detail-slide">
    <div class="subtitle">Section 7</div>
    <h1>Plan d'actions priorisé</h1>

    <h2 style="color:var(--accent-dk)">🚀 Quick Wins (0-30 jours)</h2>
    ${quickWins.length ? quickWins.map(a => `<div class="channel-detail"><strong>${escapeHtml(a.action || '')}</strong><br><span style="font-size:11px;color:var(--muted)">→ ${escapeHtml(a.offre_digitallis || '')} · Impact : ${escapeHtml(a.impact || '')}</span></div>`).join('') : '<p><em>À cadrer en RDV.</em></p>'}

    <h2 style="color:#0A66C2">📈 Développement (1-3 mois)</h2>
    ${developpement.length ? developpement.map(a => `<div class="channel-detail"><strong>${escapeHtml(a.action || '')}</strong><br><span style="font-size:11px;color:var(--muted)">→ ${escapeHtml(a.offre_digitallis || '')} · Impact : ${escapeHtml(a.impact || '')}</span></div>`).join('') : '<p><em>À cadrer.</em></p>'}

    <h2 style="color:var(--success)">🏆 Croissance (3-6 mois)</h2>
    ${croissance.length ? croissance.map(a => `<div class="channel-detail"><strong>${escapeHtml(a.action || '')}</strong><br><span style="font-size:11px;color:var(--muted)">→ ${escapeHtml(a.offre_digitallis || '')} · Impact : ${escapeHtml(a.impact || '')}</span></div>`).join('') : '<p><em>À cadrer.</em></p>'}
  </div>
</section>

<!-- ════════════════════════════════════════════ -->
<!-- SLIDE 9 : Apprentissages clés               -->
<!-- ════════════════════════════════════════════ -->
<section class="slide" data-slide="9">
  <div class="detail-slide">
    <div class="subtitle">Section 8</div>
    <h1>Apprentissages clés</h1>
    <ol style="font-size:13px;line-height:1.7;color:var(--ink-soft)">
      ${(auditJson.apprentissages_cles || []).map(a => `<li style="margin-bottom:12px">${escapeHtml(a)}</li>`).join('') || '<li>Aucun apprentissage spécifique identifié.</li>'}
    </ol>
  </div>
</section>

<!-- ════════════════════════════════════════════ -->
<!-- SLIDE 10 : Contact / CTA                    -->
<!-- ════════════════════════════════════════════ -->
<section class="slide" data-slide="10">
  <div class="detail-slide" style="text-align:center;background:var(--ink);color:#FFF">
    <div class="subtitle" style="color:var(--accent);border-bottom-color:var(--accent)">Échangeons</div>
    <h1 style="color:#FFF;font-size:36px">Prêt à structurer<br>votre acquisition ?</h1>
    <p style="color:rgba(255,255,255,.7);max-width:600px;margin:24px auto">
      Digitallis construit des écosystèmes digitaux intelligents pour les entrepreneurs ambitieux des Antilles-Guyane. Échangeons sur la mise en œuvre concrète de ces recommandations.
    </p>
    <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:24px;max-width:480px;margin:32px auto">
      <p style="color:var(--accent);font-size:11px;text-transform:uppercase;letter-spacing:.15em;margin:0 0 12px">Contact</p>
      <p style="font-size:18px;color:#FFF;margin:8px 0"><a href="mailto:info@digitallis.fr" style="color:#FFF;text-decoration:none">info@digitallis.fr</a></p>
      <p style="font-size:14px;color:rgba(255,255,255,.8);margin:8px 0">+590 602 18 20 20</p>
      <p style="font-size:14px;color:rgba(255,255,255,.8);margin:8px 0">www.digitallis.fr</p>
    </div>
    <p style="font-size:10px;color:rgba(255,255,255,.4);margin-top:24px">${date} · Audit ${escapeHtml(entreprise)} · Méthodologie 100% vérifiable</p>
  </div>
</section>

</div>

<div class="nav-controls">
  <button class="nav-btn" onclick="changeSlide(-1)">‹</button>
  <div class="slide-dots" id="dots"></div>
  <button class="nav-btn" onclick="changeSlide(1)">›</button>
  <span class="slide-counter" id="counter">1 / 10</span>
</div>

<script>
let current = 1;
const total = document.querySelectorAll('.slide').length;
const dotsContainer = document.getElementById('dots');
const counter = document.getElementById('counter');
for (let i = 1; i <= total; i++) {
  const dot = document.createElement('div');
  dot.className = 'dot' + (i === 1 ? ' active' : '');
  dot.onclick = () => goToSlide(i);
  dotsContainer.appendChild(dot);
}
function goToSlide(n) {
  document.querySelector('.slide.active')?.classList.remove('active');
  document.querySelector('.slide[data-slide="' + n + '"]')?.classList.add('active');
  current = n;
  document.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('active', i + 1 === current));
  counter.textContent = current + ' / ' + total;
}
function changeSlide(dir) {
  let next = current + dir;
  if (next < 1) next = total;
  if (next > total) next = 1;
  goToSlide(next);
}
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); changeSlide(1); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); changeSlide(-1); }
});
let touchStartX = 0;
document.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; });
document.addEventListener('touchend', e => {
  const diff = touchStartX - e.changedTouches[0].clientX;
  if (Math.abs(diff) > 50) changeSlide(diff > 0 ? 1 : -1);
});
</script>
</body>
</html>`;
}

/**
 * Helper externe (utilisé dans le template ci-dessus via interpolation)
 * — déclaré ici pour rester dans le scope du module
 */
function renderChannelDetail(label, axis) {
  if (!axis) {
    return `<div class="channel-detail null">
      <div class="channel-header">
        <div class="channel-name">${label}</div>
        <div class="channel-score" style="color:#9CA3AF">NON NOTÉ</div>
      </div>
      <p style="margin:0;font-size:12px;color:#9CA3AF;font-style:italic">Donnée non observable publiquement.</p>
    </div>`;
  }
  const score = axis.score;
  const isNul = score === null || score === undefined;
  const color = scoreColor(score);
  const statutBadge = axis.statut_preuve === 'Observé' ? 'badge-obs'
    : axis.statut_preuve === 'Partiellement observable' ? 'badge-partial'
    : 'badge-non';

  return `<div class="channel-detail${isNul ? ' null' : ''}">
    <div class="channel-header">
      <div class="channel-name">${label}</div>
      <div class="channel-score" style="color:${color}">${isNul ? 'NON NOTÉ' : score + '/100'}</div>
    </div>
    <div style="margin-bottom:10px">
      ${axis.statut_preuve ? `<span class="badge ${statutBadge}">${escapeHtml(axis.statut_preuve)}</span>` : ''}
      ${axis.fiabilite ? `<span class="badge badge-non">Fiabilité : ${escapeHtml(axis.fiabilite)}</span>` : ''}
    </div>
    ${(axis.donnees_observees && axis.donnees_observees.length) ? `<p style="margin:6px 0;font-size:11px"><strong>Données observées :</strong> ${axis.donnees_observees.map(escapeHtml).join(' · ')}</p>` : ''}
    ${(axis.donnees_non_verifiables && axis.donnees_non_verifiables.length) ? `<p style="margin:6px 0;font-size:11px;color:var(--muted)"><strong>Non vérifiable publiquement :</strong> ${axis.donnees_non_verifiables.map(escapeHtml).join(' · ')}</p>` : ''}
    <div class="two-col" style="margin-top:10px">
      <div class="col-block col-positive">
        <h4>Points forts</h4>
        <ul>${(axis.points_forts || []).map(p => `<li>${escapeHtml(p)}</li>`).join('') || '<li><em>Aucun observé.</em></li>'}</ul>
      </div>
      <div class="col-block col-negative">
        <h4>Axes d'amélioration</h4>
        <ul>${(axis.axes_amelioration || []).map(a => `<li>${escapeHtml(a)}</li>`).join('') || '<li><em>Aucun.</em></li>'}</ul>
      </div>
    </div>
  </div>`;
}

module.exports = { generateAuditHtml };
