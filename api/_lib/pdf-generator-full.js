/**
 * Générateur PDF COMPLET — Audit Concurrentiel Digitallis
 *
 * Produit un PDF premium ~15-20 pages à partir du JSON Claude.
 * Charte : crème #FAFAF7, encre #1C1F26, accent jaune #FACC14.
 */

const PDFDocument = require('pdfkit');

const CR = '#FAFAF7';
const CR_DEEP = '#F4F2EA';
const INK = '#1C1F26';
const INK_SOFT = '#3A3F4A';
const MUTED = '#676F7E';
const ACCENT = '#FACC14';
const ACCENT_DK = '#E8B800';
const SUCCESS = '#28C941';
const DANGER = '#E5484D';
const ORANGE = '#F39C12';
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

function writeFixed(doc, text, x, y, opts) {
  doc.text(text, x, y, Object.assign({
    lineBreak: false,
    width: doc.page.width,
    height: 12,
  }, opts || {}));
}

function drawHeader(doc, pageNum) {
  if (pageNum === 1) return;
  doc.save();
  doc.rect(0, 0, doc.page.width, 28).fill(INK);
  doc.fontSize(8).fillColor(ACCENT).font('Helvetica-Bold');
  writeFixed(doc, 'DIGITALLIS', PAGE_MARGIN, 10);
  doc.fontSize(8).fillColor('#FFFFFF').font('Helvetica');
  writeFixed(doc, 'Audit Concurrentiel Complet', PAGE_MARGIN + 80, 10);
  doc.fontSize(8).fillColor('#A8A8A8');
  writeFixed(doc, 'p. ' + pageNum, doc.page.width - PAGE_MARGIN - 30, 10, { width: 30, align: 'right' });
  doc.rect(0, 28, doc.page.width, 1).fill(ACCENT);
  doc.restore();
}

function drawFooter(doc) {
  doc.save();
  const y = doc.page.height - 30;
  doc.fontSize(7.5).fillColor(MUTED).font('Helvetica');
  writeFixed(doc, 'Confidentiel · Digitallis · Document à usage exclusif du client', PAGE_MARGIN, y);
  writeFixed(doc, 'digitallis.fr · info@digitallis.fr',
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
  doc.fontSize(10).font('Helvetica');
  const bodyHeight = doc.heightOfString(body, { width: width - padding * 2 });
  const totalHeight = padding * 2 + 16 + bodyHeight;
  doc.rect(PAGE_MARGIN, startY, width, totalHeight).fillColor(CR_DEEP).fill();
  doc.rect(PAGE_MARGIN, startY, 3, totalHeight).fillColor(color).fill();
  doc.fontSize(11).fillColor(INK).font('Helvetica-Bold')
     .text(title, PAGE_MARGIN + padding, startY + padding,
           { width: width - padding * 2 });
  doc.fontSize(10).fillColor(INK_SOFT).font('Helvetica')
     .text(body, PAGE_MARGIN + padding, startY + padding + 18,
           { width: width - padding * 2, lineGap: 2 });
  doc.restore();
  doc.y = startY + totalHeight + 8;
}

function scoreColor(score) {
  if (score >= 75) return SUCCESS;
  if (score >= 55) return ACCENT_DK;
  if (score >= 40) return ORANGE;
  return DANGER;
}

function scoreLabel(score) {
  if (score >= 75) return 'BON';
  if (score >= 55) return 'MOYEN';
  if (score >= 40) return 'FAIBLE';
  return 'CRITIQUE';
}

function scoreBar(doc, label, score) {
  const y = doc.y;
  const width = doc.page.width - PAGE_MARGIN * 2;
  const labelW = 200;
  const barX = PAGE_MARGIN + labelW + 10;
  const barW = width - labelW - 70;
  doc.fontSize(10).fillColor(INK).font('Helvetica-Bold')
     .text(label, PAGE_MARGIN, y + 3, { width: labelW, lineBreak: false });
  const color = scoreColor(score);
  doc.rect(barX, y + 6, barW, 8).fillColor('#EBEAE4').fill();
  doc.rect(barX, y + 6, barW * (score / 100), 8).fillColor(color).fill();
  doc.fontSize(11).fillColor(color).font('Helvetica-Bold')
     .text(`${score}/100`, barX + barW + 8, y + 3,
           { width: 60, lineBreak: false, align: 'right' });
  doc.y = y + 22;
}

function kvRow(doc, label, value) {
  const y = doc.y;
  const width = doc.page.width - PAGE_MARGIN * 2;
  doc.fontSize(9).fillColor(MUTED).font('Helvetica-Bold')
     .text(label.toUpperCase(), PAGE_MARGIN, y, { width: 160, lineBreak: false });
  const startY = doc.y;
  doc.fontSize(10).fillColor(INK).font('Helvetica')
     .text(value || '—', PAGE_MARGIN + 170, y, { width: width - 170 });
  const newY = Math.max(startY + 14, doc.y);
  doc.moveTo(PAGE_MARGIN, newY).lineTo(doc.page.width - PAGE_MARGIN, newY)
     .lineWidth(0.5).strokeColor(BORDER).stroke();
  doc.y = newY + 6;
}

function bulletList(doc, items, color = ACCENT_DK) {
  (items || []).forEach((item) => {
    const y = doc.y;
    doc.fontSize(10).fillColor(color).font('Helvetica-Bold')
       .text('▸', PAGE_MARGIN, y, { width: 12, lineBreak: false });
    doc.fontSize(10).fillColor(INK_SOFT).font('Helvetica')
       .text(item, PAGE_MARGIN + 14, y, {
         width: doc.page.width - PAGE_MARGIN * 2 - 14,
         lineGap: 2,
       });
    doc.moveDown(0.3);
  });
}

function canalCard(doc, title, score, points_forts, axes) {
  // Section title with score
  const y0 = doc.y;
  const labelW = doc.page.width - PAGE_MARGIN * 2 - 100;
  doc.fontSize(13).fillColor(INK).font('Helvetica-Bold')
     .text(title, PAGE_MARGIN, y0, { width: labelW, lineBreak: false });
  const color = scoreColor(score);
  doc.fontSize(13).fillColor(color).font('Helvetica-Bold')
     .text(`${score}/100 · ${scoreLabel(score)}`,
           doc.page.width - PAGE_MARGIN - 100, y0,
           { width: 100, lineBreak: false, align: 'right' });
  doc.y = y0 + 18;
  // separator
  doc.moveTo(PAGE_MARGIN, doc.y).lineTo(doc.page.width - PAGE_MARGIN, doc.y)
     .lineWidth(1).strokeColor(color).stroke();
  doc.moveDown(0.4);

  // Points forts
  doc.fontSize(9).fillColor(SUCCESS).font('Helvetica-Bold')
     .text('POINTS FORTS', PAGE_MARGIN);
  doc.moveDown(0.2);
  if (points_forts && points_forts.length > 0) {
    points_forts.forEach((p) => {
      const y = doc.y;
      doc.fontSize(10).fillColor(SUCCESS).font('Helvetica-Bold')
         .text('✓', PAGE_MARGIN, y, { width: 12, lineBreak: false });
      doc.fontSize(10).fillColor(INK_SOFT).font('Helvetica')
         .text(p, PAGE_MARGIN + 14, y, {
           width: doc.page.width - PAGE_MARGIN * 2 - 14, lineGap: 2,
         });
      doc.moveDown(0.2);
    });
  } else {
    doc.fontSize(9).fillColor(MUTED).font('Helvetica-Oblique')
       .text('Aucun point fort majeur observé', PAGE_MARGIN + 14);
  }
  doc.moveDown(0.3);

  // Axes d'amélioration
  doc.fontSize(9).fillColor(DANGER).font('Helvetica-Bold')
     .text("AXES D'AMÉLIORATION", PAGE_MARGIN);
  doc.moveDown(0.2);
  (axes || []).forEach((a) => {
    const y = doc.y;
    doc.fontSize(10).fillColor(DANGER).font('Helvetica-Bold')
       .text('✗', PAGE_MARGIN, y, { width: 12, lineBreak: false });
    doc.fontSize(10).fillColor(INK_SOFT).font('Helvetica')
       .text(a, PAGE_MARGIN + 14, y, {
         width: doc.page.width - PAGE_MARGIN * 2 - 14, lineGap: 2,
       });
    doc.moveDown(0.2);
  });
  doc.moveDown(0.5);
}

function phaseBlock(doc, emoji, title, subtitle, items, color) {
  if (doc.y > doc.page.height - 220) doc.addPage();
  const startY = doc.y;
  const width = doc.page.width - PAGE_MARGIN * 2;
  const padding = 14;
  doc.fontSize(11).font('Helvetica');
  const lines = (items || []).map((it) => {
    if (typeof it === 'string') return `▸  ${it}`;
    return `▸  ${it.action || ''}\n   Offre Digitallis : ${it.offre_digitallis || it.offre || ''}\n   Impact : ${it.impact || ''}`;
  });
  const bodyText = lines.join('\n\n');
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
           { width: width - padding * 2, lineGap: 3 });
  doc.y = startY + totalHeight + 10;
}

/**
 * Génère le PDF complet à partir du JSON Claude + données formulaire.
 *
 * @param {Object} formData - { entreprise, secteur, zone, ... }
 * @param {Object} auditJson - JSON renvoyé par Claude
 * @returns {Promise<Buffer>}
 */
async function generateFullAuditPdf(formData, auditJson) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: PAGE_MARGIN, right: PAGE_MARGIN },
    info: {
      Title: `Audit Concurrentiel — ${formData.entreprise || 'Client'}`,
      Author: 'Digitallis',
      Subject: 'Audit digital concurrentiel complet',
    },
  });
  const bufPromise = buf(doc);

  let pageNum = 1;
  doc.on('pageAdded', () => {
    pageNum++;
    drawHeader(doc, pageNum);
    drawFooter(doc);
    doc.y = 50;
  });

  // ─── COVER ───
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(INK);
  doc.save();
  doc.opacity(0.12).circle(doc.page.width - 60, 100, 130).fill(ACCENT);
  doc.opacity(0.08).circle(80, doc.page.height - 200, 180).fill('#87C8FF');
  doc.opacity(1);
  doc.restore();

  doc.fontSize(11).fillColor(ACCENT).font('Helvetica-Bold')
     .text('DIGITALLIS', PAGE_MARGIN, 60, { characterSpacing: 2 });
  doc.fontSize(9).fillColor('#A8A8A8').font('Helvetica')
     .text("Conseil & systèmes d'acquisition digitale", PAGE_MARGIN, 76);

  doc.fontSize(11).fillColor(ACCENT).font('Helvetica-Bold')
     .text('AUDIT CONCURRENTIEL COMPLET', PAGE_MARGIN, 200, { characterSpacing: 1.5 });
  doc.fontSize(38).fillColor('#FFFFFF').font('Helvetica-Bold')
     .text(formData.entreprise || 'Client', PAGE_MARGIN, 220, { width: 440 });
  doc.fontSize(14).fillColor('#C8C8C8').font('Helvetica')
     .text(`${formData.secteur || ''} · ${formData.zone || ''}`,
           PAGE_MARGIN, 282, { width: 440 });

  doc.rect(PAGE_MARGIN, 320, 80, 3).fill(ACCENT);

  // Score global hero
  let scoreY = 360;
  doc.fontSize(9).fillColor(ACCENT).font('Helvetica-Bold')
     .text('SCORE GLOBAL', PAGE_MARGIN, scoreY);
  const sg = auditJson.score_global_client || 0;
  doc.fontSize(72).fillColor(scoreColor(sg)).font('Helvetica-Bold')
     .text(`${sg}`, PAGE_MARGIN, scoreY + 12, { width: 200 });
  doc.fontSize(20).fillColor('#A8A8A8').font('Helvetica')
     .text(`/100  ·  ${scoreLabel(sg)}`, PAGE_MARGIN + 90, scoreY + 50, { lineBreak: false });

  // Date
  scoreY += 130;
  doc.fontSize(9).fillColor(ACCENT).font('Helvetica-Bold')
     .text('DATE DE L\'AUDIT', PAGE_MARGIN, scoreY);
  doc.fontSize(13).fillColor('#FFFFFF').font('Helvetica')
     .text(new Date().toLocaleDateString('fr-FR', {
       day: 'numeric', month: 'long', year: 'numeric',
     }), PAGE_MARGIN, scoreY + 12);

  doc.fontSize(8).fillColor('#888888').font('Helvetica')
     .text('Méthodologie 100% vérifiable · Sources publiquement observables · Aucune extrapolation',
           PAGE_MARGIN, doc.page.height - 110,
           { width: doc.page.width - PAGE_MARGIN * 2, lineGap: 2 });
  doc.fontSize(8).fillColor('#888888')
     .text('Confidentiel · Document à usage exclusif du client',
           PAGE_MARGIN, doc.page.height - 50);
  doc.text('digitallis.fr',
           doc.page.width - PAGE_MARGIN - 100, doc.page.height - 50,
           { width: 100, align: 'right' });

  // ─── PAGE 2 : SYNTHÈSE EXÉCUTIVE ───
  doc.addPage();
  sectionTitle(doc, 1, 'Synthèse exécutive');
  bodyText(doc, auditJson.synthese_executive || 'Synthèse non disponible.');

  // ─── PAGE 3 : PROFIL & SCOPE ───
  doc.addPage();
  sectionTitle(doc, 2, 'Profil de référence & scope');
  kvRow(doc, 'Entreprise', formData.entreprise);
  kvRow(doc, 'Secteur', formData.secteur);
  kvRow(doc, 'Zone de chalandise', formData.zone);
  kvRow(doc, 'Site web', formData.siteWeb);
  kvRow(doc, 'Effectif', formData.effectif);
  kvRow(doc, 'Type clientèle', formData.typeClientele);
  kvRow(doc, 'Frein principal', formData.frein);
  kvRow(doc, 'SCOPE retenu', auditJson.scope ? auditJson.scope.retenu : '—');

  doc.moveDown(0.5);
  if (auditJson.scope && auditJson.scope.justification) {
    calloutBox(doc, 'Justification du scope', auditJson.scope.justification, ACCENT_DK);
  }

  // ─── PAGE 4 : CONCURRENTS ───
  doc.addPage();
  sectionTitle(doc, 3, 'Panel concurrentiel validé');
  bodyText(doc, `${(auditJson.concurrents || []).length} concurrents directs identifiés, scorés sur leur similarité avec votre activité.`);
  doc.moveDown(0.4);

  (auditJson.concurrents || []).forEach((c, i) => {
    const y = doc.y;
    doc.rect(PAGE_MARGIN, y, 4, 60).fill(ACCENT);
    doc.fontSize(12).fillColor(INK).font('Helvetica-Bold')
       .text(`${i + 1}. ${c.nom || '—'}`, PAGE_MARGIN + 12, y, { lineBreak: false });
    doc.fontSize(10).fillColor(ACCENT_DK).font('Helvetica-Bold')
       .text(`${c.score_similarite || 0}/100`, doc.page.width - PAGE_MARGIN - 60, y,
             { width: 60, lineBreak: false, align: 'right' });
    doc.fontSize(9).fillColor(MUTED).font('Helvetica')
       .text(`${c.url || ''} · ${c.localisation || ''}`, PAGE_MARGIN + 12, y + 16);
    doc.fontSize(9).fillColor(INK_SOFT).font('Helvetica')
       .text(c.justification || '', PAGE_MARGIN + 12, y + 30,
             { width: doc.page.width - PAGE_MARGIN * 2 - 14, height: 30 });
    doc.y = y + 68;
  });

  // ─── PAGES 5-6 : AUDIT CLIENT — 7 canaux ───
  doc.addPage();
  sectionTitle(doc, 4, `Audit ${formData.entreprise || 'client'} — 7 canaux`);

  // Vue d'ensemble : barres
  doc.fontSize(11).fillColor(INK).font('Helvetica-Bold')
     .text('Vue d\'ensemble', { paragraphGap: 8 });
  const ac = auditJson.audit_client || {};
  const canaux = [
    ['Site Internet', ac.site_internet],
    ['SEO local & technique', ac.seo],
    ['Référencement LLM / GEO', ac.llm_geo],
    ['Publicité digitale (SEA / Social Ads)', ac.sea_ads],
    ['Réseaux sociaux', ac.reseaux_sociaux],
    ['E-réputation', ac.ereputation],
    ['Google Business & Notoriété', ac.gbp_notoriete],
  ];
  canaux.forEach(([label, c]) => {
    if (c && typeof c.score === 'number') scoreBar(doc, label, c.score);
  });
  doc.moveDown(0.5);

  // Détail par canal
  canaux.forEach(([label, c], i) => {
    if (!c) return;
    if (i > 0 && doc.y > doc.page.height - 240) doc.addPage();
    canalCard(doc, label, c.score || 0, c.points_forts, c.axes_amelioration);
  });

  // ─── PAGE 7 : COMPARATIF ───
  doc.addPage();
  sectionTitle(doc, 5, 'Analyse comparative');
  bodyText(doc, 'Comparaison canal par canal entre vous et le panel concurrentiel validé.');
  doc.moveDown(0.4);

  // Table comparative
  const concs = auditJson.audit_concurrents || [];
  const tableRows = [
    ['Canal', formData.entreprise || 'Vous', ...concs.map(c => c.nom || '—')],
    ['Site', ac.site_internet?.score || '—', ...concs.map(c => (c.scores && c.scores.site) || '—')],
    ['SEO', ac.seo?.score || '—', ...concs.map(c => (c.scores && c.scores.seo) || '—')],
    ['LLM/GEO', ac.llm_geo?.score || '—', ...concs.map(c => (c.scores && c.scores.llm_geo) || '—')],
    ['SEA/Ads', ac.sea_ads?.score || '—', ...concs.map(c => (c.scores && c.scores.sea_ads) || '—')],
    ['Social', ac.reseaux_sociaux?.score || '—', ...concs.map(c => (c.scores && c.scores.reseaux_sociaux) || '—')],
    ['E-rép.', ac.ereputation?.score || '—', ...concs.map(c => (c.scores && c.scores.ereputation) || '—')],
    ['GBP', ac.gbp_notoriete?.score || '—', ...concs.map(c => (c.scores && c.scores.gbp_notoriete) || '—')],
    ['GLOBAL', auditJson.score_global_client || '—', ...concs.map(c => c.score_global || '—')],
  ];
  const numCols = tableRows[0].length;
  const tableW = doc.page.width - PAGE_MARGIN * 2;
  const colW = tableW / numCols;
  let yTable = doc.y;
  tableRows.forEach((row, rowIdx) => {
    const isHeader = rowIdx === 0;
    const isGlobal = rowIdx === tableRows.length - 1;
    if (isHeader) {
      doc.rect(PAGE_MARGIN, yTable, tableW, 20).fillColor(INK).fill();
    } else if (isGlobal) {
      doc.rect(PAGE_MARGIN, yTable, tableW, 20).fillColor(CR_DEEP).fill();
    }
    row.forEach((cell, colIdx) => {
      const x = PAGE_MARGIN + colW * colIdx;
      doc.fontSize(9).font(isHeader || isGlobal ? 'Helvetica-Bold' : 'Helvetica')
         .fillColor(isHeader ? '#FFFFFF' : INK)
         .text(String(cell), x + 4, yTable + 6, { width: colW - 8, lineBreak: false, align: colIdx === 0 ? 'left' : 'center' });
    });
    yTable += 20;
    doc.moveTo(PAGE_MARGIN, yTable).lineTo(PAGE_MARGIN + tableW, yTable)
       .lineWidth(0.3).strokeColor(BORDER).stroke();
  });
  doc.y = yTable + 12;

  // Écarts majeurs
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor(INK).font('Helvetica-Bold')
     .text('Écarts majeurs identifiés', { paragraphGap: 8 });
  (auditJson.ecarts_majeurs || []).forEach((e) => {
    const y = doc.y;
    const crit = e.criticite === 'Critique' ? DANGER : (e.criticite === 'Significatif' ? ORANGE : SUCCESS);
    doc.rect(PAGE_MARGIN, y, 4, 28).fill(crit);
    doc.fontSize(10).fillColor(INK).font('Helvetica-Bold')
       .text(e.canal || '—', PAGE_MARGIN + 12, y + 4, { width: 180, lineBreak: false });
    doc.fontSize(10).fillColor(crit).font('Helvetica-Bold')
       .text(`${e.ecart > 0 ? '+' : ''}${e.ecart} pts`, PAGE_MARGIN + 200, y + 4, { width: 80, lineBreak: false });
    doc.fontSize(9).fillColor(MUTED).font('Helvetica')
       .text(`Vous : ${e.client} · Meilleur : ${e.meilleur} · ${e.criticite || ''}`,
             PAGE_MARGIN + 280, y + 5, { lineBreak: false });
    doc.y = y + 34;
  });

  // ─── PAGE 8 : OPPORTUNITÉS ───
  doc.addPage();
  sectionTitle(doc, 6, 'Opportunités prioritaires');
  bulletList(doc, auditJson.opportunites || [], ACCENT_DK);

  doc.moveDown(0.5);
  doc.fontSize(13).fillColor(INK).font('Helvetica-Bold')
     .text('Mapping opportunité → offre Digitallis', { paragraphGap: 8 });
  (auditJson.offres_digitallis || []).forEach((off, i) => {
    if (doc.y > doc.page.height - 100) doc.addPage();
    const y = doc.y;
    doc.rect(PAGE_MARGIN, y, 4, 56).fill(ACCENT);
    doc.fontSize(10).fillColor(INK).font('Helvetica-Bold')
       .text(`${i + 1}. ${off.opportunite || '—'}`, PAGE_MARGIN + 12, y,
             { width: doc.page.width - PAGE_MARGIN * 2 - 14 });
    doc.fontSize(9).fillColor(ACCENT_DK).font('Helvetica-Bold')
       .text(`Offre : ${off.offre || '—'}`, PAGE_MARGIN + 12, doc.y + 2,
             { width: doc.page.width - PAGE_MARGIN * 2 - 14 });
    doc.fontSize(9).fillColor(MUTED).font('Helvetica-Oblique')
       .text(`Impact attendu : ${off.impact_attendu || '—'}`, PAGE_MARGIN + 12, doc.y + 2,
             { width: doc.page.width - PAGE_MARGIN * 2 - 14 });
    doc.moveDown(0.6);
  });

  // ─── PAGE 9 : PLAN D'ACTIONS ───
  doc.addPage();
  sectionTitle(doc, 7, "Plan d'actions priorisé");
  const plan = auditJson.plan_actions || {};
  if (plan.quick_wins_0_30j && plan.quick_wins_0_30j.length) {
    phaseBlock(doc, '🚀', 'QUICK WINS', '0 — 30 jours · Pack démarrage',
      plan.quick_wins_0_30j, ACCENT_DK);
    doc.moveDown(0.4);
  }
  if (plan.developpement_1_3m && plan.developpement_1_3m.length) {
    phaseBlock(doc, '📈', 'DÉVELOPPEMENT', '1 — 3 mois · Pack croissance',
      plan.developpement_1_3m, '#0A66C2');
    doc.moveDown(0.4);
  }
  if (plan.croissance_3_6m && plan.croissance_3_6m.length) {
    phaseBlock(doc, '🏆', 'CROISSANCE', '3 — 6 mois · Pack domination',
      plan.croissance_3_6m, SUCCESS);
  }

  // ─── PAGE 10 : APPRENTISSAGES + CTA ───
  doc.addPage();
  sectionTitle(doc, 8, 'Apprentissages clés');
  bulletList(doc, auditJson.apprentissages_cles || [], ACCENT_DK);

  doc.moveDown(1);
  const cta_y = doc.y;
  doc.rect(PAGE_MARGIN, cta_y, doc.page.width - PAGE_MARGIN * 2, 130).fill(INK);
  doc.fontSize(16).fillColor('#FFFFFF').font('Helvetica-Bold')
     .text('Prêt à structurer votre acquisition ?', PAGE_MARGIN + 20, cta_y + 20,
           { width: doc.page.width - PAGE_MARGIN * 2 - 40 });
  doc.fontSize(10).fillColor('#A8A8A8').font('Helvetica')
     .text("Digitallis construit des écosystèmes digitaux intelligents pour les entrepreneurs ambitieux des Antilles-Guyane. Approche recommandée : commencer par les Quick Wins (30 jours) pour démontrer la mécanique, puis upsell progressif vers le système complet.",
           PAGE_MARGIN + 20, cta_y + 50,
           { width: doc.page.width - PAGE_MARGIN * 2 - 40, lineGap: 2 });
  doc.fontSize(10).fillColor(ACCENT).font('Helvetica-Bold')
     .text('contact@digitallis.fr  ·  +590 602 18 20 20  ·  digitallis.fr',
           PAGE_MARGIN + 20, cta_y + 100,
           { width: doc.page.width - PAGE_MARGIN * 2 - 40 });

  drawHeader(doc, 1);
  drawFooter(doc);
  doc.end();
  return bufPromise;
}

/**
 * Génère le Markdown complet (pour lisibilité et archivage).
 */
function generateFullAuditMarkdown(formData, auditJson) {
  const date = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const ac = auditJson.audit_client || {};
  const concs = auditJson.audit_concurrents || [];

  // Helper : afficher score ou "NON NOTÉ"
  const fmt = (v) => (v === null || v === undefined) ? 'NON NOTÉ' : String(v);
  const fmtScore = (v) => (v === null || v === undefined) ? 'NON NOTÉ' : `${v}/100`;

  const canalMd = (label, c) => {
    if (!c) return `### ${label} — NON NOTÉ\n\n_Donnée non observable publiquement._\n`;
    const scoreDisplay = fmtScore(c.score);
    const statut = c.statut_preuve ? `\n**Statut de preuve :** ${c.statut_preuve}` : '';
    const fiab = c.fiabilite ? `\n**Fiabilité :** ${c.fiabilite}` : '';
    const observed = (c.donnees_observees && c.donnees_observees.length) ? `\n**Données observées :**\n${c.donnees_observees.map(d => `- ${d}`).join('\n')}` : '';
    const notVerif = (c.donnees_non_verifiables && c.donnees_non_verifiables.length) ? `\n**Données non vérifiables publiquement :**\n${c.donnees_non_verifiables.map(d => `- ${d}`).join('\n')}` : '';
    const forts = (c.points_forts && c.points_forts.length) ? `\n**Points forts**\n${c.points_forts.map(p => `- ✓ ${p}`).join('\n')}` : '';
    const axes = (c.axes_amelioration && c.axes_amelioration.length) ? `\n**Axes d'amélioration**\n${c.axes_amelioration.map(a => `- ✗ ${a}`).join('\n')}` : '';
    return `### ${label} — ${scoreDisplay}${statut}${fiab}${observed}${notVerif}${forts}${axes}\n`;
  };

  return `# Audit Concurrentiel Complet — ${formData.entreprise || 'Client'}

**Secteur :** ${formData.secteur || '—'}
**Zone :** ${formData.zone || '—'}
**Date :** ${date}
**Score global :** **${fmtScore(auditJson.score_global_client)}**

> ⚠ **Méthodologie zéro fiction.** Cet audit ne note que les données strictement observables publiquement (HTML du site, SERP Google, profils sociaux publics). Les canaux marqués NON NOTÉ correspondent à des éléments non vérifiables sans accès aux comptes du client ou outils premium.

---

## Synthèse exécutive

${auditJson.synthese_executive || '_(non disponible)_'}

---

## 1. Profil & scope

| Champ | Valeur |
|---|---|
| Entreprise | ${formData.entreprise || '—'} |
| Secteur | ${formData.secteur || '—'} |
| Zone | ${formData.zone || '—'} |
| Site web | ${formData.siteWeb || '—'} |
| Effectif | ${formData.effectif || '—'} |
| Type clientèle | ${formData.typeClientele || '—'} |
| Frein principal | ${formData.frein || '—'} |
| Attentes | ${formData.attente || '—'} |
| **SCOPE retenu** | **${auditJson.scope ? auditJson.scope.retenu : '—'}** |

**Justification du scope :** ${auditJson.scope ? auditJson.scope.justification : '—'}

---

## 2. Panel concurrentiel

${(auditJson.concurrents || []).map((c, i) => `${i + 1}. **${c.nom}** (${c.score_similarite}/100)
   - URL : ${c.url || '—'} · Localisation : ${c.localisation || '—'}
   - ${c.justification || ''}`).join('\n\n')}

---

## 3. Audit ${formData.entreprise || 'client'} — 7 canaux

${canalMd('Site Internet', ac.site_internet)}
${canalMd('SEO local & technique', ac.seo)}
${canalMd('Référencement LLM / GEO', ac.llm_geo)}
${canalMd('Publicité digitale (SEA / Social Ads)', ac.sea_ads)}
${canalMd('Réseaux sociaux', ac.reseaux_sociaux)}
${canalMd('E-réputation', ac.ereputation)}
${canalMd('Google Business & Notoriété', ac.gbp_notoriete)}

**SCORE GLOBAL : ${fmtScore(auditJson.score_global_client)}**

---

## 4. Analyse comparative

| Canal | ${formData.entreprise || 'Vous'} | ${concs.map(c => c.nom).join(' | ')} |
|---|${'---|'.repeat(1 + concs.length)}
| Site | ${fmt(ac.site_internet?.score)} | ${concs.map(c => fmt(c.scores?.site)).join(' | ')} |
| SEO | ${fmt(ac.seo?.score)} | ${concs.map(c => fmt(c.scores?.seo)).join(' | ')} |
| LLM/GEO | ${fmt(ac.llm_geo?.score)} | ${concs.map(c => fmt(c.scores?.llm_geo)).join(' | ')} |
| SEA/Ads | ${fmt(ac.sea_ads?.score)} | ${concs.map(c => fmt(c.scores?.sea_ads)).join(' | ')} |
| Social | ${fmt(ac.reseaux_sociaux?.score)} | ${concs.map(c => fmt(c.scores?.reseaux_sociaux)).join(' | ')} |
| E-rép. | ${fmt(ac.ereputation?.score)} | ${concs.map(c => fmt(c.scores?.ereputation)).join(' | ')} |
| GBP | ${fmt(ac.gbp_notoriete?.score)} | ${concs.map(c => fmt(c.scores?.gbp_notoriete)).join(' | ')} |
| **GLOBAL** | **${fmt(auditJson.score_global_client)}** | ${concs.map(c => `**${fmt(c.score_global)}**`).join(' | ')} |

### Écarts majeurs
${(auditJson.ecarts_majeurs || []).map(e => `- **${e.canal}** : ${e.ecart} pts (${e.criticite}) — Vous ${e.client} vs Meilleur ${e.meilleur}`).join('\n')}

---

## 5. Opportunités prioritaires

${(auditJson.opportunites || []).map(o => `- ${o}`).join('\n')}

### Mapping opportunité → offre Digitallis

${(auditJson.offres_digitallis || []).map((o, i) => `**${i + 1}. ${o.opportunite}**
- **Offre :** ${o.offre}
- **Impact attendu :** ${o.impact_attendu}`).join('\n\n')}

---

## 6. Plan d'actions

### 🚀 Quick Wins (0–30 jours)
${(auditJson.plan_actions?.quick_wins_0_30j || []).map(a => `- **${a.action}** → ${a.offre_digitallis} _(${a.impact})_`).join('\n')}

### 📈 Développement (1–3 mois)
${(auditJson.plan_actions?.developpement_1_3m || []).map(a => `- **${a.action}** → ${a.offre_digitallis} _(${a.impact})_`).join('\n')}

### 🏆 Croissance (3–6 mois)
${(auditJson.plan_actions?.croissance_3_6m || []).map(a => `- **${a.action}** → ${a.offre_digitallis} _(${a.impact})_`).join('\n')}

---

## 7. Apprentissages clés

${(auditJson.apprentissages_cles || []).map(a => `- ${a}`).join('\n')}

---

*Audit produit par Digitallis · Méthodologie 100% vérifiable · ${date}*
`;
}

module.exports = { generateFullAuditPdf, generateFullAuditMarkdown };
