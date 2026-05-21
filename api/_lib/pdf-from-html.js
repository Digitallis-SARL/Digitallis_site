/**
 * Génération de PDF depuis HTML via Puppeteer + @sparticuz/chromium-min
 *
 * Stratégie : chromium-min ne contient pas le binaire Chromium (sinon dépasse 50MB Vercel).
 * Au runtime, on télécharge le pack chromium depuis un CDN (cache après 1er warm-up).
 *
 * Fonctionnement local : si CHROME_PATH est défini, on utilise un Chrome local.
 * Sinon, on télécharge la version compatible.
 *
 * Variables d'env :
 *   CHROMIUM_PACK_URL  (optionnel) URL d'un pack chromium précompilé pour Vercel
 *                       défaut : https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar
 *   CHROME_PATH        (optionnel, dev local) chemin vers Chrome/Chromium local
 */

const CHROMIUM_PACK_URL = process.env.CHROMIUM_PACK_URL
  || 'https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar';

let _browserPromise = null;

async function getBrowser() {
  if (_browserPromise) return _browserPromise;

  _browserPromise = (async () => {
    const puppeteer = require('puppeteer-core');
    const isLocal = !!process.env.CHROME_PATH;

    let launchOptions;
    if (isLocal) {
      // Dev local : utilise le Chrome de la machine
      launchOptions = {
        executablePath: process.env.CHROME_PATH,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      };
    } else {
      // Vercel serverless : utilise chromium-min + pack URL
      const chromium = require('@sparticuz/chromium-min');
      launchOptions = {
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(CHROMIUM_PACK_URL),
        headless: chromium.headless,
      };
    }

    return puppeteer.launch(launchOptions);
  })();

  return _browserPromise;
}

/**
 * Rend un HTML en PDF format A4 paysage.
 *
 * Stratégie : on charge le HTML, on attend le rendu des polices et particules,
 * puis on imprime avec backgrounds pour préserver les gradients.
 *
 * @param {string} html - HTML complet (avec @media print déjà géré)
 * @returns {Promise<Buffer>} - PDF binaire
 */
async function htmlToPdf(html) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(html, {
      waitUntil: ['networkidle0', 'domcontentloaded'],
      timeout: 30000,
    });

    // Force le @media print pour que toutes les slides se rendent en pages
    await page.emulateMediaType('print');

    // Donne un peu de temps aux fonts custom (Archivo Black, DM Sans) à se charger
    await new Promise(r => setTimeout(r, 1500));

    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      preferCSSPageSize: true,
    });

    return pdf;
  } finally {
    await page.close();
    // On garde le browser ouvert pour les prochains audits du même cold start
  }
}

/**
 * Cleanup explicite (utile en fin de cron).
 */
async function closeBrowser() {
  if (!_browserPromise) return;
  try {
    const browser = await _browserPromise;
    await browser.close();
  } catch {}
  _browserPromise = null;
}

module.exports = { htmlToPdf, closeBrowser };
