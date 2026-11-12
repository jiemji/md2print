/**
 * @module app
 * @description Contrôleur principal de l'application SPA md2print.
 * Orchestre les interactions utilisateur, la manipulation de cartouches graphiques dépliables
 * et déplaçables par glisser-déposer (.image-cartouche, .mermaid-cartouche, .html-cartouche),
 * la synchronisation temps réel entre l'éditeur Markdown et l'aperçu WYSIWYG (rapport paginé et diaporamas 16:9),
 * le volet de sommaire hiérarchique (#, ##, ###), le masquage adaptatif de l'éditeur pour l'affichage plein écran,
 * la gestion du thème (sombre, sépia), la persistance locale IndexedDB, et les exportations documentaires
 * (HTML autonome, Word .docx, PowerPoint .pptx).
 * @requires module:utils
 * @requires module:EditorEngine
 * @requires module:StorageService
 * @requires module:defaultThemeStyles
 * @requires module:StyleSettingsManager
 * @requires module:HtmlGenerator
 * @requires module:DocxGenerator
 * @requires module:PptxGenerator
 * @requires module:SlidePlanner
 */
import {
  toSlug,
  escapeHtml,
  extractTitle,
  downloadBlob,
  showToast,
  readFileAsText,
  readFileAsArrayBuffer,
  readFileAsDataURL,
  compressImageDataUrl,
  readAndCompressImageFile,
  compressEmbeddedImagesInText,
  resolveImagePaths,
  pruneUnusedLocalImages,
  renderMermaidBlocksMap,
  setMermaidTheme,
  ensureHighlightLoadedIfNeeded,
} from './utils.js';
import {
  createCartoucheElement,
  createMermaidCartoucheElement,
  createHtmlCartoucheElement,
  serializeEditorToMarkdown,
  getEditorSelectionOffsets,
  restoreEditorSelectionOffsets,
  setEditorContent,
  findDomPosition,
  insertNodeAtEditorCaret,
  ensureTrailingSentinel,
  clearCartoucheSelectionStyles,
  updateCartoucheSelectionHighlight,
  handleCartoucheDeletion,
  getDraggedCartouche,
  setDraggedCartouche,
  getCaretRangeFromPoint,
} from './EditorEngine.js';
import {
  savePreferences,
  saveCustomTemplate,
  saveCustomPptTemplate,
  saveCustomCss,
  saveThemeConfigs,
  clearCustomConfigAndTemplate,
  clearCustomStyles,
  removeCustomStyleForMode,
  saveDraftState,
  clearDraftState,
  loadStoredState,
} from './StorageService.js';
import { DEFAULT_REPORT_CSS, DEFAULT_SLIDE_CSS } from './defaultThemeStyles.js';
import { parseConfigFromCss } from './themeCssEngine.js';
import { generateStandaloneHTML, updateIframePreview, extractTOC } from './HtmlGenerator.js';
import { planSlides, findSlideIndexForLine } from './SlidePlanner.js';

/**
 * @typedef {Object} AppState
 * @property {string} markdown - Contenu textuel Markdown brut ou sérialisé
 * @property {string} currentFileName - Nom du fichier de travail en cours
 * @property {boolean} isDirty - Vrai si des modifications locales non enregistrées sont présentes
 * @property {File[]} folderFiles - Liste des fichiers Markdown chargés depuis un dossier
 * @property {string} selectedFolderIndex - Index du fichier actuellement sélectionné dans le dossier
 * @property {Record<string, string>} localImages - Dictionnaire des images Base64 associées aux jetons
 * @property {number} imageSeq - Compteur séquentiel d'identifiants d'images insérées
 * @property {Array<Object>|null} plannedSlides - Planification des diapositives en vision slide
 * @property {'report'|'slide'} currentViewport - Mode d'affichage actif (Rapport continu ou Diaporama 16:9)
 * @property {'dark'|'sepia'} theme - Thème visuel de l'interface (sombre ou sépia)
 * @property {number} editorWidthPct - Largeur en pourcentage du volet éditeur (ex: 50)
 * @property {Object|null} outputConfig - Configuration de rendu DOCX/PPTX
 * @property {string} configFileName - Nom lisible du fichier de configuration actif
 * @property {ArrayBuffer|null} templateBuffer - Contenu binaire du modèle Word (.docx)
 * @property {string} templateFileName - Nom lisible du modèle Word
 * @property {ArrayBuffer|null} pptTemplateBuffer - Contenu binaire du modèle PowerPoint (.potx)
 * @property {string} pptTemplateFileName - Nom lisible du modèle PowerPoint
 * @property {string|null} reportCss - Feuille de style CSS personnalisée pour le mode Rapport
 * @property {string|null} slideCss - Feuille de style CSS personnalisée pour le mode Slide
 * @property {string|null} customCssFileName - Nom du fichier CSS personnalisé chargé
 * @property {Object|null} themeConfigs - Configurations de styles pour chaque mode ('report', 'slide')
 * @property {boolean} syncScroll - Vrai si le défilement lié entre l'éditeur et l'aperçu est activé
 * @property {boolean} isEditorHidden - Vrai si le panneau éditeur Markdown est masqué (plein écran aperçu)
 */

// --- État Applicatif Singleton ---
/** @type {AppState} */
const state = {
  markdown: '',
  currentFileName: 'Sans titre.md',
  isDirty: false,
  folderFiles: [],
  selectedFolderIndex: '',
  localImages: {},
  imageSeq: 1,
  plannedSlides: null,
  currentViewport: 'report', // 'report' | 'slide'
  theme: 'dark', // 'dark' | 'sepia'
  editorWidthPct: 50,
  outputConfig: null,
  configFileName: 'output_config.json (défaut)',
  templateBuffer: null,
  templateFileName: 'Modele_word.docx (défaut)',
  pptTemplateBuffer: null,
  pptTemplateFileName: 'Modele_presentation.potx (défaut)',
  reportCss: null,
  slideCss: null,
  customCssFileName: null,
  themeConfigs: null,
  syncScroll: true,
  isEditorHidden: false,
};

// --- Cache des Références DOM ---
const dom = {};

/**
 * Initialise et met en cache toutes les références DOM de l'interface.
 * @returns {void}
 */
const initDomRefs = () => {
  dom.dropdownBurger = document.getElementById('dropdownBurger');
  dom.btnToggleBurger = document.getElementById('btnToggleBurger');
  dom.burgerMenu = document.getElementById('burgerMenu');
  dom.btnNewFile = document.getElementById('btnNewFile');
  dom.btnOpenFile = document.getElementById('btnOpenFile');
  dom.fileInput = document.getElementById('fileInput');
  dom.btnOpenFolder = document.getElementById('btnOpenFolder');
  dom.folderInput = document.getElementById('folderInput');
  dom.folderFileSelect = document.getElementById('folderFileSelect');
  dom.btnSaveFile = document.getElementById('btnSaveFile');
  dom.currentFileName = document.getElementById('currentFileName');

  dom.btnViewReport = document.getElementById('btnViewReport');
  dom.btnViewSlide = document.getElementById('btnViewSlide');
  dom.btnToggleSyncScroll = document.getElementById('btnToggleSyncScroll');

  dom.btnOpenStyleSettings = document.getElementById('btnOpenStyleSettings');
  dom.dropdownConfig = document.getElementById('dropdownConfig');
  dom.btnToggleConfig = document.getElementById('btnToggleConfig');
  dom.configStatusText = document.getElementById('configStatusText');
  dom.btnMenuOpenStyleSettings = document.getElementById('btnMenuOpenStyleSettings');
  dom.btnLoadTemplateDocx = document.getElementById('btnLoadTemplateDocx');
  dom.templateDocxInput = document.getElementById('templateDocxInput');
  dom.btnLoadTemplatePptx = document.getElementById('btnLoadTemplatePptx');
  dom.templatePptxInput = document.getElementById('templatePptxInput');
  dom.btnLoadCustomCss = document.getElementById('btnLoadCustomCss');
  dom.customCssInput = document.getElementById('customCssInput');
  dom.btnResetConfig = document.getElementById('btnResetConfig');
  dom.btnResetConfigMenu = document.getElementById('btnResetConfigMenu');

  dom.dropdownExport = document.getElementById('dropdownExport');
  dom.btnToggleExport = document.getElementById('btnToggleExport');
  dom.btnExportHtml = document.getElementById('btnExportHtml');
  dom.btnExportDocx = document.getElementById('btnExportDocx');
  dom.btnExportPptx = document.getElementById('btnExportPptx');

  dom.btnToggleTheme = document.getElementById('btnToggleTheme');
  dom.btnToggleEditor = document.getElementById('btnToggleEditor');

  dom.workspace = document.getElementById('workspace');
  dom.pageStyleConfig = document.getElementById('pageStyleConfig');
  dom.paneEditor = document.getElementById('paneEditor');
  dom.mdEditor = document.getElementById('mdEditor');
  dom.paneResizer = document.getElementById('paneResizer');
  dom.panePreview = document.getElementById('panePreview');
  dom.previewIframe = document.getElementById('previewIframe');
  dom.toastContainer = document.getElementById('toastContainer');
};

// --- Initialisation Globale ---
document.addEventListener('DOMContentLoaded', async () => {
  initDomRefs();
  await restoreFromIndexedDB();
  await loadDefaultConfigAndTemplate();
  initEventListeners();
  initResizer();
  updateFileNameDisplay();
  updatePreview();
});

/**
 * Génère un identifiant court unique pour une nouvelle image importée en Base64.
 * @returns {string}
 */
function getNextImageId() {
  return `img-${state.imageSeq++}`;
}

/**
 * Calcule le prochain compteur séquentiel d'image (imageSeq) afin d'éviter toute collision
 * avec les identifiants img-N déjà présents dans localImages ou dans le texte Markdown.
 * @param {string} markdownText
 * @param {Record<string, string>} localImages
 * @param {number} [savedSeq=1]
 * @returns {number}
 */
function computeNextImageSeq(markdownText = '', localImages = {}, savedSeq = 1) {
  let maxId = 0;

  for (const key of Object.keys(localImages)) {
    const m = key.match(/^img-(\d+)$/);
    if (m) {
      const num = Number(m[1]);
      if (num > maxId) maxId = num;
    }
  }

  const tokenRegex = /\(img-(\d+)\)/gi;
  let match;
  while ((match = tokenRegex.exec(markdownText)) !== null) {
    const num = Number(match[1]);
    if (num > maxId) maxId = num;
  }

  const baseSeq = typeof savedSeq === 'number' && savedSeq > 0 ? savedSeq : 1;
  return Math.max(baseSeq, maxId + 1);
}

// --- Persistance IndexedDB (Brouillon, Images Base64 & Préférences UI) ---

let draftSaveTimer = null;

/**
 * Sauvegarde les préférences d'affichage (thème, mode Rapport/Slide et largeur de l'éditeur) dans IndexedDB.
 * @returns {Promise<void>}
 */
async function persistPreferencesNow() {
  await savePreferences({
    theme: state.theme,
    currentViewport: state.currentViewport,
    editorWidthPct: state.editorWidthPct,
    syncScroll: state.syncScroll,
  });
}

/**
 * Sauvegarde immédiatement le brouillon courant et le dictionnaire d'images Base64 dans IndexedDB.
 * @returns {Promise<void>}
 */
async function persistDraftNow() {
  if (draftSaveTimer) {
    clearTimeout(draftSaveTimer);
    draftSaveTimer = null;
  }

  pruneUnusedLocalImages(state.markdown, state.localImages);

  await saveDraftState({
    markdown: state.markdown,
    currentFileName: state.currentFileName,
    isDirty: state.isDirty,
    imageSeq: state.imageSeq,
    localImages: state.localImages,
  });
}

/**
 * Planifie la sauvegarde du brouillon et des images dans IndexedDB avec un léger debounce.
 * @param {number} [delay=60] - Délai en millisecondes
 * @returns {void}
 */
function scheduleDraftSave(delay = 60) {
  if (draftSaveTimer) clearTimeout(draftSaveTimer);
  draftSaveTimer = setTimeout(() => {
    draftSaveTimer = null;
    persistDraftNow();
  }, delay);
}

/**
 * Restaure les préférences d'interface, le brouillon Markdown, les images Base64
 * et les fichiers de configuration/modèle personnalisés depuis IndexedDB au démarrage.
 * @returns {Promise<void>}
 */
async function restoreFromIndexedDB() {
  const {
    prefs,
    draft,
    localImages,
    customConfig,
    customTemplate,
    customPptTemplate,
    customCss,
    customThemeConfigs,
  } = await loadStoredState();

  if (prefs) {
    if (prefs.theme === 'dark' || prefs.theme === 'sepia') {
      state.theme = prefs.theme;
      document.documentElement.setAttribute('data-theme', state.theme);
      if (dom.btnToggleTheme) {
        dom.btnToggleTheme.textContent =
          state.theme === 'dark' ? 'Thème : Sombre' : 'Thème : Sépia';
      }
    }
    if (prefs.currentViewport === 'report' || prefs.currentViewport === 'slide') {
      state.currentViewport = prefs.currentViewport;
      dom.btnViewReport?.classList.toggle('active', state.currentViewport === 'report');
      dom.btnViewSlide?.classList.toggle('active', state.currentViewport === 'slide');
    }
    if (
      typeof prefs.editorWidthPct === 'number' &&
      prefs.editorWidthPct >= 20 &&
      prefs.editorWidthPct <= 80
    ) {
      state.editorWidthPct = prefs.editorWidthPct;
      if (dom.paneEditor) {
        dom.paneEditor.style.width = `${state.editorWidthPct}%`;
      }
    }
    if (typeof prefs.syncScroll === 'boolean') {
      state.syncScroll = prefs.syncScroll;
    }
  }

  updateSyncScrollUI();

  if (customConfig?.outputConfig && typeof customConfig.outputConfig === 'object') {
    state.outputConfig = customConfig.outputConfig;
    state.configFileName = customConfig.configFileName || 'Configuration personnalisée';
  }

  if (customTemplate?.templateBuffer instanceof ArrayBuffer) {
    state.templateBuffer = customTemplate.templateBuffer;
    state.templateFileName = customTemplate.templateFileName || 'Modèle Word personnalisé';
  }

  if (customPptTemplate?.pptTemplateBuffer instanceof ArrayBuffer) {
    state.pptTemplateBuffer = customPptTemplate.pptTemplateBuffer;
    state.pptTemplateFileName = customPptTemplate.pptTemplateFileName || 'Modèle PPT personnalisé';
  }

  if (customCss) {
    if (customCss.reportCss) state.reportCss = customCss.reportCss;
    if (customCss.slideCss) state.slideCss = customCss.slideCss;
    state.customCssFileName = customCss.fileName || 'CSS personnalisé';
  }

  if (customThemeConfigs) {
    state.themeConfigs = customThemeConfigs;
    const initialPreset = customThemeConfigs[state.currentViewport]?.mermaid?.preset || 'default';
    setMermaidTheme(initialPreset);
  }

  if (draft && typeof draft.markdown === 'string') {
    state.localImages =
      localImages && typeof localImages === 'object' ? localImages : {};
    state.currentFileName = draft.currentFileName || 'Sans titre.md';
    state.isDirty = Boolean(draft.isDirty);
    state.imageSeq = computeNextImageSeq(
      draft.markdown,
      state.localImages,
      draft.imageSeq
    );

    setEditorContent(
      dom.mdEditor,
      draft.markdown,
      state.localImages,
      getNextImageId,
      false
    );
    state.markdown = serializeEditorToMarkdown(dom.mdEditor);
  }
}

/**
 * Charge automatiquement config/output_config.json, les modèles Word/PowerPoint et les feuilles CSS (css/report.css, css/slide.css).
 * Extrait et synchronise également les réglages de personnalisation de styles (themeConfigs) depuis les feuilles CSS chargées
 * si aucun réglage personnalisé n'a été restauré depuis IndexedDB (ou si forceReset = true).
 *
 * @param {boolean} [forceReset=false] - Si true, écrase toute configuration personnalisée
 * @returns {Promise<void>}
 */
async function loadDefaultConfigAndTemplate(forceReset = false) {
  const cacheBust = forceReset ? `?t=${Date.now()}` : '';
  const fetchOpts = forceReset ? { cache: 'no-store' } : { cache: 'no-cache' };

  if (forceReset || !state.outputConfig) {
    try {
      const resConfig = await fetch(`config/output_config.json${cacheBust}`, fetchOpts);
      if (resConfig.ok) {
        state.outputConfig = await resConfig.json();
        state.configFileName = 'output_config.json (défaut)';
      }
    } catch {
      state.configFileName = 'Configuration interne';
    }
  }

  if (forceReset || !state.templateBuffer) {
    try {
      const tplPath = state.outputConfig?.documents?.[0]?.path || 'templates/Modele_word.docx';
      const resTpl = await fetch(`${tplPath}${cacheBust}`, fetchOpts);
      if (resTpl.ok) {
        state.templateBuffer = await resTpl.arrayBuffer();
        state.templateFileName = `${tplPath.split('/').pop()} (défaut)`;
      }
    } catch {
      state.templateFileName = 'Aucun modèle Word chargé';
    }
  }

  if (forceReset || !state.pptTemplateBuffer) {
    try {
      const pw = state.outputConfig?.powerpoint;
      const defPpt =
        pw?.templates?.find((t) => t.id === (pw.default || 'standard')) || pw?.templates?.[0];
      const pptPath = defPpt?.path || 'templates/Modele_presentation.potx';
      const resPpt = await fetch(`${pptPath}${cacheBust}`, fetchOpts);
      if (resPpt.ok) {
        state.pptTemplateBuffer = await resPpt.arrayBuffer();
        state.pptTemplateFileName = `${pptPath.split('/').pop()} (défaut)`;
      } else {
        state.pptTemplateFileName = 'Aucun modèle PPT chargé';
      }
    } catch {
      state.pptTemplateFileName = 'Modèle PPT par défaut introuvable';
    }
  }

  if (forceReset || !state.reportCss) {
    try {
      const resReportCss = await fetch(`css/report.css${cacheBust}`, fetchOpts);
      if (resReportCss.ok) {
        state.reportCss = await resReportCss.text();
      } else {
        state.reportCss = DEFAULT_REPORT_CSS;
      }
    } catch {
      state.reportCss = DEFAULT_REPORT_CSS;
    }
  }

  if (forceReset || !state.slideCss) {
    try {
      const resSlideCss = await fetch(`css/slide.css${cacheBust}`, fetchOpts);
      if (resSlideCss.ok) {
        state.slideCss = await resSlideCss.text();
      } else {
        state.slideCss = DEFAULT_SLIDE_CSS;
      }
    } catch {
      state.slideCss = DEFAULT_SLIDE_CSS;
    }
  }

  // Synchronisation automatique des configurations de style depuis les fichiers CSS chargés
  if (forceReset || !state.themeConfigs) {
    state.themeConfigs = {};
  }
  if (state.slideCss && (forceReset || !state.themeConfigs.slide || state.slideCss.includes('/* === Surcharges') || state.slideCss.includes('[md2print-config'))) {
    const parsedSlide = parseConfigFromCss(state.slideCss, 'slide');
    if (parsedSlide?.config) {
      state.themeConfigs.slide = forceReset ? parsedSlide.config : { ...(state.themeConfigs.slide || {}), ...parsedSlide.config };
    }
  }
  if (state.reportCss && (forceReset || !state.themeConfigs.report || state.reportCss.includes('/* === Surcharges') || state.reportCss.includes('[md2print-config'))) {
    const parsedReport = parseConfigFromCss(state.reportCss, 'report');
    if (parsedReport?.config) {
      state.themeConfigs.report = forceReset ? parsedReport.config : { ...(state.themeConfigs.report || {}), ...parsedReport.config };
    }
  }

  if (forceReset) {
    state.customCssFileName = null;
  }

  updateConfigStatusUI();
}

/**
 * Met à jour le texte d'état dans le menu déroulant Configuration.
 * @returns {void}
 */
function updateConfigStatusUI() {
  if (!dom.configStatusText) return;
  const cssStatus = state.customCssFileName || 'par défaut (Word / PPTX)';
  dom.configStatusText.innerHTML = `Modèle Word : ${escapeHtml(state.templateFileName)}<br>Modèle PPT : ${escapeHtml(state.pptTemplateFileName)}<br>CSS : ${escapeHtml(cssStatus)}`;
}

/**
 * Met à jour l'affichage en lecture seule du nom de fichier et de l'indicateur de modification (*).
 * @returns {void}
 */
function updateFileNameDisplay() {
  if (!dom.currentFileName) return;
  const suffix = state.isDirty ? ' *' : '';
  dom.currentFileName.textContent = `${state.currentFileName}${suffix}`;
  dom.currentFileName.classList.toggle('is-dirty', state.isDirty);
}

/**
 * Met à jour le libellé et l'état visuel du bouton de défilement lié.
 * @returns {void}
 */
function updateSyncScrollUI() {
  if (!dom.btnToggleSyncScroll) return;
  if (state.syncScroll) {
    dom.btnToggleSyncScroll.textContent = 'Défilement lié : Activé';
    dom.btnToggleSyncScroll.classList.remove('btn-inactive');
    dom.btnToggleSyncScroll.classList.add('btn-active');
  } else {
    dom.btnToggleSyncScroll.textContent = 'Défilement lié : Désactivé';
    dom.btnToggleSyncScroll.classList.remove('btn-active');
    dom.btnToggleSyncScroll.classList.add('btn-inactive');
  }
}

/**
 * Active ou désactive le défilement synchronisé entre l'éditeur et l'aperçu.
 * @returns {void}
 */
function toggleSyncScroll() {
  state.syncScroll = !state.syncScroll;
  updateSyncScrollUI();
  persistPreferencesNow();
  if (state.syncScroll) {
    showToast('Défilement lié activé (Aperçu -> Éditeur)');
    syncScrollIframeToEditor();
  } else {
    showToast('Défilement lié désactivé (défilement libre)');
  }
}

/**
 * Détecte si l'utilisateur a saisi un bloc Mermaid (```mermaid ... ```) ou HTML exécutable
 * (```html-exec ... ``` ou [html] ... [/html]) fermé non encore converti en cartouche.
 * @returns {void}
 */
function checkForUnfencedCartouches() {
  const text = state.markdown || '';
  const mermaidMatches = text.match(/```mermaid[\s\S]*?```/gi) || [];
  const existingCartouches = dom.mdEditor.querySelectorAll('.mermaid-cartouche').length;
  const htmlFenceMatches =
    text.match(/```(?:html-exec|html-live|html-run|html-widget|html!)[\s\S]*?```/gi) || [];
  const htmlTagMatches =
    text.match(/(?:\[\s*html\s*\][\s\S]*?\[\s*\/\s*html\s*\]|:::\s*html\s*\r?\n[\s\S]*?\r?\n:::)/gi) || [];
  const existingHtmlCartouches = dom.mdEditor.querySelectorAll('.html-cartouche').length;
  if (
    mermaidMatches.length > existingCartouches ||
    htmlFenceMatches.length + htmlTagMatches.length > existingHtmlCartouches
  ) {
    syncFromEditorDOM();
  }
}

/**
 * Demande confirmation à l'utilisateur si des modifications non sauvegardées sont présentes.
 * @returns {boolean} true si l'action peut continuer
 */
function confirmDiscardIfDirty() {
  if (!state.isDirty) return true;
  return window.confirm('Des modifications non sauvegardées seront perdues. Voulez-vous continuer ?');
}

/**
 * Met à jour state.markdown à partir du DOM de l'éditeur, reformate l'éditeur en conservant
 * le curseur et planifie le rafraîchissement de l'aperçu et la sauvegarde IndexedDB.
 * @returns {void}
 */
function syncFromEditorDOM() {
  const rawFromDom = serializeEditorToMarkdown(dom.mdEditor);
  if (!state.isDirty) {
    state.isDirty = true;
    updateFileNameDisplay();
  }
  if (
    rawFromDom.length === 0 &&
    !dom.mdEditor.querySelector('.image-cartouche') &&
    !dom.mdEditor.querySelector('.mermaid-cartouche') &&
    !dom.mdEditor.querySelector('.html-cartouche')
  ) {
    state.markdown = '';
    dom.mdEditor.innerHTML = '';
  } else {
    setEditorContent(
      dom.mdEditor,
      rawFromDom,
      state.localImages,
      getNextImageId,
      true
    );
    state.markdown = serializeEditorToMarkdown(dom.mdEditor);
  }
  schedulePreviewUpdate(400);
  scheduleDraftSave(1500);
}

// --- Attachement des Événements ---

// --- Gestionnaire de la Page de Paramétrage des Styles de Balises ---
let styleSettingsManager = null;

/**
 * Récupère ou instancie en singleton le gestionnaire de paramétrage des styles de balises (StyleSettingsManager),
 * chargé dynamiquement à la demande lors de l'ouverture de l'onglet Styles.
 * Configure les callbacks métier :
 * - onApply : sauvegarde les styles modifiés et les configurations JSON dans IndexedDB et actualise l'aperçu.
 * - onReset : recharge le fichier CSS de référence serveur (slide.css ou report.css), purge les surcharges d'IndexedDB pour ce mode et réinitialise l'interface.
 * - onClose : masque l'interface de paramétrage et restaure l'espace de travail d'édition.
 * @returns {Promise<import('./StyleSettingsManager.js').StyleSettingsManager|null>} Instance du gestionnaire ou null si le conteneur DOM est absent
 */
async function getOrCreateStyleSettingsManager() {
  if (!styleSettingsManager && dom.pageStyleConfig) {
    const { StyleSettingsManager } = await import('./StyleSettingsManager.js');
    styleSettingsManager = new StyleSettingsManager({
      container: dom.pageStyleConfig,
      onApply: async ({ reportCss, slideCss, configs }) => {
        state.reportCss = reportCss;
        state.slideCss = slideCss;
        state.themeConfigs = configs;
        state.customCssFileName = 'Styles personnalisés';
        await saveCustomCss({ reportCss, slideCss, fileName: 'styles-personnalises.css' });
        await saveThemeConfigs(configs);
        updateConfigStatusUI();
        const activePreset = configs[state.currentViewport]?.mermaid?.preset || 'default';
        setMermaidTheme(activePreset);
        updatePreview();
        showToast('Styles appliqués et sauvegardés avec succès', 'success');
      },
      onReset: async ({ mode, cssText, config }) => {
        if (mode === 'slide') {
          state.slideCss = cssText;
        } else {
          state.reportCss = cssText;
        }
        if (!state.themeConfigs) state.themeConfigs = {};
        state.themeConfigs[mode] = config;

        await removeCustomStyleForMode(mode);
        state.customCssFileName = null;

        updateConfigStatusUI();
        const activePreset = state.themeConfigs?.[state.currentViewport]?.mermaid?.preset || 'default';
        setMermaidTheme(activePreset);
        updatePreview();
        showToast(`Styles ${mode === 'slide' ? 'Diaporama' : 'Rapport'} réinitialisés depuis ${mode === 'slide' ? 'slide.css' : 'report.css'} (serveur)`, 'success');
      },
      onClose: () => {
        closeStyleSettingsPage();
      },
    });

    if (state.themeConfigs) {
      if (state.themeConfigs.report) {
        styleSettingsManager.setConfig('report', state.themeConfigs.report);
      }
      if (state.themeConfigs.slide) {
        styleSettingsManager.setConfig('slide', state.themeConfigs.slide);
      }
    }
    styleSettingsManager.init();
  }
  return styleSettingsManager;
}

/**
 * Affiche la page plein écran de paramétrage des styles de balises.
 * @returns {Promise<void>}
 */
async function openStyleSettingsPage() {
  const manager = await getOrCreateStyleSettingsManager();
  if (manager) {
    if (state.themeConfigs) {
      if (state.themeConfigs.report) {
        manager.setConfig('report', state.themeConfigs.report);
      }
      if (state.themeConfigs.slide) {
        manager.setConfig('slide', state.themeConfigs.slide);
      }
    }
    manager.switchMode(state.currentViewport);
  }
  if (dom.workspace) dom.workspace.style.display = 'none';
  if (dom.pageStyleConfig) dom.pageStyleConfig.style.display = 'flex';
  dom.btnOpenStyleSettings?.classList.add('active');
  dom.dropdownConfig?.classList.remove('open');
}

/**
 * Ferme la page de paramétrage et restaure l'espace de travail d'édition.
 * @returns {void}
 */
function closeStyleSettingsPage() {
  if (dom.pageStyleConfig) dom.pageStyleConfig.style.display = 'none';
  if (dom.workspace) dom.workspace.style.display = 'flex';
  dom.btnOpenStyleSettings?.classList.remove('active');
  updatePreview();
}

/**
 * Bascule entre l'espace d'édition et la page de paramétrage des styles.
 * @returns {void}
 */
function toggleStyleSettingsPage() {
  if (dom.pageStyleConfig && dom.pageStyleConfig.style.display === 'flex') {
    closeStyleSettingsPage();
  } else {
    openStyleSettingsPage();
  }
}

/**
 * Attache l'ensemble des écouteurs d'événements de l'interface (menus, éditeur, raccourcis, exports).
 * @returns {void}
 */
function initEventListeners() {
  // F1.3 — Nouveau fichier (Vider l'écran et purger les images en mémoire + IndexedDB)
  dom.btnNewFile.addEventListener('click', async () => {
    if (!confirmDiscardIfDirty()) return;
    state.markdown = '';
    state.currentFileName = 'Sans titre.md';
    state.isDirty = false;
    state.selectedFolderIndex = '';
    state.localImages = {};
    state.imageSeq = 1;
    setEditorContent(dom.mdEditor, '', state.localImages, getNextImageId);
    if (dom.folderFileSelect) dom.folderFileSelect.value = '';
    await clearDraftState();
    updateFileNameDisplay();
    updatePreview();
    showToast('Nouveau document initialisé');
  });

  // F1.1 — Ouvrir un fichier .md unitaire
  dom.btnOpenFile.addEventListener('click', () => {
    dom.fileInput.value = '';
    dom.fileInput.click();
  });

  dom.fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await loadMarkdownFile(file, true);
  });

  // F1.2 — Ouvrir un dossier et lister les fichiers .md
  dom.btnOpenFolder.addEventListener('click', () => {
    dom.folderInput.value = '';
    dom.folderInput.click();
  });

  dom.folderInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    const mdFiles = files
      .filter((f) => /\.(md|markdown)$/i.test(f.name))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

    state.folderFiles = mdFiles;
    state.selectedFolderIndex = '';
    populateFolderSelect(mdFiles);

    if (mdFiles.length === 0) {
      showToast('Aucun fichier .md trouvé dans ce dossier', 'error');
    } else {
      showToast(`${mdFiles.length} fichier(s) .md listé(s) dans le menu`);
    }
  });

  dom.folderFileSelect.addEventListener('change', async (e) => {
    const idxStr = e.target.value;
    if (idxStr === '') return;

    const fileIndex = Number(idxStr);
    const file = state.folderFiles[fileIndex];
    if (!file) return;

    if (!confirmDiscardIfDirty()) {
      dom.folderFileSelect.value = state.selectedFolderIndex;
      return;
    }

    state.selectedFolderIndex = idxStr;
    await loadMarkdownFile(file, false);
  });

  // F1.4 — Sauvegarder (avec choix ou modification du nom de fichier)
  dom.btnSaveFile?.addEventListener('click', () => {
    handleSaveMarkdown();
  });

  // Modification directe du nom de fichier en cliquant sur son intitulé dans le bandeau supérieur
  dom.currentFileName?.addEventListener('click', async () => {
    const current = state.currentFileName || 'document.md';
    const newName = window.prompt('Modifier le nom du fichier :', current);
    if (newName !== null) {
      let finalName = newName.trim() || current;
      if (!/\.(md|markdown)$/i.test(finalName)) {
        finalName = `${finalName}.md`;
      }
      if (finalName !== state.currentFileName) {
        state.currentFileName = finalName;
        state.isDirty = true;
        await persistDraftNow();
        updateFileNameDisplay();
        showToast(`Nom du fichier modifié : ${finalName}`);
      }
    }
  });

  // Raccourci global Ctrl+S / Cmd+S, F8 (Bascule Défilement lié) et F9 (Masquage éditeur)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      handleSaveMarkdown();
    } else if (e.key === 'F8') {
      e.preventDefault();
      toggleSyncScroll();
    } else if (e.key === 'F9') {
      e.preventDefault();
      toggleEditorPane();
    }
  });

  // F2 — Éditeur de texte standard (Saisie 100% fluide sans destruction/reconstruction du DOM)
  dom.mdEditor.addEventListener('input', (e) => {
    if (e.isComposing) return;
    if (e.target !== dom.mdEditor && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT')) {
      return;
    }
    state.markdown = serializeEditorToMarkdown(dom.mdEditor);
    state.plannedSlides = null;
    if (!state.isDirty) {
      state.isDirty = true;
      updateFileNameDisplay();
    }
    if (e.data === '`' || e.data === '\n' || e.data === ']' || e.data === ':') {
      checkForUnfencedCartouches();
    }
    schedulePreviewUpdate(400);
    scheduleDraftSave(1500);
  });

  dom.mdEditor.addEventListener('compositionend', () => {
    state.markdown = serializeEditorToMarkdown(dom.mdEditor);
    if (!state.isDirty) {
      state.isDirty = true;
      updateFileNameDisplay();
    }
    schedulePreviewUpdate(400);
    scheduleDraftSave(1500);
  });

  // Sauvegarde immédiate lors de la perte de focus
  dom.mdEditor.addEventListener('blur', () => {
    state.markdown = serializeEditorToMarkdown(dom.mdEditor);
    persistDraftNow();
  });

  // Événement personnalisé émis lors de la frappe ou indentation dans un textarea Mermaid ou HTML
  dom.mdEditor.addEventListener('cartouche-input', () => {
    state.markdown = serializeEditorToMarkdown(dom.mdEditor);
    if (!state.isDirty) {
      state.isDirty = true;
      updateFileNameDisplay();
    }
    schedulePreviewUpdate(400);
    scheduleDraftSave(1500);
  });

  // Clic sur une cartouche graphique [image], [mermaid] ou [html] -> sélectionne l'objet graphique comme du texte
  dom.mdEditor.addEventListener('click', (e) => {
    if (
      e.target.closest('.mermaid-code-textarea') ||
      e.target.closest('.mermaid-cartouche-toggle') ||
      e.target.closest('.html-code-textarea') ||
      e.target.closest('.html-cartouche-toggle')
    ) {
      return;
    }
    const cartouche = e.target.closest('.image-cartouche, .mermaid-cartouche, .html-cartouche');
    clearCartoucheSelectionStyles(dom.mdEditor);
    if (cartouche) {
      cartouche.classList.add('is-selected');
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNode(cartouche);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    if (state.currentViewport === 'slide') {
      syncSlideToCursor();
    }
  });

  dom.mdEditor.addEventListener('keyup', (e) => {
    if (state.currentViewport === 'slide') {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
        syncSlideToCursor();
      }
    }
  });

  document.addEventListener('selectionchange', () => {
    updateCartoucheSelectionHighlight(dom.mdEditor);
  });

  // Gestion des touches dans l'éditeur : Backspace/Delete sur cartouche, Ctrl+M (Mermaid), Ctrl+Shift+H / Alt+H (HTML), Tab et Enter
  dom.mdEditor.addEventListener('keydown', (e) => {
    if (e.target !== dom.mdEditor && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT')) {
      return;
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      if (handleCartoucheDeletion(dom.mdEditor, e, syncFromEditorDOM)) return;
    }

    // Ctrl+M / Cmd+M : Insérer un schéma Mermaid sous forme de cartouche dépliée
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
      e.preventDefault();
      const sampleCode = 'graph TB\n    A[Début] --> B[Étape 1]\n    B --> C[Fin]';
      const cartoucheEl = createMermaidCartoucheElement(sampleCode, { isExpanded: true });
      insertNodeAtEditorCaret(dom.mdEditor, cartoucheEl);
      syncFromEditorDOM();
      updatePreview();
      persistDraftNow();

      // Placer le focus et le curseur immédiatement dans le textarea du schéma Mermaid inséré
      const allCartouches = dom.mdEditor.querySelectorAll('.mermaid-cartouche');
      const lastCartouche = allCartouches[allCartouches.length - 1];
      const textarea = lastCartouche?.querySelector('.mermaid-code-textarea');
      if (textarea) {
        textarea.focus();
        textarea.select();
      }

      showToast('Schéma Mermaid inséré', 'success');
      return;
    }

    // Ctrl+Shift+H ou Alt+H : Insérer un bloc HTML/CSS/JS exécutable sous forme de cartouche dépliée
    if (
      (((e.ctrlKey || e.metaKey) && e.shiftKey) || e.altKey) &&
      e.key.toLowerCase() === 'h'
    ) {
      e.preventDefault();
      const sampleHtml =
        '<div style="padding: 16px; border-radius: 10px; background: rgba(37, 99, 235, 0.08); border: 1px solid rgba(37, 99, 235, 0.25);">\n' +
        '  <strong>Composant HTML Interactif</strong>\n' +
        '</div>';
      const cartoucheEl = createHtmlCartoucheElement(sampleHtml, { isExpanded: true });
      insertNodeAtEditorCaret(dom.mdEditor, cartoucheEl);
      syncFromEditorDOM();
      updatePreview();
      persistDraftNow();

      const allCartouches = dom.mdEditor.querySelectorAll('.html-cartouche');
      const lastCartouche = allCartouches[allCartouches.length - 1];
      const textarea = lastCartouche?.querySelector('.html-code-textarea');
      if (textarea) {
        textarea.focus();
        textarea.select();
      }

      showToast('Bloc HTML exécutable inséré', 'success');
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      clearCartoucheSelectionStyles(dom.mdEditor);

      const sel = window.getSelection();
      const offsets = getEditorSelectionOffsets(dom.mdEditor);
      const anchorEl =
        sel?.anchorNode?.nodeType === Node.ELEMENT_NODE
          ? sel.anchorNode
          : sel?.anchorNode?.parentElement;
      const listLineSpan = anchorEl?.closest('.md-list-line');

      if (listLineSpan) {
        if (e.shiftKey) {
          const firstNode = listLineSpan.firstChild;
          if (firstNode && firstNode.nodeType === Node.TEXT_NODE) {
            const match = firstNode.nodeValue.match(/^( {1,2}|\t)/);
            if (match) {
              const removeLen = match[0].length;
              firstNode.nodeValue = firstNode.nodeValue.substring(removeLen);
              syncFromEditorDOM();
              if (offsets) {
                restoreEditorSelectionOffsets(dom.mdEditor, {
                  start: Math.max(0, offsets.start - removeLen),
                  end: Math.max(0, offsets.end - removeLen),
                });
              }
            }
          }
          return;
        }

        listLineSpan.insertBefore(
          document.createTextNode('  '),
          listLineSpan.firstChild
        );
        syncFromEditorDOM();
        if (offsets) {
          restoreEditorSelectionOffsets(dom.mdEditor, {
            start: offsets.start + 2,
            end: offsets.end + 2,
          });
        }
        return;
      }

      if (!e.shiftKey) {
        insertNodeAtEditorCaret(dom.mdEditor, document.createTextNode('  '));
        syncFromEditorDOM();
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      clearCartoucheSelectionStyles(dom.mdEditor);
      insertNodeAtEditorCaret(dom.mdEditor, document.createTextNode('\n'));
      syncFromEditorDOM();
    }
  });

  // Glisser-déposer sur l'éditeur (Fichier .md, Image ou Cartouche graphique interne)
  dom.mdEditor.addEventListener('dragover', (e) => {
    e.preventDefault();

    const draggedCartouche = getDraggedCartouche();
    if (draggedCartouche) {
      e.dataTransfer.dropEffect = 'move';
      const range = getCaretRangeFromPoint(e.clientX, e.clientY);
      if (
        range &&
        dom.mdEditor.contains(range.startContainer) &&
        !draggedCartouche.contains(range.startContainer) &&
        !range.startContainer?.closest?.('.mermaid-code-textarea, .html-code-textarea')
      ) {
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      return;
    }

    dom.mdEditor.classList.add('drag-active');
  });

  dom.mdEditor.addEventListener('dragleave', (e) => {
    if (!dom.mdEditor.contains(e.relatedTarget)) {
      dom.mdEditor.classList.remove('drag-active');
    }
  });

  dom.mdEditor.addEventListener('drop', async (e) => {
    e.preventDefault();
    dom.mdEditor.classList.remove('drag-active');

    const draggedCartouche = getDraggedCartouche();
    if (draggedCartouche) {
      e.stopPropagation();
      draggedCartouche.classList.remove('is-dragging');
      setDraggedCartouche(null);

      const range = getCaretRangeFromPoint(e.clientX, e.clientY);
      if (
        range &&
        dom.mdEditor.contains(range.startContainer) &&
        !draggedCartouche.contains(range.startContainer) &&
        !range.startContainer?.closest?.('.mermaid-code-textarea, .html-code-textarea')
      ) {
        // Retirer la cartouche de son emplacement d'origine
        draggedCartouche.remove();

        // Insérer la cartouche à la position de dépôt ciblée
        const sentinel = dom.mdEditor.querySelector('br[data-sentinel="true"]');
        if (
          sentinel &&
          ((range.startContainer === dom.mdEditor &&
            range.startOffset >= Array.from(dom.mdEditor.childNodes).indexOf(sentinel)) ||
            range.startContainer === sentinel)
        ) {
          dom.mdEditor.insertBefore(draggedCartouche, sentinel);
        } else {
          range.insertNode(draggedCartouche);
        }

        ensureTrailingSentinel(dom.mdEditor);

        // Synchroniser le Markdown et recharger l'éditeur pour conserver le formatage non-WYSIWYG
        syncFromEditorDOM();

        // Sélectionner et positionner le curseur après la cartouche déplacée
        clearCartoucheSelectionStyles(dom.mdEditor);
        const sel = window.getSelection();
        if (sel) {
          const afterRange = document.createRange();
          afterRange.setStartAfter(draggedCartouche);
          afterRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(afterRange);
        }

        showToast('Cartouche déplacée', 'success');
      }
      return;
    }

    const file = e.dataTransfer?.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/') || /\.(png|jpe?g|svg|webp|gif|bmp)$/i.test(file.name)) {
      await insertImageAsBase64(file);
    } else if (/\.(md|markdown|txt)$/i.test(file.name)) {
      await loadMarkdownFile(file, true);
    } else {
      showToast('Format non pris en charge (déposez un fichier .md ou une image)', 'error');
    }
  });

  // Collage (Ctrl+V) dans l'éditeur : Image -> Cartouche graphique, Texte -> Texte brut sans HTML parasite
  dom.mdEditor.addEventListener('paste', async (e) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            await insertImageAsBase64(file, 'Image collée');
          }
          return;
        }
      }
    }

    const plainText = e.clipboardData?.getData('text/plain');
    if (plainText !== undefined) {
      e.preventDefault();
      clearCartoucheSelectionStyles(dom.mdEditor);
      const normalizedPaste = plainText.replace(/\r\n?/g, '\n');
      insertNodeAtEditorCaret(dom.mdEditor, document.createTextNode(normalizedPaste));
      syncFromEditorDOM();
    }
  });

  // Bascule du défilement lié (Bouton dans l'en-tête ou touche F8)
  dom.btnToggleSyncScroll?.addEventListener('click', () => {
    toggleSyncScroll();
  });

  // Bascule de masquage de l'éditeur Markdown (Bouton en-tête et barre d'outils)
  dom.btnToggleEditor?.addEventListener('click', () => {
    toggleEditorPane();
  });

  // Défilement de l'éditeur Markdown : synchronisation défilement avec l'aperçu
  dom.mdEditor.addEventListener('scroll', () => {
    syncScrollEditorToIframe();
  });

  // F3 / F4 — Sélecteur de Vue (Rapport / Slide)
  dom.btnViewReport.addEventListener('click', () => setViewMode('report'));
  dom.btnViewSlide.addEventListener('click', () => setViewMode('slide'));

  // Navigation molette en vue Slide sur le panneau d'aperçu
  let lastPreviewWheelTime = 0;
  dom.panePreview?.addEventListener(
    'wheel',
    (e) => {
      if (state.currentViewport !== 'slide') return;
      if (e.ctrlKey) return;
      const iframeWin = dom.previewIframe?.contentWindow;
      if (!iframeWin || typeof iframeWin.nextSlide !== 'function') return;

      if (Math.abs(e.deltaY) < 15) return;

      const now = Date.now();
      if (now - lastPreviewWheelTime < 350) {
        e.preventDefault();
        return;
      }

      if (e.deltaY > 0) {
        e.preventDefault();
        lastPreviewWheelTime = now;
        iframeWin.nextSlide();
      } else if (e.deltaY < 0) {
        e.preventDefault();
        lastPreviewWheelTime = now;
        iframeWin.prevSlide();
      }
    },
    { passive: false }
  );

  // Accès à la page de paramétrage des styles de balises
  dom.btnOpenStyleSettings?.addEventListener('click', () => {
    toggleStyleSettingsPage();
  });
  dom.btnMenuOpenStyleSettings?.addEventListener('click', () => {
    openStyleSettingsPage();
  });

  // Menu Burger principal : ouverture, fermeture et fermeture automatique au clic d'un item
  dom.btnToggleBurger?.addEventListener('click', (e) => {
    e.stopPropagation();
    dom.dropdownConfig?.classList.remove('open');
    dom.dropdownExport?.classList.remove('open');
    dom.dropdownBurger?.classList.toggle('open');
  });

  dom.burgerMenu?.querySelectorAll('.dropdown-item').forEach((item) => {
    item.addEventListener('click', () => {
      dom.dropdownBurger?.classList.remove('open');
    });
  });

  // Menus déroulants Configuration & Exporter
  dom.btnToggleConfig?.addEventListener('click', (e) => {
    e.stopPropagation();
    dom.dropdownBurger?.classList.remove('open');
    dom.dropdownExport?.classList.remove('open');
    dom.dropdownConfig?.classList.toggle('open');
  });

  dom.btnToggleExport?.addEventListener('click', (e) => {
    e.stopPropagation();
    dom.dropdownBurger?.classList.remove('open');
    dom.dropdownConfig?.classList.remove('open');
    dom.dropdownExport?.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    dom.dropdownBurger?.classList.remove('open');
    dom.dropdownConfig?.classList.remove('open');
    dom.dropdownExport?.classList.remove('open');
  });

  // Chargement d'un modèle Word .docx personnalisé
  dom.btnLoadTemplateDocx.addEventListener('click', () => {
    dom.templateDocxInput.value = '';
    dom.templateDocxInput.click();
  });

  dom.templateDocxInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      state.templateBuffer = await readFileAsArrayBuffer(file);
      state.templateFileName = file.name;
      await saveCustomTemplate({
        templateBuffer: state.templateBuffer,
        templateFileName: state.templateFileName,
      });
      updateConfigStatusUI();
      showToast(`Modèle Word chargé : ${file.name}`, 'success');
    } catch (err) {
      showToast(`Erreur modèle Word : ${err.message}`, 'error');
    }
  });

  dom.btnLoadTemplatePptx?.addEventListener('click', () => {
    dom.templatePptxInput.value = '';
    dom.templatePptxInput.click();
  });

  dom.templatePptxInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      state.pptTemplateBuffer = await readFileAsArrayBuffer(file);
      state.pptTemplateFileName = file.name;
      await saveCustomPptTemplate({
        pptTemplateBuffer: state.pptTemplateBuffer,
        pptTemplateFileName: state.pptTemplateFileName,
      });
      updateConfigStatusUI();
      showToast(`Modèle PowerPoint chargé : ${file.name}`, 'success');
    } catch (err) {
      showToast(`Erreur modèle PowerPoint : ${err.message}`, 'error');
    }
  });

  dom.btnLoadCustomCss?.addEventListener('click', () => {
    dom.customCssInput.value = '';
    dom.customCssInput.click();
  });

  dom.customCssInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rawCssText = await readFileAsText(file);
      const cssText = await compressEmbeddedImagesInText(rawCssText);
      const isSlide = state.currentViewport === 'slide';
      const mode = isSlide ? 'slide' : 'report';
      if (isSlide) {
        state.slideCss = cssText;
        await saveCustomCss({ reportCss: state.reportCss, slideCss: cssText, fileName: file.name });
      } else {
        state.reportCss = cssText;
        await saveCustomCss({ reportCss: cssText, slideCss: state.slideCss, fileName: file.name });
      }
      // Synchronisation immédiate des configurations de styles de balises
      const parsed = parseConfigFromCss(cssText, mode);
      if (parsed?.config) {
        if (!state.themeConfigs) state.themeConfigs = {};
        state.themeConfigs[mode] = parsed.config;
        await saveThemeConfigs(state.themeConfigs);
        if (styleSettingsManager) {
          styleSettingsManager.setConfig(mode, parsed.config);
        }
      }
      state.customCssFileName = file.name;
      updateConfigStatusUI();
      updatePreview();
      showToast(`CSS ${isSlide ? 'Diaporama' : 'Rapport'} chargé et synchronisé : ${file.name}`, 'success');
    } catch (err) {
      showToast(`Erreur CSS : ${err.message}`, 'error');
    }
  });

  const handleResetConfig = async () => {
    await clearCustomConfigAndTemplate();
    await loadDefaultConfigAndTemplate(true);
    if (styleSettingsManager) {
      if (state.themeConfigs?.report) styleSettingsManager.setConfig('report', state.themeConfigs.report);
      if (state.themeConfigs?.slide) styleSettingsManager.setConfig('slide', state.themeConfigs.slide);
      styleSettingsManager.updateFormValues();
      styleSettingsManager.updateLivePreview();
    }
    updatePreview();
    showToast('Configuration, modèles et styles CSS réinitialisés par défaut');
  };

  dom.btnResetConfig?.addEventListener('click', handleResetConfig);
  dom.btnResetConfigMenu?.addEventListener('click', handleResetConfig);

  // Actions d'export (HTML, DOCX, PPTX)
  dom.btnExportHtml?.addEventListener('click', () => handleExportHtml());
  dom.btnExportDocx?.addEventListener('click', () => handleExportDocx());
  dom.btnExportPptx?.addEventListener('click', () => handleExportPptx());

  // F7 — Bascule de Thème (Sombre Bleu/Gris <-> Clair Sépia) avec persistance IndexedDB
  dom.btnToggleTheme.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'sepia' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
    dom.btnToggleTheme.textContent =
      state.theme === 'dark' ? 'Thème : Sombre' : 'Thème : Sépia';
    persistPreferencesNow();
  });
}

// --- Fonctions Métier Fichiers & Images ---

/**
 * Remplit la liste déroulante avec les fichiers .md du dossier sélectionné.
 * @param {File[]} mdFiles - Tableau des fichiers Markdown filtrés et triés
 * @returns {void}
 */
function populateFolderSelect(mdFiles) {
  if (!dom.folderFileSelect) return;
  dom.folderFileSelect.innerHTML = '';
  if (!mdFiles || mdFiles.length === 0) {
    dom.folderFileSelect.style.display = 'none';
    dom.folderFileSelect.disabled = true;
    return;
  }

  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = `Fichiers du dossier (${mdFiles.length})`;
  dom.folderFileSelect.appendChild(defaultOpt);

  mdFiles.forEach((file, idx) => {
    const opt = document.createElement('option');
    opt.value = String(idx);
    opt.textContent = file.name;
    dom.folderFileSelect.appendChild(opt);
  });

  dom.folderFileSelect.disabled = false;
  dom.folderFileSelect.style.display = 'inline-block';
}

/**
 * Lit un fichier Markdown et l'affiche dans l'éditeur (avec objets graphiques [image] si présents).
 * @param {File} file - Fichier Markdown à lire
 * @param {boolean} [checkDirty=true] - Indique s'il faut vérifier les modifications non sauvegardées
 * @returns {Promise<void>}
 */
async function loadMarkdownFile(file, checkDirty = true) {
  if (!/\.(md|markdown|txt)$/i.test(file.name)) {
    showToast('Veuillez sélectionner un fichier .md valide', 'error');
    return;
  }

  if (checkDirty && !confirmDiscardIfDirty()) {
    return;
  }

  try {
    const rawContent = await readFileAsText(file);
    state.localImages = {};
    state.imageSeq = 1;
    setEditorContent(
      dom.mdEditor,
      rawContent,
      state.localImages,
      getNextImageId,
      false
    );
    const localEntries = Object.entries(state.localImages);
    for (const [imgKey, rawUrl] of localEntries) {
      state.localImages[imgKey] = await compressImageDataUrl(rawUrl);
    }
    state.markdown = serializeEditorToMarkdown(dom.mdEditor);
    state.currentFileName = file.name;
    state.isDirty = false;
    dom.mdEditor.scrollTop = 0;
    await persistDraftNow();
    updateFileNameDisplay();
    updatePreview();
    showToast(`Fichier ouvert : ${file.name}`, 'success');
  } catch (err) {
    showToast(`Erreur de lecture : ${err.message}`, 'error');
  }
}

/**
 * Sauvegarde le contenu de l'éditeur en fichier Markdown (.md)
 * en réinjectant le binaire Base64 complet à la place des objets graphiques [image].
 * Permet à l'utilisateur de modifier le nom du fichier lors de la sauvegarde
 * (via la boîte de dialogue native du système ou une invitation de saisie).
 * Met à jour le nom du fichier dans le bandeau supérieur et l'état persistant.
 * @returns {Promise<void>}
 */
async function handleSaveMarkdown() {
  state.markdown = serializeEditorToMarkdown(dom.mdEditor);
  pruneUnusedLocalImages(state.markdown, state.localImages);

  let defaultName = state.currentFileName;
  if (!defaultName || defaultName === 'Sans titre.md') {
    const detectedTitle = extractTitle(state.markdown);
    defaultName = detectedTitle ? `${toSlug(detectedTitle)}.md` : 'document.md';
  } else if (!/\.(md|markdown)$/i.test(defaultName)) {
    defaultName = `${defaultName}.md`;
  }

  const fullMarkdown = resolveImagePaths(state.markdown, state.localImages);
  const blob = new Blob([fullMarkdown], { type: 'text/markdown;charset=utf-8' });

  // 1. API native File System Access (Chrome, Edge) : ouverture de la boîte système "Enregistrer sous"
  if (typeof window.showSaveFilePicker === 'function') {
    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: defaultName,
        types: [
          {
            description: 'Fichier Markdown (*.md)',
            accept: { 'text/markdown': ['.md', '.markdown'] },
          },
        ],
      });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();

      // Met à jour le nom du fichier si modifié par l'utilisateur dans la boîte de dialogue
      state.currentFileName = fileHandle.name;
      state.isDirty = false;
      await persistDraftNow();
      updateFileNameDisplay();
      showToast(`Fichier sauvegardé : ${fileHandle.name}`, 'success');
      return;
    } catch (err) {
      if (err.name === 'AbortError') {
        // Annulation volontaire par l'utilisateur
        return;
      }
      console.warn('showSaveFilePicker indisponible ou refusé, repli sur invitation de saisie :', err);
    }
  }

  // 2. Repli standard : invitation de saisie du nom de fichier si showSaveFilePicker n'est pas supporté
  const customName = window.prompt('Nom du fichier à sauvegarder :', defaultName);
  if (customName === null) {
    return; // Annulé par l'utilisateur
  }
  let fileName = customName.trim() || defaultName;
  if (!/\.(md|markdown)$/i.test(fileName)) {
    fileName = `${fileName}.md`;
  }
  state.currentFileName = fileName;
  downloadBlob(blob, fileName);
  state.isDirty = false;
  await persistDraftNow();
  updateFileNameDisplay();
  showToast(`Fichier sauvegardé : ${fileName}`, 'success');
}

/**
 * Insère une image déposée ou collée sous forme d'objet graphique [image] (2 lignes de hauteur)
 * dans l'éditeur, tout en conservant le binaire Base64 dans state.localImages et IndexedDB.
 * @param {File} file - Fichier image à convertir en Base64
 * @param {string} [customAlt] - Texte alternatif optionnel
 * @returns {Promise<void>}
 */
async function insertImageAsBase64(file, customAlt) {
  try {
    const dataUrl = await readAndCompressImageFile(file);
    const alt = customAlt || file.name.replace(/\.[^/.]+$/, '') || 'Image';
    const imgId = getNextImageId();

    state.localImages[imgId] = dataUrl;

    const cartoucheEl = createCartoucheElement(imgId, alt);
    insertNodeAtEditorCaret(dom.mdEditor, cartoucheEl);
    syncFromEditorDOM();
    updatePreview();
    await persistDraftNow();
    showToast(`Image insérée : ${alt}`, 'success');
  } catch (err) {
    showToast(`Erreur image : ${err.message}`, 'error');
  }
}

// --- Gestion de l'Aperçu Iframe, Debounce & Défilement Synchronisé ---

let isSyncingScroll = false;
let syncScrollTimer = null;
let previewDebounceTimer = null;

/**
 * Calcule la position de défilement cible en interpolant les segments délimités par les titres (headings).
 * En l'absence de titres, se replie de manière fluide sur un ratio proportionnel classique.
 *
 * @param {number} currentPos - Position de défilement actuelle (en pixels)
 * @param {number} maxSource - Défilement maximal possible dans le conteneur source
 * @param {number} maxTarget - Défilement maximal possible dans le conteneur cible
 * @param {'editorToIframe'|'iframeToEditor'} direction - Sens de calcul
 * @returns {number} Position de défilement calculée (arrondie à l'entier le plus proche)
 */
function computeSyncedScrollPosition(currentPos, maxSource, maxTarget, direction) {
  if (currentPos <= 0 || maxSource <= 0) return 0;
  if (currentPos >= maxSource) return maxTarget;

  const iframeDoc = dom.previewIframe?.contentDocument;
  const iframeWin = dom.previewIframe?.contentWindow;
  if (!iframeDoc || !iframeWin) {
    return Math.round((currentPos / maxSource) * maxTarget);
  }

  const editorHeadings = Array.from(dom.mdEditor.querySelectorAll('.md-heading-line'));
  const iframeHeadings = Array.from(iframeDoc.querySelectorAll('.doc-heading'));

  if (editorHeadings.length === 0 || iframeHeadings.length === 0) {
    return Math.round((currentPos / maxSource) * maxTarget);
  }

  const anchorCount = Math.min(editorHeadings.length, iframeHeadings.length);
  const anchors = [{ source: 0, target: 0 }];

  const editorRect = dom.mdEditor.getBoundingClientRect();
  const iframeScrollY = iframeWin.scrollY || iframeWin.pageYOffset || 0;

  for (let i = 0; i < anchorCount; i++) {
    const eTop =
      editorHeadings[i].getBoundingClientRect().top - editorRect.top + dom.mdEditor.scrollTop;
    const iTop = iframeHeadings[i].getBoundingClientRect().top + iframeScrollY;

    const sourceY = direction === 'editorToIframe' ? eTop : iTop;
    const targetY = direction === 'editorToIframe' ? iTop : eTop;

    const prev = anchors[anchors.length - 1];
    if (sourceY > prev.source && targetY > prev.target) {
      anchors.push({ source: sourceY, target: targetY });
    }
  }

  // Borne terminale
  const last = anchors[anchors.length - 1];
  if (maxSource > last.source && maxTarget > last.target) {
    anchors.push({ source: maxSource, target: maxTarget });
  } else {
    anchors.push({
      source: Math.max(maxSource, last.source + 1),
      target: Math.max(maxTarget, last.target + 1),
    });
  }

  // Recherche du segment [k, k+1] englobant la position source
  for (let k = 0; k < anchors.length - 1; k++) {
    const p1 = anchors[k];
    const p2 = anchors[k + 1];

    if (currentPos >= p1.source && currentPos <= p2.source) {
      const segSpan = p2.source - p1.source;
      if (segSpan <= 0) return Math.round(p1.target);
      const ratio = (currentPos - p1.source) / segSpan;
      return Math.round(p1.target + ratio * (p2.target - p1.target));
    }
  }

  return Math.round((currentPos / maxSource) * maxTarget);
}

/**
 * Synchronise le défilement de l'iframe à partir de la position courante de l'éditeur.
 * @returns {void}
 */
function syncScrollEditorToIframe() {
  if (isSyncingScroll || !state.syncScroll || state.currentViewport !== 'report') return;
  const iframeWin = dom.previewIframe?.contentWindow;
  const iframeDoc = dom.previewIframe?.contentDocument;
  if (!iframeWin || !iframeDoc?.documentElement) return;

  const maxEditorScroll = dom.mdEditor.scrollHeight - dom.mdEditor.clientHeight;
  const maxIframeScroll =
    iframeDoc.documentElement.scrollHeight - iframeDoc.documentElement.clientHeight;
  if (maxEditorScroll <= 0 || maxIframeScroll <= 0) return;

  const targetY = computeSyncedScrollPosition(
    dom.mdEditor.scrollTop,
    maxEditorScroll,
    maxIframeScroll,
    'editorToIframe'
  );

  isSyncingScroll = true;
  iframeWin.scrollTo(0, targetY);
  clearTimeout(syncScrollTimer);
  syncScrollTimer = setTimeout(() => {
    isSyncingScroll = false;
  }, 60);
}

/**
 * Synchronise le défilement de l'éditeur à partir de la position courante de l'iframe.
 * @returns {void}
 */
function syncScrollIframeToEditor() {
  if (isSyncingScroll || !state.syncScroll || state.currentViewport !== 'report') return;
  const iframeWin = dom.previewIframe?.contentWindow;
  const iframeDoc = dom.previewIframe?.contentDocument;
  if (!iframeWin || !iframeDoc?.documentElement) return;

  const maxEditorScroll = dom.mdEditor.scrollHeight - dom.mdEditor.clientHeight;
  const maxIframeScroll =
    iframeDoc.documentElement.scrollHeight - iframeDoc.documentElement.clientHeight;
  if (maxEditorScroll <= 0 || maxIframeScroll <= 0) return;

  const targetY = computeSyncedScrollPosition(
    iframeWin.scrollY || iframeWin.pageYOffset || 0,
    maxIframeScroll,
    maxEditorScroll,
    'iframeToEditor'
  );

  isSyncingScroll = true;
  dom.mdEditor.scrollTop = targetY;
  clearTimeout(syncScrollTimer);
  syncScrollTimer = setTimeout(() => {
    isSyncingScroll = false;
  }, 60);
}

/**
 * Planifie la mise à jour de l'iframe d'aperçu avec un debounce optimisé pour préserver la fluidité de frappe.
 * @param {number} [delay=400] - Délai en millisecondes avant régénération de l'iframe
 * @returns {void}
 */
function schedulePreviewUpdate(delay = 400) {
  if (previewDebounceTimer) clearTimeout(previewDebounceTimer);
  previewDebounceTimer = setTimeout(() => {
    previewDebounceTimer = null;
    updatePreview();
  }, delay);
}

/**
 * Change le mode d'affichage (Rapport ou Slide), sauvegarde la préférence dans IndexedDB et met à jour l'aperçu.
 * @param {'report'|'slide'} mode - Mode de visualisation cible
 * @returns {void}
 */
function setViewMode(mode) {
  state.currentViewport = mode;
  dom.btnViewReport.classList.toggle('active', mode === 'report');
  dom.btnViewSlide.classList.toggle('active', mode === 'slide');
  if (styleSettingsManager && dom.pageStyleConfig && dom.pageStyleConfig.style.display === 'flex') {
    styleSettingsManager.switchMode(mode);
  }
  const modePreset = state.themeConfigs?.[mode]?.mermaid?.preset || 'default';
  setMermaidTheme(modePreset);
  persistPreferencesNow();
  updatePreview();
}

/**
 * Résout le titre du document à partir du premier # ou du nom de fichier courant.
 * @returns {string}
 */
function resolveDocumentTitle() {
  const h1 = extractTitle(state.markdown);
  if (h1) return h1;
  if (state.currentFileName && state.currentFileName !== 'Sans titre.md') {
    return state.currentFileName.replace(/\.\w+$/, '');
  }
  return 'Document';
}

/**
 * Met à jour immédiatement l'iframe de prévisualisation avec le document HTML autonome.
 * @returns {Promise<void>}
 */
async function updatePreview() {
  if (previewDebounceTimer) {
    clearTimeout(previewDebounceTimer);
    previewDebounceTimer = null;
  }

  const iframe = dom.previewIframe;
  if (!iframe) return;

  let prevIframeScroll = 0;
  try {
    prevIframeScroll = iframe.contentWindow?.scrollY || 0;
  } catch {
    prevIframeScroll = 0;
  }

  const activeMermaidPreset = state.themeConfigs?.[state.currentViewport]?.mermaid?.preset || 'default';
  setMermaidTheme(activeMermaidPreset);
  const [mermaidSvgMap] = await Promise.all([
    renderMermaidBlocksMap(state.markdown),
    ensureHighlightLoadedIfNeeded(state.markdown),
  ]);
  const { didFullReload } = updateIframePreview(iframe, state.markdown, {
    docTitle: resolveDocumentTitle(),
    viewMode: state.currentViewport,
    localImages: state.localImages,
    mermaidSvgMap,
    pptConfig: state.outputConfig,
    reportCss: state.reportCss,
    slideCss: state.slideCss,
  });

  const iframeWin = iframe.contentWindow;
  if (iframeWin && state.currentViewport === 'report') {
    if (didFullReload) {
      if (prevIframeScroll > 0) {
        iframeWin.scrollTo(0, prevIframeScroll);
      }

      // Le défilement de la fenêtre WYSIWYG entraîne la fenêtre non-WYSIWYG (l'éditeur)
      iframeWin.addEventListener('scroll', () => {
        syncScrollIframeToEditor();
      });
    }
  } else if (iframeWin && state.currentViewport === 'slide') {
    updatePlannedSlides();
    syncSlideToCursor();
  }
}

/**
 * Met à jour la liste des diapositives planifiées à partir du Markdown courant.
 * @returns {void}
 */
function updatePlannedSlides() {
  state.plannedSlides = planSlides(state.markdown || '', resolveDocumentTitle(), {
    pptConfig: state.outputConfig,
    templateId: state.selectedPptTemplate,
  });
}

/**
 * En mode Slide, synchronise la diapositive affichée dans la fenêtre WYSIWYG
 * avec l'emplacement actuel du curseur dans l'éditeur de texte.
 * Si le curseur est déjà positionné dans la diapositive active, aucune action n'est effectuée ("sinon il ne se passe rien").
 * @returns {void}
 */
function syncSlideToCursor() {
  if (state.currentViewport !== 'slide') return;

  const iframeWin = dom.previewIframe?.contentWindow;
  if (!iframeWin || typeof iframeWin.showSlide !== 'function') return;

  const offsets = getEditorSelectionOffsets(dom.mdEditor);
  const textBefore = (state.markdown || '').substring(0, offsets?.start || 0);
  const caretLineIndex = textBefore.split('\n').length - 1;

  if (!state.plannedSlides || state.plannedSlides.length === 0) {
    updatePlannedSlides();
  }

  const targetIndex = findSlideIndexForLine(state.plannedSlides, caretLineIndex);
  const currentInIframe = typeof iframeWin.getCurrentSlideIndex === 'function'
    ? iframeWin.getCurrentSlideIndex()
    : -1;

  if (targetIndex !== currentInIframe) {
    iframeWin.showSlide(targetIndex);
  }
}

// --- Exports (HTML, DOCX, PPTX) ---

/**
 * F4 — Exporte le document au format HTML autonome (.html) avec CSS nettoyé,
 * compression automatique des images locales et CSS héritées d'IndexedDB,
 * schémas Mermaid vectoriels et menu de navigation.
 * @async
 * @returns {Promise<void>}
 */
async function handleExportHtml() {
  state.markdown = serializeEditorToMarkdown(dom.mdEditor);

  // Garantit que toute image locale ou image CSS restaurée d'IndexedDB est optimisée avant export
  for (const [imgKey, rawUrl] of Object.entries(state.localImages)) {
    state.localImages[imgKey] = await compressImageDataUrl(rawUrl);
  }
  if (state.currentViewport === 'slide' && state.slideCss) {
    state.slideCss = await compressEmbeddedImagesInText(state.slideCss);
  } else if (state.reportCss) {
    state.reportCss = await compressEmbeddedImagesInText(state.reportCss);
  }

  const title = resolveDocumentTitle();
  const activeMermaidPreset = state.themeConfigs?.[state.currentViewport]?.mermaid?.preset || 'default';
  setMermaidTheme(activeMermaidPreset);
  const [mermaidSvgMap] = await Promise.all([
    renderMermaidBlocksMap(state.markdown),
    ensureHighlightLoadedIfNeeded(state.markdown),
  ]);
  const html = generateStandaloneHTML(state.markdown, {
    docTitle: title,
    viewMode: state.currentViewport,
    localImages: state.localImages,
    mermaidSvgMap,
    pptConfig: state.outputConfig,
    reportCss: state.reportCss,
    slideCss: state.slideCss,
  });
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const filename = `${toSlug(title)}.html`;
  downloadBlob(blob, filename);
  showToast(`Export HTML généré : ${filename}`, 'success');
}

/**
 * F5 — Exporte le document au format Word (.docx).
 * @returns {Promise<void>}
 */
async function handleExportDocx() {
  state.markdown = serializeEditorToMarkdown(dom.mdEditor);
  if (!state.markdown.trim()) {
    showToast('Le document Markdown est vide', 'error');
    return;
  }

  const title = resolveDocumentTitle();
  const docConfig = state.outputConfig?.documents?.[0] || {};
  const reportMermaidPreset = state.themeConfigs?.report?.mermaid?.preset || 'default';
  setMermaidTheme(reportMermaidPreset);
  showToast('Génération du fichier Word (.docx) en cours...');

  try {
    const { generateDocx } = await import('./DocxGenerator.js');
    const blob = await generateDocx(
      state.markdown,
      title,
      docConfig,
      state.templateBuffer,
      state.localImages
    );
    const filename = `${toSlug(title)}.docx`;
    downloadBlob(blob, filename);
    showToast(`Export Word généré : ${filename}`, 'success');
  } catch (err) {
    showToast(`Erreur export DOCX : ${err.message}`, 'error');
  }
}

/**
 * F6 — Exporte le document au format PowerPoint (.pptx).
 * @returns {Promise<void>}
 */
async function handleExportPptx() {
  state.markdown = serializeEditorToMarkdown(dom.mdEditor);
  if (!state.markdown.trim()) {
    showToast('Le document Markdown est vide', 'error');
    return;
  }

  const title = resolveDocumentTitle();
  const slideMermaidPreset = state.themeConfigs?.slide?.mermaid?.preset || 'default';
  setMermaidTheme(slideMermaidPreset);
  showToast('Génération de la présentation PowerPoint (.pptx) en cours...');

  try {
    const { generatePptx } = await import('./PptxGenerator.js');
    const blob = await generatePptx(
      state.markdown,
      title,
      state.pptTemplateBuffer,
      state.outputConfig,
      (msg) => showToast(msg, 'info'),
      { localImages: state.localImages }
    );
    const filename = `${toSlug(title)}.pptx`;
    downloadBlob(blob, filename);
    showToast(`Export PowerPoint généré : ${filename}`, 'success');
  } catch (err) {
    showToast(`Erreur export PPTX : ${err.message}`, 'error');
  }
}

// --- Séparateur Central Redimensionnable ---

/**
 * Initialise le glisser-déposer de la barre verticale centrale entre l'éditeur et l'aperçu.
 * @returns {void}
 */
function initResizer() {
  let isResizing = false;

  dom.paneResizer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isResizing = true;
    dom.paneResizer.classList.add('is-resizing');
    document.body.classList.add('resizing-active');
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const rect = dom.workspace.getBoundingClientRect();
    const relativeX = e.clientX - rect.left;
    const percentage = Math.min(80, Math.max(20, (relativeX / rect.width) * 100));
    state.editorWidthPct = Math.round(percentage * 10) / 10;
    dom.paneEditor.style.width = `${state.editorWidthPct}%`;
  });

  document.addEventListener('mouseup', () => {
    if (!isResizing) return;
    isResizing = false;
    dom.paneResizer.classList.remove('is-resizing');
    document.body.classList.remove('resizing-active');
    persistPreferencesNow();
  });
}

// --- Gestion du Masquage de l'Éditeur & du Sommaire des Titres (#, ##, ###) ---

/**
 * @typedef {Object} TocHeadingItem
 * @property {number} level - Niveau hiérarchique du titre (1 pour #, 2 pour ##, 3 pour ###)
 * @property {string} rawText - Texte brut du titre extrait de la ligne Markdown
 * @property {string} cleanText - Texte assaini et débarrassé de la mise en forme inline
 * @property {number} lineIndex - Index de la ligne (0-based) dans le document Markdown source
 */

/**
 * Bascule la visibilité de la fenêtre non-WYSIWYG (Éditeur Markdown).
 * Permet d'étendre la zone d'aperçu en mode plein écran (100 % de largeur).
 * Synchronise l'état du bouton d'en-tête, applique les classes CSS d'invisibilité,
 * et restaure le sommaire lors de la réouverture.
 * @param {boolean|null} [forceHide=null] - Forcer le masquage (true), l'affichage (false) ou basculer l'état (null)
 * @returns {void}
 */
function toggleEditorPane(forceHide = null) {
  if (!dom.paneEditor) return;
  const isHidden = dom.paneEditor.classList.contains('is-hidden');
  const shouldHide = forceHide !== null ? forceHide : !isHidden;

  if (shouldHide) {
    dom.paneEditor.classList.add('is-hidden');
    dom.paneResizer?.classList.add('is-hidden');
    if (dom.btnToggleEditor) {
      dom.btnToggleEditor.textContent = "Afficher l'éditeur";
      dom.btnToggleEditor.classList.add('btn-active');
      dom.btnToggleEditor.title = "Afficher l'éditeur Markdown (Raccourci : F9)";
    }
    state.isEditorHidden = true;
    showToast("Éditeur masqué. Affichage plein écran de l'aperçu.", 'info');
  } else {
    dom.paneEditor.classList.remove('is-hidden');
    dom.paneResizer?.classList.remove('is-hidden');
    if (dom.btnToggleEditor) {
      dom.btnToggleEditor.textContent = "Masquer l'éditeur";
      dom.btnToggleEditor.classList.remove('btn-active');
      dom.btnToggleEditor.title = "Masquer l'éditeur Markdown (Raccourci : F9)";
    }
    state.isEditorHidden = false;
  }
}

/**
 * Fait défiler l'éditeur Markdown jusqu'à la ligne du titre sélectionné, active une animation flash
 * et positionne le défilement sans voler le focus ni interrompre l'interaction de lecture.
 * @param {Object} options
 * @param {number|null} [options.lineIndex=null] - Index de la ligne (0-based) dans le document Markdown source
 * @param {string} [options.slug=''] - Slug unique du titre
 * @param {string} [options.title=''] - Texte nettoyé du titre
 * @param {string} [options.rawText=''] - Texte brut du titre
 * @param {number|null} [options.headingIndex=null] - Index ordonné du titre parmi tous les titres du sommaire
 * @returns {void}
 */
function jumpToEditorHeading(options = {}) {
  if (!dom.mdEditor || state.isEditorHidden) return;
  const { lineIndex, slug, title, rawText, headingIndex } = options;

  let targetEl = null;

  // 1. Recherche prioritaire par data-line-index
  if (lineIndex !== null && lineIndex !== undefined && lineIndex >= 0) {
    targetEl = dom.mdEditor.querySelector(`.md-heading-line[data-line-index="${lineIndex}"]`);
  }

  // 2. Recherche par data-slug sur .md-heading-line
  if (!targetEl && slug) {
    targetEl = dom.mdEditor.querySelector(`.md-heading-line[data-slug="${slug}"]`);
  }

  // 3. Recherche par index d'ordre parmi les éléments .md-heading-line
  const headingEls = Array.from(dom.mdEditor.querySelectorAll('.md-heading-line'));
  if (!targetEl && typeof headingIndex === 'number' && headingIndex >= 0 && headingIndex < headingEls.length) {
    targetEl = headingEls[headingIndex];
  }

  // 4. Recherche par correspondance de texte sur .md-heading-line
  if (!targetEl && (title || rawText)) {
    const cleanSearch = (title || rawText).replace(/^#{1,6}\s+/, '').replace(/[*_`]/g, '').trim().toLowerCase();
    for (const hl of headingEls) {
      const hlText = (hl.dataset.headingText || hl.textContent || '').replace(/^#{1,6}\s+/, '').replace(/[*_`]/g, '').trim().toLowerCase();
      if (hlText && (hlText === cleanSearch || hlText.includes(cleanSearch) || cleanSearch.includes(hlText))) {
        targetEl = hl;
        break;
      }
    }
  }

  // 5. Recherche par balayage de secours dans le texte global du conteneur si aucune classe .md-heading-line ne correspond
  if (!targetEl && (title || rawText)) {
    const cleanSearch = (title || rawText).replace(/^#{1,6}\s+/, '').trim().toLowerCase();
    const walker = document.createTreeWalker(dom.mdEditor, NodeFilter.SHOW_ELEMENT);
    let node;
    while ((node = walker.nextNode())) {
      if (
        node.classList &&
        !node.classList.contains('image-cartouche') &&
        !node.classList.contains('mermaid-cartouche') &&
        !node.classList.contains('html-cartouche')
      ) {
        const text = (node.textContent || '').trim().toLowerCase();
        if (text.startsWith('#') && text.includes(cleanSearch)) {
          targetEl = node;
          break;
        }
      }
    }
  }

  // 6. Repli de secours par offset de caractères dans le DOM
  if (!targetEl && lineIndex !== null && lineIndex !== undefined && lineIndex >= 0) {
    const rawMd = state.markdown || '';
    const lines = rawMd.split('\n');
    let charOffset = 0;
    for (let i = 0; i < Math.min(lineIndex, lines.length); i++) {
      charOffset += lines[i].length + 1;
    }
    const pos = findDomPosition(dom.mdEditor, charOffset);
    if (pos && pos.container) {
      targetEl = pos.container.nodeType === Node.ELEMENT_NODE
        ? pos.container
        : pos.container.parentElement;
    }
  }

  if (targetEl && targetEl !== dom.mdEditor) {
    // Calcul de la position de défilement relative dans dom.mdEditor
    const editorRect = dom.mdEditor.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const currentScroll = dom.mdEditor.scrollTop;
    const targetY = currentScroll + (targetRect.top - editorRect.top) - 30;

    dom.mdEditor.scrollTo({
      top: Math.max(0, Math.round(targetY)),
      behavior: 'smooth',
    });

    targetEl.classList.remove('heading-jump-highlight');
    void targetEl.offsetWidth;
    targetEl.classList.add('heading-jump-highlight');
    setTimeout(() => {
      targetEl.classList.remove('heading-jump-highlight');
    }, 1200);
  }
}

/**
 * Gère la navigation synchronisée déclenchée depuis le sommaire de la visualisation HTML.
 * Positionne la diapositive en vision Slide et fait défiler l'éditeur non-WYSIWYG jusqu'au titre correspondant.
 * @param {string} slug - Identifiant slug unique de l'ancre ou de la diapositive
 * @param {number|null} [slideIndex=null] - Index de la diapositive en vision Slide (-1 si non déterminé)
 * @param {number|null} [headingIndex=null] - Index ordonné du titre dans le sommaire
 * @param {number|null} [lineIndex=null] - Numéro de ligne source dans le Markdown
 * @returns {void}
 */
function navigateFromToc(slug, slideIndex = null, headingIndex = null, lineIndex = null) {
  if (!slug && (slideIndex === null || slideIndex === undefined || slideIndex < 0)) return;

  // Verrouille temporairement la synchronisation bidirectionnelle du scroll
  // afin d'empêcher les écouteurs de défilement de court-circuiter l'animation fluide
  isSyncingScroll = true;
  clearTimeout(syncScrollTimer);
  syncScrollTimer = setTimeout(() => {
    isSyncingScroll = false;
  }, 900);

  // 1. Positionnement de la diapositive en vision Slide
  if (state.currentViewport === 'slide' && typeof slideIndex === 'number' && slideIndex >= 0) {
    const iframeWin = dom.previewIframe?.contentWindow;
    if (iframeWin && typeof iframeWin.showSlide === 'function') {
      const currentInIframe = typeof iframeWin.getCurrentSlideIndex === 'function'
        ? iframeWin.getCurrentSlideIndex()
        : -1;
      if (currentInIframe !== slideIndex) {
        iframeWin.showSlide(slideIndex);
      }
    }
  }

  // 2. Positionnement de l'éditeur Markdown non-WYSIWYG
  if (!state.markdown && dom.mdEditor) {
    state.markdown = serializeEditorToMarkdown(dom.mdEditor);
  }

  const headings = extractTOC(state.markdown || '');
  let targetHeading = null;

  if (typeof headingIndex === 'number' && headingIndex >= 0 && headingIndex < headings.length) {
    targetHeading = headings[headingIndex];
  }

  if (!targetHeading && slug) {
    targetHeading = headings.find((h) => h.slug === slug);
  }

  if (!targetHeading && typeof lineIndex === 'number' && lineIndex >= 0) {
    targetHeading = headings.find((h) => h.lineIndex === lineIndex);
  }

  if (!targetHeading && slug) {
    targetHeading = headings.find((h) => h.slug.startsWith(slug) || slug.startsWith(h.slug));
  }

  const effectiveLineIndex = targetHeading
    ? targetHeading.lineIndex
    : (typeof lineIndex === 'number' ? lineIndex : null);
  const rawText = targetHeading ? targetHeading.rawText : '';
  const title = targetHeading ? targetHeading.title : '';
  const effectiveSlug = targetHeading ? targetHeading.slug : slug;
  const effectiveHeadingIndex = targetHeading
    ? headings.indexOf(targetHeading)
    : (typeof headingIndex === 'number' ? headingIndex : null);

  // Exécution sur le frame d'animation suivant pour que le clic et la gestion du focus
  // dans l'iframe soient totalement achevés sans annuler le défilement de l'éditeur
  requestAnimationFrame(() => {
    jumpToEditorHeading({
      lineIndex: effectiveLineIndex,
      slug: effectiveSlug,
      title,
      rawText,
      headingIndex: effectiveHeadingIndex,
    });
  });
}

// Interface d'appel global pour les clics dans le sommaire de l'iframe de visualisation
window.onIframeTocClick = function (slug, slideIndex, headingIndex, lineIndex) {
  navigateFromToc(slug, slideIndex, headingIndex, lineIndex);
};

// Écouteur de messages postMessage de secours (si iframe isolé)
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'TOC_NAVIGATE') {
    navigateFromToc(
      event.data.slug,
      event.data.slideIndex,
      event.data.headingIndex,
      event.data.lineIndex
    );
  }
});

