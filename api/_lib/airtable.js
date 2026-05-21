/**
 * Module Airtable — Digitallis
 *
 * Base : "DIGITALLIS"
 * Table unique : "LEADS"
 *
 * Schéma de la table LEADS (16 champs) :
 *   - Entreprise          [Single line text]
 *   - Site web            [URL]
 *   - Zone de chalandise  [Single line text]
 *   - Secteur             [Single line text]
 *   - Taille entreprise   [Single select]   1 (solo) / 2 à 4 / 5 à 10 / 11 à 25 / 26 à 50 / 50+
 *   - Type clientele      [Single select]   B2C local / B2C destination / B2B pur / Mix B2C+B2B / E-commerce / Service en ligne
 *   - Frein principal     [Long text]
 *   - Attente             [Long text]       Réponse à "Qu'attendez-vous de cet audit ?"
 *   - Experience agence   [Single select]   Jamais / Une fois / Plusieurs fois
 *   - Budget mensuel      [Single select]   Pas défini / <2k / 2-5k / 5-10k / >10k / One-shot
 *   - Decisionnaire       [Single select]   Oui unique / Oui co / Non consulte / Non
 *   - Email               [Email]
 *   - Telephone           [Phone]
 *   - Status              [Single select]   Reçu / En traitement / Livré / Archivé
 *   - Audit Markdown      [URL]             rempli automatiquement après génération
 *   - Audit PDF           [URL]             rempli automatiquement après génération
 *
 * Variables d'env :
 *   AIRTABLE_API_KEY      Personal Access Token (scope data.records:read/write)
 *   AIRTABLE_BASE_ID      "app..."
 *   AIRTABLE_TABLE_LEADS  (défaut: "LEADS")
 */

const Airtable = require('airtable');

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TABLE_LEADS = process.env.AIRTABLE_TABLE_LEADS || 'LEADS';

let _base = null;
function getBase() {
  if (_base) return _base;
  if (!API_KEY || !BASE_ID) {
    throw new Error('Airtable env vars missing (AIRTABLE_API_KEY, AIRTABLE_BASE_ID)');
  }
  _base = new Airtable({ apiKey: API_KEY }).base(BASE_ID);
  return _base;
}

/**
 * Mappe les données du formulaire vers les champs Airtable.
 * Les noms de champs doivent correspondre EXACTEMENT à la base Airtable.
 *
 * Schéma vérifié de LEADS (au 2026-05-13) :
 *   Entreprise          [singleLineText]
 *   Site web            [url]
 *   Zone de chalandise  [singleLineText]
 *   Secteur             [multilineText]
 *   Taille entreprise   [singleSelect]  Indépendant / TPE · 2 - 10 salariés · 11 - 50 salariés · 50+
 *   Type clientele      [singleSelect]  B2C · B2B · Mix B2B / B2C
 *   Frein principal     [singleSelect]  Manque de visibilité · Leads insuffisants ou de mauvaise qualité · Difficulté à se différencier · Dépendance au bouche-à-oreille · Autre
 *   Attentes            [multilineText]
 *   Experience agence   [singleSelect]  Oui, avec résultats · Oui, sans résultat · Non, jamais
 *   Budget mensuel      [singleSelect]  0 € · < 500 € · 500 – 1 500 € · 1 500 €+
 *   Decisionnaire       [singleSelect]  Oui · Non
 *   Email               [email]
 *   Telephone           [singleLineText]
 *   Status              [singleSelect]  Lead · Client
 *   Audit Markdown      [multipleAttachments]
 *   Audit PDF           [multipleAttachments]
 */
function mapFormToFields(data) {
  const fields = {};
  if (data.entreprise)        fields['Entreprise']         = data.entreprise;
  if (data.siteWeb)           fields['Site web']           = data.siteWeb;
  if (data.zone)              fields['Zone de chalandise'] = data.zone;
  if (data.secteur)           fields['Secteur']            = data.secteur;
  if (data.effectif)          fields['Taille entreprise']  = data.effectif;
  if (data.typeClientele)     fields['Type clientele']     = data.typeClientele;
  if (data.frein)             fields['Frein principal']    = data.frein;
  if (data.attente)           fields['Attentes']           = data.attente;
  if (data.experienceAgence)  fields['Experience agence']  = data.experienceAgence;
  if (data.budget)            fields['Budget mensuel']     = data.budget;
  if (data.decisionnaire)     fields['Decisionnaire']      = data.decisionnaire;
  if (data.email)             fields['Email']              = data.email;
  if (data.telephone)         fields['Telephone']          = data.telephone;
  return fields;
}

/**
 * Crée une nouvelle ligne LEADS avec les données du formulaire.
 * Statut initial : "Lead".
 * Les fichiers attachés sont upload via updateLeadFiles().
 */
async function createLead(data) {
  const base = getBase();
  const fields = mapFormToFields(data);
  fields['Status'] = 'Lead';

  const created = await base(TABLE_LEADS).create([{ fields }]);
  return created[0];
}

/**
 * Met à jour une ligne LEADS avec les fichiers générés.
 * Les champs Audit Markdown et Audit PDF sont des Attachments :
 * Airtable téléchargera les fichiers depuis l'URL et les attachera à la ligne.
 */
async function updateLeadFiles(recordId, { mdUrl, pdfUrl, mdFilename, pdfFilename }) {
  const base = getBase();
  const fields = {};
  if (mdUrl) {
    fields['Audit Markdown'] = [{ url: mdUrl, filename: mdFilename || 'audit-preliminaire.md' }];
  }
  if (pdfUrl) {
    fields['Audit PDF'] = [{ url: pdfUrl, filename: pdfFilename || 'audit-preliminaire.pdf' }];
  }
  if (Object.keys(fields).length === 0) return null;
  return base(TABLE_LEADS).update(recordId, fields);
}

/**
 * Met à jour le statut d'un lead. Pratique pour l'orchestrateur IA async.
 */
async function updateLeadStatus(recordId, status) {
  const base = getBase();
  return base(TABLE_LEADS).update(recordId, { 'Status': status });
}

module.exports = {
  createLead,
  updateLeadFiles,
  updateLeadStatus,
};
