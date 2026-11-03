/**
 * app.js — Contrôleur principal de l'application SPA md2print
 */
import {
  toSlug,
  escapeHtml,
  extractTitle,
  downloadBlob,
  readFileAsText,
  readFileAsArrayBuffer,
  readFileAsDataURL,
  resolveImagePaths,
  validateOutputConfig,
  pruneUnusedLocalImages,
  renderMermaidBlocksMap,
} from './utils.js';
import {
  createCartoucheElement,
  createMermaidCartoucheElement,
  serializeEditorToMarkdown,
  getEditorSelectionOffsets,
  restoreEditorSelectionOffsets,
  setEditorContent,
  findDomPosition,
  insertNodeAtEditorCaret,
  clearCartoucheSelectionStyles,
  updateCartoucheSelectionHighlight,
  handleCartoucheDeletion,
} from './EditorEngine.js';
import {
  savePreferences,
  saveCustomConfig,
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
import { StyleSettingsManager, parseConfigFromCss } from './StyleSettingsManager.js';
import { generateStandaloneHTML } from './HtmlGenerator.js';
import { generateDocx } from './DocxGenerator.js';
import { generatePptx } from './PptxGenerator.js';
import { planSlides, findSlideIndexForLine } from './SlidePlanner.js';

// --- État Applicatif Singleton ---
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
  isEditorTocCollapsed: false,
};

// --- Cache des Références DOM ---
const dom = {};

/**
 * Initialise et met en cache toutes les références DOM de l'interface.
 * @returns {void}
 */
const initDomRefs = () => {
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
  dom.btnLoadConfigJson = document.getElementById('btnLoadConfigJson');
  dom.configJsonInput = document.getElementById('configJsonInput');
  dom.btnLoadTemplateDocx = document.getElementById('btnLoadTemplateDocx');
  dom.templateDocxInput = document.getElementById('templateDocxInput');
  dom.btnLoadTemplatePptx = document.getElementById('btnLoadTemplatePptx');
  dom.templatePptxInput = document.getElementById('templatePptxInput');
  dom.btnLoadCustomCss = document.getElementById('btnLoadCustomCss');
  dom.customCssInput = document.getElementById('customCssInput');
  dom.btnResetConfig = document.getElementById('btnResetConfig');

  dom.dropdownExport = document.getElementById('dropdownExport');
  dom.btnToggleExport = document.getElementById('btnToggleExport');
  dom.btnExportHtml = document.getElementById('btnExportHtml');
  dom.btnExportDocx = document.getElementById('btnExportDocx');
  dom.btnExportPptx = document.getElementById('btnExportPptx');

  dom.btnToggleTheme = document.getElementById('btnToggleTheme');

  dom.btnToggleEditor = document.getElementById('btnToggleEditor');
  dom.btnHideEditor = document.getElementById('btnHideEditor');
  dom.editorToolbar = document.getElementById('editorToolbar');
  dom.editorTocSidebar = document.getElementById('editorTocSidebar');
  dom.btnToggleEditorToc = document.getElementById('btnToggleEditorToc');
  dom.btnCloseEditorToc = document.getElementById('btnCloseEditorToc');
  dom.editorTocList = document.getElementById('editorTocList');
  dom.editorTocCount = document.getElementById('editorTocCount');

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
  const cacheBust = `?t=${Date.now()}`;
  const fetchOpts = { cache: 'no-store' };

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
  dom.configStatusText.innerHTML = `Config : ${escapeHtml(state.configFileName)}<br>Modèle Word : ${escapeHtml(state.templateFileName)}<br>Modèle PPT : ${escapeHtml(state.pptTemplateFileName)}<br>CSS : ${escapeHtml(cssStatus)}`;
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
 * Détecte si l'utilisateur a saisi un bloc Mermaid brut fermé (```mermaid ... ```) non encore converti en cartouche.
 * @returns {void}
 */
function checkForUnfencedCartouches() {
  const text = state.markdown || '';
  const mermaidMatches = text.match(/```mermaid[\s\S]*?```/gi) || [];
  const existingCartouches = dom.mdEditor.querySelectorAll('.mermaid-cartouche').length;
  if (mermaidMatches.length > existingCartouches) {
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
    !dom.mdEditor.querySelector('.mermaid-cartouche')
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
 * Récupère ou instancie le gestionnaire de paramétrage des styles.
 * @returns {StyleSettingsManager|null}
 */
function getOrCreateStyleSettingsManager() {
  if (!styleSettingsManager && dom.pageStyleConfig) {
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
 * @returns {void}
 */
function openStyleSettingsPage() {
  const manager = getOrCreateStyleSettingsManager();
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

  // F1.4 — Sauvegarder (Téléchargement classique du fichier .md)
  dom.btnSaveFile.addEventListener('click', () => {
    handleSaveMarkdown();
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
    if (e.data === '`' || e.data === '\n') {
      checkForUnfencedCartouches();
    }
    scheduleEditorTocUpdate(200);
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

  // Événement personnalisé émis lors de la frappe ou indentation dans un textarea Mermaid
  dom.mdEditor.addEventListener('cartouche-input', () => {
    state.markdown = serializeEditorToMarkdown(dom.mdEditor);
    if (!state.isDirty) {
      state.isDirty = true;
      updateFileNameDisplay();
    }
    schedulePreviewUpdate(400);
    scheduleDraftSave(1500);
  });

  // Clic sur une cartouche graphique [image] ou [mermaid] -> sélectionne l'objet graphique comme du texte
  dom.mdEditor.addEventListener('click', (e) => {
    if (
      e.target.closest('.mermaid-code-textarea') ||
      e.target.closest('.mermaid-cartouche-toggle')
    ) {
      return;
    }
    const cartouche = e.target.closest('.image-cartouche, .mermaid-cartouche');
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

  // Gestion des touches dans l'éditeur : Backspace/Delete sur cartouche, Ctrl+M (schéma Mermaid), Tab et Enter
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

  // Glisser-déposer sur l'éditeur (Fichier .md ou Image)
  dom.mdEditor.addEventListener('dragover', (e) => {
    e.preventDefault();
    dom.mdEditor.classList.add('drag-active');
  });

  dom.mdEditor.addEventListener('dragleave', () => {
    dom.mdEditor.classList.remove('drag-active');
  });

  dom.mdEditor.addEventListener('drop', async (e) => {
    e.preventDefault();
    dom.mdEditor.classList.remove('drag-active');
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

  dom.btnHideEditor?.addEventListener('click', () => {
    toggleEditorPane(true);
  });

  // Gestion du volet latéral Sommaire des titres (#, ##, ###)
  dom.btnToggleEditorToc?.addEventListener('click', () => {
    toggleEditorToc();
  });

  dom.btnCloseEditorToc?.addEventListener('click', () => {
    toggleEditorToc(true);
  });

  // Défilement de l'éditeur Markdown : synchronisation défilement et mise à jour titre actif
  dom.mdEditor.addEventListener('scroll', () => {
    syncScrollEditorToIframe();
    updateActiveTocHeadingOnScroll();
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

  // Menus déroulants Configuration & Exporter
  dom.btnToggleConfig.addEventListener('click', (e) => {
    e.stopPropagation();
    dom.dropdownExport.classList.remove('open');
    dom.dropdownConfig.classList.toggle('open');
  });

  dom.btnToggleExport.addEventListener('click', (e) => {
    e.stopPropagation();
    dom.dropdownConfig.classList.remove('open');
    dom.dropdownExport.classList.toggle('open');
  });

  document.addEventListener('click', () => {
    dom.dropdownConfig.classList.remove('open');
    dom.dropdownExport.classList.remove('open');
  });

  // Chargement personnalisé et validé de output_config.json et template .docx
  dom.btnLoadConfigJson.addEventListener('click', () => {
    dom.configJsonInput.value = '';
    dom.configJsonInput.click();
  });

  dom.configJsonInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      const parsed = JSON.parse(text);
      const validation = validateOutputConfig(parsed);
      if (!validation.valid) {
        showToast(validation.error || 'Structure JSON invalide', 'error');
        return;
      }
      state.outputConfig = parsed;
      state.configFileName = file.name;
      await saveCustomConfig({
        outputConfig: state.outputConfig,
        configFileName: state.configFileName,
      });
      updateConfigStatusUI();
      showToast(`Configuration chargée : ${file.name}`, 'success');
    } catch (err) {
      showToast(`Erreur JSON : ${err.message}`, 'error');
    }
  });

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
      const cssText = await readFileAsText(file);
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

  dom.btnResetConfig?.addEventListener('click', async () => {
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
  });

  // Actions d'export (HTML, DOCX, PPTX)
  dom.btnExportHtml.addEventListener('click', () => handleExportHtml());
  dom.btnExportDocx.addEventListener('click', () => handleExportDocx());
  dom.btnExportPptx.addEventListener('click', () => handleExportPptx());

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
  dom.folderFileSelect.innerHTML = '';
  if (mdFiles.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Aucun fichier .md';
    dom.folderFileSelect.appendChild(opt);
    dom.folderFileSelect.disabled = true;
    return;
  }

  const defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  defaultOpt.textContent = `Sélectionner un fichier (${mdFiles.length})`;
  dom.folderFileSelect.appendChild(defaultOpt);

  mdFiles.forEach((file, idx) => {
    const opt = document.createElement('option');
    opt.value = String(idx);
    opt.textContent = file.name;
    dom.folderFileSelect.appendChild(opt);
  });

  dom.folderFileSelect.disabled = false;
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
 * Sauvegarde le contenu de l'éditeur par téléchargement classique d'un fichier .md
 * en réinjectant le binaire Base64 complet à la place des objets graphiques [image].
 * @returns {Promise<void>}
 */
async function handleSaveMarkdown() {
  state.markdown = serializeEditorToMarkdown(dom.mdEditor);
  pruneUnusedLocalImages(state.markdown, state.localImages);

  let fileName = state.currentFileName;
  if (!fileName || fileName === 'Sans titre.md') {
    const detectedTitle = extractTitle(state.markdown);
    fileName = detectedTitle ? `${toSlug(detectedTitle)}.md` : 'document.md';
    state.currentFileName = fileName;
  } else if (!/\.(md|markdown)$/i.test(fileName)) {
    fileName = `${fileName}.md`;
    state.currentFileName = fileName;
  }

  const fullMarkdown = resolveImagePaths(state.markdown, state.localImages);
  const blob = new Blob([fullMarkdown], { type: 'text/markdown;charset=utf-8' });
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
    const dataUrl = await readFileAsDataURL(file);
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

  const mermaidSvgMap = await renderMermaidBlocksMap(state.markdown);
  const html = generateStandaloneHTML(state.markdown, {
    docTitle: resolveDocumentTitle(),
    viewMode: state.currentViewport,
    localImages: state.localImages,
    mermaidSvgMap,
    pptConfig: state.outputConfig,
    reportCss: state.reportCss,
    slideCss: state.slideCss,
  });

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(html);
  doc.close();

  const iframeWin = iframe.contentWindow;
  if (iframeWin && state.currentViewport === 'report') {
    if (prevIframeScroll > 0) {
      iframeWin.scrollTo(0, prevIframeScroll);
    }

    // Le défilement de la fenêtre WYSIWYG entraîne la fenêtre non-WYSIWYG (l'éditeur)
    iframeWin.addEventListener('scroll', () => {
      syncScrollIframeToEditor();
    });
  } else if (iframeWin && state.currentViewport === 'slide') {
    updatePlannedSlides();
    syncSlideToCursor();
  }

  renderEditorToc();
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
 * F4 — Exporte le document au format HTML autonome (.html) avec CSS, schémas Mermaid vectoriels et menu de navigation.
 * @returns {Promise<void>}
 */
async function handleExportHtml() {
  state.markdown = serializeEditorToMarkdown(dom.mdEditor);
  const title = resolveDocumentTitle();
  const mermaidSvgMap = await renderMermaidBlocksMap(state.markdown);
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
  showToast('Génération du fichier Word (.docx) en cours...');

  try {
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
  showToast('Génération de la présentation PowerPoint (.pptx) en cours...');

  try {
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

// --- Système de Notifications Textuelles (Sans icône ni émoji) ---

let activeToastTimer = null;

/**
 * Affiche une notification textuelle temporaire en bas à droite de l'écran.
 * @param {string} message - Texte de la notification
 * @param {'info'|'success'|'error'} [type='info'] - Type de notification
 * @returns {void}
 */
function showToast(message, type = 'info') {
  if (!dom.toastContainer) return;
  dom.toastContainer.innerHTML = '';
  if (activeToastTimer) clearTimeout(activeToastTimer);

  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast--error' : type === 'success' ? 'toast--success' : ''}`;
  toast.textContent = message;
  dom.toastContainer.appendChild(toast);

  activeToastTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(6px)';
    setTimeout(() => toast.remove(), 200);
  }, 3200);
}

// --- Gestion du Masquage de l'Éditeur & du Sommaire des Titres (#, ##, ###) ---

/**
 * Bascule la visibilité de la fenêtre non-WYSIWYG (Éditeur Markdown).
 * @param {boolean|null} [forceHide=null] - Forcer le masquage (true) ou l'affichage (false)
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
    renderEditorToc();
  }
}

/**
 * Bascule l'affichage du volet latéral de sommaire des titres dans l'éditeur.
 * @param {boolean|null} [forceCollapse=null] - Forcer le repli (true) ou l'ouverture (false)
 */
function toggleEditorToc(forceCollapse = null) {
  if (!dom.editorTocSidebar) return;
  const isCollapsed = dom.editorTocSidebar.classList.contains('collapsed');
  const shouldCollapse = forceCollapse !== null ? forceCollapse : !isCollapsed;

  if (shouldCollapse) {
    dom.editorTocSidebar.classList.add('collapsed');
    state.isEditorTocCollapsed = true;
    dom.btnToggleEditorToc?.classList.remove('btn-active');
  } else {
    dom.editorTocSidebar.classList.remove('collapsed');
    state.isEditorTocCollapsed = false;
    dom.btnToggleEditorToc?.classList.add('btn-active');
    renderEditorToc();
  }
}

let editorTocDebounceTimer = null;

/**
 * Planifie la mise à jour du sommaire de l'éditeur avec un léger délai pour préserver la fluidité de frappe.
 * @param {number} [delay=200] - Délai en millisecondes
 */
function scheduleEditorTocUpdate(delay = 200) {
  if (editorTocDebounceTimer) clearTimeout(editorTocDebounceTimer);
  editorTocDebounceTimer = setTimeout(() => {
    editorTocDebounceTimer = null;
    renderEditorToc();
  }, delay);
}

/**
 * Analyse le Markdown courant et génère la liste hiérarchique des titres (#, ##, ###) dans le volet sommaire.
 */
function renderEditorToc() {
  if (!dom.editorTocList) return;

  const rawMd = state.markdown || '';
  const lines = rawMd.split('\n');
  const headings = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line.trim())) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(#{1,3})[ \t]+(.*)/);
    if (match) {
      const level = match[1].length;
      const rawText = match[2].trim();
      const cleanText = rawText
        .replace(/[*_`~]/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .trim();

      headings.push({
        level,
        rawText,
        cleanText: cleanText || '(Titre sans texte)',
        lineIndex: i,
      });
    }
  }

  if (dom.editorTocCount) {
    dom.editorTocCount.textContent = `${headings.length} titre${headings.length > 1 ? 's' : ''}`;
  }

  if (headings.length === 0) {
    dom.editorTocList.innerHTML = '<div class="editor-toc-empty">Aucun titre détecté (#, ##, ###)</div>';
    return;
  }

  dom.editorTocList.innerHTML = '';
  const fragment = document.createDocumentFragment();

  headings.forEach((h, idx) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `editor-toc-item level-${h.level}`;
    item.dataset.lineIndex = String(h.lineIndex);
    item.dataset.headingIndex = String(idx);
    item.title = `${'#'.repeat(h.level)} ${h.cleanText} (Ligne ${h.lineIndex + 1})`;

    const tag = document.createElement('span');
    tag.className = 'editor-toc-tag';
    tag.textContent = '#'.repeat(h.level);

    const text = document.createElement('span');
    text.className = 'editor-toc-text';
    text.textContent = h.cleanText;

    item.appendChild(tag);
    item.appendChild(text);

    item.addEventListener('click', (e) => {
      e.preventDefault();
      jumpToEditorHeading(h.lineIndex, h.rawText, h.level);
      dom.editorTocList?.querySelectorAll('.editor-toc-item').forEach((el) => el.classList.remove('active'));
      item.classList.add('active');
    });

    fragment.appendChild(item);
  });

  dom.editorTocList.appendChild(fragment);
  updateActiveTocHeadingOnScroll();
}

/**
 * Fait défiler l'éditeur Markdown jusqu'à la ligne du titre sélectionné et place le curseur.
 * @param {number} lineIndex - Index de la ligne du titre
 * @param {string} rawText - Texte brut du titre
 * @param {number} level - Niveau de titre (1, 2 ou 3)
 */
function jumpToEditorHeading(lineIndex, rawText, level) {
  if (!dom.mdEditor) return;

  const rawMd = state.markdown || '';
  const lines = rawMd.split('\n');
  let charOffset = 0;
  for (let i = 0; i < Math.min(lineIndex, lines.length); i++) {
    charOffset += lines[i].length + 1;
  }

  const pos = findDomPosition(dom.mdEditor, charOffset);
  let targetEl = null;

  if (pos && pos.container) {
    if (pos.container === dom.mdEditor) {
      if (dom.mdEditor.children.length > 0) {
        const idx = Math.min(pos.offset, dom.mdEditor.children.length - 1);
        targetEl = dom.mdEditor.children[idx];
      }
    } else {
      targetEl =
        pos.container.nodeType === Node.ELEMENT_NODE
          ? pos.container
          : pos.container.parentElement;
    }
  }

  if (!targetEl || targetEl === dom.mdEditor) {
    const headingLines = Array.from(dom.mdEditor.querySelectorAll('.md-heading-line'));
    for (const hl of headingLines) {
      if (
        hl.textContent.includes(rawText) ||
        (hl.dataset.headingText && rawText.includes(hl.dataset.headingText))
      ) {
        targetEl = hl;
        break;
      }
    }
  }

  if (targetEl && targetEl !== dom.mdEditor) {
    const editorRect = dom.mdEditor.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const targetY = dom.mdEditor.scrollTop + (targetRect.top - editorRect.top) - 20;

    dom.mdEditor.scrollTo({
      top: Math.max(0, targetY),
      behavior: 'smooth',
    });

    targetEl.classList.remove('heading-jump-highlight');
    void targetEl.offsetWidth;
    targetEl.classList.add('heading-jump-highlight');
    setTimeout(() => {
      targetEl.classList.remove('heading-jump-highlight');
    }, 1200);

    if (pos && pos.container) {
      try {
        dom.mdEditor.focus();
        const range = document.createRange();
        range.setStart(pos.container, pos.offset);
        range.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (_) {}
    }

    if (state.currentViewport === 'slide') {
      syncSlideToCursor();
    }
  }
}

let activeTocScrollTimer = null;

/**
 * Met à jour l'élément actif du sommaire en fonction du défilement actuel dans l'éditeur.
 */
function updateActiveTocHeadingOnScroll() {
  if (!dom.editorTocList || activeTocScrollTimer) return;
  activeTocScrollTimer = setTimeout(() => {
    activeTocScrollTimer = null;
    const items = Array.from(dom.editorTocList.querySelectorAll('.editor-toc-item'));
    if (items.length === 0) return;

    const rawMd = state.markdown || '';
    const lines = rawMd.split('\n');
    const scrollTop = dom.mdEditor.scrollTop;
    const editorRect = dom.mdEditor.getBoundingClientRect();

    let activeItem = null;

    for (const item of items) {
      const lineIdx = parseInt(item.dataset.lineIndex, 10);
      if (isNaN(lineIdx)) continue;

      let charOffset = 0;
      for (let i = 0; i < Math.min(lineIdx, lines.length); i++) {
        charOffset += lines[i].length + 1;
      }

      const pos = findDomPosition(dom.mdEditor, charOffset);
      if (pos && pos.container) {
        const el =
          pos.container.nodeType === Node.ELEMENT_NODE
            ? pos.container
            : pos.container.parentElement;
        if (el && el !== dom.mdEditor) {
          const top = el.getBoundingClientRect().top - editorRect.top + scrollTop;
          if (top <= scrollTop + 80) {
            activeItem = item;
          } else {
            break;
          }
        }
      }
    }

    if (activeItem) {
      items.forEach((el) => el.classList.remove('active'));
      activeItem.classList.add('active');
    }
  }, 100);
}
