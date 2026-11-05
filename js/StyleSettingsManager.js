import { MERMAID_THEME_PRESETS } from './utils.js';
/**
 * @module StyleSettingsManager
 * @description Contrôleur de la page de paramétrage interactif des styles, couleurs,
 * polices et dimensions pour chaque type de balise (Vision Rapport et Vision Slide).
 * Gère également les arrière-plans d'images, l'opacité, la transparence des bandeaux,
 * les marges latérales et l'import/export de thèmes personnalisés.
 * 
 * Fonctionne 100 % hors-ligne, sans dépendance externe ni icône.
 * @requires module:defaultThemeStyles
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
 * @property {Object} column - Couleurs et marges des conteneurs multi-colonnes
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

  // Images de fond
  const coverImgMatches = [...css.matchAll(/\.slide\.slide-title::after\s*\{([^}]+)\}/g)];
  if (coverImgMatches.length > 0) {
    const lastCoverBlock = coverImgMatches[coverImgMatches.length - 1][1];
    const imgUrlMatch = lastCoverBlock.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/);
    if (imgUrlMatch && imgUrlMatch[1] && imgUrlMatch[1] !== 'none') {
      cfg.coverSlide.bgImage = imgUrlMatch[1];
      cfg.coverSlide.bgImageName = 'Image restaurée';
      const opMatch = lastCoverBlock.match(/opacity:\s*([\d.]+)/);
      if (opMatch) cfg.coverSlide.bgOpacity = Math.round(parseFloat(opMatch[1]) * 100);
    }
  }

  const chapterImgMatches = [...css.matchAll(/\.slide\.slide-chapter::after\s*\{([^}]+)\}/g)];
  if (chapterImgMatches.length > 0) {
    const lastChapterBlock = chapterImgMatches[chapterImgMatches.length - 1][1];
    const imgUrlMatch = lastChapterBlock.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/);
    if (imgUrlMatch && imgUrlMatch[1] && imgUrlMatch[1] !== 'none') {
      cfg.chapterSlide.bgImage = imgUrlMatch[1];
      cfg.chapterSlide.bgImageName = 'Image restaurée';
      const opMatch = lastChapterBlock.match(/opacity:\s*([\d.]+)/);
      if (opMatch) cfg.chapterSlide.bgOpacity = Math.round(parseFloat(opMatch[1]) * 100);
    }
  }

  const contentImgMatches = [...css.matchAll(/\.slide\.slide-content::after\s*\{([^}]+)\}/g)];
  if (contentImgMatches.length > 0) {
    const lastContentBlock = contentImgMatches[contentImgMatches.length - 1][1];
    const imgUrlMatch = lastContentBlock.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/);
    if (imgUrlMatch && imgUrlMatch[1] && imgUrlMatch[1] !== 'none') {
      if (!cfg.contentSlide) cfg.contentSlide = {};
      cfg.contentSlide.bgImage = imgUrlMatch[1];
      cfg.contentSlide.bgImageName = 'Image restaurée';
      const opMatch = lastContentBlock.match(/opacity:\s*([\d.]+)/);
      if (opMatch) cfg.contentSlide.bgOpacity = Math.round(parseFloat(opMatch[1]) * 100);
    }
  }

  const headerImgMatches = [...css.matchAll(/(?:\.slide\.slide-content\s+)?\.slide-header::after\s*\{([^}]+)\}/g)];
  if (headerImgMatches.length > 0) {
    const lastHeaderBlock = headerImgMatches[headerImgMatches.length - 1][1];
    const imgUrlMatch = lastHeaderBlock.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/);
    if (imgUrlMatch && imgUrlMatch[1] && imgUrlMatch[1] !== 'none') {
      if (!cfg.contentSlide) cfg.contentSlide = {};
      cfg.contentSlide.headerBgImage = imgUrlMatch[1];
      cfg.contentSlide.headerBgImageName = 'Image restaurée';
      const opMatch = lastHeaderBlock.match(/opacity:\s*([\d.]+)/);
      if (opMatch) cfg.contentSlide.headerBgOpacity = Math.round(parseFloat(opMatch[1]) * 100);
    }
  }

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
 * Génère le code CSS complet pour un mode donné ('report' ou 'slide') à partir de l'objet de configuration.
 * - Injecte les variables :root personnalisées (typographies, couleurs, liserés, fonds, métriques, marges latérales).
 * - Applique les règles impératives de confinement de diapositive, superposition d'images d'arrière-plan,
 *   transparence des bandeaux et disposition multi-colonnes flexible.
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
  border-top-color: ${cfg.metric.accentColor} !important;
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
.slide-column-content {
  display: flex !important;
  flex-direction: column !important;
  flex: 1 1 0% !important;
  min-height: 0 !important;
  width: 100% !important;
  box-sizing: border-box !important;
  gap: 10px;
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
  --report-mermaid-preset: ${cfg.mermaid?.preset || 'default'};
  --report-mermaid-bg: ${cfg.mermaid?.bg || '#f8fafc'};
  --report-mermaid-border: ${cfg.mermaid?.border || '#cbd5e1'};
  --report-mermaid-border-left: ${cfg.mermaid?.borderLeft || '#2F5496'};
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
`;

  const metadataTag = `/* [md2print-config:mode=${mode}]\n${JSON.stringify(cfg)}\n[/md2print-config] */`;

  const usesPoppins = JSON.stringify(cfg).includes('Poppins');
  const fontImport = usesPoppins
    ? `@import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,700&display=swap');\n\n`
    : '';

  return `${metadataTag}\n\n${fontImport}${baseCss}\n${overrides}`;
}

/**
 * Gestionnaire d'interface pour la page de configuration des styles de balises.
 */
export class StyleSettingsManager {
  /**
   * Crée une instance du gestionnaire de configuration des styles.
   * @param {Object} [options={}] - Options d'initialisation
   * @param {HTMLElement} [options.container] - Conteneur DOM principal de la vue de styles
   * @param {function({ reportCss: string, slideCss: string, configs: { report: StyleThemeConfig, slide: StyleThemeConfig } }): void} [options.onApply] - Callback appelé lors de l'application des styles
   * @param {function({ mode: 'report'|'slide', cssText: string, config: StyleThemeConfig }): Promise<void>|void} [options.onReset] - Callback appelé lors de la réinitialisation depuis les fichiers serveur
   * @param {function(): void} [options.onClose] - Callback appelé lors du retour à l'éditeur
   */
  constructor(options = {}) {
    this.container = options.container;
    this.onApply = options.onApply || (() => {});
    this.onReset = options.onReset || (() => {});
    this.onClose = options.onClose || (() => {});
    this.activeMode = 'report';

    // Clones indépendants des configurations par défaut
    this.configs = {
      report: JSON.parse(JSON.stringify(DEFAULT_STYLE_CONFIG.report)),
      slide: JSON.parse(JSON.stringify(DEFAULT_STYLE_CONFIG.slide)),
    };

    this.livePreviewFrame = null;
  }

  /**
   * Définit et fusionne une configuration personnalisée pour le mode spécifié.
   * Complète les clés absentes avec les valeurs par défaut de la charte.
   * @param {'report'|'slide'} mode - Mode ciblé ('report' ou 'slide')
   * @param {Partial<StyleThemeConfig>} customConfig - Objet de configuration à appliquer
   * @returns {void}
   */
  setConfig(mode, customConfig) {
    if (this.configs[mode] && customConfig && typeof customConfig === 'object') {
      const defaults = JSON.parse(JSON.stringify(DEFAULT_STYLE_CONFIG[mode]));
      this.configs[mode] = { ...defaults };
      for (const [key, val] of Object.entries(customConfig)) {
        if (val && typeof val === 'object' && !Array.isArray(val)) {
          this.configs[mode][key] = { ...(defaults[key] || {}), ...val };
        } else {
          this.configs[mode][key] = val;
        }
      }
    }
  }

  /**
   * Récupère l'objet de configuration complet du mode demandé.
   * @param {'report'|'slide'} mode - Mode ciblé ('report' ou 'slide')
   * @returns {StyleThemeConfig} Objet de configuration courant
   */
  getConfig(mode) {
    return this.configs[mode];
  }

  /**
   * Initialise le composant dans le DOM : rendu initial, attachement des écouteurs,
   * mise à jour des champs de formulaire et génération de l'aperçu dynamique.
   * @returns {void}
   */
  init() {
    if (!this.container) return;
    this.render();
    this.bindEvents();
    const slideBgSection = this.container.querySelector('#slideBackgroundsSection');
    if (slideBgSection) {
      slideBgSection.style.display = this.activeMode === 'slide' ? 'block' : 'none';
    }
    this.updateFormValues();
    this.updateLivePreview();
  }

  /**
   * Construit et injecte la structure HTML complète de la page de paramétrage
   * (barre d'outils, onglets de mode, cartes de contrôle des balises et panneau d'aperçu).
   * @returns {void}
   */
  render() {
    this.container.innerHTML = `
      <div class="style-config-wrapper">
        <!-- Barre supérieure d'outils -->
        <header class="style-config-toolbar">
          <div class="style-config-title-group">
            <span class="style-config-title">Paramétrage des styles et des balises</span>
            <div class="style-config-mode-tabs">
              <button type="button" class="tab-btn active" data-tab-mode="report" id="btnTabReport">Vision Rapport (Word)</button>
              <button type="button" class="tab-btn" data-tab-mode="slide" id="btnTabSlide">Vision Slide (PowerPoint)</button>
            </div>
          </div>
          <div class="style-config-actions">
            <button type="button" class="btn btn-primary" id="btnApplyStyleConfig">Appliquer les styles</button>
            <button type="button" class="btn" id="btnImportStyleConfig">Importer style (.css / .json)</button>
            <input type="file" id="styleConfigFileInput" class="hidden-input" accept=".css,.json">
            <button type="button" class="btn" id="btnExportStyleCss">Exporter CSS (.css)</button>
            <button type="button" class="btn" id="btnExportStyleJson">Exporter JSON (.json)</button>
            <button type="button" class="btn" id="btnResetStyleDefaults">Réinitialiser par défaut</button>
            <button type="button" class="btn" id="btnCloseStyleConfig">Retour à l'éditeur</button>
          </div>
        </header>

        <!-- Grille de travail : Formulaire à gauche / Aperçu à droite -->
        <div class="style-config-body" id="styleConfigBody">
          <!-- Colonne Gauche : Formulaire organisé en accordéons/cartes -->
          <div class="style-config-form-pane" id="styleConfigFormPane">
            
            <!-- 1. Titres & Hiérarchie -->
            <div class="config-card">
              <div class="config-card-header">
                <span class="config-card-title">Titres et Hiérarchie</span>
              </div>
              <div class="config-card-content">
                ${this.renderTitleControlRow('hMain', 'Titre # (Couverture / Titre principal)')}
                ${this.renderTitleControlRow('h1', 'Titre ## (Chapitre / Titre 1)')}
                ${this.renderTitleControlRow('h2', 'Titre ### (Slide de contenu / Titre 2)')}
                ${this.renderTitleControlRow('h3', 'Titre #### (Sous-titre de niveau 4 / Titre 3)')}
                ${this.renderTitleControlRow('h4', 'Titre ##### (Sous-titre de niveau 5 / Titre 4)')}
                ${this.renderTitleControlRow('h5', 'Titre ###### (Sous-titre de niveau 6 / Titre 5)')}
              </div>
            </div>

            <!-- 2. Corps de texte & Liens -->
            <div class="config-card">
              <div class="config-card-header">
                <span class="config-card-title">Corps de texte et Liens</span>
              </div>
              <div class="config-card-content">
                ${this.renderTagControlRow('body', 'Paragraphes et listes (p, li)')}
                <div class="config-row">
                  <div class="config-label-col">
                    <span class="config-tag-label">Interligne et Mise en page des Paragraphes</span>
                  </div>
                  <div class="config-inputs-col">
                    <div class="input-inline-group">
                      <label class="input-sublabel">Interligne</label>
                      <input type="text" class="text-input size-input" data-bind="body.lineHeight" placeholder="1.55">
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Espacement après</label>
                      <input type="text" class="text-input size-input" data-bind="body.spacing" placeholder="14px">
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Alignement</label>
                      <select class="select-input font-select" data-bind="body.textAlign">
                        <option value="left">Gauche</option>
                        <option value="justify">Justifié</option>
                        <option value="center">Centré</option>
                        <option value="right">Droite</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div class="config-row">
                  <div class="config-label-col">
                    <span class="config-tag-label">Liens hypertextes (a)</span>
                  </div>
                  <div class="config-inputs-col">
                    <div class="input-inline-group">
                      <label class="input-sublabel">Couleur normale</label>
                      <input type="color" class="color-picker-input" data-bind="link.color">
                      <input type="text" class="text-input color-hex-input" data-bind="link.color" spellcheck="false">
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Couleur survol</label>
                      <input type="color" class="color-picker-input" data-bind="link.hoverColor">
                      <input type="text" class="text-input color-hex-input" data-bind="link.hoverColor" spellcheck="false">
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 3. Cartouche métrique 5x (Donnée / Chiffre clé) -->
            <div class="config-card">
              <div class="config-card-header">
                <span class="config-card-title">Cartouche de données métrique 5x ([!data])</span>
              </div>
              <div class="config-card-content">
                <div class="config-row">
                  <div class="config-label-col">
                    <span class="config-tag-label">Chiffre clé / Valeur</span>
                  </div>
                  <div class="config-inputs-col">
                    <div class="input-inline-group">
                      <label class="input-sublabel">Police</label>
                      ${this.renderFontSelect('metric.font')}
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Taille (5x)</label>
                      <input type="text" class="text-input size-input" data-bind="metric.size" placeholder="4.5rem">
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Couleur valeur</label>
                      <input type="color" class="color-picker-input" data-bind="metric.valColor">
                      <input type="text" class="text-input color-hex-input" data-bind="metric.valColor" spellcheck="false">
                    </div>
                  </div>
                </div>
                <div class="config-row">
                  <div class="config-label-col">
                    <span class="config-tag-label">Liseré d'accent et Légende</span>
                  </div>
                  <div class="config-inputs-col">
                    <div class="input-inline-group">
                      <label class="input-sublabel">Liseré supérieur</label>
                      <input type="color" class="color-picker-input" data-bind="metric.accentColor">
                      <input type="text" class="text-input color-hex-input" data-bind="metric.accentColor" spellcheck="false">
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Couleur légende</label>
                      <input type="color" class="color-picker-input" data-bind="metric.labelColor">
                      <input type="text" class="text-input color-hex-input" data-bind="metric.labelColor" spellcheck="false">
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 4. Tags et Badges d'état ([badge:type:texte], Tag de chapitre) -->
            <div class="config-card">
              <div class="config-card-header">
                <span class="config-card-title">Tags et Badges d'état ([badge:type:texte], Tag de chapitre)</span>
              </div>
              <div class="config-card-content">
                <div class="config-row">
                  <div class="config-label-col">
                    <span class="config-tag-label">Tag de chapitre (Sur-titre de diapositive)</span>
                  </div>
                  <div class="config-inputs-col">
                    <div class="input-inline-group">
                      <label class="input-sublabel">Police</label>
                      ${this.renderFontSelect('chapterTag.font')}
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Taille</label>
                      <input type="text" class="text-input size-input" data-bind="chapterTag.size" placeholder="0.82rem">
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Couleur</label>
                      <input type="color" class="color-picker-input" data-bind="chapterTag.color">
                      <input type="text" class="text-input color-hex-input" data-bind="chapterTag.color" spellcheck="false">
                    </div>
                  </div>
                </div>

                <div class="config-row">
                  <div class="config-label-col">
                    <span class="config-tag-label">Typographie générale des badges inline</span>
                  </div>
                  <div class="config-inputs-col">
                    <div class="input-inline-group">
                      <label class="input-sublabel">Police</label>
                      ${this.renderFontSelect('badge.font')}
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Taille</label>
                      <input type="text" class="text-input size-input" data-bind="badge.size" placeholder="0.75rem">
                    </div>
                  </div>
                </div>

                ${this.renderBadgeRow('badgeInfo', 'Tag / Badge Info ([badge:info:...])')}
                ${this.renderBadgeRow('badgeSuccess', 'Tag / Badge Succès / Validé ([badge:success:...])')}
                ${this.renderBadgeRow('badgeWarning', 'Tag / Badge Avertissement ([badge:warning:...])')}
                ${this.renderBadgeRow('badgeDanger', 'Tag / Badge Danger / Critique ([badge:danger:...])')}
                ${this.renderBadgeRow('badgeImportant', 'Tag / Badge Important ([badge:important:...])')}
                ${this.renderBadgeRow('badgeNeutral', 'Tag / Badge Neutre ([badge:neutral:...])')}
              </div>
            </div>

            <!-- 5. Encarts d'alerte (Callouts) -->
            <div class="config-card">
              <div class="config-card-header">
                <span class="config-card-title">Encarts d'alerte et Recommandations (Callouts)</span>
              </div>
              <div class="config-card-content">
                ${this.renderCalloutRow('calloutNote', 'Note ([!note])')}
                ${this.renderCalloutRow('calloutTip', 'Conseil / Astuce ([!tip])')}
                ${this.renderCalloutRow('calloutWarning', 'Avertissement ([!warning])')}
                ${this.renderCalloutRow('calloutDanger', 'Danger / Critique ([!danger])')}
                ${this.renderCalloutRow('calloutImportant', 'Important ([!important])')}
              </div>
            </div>

            <!-- 6. Citations & Extraits -->
            <div class="config-card">
              <div class="config-card-header">
                <span class="config-card-title">Citations et Extraits (>)</span>
              </div>
              <div class="config-card-content">
                <div class="config-row">
                  <div class="config-label-col">
                    <span class="config-tag-label">Bloc citation (blockquote)</span>
                  </div>
                  <div class="config-inputs-col">
                    <div class="input-inline-group">
                      <label class="input-sublabel">Police</label>
                      ${this.renderFontSelect('quote.font')}
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Taille</label>
                      <input type="text" class="text-input size-input" data-bind="quote.size" placeholder="1.05rem">
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Interligne</label>
                      <input type="text" class="text-input size-input" data-bind="quote.lineHeight" placeholder="1.6">
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Couleur texte</label>
                      <input type="color" class="color-picker-input" data-bind="quote.color">
                      <input type="text" class="text-input color-hex-input" data-bind="quote.color" spellcheck="false">
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Bordure gauche</label>
                      <input type="color" class="color-picker-input" data-bind="quote.border">
                      <input type="text" class="text-input color-hex-input" data-bind="quote.border" spellcheck="false">
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 7. Code & Monospace -->
            <div class="config-card">
              <div class="config-card-header">
                <span class="config-card-title">Code et Monospace (pre, code)</span>
              </div>
              <div class="config-card-content">
                <div class="config-row">
                  <div class="config-label-col">
                    <span class="config-tag-label">Bloc de code (pre, code)</span>
                  </div>
                  <div class="config-inputs-col">
                    <div class="input-inline-group">
                      <label class="input-sublabel">Police</label>
                      ${this.renderFontSelect('code.font')}
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Taille</label>
                      <input type="text" class="text-input size-input" data-bind="code.size" placeholder="0.92rem">
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Couleur texte</label>
                      <input type="color" class="color-picker-input" data-bind="code.color">
                      <input type="text" class="text-input color-hex-input" data-bind="code.color" spellcheck="false">
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Fond</label>
                      <input type="color" class="color-picker-input" data-bind="code.bg">
                      <input type="text" class="text-input color-hex-input" data-bind="code.bg" spellcheck="false">
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Bordure</label>
                      <input type="color" class="color-picker-input" data-bind="code.border">
                      <input type="text" class="text-input color-hex-input" data-bind="code.border" spellcheck="false">
                    </div>
                  </div>
                </div>

                <div class="config-row">
                  <div class="config-label-col">
                    <span class="config-tag-label">Diagrammes Mermaid (schémas)</span>
                  </div>
                  <div class="config-inputs-col">
                    <div class="input-inline-group">
                      <label class="input-sublabel">Thème du schéma</label>
                      <select class="select-input font-select" data-bind="mermaid.preset">
                        <option value="default">Standard (Mermaid par défaut)</option>
                        <option value="noir-rouge">Noir &amp; Rouge (Éditorial)</option>
                        <option value="bleu-corporate">Bleu Corporate (Professionnel)</option>
                        <option value="sombre">Sombre (Fond sombre)</option>
                        <option value="colore">Coloré (Pastel)</option>
                        <option value="monochrome">Monochrome (Noir &amp; Blanc)</option>
                      </select>
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Filet vertical gauche</label>
                      <input type="color" class="color-picker-input" data-bind="mermaid.borderLeft">
                      <input type="text" class="text-input color-hex-input" data-bind="mermaid.borderLeft" spellcheck="false">
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Fond</label>
                      <input type="color" class="color-picker-input" data-bind="mermaid.bg">
                      <input type="text" class="text-input color-hex-input" data-bind="mermaid.bg" spellcheck="false">
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Bordure</label>
                      <input type="color" class="color-picker-input" data-bind="mermaid.border">
                      <input type="text" class="text-input color-hex-input" data-bind="mermaid.border" spellcheck="false">
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 8. Tableaux -->
            <div class="config-card">
              <div class="config-card-header">
                <span class="config-card-title">Tableaux (table, th, td)</span>
              </div>
              <div class="config-card-content">
                <div class="config-row">
                  <div class="config-label-col">
                    <span class="config-tag-label">En-tête de tableau (th)</span>
                  </div>
                  <div class="config-inputs-col">
                    <div class="input-inline-group">
                      <label class="input-sublabel">Police</label>
                      ${this.renderFontSelect('table.font')}
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Taille</label>
                      <input type="text" class="text-input size-input" data-bind="table.size" placeholder="0.95rem">
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Couleur texte</label>
                      <input type="color" class="color-picker-input" data-bind="table.headerColor">
                      <input type="text" class="text-input color-hex-input" data-bind="table.headerColor" spellcheck="false">
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Fond en-tête</label>
                      <input type="color" class="color-picker-input" data-bind="table.headerBg">
                      <input type="text" class="text-input color-hex-input" data-bind="table.headerBg" spellcheck="false">
                    </div>
                  </div>
                </div>
                <div class="config-row">
                  <div class="config-label-col">
                    <span class="config-tag-label">Corps et Cellules (td)</span>
                  </div>
                  <div class="config-inputs-col">
                    <div class="input-inline-group">
                      <label class="input-sublabel">Couleur texte</label>
                      <input type="color" class="color-picker-input" data-bind="table.cellColor">
                      <input type="text" class="text-input color-hex-input" data-bind="table.cellColor" spellcheck="false">
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Fond ligne paire</label>
                      <input type="color" class="color-picker-input" data-bind="table.rowAltBg">
                      <input type="text" class="text-input color-hex-input" data-bind="table.rowAltBg" spellcheck="false">
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Bordures</label>
                      <input type="color" class="color-picker-input" data-bind="table.border">
                      <input type="text" class="text-input color-hex-input" data-bind="table.border" spellcheck="false">
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 9. Arrière-plans globaux et de diapositives -->
            <div class="config-card">
              <div class="config-card-header">
                <span class="config-card-title">Arrière-plans et Structure</span>
              </div>
              <div class="config-card-content">
                <!-- Section spécifique Vision Slide : Couverture, Chapitre, Contenu et Bandeau -->
                <div id="slideBackgroundsSection" class="slide-bg-section">
                  ${this.renderSlideBackgroundControlRow('coverSlide', 'Diapositive de Couverture (Slide #)')}
                  ${this.renderSlideBackgroundControlRow('chapterSlide', 'Diapositive de Chapitre (Slide ##)')}
                  ${this.renderSlideBackgroundControlRow('contentSlide', 'Diapositive de Contenu (Slide ###)', 'bg', 'bgImage', 'bgOpacity', 'contentSlide', 'Couleur de fond')}
                  ${this.renderSlideBackgroundControlRow('contentSlide', 'Bandeau de titre (Slide Contenu ###)', 'headerBg', 'headerBgImage', 'headerBgOpacity', 'contentSlideHeader', 'Couleur du bandeau', true)}
                </div>

                <!-- Section spécifique Vision Slide : Liserés -->
                <div id="slideBordersSection" class="slide-borders-section">
                  <div class="config-row">
                    <div class="config-label-col">
                      <span class="config-tag-label">Liseré supérieur Couverture</span>
                    </div>
                    <div class="config-inputs-col">
                      <div class="input-inline-group">
                        <label class="input-sublabel">Couleur</label>
                        <input type="color" class="color-picker-input" data-bind="coverSlide.borderTopColor">
                        <input type="text" class="text-input color-hex-input" data-bind="coverSlide.borderTopColor" spellcheck="false">
                      </div>
                      <div class="input-inline-group">
                        <label class="input-sublabel">Épaisseur (px)</label>
                        <input type="number" min="0" max="40" class="text-input size-input" style="width: 75px;" data-bind="coverSlide.borderTopWidth" placeholder="8">
                      </div>
                    </div>
                  </div>

                  <div class="config-row">
                    <div class="config-label-col">
                      <span class="config-tag-label">Liseré gauche Chapitre</span>
                    </div>
                    <div class="config-inputs-col">
                      <div class="input-inline-group">
                        <label class="input-sublabel">Couleur</label>
                        <input type="color" class="color-picker-input" data-bind="chapterSlide.borderLeftColor">
                        <input type="text" class="text-input color-hex-input" data-bind="chapterSlide.borderLeftColor" spellcheck="false">
                      </div>
                      <div class="input-inline-group">
                        <label class="input-sublabel">Épaisseur (px)</label>
                        <input type="number" min="0" max="40" class="text-input size-input" style="width: 75px;" data-bind="chapterSlide.borderLeftWidth" placeholder="10">
                      </div>
                    </div>
                  </div>

                  <div class="config-row">
                    <div class="config-label-col">
                      <span class="config-tag-label">Liseré supérieur Contenu</span>
                    </div>
                    <div class="config-inputs-col">
                      <div class="input-inline-group">
                        <label class="input-sublabel">Couleur</label>
                        <input type="color" class="color-picker-input" data-bind="contentSlide.borderTopColor">
                        <input type="text" class="text-input color-hex-input" data-bind="contentSlide.borderTopColor" spellcheck="false">
                      </div>
                      <div class="input-inline-group">
                        <label class="input-sublabel">Épaisseur (px)</label>
                        <input type="number" min="0" max="40" class="text-input size-input" style="width: 75px;" data-bind="contentSlide.borderTopWidth" placeholder="6">
                      </div>
                    </div>
                  </div>

                  <div class="config-row">
                    <div class="config-label-col">
                      <span class="config-tag-label">Marges latérales Contenu (Slide ###)</span>
                    </div>
                    <div class="config-inputs-col">
                      <div class="input-inline-group">
                        <label class="input-sublabel">Gauche et droite (px)</label>
                        <input type="number" min="0" max="250" class="text-input size-input" style="width: 75px;" data-bind="contentSlide.paddingX" placeholder="56">
                      </div>
                    </div>
                  </div>
                </div>

                <div class="config-row">
                  <div class="config-label-col">
                    <span class="config-tag-label">Colonnes côte à côte ([colonne])</span>
                  </div>
                  <div class="config-inputs-col">
                    <div class="input-inline-group">
                      <label class="input-sublabel">Couleur de fond</label>
                      <input type="color" class="color-picker-input" data-bind="column.bg">
                      <input type="text" class="text-input color-hex-input" data-bind="column.bg" spellcheck="false">
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Bordure</label>
                      <input type="color" class="color-picker-input" data-bind="column.border">
                      <input type="text" class="text-input color-hex-input" data-bind="column.border" spellcheck="false">
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Arrondi</label>
                      <input type="text" class="text-input size-input" style="width: 75px;" data-bind="column.radius" placeholder="6px">
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Marge interne</label>
                      <input type="text" class="text-input size-input" style="width: 75px;" data-bind="column.padding" placeholder="14px">
                    </div>
                  </div>
                </div>

                <div class="config-row">
                  <div class="config-label-col">
                    <span class="config-tag-label">Scène et Diapositives standard</span>
                  </div>
                  <div class="config-inputs-col">
                    <div class="input-inline-group">
                      <label class="input-sublabel">Fond général</label>
                      <input type="color" class="color-picker-input" data-bind="page.bgBackdrop">
                      <input type="text" class="text-input color-hex-input" data-bind="page.bgBackdrop" spellcheck="false">
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Fond document/diapo standard</label>
                      <input type="color" class="color-picker-input" data-bind="page.bgPaper">
                      <input type="text" class="text-input color-hex-input" data-bind="page.bgPaper" spellcheck="false">
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Bordure</label>
                      <input type="color" class="color-picker-input" data-bind="page.border">
                      <input type="text" class="text-input color-hex-input" data-bind="page.border" spellcheck="false">
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <!-- Slider / Séparateur vertical redimensionnable -->
          <div class="style-config-resizer" id="styleConfigResizer" role="separator" aria-orientation="vertical" title="Glisser pour ajuster la largeur des panneaux"></div>

          <!-- Colonne Droite : Aperçu en Direct (Live Preview) -->
          <div class="style-config-preview-pane" id="styleConfigPreviewPane">
            <div class="preview-header-bar">
              <span class="preview-header-title">Aperçu en direct des balises personnalisées</span>
              <span class="preview-header-badge" id="previewModeBadge">Vision Rapport</span>
            </div>
            <div class="preview-canvas-container">
              <iframe id="styleSettingsPreviewFrame" class="style-settings-iframe" title="Aperçu des styles"></iframe>
            </div>
          </div>
        </div>
      </div>
    `;

    this.livePreviewFrame = document.getElementById('styleSettingsPreviewFrame');
  }

  /**
   * Génère le fragment HTML d'une ligne de réglage pour un titre.
   * Propose les contrôles pour la police, taille, couleur, casse, mise en gras et soulignement.
   * 
   * @param {string} bindKey - Clé de configuration liée (ex: 'hMain', 'h1', 'h2')
   * @param {string} labelText - Libellé descriptif du titre affiché dans la colonne d'en-tête
   * @returns {string} Fragment HTML de la ligne de configuration
   */
  renderTitleControlRow(bindKey, labelText) {
    return `
      <div class="config-row config-title-row">
        <div class="config-label-col">
          <span class="config-tag-label">${labelText}</span>
        </div>
        <div class="config-inputs-col">
          <div class="input-inline-group">
            <label class="input-sublabel">Police</label>
            ${this.renderFontSelect(`${bindKey}.font`)}
          </div>
          <div class="input-inline-group">
            <label class="input-sublabel">Taille</label>
            <input type="text" class="text-input size-input" data-bind="${bindKey}.size" placeholder="1.4rem">
          </div>
          <div class="input-inline-group">
            <label class="input-sublabel">Couleur</label>
            <input type="color" class="color-picker-input" data-bind="${bindKey}.color">
            <input type="text" class="text-input color-hex-input" data-bind="${bindKey}.color" spellcheck="false">
          </div>
          <div class="input-inline-group">
            <label class="input-sublabel">Casse</label>
            <select class="select-input font-select" data-bind="${bindKey}.transform">
              <option value="none">Normal</option>
              <option value="uppercase">Majuscules</option>
              <option value="capitalize">Capitalisé</option>
            </select>
          </div>
          <div class="input-inline-group">
            <label class="input-sublabel">Format</label>
            <div class="checkbox-inline-row">
              <label class="checkbox-inline-label">
                <input type="checkbox" class="config-checkbox" data-bind="${bindKey}.bold"> Gras
              </label>
              <label class="checkbox-inline-label">
                <input type="checkbox" class="config-checkbox" data-bind="${bindKey}.underline"> Souligné
              </label>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Génère le fragment HTML d'une ligne de réglage pour un fond de diapositive ou un bandeau
   * (sélecteur de couleur avec synchronisation hex, bascule de transparence facultative,
   * téléversement d'image encodée en base64, suppression et curseur d'opacité).
   * 
   * @param {string} bindKey - Clé racine de configuration (ex: 'coverSlide', 'chapterSlide', 'contentSlide')
   * @param {string} labelText - Libellé affiché pour la section
   * @param {string} [colorProp='bg'] - Propriété de couleur cible (ex: 'bg', 'headerBg')
   * @param {string} [imgProp='bgImage'] - Propriété d'image cible (ex: 'bgImage', 'headerBgImage')
   * @param {string} [opacityProp='bgOpacity'] - Propriété d'opacité cible (ex: 'bgOpacity', 'headerBgOpacity')
   * @param {string} [idPrefix=bindKey] - Préfixe d'identifiant DOM unique pour les boutons et indicateurs
   * @param {string} [colorLabel='Couleur de fond'] - Libellé du sous-champ couleur
   * @param {boolean} [allowTransparent=false] - Indique si le bouton d'activation de transparence doit être affiché
   * @returns {string} Fragment HTML de la ligne de configuration
   */
  renderSlideBackgroundControlRow(bindKey, labelText, colorProp = 'bg', imgProp = 'bgImage', opacityProp = 'bgOpacity', idPrefix = bindKey, colorLabel = 'Couleur de fond', allowTransparent = false) {
    return `
      <div class="config-row config-bg-row">
        <div class="config-label-col">
          <span class="config-tag-label">${labelText}</span>
        </div>
        <div class="config-inputs-col">
          <div class="input-inline-group">
            <label class="input-sublabel">${colorLabel}</label>
            <input type="color" class="color-picker-input" data-bind="${bindKey}.${colorProp}">
            <input type="text" class="text-input color-hex-input" data-bind="${bindKey}.${colorProp}" spellcheck="false" style="width: 86px;">
            ${allowTransparent ? `<button type="button" class="btn btn-sm btn-transparent-toggle" id="btnTransparent_${idPrefix}">Transparent</button>` : ''}
          </div>
          <div class="input-inline-group">
            <label class="input-sublabel">Image de fond</label>
            <div class="file-picker-group">
              <input type="file" id="${idPrefix}FileInput" class="hidden-input" accept="image/*">
              <button type="button" class="btn btn-sm" id="btnUpload_${idPrefix}">Choisir image...</button>
              <button type="button" class="btn btn-sm" id="btnClear_${idPrefix}">Supprimer</button>
            </div>
            <span class="file-name-indicator" id="${idPrefix}_fileName">Aucune image</span>
          </div>
          <div class="input-inline-group">
            <label class="input-sublabel">Transparence (<span id="${idPrefix}_opacityVal">100 %</span>)</label>
            <input type="range" min="0" max="100" class="range-slider" data-bind="${bindKey}.${opacityProp}" id="${idPrefix}_opacityRange">
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Génère le fragment HTML d'une ligne de réglage simple (police, taille, couleur).
   * 
   * @param {string} bindKey - Clé de configuration liée (ex: 'body', 'quote', 'chapterTag')
   * @param {string} labelText - Libellé affiché pour la balise
   * @returns {string} Fragment HTML de la ligne de configuration
   */
  renderTagControlRow(bindKey, labelText) {
    return `
      <div class="config-row">
        <div class="config-label-col">
          <span class="config-tag-label">${labelText}</span>
        </div>
        <div class="config-inputs-col">
          <div class="input-inline-group">
            <label class="input-sublabel">Police</label>
            ${this.renderFontSelect(`${bindKey}.font`)}
          </div>
          <div class="input-inline-group">
            <label class="input-sublabel">Taille</label>
            <input type="text" class="text-input size-input" data-bind="${bindKey}.size" placeholder="1.2rem">
          </div>
          <div class="input-inline-group">
            <label class="input-sublabel">Couleur</label>
            <input type="color" class="color-picker-input" data-bind="${bindKey}.color">
            <input type="text" class="text-input color-hex-input" data-bind="${bindKey}.color" spellcheck="false">
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Génère le fragment HTML pour les réglages d'un callout (bordure, fond et couleur de titre).
   * 
   * @param {string} bindKey - Clé de configuration liée (ex: 'calloutNote', 'calloutTip', 'calloutDanger')
   * @param {string} labelText - Libellé affiché pour le type de callout
   * @returns {string} Fragment HTML de la ligne de configuration
   */
  renderCalloutRow(bindKey, labelText) {
    return `
      <div class="config-row">
        <div class="config-label-col">
          <span class="config-tag-label">${labelText}</span>
        </div>
        <div class="config-inputs-col">
          <div class="input-inline-group">
            <label class="input-sublabel">Bordure</label>
            <input type="color" class="color-picker-input" data-bind="${bindKey}.border">
            <input type="text" class="text-input color-hex-input" data-bind="${bindKey}.border" spellcheck="false">
          </div>
          <div class="input-inline-group">
            <label class="input-sublabel">Fond</label>
            <input type="color" class="color-picker-input" data-bind="${bindKey}.bg">
            <input type="text" class="text-input color-hex-input" data-bind="${bindKey}.bg" spellcheck="false">
          </div>
          <div class="input-inline-group">
            <label class="input-sublabel">Titre</label>
            <input type="color" class="color-picker-input" data-bind="${bindKey}.title">
            <input type="text" class="text-input color-hex-input" data-bind="${bindKey}.title" spellcheck="false">
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Génère le fragment HTML pour les réglages d'un badge ou tag inline (texte, fond et bordure).
   * 
   * @param {string} bindKey - Clé de configuration liée (ex: 'badgeInfo', 'badgeSuccess')
   * @param {string} labelText - Libellé affiché pour le type de badge
   * @returns {string} Fragment HTML de la ligne de configuration
   */
  renderBadgeRow(bindKey, labelText) {
    return `
      <div class="config-row">
        <div class="config-label-col">
          <span class="config-tag-label">${labelText}</span>
        </div>
        <div class="config-inputs-col">
          <div class="input-inline-group">
            <label class="input-sublabel">Texte</label>
            <input type="color" class="color-picker-input" data-bind="${bindKey}.color">
            <input type="text" class="text-input color-hex-input" data-bind="${bindKey}.color" spellcheck="false">
          </div>
          <div class="input-inline-group">
            <label class="input-sublabel">Fond</label>
            <input type="color" class="color-picker-input" data-bind="${bindKey}.bg">
            <input type="text" class="text-input color-hex-input" data-bind="${bindKey}.bg" spellcheck="false">
          </div>
          <div class="input-inline-group">
            <label class="input-sublabel">Bordure</label>
            <input type="color" class="color-picker-input" data-bind="${bindKey}.border">
            <input type="text" class="text-input color-hex-input" data-bind="${bindKey}.border" spellcheck="false">
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Génère le fragment HTML d'une liste déroulante des polices standard disponibles.
   * 
   * @param {string} bindKey - Clé de configuration liée (ex: 'hMain.font', 'body.font')
   * @returns {string} Fragment HTML de l'élément select
   */
  renderFontSelect(bindKey) {
    const optionsHtml = FONT_OPTIONS.map((f) => `<option value="${f}">${f}</option>`).join('\n');
    return `
      <select class="select-input font-select" data-bind="${bindKey}">
        ${optionsHtml}
      </select>
    `;
  }

  /**
   * Associe l'ensemble des écouteurs d'événements interactifs :
   * - Bascule d'onglets Rapport / Slide
   * - Actions globales (application des styles, import/export CSS et JSON, réinitialisation)
   * - Chargement, prévisualisation et suppression d'images de fond
   * - Bascule de transparence pour bandeaux et conteneurs
   * - Redimensionnement par poignée séparatrice entre formulaire et aperçu
   * - Synchronisation temps réel des inputs et de la prévisualisation
   * @returns {void}
   */
  bindEvents() {
    // Bascule des onglets Rapport / Slide
    const btnReport = this.container.querySelector('#btnTabReport');
    const btnSlide = this.container.querySelector('#btnTabSlide');

    btnReport?.addEventListener('click', () => this.switchMode('report'));
    btnSlide?.addEventListener('click', () => this.switchMode('slide'));

    // Actions principales
    this.container.querySelector('#btnApplyStyleConfig')?.addEventListener('click', () => {
      this.handleApply();
    });

    // Importation de styles (.css ou .json)
    const btnImport = this.container.querySelector('#btnImportStyleConfig');
    const inputImport = this.container.querySelector('#styleConfigFileInput');
    btnImport?.addEventListener('click', () => {
      if (inputImport) {
        inputImport.value = '';
        inputImport.click();
      }
    });

    inputImport?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        if (file.name.toLowerCase().endsWith('.json')) {
          const parsed = JSON.parse(text);
          const targetMode = (parsed.report || parsed.slide) ? this.activeMode : this.activeMode;
          const cfgData = parsed[targetMode] || parsed;
          this.setConfig(targetMode, cfgData);
          this.updateFormValues();
          this.updateLivePreview();
          this.handleApply();
        } else {
          const parsed = parseConfigFromCss(text, this.activeMode);
          if (parsed?.config) {
            const targetMode = parsed.mode || this.activeMode;
            if (targetMode !== this.activeMode) {
              this.switchMode(targetMode);
            }
            this.setConfig(targetMode, parsed.config);
            this.updateFormValues();
            this.updateLivePreview();
            this.handleApply();
          }
        }
      } catch (err) {
        console.error('Erreur importation style :', err);
      }
    });

    this.container.querySelector('#btnExportStyleCss')?.addEventListener('click', () => {
      this.handleExportCss();
    });

    this.container.querySelector('#btnExportStyleJson')?.addEventListener('click', () => {
      this.handleExportJson();
    });

    this.container.querySelector('#btnResetStyleDefaults')?.addEventListener('click', async () => {
      await this.handleResetDefaults();
    });

    this.container.querySelector('#btnCloseStyleConfig')?.addEventListener('click', () => {
      this.onClose();
    });

    // Gestion du chargement d'image pour fond de couverture, de chapitre, contenu et bandeau de contenu
    const bgControllers = [
      { id: 'coverSlide', bindKey: 'coverSlide', imgProp: 'bgImage', nameProp: 'bgImageName' },
      { id: 'chapterSlide', bindKey: 'chapterSlide', imgProp: 'bgImage', nameProp: 'bgImageName' },
      { id: 'contentSlide', bindKey: 'contentSlide', imgProp: 'bgImage', nameProp: 'bgImageName' },
      { id: 'contentSlideHeader', bindKey: 'contentSlide', imgProp: 'headerBgImage', nameProp: 'headerBgImageName' },
    ];

    bgControllers.forEach(({ id, bindKey, imgProp, nameProp }) => {
      const fileInput = this.container.querySelector(`#${id}FileInput`);
      const uploadBtn = this.container.querySelector(`#btnUpload_${id}`);
      const clearBtn = this.container.querySelector(`#btnClear_${id}`);
      const fileNameLabel = this.container.querySelector(`#${id}_fileName`);

      uploadBtn?.addEventListener('click', () => {
        if (fileInput) {
          fileInput.value = '';
          fileInput.click();
        }
      });

      fileInput?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          const dataUrl = evt.target.result;
          this.setBindValue(`${bindKey}.${imgProp}`, dataUrl);
          this.setBindValue(`${bindKey}.${nameProp}`, file.name);
          if (fileNameLabel) fileNameLabel.textContent = file.name;
          this.updateLivePreview();
        };
        reader.readAsDataURL(file);
      });

      clearBtn?.addEventListener('click', () => {
        this.setBindValue(`${bindKey}.${imgProp}`, '');
        this.setBindValue(`${bindKey}.${nameProp}`, '');
        if (fileNameLabel) fileNameLabel.textContent = 'Aucune image';
        this.updateLivePreview();
      });
    });

    // Gestion du bouton de fond transparent (pour le bandeau de contenu ou autres éléments)
    this.container.querySelectorAll('.btn-transparent-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        const row = btn.closest('.input-inline-group');
        const hexInput = row?.querySelector('.color-hex-input');
        const colorPicker = row?.querySelector('.color-picker-input');
        const bind = hexInput?.getAttribute('data-bind');
        if (!bind) return;

        const currentVal = String(this.getBindValue(bind)).toLowerCase();
        if (currentVal === 'transparent') {
          const fallback = (colorPicker && /^#[0-9A-Fa-f]{6}$/.test(colorPicker.value)) ? colorPicker.value : '#ffffff';
          this.setBindValue(bind, fallback);
          if (hexInput) hexInput.value = fallback.toUpperCase();
          btn.classList.remove('btn-primary');
        } else {
          this.setBindValue(bind, 'transparent');
          if (hexInput) hexInput.value = 'transparent';
          btn.classList.add('btn-primary');
        }
        this.updateLivePreview();
      });
    });

    // Slider vertical : redimensionnement interactif entre panneau de paramètres et aperçu
    const resizer = this.container.querySelector('#styleConfigResizer');
    const configBody = this.container.querySelector('#styleConfigBody');
    const formPane = this.container.querySelector('#styleConfigFormPane');

    if (resizer && configBody && formPane) {
      let isDragging = false;

      resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isDragging = true;
        resizer.classList.add('is-resizing');
        document.body.classList.add('resizing-active');
      });

      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const rect = configBody.getBoundingClientRect();
        if (rect.width <= 0) return;
        const relativeX = e.clientX - rect.left;
        const pct = Math.min(80, Math.max(25, (relativeX / rect.width) * 100));
        const roundedPct = Math.round(pct * 10) / 10;
        formPane.style.width = `${roundedPct}%`;
        formPane.style.flex = `0 0 ${roundedPct}%`;
      });

      document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        resizer.classList.remove('is-resizing');
        document.body.classList.remove('resizing-active');
      });
    }

    // Synchronisation en temps réel des inputs (color picker, hex text, font, size, checkbox, range)
    this.container.addEventListener('input', (e) => {
      const target = e.target;
      const bind = target.getAttribute('data-bind');
      if (!bind) return;

      const val = target.type === 'checkbox' ? target.checked : target.value;
      this.setBindValue(bind, val);

      if (target.classList.contains('color-picker-input')) {
        const textInput = this.container.querySelector(`.color-hex-input[data-bind="${bind}"]`);
        if (textInput) textInput.value = val.toUpperCase();
        const transBtn = target.closest('.input-inline-group')?.querySelector('.btn-transparent-toggle');
        if (transBtn) transBtn.classList.remove('btn-primary');
      } else if (target.classList.contains('color-hex-input')) {
        const trimmed = String(val).trim().toLowerCase();
        const transBtn = target.closest('.input-inline-group')?.querySelector('.btn-transparent-toggle');
        if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
          const picker = this.container.querySelector(`.color-picker-input[data-bind="${bind}"]`);
          if (picker) picker.value = trimmed;
          if (transBtn) transBtn.classList.remove('btn-primary');
        } else if (trimmed === 'transparent' || trimmed === 'none') {
          this.setBindValue(bind, 'transparent');
          if (transBtn) transBtn.classList.add('btn-primary');
        }
      } else if (target.classList.contains('range-slider')) {
        const valSpan = target.id ? this.container.querySelector(`#${target.id.replace('Range', 'Val')}`) : null;
        if (valSpan) valSpan.textContent = `${val} %`;
      }

      this.updateLivePreview();
    });

    this.container.addEventListener('change', (e) => {
      const target = e.target;
      const bind = target.getAttribute('data-bind');
      if (!bind) return;
      const val = target.type === 'checkbox' ? target.checked : target.value;
      this.setBindValue(bind, val);

      if (target.classList.contains('color-hex-input')) {
        const trimmed = String(val).trim().toLowerCase();
        const transBtn = target.closest('.input-inline-group')?.querySelector('.btn-transparent-toggle');
        if (trimmed === 'transparent' || trimmed === 'none') {
          this.setBindValue(bind, 'transparent');
          target.value = 'transparent';
          if (transBtn) transBtn.classList.add('btn-primary');
        } else if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
          if (transBtn) transBtn.classList.remove('btn-primary');
        }
      } else if (target.classList.contains('range-slider')) {
        const valSpan = target.id ? this.container.querySelector(`#${target.id.replace('Range', 'Val')}`) : null;
        if (valSpan) valSpan.textContent = `${val} %`;
      }

      this.updateLivePreview();
    });
  }

  /**
   * Modifie la valeur d'une clé imbriquée (ex: 'contentSlide.paddingX', 'h1.color') dans l'objet de configuration actif.
   * Crée automatiquement les sous-objets intermédiaires si nécessaire.
   * 
   * @param {string} path - Chemin de la propriété séparé par des points
   * @param {*} value - Valeur à affecter
   * @returns {void}
   */
  setBindValue(path, value) {
    const parts = path.split('.');
    let curr = this.configs[this.activeMode];
    for (let i = 0; i < parts.length - 1; i++) {
      if (!curr[parts[i]]) curr[parts[i]] = {};
      curr = curr[parts[i]];
    }
    curr[parts[parts.length - 1]] = value;
  }

  /**
   * Lit la valeur d'une clé imbriquée (ex: 'contentSlide.paddingX', 'h1.color') depuis l'objet de configuration actif.
   * 
   * @param {string} path - Chemin de la propriété séparé par des points
   * @returns {*} Valeur extraite ou chaîne vide si non définie
   */
  getBindValue(path) {
    const parts = path.split('.');
    let curr = this.configs[this.activeMode];
    for (let i = 0; i < parts.length; i++) {
      if (!curr || curr[parts[i]] === undefined) return '';
      curr = curr[parts[i]];
    }
    return curr;
  }

  /**
   * Bascule l'onglet de travail entre la vision Rapport et la vision Diaporama.
   * Met à jour l'affichage des sections contextuelles et réactualise le formulaire et l'aperçu.
   * 
   * @param {'report'|'slide'} mode - Mode sélectionné ('report' ou 'slide')
   * @returns {void}
   */
  switchMode(mode) {
    this.activeMode = mode;
    this.container.querySelector('#btnTabReport')?.classList.toggle('active', mode === 'report');
    this.container.querySelector('#btnTabSlide')?.classList.toggle('active', mode === 'slide');

    const badge = this.container.querySelector('#previewModeBadge');
    if (badge) {
      badge.textContent = mode === 'slide' ? 'Vision Slide (16:9)' : 'Vision Rapport (Word)';
    }

    const slideBgSection = this.container.querySelector('#slideBackgroundsSection');
    if (slideBgSection) {
      slideBgSection.style.display = mode === 'slide' ? 'block' : 'none';
    }
    const slideBordersSection = this.container.querySelector('#slideBordersSection');
    if (slideBordersSection) {
      slideBordersSection.style.display = mode === 'slide' ? 'block' : 'none';
    }

    this.updateFormValues();
    this.updateLivePreview();
  }

  /**
   * Met à jour l'ensemble des champs du formulaire avec les valeurs du mode actif.
   * Synchronise les sélecteurs, inputs hexadécimaux, boutons de transparence et indicateurs d'images.
   * 
   * @returns {void}
   */
  updateFormValues() {
    const inputs = this.container.querySelectorAll('[data-bind]');
    inputs.forEach((input) => {
      const path = input.getAttribute('data-bind');
      const val = this.getBindValue(path);
      if (val !== undefined) {
        if (input.type === 'checkbox') {
          input.checked = Boolean(val);
        } else if (input.type === 'color') {
          if (String(val).toLowerCase() === 'transparent') {
            // Un input[type="color"] ne supporte pas "transparent", on n'écrase pas sa valeur
          } else if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
            input.value = val;
          }
        } else {
          input.value = val;
        }
      }
    });

    // Mettre à jour l'état visuel des boutons Transparent
    this.container.querySelectorAll('.btn-transparent-toggle').forEach((btn) => {
      const hexInput = btn.closest('.input-inline-group')?.querySelector('.color-hex-input');
      const bind = hexInput?.getAttribute('data-bind');
      if (bind) {
        const val = String(this.getBindValue(bind)).toLowerCase();
        btn.classList.toggle('btn-primary', val === 'transparent');
      }
    });

    // Mettre à jour les indicateurs d'images et de curseurs d'opacité
    const bgControllers = [
      { id: 'coverSlide', bindKey: 'coverSlide', imgProp: 'bgImage', nameProp: 'bgImageName', opacityProp: 'bgOpacity' },
      { id: 'chapterSlide', bindKey: 'chapterSlide', imgProp: 'bgImage', nameProp: 'bgImageName', opacityProp: 'bgOpacity' },
      { id: 'contentSlide', bindKey: 'contentSlide', imgProp: 'bgImage', nameProp: 'bgImageName', opacityProp: 'bgOpacity' },
      { id: 'contentSlideHeader', bindKey: 'contentSlide', imgProp: 'headerBgImage', nameProp: 'headerBgImageName', opacityProp: 'headerBgOpacity' },
    ];

    bgControllers.forEach(({ id, bindKey, imgProp, nameProp, opacityProp }) => {
      const fileNameLabel = this.container.querySelector(`#${id}_fileName`);
      const opacityVal = this.container.querySelector(`#${id}_opacityVal`);
      const opacityRange = this.container.querySelector(`#${id}_opacityRange`);
      const imgName = this.getBindValue(`${bindKey}.${nameProp}`);
      const hasImg = Boolean(this.getBindValue(`${bindKey}.${imgProp}`));
      const opacity = this.getBindValue(`${bindKey}.${opacityProp}`) ?? 100;

      if (fileNameLabel) {
        fileNameLabel.textContent = imgName || (hasImg ? 'Image configurée' : 'Aucune image');
      }
      if (opacityVal) {
        opacityVal.textContent = `${opacity} %`;
      }
      if (opacityRange) {
        opacityRange.value = opacity;
      }
    });
  }

  /**
   * Régénère à la volée le CSS compilé et actualise le document HTML de l'iframe d'aperçu dynamique.
   * 
   * @returns {void}
   */
  updateLivePreview() {
    if (!this.livePreviewFrame) return;

    const currentCfg = this.configs[this.activeMode];
    const generatedCss = generateThemeCss(this.activeMode, currentCfg);
    const isSlide = this.activeMode === 'slide';
    const presetKey = currentCfg.mermaid?.preset || 'default';
    const presetInfo = MERMAID_THEME_PRESETS[presetKey] || MERMAID_THEME_PRESETS.default;
    const sampleColors = presetInfo.sampleColors;

    const sampleHtml = isSlide
      ? `
        <div class="preview-slides-stack" style="display: flex; flex-direction: column; gap: 24px; padding: 12px; box-sizing: border-box;">
          
          <!-- Diapositive 1 : Couverture (#) calibrée en 1707x960 et mise à l'échelle -->
          <div class="preview-slide-viewport" style="width: 100%; position: relative; overflow: hidden; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            <div class="slide slide-title active" style="display: flex; width: 1707px; height: 960px; min-height: 960px; position: absolute; top: 0; left: 0; transform-origin: top left; transform: scale(var(--slide-scale, 0.35)); box-sizing: border-box;">
              <div class="slide-inner slide-title-inner">
                <div class="slide-title-card">
                  <h1 class="slide-main-title">Présentation Stratégique</h1>
                  <div class="slide-title-meta">
                    <span class="slide-title-metadata">Sous-titre et métadonnées</span>
                    <span class="slide-title-date">02/11/2026</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Diapositive 2 : Chapitre (##) calibrée en 1707x960 et mise à l'échelle -->
          <div class="preview-slide-viewport" style="width: 100%; position: relative; overflow: hidden; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            <div class="slide slide-chapter active" style="display: flex; width: 1707px; height: 960px; min-height: 960px; position: absolute; top: 0; left: 0; transform-origin: top left; transform: scale(var(--slide-scale, 0.35)); box-sizing: border-box;">
              <div class="slide-inner slide-chapter-inner">
                <div class="slide-chapter-card">
                  <h2 class="slide-chapter-title">1. Contexte & Orientations</h2>
                </div>
              </div>
            </div>
          </div>

          <!-- Diapositive 3 : Contenu standard (###) calibrée sur une largeur de référence de 1707px -->
          <div class="preview-slide-viewport" data-auto-height="true" style="width: 100%; position: relative; overflow: hidden; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            <div class="slide slide-content active" style="display: flex; flex-direction: column; width: 1707px; height: auto; min-height: 960px; max-height: none; position: absolute; top: 0; left: 0; transform-origin: top left; transform: scale(var(--slide-scale, 0.35)); box-sizing: border-box;">
            <div class="slide-inner slide-content-inner">
              <header class="slide-header">
                <span class="slide-chapter-tag">Stratégie 2026</span>
                <h2 class="slide-header-title">Évolution des Indicateurs Clés</h2>
              </header>
              <div class="slide-body">
                <p>Voici l'analyse des résultats avec <a href="#">un lien hypertexte interactif</a> et du code <code>const kpi = 100;</code>.</p>
                
                <h4>Sous-titre de niveau 4 (####)</h4>
                <p>Détail de la sous-section pour valider la typographie et la casse.</p>

                <h5>Sous-titre de niveau 5 (#####)</h5>
                <p>Précision opérationnelle affichée dans la diapositive.</p>

                <h6>Sous-titre de niveau 6 (######)</h6>
                <p>Dernier niveau de titre hiérarchique.</p>

                <p style="display: flex; gap: 16px; width: 100%; margin: 14px 0;">
                  <span class="metric-card" style="flex: 1;">
                    <span class="metric-value">14.8M€</span>
                    <span class="metric-label">Chiffre d'Affaires (+18%)</span>
                  </span>
                  <span class="metric-card metric-card-success" style="flex: 1;">
                    <span class="metric-value">99.9%</span>
                    <span class="metric-label">Disponibilité Système</span>
                  </span>
                </p>

                <p style="margin: 10px 0;">
                  <span class="badge badge-info">Q4 2026</span>
                  <span class="badge badge-success">Objectif Atteint</span>
                  <span class="badge badge-warning">À surveiller</span>
                  <span class="badge badge-danger">Bloquant</span>
                </p>

                <blockquote>
                  La clarté et la concision garantissent l'impact des présentations de direction.
                </blockquote>

                <div class="slide-columns-row" style="margin: 12px 0;">
                  <div class="slide-column">
                    <div class="slide-column-content">
                      <p style="margin: 0; font-weight: 700;">Colonne 1</p>
                      <p style="margin: 0;">Analyse qualitative et synthèse des observations.</p>
                    </div>
                  </div>
                  <div class="slide-column">
                    <div class="slide-column-content">
                      <p style="margin: 0; font-weight: 700;">Colonne 2</p>
                      <p style="margin: 0;">Recommandations et plan de mise en œuvre.</p>
                    </div>
                  </div>
                </div>

                <figure class="mermaid-card" style="margin: 12px 0;">
                  <div class="mermaid-diagram" style="padding: 10px; display: flex; justify-content: center; align-items: center;">
                    <svg viewBox="0 0 360 80" style="width: 100%; max-height: 80px; display: block; margin: auto;">
                      <rect x="10" y="20" width="90" height="40" rx="4" fill="${sampleColors.node1}" stroke="${sampleColors.stroke1}" stroke-width="2"/>
                      <text x="55" y="45" font-family="sans-serif" font-size="12" text-anchor="middle" fill="${sampleColors.text1}">Gitlab</text>
                      <line x1="100" y1="40" x2="250" y2="40" stroke="${sampleColors.line}" stroke-width="2"/>
                      <polygon points="250,36 260,40 250,44" fill="${sampleColors.line}"/>
                      <rect x="260" y="20" width="90" height="40" rx="4" fill="${sampleColors.node2}" stroke="${sampleColors.stroke2}" stroke-width="2"/>
                      <text x="305" y="45" font-family="sans-serif" font-size="12" text-anchor="middle" fill="${sampleColors.text2}">Runner</text>
                    </svg>
                  </div>
                </figure>

                <div class="table-responsive-wrapper">
                  <table class="doc-table">
                    <thead>
                      <tr>
                        <th>Catégorie</th>
                        <th>Objectif</th>
                        <th>Réalisé</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Performances</td>
                        <td>12 000</td>
                        <td>14 850</td>
                      </tr>
                      <tr>
                        <td>Disponibilité</td>
                        <td>99.9%</td>
                        <td>99.98%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          </div>

        </div>
      `
      : `
        <article class="markdown-rendered-content" style="box-shadow: none; max-width: 100%; border: none; padding: 24px;">
          <h1 class="doc-heading doc-main-title">Rapport d'Activité Annuel</h1>
          
          <h2 class="doc-heading doc-h2">1. Synthèse des Résultats</h2>
          <p>Ce document illustre la mise en page paramétrée du rapport avec un <a href="#">lien hypertexte cliquable</a> et du code inline <code>data.status = 200</code>.</p>
          
          <h3 class="doc-heading doc-h3">1.1 Indicateurs de Performance</h3>
          <p>Détails des indicateurs clés de la période.</p>

          <h4 class="doc-heading doc-h4">1.1.1 Tableau récapitulatif</h4>
          <p>Sous-section de niveau 4.</p>

          <h5 class="doc-heading doc-h5">1.1.1.1 Sous-section de niveau 5</h5>
          <p>Point opérationnel pour tester le titre de niveau 5.</p>

          <h6 class="doc-heading doc-h6">1.1.1.1.1 Sous-section de niveau 6</h6>
          <p>Point de conformité de niveau 6.</p>
          
          <div class="metric-card">
            <span class="metric-value">14.8M€</span>
            <span class="metric-label">Chiffre d'Affaires Annuel</span>
          </div>

          <div class="callout callout-note">
            <div class="callout-title">Information importante</div>
            <p>La clôture des comptes s'effectue dans le respect des normes comptables établies.</p>
          </div>

          <p style="margin: 12px 0;">
            <span class="badge badge-info">Information</span>
            <span class="badge badge-success">Validé</span>
            <span class="badge badge-warning">En attente</span>
            <span class="badge badge-danger">Critique</span>
            <span class="badge badge-important">Priorité Haute</span>
            <span class="badge badge-neutral">V1.4</span>
          </p>

          <blockquote>
            L'excellence opérationnelle commence par la rigueur documentaire.
          </blockquote>

          <div class="slide-columns-row" style="margin: 14px 0;">
            <div class="slide-column">
              <div class="slide-column-content">
                <p style="margin: 0; font-weight: 700;">Volet A</p>
                <p style="margin: 0;">Indicateurs et constats préliminaires.</p>
              </div>
            </div>
            <div class="slide-column">
              <div class="slide-column-content">
                <p style="margin: 0; font-weight: 700;">Volet B</p>
                <p style="margin: 0;">Mesures correctives et calendrier prévisionnel.</p>
              </div>
            </div>
          </div>

          <figure class="mermaid-card" style="margin: 12px 0;">
            <div class="mermaid-diagram" style="padding: 10px; display: flex; justify-content: center; align-items: center;">
              <svg viewBox="0 0 360 80" style="width: 100%; max-height: 80px; display: block; margin: auto;">
                <rect x="10" y="20" width="90" height="40" rx="4" fill="${sampleColors.node1}" stroke="${sampleColors.stroke1}" stroke-width="2"/>
                <text x="55" y="45" font-family="sans-serif" font-size="12" text-anchor="middle" fill="${sampleColors.text1}">Gitlab</text>
                <line x1="100" y1="40" x2="250" y2="40" stroke="${sampleColors.line}" stroke-width="2"/>
                <polygon points="250,36 260,40 250,44" fill="${sampleColors.line}"/>
                <rect x="260" y="20" width="90" height="40" rx="4" fill="${sampleColors.node2}" stroke="${sampleColors.stroke2}" stroke-width="2"/>
                <text x="305" y="45" font-family="sans-serif" font-size="12" text-anchor="middle" fill="${sampleColors.text2}">Runner</text>
              </svg>
            </div>
          </figure>

          <div class="table-responsive-wrapper">
            <table class="doc-table">
              <thead>
                <tr>
                  <th>Indicateur</th>
                  <th>Valeur</th>
                  <th>Progression</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Trafic mensuel</td>
                  <td>120 000</td>
                  <td>+14%</td>
                </tr>
                <tr>
                  <td>Conversion</td>
                  <td>4.8%</td>
                  <td>+0.6%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <pre><code>// Exemple d'automatisation
const report = generateReport({ format: 'docx', template: 'isec' });
console.log(report.status);</code></pre>
        </article>
      `;

    const docContent = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,700&display=swap" rel="stylesheet">
  <style>
    ${generatedCss}
    html, body {
      margin: 0;
      padding: 16px;
      height: 100%;
      overflow-y: auto;
      box-sizing: border-box;
    }
  </style>
</head>
<body data-view-mode="${this.activeMode}">
  ${sampleHtml}
  <script>
    (function() {
      function updatePreviewSlidesScale() {
        var viewports = document.querySelectorAll('.preview-slide-viewport');
        viewports.forEach(function(vp) {
          var slide = vp.querySelector('.slide');
          if (!slide) return;
          var w = vp.clientWidth;
          if (w > 0) {
            var scale = w / 1707;
            vp.style.setProperty('--slide-scale', scale.toFixed(6));
            var h = vp.getAttribute('data-auto-height') === 'true'
              ? Math.max(960, slide.scrollHeight)
              : 960;
            vp.style.height = Math.round(h * scale) + 'px';
          }
        });
      }
      updatePreviewSlidesScale();
      requestAnimationFrame(updatePreviewSlidesScale);
      window.addEventListener('resize', updatePreviewSlidesScale);
      if (typeof ResizeObserver !== 'undefined') {
        var ro = new ResizeObserver(updatePreviewSlidesScale);
        if (document.body) ro.observe(document.body);
      }
    })();
  </script>
</body>
</html>`;

    const doc = this.livePreviewFrame.contentDocument || this.livePreviewFrame.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(docContent);
      doc.close();
    }
  }

  /**
   * Applique les styles et notifie l'application parente via le callback onApply.
   * @returns {void}
   */
  handleApply() {
    const reportCss = generateThemeCss('report', this.configs.report);
    const slideCss = generateThemeCss('slide', this.configs.slide);
    this.onApply({
      reportCss,
      slideCss,
      configs: JSON.parse(JSON.stringify(this.configs)),
    });
  }

  /**
   * Télécharge le fichier CSS généré pour le mode actif.
   * Déclenche également l'application et la persistance immédiate dans l'application.
   * @returns {void}
   */
  handleExportCss() {
    this.handleApply();
    const mode = this.activeMode;
    const cssText = generateThemeCss(mode, this.configs[mode]);
    const blob = new Blob([cssText], { type: 'text/css;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `md2print-${mode}-personnalise.css`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Télécharge la configuration JSON du mode actif.
   * Déclenche également l'application et la persistance immédiate dans l'application.
   * @returns {void}
   */
  handleExportJson() {
    this.handleApply();
    const mode = this.activeMode;
    const jsonText = JSON.stringify(this.configs[mode], null, 2);
    const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `md2print-${mode}-config.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Réinitialise les réglages du mode actif en rechargeant la feuille CSS correspondante depuis le serveur.
   * Si le fichier serveur est introuvable ou inaccessible, bascule sur la configuration par défaut intégrée.
   * Notifie l'application parente pour purger les surcharges sauvegardées dans IndexedDB.
   * @returns {Promise<void>}
   */
  async handleResetDefaults() {
    const mode = this.activeMode;
    const serverCssPath = mode === 'slide' ? 'css/slide.css' : 'css/report.css';
    let cssText = '';

    try {
      const res = await fetch(`${serverCssPath}?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        cssText = await res.text();
        const parsed = parseConfigFromCss(cssText, mode);
        if (parsed?.config) {
          this.configs[mode] = parsed.config;
        } else {
          this.configs[mode] = JSON.parse(JSON.stringify(DEFAULT_STYLE_CONFIG[mode]));
        }
      } else {
        this.configs[mode] = JSON.parse(JSON.stringify(DEFAULT_STYLE_CONFIG[mode]));
        cssText = mode === 'slide' ? DEFAULT_SLIDE_CSS : DEFAULT_REPORT_CSS;
      }
    } catch {
      this.configs[mode] = JSON.parse(JSON.stringify(DEFAULT_STYLE_CONFIG[mode]));
      cssText = mode === 'slide' ? DEFAULT_SLIDE_CSS : DEFAULT_REPORT_CSS;
    }

    this.updateFormValues();
    this.updateLivePreview();

    if (typeof this.onReset === 'function') {
      await this.onReset({
        mode,
        cssText,
        config: JSON.parse(JSON.stringify(this.configs[mode])),
      });
    }
  }
}
