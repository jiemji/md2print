/**
 * @module themeCssEngine
 * @description Moteur léger d'extraction et de génération des feuilles de style CSS de thèmes
 * (Vision Rapport et Vision Slide). Séparé de l'interface DOM lourde StyleSettingsManager
 * afin d'être chargé immédiatement au démarrage sans pénaliser le temps d'initialisation.
 *
 * @requires ./defaultThemeStyles.js
 */
import { DEFAULT_REPORT_CSS, DEFAULT_SLIDE_CSS } from './defaultThemeStyles.js';

/**
 * @typedef {Object} StyleHeadingConfig
 * @property {string} font - Nom de la police de caractères
 * @property {string} size - Taille de police CSS (ex: '2.4rem', '1.85rem')
 * @property {string} color - Couleur hexadécimale du texte
 * @property {'none'|'uppercase'|'lowercase'|'capitalize'} transform - Transformation de casse
 * @property {boolean} bold - Indique si le texte est en gras
 * @property {boolean} underline - Indique si le texte est souligné
 */

/**
 * @typedef {Object} StyleBodyConfig
 * @property {string} font - Nom de la police de caractères
 * @property {string} size - Taille de police de base (ex: '1rem', '1.25rem')
 * @property {string} color - Couleur hexadécimale du texte principal
 * @property {string} lineHeight - Hauteur de ligne (ex: '1.55', '1.6')
 * @property {string} spacing - Marge inférieure entre paragraphes (ex: '14px')
 * @property {'left'|'justify'|'center'|'right'} textAlign - Alignement du texte
 */

/**
 * @typedef {Object} SlideBackgroundConfig
 * @property {string} bg - Couleur de fond hexadécimale
 * @property {string} bgImage - Image de fond encodée en data-URL base64 ou URL
 * @property {string} bgImageName - Nom lisible du fichier de l'image de fond
 * @property {number} bgOpacity - Pourcentage d'opacité de l'image de fond (0 à 100)
 * @property {string} [borderTopColor] - Couleur du liseré supérieur (couverture)
 * @property {number} [borderTopWidth] - Épaisseur en pixels du liseré supérieur (couverture)
 * @property {string} [borderLeftColor] - Couleur du liseré gauche (chapitre)
 * @property {number} [borderLeftWidth] - Épaisseur en pixels du liseré gauche (chapitre)
 */

/**
 * @typedef {Object} SlideContentConfig
 * @property {string} bg - Couleur de fond de la zone principale du slide
 * @property {string} bgImage - Image de fond encodée en data-URL ou URL
 * @property {string} bgImageName - Nom du fichier de l'image de fond
 * @property {number} bgOpacity - Pourcentage d'opacité de l'image de fond (0 à 100)
 * @property {string} headerBg - Couleur de fond du bandeau supérieur (hexadécimal ou 'transparent')
 * @property {string} headerBgImage - Image de fond du bandeau supérieur (data-URL)
 * @property {string} headerBgImageName - Nom du fichier de l'image du bandeau supérieur
 * @property {number} headerBgOpacity - Pourcentage d'opacité de l'image du bandeau (0 à 100)
 * @property {string} borderTopColor - Couleur du liseré supérieur
 * @property {number} borderTopWidth - Épaisseur en pixels du liseré supérieur
 * @property {number|string} paddingX - Marge latérale intérieure gauche et droite en pixels (défaut 56)
 */

/**
 * @typedef {Object} StyleThemeConfig
 * @property {StyleHeadingConfig} hMain - Titre principal de document ou couverture (#)
 * @property {StyleHeadingConfig} h1 - Titre de niveau 1 ou titre de chapitre (##)
 * @property {StyleHeadingConfig} h2 - Titre de niveau 2 ou titre de bandeau slide (###)
 * @property {StyleHeadingConfig} h3 - Titre de niveau 3 (####)
 * @property {StyleHeadingConfig} h4 - Titre de niveau 4 (#####)
 * @property {StyleHeadingConfig} h5 - Titre de niveau 5 (######)
 * @property {StyleBodyConfig} body - Corps de texte principal
 * @property {Object} link - Couleurs des liens (color, hoverColor)
 * @property {Object} metric - Paramètres des blocs chiffres clés ([chiffre:...])
 * @property {Object} chapterTag - Paramètres des étiquettes de chapitre
 * @property {Object} badge - Police et taille générique des badges
 * @property {Object} quote - Paramètres des citations (>)
 * @property {Object} code - Paramètres des blocs et extraits de code
 * @property {Object} table - Couleurs et bordures des tableaux
 * @property {Object} mermaid - Couleurs et bordures des diagrammes Mermaid
 * @property {{ bg: string, border: string, padding: string, radius: string, fontSize?: string }} column - Couleurs, bordures, marges et taille de police des colonnes
 * @property {{ nodeSize: string, nodeFontSize?: string, titleFontSize?: string, descFontSize?: string }} [timeline] - Paramètres des pastilles et polices de la frise chronologique ([frise])
 * @property {SlideBackgroundConfig} [coverSlide] - Spécifique diaporama : slide de couverture
 * @property {SlideBackgroundConfig} [chapterSlide] - Spécifique diaporama : slide de chapitre
 * @property {SlideContentConfig} [contentSlide] - Spécifique diaporama : slide de contenu
 * @property {Object} page - Arrière-plan et bordures de la page ou du canvas
 */

/**
 * Configuration par défaut des styles de balises extraite des chartes Word et PowerPoint.
 * @type {{ report: StyleThemeConfig, slide: StyleThemeConfig }}
 */
export const DEFAULT_STYLE_CONFIG = {
  report: {
    hMain: { font: 'Calibri Light', size: '2.4rem', color: '#C00000', transform: 'none', bold: true, underline: false },
    h1: { font: 'Calibri Light', size: '1.65rem', color: '#C00000', transform: 'none', bold: true, underline: false },
    h2: { font: 'Calibri Light', size: '1.35rem', color: '#2F5496', transform: 'none', bold: true, underline: false },
    h3: { font: 'Calibri Light', size: '1.18rem', color: '#2F5496', transform: 'none', bold: true, underline: false },
    h4: { font: 'Calibri Light', size: '1.05rem', color: '#2F5496', transform: 'none', bold: true, underline: false },
    h5: { font: 'Calibri Light', size: '0.98rem', color: '#2F5496', transform: 'none', bold: true, underline: false },
    body: {
      font: 'Calibri',
      size: '1rem',
      color: '#272727',
      lineHeight: '1.55',
      spacing: '14px',
      textAlign: 'justify',
    },
    link: { color: '#0563C1', hoverColor: '#104a8e' },
    metric: {
      font: 'Calibri Light',
      size: '4.5rem',
      valColor: '#C00000',
      accentColor: '#2F5496',
      labelColor: '#595959',
    },
    chapterTag: { font: 'Calibri Light', size: '0.82rem', color: '#C00000' },
    badge: { font: 'Calibri', size: '0.75rem' },
    badgeInfo: { color: '#2F5496', bg: '#f0f4f9', border: '#2F5496' },
    badgeSuccess: { color: '#3b6321', bg: '#f2f8ee', border: '#70AD47' },
    badgeWarning: { color: '#a44810', bg: '#fdf4ee', border: '#ED7D31' },
    badgeDanger: { color: '#C00000', bg: '#fdf0f0', border: '#C00000' },
    badgeImportant: { color: '#1f568a', bg: '#f1f7fc', border: '#5B9BD5' },
    badgeNeutral: { color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' },
    calloutNote: { border: '#2F5496', bg: '#f0f4f9', title: '#1f3b6c' },
    calloutTip: { border: '#70AD47', bg: '#f2f8ee', title: '#4d7a2f' },
    calloutWarning: { border: '#ED7D31', bg: '#fdf4ee', title: '#ad5319' },
    calloutDanger: { border: '#C00000', bg: '#fdf0f0', title: '#910000' },
    calloutImportant: { border: '#5B9BD5', bg: '#f1f7fc', title: '#2b6da8' },
    quote: { font: 'Calibri', size: '1.05rem', color: '#475569', border: '#2F5496', lineHeight: '1.6' },
    code: {
      font: 'Consolas',
      size: '0.92rem',
      color: '#0f172a',
      bg: '#f8fafc',
      border: '#e2e8f0',
    },
    table: {
      font: 'Calibri',
      size: '0.95rem',
      headerColor: '#ffffff',
      headerBg: '#003366',
      cellColor: '#272727',
      rowAltBg: '#f8fafc',
      border: '#cbd5e1',
    },
    mermaid: {
      preset: 'default',
      bg: '#f8fafc',
      border: '#cbd5e1',
      borderLeft: '#2F5496',
    },
    column: {
      bg: '#f8fafc',
      border: '#cbd5e1',
      padding: '14px',
      radius: '6px',
      fontSize: '0.95rem',
    },
    timeline: {
      nodeSize: '57px',
      nodeFontSize: '0.88rem',
      titleFontSize: '0.95rem',
      descFontSize: '0.82rem',
    },
    coverSlide: { bg: '#ffffff', bgImage: '', bgImageName: '', bgOpacity: 100, borderTopColor: '#C00000', borderTopWidth: 8 },
    chapterSlide: { bg: '#f8fafc', bgImage: '', bgImageName: '', bgOpacity: 100, borderLeftColor: '#C00000', borderLeftWidth: 10 },
    contentSlide: { bg: '#ffffff', bgImage: '', bgImageName: '', bgOpacity: 100, headerBg: '#ffffff', headerBgImage: '', headerBgImageName: '', headerBgOpacity: 100, borderTopColor: '#C00000', borderTopWidth: 6, paddingX: 56 },
    page: { bgBackdrop: '#f1f5f9', bgPaper: '#ffffff', border: '#d1d5db' },
  },
  slide: {
    hMain: { font: 'Aptos Display', size: '2.8rem', color: '#0E2841', transform: 'none', bold: true, underline: false },
    h1: { font: 'Aptos Display', size: '2.3rem', color: '#0E2841', transform: 'none', bold: true, underline: false },
    h2: { font: 'Aptos Display', size: '1.85rem', color: '#0E2841', transform: 'none', bold: true, underline: false },
    h3: { font: 'Aptos Display', size: '1.35rem', color: '#0E2841', transform: 'none', bold: true, underline: false },
    h4: { font: 'Aptos Display', size: '1.15rem', color: '#64748b', transform: 'none', bold: true, underline: false },
    h5: { font: 'Aptos Display', size: '1.05rem', color: '#64748b', transform: 'none', bold: true, underline: false },
    body: {
      font: 'Aptos',
      size: '1.25rem',
      color: '#1e293b',
      lineHeight: '1.6',
      spacing: '10px',
      textAlign: 'left',
    },
    link: { color: '#C41718', hoverColor: '#FBAE40' },
    metric: {
      font: 'Aptos Display',
      size: '5.5rem',
      valColor: '#0E2841',
      accentColor: '#C41718',
      labelColor: '#64748b',
    },
    chapterTag: { font: 'Aptos Display', size: '0.82rem', color: '#C41718' },
    badge: { font: 'Aptos', size: '0.78rem' },
    badgeInfo: { color: '#0E2841', bg: '#f1f4f8', border: '#0E2841' },
    badgeSuccess: { color: '#196B24', bg: '#f0f7f1', border: '#196B24' },
    badgeWarning: { color: '#ad5319', bg: '#fef3ec', border: '#E97132' },
    badgeDanger: { color: '#C41718', bg: '#fdf1f1', border: '#C41718' },
    badgeImportant: { color: '#0F9ED5', bg: '#eef8fc', border: '#0F9ED5' },
    badgeNeutral: { color: '#1e293b', bg: '#f1f5f9', border: '#cbd5e1' },
    calloutNote: { border: '#0E2841', bg: '#f1f4f8', title: '#0E2841' },
    calloutTip: { border: '#196B24', bg: '#f0f7f1', title: '#196B24' },
    calloutWarning: { border: '#E97132', bg: '#fef3ec', title: '#E97132' },
    calloutDanger: { border: '#C41718', bg: '#fdf1f1', title: '#C41718' },
    calloutImportant: { border: '#0F9ED5', bg: '#eef8fc', title: '#0F9ED5' },
    quote: { font: 'Aptos', size: '1.25rem', color: '#1e293b', border: '#0E2841', lineHeight: '1.6' },
    code: {
      font: 'Consolas',
      size: '1.05rem',
      color: '#0E2841',
      bg: '#f8fafc',
      border: '#cbd5e1',
    },
    table: {
      font: 'Aptos',
      size: '0.95rem',
      headerColor: '#ffffff',
      headerBg: '#0E2841',
      cellColor: '#1e293b',
      rowAltBg: '#f8fafc',
      border: '#cbd5e1',
    },
    mermaid: {
      preset: 'default',
      bg: '#f8fafc',
      border: '#cbd5e1',
      borderLeft: '#C41718',
    },
    column: {
      bg: '#ffffff',
      border: '#cbd5e1',
      padding: '14px',
      radius: '6px',
      fontSize: '1rem',
    },
    timeline: {
      nodeSize: '57px',
      nodeFontSize: '0.88rem',
      titleFontSize: '0.95rem',
      descFontSize: '0.82rem',
    },
    coverSlide: { bg: '#ffffff', bgImage: '', bgImageName: '', bgOpacity: 100, borderTopColor: '#C41718', borderTopWidth: 8 },
    chapterSlide: { bg: '#f8fafc', bgImage: '', bgImageName: '', bgOpacity: 100, borderLeftColor: '#C41718', borderLeftWidth: 10 },
    contentSlide: { bg: '#ffffff', bgImage: '', bgImageName: '', bgOpacity: 100, headerBg: '#ffffff', headerBgImage: '', headerBgImageName: '', headerBgOpacity: 100, borderTopColor: '#C41718', borderTopWidth: 6, paddingX: 56 },
    page: { bgBackdrop: '#0b1120', bgPaper: '#ffffff', border: '#cbd5e1' },
  },
};

/**
 * Polices standard recommandées disponibles (systèmes Windows, Office et polices web modernes).
 */
export const FONT_OPTIONS = [
  'Calibri',
  'Calibri Light',
  'Poppins',
  'Aptos',
  'Aptos Display',
  'Segoe UI',
  'Segoe UI Light',
  'Arial',
  'Helvetica',
  'Georgia',
  'Cambria',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
  'Consolas',
  'JetBrains Mono',
  'Courier New',
];

/**
 * Nettoie une chaîne de nom de police (supprime quotes et listes de repli).
 * @param {string} val - Valeur CSS brute contenant un nom de police
 * @returns {string} Nom de police extrait et nettoyé
 */
function cleanFontName(val) {
  if (!val) return '';
  const match = val.match(/['"]?([^'",]+)['"]?/);
  return match ? match[1].trim() : val.trim();
}

/**
 * Normalise une chaîne de couleur hexadécimale ou un mot-clé de transparence.
 * - Convertit les codes hexadécimaux courts (#rgb) en code complet (#rrggbb).
 * - Préserve les codes hexadécimaux valides à 6 caractères (#rrggbb).
 * - Retourne 'transparent' pour les valeurs 'transparent' ou 'none'.
 * - Retourne la chaîne d'origine si le format n'est pas convertible.
 * 
 * @param {string} val - Chaîne de couleur brute (hexadécimale, nom ou rgb)
 * @returns {string} Couleur normalisée en hexadécimal 6 caractères (#rrggbb), 'transparent' ou valeur brute
 */
function normalizeColor(val) {
  if (!val) return '';
  val = val.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(val)) return val;
  if (/^#[0-9A-Fa-f]{3}$/.test(val)) {
    return `#${val[1]}${val[1]}${val[2]}${val[2]}${val[3]}${val[3]}`;
  }
  if (val.toLowerCase() === 'transparent' || val.toLowerCase() === 'none') {
    return 'transparent';
  }
  return val;
}

/**
 * Restaure les Data-URLs d'images de fond des diapositives directement depuis les règles CSS ::after
 * lorsqu'elles ne sont pas dupliquées dans l'en-tête JSON [md2print-config].
 *
 * @param {string} css - Contenu brut de la feuille CSS
 * @param {StyleThemeConfig} cfg - Configuration cible à hydrater
 * @param {boolean} [overrideExisting=false] - Si true, écrase également le nom et l'opacité existants
 * @returns {void}
 */
function extractSlideBgImagesFromCss(css, cfg, overrideExisting = false) {
  const coverImgMatches = [...css.matchAll(/\.slide\.slide-title::after\s*\{([^}]+)\}/g)];
  if (coverImgMatches.length > 0) {
    const lastCoverBlock = coverImgMatches[coverImgMatches.length - 1][1];
    const imgUrlMatch = lastCoverBlock.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/);
    if (imgUrlMatch && imgUrlMatch[1] && imgUrlMatch[1] !== 'none') {
      if (!cfg.coverSlide) cfg.coverSlide = {};
      if (overrideExisting || !cfg.coverSlide.bgImage) {
        cfg.coverSlide.bgImage = imgUrlMatch[1];
      }
      if (overrideExisting || !cfg.coverSlide.bgImageName) {
        cfg.coverSlide.bgImageName = 'Image restaurée';
      }
      const opMatch = lastCoverBlock.match(/opacity:\s*([\d.]+)/);
      if (opMatch && (overrideExisting || cfg.coverSlide.bgOpacity === undefined)) {
        cfg.coverSlide.bgOpacity = Math.round(parseFloat(opMatch[1]) * 100);
      }
    }
  }

  const chapterImgMatches = [...css.matchAll(/\.slide\.slide-chapter::after\s*\{([^}]+)\}/g)];
  if (chapterImgMatches.length > 0) {
    const lastChapterBlock = chapterImgMatches[chapterImgMatches.length - 1][1];
    const imgUrlMatch = lastChapterBlock.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/);
    if (imgUrlMatch && imgUrlMatch[1] && imgUrlMatch[1] !== 'none') {
      if (!cfg.chapterSlide) cfg.chapterSlide = {};
      if (overrideExisting || !cfg.chapterSlide.bgImage) {
        cfg.chapterSlide.bgImage = imgUrlMatch[1];
      }
      if (overrideExisting || !cfg.chapterSlide.bgImageName) {
        cfg.chapterSlide.bgImageName = 'Image restaurée';
      }
      const opMatch = lastChapterBlock.match(/opacity:\s*([\d.]+)/);
      if (opMatch && (overrideExisting || cfg.chapterSlide.bgOpacity === undefined)) {
        cfg.chapterSlide.bgOpacity = Math.round(parseFloat(opMatch[1]) * 100);
      }
    }
  }

  const contentImgMatches = [...css.matchAll(/\.slide\.slide-content::after\s*\{([^}]+)\}/g)];
  if (contentImgMatches.length > 0) {
    const lastContentBlock = contentImgMatches[contentImgMatches.length - 1][1];
    const imgUrlMatch = lastContentBlock.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/);
    if (imgUrlMatch && imgUrlMatch[1] && imgUrlMatch[1] !== 'none') {
      if (!cfg.contentSlide) cfg.contentSlide = {};
      if (overrideExisting || !cfg.contentSlide.bgImage) {
        cfg.contentSlide.bgImage = imgUrlMatch[1];
      }
      if (overrideExisting || !cfg.contentSlide.bgImageName) {
        cfg.contentSlide.bgImageName = 'Image restaurée';
      }
      const opMatch = lastContentBlock.match(/opacity:\s*([\d.]+)/);
      if (opMatch && (overrideExisting || cfg.contentSlide.bgOpacity === undefined)) {
        cfg.contentSlide.bgOpacity = Math.round(parseFloat(opMatch[1]) * 100);
      }
    }
  }

  const headerImgMatches = [...css.matchAll(/(?:\.slide\.slide-content\s+)?\.slide-header::after\s*\{([^}]+)\}/g)];
  if (headerImgMatches.length > 0) {
    const lastHeaderBlock = headerImgMatches[headerImgMatches.length - 1][1];
    const imgUrlMatch = lastHeaderBlock.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/);
    if (imgUrlMatch && imgUrlMatch[1] && imgUrlMatch[1] !== 'none') {
      if (!cfg.contentSlide) cfg.contentSlide = {};
      if (overrideExisting || !cfg.contentSlide.headerBgImage) {
        cfg.contentSlide.headerBgImage = imgUrlMatch[1];
      }
      if (overrideExisting || !cfg.contentSlide.headerBgImageName) {
        cfg.contentSlide.headerBgImageName = 'Image restaurée';
      }
      const opMatch = lastHeaderBlock.match(/opacity:\s*([\d.]+)/);
      if (opMatch && (overrideExisting || cfg.contentSlide.headerBgOpacity === undefined)) {
        cfg.contentSlide.headerBgOpacity = Math.round(parseFloat(opMatch[1]) * 100);
      }
    }
  }
}

/**
 * Extrait la configuration complète des styles depuis un texte CSS (Vision Rapport ou Slide).
 * 1. Recherche prioritaire du bloc JSON intégré sous commentaire :
 *    /\* [md2print-config:mode=...] {JSON} [\/md2print-config] *\/
 * 2. Si absent (ex: fichier CSS édité manuellement ou issu d'une version antérieure),
 *    analyse exhaustive des variables :root (typographies, liserés, fonds, marges)
 *    et des règles CSS (sélecteurs spécifiques, pseudo-éléments d'arrière-plan, padding).
 *
 * @function parseConfigFromCss
 * @param {string} css - Contenu brut de la feuille CSS
 * @param {'report'|'slide'} [defaultMode='slide'] - Mode par défaut si non détecté
 * @returns {{ mode: 'report'|'slide', config: StyleThemeConfig }|null} Configuration extraite et normalisée, ou null
 */
export function parseConfigFromCss(css, defaultMode = 'slide') {
  if (!css || typeof css !== 'string') return null;

  // 1. Tag de configuration embarqué (priorité absolue)
  const configTagRegex = /\/\*\s*\[md2print-config(?::mode=(report|slide))?\]\s*([\s\S]*?)\s*\[\/md2print-config\]\s*\*\//;
  const tagMatch = css.match(configTagRegex);
  if (tagMatch) {
    try {
      const modeInTag = tagMatch[1] || defaultMode;
      const parsed = JSON.parse(tagMatch[2].trim());
      if (parsed && typeof parsed === 'object') {
        const rawConfig = parsed[modeInTag] || parsed;
        const defaults = JSON.parse(JSON.stringify(DEFAULT_STYLE_CONFIG[modeInTag]));
        for (const [k, v] of Object.entries(rawConfig)) {
          if (v && typeof v === 'object' && !Array.isArray(v)) {
            defaults[k] = { ...(defaults[k] || {}), ...v };
          } else {
            defaults[k] = v;
          }
        }
        if (modeInTag === 'slide') {
          extractSlideBgImagesFromCss(css, defaults, false);
        }
        return { mode: modeInTag, config: defaults };
      }
    } catch (e) {
      console.warn('Erreur lecture du tag JSON dans le CSS :', e);
    }
  }

  // 2. Détection du mode heuristique
  const isSlide = defaultMode === 'slide' || css.includes('--slide-') || css.includes('.slide-body');
  const mode = isSlide ? 'slide' : 'report';
  const prefix = isSlide ? '--slide-' : '--report-';
  const cfg = JSON.parse(JSON.stringify(DEFAULT_STYLE_CONFIG[mode]));

  // Extraire toutes les variables CSS du dernier bloc :root trouvé
  const rootBlocks = [...css.matchAll(/:root\s*\{([^}]+)\}/g)];
  const cssVars = {};
  for (const block of rootBlocks) {
    const lines = block[1].split(';');
    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx !== -1) {
        const prop = line.slice(0, colonIdx).trim();
        const val = line.slice(colonIdx + 1).trim();
        if (prop.startsWith('--')) {
          cssVars[prop] = val;
        }
      }
    }
  }

  /**
   * Helper interne pour extraire une propriété d'une règle CSS en appliquant la cascade (dernière occurrence)
   * et en résolvant les éventuelles références `var(--variable, fallback)`.
   * @param {string} selectorRegex - Expression régulière ciblant le sélecteur CSS
   * @param {string} propName - Nom de la propriété CSS (ex: 'background-color', 'padding-left')
   * @returns {string|null} Valeur résolue ou null si introuvable
   */
  function extractRuleProp(selectorRegex, propName) {
    const matches = [...css.matchAll(new RegExp('(?:' + selectorRegex + ')\\s*\\{([^}]+)\\}', 'g'))];
    if (matches.length === 0) return null;
    for (let i = matches.length - 1; i >= 0; i--) {
      const body = matches[i][matches[i].length - 1];
      const propMatch = body.match(new RegExp('(?:^|;)\\s*' + propName + '\\s*:\\s*([^!;}]+)'));
      if (propMatch) {
        const val = propMatch[1].trim();
        const varMatch = val.match(/var\(\s*(--[a-zA-Z0-9_-]+)(?:\s*,\s*([^)]+))?\)/);
        if (varMatch) {
          const varName = varMatch[1];
          const fallback = varMatch[2]?.trim();
          return cssVars[varName] || fallback || null;
        }
        return val;
      }
    }
    return null;
  }

  // Typographies & Corps de texte
  if (cssVars[`${prefix}font-body`]) cfg.body.font = cleanFontName(cssVars[`${prefix}font-body`]);
  if (cssVars[`${prefix}font-heading`]) {
    const headFont = cleanFontName(cssVars[`${prefix}font-heading`]);
    cfg.hMain.font = headFont;
    cfg.h1.font = headFont;
    cfg.h2.font = headFont;
    cfg.h3.font = headFont;
    cfg.h4.font = headFont;
    cfg.h5.font = headFont;
  }
  if (cssVars[`${prefix}font-mono`]) cfg.code.font = cleanFontName(cssVars[`${prefix}font-mono`]);
  if (cssVars[`${prefix}font-size-base`]) cfg.body.size = cssVars[`${prefix}font-size-base`];
  if (cssVars[`${prefix}line-height-base`]) cfg.body.lineHeight = cssVars[`${prefix}line-height-base`];

  // Titres & Hiérarchie
  if (cssVars[`${prefix}title-cover-size`]) cfg.hMain.size = cssVars[`${prefix}title-cover-size`];
  if (cssVars[`${prefix}title-chapter-size`]) cfg.h1.size = cssVars[`${prefix}title-chapter-size`];
  if (cssVars[`${prefix}title-content-size`]) cfg.h2.size = cssVars[`${prefix}title-content-size`];
  if (cssVars[`${prefix}text-main`]) {
    const mainCol = normalizeColor(cssVars[`${prefix}text-main`]);
    cfg.h1.color = mainCol;
    cfg.h2.color = mainCol;
    cfg.h3.color = mainCol;
  }
  if (cssVars[`${prefix}text-body`]) cfg.body.color = normalizeColor(cssVars[`${prefix}text-body`]);

  // Arrière-plans & Structure
  if (cssVars[`${prefix}stage-backdrop`]) cfg.page.bgBackdrop = normalizeColor(cssVars[`${prefix}stage-backdrop`]);
  if (cssVars[`${prefix}canvas-bg`]) cfg.page.bgPaper = normalizeColor(cssVars[`${prefix}canvas-bg`]);
  if (cssVars[`${prefix}border-color`]) cfg.page.border = normalizeColor(cssVars[`${prefix}border-color`]);

  // Cartouche métrique
  if (cssVars[`${prefix}metric-val-size`]) cfg.metric.size = cssVars[`${prefix}metric-val-size`];
  if (cssVars[`${prefix}metric-accent`]) cfg.metric.accentColor = normalizeColor(cssVars[`${prefix}metric-accent`]);
  if (cssVars[`${prefix}metric-val-color`]) cfg.metric.valColor = normalizeColor(cssVars[`${prefix}metric-val-color`]);

  // Colonnes côte à côte
  if (cssVars[`${prefix}column-bg`]) cfg.column.bg = normalizeColor(cssVars[`${prefix}column-bg`]);
  if (cssVars[`${prefix}column-border`]) cfg.column.border = normalizeColor(cssVars[`${prefix}column-border`]);
  if (cssVars[`${prefix}column-radius`]) cfg.column.radius = cssVars[`${prefix}column-radius`];
  if (cssVars[`${prefix}column-padding`]) cfg.column.padding = cssVars[`${prefix}column-padding`];
  if (cssVars[`${prefix}column-font-size`]) cfg.column.fontSize = cssVars[`${prefix}column-font-size`];

  // Frise chronologique ([frise])
  cfg.timeline = {
    nodeSize: '57px',
    nodeFontSize: '0.88rem',
    titleFontSize: '0.95rem',
    descFontSize: '0.82rem',
    ...(cfg.timeline || {}),
  };
  if (cssVars[`${prefix}timeline-node-size`]) cfg.timeline.nodeSize = cssVars[`${prefix}timeline-node-size`];
  if (cssVars[`${prefix}timeline-node-font-size`]) cfg.timeline.nodeFontSize = cssVars[`${prefix}timeline-node-font-size`];
  if (cssVars[`${prefix}timeline-title-font-size`]) cfg.timeline.titleFontSize = cssVars[`${prefix}timeline-title-font-size`];
  if (cssVars[`${prefix}timeline-desc-font-size`]) cfg.timeline.descFontSize = cssVars[`${prefix}timeline-desc-font-size`];

  // Mermaid
  if (cssVars[`${prefix}mermaid-preset`]) cfg.mermaid.preset = cssVars[`${prefix}mermaid-preset`];
  if (cssVars[`${prefix}mermaid-bg`]) cfg.mermaid.bg = normalizeColor(cssVars[`${prefix}mermaid-bg`]);
  if (cssVars[`${prefix}mermaid-border`]) cfg.mermaid.border = normalizeColor(cssVars[`${prefix}mermaid-border`]);
  if (cssVars[`${prefix}mermaid-border-left`]) cfg.mermaid.borderLeft = normalizeColor(cssVars[`${prefix}mermaid-border-left`]);

  // Liserés & Bandeaux
  if (isSlide) {
    if (cssVars['--slide-cover-border-top-color']) cfg.coverSlide.borderTopColor = normalizeColor(cssVars['--slide-cover-border-top-color']);
    if (cssVars['--slide-cover-border-top-width']) cfg.coverSlide.borderTopWidth = parseInt(cssVars['--slide-cover-border-top-width'], 10) || 8;
    if (cssVars['--slide-chapter-border-left-color']) cfg.chapterSlide.borderLeftColor = normalizeColor(cssVars['--slide-chapter-border-left-color']);
    if (cssVars['--slide-chapter-border-left-width']) cfg.chapterSlide.borderLeftWidth = parseInt(cssVars['--slide-chapter-border-left-width'], 10) || 10;
    if (cssVars['--slide-content-border-top-color']) cfg.contentSlide.borderTopColor = normalizeColor(cssVars['--slide-content-border-top-color']);
    if (cssVars['--slide-content-border-top-width']) cfg.contentSlide.borderTopWidth = parseInt(cssVars['--slide-content-border-top-width'], 10) || 6;
    if (cssVars['--slide-content-bg']) cfg.contentSlide.bg = normalizeColor(cssVars['--slide-content-bg']);
    if (cssVars['--slide-header-bg']) cfg.contentSlide.headerBg = normalizeColor(cssVars['--slide-header-bg']);
    if (cssVars['--slide-padding-x']) {
      const pxMatch = cssVars['--slide-padding-x'].match(/(\d+)/);
      if (pxMatch) cfg.contentSlide.paddingX = parseInt(pxMatch[1], 10);
    }
  }

  // Règles spécifiques de cascade
  const coverBg = extractRuleProp('\\.slide\\.slide-title', 'background-color');
  if (coverBg) cfg.coverSlide.bg = normalizeColor(coverBg);
  const chapterBg = extractRuleProp('\\.slide\\.slide-chapter', 'background-color');
  if (chapterBg) cfg.chapterSlide.bg = normalizeColor(chapterBg);
  const contentBg = extractRuleProp('\\.slide\\.slide-content', 'background-color');
  if (contentBg) cfg.contentSlide.bg = normalizeColor(contentBg);
  const headerBg = extractRuleProp('\\.slide\\.slide-content\\s+\\.slide-header|\\.slide-header', 'background-color');
  if (headerBg) cfg.contentSlide.headerBg = normalizeColor(headerBg);
  const slidePadX = extractRuleProp('\\.slide\\.slide-content\\s+\\.slide-body|\\.slide-header', 'padding-left');
  if (slidePadX) {
    const pxMatch = slidePadX.match(/(\d+)/);
    if (pxMatch) cfg.contentSlide.paddingX = parseInt(pxMatch[1], 10);
  }

  const mainTitleColor = extractRuleProp('\\.slide-main-title', 'color');
  if (mainTitleColor) cfg.hMain.color = normalizeColor(mainTitleColor);
  const chapterTitleColor = extractRuleProp('\\.slide-chapter-title', 'color');
  if (chapterTitleColor) cfg.h1.color = normalizeColor(chapterTitleColor);
  const headerTitleColor = extractRuleProp('\\.slide-header-title', 'color');
  if (headerTitleColor) cfg.h2.color = normalizeColor(headerTitleColor);

  const thBg = extractRuleProp('\\.slide-body\\s+\\.doc-table\\s+th|\\.doc-table\\s+th', 'background-color');
  if (thBg) cfg.table.headerBg = normalizeColor(thBg);
  const thColor = extractRuleProp('\\.slide-body\\s+\\.doc-table\\s+th|\\.doc-table\\s+th', 'color');
  if (thColor) cfg.table.headerColor = normalizeColor(thColor);
  const tdColor = extractRuleProp('\\.slide-body\\s+\\.doc-table\\s+td|\\.doc-table\\s+td', 'color');
  if (tdColor) cfg.table.cellColor = normalizeColor(tdColor);

  const colBg = extractRuleProp('\\.slide-column', 'background-color');
  if (colBg) cfg.column.bg = normalizeColor(colBg);
  const colFontSize = extractRuleProp('\\.slide-column-content', 'font-size');
  if (colFontSize) cfg.column.fontSize = colFontSize;

  const isExplicitCssValue = (val) => Boolean(val && !val.startsWith('var(') && !val.startsWith('calc(') && val !== 'inherit');
  const timelineNodeWidth = extractRuleProp('\\.timeline-node', 'width');
  if (isExplicitCssValue(timelineNodeWidth)) cfg.timeline.nodeSize = timelineNodeWidth;
  const timelineNodeFontSize = extractRuleProp('\\.timeline-node', 'font-size');
  if (isExplicitCssValue(timelineNodeFontSize)) cfg.timeline.nodeFontSize = timelineNodeFontSize;
  const timelineTitleFontSize = extractRuleProp('\\.timeline-title', 'font-size');
  if (isExplicitCssValue(timelineTitleFontSize)) cfg.timeline.titleFontSize = timelineTitleFontSize;
  const timelineDescFontSize = extractRuleProp('\\.timeline-desc(?:,\\s*\\.timeline-desc\\s+p)?', 'font-size');
  if (isExplicitCssValue(timelineDescFontSize)) cfg.timeline.descFontSize = timelineDescFontSize;

  // Images de fond
  extractSlideBgImagesFromCss(css, cfg, true);

  return { mode, config: cfg };
}

/**
 * Formate les propriétés CSS d'un titre (police, taille, couleur, casse, gras, souligné).
 * @param {object} h - Propriétés du titre
 * @param {string} fallbackFont - Police de secours
 * @param {string} defaultSize - Taille de secours
 * @param {string} defaultColor - Couleur de secours
 * @returns {string} Lignes CSS formatées
 */
function formatHeadingCss(h, fallbackFont, defaultSize, defaultColor) {
  const font = h?.font || fallbackFont || 'sans-serif';
  const size = h?.size || defaultSize || '1rem';
  const color = h?.color || defaultColor || '#000000';
  const transform = h?.transform && h.transform !== 'none' ? `text-transform: ${h.transform};` : '';
  const weight = h?.bold !== undefined ? (h.bold ? 'font-weight: 700;' : 'font-weight: 400;') : 'font-weight: 700;';
  const decoration = h?.underline ? 'text-decoration: underline;' : (h?.underline === false ? 'text-decoration: none;' : '');

  return [
    `font-family: '${font}', sans-serif;`,
    `font-size: ${size};`,
    `color: ${color};`,
    transform,
    weight,
    decoration,
  ].filter(Boolean).join('\n  ');
}

/**
 * Normalise une dimension CSS saisie par l'utilisateur en ajoutant une unité par défaut aux nombres nus.
 * @param {string|number|null|undefined} rawValue - Valeur brute saisie
 * @param {string} fallback - Valeur CSS par défaut si vide
 * @param {'px'|'rem'} [defaultUnit='px'] - Unité appliquée aux valeurs purement numériques
 * @returns {string} Valeur CSS prête à l'emploi
 */
function normalizeCssSize(rawValue, fallback, defaultUnit = 'px') {
  if (rawValue === null || rawValue === undefined) return fallback;
  const trimmed = String(rawValue).trim();
  if (!trimmed) return fallback;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return `${parseFloat(trimmed)}${defaultUnit}`;
  }
  return trimmed;
}

/**
 * Génère le code CSS complet pour un mode donné ('report' ou 'slide') à partir de l'objet de configuration.
 * - Injecte les variables :root personnalisées (typographies, couleurs, liserés, fonds, métriques, marges latérales, taille de texte des colonnes).
 * - Applique les règles impératives de confinement de diapositive, superposition d'images d'arrière-plan,
 *   transparence des bandeaux, disposition multi-colonnes flexible et mise à l'échelle typographique (--col-font-scale).
 * - Intègre en tête le bloc de métadonnées JSON standard [md2print-config:mode=...] assurant la persistance.
 *
 * @function generateThemeCss
 * @param {'report'|'slide'} mode - Mode cible d'affichage ('report' ou 'slide')
 * @param {StyleThemeConfig} [config] - Configuration des balises et styles (utilise la configuration par défaut si omis)
 * @returns {string} Code CSS prêt à l'emploi et compilé
 */
export function generateThemeCss(mode, config) {
  const isSlide = mode === 'slide';
  const baseCss = isSlide ? DEFAULT_SLIDE_CSS : DEFAULT_REPORT_CSS;
  const cfg = config || DEFAULT_STYLE_CONFIG[mode];

  const rawPadX = cfg.contentSlide?.paddingX;
  const padX = (rawPadX === null || rawPadX === undefined || rawPadX === '')
    ? '56px'
    : (typeof rawPadX === 'number' || /^-?\d+(\.\d+)?$/.test(String(rawPadX).trim())
        ? `${parseInt(rawPadX, 10)}px`
        : String(rawPadX).trim());

  const timelineNodeSize = normalizeCssSize(cfg.timeline?.nodeSize, '57px', 'px');
  const timelineNodeFontSize = normalizeCssSize(cfg.timeline?.nodeFontSize, '0.88rem', 'rem');
  const timelineTitleFontSize = normalizeCssSize(cfg.timeline?.titleFontSize, '0.95rem', 'rem');
  const timelineDescFontSize = normalizeCssSize(cfg.timeline?.descFontSize, '0.82rem', 'rem');

  // Surcharges CSS explicites injectées à la suite du thème de base
  const overrides = isSlide
    ? `
/* === Surcharges personnalisées Diaporama (Slide) === */
:root {
  --slide-font-body: '${cfg.body.font}', sans-serif;
  --slide-font-heading: '${cfg.hMain.font}', sans-serif;
  --slide-font-mono: '${cfg.code.font}', monospace;
  --slide-font-size-base: ${cfg.body.size};
  --slide-line-height-base: ${cfg.body.lineHeight};
  --slide-title-cover-size: ${cfg.hMain.size};
  --slide-title-chapter-size: ${cfg.h1.size};
  --slide-title-content-size: ${cfg.h2.size};
  --slide-text-main: ${cfg.h1.color};
  --slide-text-body: ${cfg.body.color};
  --slide-stage-backdrop: ${cfg.page.bgBackdrop};
  --slide-canvas-bg: ${cfg.page.bgPaper};
  --slide-border-color: ${cfg.page.border};
  --slide-metric-val-size: ${cfg.metric.size};
  --slide-metric-accent: ${cfg.metric.accentColor};
  --slide-metric-val-color: ${cfg.metric.valColor};
  --slide-cover-border-top-width: ${cfg.coverSlide?.borderTopWidth !== undefined ? cfg.coverSlide.borderTopWidth + 'px' : '8px'};
  --slide-cover-border-top-color: ${cfg.coverSlide?.borderTopColor || '#C41718'};
  --slide-chapter-border-left-width: ${cfg.chapterSlide?.borderLeftWidth !== undefined ? cfg.chapterSlide.borderLeftWidth + 'px' : '10px'};
  --slide-chapter-border-left-color: ${cfg.chapterSlide?.borderLeftColor || '#C41718'};
  --slide-content-border-top-width: ${cfg.contentSlide?.borderTopWidth !== undefined ? cfg.contentSlide.borderTopWidth + 'px' : '6px'};
  --slide-content-border-top-color: ${cfg.contentSlide?.borderTopColor || '#C41718'};
  --slide-content-bg: ${cfg.contentSlide?.bg || '#ffffff'};
  --slide-header-bg: ${cfg.contentSlide?.headerBg ? normalizeColor(cfg.contentSlide.headerBg) : '#ffffff'};
  --slide-padding-x: ${padX};
  --slide-mermaid-preset: ${cfg.mermaid?.preset || 'default'};
  --slide-mermaid-bg: ${cfg.mermaid?.bg || '#f8fafc'};
  --slide-mermaid-border: ${cfg.mermaid?.border || '#cbd5e1'};
  --slide-mermaid-border-left: ${cfg.mermaid?.borderLeft || '#C41718'};
  --slide-column-bg: ${cfg.column?.bg || '#ffffff'};
  --slide-column-border: ${cfg.column?.border || '#cbd5e1'};
  --slide-column-radius: ${cfg.column?.radius || '6px'};
  --slide-column-padding: ${cfg.column?.padding || '14px'};
  --slide-column-font-size: ${cfg.column?.fontSize || '1rem'};
  --slide-h3-size: ${cfg.h3.size};
  --slide-h4-size: ${cfg.h3.size};
  --slide-h5-size: ${cfg.h4.size};
  --slide-h6-size: ${cfg.h5?.size || '1.05rem'};
  --slide-quote-size: ${cfg.quote.size};
  --slide-code-size: ${cfg.code.size};
  --slide-badge-size: ${cfg.badge?.size || '0.78rem'};
  --slide-table-size: ${cfg.table.size};
  --slide-timeline-node-size: ${timelineNodeSize};
  --slide-timeline-node-font-size: ${timelineNodeFontSize};
  --slide-timeline-title-font-size: ${timelineTitleFontSize};
  --slide-timeline-desc-font-size: ${timelineDescFontSize};
}

/* === Titres & Hiérarchie === */
.slide-main-title {
  ${formatHeadingCss(cfg.hMain, cfg.hMain.font, cfg.hMain.size, cfg.hMain.color)}
}
.slide-chapter-title {
  ${formatHeadingCss(cfg.h1, cfg.h1.font, cfg.h1.size, cfg.h1.color)}
}
.slide-header-title {
  ${formatHeadingCss(cfg.h2, cfg.h2.font, cfg.h2.size, cfg.h2.color)}
}
.slide-body h3 {
  ${formatHeadingCss(cfg.h3, cfg.h3.font, cfg.h3.size, cfg.h3.color)}
}
.slide-body h4 {
  ${formatHeadingCss(cfg.h3, cfg.h3.font, cfg.h3.size, cfg.h3.color)}
}
.slide-body h5 {
  ${formatHeadingCss(cfg.h4, cfg.h4.font, cfg.h4.size, cfg.h4.color)}
}
.slide-body h6 {
  ${formatHeadingCss(cfg.h5, cfg.h5?.font || cfg.h4.font, cfg.h5?.size || '1.05rem', cfg.h5?.color || cfg.h4.color)}
}

/* === Liserés et Bandeau spécifiques Vision Slide === */
.slide.slide-title::before {
  background: ${cfg.coverSlide?.borderTopColor || '#C41718'} !important;
  height: ${Number(cfg.coverSlide?.borderTopWidth ?? 8)}px !important;
  display: ${Number(cfg.coverSlide?.borderTopWidth ?? 8) > 0 ? 'block' : 'none'} !important;
}

.slide.slide-chapter::before {
  background: ${cfg.chapterSlide?.borderLeftColor || '#C41718'} !important;
  width: ${Number(cfg.chapterSlide?.borderLeftWidth ?? 10)}px !important;
  display: ${Number(cfg.chapterSlide?.borderLeftWidth ?? 10) > 0 ? 'block' : 'none'} !important;
}

.slide.slide-content::before {
  background: ${cfg.contentSlide?.borderTopColor || '#C41718'} !important;
  height: ${Number(cfg.contentSlide?.borderTopWidth ?? 6)}px !important;
  display: ${Number(cfg.contentSlide?.borderTopWidth ?? 6) > 0 ? 'block' : 'none'} !important;
}

.slide.slide-content {
  padding: 0 !important;
  background-color: ${cfg.contentSlide?.bg || '#ffffff'} !important;
  background-image: none !important;
  position: relative;
}
${cfg.contentSlide?.bgImage ? `
.slide.slide-content::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url('${cfg.contentSlide.bgImage}') !important;
  background-size: 100% 100% !important;
  background-position: center !important;
  background-repeat: no-repeat !important;
  opacity: ${(Number(cfg.contentSlide.bgOpacity ?? 100) / 100).toFixed(2)} !important;
  pointer-events: none;
  z-index: 0;
}
.slide.slide-content > * {
  position: relative;
  z-index: 1;
}
` : ''}

.slide-header,
.slide.slide-content .slide-header {
  background-color: ${cfg.contentSlide?.headerBg ? normalizeColor(cfg.contentSlide.headerBg) : '#ffffff'} !important;
  padding-top: 24px !important;
  padding-bottom: 14px !important;
  padding-left: ${padX} !important;
  padding-right: ${padX} !important;
  margin-bottom: 0 !important;
  width: 100% !important;
  box-sizing: border-box !important;
  position: relative;
  overflow: hidden;
}
${cfg.contentSlide?.headerBgImage ? `
.slide-header::after,
.slide.slide-content .slide-header::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url('${cfg.contentSlide.headerBgImage}') !important;
  background-size: 100% 100% !important;
  background-position: center !important;
  background-repeat: no-repeat !important;
  opacity: ${(Number(cfg.contentSlide.headerBgOpacity ?? 100) / 100).toFixed(2)} !important;
  pointer-events: none;
  z-index: 0;
}
.slide-header > *,
.slide.slide-content .slide-header > * {
  position: relative;
  z-index: 1;
}
` : ''}

.slide.slide-content .slide-body {
  padding: 24px ${padX} 44px ${padX} !important;
}

/* === Fonds spécifiques Couverture (#) et Chapitre (##) === */
.slide.slide-title {
  background-color: ${cfg.coverSlide?.bg || '#ffffff'} !important;
  background-image: none !important;
  position: relative;
}
${cfg.coverSlide?.bgImage ? `
.slide.slide-title::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url('${cfg.coverSlide.bgImage}') !important;
  background-size: 100% 100% !important;
  background-position: center !important;
  background-repeat: no-repeat !important;
  opacity: ${(Number(cfg.coverSlide.bgOpacity ?? 100) / 100).toFixed(2)} !important;
  pointer-events: none;
  z-index: 0;
}
.slide.slide-title > * {
  position: relative;
  z-index: 1;
}
` : ''}

.slide.slide-chapter {
  background-color: ${cfg.chapterSlide?.bg || '#f8fafc'} !important;
  background-image: none !important;
  position: relative;
}
${cfg.chapterSlide?.bgImage ? `
.slide.slide-chapter::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url('${cfg.chapterSlide.bgImage}') !important;
  background-size: 100% 100% !important;
  background-position: center !important;
  background-repeat: no-repeat !important;
  opacity: ${(Number(cfg.chapterSlide.bgOpacity ?? 100) / 100).toFixed(2)} !important;
  pointer-events: none;
  z-index: 0;
}
.slide.slide-chapter > * {
  position: relative;
  z-index: 1;
}
` : ''}

.slide-body, .slide-body p, .slide-body li {
  font-family: '${cfg.body.font}', sans-serif;
  font-size: ${cfg.body.size};
  color: ${cfg.body.color};
  line-height: ${cfg.body.lineHeight || '1.6'};
  text-align: ${cfg.body.textAlign || 'left'};
}
.slide-body p {
  margin-bottom: ${cfg.body.spacing || '10px'};
}
.slide-body p:has(img) {
  margin-bottom: 0;
}
.mermaid-card, .slide-body .mermaid-card {
  background-color: ${cfg.mermaid?.bg || '#f8fafc'} !important;
  border-color: ${cfg.mermaid?.border || '#cbd5e1'} !important;
  border-left-color: ${cfg.mermaid?.borderLeft || (isSlide ? '#C41718' : '#2F5496')} !important;
}
.slide img, .slide-body img {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.empty-line {
  display: block;
  width: 100%;
  height: 16px;
  min-height: 16px;
  flex: 0 0 16px;
  pointer-events: none;
}
.slide-body a {
  color: ${cfg.link.color};
}
.slide-body a:hover {
  color: ${cfg.link.hoverColor};
}
.metric-group-row,
.slide-body p:has(.metric-card) {
  display: flex !important;
  flex-direction: row !important;
  align-items: stretch !important;
  gap: 16px !important;
  width: 100% !important;
  margin: 14px 0 !important;
  box-sizing: border-box !important;
}
.metric-group-row > br {
  display: none !important;
}
.slide-body p:has(.metric-card) > br {
  display: none !important;
}
.slide-body .metric-card {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  flex: 1 1 0 !important;
  width: 100% !important;
  min-width: 0 !important;
  margin: 0 !important;
  box-sizing: border-box !important;
  border-top-color: ${cfg.metric.accentColor};
}
.slide-body .metric-card.metric-card-info {
  border-top-color: ${cfg.badgeInfo?.border || cfg.badgeInfo?.color || "#0E2841"} !important;
}
.slide-body .metric-card.metric-card-info .metric-value {
  color: ${cfg.badgeInfo?.color || "#0E2841"} !important;
}
.slide-body .metric-card.metric-card-success {
  border-top-color: ${cfg.badgeSuccess?.border || cfg.badgeSuccess?.color || "#196B24"} !important;
}
.slide-body .metric-card.metric-card-success .metric-value {
  color: ${cfg.badgeSuccess?.color || "#196B24"} !important;
}
.slide-body .metric-card.metric-card-warning {
  border-top-color: ${cfg.badgeWarning?.border || cfg.badgeWarning?.color || "#E97132"} !important;
}
.slide-body .metric-card.metric-card-warning .metric-value {
  color: ${cfg.badgeWarning?.color || "#ad5319"} !important;
}
.slide-body .metric-card.metric-card-danger {
  border-top-color: ${cfg.badgeDanger?.border || cfg.badgeDanger?.color || "#C41718"} !important;
}
.slide-body .metric-card.metric-card-danger .metric-value {
  color: ${cfg.badgeDanger?.color || "#C41718"} !important;
}
.slide-body .metric-card.metric-card-important {
  border-top-color: ${cfg.badgeImportant?.border || cfg.badgeImportant?.color || "#0F9ED5"} !important;
}
.slide-body .metric-card.metric-card-important .metric-value {
  color: ${cfg.badgeImportant?.color || "#0F9ED5"} !important;
}
.slide-body .metric-card.metric-card-neutral {
  border-top-color: ${cfg.badgeNeutral?.border || "#cbd5e1"} !important;
}
.slide-body .metric-card.metric-card-neutral .metric-value {
  color: ${cfg.badgeNeutral?.color || "#1e293b"} !important;
}
.slide-body > .metric-card {
  width: 100% !important;
  margin: 14px 0 !important;
}
.slide-body .metric-value {
  font-family: '${cfg.metric.font}', sans-serif;
  font-size: ${cfg.metric.size};
  color: ${cfg.metric.valColor};
}
.slide-body .metric-label {
  color: ${cfg.metric.labelColor};
}
.slide-chapter-tag {
  font-family: '${cfg.chapterTag?.font || cfg.hMain.font}', sans-serif;
  font-size: ${cfg.chapterTag?.size || '0.82rem'};
  color: ${cfg.chapterTag?.color || '#C41718'};
}
.slide-body .badge {
  font-family: '${cfg.badge?.font || cfg.body.font}', sans-serif;
  font-size: ${cfg.badge?.size || '0.78rem'};
}
.slide-body .badge-info, .slide-body .badge-note {
  color: ${cfg.badgeInfo?.color || '#0E2841'};
  background-color: ${cfg.badgeInfo?.bg || '#f1f4f8'};
  border: 1px solid ${cfg.badgeInfo?.border || '#0E2841'};
}
.slide-body .badge-success, .slide-body .badge-tip, .slide-body .badge-astuce, .slide-body .badge-ok, .slide-body .badge-valide {
  color: ${cfg.badgeSuccess?.color || '#196B24'};
  background-color: ${cfg.badgeSuccess?.bg || '#f0f7f1'};
  border: 1px solid ${cfg.badgeSuccess?.border || '#196B24'};
}
.slide-body .badge-warning, .slide-body .badge-warn, .slide-body .badge-avertissement {
  color: ${cfg.badgeWarning?.color || '#ad5319'};
  background-color: ${cfg.badgeWarning?.bg || '#fef3ec'};
  border: 1px solid ${cfg.badgeWarning?.border || '#E97132'};
}
.slide-body .badge-danger, .slide-body .badge-caution, .slide-body .badge-attention, .slide-body .badge-critique, .slide-body .badge-error {
  color: ${cfg.badgeDanger?.color || '#C41718'};
  background-color: ${cfg.badgeDanger?.bg || '#fdf1f1'};
  border: 1px solid ${cfg.badgeDanger?.border || '#C41718'};
}
.slide-body .badge-important {
  color: ${cfg.badgeImportant?.color || '#0F9ED5'};
  background-color: ${cfg.badgeImportant?.bg || '#eef8fc'};
  border: 1px solid ${cfg.badgeImportant?.border || '#0F9ED5'};
}
.slide-body .badge-neutral, .slide-body .badge-neutre, .slide-body .badge-gray, .slide-body .badge-default {
  color: ${cfg.badgeNeutral?.color || '#1e293b'};
  background-color: ${cfg.badgeNeutral?.bg || '#f1f5f9'};
  border: 1px solid ${cfg.badgeNeutral?.border || '#cbd5e1'};
}
.slide-body blockquote {
  font-family: '${cfg.quote.font}', sans-serif;
  font-size: ${cfg.quote.size};
  color: ${cfg.quote.color};
  border-left-color: ${cfg.quote.border};
  line-height: ${cfg.quote.lineHeight || '1.6'};
}
.slide-body pre, .slide-body code {
  font-family: '${cfg.code.font}', monospace;
}
.slide-body pre {
  font-size: ${cfg.code.size};
  color: ${cfg.code.color};
  background-color: ${cfg.code.bg};
  border-color: ${cfg.code.border};
}
.slide-body .doc-table th {
  font-family: '${cfg.table.font}', sans-serif;
  font-size: ${cfg.table.size};
  color: ${cfg.table.headerColor};
  background-color: ${cfg.table.headerBg};
}
.slide-body .doc-table td {
  font-family: '${cfg.table.font}', sans-serif;
  font-size: ${cfg.table.size};
  color: ${cfg.table.cellColor};
  border-color: ${cfg.table.border};
}
.slide-body .doc-table tbody tr:nth-child(even) td {
  background-color: ${cfg.table.rowAltBg};
}
.slide-columns-row {
  display: flex !important;
  flex-direction: row !important;
  align-items: stretch !important;
  gap: 20px !important;
  width: 100% !important;
  flex: 1 1 0% !important;
  min-height: 0 !important;
  margin: 12px 0 !important;
  box-sizing: border-box !important;
}
.slide-column {
  display: flex !important;
  flex-direction: column !important;
  flex: 1 1 0%;
  min-width: 0 !important;
  width: 100% !important;
  min-height: 0 !important;
  box-sizing: border-box !important;
  background-color: ${cfg.column?.bg || '#ffffff'} !important;
  border: ${cfg.column?.border && cfg.column.border !== 'transparent' && cfg.column.border !== 'none' ? `1px solid ${cfg.column.border}` : 'none'} !important;
  border-radius: ${cfg.column?.radius || '6px'} !important;
  padding: ${cfg.column?.padding || '14px'} !important;
}
.slide-column.has-column-header {
  padding: 0 !important;
  overflow: hidden !important;
}
.slide-column.has-column-header > .slide-column-content {
  padding: ${cfg.column?.padding || '14px'} !important;
}
.slide-column.has-column-header > .slide-column-header:not(.slide-column-header-colored) + .slide-column-content {
  padding-top: 10px !important;
}
.slide-column-header {
  width: 100%;
  box-sizing: border-box;
  text-align: center;
  padding: ${cfg.column?.padding || '14px'} ${cfg.column?.padding || '14px'} 0 ${cfg.column?.padding || '14px'};
}
.slide-column-header.slide-column-header-colored {
  padding: 10px ${cfg.column?.padding || '14px'};
  color: #ffffff;
}
.slide-column-header h4,
.slide-column-header .doc-h4,
.slide-body .slide-column-header h4 {
  margin: 0 !important;
  text-align: center !important;
}
.slide-column-header.slide-column-header-colored h4,
.slide-column-header.slide-column-header-colored .doc-h4,
.slide-body .slide-column-header.slide-column-header-colored h4 {
  color: #ffffff !important;
}
.slide-body .slide-column-header-info,
.slide-column-header-info {
  background-color: ${cfg.badgeInfo?.border || cfg.badgeInfo?.color || '#0E2841'} !important;
}
.slide-body .slide-column-header-success,
.slide-column-header-success {
  background-color: ${cfg.badgeSuccess?.border || cfg.badgeSuccess?.color || '#196B24'} !important;
}
.slide-body .slide-column-header-warning,
.slide-column-header-warning {
  background-color: ${cfg.badgeWarning?.border || cfg.badgeWarning?.color || '#E97132'} !important;
}
.slide-body .slide-column-header-danger,
.slide-column-header-danger {
  background-color: ${cfg.badgeDanger?.border || cfg.badgeDanger?.color || '#C41718'} !important;
}
.slide-body .slide-column-header-important,
.slide-column-header-important {
  background-color: ${cfg.badgeImportant?.border || cfg.badgeImportant?.color || '#0F9ED5'} !important;
}
.slide-body .slide-column-header-neutral,
.slide-column-header-neutral {
  background-color: ${cfg.badgeNeutral?.border || '#cbd5e1'} !important;
}
.slide-column-content {
  display: flex !important;
  flex-direction: column !important;
  flex: 1 1 0% !important;
  min-height: 0 !important;
  width: 100% !important;
  box-sizing: border-box !important;
  gap: 10px;
  font-size: calc(${cfg.column?.fontSize || '1rem'} * var(--col-font-scale, 1)) !important;
}
.slide-body .slide-column-content p,
.slide-body .slide-column-content li,
.slide-body .slide-column-content ul,
.slide-body .slide-column-content ol,
.slide-column-content p,
.slide-column-content li,
.slide-column-content ul,
.slide-column-content ol {
  font-size: calc(${cfg.column?.fontSize || '1rem'} * var(--col-font-scale, 1)) !important;
}
.slide-body .slide-column h3,
.slide-body .slide-column h4,
.slide-column .slide-column-header h4,
.slide-column .doc-h4 {
  font-size: calc(${cfg.h3.size} * var(--col-font-scale, 1)) !important;
}
.slide-body .slide-column h5,
.slide-column .doc-h5 {
  font-size: calc(${cfg.h4.size} * var(--col-font-scale, 1)) !important;
}
.slide-body .slide-column h6,
.slide-column .doc-h6 {
  font-size: calc(${cfg.h5?.size || '1.05rem'} * var(--col-font-scale, 1)) !important;
}
.slide-body .slide-column blockquote,
.slide-body .slide-column blockquote p {
  font-size: calc(${cfg.quote.size} * var(--col-font-scale, 1)) !important;
}
.slide-body .slide-column .callout-header {
  font-size: calc(0.82rem * var(--col-font-scale, 1)) !important;
}
.slide-body .slide-column .callout-body,
.slide-body .slide-column .callout-body p,
.slide-body .slide-column .callout-body li {
  font-size: calc(${cfg.column?.fontSize || '1rem'} * var(--col-font-scale, 1)) !important;
}
.slide-body .slide-column pre,
.slide-body .slide-column pre code {
  font-size: calc(${cfg.code.size} * var(--col-font-scale, 1)) !important;
}
.slide-body .slide-column .badge {
  font-size: calc(${cfg.badge?.size || '0.78rem'} * var(--col-font-scale, 1)) !important;
}
.slide-body .slide-column .doc-table th,
.slide-body .slide-column .doc-table td {
  font-size: calc(${cfg.table.size} * var(--col-font-scale, 1)) !important;
}
.slide-body .slide-column .metric-value {
  font-size: calc(${cfg.metric.size} * var(--col-font-scale, 1)) !important;
}
.slide-body .slide-column .metric-label {
  font-size: calc(0.85rem * var(--col-font-scale, 1)) !important;
}
.slide-body .slide-column .timeline-node {
  font-size: calc(${timelineNodeFontSize} * var(--col-font-scale, 1)) !important;
}
.slide-body .slide-column .timeline-title {
  font-size: calc(${timelineTitleFontSize} * var(--col-font-scale, 1)) !important;
}
.slide-body .slide-column .timeline-desc,
.slide-body .slide-column .timeline-desc p {
  font-size: calc(${timelineDescFontSize} * var(--col-font-scale, 1)) !important;
}
.slide-column-content > *:first-child {
  margin-top: 0 !important;
}
.slide-column-content > *:last-child {
  margin-bottom: 0 !important;
}
.slide-column .mermaid-card {
  width: 100% !important;
  flex: 1 1 0% !important;
  min-height: 0 !important;
  margin: 0 !important;
}
.slide-column .metric-group-row {
  width: 100% !important;
  margin: 6px 0 !important;
}
.slide-column .metric-card {
  width: 100% !important;
  flex: 1 1 0% !important;
}
.slide-column .slide-image-box {
  width: 100% !important;
  flex: 1 1 0% !important;
  min-height: 0 !important;
}
.slide-column .slide-image {
  max-width: 100% !important;
  max-height: 100% !important;
  object-fit: contain !important;
}
.slide-column table.doc-table {
  width: 100% !important;
}
.process-timeline::before {
  top: calc((${timelineNodeSize} - 3px) / 2) !important;
}
.timeline-node-wrapper {
  height: ${timelineNodeSize} !important;
}
.timeline-node {
  width: ${timelineNodeSize} !important;
  height: ${timelineNodeSize} !important;
  min-width: ${timelineNodeSize} !important;
  min-height: ${timelineNodeSize} !important;
  font-size: ${timelineNodeFontSize} !important;
}
.timeline-title {
  font-size: ${timelineTitleFontSize} !important;
}
.timeline-desc,
.timeline-desc p {
  font-size: ${timelineDescFontSize} !important;
}
`
    : `
/* === Surcharges personnalisées Rapport === */
:root {
  --report-font-heading: '${cfg.hMain.font}', sans-serif;
  --report-font-body: '${cfg.body.font}', sans-serif;
  --report-font-mono: '${cfg.code.font}', monospace;
  --report-font-size-base: ${cfg.body.size};
  --report-line-height-base: ${cfg.body.lineHeight};
  --report-title-size: ${cfg.hMain.size};
  --report-h1-size: ${cfg.h1.size};
  --report-h2-size: ${cfg.h2.size};
  --report-h3-size: ${cfg.h3.size};
  --report-h4-size: ${cfg.h4.size};
  --report-color-h1: ${cfg.h1.color};
  --report-color-h2: ${cfg.h2.color};
  --report-color-h3: ${cfg.h3.color};
  --report-color-h4: ${cfg.h4.color};
  --report-color-text: ${cfg.body.color};
  --report-color-link: ${cfg.link.color};
  --report-color-link-hover: ${cfg.link.hoverColor};
  --report-bg-backdrop: ${cfg.page.bgBackdrop};
  --report-bg-paper: ${cfg.page.bgPaper};
  --report-border-color: ${cfg.page.border};
  --report-metric-val-size: ${cfg.metric.size};
  --report-metric-accent: ${cfg.metric.accentColor};
  --report-metric-val-color: ${cfg.metric.valColor};
  --report-column-bg: ${cfg.column?.bg || '#f8fafc'};
  --report-column-border: ${cfg.column?.border || '#cbd5e1'};
  --report-column-radius: ${cfg.column?.radius || '6px'};
  --report-column-padding: ${cfg.column?.padding || '14px'};
  --report-column-font-size: ${cfg.column?.fontSize || '0.95rem'};
  --report-h5-size: ${cfg.h5?.size || '0.98rem'};
  --report-quote-size: ${cfg.quote.size};
  --report-code-size: ${cfg.code.size};
  --report-badge-size: ${cfg.badge?.size || '0.82rem'};
  --report-table-size: ${cfg.table.size};
  --report-mermaid-preset: ${cfg.mermaid?.preset || 'default'};
  --report-mermaid-bg: ${cfg.mermaid?.bg || '#f8fafc'};
  --report-mermaid-border: ${cfg.mermaid?.border || '#cbd5e1'};
  --report-mermaid-border-left: ${cfg.mermaid?.borderLeft || '#2F5496'};
  --report-timeline-node-size: ${timelineNodeSize};
  --report-timeline-node-font-size: ${timelineNodeFontSize};
  --report-timeline-title-font-size: ${timelineTitleFontSize};
  --report-timeline-desc-font-size: ${timelineDescFontSize};
}

/* === Titres & Hiérarchie === */
.doc-main-title {
  ${formatHeadingCss(cfg.hMain, cfg.hMain.font, cfg.hMain.size, cfg.hMain.color)}
  border-bottom-color: ${cfg.hMain.color};
}
.doc-h2 {
  ${formatHeadingCss(cfg.h1, cfg.h1.font, cfg.h1.size, cfg.h1.color)}
}
.doc-h3 {
  ${formatHeadingCss(cfg.h2, cfg.h2.font, cfg.h2.size, cfg.h2.color)}
}
.doc-h4 {
  ${formatHeadingCss(cfg.h3, cfg.h3.font, cfg.h3.size, cfg.h3.color)}
}
.doc-h5 {
  ${formatHeadingCss(cfg.h4, cfg.h4.font, cfg.h4.size, cfg.h4.color)}
}
.doc-h6 {
  ${formatHeadingCss(cfg.h5, cfg.h5?.font || cfg.h4.font, cfg.h5?.size || '0.98rem', cfg.h5?.color || cfg.h4.color)}
}

.markdown-rendered-content p, .markdown-rendered-content li {
  font-family: '${cfg.body.font}', sans-serif;
  font-size: ${cfg.body.size};
  color: ${cfg.body.color};
  line-height: ${cfg.body.lineHeight || '1.55'};
  text-align: ${cfg.body.textAlign || 'justify'};
}
.markdown-rendered-content p {
  margin-bottom: ${cfg.body.spacing || '14px'};
}
.markdown-rendered-content a {
  color: ${cfg.link.color};
}
.markdown-rendered-content a:hover {
  color: ${cfg.link.hoverColor};
}
.markdown-rendered-content .metric-card {
  border-top-color: ${cfg.metric.accentColor};
}
.markdown-rendered-content .metric-card.metric-card-info {
  border-top-color: ${cfg.badgeInfo?.border || cfg.badgeInfo?.color || "#2F5496"} !important;
}
.markdown-rendered-content .metric-card.metric-card-info .metric-value {
  color: ${cfg.badgeInfo?.color || "#2F5496"} !important;
}
.markdown-rendered-content .metric-card.metric-card-success {
  border-top-color: ${cfg.badgeSuccess?.border || cfg.badgeSuccess?.color || "#70AD47"} !important;
}
.markdown-rendered-content .metric-card.metric-card-success .metric-value {
  color: ${cfg.badgeSuccess?.color || "#3b6321"} !important;
}
.markdown-rendered-content .metric-card.metric-card-warning {
  border-top-color: ${cfg.badgeWarning?.border || cfg.badgeWarning?.color || "#ED7D31"} !important;
}
.markdown-rendered-content .metric-card.metric-card-warning .metric-value {
  color: ${cfg.badgeWarning?.color || "#a44810"} !important;
}
.markdown-rendered-content .metric-card.metric-card-danger {
  border-top-color: ${cfg.badgeDanger?.border || cfg.badgeDanger?.color || "#C00000"} !important;
}
.markdown-rendered-content .metric-card.metric-card-danger .metric-value {
  color: ${cfg.badgeDanger?.color || "#C00000"} !important;
}
.markdown-rendered-content .metric-card.metric-card-important {
  border-top-color: ${cfg.badgeImportant?.border || cfg.badgeImportant?.color || "#5B9BD5"} !important;
}
.markdown-rendered-content .metric-card.metric-card-important .metric-value {
  color: ${cfg.badgeImportant?.color || "#1f568a"} !important;
}
.markdown-rendered-content .metric-card.metric-card-neutral {
  border-top-color: ${cfg.badgeNeutral?.border || "#cbd5e1"} !important;
}
.markdown-rendered-content .metric-card.metric-card-neutral .metric-value {
  color: ${cfg.badgeNeutral?.color || "#475569"} !important;
}
.markdown-rendered-content .metric-value {
  font-family: '${cfg.metric.font}', sans-serif;
  font-size: ${cfg.metric.size};
  color: ${cfg.metric.valColor};
}
.markdown-rendered-content .metric-label {
  color: ${cfg.metric.labelColor};
}
.markdown-rendered-content .badge {
  font-family: '${cfg.badge?.font || cfg.body.font}', sans-serif;
  font-size: ${cfg.badge?.size || '0.75rem'};
}
.markdown-rendered-content .badge-info, .markdown-rendered-content .badge-note {
  color: ${cfg.badgeInfo?.color || '#2F5496'};
  background-color: ${cfg.badgeInfo?.bg || '#f0f4f9'};
  border: 1px solid ${cfg.badgeInfo?.border || '#2F5496'};
}
.markdown-rendered-content .badge-success, .markdown-rendered-content .badge-tip, .markdown-rendered-content .badge-astuce, .markdown-rendered-content .badge-ok, .markdown-rendered-content .badge-valide {
  color: ${cfg.badgeSuccess?.color || '#3b6321'};
  background-color: ${cfg.badgeSuccess?.bg || '#f2f8ee'};
  border: 1px solid ${cfg.badgeSuccess?.border || '#70AD47'};
}
.markdown-rendered-content .badge-warning, .markdown-rendered-content .badge-warn, .markdown-rendered-content .badge-avertissement {
  color: ${cfg.badgeWarning?.color || '#a44810'};
  background-color: ${cfg.badgeWarning?.bg || '#fdf4ee'};
  border: 1px solid ${cfg.badgeWarning?.border || '#ED7D31'};
}
.markdown-rendered-content .badge-danger, .markdown-rendered-content .badge-caution, .markdown-rendered-content .badge-attention, .markdown-rendered-content .badge-critique, .markdown-rendered-content .badge-error {
  color: ${cfg.badgeDanger?.color || '#C00000'};
  background-color: ${cfg.badgeDanger?.bg || '#fdf0f0'};
  border: 1px solid ${cfg.badgeDanger?.border || '#C00000'};
}
.markdown-rendered-content .badge-important {
  color: ${cfg.badgeImportant?.color || '#1f568a'};
  background-color: ${cfg.badgeImportant?.bg || '#f1f7fc'};
  border: 1px solid ${cfg.badgeImportant?.border || '#5B9BD5'};
}
.markdown-rendered-content .badge-neutral, .markdown-rendered-content .badge-neutre, .markdown-rendered-content .badge-gray, .markdown-rendered-content .badge-default {
  color: ${cfg.badgeNeutral?.color || '#475569'};
  background-color: ${cfg.badgeNeutral?.bg || '#f1f5f9'};
  border: 1px solid ${cfg.badgeNeutral?.border || '#cbd5e1'};
}
.markdown-rendered-content .callout-note {
  border-left-color: ${cfg.calloutNote.border};
  background-color: ${cfg.calloutNote.bg};
}
.markdown-rendered-content .callout-note .callout-title {
  color: ${cfg.calloutNote.title};
}
.markdown-rendered-content .callout-tip {
  border-left-color: ${cfg.calloutTip.border};
  background-color: ${cfg.calloutTip.bg};
}
.markdown-rendered-content .callout-tip .callout-title {
  color: ${cfg.calloutTip.title};
}
.markdown-rendered-content .callout-warning {
  border-left-color: ${cfg.calloutWarning.border};
  background-color: ${cfg.calloutWarning.bg};
}
.markdown-rendered-content .callout-warning .callout-title {
  color: ${cfg.calloutWarning.title};
}
.markdown-rendered-content .callout-danger {
  border-left-color: ${cfg.calloutDanger.border};
  background-color: ${cfg.calloutDanger.bg};
}
.markdown-rendered-content .callout-danger .callout-title {
  color: ${cfg.calloutDanger.title};
}
.markdown-rendered-content .callout-important {
  border-left-color: ${cfg.calloutImportant.border};
  background-color: ${cfg.calloutImportant.bg};
}
.markdown-rendered-content .callout-important .callout-title {
  color: ${cfg.calloutImportant.title};
}
.markdown-rendered-content blockquote {
  font-family: '${cfg.quote.font}', sans-serif;
  font-size: ${cfg.quote.size};
  color: ${cfg.quote.color};
  border-left-color: ${cfg.quote.border};
  line-height: ${cfg.quote.lineHeight || '1.6'};
}
.markdown-rendered-content pre, .markdown-rendered-content code {
  font-family: '${cfg.code.font}', monospace;
}
.markdown-rendered-content pre {
  font-size: ${cfg.code.size};
  color: ${cfg.code.color};
  background-color: ${cfg.code.bg};
  border-color: ${cfg.code.border};
}
.markdown-rendered-content .doc-table th {
  font-family: '${cfg.table.font}', sans-serif;
  font-size: ${cfg.table.size};
  color: ${cfg.table.headerColor};
  background-color: ${cfg.table.headerBg};
}
.markdown-rendered-content .doc-table td {
  font-family: '${cfg.table.font}', sans-serif;
  font-size: ${cfg.table.size};
  color: ${cfg.table.cellColor};
  border-color: ${cfg.table.border};
}
.markdown-rendered-content .doc-table tbody tr:nth-child(even) td {
  background-color: ${cfg.table.rowAltBg};
}
.slide-columns-row {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 24px;
  width: 100%;
  margin: 18px 0;
  box-sizing: border-box;
}
.slide-column {
  display: flex;
  flex-direction: column;
  flex: 1 1 0%;
  min-width: 0;
  box-sizing: border-box;
  background-color: ${cfg.column?.bg || '#f8fafc'};
  border: ${cfg.column?.border && cfg.column.border !== 'transparent' && cfg.column.border !== 'none' ? `1px solid ${cfg.column.border}` : 'none'};
  border-radius: ${cfg.column?.radius || '6px'};
  padding: ${cfg.column?.padding || '14px'};
}
.slide-column.has-column-header {
  padding: 0 !important;
  overflow: hidden;
}
.slide-column.has-column-header > .slide-column-content {
  padding: ${cfg.column?.padding || '14px'} !important;
}
.slide-column.has-column-header > .slide-column-header:not(.slide-column-header-colored) + .slide-column-content {
  padding-top: 12px !important;
}
.slide-column-header {
  width: 100%;
  box-sizing: border-box;
  text-align: center;
  padding: ${cfg.column?.padding || '14px'} ${cfg.column?.padding || '14px'} 0 ${cfg.column?.padding || '14px'};
}
.slide-column-header.slide-column-header-colored {
  padding: 10px ${cfg.column?.padding || '14px'};
  color: #ffffff;
}
.slide-column-header h4,
.slide-column-header .doc-h4,
.markdown-rendered-content .slide-column-header h4 {
  margin: 0 !important;
  text-align: center !important;
}
.slide-column-header.slide-column-header-colored h4,
.slide-column-header.slide-column-header-colored .doc-h4,
.markdown-rendered-content .slide-column-header.slide-column-header-colored h4 {
  color: #ffffff !important;
}
.markdown-rendered-content .slide-column-header-info,
.slide-column-header-info {
  background-color: ${cfg.badgeInfo?.border || cfg.badgeInfo?.color || '#2F5496'} !important;
}
.markdown-rendered-content .slide-column-header-success,
.slide-column-header-success {
  background-color: ${cfg.badgeSuccess?.border || cfg.badgeSuccess?.color || '#70AD47'} !important;
}
.markdown-rendered-content .slide-column-header-warning,
.slide-column-header-warning {
  background-color: ${cfg.badgeWarning?.border || cfg.badgeWarning?.color || '#ED7D31'} !important;
}
.markdown-rendered-content .slide-column-header-danger,
.slide-column-header-danger {
  background-color: ${cfg.badgeDanger?.border || cfg.badgeDanger?.color || '#C00000'} !important;
}
.markdown-rendered-content .slide-column-header-important,
.slide-column-header-important {
  background-color: ${cfg.badgeImportant?.border || cfg.badgeImportant?.color || '#5B9BD5'} !important;
}
.markdown-rendered-content .slide-column-header-neutral,
.slide-column-header-neutral {
  background-color: ${cfg.badgeNeutral?.border || '#cbd5e1'} !important;
}
.mermaid-card, .markdown-rendered-content .mermaid-card {
  background-color: ${cfg.mermaid?.bg || '#f8fafc'} !important;
  border-color: ${cfg.mermaid?.border || '#cbd5e1'} !important;
  border-left-color: ${cfg.mermaid?.borderLeft || '#2F5496'} !important;
}
.slide-column-content {
  display: flex;
  flex-direction: column;
  flex: 1 1 0%;
  width: 100%;
  box-sizing: border-box;
  gap: 12px;
  font-size: calc(${cfg.column?.fontSize || '0.95rem'} * var(--col-font-scale, 1));
}
.markdown-rendered-content .slide-column-content p,
.markdown-rendered-content .slide-column-content li,
.markdown-rendered-content .slide-column-content ul,
.markdown-rendered-content .slide-column-content ol,
.slide-column-content p,
.slide-column-content li,
.slide-column-content ul,
.slide-column-content ol {
  font-size: calc(${cfg.column?.fontSize || '0.95rem'} * var(--col-font-scale, 1));
}
.markdown-rendered-content .slide-column h3,
.slide-column .doc-h3 {
  font-size: calc(${cfg.h2.size} * var(--col-font-scale, 1));
}
.markdown-rendered-content .slide-column h4,
.slide-column .slide-column-header h4,
.slide-column .doc-h4 {
  font-size: calc(${cfg.h3.size} * var(--col-font-scale, 1));
}
.markdown-rendered-content .slide-column h5,
.slide-column .doc-h5 {
  font-size: calc(${cfg.h4.size} * var(--col-font-scale, 1));
}
.markdown-rendered-content .slide-column h6,
.slide-column .doc-h6 {
  font-size: calc(${cfg.h5?.size || '0.98rem'} * var(--col-font-scale, 1));
}
.markdown-rendered-content .slide-column blockquote,
.markdown-rendered-content .slide-column blockquote p {
  font-size: calc(${cfg.quote.size} * var(--col-font-scale, 1));
}
.markdown-rendered-content .slide-column .callout-header {
  font-size: calc(0.82rem * var(--col-font-scale, 1));
}
.markdown-rendered-content .slide-column .callout-body,
.markdown-rendered-content .slide-column .callout-body p,
.markdown-rendered-content .slide-column .callout-body li {
  font-size: calc(${cfg.column?.fontSize || '0.95rem'} * var(--col-font-scale, 1));
}
.markdown-rendered-content .slide-column pre,
.markdown-rendered-content .slide-column pre code {
  font-size: calc(${cfg.code.size} * var(--col-font-scale, 1));
}
.markdown-rendered-content .slide-column .badge {
  font-size: calc(${cfg.badge?.size || '0.82rem'} * var(--col-font-scale, 1));
}
.markdown-rendered-content .slide-column .doc-table th,
.markdown-rendered-content .slide-column .doc-table td {
  font-size: calc(${cfg.table.size} * var(--col-font-scale, 1));
}
.markdown-rendered-content .slide-column .metric-value {
  font-size: calc(${cfg.metric.size} * var(--col-font-scale, 1));
}
.markdown-rendered-content .slide-column .metric-label {
  font-size: calc(0.82rem * var(--col-font-scale, 1));
}
.markdown-rendered-content .slide-column .timeline-node {
  font-size: calc(${timelineNodeFontSize} * var(--col-font-scale, 1));
}
.markdown-rendered-content .slide-column .timeline-title {
  font-size: calc(${timelineTitleFontSize} * var(--col-font-scale, 1));
}
.markdown-rendered-content .slide-column .timeline-desc,
.markdown-rendered-content .slide-column .timeline-desc p {
  font-size: calc(${timelineDescFontSize} * var(--col-font-scale, 1));
}
.slide-column-content > *:first-child {
  margin-top: 0;
}
.slide-column-content > *:last-child {
  margin-bottom: 0;
}
.slide-column .metric-card {
  width: 100%;
  box-sizing: border-box;
}
.slide-column .slide-image-box {
  max-width: 100%;
  margin: 8px 0;
}
.slide-column .slide-image {
  max-width: 100%;
  height: auto;
}
@media (max-width: 768px) {
  .slide-columns-row {
    flex-direction: column !important;
    gap: 16px;
  }
}
.process-timeline::before {
  top: calc((${timelineNodeSize} - 3px) / 2);
}
.timeline-node-wrapper {
  height: ${timelineNodeSize};
}
.timeline-node {
  width: ${timelineNodeSize};
  height: ${timelineNodeSize};
  min-width: ${timelineNodeSize};
  min-height: ${timelineNodeSize};
  font-size: ${timelineNodeFontSize};
}
.timeline-title {
  font-size: ${timelineTitleFontSize};
}
.timeline-desc,
.timeline-desc p {
  font-size: ${timelineDescFontSize};
}
`;

  // Allègement de l'en-tête JSON : les images Base64 de fond de diapositive sont déjà écrites
  // dans les règles CSS ::after ci-dessus et restaurées par extractSlideBgImagesFromCss.
  const metaCfg = { ...cfg };
  if (metaCfg.coverSlide?.bgImage) {
      metaCfg.coverSlide = { ...metaCfg.coverSlide, bgImage: '' };
    }
    if (metaCfg.chapterSlide?.bgImage) {
      metaCfg.chapterSlide = { ...metaCfg.chapterSlide, bgImage: '' };
    }
    if (metaCfg.contentSlide && (metaCfg.contentSlide.bgImage || metaCfg.contentSlide.headerBgImage)) {
      metaCfg.contentSlide = {
        ...metaCfg.contentSlide,
        bgImage: '',
        headerBgImage: '',
      };
  }

  const metaJson = JSON.stringify(metaCfg);
  const metadataTag = `/* [md2print-config:mode=${mode}]\n${metaJson}\n[/md2print-config] */`;

  const usesPoppins = metaJson.includes('Poppins');
  const fontImport = usesPoppins
    ? `@import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,700&display=swap');\n\n`
    : '';

  return `${metadataTag}\n\n${fontImport}${baseCss}\n${overrides}`;
}
