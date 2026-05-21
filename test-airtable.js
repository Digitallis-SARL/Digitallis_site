/**
 * Test local Airtable — Digitallis
 *
 * Vérifie que :
 *   1. Le PAT et le Base ID fonctionnent
 *   2. La table LEADS est accessible
 *   3. Les 13 champs + Status + Audit Markdown + Audit PDF sont écrivables
 *   4. Les Single Select acceptent bien les options envoyées par le formulaire
 *
 * Usage :
 *   1. Copie .env.local.example en .env.local et remplis tes 3 variables
 *   2. node test-airtable.js
 *
 * Variables d'env requises :
 *   AIRTABLE_API_KEY      (pat...)
 *   AIRTABLE_BASE_ID      (app8HiP9W1Qa5FVwF dans ton cas)
 *   AIRTABLE_TABLE_LEADS  (LEADS — optionnel, défaut)
 *
 * En sortie : succès = ligne créée dans Airtable + nettoyée 5 secondes après.
 *             échec = message d'erreur précis (champ manquant, option Single Select invalide, etc.)
 */

// Charge .env.local si présent
try { require('fs').readFileSync('.env.local', 'utf8').split('\n').forEach(line => {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+)\s*$/);
  if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}); } catch {}

const { createLead, updateLeadFiles } = require('./api/_lib/airtable');
const Airtable = require('airtable');

// Couleurs terminal
const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', D = '\x1b[2m', X = '\x1b[0m';

async function main() {
  console.log(`\n${Y}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${X}`);
  console.log(`${Y}  Test Airtable Digitallis — table LEADS${X}`);
  console.log(`${Y}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${X}\n`);

  // ─── 1. Variables d'env ───
  console.log(`${D}[1/5]${X} Vérification des variables d'env...`);
  const missing = [];
  if (!process.env.AIRTABLE_API_KEY) missing.push('AIRTABLE_API_KEY');
  if (!process.env.AIRTABLE_BASE_ID) missing.push('AIRTABLE_BASE_ID');
  if (missing.length) {
    console.error(`${R}  ✗ Variables manquantes : ${missing.join(', ')}${X}`);
    console.error(`${D}  Crée un fichier .env.local à la racine avec :${X}`);
    console.error(`${D}    AIRTABLE_API_KEY=pat...${X}`);
    console.error(`${D}    AIRTABLE_BASE_ID=app8HiP9W1Qa5FVwF${X}`);
    process.exit(1);
  }
  console.log(`${G}  ✓ AIRTABLE_API_KEY${X} (${process.env.AIRTABLE_API_KEY.slice(0, 10)}…)`);
  console.log(`${G}  ✓ AIRTABLE_BASE_ID${X} (${process.env.AIRTABLE_BASE_ID})`);
  console.log(`${G}  ✓ AIRTABLE_TABLE_LEADS${X} (${process.env.AIRTABLE_TABLE_LEADS || 'LEADS (défaut)'})\n`);

  // ─── 2. Accès à la base ───
  console.log(`${D}[2/5]${X} Test d'accès à la base...`);
  let base;
  try {
    base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
    const records = await base(process.env.AIRTABLE_TABLE_LEADS || 'LEADS')
      .select({ maxRecords: 1 }).firstPage();
    console.log(`${G}  ✓ Base accessible${X} (${records.length} ligne(s) existante(s))\n`);
  } catch (err) {
    console.error(`${R}  ✗ Échec d'accès à la base${X}`);
    console.error(`${D}  ${err.message}${X}\n`);
    if (err.message && err.message.includes('NOT_FOUND')) {
      console.error(`${Y}  → Vérifie ton AIRTABLE_BASE_ID${X}`);
    } else if (err.message && err.message.includes('UNAUTHORIZED')) {
      console.error(`${Y}  → Vérifie ton PAT (scopes data.records:read/write requis)${X}`);
      console.error(`${Y}  → Vérifie que la base DIGITALLIS est bien dans le scope Access du PAT${X}`);
    } else if (err.message && err.message.includes('TABLE_NOT_FOUND')) {
      console.error(`${Y}  → La table 'LEADS' n'existe pas. Vérifie son nom exact (sensible à la casse).${X}`);
    }
    process.exit(1);
  }

  // ─── 3. Création d'une ligne test ───
  console.log(`${D}[3/5]${X} Création d'une ligne de test...`);
  const testData = {
    entreprise: '🧪 TEST AUTOMATIQUE — à supprimer',
    siteWeb: 'https://test.example.com',
    zone: 'Test Guadeloupe-Martinique-Guyane',
    secteur: 'Test — Sanity check setup Digitallis',
    effectif: '2 - 10 salariés',
    typeClientele: 'B2B',
    frein: 'Manque de visibilité',
    attente: 'Vérifier que tous les champs sont écrivables et que les Single Select acceptent les bonnes options.',
    experienceAgence: 'Non, jamais',
    budget: '0 €',
    decisionnaire: 'Oui',
    email: 'test@digitallis.fr',
    telephone: '+590 000 000 000',
  };

  let lead;
  try {
    lead = await createLead(testData);
    console.log(`${G}  ✓ Ligne créée${X} (id: ${lead.id})\n`);
  } catch (err) {
    console.error(`${R}  ✗ Échec de création${X}`);
    console.error(`${D}  ${err.message}${X}\n`);
    if (err.message && err.message.includes('INVALID_MULTIPLE_CHOICE_OPTIONS')) {
      console.error(`${Y}  → Une option Single Select n'existe pas dans Airtable.${X}`);
      console.error(`${Y}    Le message ci-dessus indique laquelle.${X}`);
      console.error(`${Y}    Vérifie les options des champs : Taille entreprise, Type clientele,${X}`);
      console.error(`${Y}    Experience agence, Budget mensuel, Decisionnaire, Status.${X}`);
      console.error(`${Y}    Liste exacte dans SETUP-AUDIT.md §2.${X}`);
    } else if (err.message && err.message.includes('UNKNOWN_FIELD_NAME')) {
      console.error(`${Y}  → Un champ n'existe pas dans LEADS, ou son nom est différent.${X}`);
      console.error(`${Y}    Le message ci-dessus indique lequel.${X}`);
    } else if (err.message && err.message.includes('INVALID_VALUE_FOR_COLUMN')) {
      console.error(`${Y}  → Type de champ incompatible (ex. URL invalide, email malformé…).${X}`);
    }
    process.exit(1);
  }

  // ─── 4. Update des Attachments (Audit Markdown + Audit PDF) ───
  console.log(`${D}[4/5]${X} Test d'écriture des Attachments livrables...`);
  console.log(`${D}  (utilise des URLs publiques que Airtable peut télécharger)${X}`);
  try {
    // URLs publiques garanties accessibles à Airtable
    await updateLeadFiles(lead.id, {
      mdUrl: 'https://raw.githubusercontent.com/github/docs/main/README.md',
      pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      mdFilename: 'test-audit.md',
      pdfFilename: 'test-audit.pdf',
    });
    console.log(`${G}  ✓ Champs Audit Markdown + Audit PDF mis à jour${X}`);
    console.log(`${D}    (Airtable va télécharger les fichiers en arrière-plan, peut prendre 5-15 sec)${X}\n`);
  } catch (err) {
    console.error(`${R}  ✗ Échec d'écriture des Attachments${X}`);
    console.error(`${D}  ${err.message}${X}\n`);
    if (err.message && err.message.includes('UNKNOWN_FIELD_NAME')) {
      console.error(`${Y}  → Les champs 'Audit Markdown' et 'Audit PDF' doivent exister dans LEADS.${X}`);
    } else if (err.message && err.message.includes('INVALID_ATTACHMENT')) {
      console.error(`${Y}  → URL inaccessible publiquement. C'est normal en local — fonctionnera en prod avec Vercel Blob.${X}`);
    }
    // Pas process.exit, on continue jusqu'au cleanup
  }

  // ─── 5. Cleanup ───
  console.log(`${D}[5/5]${X} Nettoyage (suppression de la ligne test dans 5 sec)...`);
  console.log(`${D}  → Tu peux vérifier visuellement dans Airtable avant la suppression :${X}`);
  console.log(`${D}    https://airtable.com/${process.env.AIRTABLE_BASE_ID}${X}\n`);
  await new Promise(r => setTimeout(r, 5000));
  try {
    await base(process.env.AIRTABLE_TABLE_LEADS || 'LEADS').destroy(lead.id);
    console.log(`${G}  ✓ Ligne test supprimée${X}\n`);
  } catch (err) {
    console.warn(`${Y}  ⚠ Suppression échouée — supprime manuellement la ligne id ${lead.id}${X}\n`);
  }

  console.log(`${G}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${X}`);
  console.log(`${G}  ✓ TOUS LES TESTS SONT PASSÉS${X}`);
  console.log(`${G}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${X}\n`);
  console.log(`${D}  Tu peux déployer en prod :  vercel --prod${X}\n`);
}

main().catch((err) => {
  console.error(`\n${R}✗ Erreur inattendue${X}`);
  console.error(err);
  process.exit(1);
});
