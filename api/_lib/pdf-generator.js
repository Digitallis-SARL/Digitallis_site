/**
 * Générateur PDF — Audit Concurrentiel Digitallis
 *
 * Produit un PDF "rapport préliminaire" instantané à la soumission du formulaire.
 * Le contenu est volontairement structuré comme un template : il sera enrichi par
 * le moteur IA (webhook async) qui réécrit le contenu réel quelques minutes plus tard.
 *
 * Charte Digitallis : crème #FAFAF7, encre #1C1F26, accent jaune #FACC14, jaune profond #E8B800.
 */

const PDFDocument = require('pdfkit');

// ── Palette ──
const CR = '#FAFAF7';
const CR_DEEP = '#F4F2EA';
const INK = '#1C1F26';
const INK_SOFT = '#3A3F4A';
const MUTED = '#676F7E';
const ACCENT = '#FACC14';
const ACCENT_DK = '#E8B800';
const SUCCESS = '#28C941';
const DANGER = '#E5484D';
const BORDER = '#E8E6E0';

const PAGE_MARGIN = 48;

function buf(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

// Helper: write a single line without triggering pdfkit's auto pagination
// (we draw chrome into the margins, where line-wrap could cause infinite recursion
// because pageAdded fires while we're still drawing the page that triggered it).
function writeFixed(doc, text, x, y, opts) {
  doc.text(text, x, y, Object.assign({
    lineBreak: false,
    width: doc.page.width, // ample width to avoid wrap
    height: 12,
  }, opts || {}));
}

function drawHeader(doc, pageNum) {
  if (pageNum === 1) return; // cover handles itself
  doc.save();
  // top accent bar
  doc.rect(0, 0, doc.page.width, 28).fill(INK);
  doc.fontSize(8).fillColor(ACCENT).font('Helvetica-Bold');
  writeFixed(doc, 'DIGITALLIS', PAGE_MARGIN, 10);
  doc.fontSize(8).fillColor('#FFFFFF').font('Helvetica');
  writeFixed(doc, 'Audit Concurrentiel — Rapport préliminaire', PAGE_MARGIN + 80, 10);
  doc.fontSize(8).fillColor('#A8A8A8');
  writeFixed(doc, 'p. ' + pageNum, doc.page.width - PAGE_MARGIN - 30, 10, { width: 30, align: 'right' });
  // thin gold line under header
  doc.rect(0, 28, doc.page.width, 1).fill(ACCENT);
  doc.restore();
}

function drawFooter(doc) {
  doc.save();
  const y = doc.page.height - 30;
  doc.fontSize(7.5).fillColor(MUTED).font('Helvetica');
  writeFixed(doc, 'Confidentiel · Digitallis · Document à usage exclusif du client', PAGE_MARGIN, y);
  writeFixed(doc, 'digitallis.fr  ·  info@digitallis.fr',
    doc.page.width - PAGE_MARGIN - 220, y, { width: 220, align: 'right' });
  doc.restore();
}

function sectionTitle(doc, num, title) {
  doc.moveDown(1);
  const y = doc.y;
  doc.fontSize(10).fillColor(ACCENT_DK).font('Helvetica-Bold')
     .text(`0${num}`, PAGE_MARGIN, y);
  doc.fontSize(18).fillColor(INK).font('Helvetica-Bold')
     .text(title, PAGE_MARGIN + 28, y - 2);
  doc.moveTo(PAGE_MARGIN, doc.y + 4)
     .lineTo(PAGE_MARGIN + 60, doc.y + 4)
     .lineWidth(2).strokeColor(ACCENT).stroke();
  doc.moveDown(0.8);
}

function bodyText(doc, text) {
  doc.fontSize(10).fillColor(INK_SOFT).font('Helvetica')
     .text(text, { paragraphGap: 6, lineGap: 2 });
}

function calloutBox(doc, title, body, color = ACCENT) {
  const startY = doc.y;
  const padding = 14;
  const width = doc.page.width - PAGE_MARGIN * 2;
  doc.save();
  // Estimate height
  doc.fontSize(10).font('Helvetica');
  const bodyHeight = doc.heightOfString(body, { width: width - padding * 2 });
  const totalHeight = padding * 2 + 16 + bodyHeight;
  doc.rect(PAGE_MARGIN, startY, width, totalHeight)
     .fillColor(CR_DEEP).fill();
  doc.rect(PAGE_MARGIN, startY, 3, totalHeight)
     .fillColor(color).fill();
  doc.fontSize(11).fillColor(INK).font('Helvetica-Bold')
     .text(title, PAGE_MARGIN + padding, startY + padding,
           { width: width - padding * 2 });
  doc.fontSize(10).fillColor(INK_SOFT).font('Helvetica')
     .text(body, PAGE_MARGIN + padding, startY + padding + 18,
           { width: width - padding * 2, lineGap: 2 });
  doc.restore();
  doc.y = startY + totalHeight + 8;
}

function kvTable(doc, rows) {
  const width = doc.page.width - PAGE_MARGIN * 2;
  const labelW = 150;
  const valueW = width - labelW;
  rows.forEach(([label, value]) => {
    const y = doc.y;
    doc.fontSize(9).fillColor(MUTED).font('Helvetica-Bold')
       .text(label.toUpperCase(), PAGE_MARGIN, y, { width: labelW, lineBreak: false });
    const valueY = doc.y;
    doc.fontSize(10).fillColor(INK).font('Helvetica')
       .text(value || '—', PAGE_MARGIN + labelW, y, { width: valueW });
    const newY = Math.max(valueY + 14, doc.y);
    doc.moveTo(PAGE_MARGIN, newY)
       .lineTo(doc.page.width - PAGE_MARGIN, newY)
       .lineWidth(0.5).strokeColor(BORDER).stroke();
    doc.y = newY + 6;
  });
}

function scoreBar(doc, label, score, isStrategic = false) {
  const y = doc.y;
  const width = doc.page.width - PAGE_MARGIN * 2;
  const labelW = 230;
  const barX = PAGE_MARGIN + labelW + 10;
  const barW = width - labelW - 60;

  // Strategic badge
  let labelX = PAGE_MARGIN;
  if (isStrategic) {
    doc.rect(PAGE_MARGIN, y + 2, 78, 12).fillColor('#0A66C2').fill();
    doc.fontSize(7).fillColor('#FFFFFF').font('Helvetica-Bold')
       .text('★ STRATÉGIQUE', PAGE_MARGIN + 4, y + 5, { width: 70, lineBreak: false });
    labelX = PAGE_MARGIN + 84;
  }

  doc.fontSize(10).fillColor(INK).font('Helvetica-Bold')
     .text(label, labelX, y + 3, { width: labelW - (labelX - PAGE_MARGIN), lineBreak: false });

  // Color based on score
  let color = DANGER;
  if (score >= 75) color = SUCCESS;
  else if (score >= 55) color = ACCENT_DK;
  else if (score >= 40) color = '#F39C12';

  // Background bar
  doc.rect(barX, y + 6, barW, 8).fillColor('#EBEAE4').fill();
  // Filled bar
  doc.rect(barX, y + 6, barW * (score / 100), 8).fillColor(color).fill();
  // Score number
  doc.fontSize(11).fillColor(color).font('Helvetica-Bold')
     .text(`${score}/100`, barX + barW + 8, y + 3,
           { width: 50, lineBreak: false, align: 'right' });

  doc.y = y + 22;
}

function phaseBlock(doc, emoji, title, subtitle, items, color) {
  if (doc.y > doc.page.height - 200) doc.addPage();
  const startY = doc.y;
  const width = doc.page.width - PAGE_MARGIN * 2;
  const padding = 14;
  doc.fontSize(11).font('Helvetica');
  let bodyText = items.map(i => `▸  ${i}`).join('\n\n');
  const bodyHeight = doc.heightOfString(bodyText, { width: width - padding * 2 - 50 });
  const totalHeight = padding * 2 + 50 + bodyHeight;

  doc.rect(PAGE_MARGIN, startY, width, totalHeight).fillColor(CR_DEEP).fill();
  doc.rect(PAGE_MARGIN, startY, 4, totalHeight).fillColor(color).fill();

  doc.fontSize(22).fillColor(INK).font('Helvetica-Bold')
     .text(emoji, PAGE_MARGIN + padding, startY + padding, { lineBreak: false });
  doc.fontSize(14).fillColor(color).font('Helvetica-Bold')
     .text(title, PAGE_MARGIN + padding + 36, startY + padding,
           { width: width - padding * 2 - 36 });
  doc.fontSize(9).fillColor(MUTED).font('Helvetica')
     .text(subtitle, PAGE_MARGIN + padding + 36, startY + padding + 18,
           { width: width - padding * 2 - 36 });
  doc.fontSize(10).fillColor(INK_SOFT).font('Helvetica')
     .text(bodyText, PAGE_MARGIN + padding, startY + padding + 50,
           { width: width - padding * 2, lineGap: 4 });

  doc.y = startY + totalHeight + 10;
}

/**
 * Génère un PDF d'audit concurrentiel préliminaire à partir des données du formulaire.
 * Retourne un Buffer.
 *
 * @param {Object} data - { entreprise, secteur, zone, siteWeb, cibles, freins, objectifs, ... }
 * @returns {Promise<Buffer>}
 */
async function generateAuditPdf(data) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: PAGE_MARGIN, right: PAGE_MARGIN },
    info: {
      Title: `Audit Concurrentiel — ${data.entreprise || 'Client'}`,
      Author: 'Digitallis',
      Subject: 'Audit digital concurrentiel',
    },
  });

  const bufPromise = buf(doc);

  // Track page numbers manually
  let pageNum = 1;
  doc.on('pageAdded', () => {
    pageNum++;
    drawHeader(doc, pageNum);
    drawFooter(doc);
    doc.y = 50;
  });

  // ─── COVER ───
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(INK);
  // Decorative circles (soft glow)
  doc.save();
  doc.opacity(0.12).circle(doc.page.width - 60, 100, 130).fill(ACCENT);
  doc.opacity(0.08).circle(80, doc.page.height - 200, 180).fill('#87C8FF');
  doc.opacity(1);
  doc.restore();

  // Logo zone (text only — no PNG dependency for serverless reliability)
  doc.fontSize(11).fillColor(ACCENT).font('Helvetica-Bold')
     .text('DIGITALLIS', PAGE_MARGIN, 60, { characterSpacing: 2 });
  doc.fontSize(9).fillColor('#A8A8A8').font('Helvetica')
     .text('Conseil & systèmes d\'acquisition digitale', PAGE_MARGIN, 76);

  // Hero
  doc.fontSize(11).fillColor(ACCENT).font('Helvetica-Bold')
     .text('AUDIT CONCURRENTIEL', PAGE_MARGIN, 220, { characterSpacing: 1.5 });
  doc.fontSize(38).fillColor('#FFFFFF').font('Helvetica-Bold')
     .text('Rapport préliminaire', PAGE_MARGIN, 240, { width: 440 });
  doc.fontSize(14).fillColor('#C8C8C8').font('Helvetica')
     .text('Diagnostic structuré · Plan d\'action priorisé',
           PAGE_MARGIN, 290, { width: 440 });

  // Gold separator
  doc.rect(PAGE_MARGIN, 330, 80, 3).fill(ACCENT);

  // Client info
  let infoY = 370;
  doc.fontSize(9).fillColor(ACCENT).font('Helvetica-Bold')
     .text('ENTREPRISE AUDITÉE', PAGE_MARGIN, infoY);
  doc.fontSize(16).fillColor('#FFFFFF').font('Helvetica-Bold')
     .text(data.entreprise || '(à compléter)', PAGE_MARGIN, infoY + 12);
  doc.fontSize(10).fillColor('#C8C8C8').font('Helvetica')
     .text(`${data.secteur || ''} · ${data.zone || ''}`,
           PAGE_MARGIN, infoY + 34);

  infoY += 70;
  doc.fontSize(9).fillColor(ACCENT).font('Helvetica-Bold')
     .text('DATE DE LA DEMANDE', PAGE_MARGIN, infoY);
  doc.fontSize(13).fillColor('#FFFFFF').font('Helvetica')
     .text(new Date().toLocaleDateString('fr-FR', {
       day: 'numeric', month: 'long', year: 'numeric',
     }), PAGE_MARGIN, infoY + 12);

  // Disclaimer bottom
  doc.fontSize(8).fillColor('#888888').font('Helvetica')
     .text('⚠ Rapport préliminaire généré automatiquement à la soumission du formulaire. ' +
           'L\'audit IA complet vous sera envoyé sous 24 à 72 h, intégrant l\'analyse approfondie ' +
           'de vos concurrents directs, les scores comparatifs et le plan d\'actions chiffré.',
           PAGE_MARGIN, doc.page.height - 110,
           { width: doc.page.width - PAGE_MARGIN * 2, lineGap: 2 });

  doc.fontSize(8).fillColor('#888888').font('Helvetica')
     .text('Confidentiel · Document à usage exclusif du client',
           PAGE_MARGIN, doc.page.height - 50);
  doc.text('digitallis.fr',
           doc.page.width - PAGE_MARGIN - 100, doc.page.height - 50,
           { width: 100, align: 'right' });

  // ─── PAGE 2 : RÉCAPITULATIF ───
  doc.addPage();
  sectionTitle(doc, 1, 'Récapitulatif de votre demande');
  bodyText(doc,
    'Ce document récapitule les informations transmises via le formulaire d\'audit concurrentiel ' +
    'Digitallis. Il constitue le point de départ de l\'analyse approfondie qui vous sera livrée ' +
    'sous 24 à 72 heures, comportant le diagnostic comparatif détaillé, les scores par canal ' +
    '(Site, SEO, SEA, LinkedIn, GBP, E-réputation, LLM/GEO) et le plan d\'actions priorisé.');
  doc.moveDown(0.5);

  kvTable(doc, [
    ['Entreprise', data.entreprise || '—'],
    ['Site web', data.siteWeb || '—'],
    ['Zone de chalandise', data.zone || '—'],
    ['Secteur', data.secteur || '—'],
    ['Taille entreprise', data.effectif || '—'],
    ['Type clientèle', data.typeClientele || '—'],
    ['Frein principal', data.frein || '—'],
    ['Expérience agence', data.experienceAgence || '—'],
    ['Décisionnaire', data.decisionnaire || '—'],
    ['Budget mensuel', data.budget || '— (à définir ensemble)'],
    ['Email', data.email || '—'],
    ['Téléphone', data.telephone || '—'],
  ]);

  doc.moveDown(1);
  sectionTitle(doc, 2, 'Vos attentes pour cet audit');
  bodyText(doc, data.attente || '(non renseigné)');

  // ─── PAGE 3 : MÉTHODOLOGIE ───
  doc.addPage();
  sectionTitle(doc, 4, 'Méthodologie Digitallis');
  bodyText(doc,
    'Notre audit suit une méthodologie en 7 phases inspirée des standards de conseil stratégique, ' +
    'spécialement adaptée au marché Antilles-Guyane et au profil de votre activité.');
  doc.moveDown(0.5);

  calloutBox(doc,
    'Engagement de transparence',
    'Toutes les données présentées dans le rapport final reposent sur des éléments publiquement ' +
    'observables (sites web fetchés, SERP testée, profils sociaux, fiches Google Business). Les budgets ' +
    'publicitaires, conversions et chiffres internes sont non observables publiquement et signalés comme tels. ' +
    'Aucune extrapolation, aucune hypothèse — chaque score est justifié par sa preuve.',
    ACCENT_DK
  );

  doc.moveDown(0.5);

  const canaux = [
    ['Site Internet', 'UX, conversion, performance, rassurance', false],
    ['SEO local & technique', 'Couverture requêtes cœur, longue traîne, schema', false],
    ['Référencement LLM / GEO', 'Visibilité ChatGPT, Claude, Gemini, AI Overviews', false],
    ['Publicité digitale (SEA / Social Ads)', 'Google Ads, Meta, LinkedIn Ads', false],
    ['LinkedIn', 'Page entreprise + profil dirigeant + Social Selling', false],
    ['E-réputation', 'Avis Google, témoignages, vélocité', false],
    ['Google Business & Notoriété locale', 'Fiche GBP, posts, photos, NAP', false],
  ];

  doc.fontSize(11).fillColor(INK).font('Helvetica-Bold')
     .text('Les 7 canaux analysés');
  doc.moveDown(0.5);

  canaux.forEach(([label, sub]) => {
    const y = doc.y;
    doc.rect(PAGE_MARGIN, y, 4, 30).fill(ACCENT);
    doc.fontSize(11).fillColor(INK).font('Helvetica-Bold')
       .text(label, PAGE_MARGIN + 12, y, { lineBreak: false });
    doc.fontSize(9).fillColor(MUTED).font('Helvetica')
       .text(sub, PAGE_MARGIN + 12, y + 14, { lineBreak: false });
    doc.y = y + 36;
  });

  // ─── PAGE 4 : PROCHAINES ÉTAPES ───
  doc.addPage();
  sectionTitle(doc, 5, 'Prochaines étapes');
  bodyText(doc,
    'Votre demande est désormais enregistrée dans notre système. Voici la suite du processus :');
  doc.moveDown(0.5);

  phaseBlock(doc, '🚀', 'PHASE 1 — Cadrage',
    '0 — 24h · Confirmation et premiers signaux',
    [
      'Vérification de la complétude des informations transmises',
      'Identification automatique de votre panel concurrentiel (3-5 acteurs)',
      'Premier passage SEO + GBP + LinkedIn',
      'Email de confirmation avec créneau de RDV de restitution',
    ],
    ACCENT_DK
  );

  phaseBlock(doc, '🔍', 'PHASE 2 — Diagnostic complet',
    '24 — 72h · Audit IA approfondi',
    [
      'Audit des 7 canaux sur votre entreprise (avec preuves observables)',
      'Audit des 7 canaux sur chaque concurrent retenu',
      'Tableau comparatif scoré avec écarts critiques identifiés',
      'Synthèse stratégique avec opportunités prioritaires',
    ],
    '#0A66C2'
  );

  phaseBlock(doc, '🎯', 'PHASE 3 — Restitution',
    'J+3 à J+5 · Plan d\'action chiffré',
    [
      'Rapport PDF complet remplacera ce document préliminaire',
      'RDV de restitution (visio ou présentiel Baie-Mahault)',
      'Plan d\'actions priorisé Quick Wins / Développement / Croissance',
      'Proposition commerciale Digitallis adaptée (si pertinent, sans engagement)',
    ],
    SUCCESS
  );

  doc.moveDown(1);
  calloutBox(doc,
    'Une question avant la livraison ?',
    'Notre équipe est disponible pour clarifier vos objectifs ou compléter votre dossier. ' +
    'Contactez-nous : info@digitallis.fr · +590 602 18 20 20',
    ACCENT
  );

  // Finalize
  drawHeader(doc, 1); // for cover (no-op, but for symmetry)
  drawFooter(doc);

  doc.end();
  return bufPromise;
}

/**
 * Génère le rapport au format Markdown (version brute pour traitement IA ultérieur
 * et pour archivage lisible).
 */
function generateAuditMarkdown(data) {
  const date = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  return `# Audit Concurrentiel — Rapport Préliminaire

**Entreprise :** ${data.entreprise || '—'}
**Secteur :** ${data.secteur || '—'}
**Zone :** ${data.zone || '—'}
**Date de la demande :** ${date}

---

## 1. Récapitulatif de la demande

| Champ | Valeur |
|---|---|
| Entreprise | ${data.entreprise || '—'} |
| Site web | ${data.siteWeb || '—'} |
| Zone de chalandise | ${data.zone || '—'} |
| Secteur | ${data.secteur || '—'} |
| Taille entreprise | ${data.effectif || '—'} |
| Type clientèle | ${data.typeClientele || '—'} |
| Frein principal | ${data.frein || '—'} |
| Expérience agence | ${data.experienceAgence || '—'} |
| Décisionnaire | ${data.decisionnaire || '—'} |
| Budget mensuel | ${data.budget || '— (à définir ensemble)'} |
| Email | ${data.email || '—'} |
| Téléphone | ${data.telephone || '—'} |

## 2. Vos attentes pour cet audit

${data.attente || '_(non renseigné)_'}

---

## 4. Méthodologie Digitallis

L'audit suit une méthodologie en 7 phases, 100 % vérifiable, adaptée au marché Antilles-Guyane.

> ⚠ Toutes les données présentées dans le rapport final reposent sur des éléments publiquement observables. Les budgets, conversions et chiffres internes sont non observables publiquement et signalés comme tels.

### Les 7 canaux analysés

1. **Site Internet** — UX, conversion, performance, rassurance
2. **SEO local & technique** — Couverture requêtes cœur, longue traîne, schema
3. **Référencement LLM / GEO** — Visibilité ChatGPT, Claude, Gemini, AI Overviews
4. **Publicité digitale (SEA / Social Ads)** — Google Ads, Meta, LinkedIn Ads
5. **LinkedIn** — Page entreprise + profil dirigeant + Social Selling
6. **E-réputation** — Avis Google, témoignages, vélocité
7. **Google Business & Notoriété locale** — Fiche GBP, posts, photos, NAP

---

## 5. Prochaines étapes

### 🚀 Phase 1 — Cadrage (0–24h)
- Vérification de la complétude des informations
- Identification automatique du panel concurrentiel (3–5 acteurs)
- Premier passage SEO + GBP + LinkedIn
- Email de confirmation avec créneau de RDV

### 🔍 Phase 2 — Diagnostic complet (24–72h)
- Audit des 7 canaux sur votre entreprise (avec preuves observables)
- Audit des 7 canaux sur chaque concurrent retenu
- Tableau comparatif scoré avec écarts critiques identifiés
- Synthèse stratégique avec opportunités prioritaires

### 🎯 Phase 3 — Restitution (J+3 à J+5)
- Rapport PDF complet remplaçant ce document préliminaire
- RDV de restitution (visio ou présentiel Baie-Mahault)
- Plan d'actions priorisé (Quick Wins / Développement / Croissance)
- Proposition commerciale Digitallis adaptée (si pertinent, sans engagement)

---

## Données brutes du formulaire

\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\`

---

*Rapport préliminaire généré automatiquement par Digitallis · ${date}*
*L'audit IA complet remplacera ce document sous 24–72h.*
`;
}

module.exports = { generateAuditPdf, generateAuditMarkdown };
