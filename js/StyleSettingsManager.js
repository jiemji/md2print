/**
 * @module StyleSettingsManager
 * @description Contrôleur de la page de paramétrage interactif des styles, couleurs,
 * polices et tailles de police pour chaque type de balise (Vision Rapport et Vision Slide).
 * 
 * Fonctionne 100 % hors-ligne, sans dépendance externe ni icône.
 */

import { DEFAULT_REPORT_CSS, DEFAULT_SLIDE_CSS } from './defaultThemeStyles.js';

/**
 * Configuration par défaut des styles de balises extraite des chartes Word et PowerPoint.
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
      bg: '#f8fafc',
      border: '#cbd5e1',
      borderLeft: '#2F5496',
    },
    coverSlide: { bg: '#ffffff', bgImage: '', bgImageName: '', bgOpacity: 100, borderTopColor: '#C00000', borderTopWidth: 8 },
    chapterSlide: { bg: '#f8fafc', bgImage: '', bgImageName: '', bgOpacity: 100, borderLeftColor: '#C00000', borderLeftWidth: 10 },
    contentSlide: { headerBg: '#ffffff', borderTopColor: '#C00000', borderTopWidth: 6 },
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
      bg: '#f8fafc',
      border: '#cbd5e1',
      borderLeft: '#C41718',
    },
    coverSlide: { bg: '#ffffff', bgImage: '', bgImageName: '', bgOpacity: 100, borderTopColor: '#C41718', borderTopWidth: 8 },
    chapterSlide: { bg: '#f8fafc', bgImage: '', bgImageName: '', bgOpacity: 100, borderLeftColor: '#C41718', borderLeftWidth: 10 },
    contentSlide: { headerBg: '#ffffff', borderTopColor: '#C41718', borderTopWidth: 6 },
    page: { bgBackdrop: '#0b1120', bgPaper: '#ffffff', border: '#cbd5e1' },
  },
};

/**
 * Polices standard recommandées disponibles sur les systèmes Windows et Office.
 */
export const FONT_OPTIONS = [
  'Calibri',
  'Calibri Light',
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
 * @param {'report'|'slide'} mode - Mode cible
 * @param {object} config - Configuration des balises
 * @returns {string} Code CSS prêt à l'emploi
 */
export function generateThemeCss(mode, config) {
  const isSlide = mode === 'slide';
  const baseCss = isSlide ? DEFAULT_SLIDE_CSS : DEFAULT_REPORT_CSS;
  const cfg = config || DEFAULT_STYLE_CONFIG[mode];

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
  --slide-header-bg: ${cfg.contentSlide?.headerBg || '#ffffff'};
  --slide-mermaid-bg: ${cfg.mermaid?.bg || '#f8fafc'};
  --slide-mermaid-border: ${cfg.mermaid?.border || '#cbd5e1'};
  --slide-mermaid-border-left: ${cfg.mermaid?.borderLeft || '#C41718'};
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
}

.slide.slide-content .slide-header {
  background-color: ${cfg.contentSlide?.headerBg || '#ffffff'} !important;
  padding-top: 24px !important;
  padding-bottom: 14px !important;
  padding-left: 56px !important;
  padding-right: 56px !important;
  margin-bottom: 0 !important;
  width: 100% !important;
  box-sizing: border-box !important;
}

.slide.slide-content .slide-body {
  padding: 24px 56px 44px 56px !important;
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
  background-size: cover !important;
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
  background-size: cover !important;
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
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
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

  return `${baseCss}\n${overrides}`;
}

/**
 * Gestionnaire d'interface pour la page de configuration des styles de balises.
 */
export class StyleSettingsManager {
  /**
   * @param {object} options
   * @param {HTMLElement} options.container - Conteneur principal de la page de styles
   * @param {function} options.onApply - Callback appelé lors de l'application des styles
   * @param {function} options.onClose - Callback appelé lors de la fermeture
   */
  constructor(options = {}) {
    this.container = options.container;
    this.onApply = options.onApply || (() => {});
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
   * Définit une configuration personnalisée existante.
   * @param {'report'|'slide'} mode
   * @param {object} customConfig
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
   * Récupère la configuration courante pour un mode.
   * @param {'report'|'slide'} mode
   * @returns {object}
   */
  getConfig(mode) {
    return this.configs[mode];
  }

  /**
   * Initialise le composant dans le DOM.
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
   * Construit la structure HTML complète de la page de paramétrage.
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
            <button type="button" class="btn" id="btnExportStyleCss">Exporter CSS (.css)</button>
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
                    <span class="config-tag-label">Cadre Mermaid (schémas)</span>
                  </div>
                  <div class="config-inputs-col">
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
                <!-- Section spécifique Vision Slide : Couverture et Chapitre -->
                <div id="slideBackgroundsSection" class="slide-bg-section">
                  ${this.renderSlideBackgroundControlRow('coverSlide', 'Diapositive de Couverture (Slide #)')}
                  ${this.renderSlideBackgroundControlRow('chapterSlide', 'Diapositive de Chapitre (Slide ##)')}
                  <div class="config-row config-bg-row">
                    <div class="config-label-col">
                      <span class="config-tag-label">Bandeau de titre (Slide Contenu ###)</span>
                    </div>
                    <div class="config-inputs-col">
                      <div class="input-inline-group">
                        <label class="input-sublabel">Couleur du bandeau</label>
                        <input type="color" class="color-picker-input" data-bind="contentSlide.headerBg">
                        <input type="text" class="text-input color-hex-input" data-bind="contentSlide.headerBg" spellcheck="false">
                      </div>
                    </div>
                  </div>
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
   * Génère le HTML d'une ligne de réglage pour un titre avec police, taille, couleur, casse, gras et souligné.
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
   * Génère le HTML d'une ligne de réglage pour un fond de slide (couleur, image et transparence).
   */
  renderSlideBackgroundControlRow(bindKey, labelText) {
    return `
      <div class="config-row config-bg-row">
        <div class="config-label-col">
          <span class="config-tag-label">${labelText}</span>
        </div>
        <div class="config-inputs-col">
          <div class="input-inline-group">
            <label class="input-sublabel">Couleur de fond</label>
            <input type="color" class="color-picker-input" data-bind="${bindKey}.bg">
            <input type="text" class="text-input color-hex-input" data-bind="${bindKey}.bg" spellcheck="false">
          </div>
          <div class="input-inline-group">
            <label class="input-sublabel">Image de fond</label>
            <div class="file-picker-group">
              <input type="file" id="${bindKey}FileInput" class="hidden-input" accept="image/*">
              <button type="button" class="btn btn-sm" id="btnUpload_${bindKey}">Choisir image...</button>
              <button type="button" class="btn btn-sm" id="btnClear_${bindKey}">Supprimer</button>
            </div>
            <span class="file-name-indicator" id="${bindKey}_fileName">Aucune image</span>
          </div>
          <div class="input-inline-group">
            <label class="input-sublabel">Transparence (<span id="${bindKey}_opacityVal">100 %</span>)</label>
            <input type="range" min="0" max="100" class="range-slider" data-bind="${bindKey}.bgOpacity" id="${bindKey}_opacityRange">
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Génère le HTML d'une ligne de réglage simple (paragraphe, etc.).
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
   * Génère le HTML pour les réglages d'un callout.
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
   * Génère le HTML pour les réglages d'un badge ou tag inline.
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
   * Génère un menu déroulant de polices.
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
   * Associe les écouteurs d'événements interactifs.
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

    this.container.querySelector('#btnExportStyleCss')?.addEventListener('click', () => {
      this.handleExportCss();
    });

    this.container.querySelector('#btnResetStyleDefaults')?.addEventListener('click', () => {
      this.handleResetDefaults();
    });

    this.container.querySelector('#btnCloseStyleConfig')?.addEventListener('click', () => {
      this.onClose();
    });

    // Gestion du chargement d'image pour fond de couverture et de chapitre
    ['coverSlide', 'chapterSlide'].forEach((key) => {
      const fileInput = this.container.querySelector(`#${key}FileInput`);
      const uploadBtn = this.container.querySelector(`#btnUpload_${key}`);
      const clearBtn = this.container.querySelector(`#btnClear_${key}`);
      const fileNameLabel = this.container.querySelector(`#${key}_fileName`);

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
          this.setBindValue(`${key}.bgImage`, dataUrl);
          this.setBindValue(`${key}.bgImageName`, file.name);
          if (fileNameLabel) fileNameLabel.textContent = file.name;
          this.updateLivePreview();
        };
        reader.readAsDataURL(file);
      });

      clearBtn?.addEventListener('click', () => {
        this.setBindValue(`${key}.bgImage`, '');
        this.setBindValue(`${key}.bgImageName`, '');
        if (fileNameLabel) fileNameLabel.textContent = 'Aucune image';
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
      } else if (target.classList.contains('color-hex-input')) {
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
          const picker = this.container.querySelector(`.color-picker-input[data-bind="${bind}"]`);
          if (picker) picker.value = val;
        }
      } else if (target.classList.contains('range-slider')) {
        const key = bind.split('.')[0];
        const valSpan = this.container.querySelector(`#${key}_opacityVal`);
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

      if (target.classList.contains('range-slider')) {
        const key = bind.split('.')[0];
        const valSpan = this.container.querySelector(`#${key}_opacityVal`);
        if (valSpan) valSpan.textContent = `${val} %`;
      }

      this.updateLivePreview();
    });
  }

  /**
   * Modifie la valeur d'une clé imbriquée ('h1.color') dans l'objet de configuration actif.
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
   * Lit la valeur d'une clé imbriquée ('h1.color') depuis l'objet de configuration actif.
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
   * Bascule l'onglet de travail entre Rapport et Slide.
   * @param {'report'|'slide'} mode
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
   */
  updateFormValues() {
    const inputs = this.container.querySelectorAll('[data-bind]');
    inputs.forEach((input) => {
      const path = input.getAttribute('data-bind');
      const val = this.getBindValue(path);
      if (val !== undefined) {
        if (input.type === 'checkbox') {
          input.checked = Boolean(val);
        } else {
          input.value = val;
        }
      }
    });

    // Mettre à jour les indicateurs d'images et de curseurs d'opacité
    ['coverSlide', 'chapterSlide'].forEach((key) => {
      const fileNameLabel = this.container.querySelector(`#${key}_fileName`);
      const opacityVal = this.container.querySelector(`#${key}_opacityVal`);
      const opacityRange = this.container.querySelector(`#${key}_opacityRange`);
      const imgName = this.getBindValue(`${key}.bgImageName`);
      const hasImg = Boolean(this.getBindValue(`${key}.bgImage`));
      const opacity = this.getBindValue(`${key}.bgOpacity`) ?? 100;

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
   * Met à jour l'iframe d'aperçu en direct avec les styles actuels.
   */
  updateLivePreview() {
    if (!this.livePreviewFrame) return;

    const currentCfg = this.configs[this.activeMode];
    const generatedCss = generateThemeCss(this.activeMode, currentCfg);
    const isSlide = this.activeMode === 'slide';

    const sampleHtml = isSlide
      ? `
        <div class="preview-slides-stack" style="display: flex; flex-direction: column; gap: 24px; padding: 12px; box-sizing: border-box;">
          
          <!-- Diapositive 1 : Couverture (#) -->
          <div class="slide slide-title active" style="display: flex; width: 100%; min-height: 240px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); box-sizing: border-box;">
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

          <!-- Diapositive 2 : Chapitre (##) -->
          <div class="slide slide-chapter active" style="display: flex; width: 100%; min-height: 200px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); box-sizing: border-box;">
            <div class="slide-inner slide-chapter-inner">
              <div class="slide-chapter-card">
                <h2 class="slide-chapter-title">1. Contexte & Orientations</h2>
              </div>
            </div>
          </div>

          <!-- Diapositive 3 : Contenu standard (###) avec sous-titres #### et ##### -->
          <div class="slide slide-content active" style="display: flex; flex-direction: column; width: 100%; min-height: 380px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); box-sizing: border-box;">
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

                <figure class="mermaid-card" style="margin: 12px 0;">
                  <div class="mermaid-diagram" style="padding: 10px; display: flex; justify-content: center; align-items: center;">
                    <svg viewBox="0 0 360 80" style="width: 100%; max-height: 80px; display: block; margin: auto;">
                      <rect x="10" y="20" width="90" height="40" rx="4" fill="#e0f2fe" stroke="#0284c7" stroke-width="2"/>
                      <text x="55" y="45" font-family="sans-serif" font-size="12" text-anchor="middle" fill="#0369a1">Gitlab</text>
                      <line x1="100" y1="40" x2="250" y2="40" stroke="#0284c7" stroke-width="2"/>
                      <polygon points="250,36 260,40 250,44" fill="#0284c7"/>
                      <rect x="260" y="20" width="90" height="40" rx="4" fill="#fef3c7" stroke="#d97706" stroke-width="2"/>
                      <text x="305" y="45" font-family="sans-serif" font-size="12" text-anchor="middle" fill="#92400e">Runner</text>
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
   * Applique les styles et notifie l'application.
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
   */
  handleExportCss() {
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
   * Réinitialise les réglages du mode actif aux valeurs par défaut.
   */
  handleResetDefaults() {
    this.configs[this.activeMode] = JSON.parse(JSON.stringify(DEFAULT_STYLE_CONFIG[this.activeMode]));
    this.updateFormValues();
    this.updateLivePreview();
  }
}
