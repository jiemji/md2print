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
    hMain: { font: 'Calibri Light', size: '2.4rem', color: '#C00000' },
    h1: { font: 'Calibri Light', size: '1.65rem', color: '#C00000' },
    h2: { font: 'Calibri Light', size: '1.35rem', color: '#2F5496' },
    h3: { font: 'Calibri Light', size: '1.18rem', color: '#2F5496' },
    h4: { font: 'Calibri Light', size: '1.05rem', color: '#2F5496' },
    body: { font: 'Calibri', size: '1rem', color: '#272727', lineHeight: '1.55' },
    link: { color: '#0563C1', hoverColor: '#104a8e' },
    metric: {
      font: 'Calibri Light',
      size: '4.5rem',
      valColor: '#C00000',
      accentColor: '#2F5496',
      labelColor: '#595959',
    },
    calloutNote: { border: '#2F5496', bg: '#f0f4f9', title: '#1f3b6c' },
    calloutTip: { border: '#70AD47', bg: '#f2f8ee', title: '#4d7a2f' },
    calloutWarning: { border: '#ED7D31', bg: '#fdf4ee', title: '#ad5319' },
    calloutDanger: { border: '#C00000', bg: '#fdf0f0', title: '#910000' },
    calloutImportant: { border: '#5B9BD5', bg: '#f1f7fc', title: '#2b6da8' },
    quote: { font: 'Calibri', size: '1.05rem', color: '#475569', border: '#2F5496' },
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
    page: { bgBackdrop: '#f1f5f9', bgPaper: '#ffffff', border: '#d1d5db' },
  },
  slide: {
    hMain: { font: 'Aptos Display', size: '2.8rem', color: '#0E2841' },
    h1: { font: 'Aptos Display', size: '2.3rem', color: '#0E2841' },
    h2: { font: 'Aptos Display', size: '1.85rem', color: '#0E2841' },
    h3: { font: 'Aptos Display', size: '1.35rem', color: '#0E2841' },
    h4: { font: 'Aptos Display', size: '1.15rem', color: '#64748b' },
    body: { font: 'Aptos', size: '1.25rem', color: '#1e293b', lineHeight: '1.6' },
    link: { color: '#C41718', hoverColor: '#FBAE40' },
    metric: {
      font: 'Aptos Display',
      size: '5.5rem',
      valColor: '#0E2841',
      accentColor: '#C41718',
      labelColor: '#64748b',
    },
    calloutNote: { border: '#0E2841', bg: '#f1f4f8', title: '#0E2841' },
    calloutTip: { border: '#196B24', bg: '#f0f7f1', title: '#196B24' },
    calloutWarning: { border: '#E97132', bg: '#fef3ec', title: '#E97132' },
    calloutDanger: { border: '#C41718', bg: '#fdf1f1', title: '#C41718' },
    calloutImportant: { border: '#0F9ED5', bg: '#eef8fc', title: '#0F9ED5' },
    quote: { font: 'Aptos', size: '1.25rem', color: '#1e293b', border: '#0E2841' },
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
}

.slide-main-title {
  font-family: '${cfg.hMain.font}', sans-serif;
  font-size: ${cfg.hMain.size};
  color: ${cfg.hMain.color};
}
.slide-chapter-title {
  font-family: '${cfg.h1.font}', sans-serif;
  font-size: ${cfg.h1.size};
  color: ${cfg.h1.color};
}
.slide-header-title {
  font-family: '${cfg.h2.font}', sans-serif;
  font-size: ${cfg.h2.size};
  color: ${cfg.h2.color};
}
.slide-body h3 {
  font-family: '${cfg.h3.font}', sans-serif;
  font-size: ${cfg.h3.size};
  color: ${cfg.h3.color};
}
.slide-body h4 {
  font-family: '${cfg.h4.font}', sans-serif;
  font-size: ${cfg.h4.size};
  color: ${cfg.h4.color};
}
.slide-body, .slide-body p, .slide-body li {
  font-family: '${cfg.body.font}', sans-serif;
  font-size: ${cfg.body.size};
  color: ${cfg.body.color};
  line-height: ${cfg.body.lineHeight};
}
.slide-body a {
  color: ${cfg.link.color};
}
.slide-body a:hover {
  color: ${cfg.link.hoverColor};
}
.slide-body .metric-card {
  border-top-color: ${cfg.metric.accentColor};
}
.slide-body .metric-value {
  font-family: '${cfg.metric.font}', sans-serif;
  font-size: ${cfg.metric.size};
  color: ${cfg.metric.valColor};
}
.slide-body .metric-label {
  color: ${cfg.metric.labelColor};
}
.slide-body blockquote {
  font-family: '${cfg.quote.font}', sans-serif;
  font-size: ${cfg.quote.size};
  color: ${cfg.quote.color};
  border-left-color: ${cfg.quote.border};
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

.doc-main-title {
  font-family: '${cfg.hMain.font}', sans-serif;
  font-size: ${cfg.hMain.size};
  color: ${cfg.hMain.color};
  border-bottom-color: ${cfg.hMain.color};
}
.doc-h2 {
  font-family: '${cfg.h1.font}', sans-serif;
  font-size: ${cfg.h1.size};
  color: ${cfg.h1.color};
}
.doc-h3 {
  font-family: '${cfg.h2.font}', sans-serif;
  font-size: ${cfg.h2.size};
  color: ${cfg.h2.color};
}
.doc-h4 {
  font-family: '${cfg.h3.font}', sans-serif;
  font-size: ${cfg.h3.size};
  color: ${cfg.h3.color};
}
.doc-h5 {
  font-family: '${cfg.h4.font}', sans-serif;
  font-size: ${cfg.h4.size};
  color: ${cfg.h4.color};
}
.markdown-rendered-content p, .markdown-rendered-content li {
  font-family: '${cfg.body.font}', sans-serif;
  font-size: ${cfg.body.size};
  color: ${cfg.body.color};
  line-height: ${cfg.body.lineHeight};
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
      this.configs[mode] = { ...this.configs[mode], ...customConfig };
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
        <div class="style-config-body">
          <!-- Colonne Gauche : Formulaire organisé en accordéons/cartes -->
          <div class="style-config-form-pane" id="styleConfigFormPane">
            
            <!-- 1. Titres & Hiérarchie -->
            <div class="config-card">
              <div class="config-card-header">
                <span class="config-card-title">Titres et Hiérarchie</span>
              </div>
              <div class="config-card-content">
                ${this.renderTagControlRow('hMain', 'Titre principal (# / Couverture)')}
                ${this.renderTagControlRow('h1', 'Titre 1 (## / Chapitre)')}
                ${this.renderTagControlRow('h2', 'Titre 2 (### / Sous-chapitre)')}
                ${this.renderTagControlRow('h3', 'Titre 3 (#### / Section)')}
                ${this.renderTagControlRow('h4', 'Titre 4 (##### / Sous-section)')}
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

            <!-- 4. Encarts d'alerte (Callouts) -->
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

            <!-- 5. Citations & Extraits -->
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

            <!-- 6. Code & Monospace -->
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
              </div>
            </div>

            <!-- 7. Tableaux -->
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

            <!-- 8. Arrière-plans globaux -->
            <div class="config-card">
              <div class="config-card-header">
                <span class="config-card-title">Arrière-plans et Structure</span>
              </div>
              <div class="config-card-content">
                <div class="config-row">
                  <div class="config-label-col">
                    <span class="config-tag-label">Couleurs de scène</span>
                  </div>
                  <div class="config-inputs-col">
                    <div class="input-inline-group">
                      <label class="input-sublabel">Fond général</label>
                      <input type="color" class="color-picker-input" data-bind="page.bgBackdrop">
                      <input type="text" class="text-input color-hex-input" data-bind="page.bgBackdrop" spellcheck="false">
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Fond document/diapo</label>
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

          <!-- Colonne Droite : Aperçu en Direct (Live Preview) -->
          <div class="style-config-preview-pane">
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
   * Génère le HTML d'une ligne de réglage pour un titre ou paragraphe.
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

    // Synchronisation en temps réel des inputs (color picker, hex text, font, size)
    this.container.addEventListener('input', (e) => {
      const target = e.target;
      const bind = target.getAttribute('data-bind');
      if (!bind) return;

      const val = target.value;
      this.setBindValue(bind, val);

      // Si c'est un sélecteur de couleur natif ou un texte hex, synchroniser son alter-ego
      if (target.classList.contains('color-picker-input')) {
        const textInput = this.container.querySelector(`.color-hex-input[data-bind="${bind}"]`);
        if (textInput) textInput.value = val.toUpperCase();
      } else if (target.classList.contains('color-hex-input')) {
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
          const picker = this.container.querySelector(`.color-picker-input[data-bind="${bind}"]`);
          if (picker) picker.value = val;
        }
      }

      this.updateLivePreview();
    });

    this.container.addEventListener('change', (e) => {
      const target = e.target;
      const bind = target.getAttribute('data-bind');
      if (!bind) return;
      this.setBindValue(bind, target.value);
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
        input.value = val;
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
        <div class="slide slide-content active" style="display: flex; flex-direction: column; width: 100%; height: 100%; box-shadow: none;">
          <div class="slide-inner slide-content-inner">
            <header class="slide-header">
              <span class="slide-chapter-tag">Stratégie 2026</span>
              <h2 class="slide-header-title">Évolution des Indicateurs Clés</h2>
            </header>
            <div class="slide-body">
              <p>Voici l'analyse trimestrielle des résultats avec <a href="#">un lien hypertexte interactif</a> et du code <code>const kpi = 100;</code>.</p>
              
              <div class="metric-card">
                <span class="metric-value">14.8M€</span>
                <span class="metric-label">Chiffre d'Affaires (+18%)</span>
              </div>

              <blockquote>
                La clarté et la concision garantissent l'impact des présentations de direction.
              </blockquote>

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
      `
      : `
        <article class="markdown-rendered-content" style="box-shadow: none; max-width: 100%; border: none; padding: 24px;">
          <h1 class="doc-heading doc-main-title">Rapport d'Activité Annuel</h1>
          
          <h2 class="doc-heading doc-h2">1. Synthèse des Résultats</h2>
          <p>Ce document illustre la mise en page paramétrée du rapport avec un <a href="#">lien hypertexte cliquable</a> et du code inline <code>data.status = 200</code>.</p>
          
          <h3 class="doc-heading doc-h3">1.1 Indicateurs de Performance</h3>
          
          <div class="metric-card">
            <span class="metric-value">14.8M€</span>
            <span class="metric-label">Chiffre d'Affaires Annuel</span>
          </div>

          <div class="callout callout-note">
            <div class="callout-title">Information importante</div>
            <p>La clôture des comptes s'effectue dans le respect des normes comptables établies.</p>
          </div>

          <blockquote>
            L'excellence opérationnelle commence par la rigueur documentaire.
          </blockquote>

          <h4 class="doc-heading doc-h4">1.1.1 Tableau récapitulatif</h4>
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
