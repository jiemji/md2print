/**
 * @module StyleSettingsManager
 * @description Contrôleur de la page de paramétrage interactif des styles, couleurs,
 * polices et dimensions pour chaque type de balise (Vision Rapport et Vision Slide).
 * Gère également les arrière-plans d'images, l'opacité, la transparence des bandeaux,
 * les marges latérales, la taille du texte des colonnes, et l'import/export de thèmes personnalisés.
 *
 * Fonctionne 100 % hors-ligne, sans dépendance externe ni icône.
 * @requires module:utils
 * @requires module:themeCssEngine
 */
import {
  MERMAID_THEME_PRESETS,
  compressImageDataUrl,
  readAndCompressImageFile,
  compressEmbeddedImagesInText,
} from './utils.js';
import {
  DEFAULT_STYLE_CONFIG,
  FONT_OPTIONS,
  parseConfigFromCss,
  generateThemeCss,
} from './themeCssEngine.js';

export { DEFAULT_STYLE_CONFIG, FONT_OPTIONS, parseConfigFromCss, generateThemeCss };

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
                    <div class="input-inline-group">
                      <label class="input-sublabel">Taille du texte</label>
                      <input type="text" class="text-input size-input" style="width: 75px;" data-bind="column.fontSize" placeholder="1rem">
                    </div>
                  </div>
                </div>

                <div class="config-row">
                  <div class="config-label-col">
                    <span class="config-tag-label">Frise chronologique ([frise])</span>
                  </div>
                  <div class="config-inputs-col">
                    <div class="input-inline-group">
                      <label class="input-sublabel">Diamètre des cercles</label>
                      <input type="text" class="text-input size-input" style="width: 75px;" data-bind="timeline.nodeSize" placeholder="57px">
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Police des bulles</label>
                      <input type="text" class="text-input size-input" style="width: 75px;" data-bind="timeline.nodeFontSize" placeholder="0.88rem">
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Police du titre</label>
                      <input type="text" class="text-input size-input" style="width: 75px;" data-bind="timeline.titleFontSize" placeholder="0.95rem">
                    </div>
                    <div class="input-inline-group">
                      <label class="input-sublabel">Police des sous-titres</label>
                      <input type="text" class="text-input size-input" style="width: 75px;" data-bind="timeline.descFontSize" placeholder="0.82rem">
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
        const rawText = await file.text();
        if (file.name.toLowerCase().endsWith('.json')) {
          const parsed = JSON.parse(rawText);
          const targetMode = (parsed.report || parsed.slide) ? this.activeMode : this.activeMode;
          const cfgData = parsed[targetMode] || parsed;
          for (const sectionKey of ['coverSlide', 'chapterSlide', 'contentSlide']) {
            if (cfgData?.[sectionKey]?.bgImage) {
              cfgData[sectionKey].bgImage = await compressImageDataUrl(cfgData[sectionKey].bgImage);
            }
            if (cfgData?.[sectionKey]?.headerBgImage) {
              cfgData[sectionKey].headerBgImage = await compressImageDataUrl(
                cfgData[sectionKey].headerBgImage
              );
            }
          }
          this.setConfig(targetMode, cfgData);
          this.updateFormValues();
          this.updateLivePreview();
          this.handleApply();
        } else {
          const text = await compressEmbeddedImagesInText(rawText);
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

      fileInput?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const dataUrl = await readAndCompressImageFile(file);
          this.setBindValue(`${bindKey}.${imgProp}`, dataUrl);
          this.setBindValue(`${bindKey}.${nameProp}`, file.name);
          if (fileNameLabel) fileNameLabel.textContent = file.name;
          this.updateLivePreview();
        } catch (err) {
          console.error('Erreur lecture/compression image de fond :', err);
        }
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
                  <div class="slide-column has-column-header">
                    <div class="slide-column-header">
                      <h4 class="doc-heading doc-h4">Colonne 1</h4>
                    </div>
                    <div class="slide-column-content">
                      <p style="margin: 0;">Analyse qualitative et synthèse des observations.</p>
                    </div>
                  </div>
                  <div class="slide-column has-column-header">
                    <div class="slide-column-header slide-column-header-colored slide-column-header-info">
                      <h4 class="doc-heading doc-h4">Colonne 2</h4>
                    </div>
                    <div class="slide-column-content">
                      <p style="margin: 0;">Recommandations et plan de mise en œuvre.</p>
                    </div>
                  </div>
                </div>

                <div class="process-timeline-wrapper" style="margin: 12px 0;">
                  <div class="process-timeline" style="--timeline-steps: 3;">
                    <div class="timeline-step">
                      <div class="timeline-node-wrapper">
                        <div class="timeline-node timeline-node-primary">T0</div>
                      </div>
                      <div class="timeline-content">
                        <div class="timeline-title">Détection</div>
                        <div class="timeline-desc">Alerte initiale</div>
                      </div>
                    </div>
                    <div class="timeline-step">
                      <div class="timeline-node-wrapper">
                        <div class="timeline-node timeline-node-warning">4 h</div>
                      </div>
                      <div class="timeline-content">
                        <div class="timeline-title">Qualification</div>
                        <div class="timeline-desc">Analyse d'impact</div>
                      </div>
                    </div>
                    <div class="timeline-step">
                      <div class="timeline-node-wrapper">
                        <div class="timeline-node timeline-node-success">24 h</div>
                      </div>
                      <div class="timeline-content">
                        <div class="timeline-title">Clôture</div>
                        <div class="timeline-desc">Retour nominal</div>
                      </div>
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
            <div class="slide-column has-column-header">
              <div class="slide-column-header">
                <h4 class="doc-heading doc-h4">Volet A</h4>
              </div>
              <div class="slide-column-content">
                <p style="margin: 0;">Indicateurs et constats préliminaires.</p>
              </div>
            </div>
            <div class="slide-column has-column-header">
              <div class="slide-column-header slide-column-header-colored slide-column-header-info">
                <h4 class="doc-heading doc-h4">Volet B</h4>
              </div>
              <div class="slide-column-content">
                <p style="margin: 0;">Mesures correctives et calendrier prévisionnel.</p>
              </div>
            </div>
          </div>

          <div class="process-timeline-wrapper" style="margin: 14px 0;">
            <div class="process-timeline" style="--timeline-steps: 3;">
              <div class="timeline-step">
                <div class="timeline-node-wrapper">
                  <div class="timeline-node timeline-node-primary">T0</div>
                </div>
                <div class="timeline-content">
                  <div class="timeline-title">Initialisation</div>
                  <div class="timeline-desc">Lancement du chantier</div>
                </div>
              </div>
              <div class="timeline-step">
                <div class="timeline-node-wrapper">
                  <div class="timeline-node timeline-node-warning">J+15</div>
                </div>
                <div class="timeline-content">
                  <div class="timeline-title">Contrôle</div>
                  <div class="timeline-desc">Revue intermédiaire</div>
                </div>
              </div>
              <div class="timeline-step">
                <div class="timeline-node-wrapper">
                  <div class="timeline-node timeline-node-success">J+30</div>
                </div>
                <div class="timeline-content">
                  <div class="timeline-title">Validation</div>
                  <div class="timeline-desc">Mise en production</div>
                </div>
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
