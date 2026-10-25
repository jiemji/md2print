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
  createImageCartouche,
  collapseBase64ToCartouches,
  resolveImagePaths,
} from './utils.js';
import { generateStandaloneHTML } from './HtmlGenerator.js';
import { generateDocx } from './DocxGenerator.js';
import { generatePptx } from './PptxGenerator.js';

// --- État Applicatif Singleton ---
const state = {
  markdown: '',
  currentFileName: 'Sans titre.md',
  isDirty: false,
  folderFiles: [],
  selectedFolderIndex: '',
  localImages: {},
  imageSeq: 1,
  currentViewport: 'report', // 'report' | 'slide'
  theme: 'dark', // 'dark' | 'sepia'
  outputConfig: null,
  configFileName: 'output_config.json (défaut)',
  templateBuffer: null,
  templateFileName: 'Modele_word.docx (défaut)',
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

  dom.dropdownConfig = document.getElementById('dropdownConfig');
  dom.btnToggleConfig = document.getElementById('btnToggleConfig');
  dom.configStatusText = document.getElementById('configStatusText');
  dom.btnLoadConfigJson = document.getElementById('btnLoadConfigJson');
  dom.configJsonInput = document.getElementById('configJsonInput');
  dom.btnLoadTemplateDocx = document.getElementById('btnLoadTemplateDocx');
  dom.templateDocxInput = document.getElementById('templateDocxInput');

  dom.dropdownExport = document.getElementById('dropdownExport');
  dom.btnToggleExport = document.getElementById('btnToggleExport');
  dom.btnExportHtml = document.getElementById('btnExportHtml');
  dom.btnExportDocx = document.getElementById('btnExportDocx');
  dom.btnExportPptx = document.getElementById('btnExportPptx');

  dom.btnToggleTheme = document.getElementById('btnToggleTheme');

  dom.workspace = document.getElementById('workspace');
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
  await loadDefaultConfigAndTemplate();
  initEventListeners();
  initResizer();
  updateFileNameDisplay();
  updatePreview();
});

/**
 * Charge automatiquement config/output_config.json et templates/Modele_word.docx au démarrage.
 * @returns {Promise<void>}
 */
async function loadDefaultConfigAndTemplate() {
  try {
    const resConfig = await fetch('config/output_config.json');
    if (resConfig.ok) {
      state.outputConfig = await resConfig.json();
      state.configFileName = 'output_config.json (défaut)';
    }
  } catch {
    state.configFileName = 'Configuration interne';
  }

  try {
    const tplPath = state.outputConfig?.documents?.[0]?.path || 'templates/Modele_word.docx';
    const resTpl = await fetch(tplPath);
    if (resTpl.ok) {
      state.templateBuffer = await resTpl.arrayBuffer();
      state.templateFileName = `${tplPath.split('/').pop()} (défaut)`;
    }
  } catch {
    state.templateFileName = 'Aucun modèle chargé';
  }

  updateConfigStatusUI();
}

/**
 * Met à jour le texte d'état dans le menu déroulant Configuration.
 * @returns {void}
 */
function updateConfigStatusUI() {
  if (!dom.configStatusText) return;
  dom.configStatusText.innerHTML = `Config : ${escapeHtml(state.configFileName)}<br>Modèle : ${escapeHtml(state.templateFileName)}`;
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
 * Demande confirmation à l'utilisateur si des modifications non sauvegardées sont présentes.
 * @returns {boolean} true si l'action peut continuer
 */
function confirmDiscardIfDirty() {
  if (!state.isDirty) return true;
  return window.confirm('Des modifications non sauvegardées seront perdues. Voulez-vous continuer ?');
}

// --- Gestion de l'Objet Graphique Cartouche [image] dans l'Éditeur ---

/**
 * Génère un identifiant court unique pour une nouvelle image importée en Base64.
 * @returns {string}
 */
function getNextImageId() {
  return `img-${state.imageSeq++}`;
}

/**
 * Crée l'élément DOM graphique (cartouche de 2 lignes de hauteur) représentant une image Base64.
 * @param {string} imgId - Identifiant interne dans state.localImages
 * @param {string} [alt='image'] - Texte alternatif de l'image
 * @returns {HTMLSpanElement}
 */
function createCartoucheElement(imgId, alt = 'image') {
  const span = document.createElement('span');
  span.className = 'image-cartouche';
  span.contentEditable = 'false';
  span.dataset.imageId = imgId;
  span.dataset.imageAlt = alt || 'image';
  span.title = alt ? `Image : ${alt}` : 'Image encapsulée en Base64';
  span.textContent = '[image]';
  return span;
}

/**
 * Sérialise le contenu DOM de l'éditeur (#mdEditor) en chaîne Markdown,
 * en convertissant chaque objet graphique .image-cartouche en jeton de cartouche.
 * @returns {string}
 */
function serializeEditorToMarkdown() {
  if (!dom.mdEditor) return '';
  let result = '';

  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        result += child.nodeValue;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        if (child.classList.contains('image-cartouche')) {
          const id = child.dataset.imageId || '';
          const alt = child.dataset.imageAlt || 'image';
          result += createImageCartouche(id, alt);
        } else if (child.tagName === 'BR') {
          if (child.dataset.sentinel === 'true') continue;
          result += '\n';
        } else if (child.tagName === 'DIV' || child.tagName === 'P') {
          if (result.length > 0 && !result.endsWith('\n')) {
            result += '\n';
          }
          walk(child);
        } else {
          walk(child);
        }
      }
    }
  };

  walk(dom.mdEditor);
  return result.replace(/\u00A0/g, ' ');
}

/**
 * Peuple l'éditeur (#mdEditor) à partir d'un texte Markdown contenant éventuellement des cartouches
 * ou des images Base64, en créant les objets graphiques .image-cartouche correspondants.
 * @param {string} markdownText
 * @returns {void}
 */
function setEditorContent(markdownText) {
  if (!dom.mdEditor) return;
  dom.mdEditor.innerHTML = '';

  if (!markdownText) return;

  const normalizedText = collapseBase64ToCartouches(
    markdownText,
    state.localImages,
    getNextImageId
  );

  const cartoucheRegex = /\[image\s*:\s*([^\n]*?)\s*\((img-\d+)\)\]\r?\n\[binaire base64 masqué\]/gi;
  let lastIndex = 0;
  let match;
  const fragment = document.createDocumentFragment();

  while ((match = cartoucheRegex.exec(normalizedText)) !== null) {
    if (match.index > lastIndex) {
      fragment.appendChild(
        document.createTextNode(normalizedText.substring(lastIndex, match.index))
      );
    }
    const alt = (match[1] || 'image').trim();
    const id = match[2];
    fragment.appendChild(createCartoucheElement(id, alt));
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < normalizedText.length) {
    fragment.appendChild(document.createTextNode(normalizedText.substring(lastIndex)));
  }

  dom.mdEditor.appendChild(fragment);
  ensureTrailingSentinel();
}

/**
 * Maintient un élément <br data-sentinel="true"> en fin d'éditeur contenteditable
 * afin qu'un seul appui sur Entrée (\n) en fin de texte crée immédiatement une nouvelle ligne visible.
 * @returns {void}
 */
function ensureTrailingSentinel() {
  if (!dom.mdEditor) return;

  // Supprime les sentinelles existantes qui ne sont plus en dernière position
  const existingSentinels = Array.from(
    dom.mdEditor.querySelectorAll('br[data-sentinel="true"]')
  );

  const hasRealContent = Array.from(dom.mdEditor.childNodes).some((node) => {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue.length > 0;
    if (node.nodeType === Node.ELEMENT_NODE) return node.dataset.sentinel !== 'true';
    return false;
  });

  if (!hasRealContent) {
    existingSentinels.forEach((el) => el.remove());
    return;
  }

  let sentinel = existingSentinels.pop();
  existingSentinels.forEach((el) => el.remove());

  if (!sentinel) {
    sentinel = document.createElement('br');
    sentinel.dataset.sentinel = 'true';
  }

  if (dom.mdEditor.lastChild !== sentinel) {
    dom.mdEditor.appendChild(sentinel);
  }
}

/**
 * Insère un nœud DOM (texte ou objet graphique .image-cartouche) à la position courante du curseur dans #mdEditor.
 * @param {Node} node
 * @returns {void}
 */
function insertNodeAtEditorCaret(node) {
  dom.mdEditor.focus();
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !dom.mdEditor.contains(sel.anchorNode)) {
    const sentinel = dom.mdEditor.querySelector('br[data-sentinel="true"]');
    if (sentinel) {
      dom.mdEditor.insertBefore(node, sentinel);
    } else {
      dom.mdEditor.appendChild(node);
    }
    ensureTrailingSentinel();
    return;
  }

  const range = sel.getRangeAt(0);
  range.deleteContents();

  // Si le curseur se trouve sur ou après la sentinelle finale, insérer juste avant elle
  const sentinel = dom.mdEditor.querySelector('br[data-sentinel="true"]');
  if (
    sentinel &&
    ((range.startContainer === dom.mdEditor &&
      range.startOffset >= Array.from(dom.mdEditor.childNodes).indexOf(sentinel)) ||
      range.startContainer === sentinel)
  ) {
    dom.mdEditor.insertBefore(node, sentinel);
  } else {
    range.insertNode(node);
  }

  ensureTrailingSentinel();

  const afterRange = document.createRange();
  afterRange.setStartAfter(node);
  afterRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(afterRange);
}

/**
 * Retire l'état visuel de sélection sur toutes les cartouches graphiques.
 * @returns {void}
 */
function clearCartoucheSelectionStyles() {
  dom.mdEditor
    ?.querySelectorAll('.image-cartouche.is-selected')
    .forEach((el) => el.classList.remove('is-selected'));
}

/**
 * Synchronise la sélection native du navigateur avec l'état visuel (.is-selected) des cartouches.
 * @returns {void}
 */
function updateCartoucheSelectionHighlight() {
  if (!dom.mdEditor) return;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
    clearCartoucheSelectionStyles();
    return;
  }
  const range = sel.getRangeAt(0);
  dom.mdEditor.querySelectorAll('.image-cartouche').forEach((cartouche) => {
    cartouche.classList.toggle('is-selected', range.intersectsNode(cartouche));
  });
}

/**
 * Gère la suppression d'un objet graphique .image-cartouche avec Suppr (Delete) ou Backspace
 * lorsqu'il est sélectionné (au clic ou dans une sélection de texte) ou adjacent au curseur.
 * @param {KeyboardEvent} e
 * @returns {boolean} true si une cartouche graphique a été supprimée
 */
function handleCartoucheDeletion(e) {
  if (e.key !== 'Backspace' && e.key !== 'Delete') return false;

  // 1. Cartouche(s) explicitement marquée(s) comme sélectionnée(s)
  const selectedCartouches = Array.from(
    dom.mdEditor.querySelectorAll('.image-cartouche.is-selected')
  );
  if (selectedCartouches.length > 0) {
    e.preventDefault();
    selectedCartouches.forEach((el) => el.remove());
    syncFromEditorDOM();
    return true;
  }

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);

  // 2. Plage de texte sélectionnée englobant ou intersectant une cartouche graphique
  if (!range.collapsed) {
    const intersecting = Array.from(dom.mdEditor.querySelectorAll('.image-cartouche')).filter(
      (el) => range.intersectsNode(el)
    );
    if (intersecting.length > 0) {
      e.preventDefault();
      range.deleteContents();
      intersecting.forEach((el) => {
        if (el.parentNode) el.remove();
      });
      syncFromEditorDOM();
      return true;
    }
    return false;
  }

  // 3. Curseur simple collé juste après (Backspace) ou juste avant (Delete) une cartouche graphique
  const { startContainer, startOffset } = range;

  if (e.key === 'Backspace') {
    if (startContainer.nodeType === Node.TEXT_NODE && startOffset === 0) {
      const prev = startContainer.previousSibling;
      if (prev?.nodeType === Node.ELEMENT_NODE && prev.classList.contains('image-cartouche')) {
        e.preventDefault();
        prev.remove();
        syncFromEditorDOM();
        return true;
      }
    } else if (startContainer.nodeType === Node.ELEMENT_NODE && startOffset > 0) {
      const prev = startContainer.childNodes[startOffset - 1];
      if (prev?.nodeType === Node.ELEMENT_NODE && prev.classList.contains('image-cartouche')) {
        e.preventDefault();
        prev.remove();
        syncFromEditorDOM();
        return true;
      }
    }
  } else if (e.key === 'Delete') {
    if (
      startContainer.nodeType === Node.TEXT_NODE &&
      startOffset === startContainer.nodeValue.length
    ) {
      const next = startContainer.nextSibling;
      if (next?.nodeType === Node.ELEMENT_NODE && next.classList.contains('image-cartouche')) {
        e.preventDefault();
        next.remove();
        syncFromEditorDOM();
        return true;
      }
    } else if (
      startContainer.nodeType === Node.ELEMENT_NODE &&
      startOffset < startContainer.childNodes.length
    ) {
      const next = startContainer.childNodes[startOffset];
      if (next?.nodeType === Node.ELEMENT_NODE && next.classList.contains('image-cartouche')) {
        e.preventDefault();
        next.remove();
        syncFromEditorDOM();
        return true;
      }
    }
  }

  return false;
}

/**
 * Met à jour state.markdown à partir du DOM de l'éditeur et rafraîchit l'aperçu.
 * @returns {void}
 */
function syncFromEditorDOM() {
  state.markdown = serializeEditorToMarkdown();
  if (!state.isDirty) {
    state.isDirty = true;
    updateFileNameDisplay();
  }
  if (state.markdown.length === 0 && !dom.mdEditor.querySelector('.image-cartouche')) {
    dom.mdEditor.innerHTML = '';
  } else {
    ensureTrailingSentinel();
  }
  updatePreview();
}

// --- Attachement des Événements ---
/**
 * Attache l'ensemble des écouteurs d'événements de l'interface (menus, éditeur, raccourcis, exports).
 * @returns {void}
 */
function initEventListeners() {
  // F1.3 — Nouveau fichier (Vider l'écran)
  dom.btnNewFile.addEventListener('click', () => {
    if (!confirmDiscardIfDirty()) return;
    state.markdown = '';
    state.currentFileName = 'Sans titre.md';
    state.isDirty = false;
    state.selectedFolderIndex = '';
    setEditorContent('');
    if (dom.folderFileSelect) dom.folderFileSelect.value = '';
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

  // Raccourci global Ctrl+S / Cmd+S
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      handleSaveMarkdown();
    }
  });

  // F2 — Éditeur de texte standard avec objets graphiques .image-cartouche (Moitié gauche)
  dom.mdEditor.addEventListener('input', () => {
    syncFromEditorDOM();
  });

  // Clic sur une cartouche graphique [image] -> sélectionne l'objet graphique comme du texte
  dom.mdEditor.addEventListener('click', (e) => {
    const cartouche = e.target.closest('.image-cartouche');
    clearCartoucheSelectionStyles();
    if (cartouche) {
      cartouche.classList.add('is-selected');
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNode(cartouche);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  });

  document.addEventListener('selectionchange', () => {
    updateCartoucheSelectionHighlight();
  });

  // Gestion des touches dans l'éditeur : Backspace/Delete sur cartouche, Tab (2 espaces) et Enter (\n)
  dom.mdEditor.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      if (handleCartoucheDeletion(e)) return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      clearCartoucheSelectionStyles();
      insertNodeAtEditorCaret(document.createTextNode('  '));
      syncFromEditorDOM();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      clearCartoucheSelectionStyles();
      insertNodeAtEditorCaret(document.createTextNode('\n'));
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
      clearCartoucheSelectionStyles();
      insertNodeAtEditorCaret(document.createTextNode(plainText));
      syncFromEditorDOM();
    }
  });

  // Synchronisation du défilement (Éditeur -> Iframe)
  dom.mdEditor.addEventListener('scroll', () => {
    if (isSyncingFromIframe || state.currentViewport !== 'report') return;
    const iframeWin = dom.previewIframe.contentWindow;
    const iframeDoc = dom.previewIframe.contentDocument;
    if (!iframeWin || !iframeDoc?.documentElement) return;

    const maxEditorScroll = dom.mdEditor.scrollHeight - dom.mdEditor.clientHeight;
    if (maxEditorScroll <= 0) return;

    const ratio = dom.mdEditor.scrollTop / maxEditorScroll;
    const maxIframeScroll =
      iframeDoc.documentElement.scrollHeight - iframeDoc.documentElement.clientHeight;

    isSyncingFromEditor = true;
    iframeWin.scrollTo(0, ratio * Math.max(0, maxIframeScroll));
    clearTimeout(editorScrollTimer);
    editorScrollTimer = setTimeout(() => {
      isSyncingFromEditor = false;
    }, 60);
  });

  // F3 / F4 — Sélecteur de Vue (Rapport / Slide)
  dom.btnViewReport.addEventListener('click', () => setViewMode('report'));
  dom.btnViewSlide.addEventListener('click', () => setViewMode('slide'));

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

  // Chargement personnalisé de output_config.json et template .docx
  dom.btnLoadConfigJson.addEventListener('click', () => {
    dom.configJsonInput.value = '';
    dom.configJsonInput.click();
  });

  dom.configJsonInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      state.outputConfig = JSON.parse(text);
      state.configFileName = file.name;
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
      updateConfigStatusUI();
      showToast(`Modèle Word chargé : ${file.name}`, 'success');
    } catch (err) {
      showToast(`Erreur modèle Word : ${err.message}`, 'error');
    }
  });

  // Actions d'export (HTML, DOCX, PPTX)
  dom.btnExportHtml.addEventListener('click', () => handleExportHtml());
  dom.btnExportDocx.addEventListener('click', () => handleExportDocx());
  dom.btnExportPptx.addEventListener('click', () => handleExportPptx());

  // F7 — Bascule de Thème (Sombre Bleu/Gris <-> Clair Sépia)
  dom.btnToggleTheme.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'sepia' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
    dom.btnToggleTheme.textContent =
      state.theme === 'dark' ? 'Thème : Sombre' : 'Thème : Sépia';
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
    setEditorContent(rawContent);
    state.markdown = serializeEditorToMarkdown();
    state.currentFileName = file.name;
    state.isDirty = false;
    dom.mdEditor.scrollTop = 0;
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
 * @returns {void}
 */
function handleSaveMarkdown() {
  state.markdown = serializeEditorToMarkdown();
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
  updateFileNameDisplay();
  showToast(`Fichier sauvegardé : ${fileName}`, 'success');
}

/**
 * Insère une image déposée ou collée sous forme d'objet graphique [image] (2 lignes de hauteur)
 * dans l'éditeur, tout en conservant le binaire Base64 en mémoire dans state.localImages.
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
    if (file.name) {
      state.localImages[file.name] = dataUrl;
      state.localImages[file.name.toLowerCase()] = dataUrl;
    }

    const cartoucheEl = createCartoucheElement(imgId, alt);
    insertNodeAtEditorCaret(cartoucheEl);
    syncFromEditorDOM();
    showToast(`Image insérée : ${alt}`, 'success');
  } catch (err) {
    showToast(`Erreur image : ${err.message}`, 'error');
  }
}

// --- Gestion de l'Aperçu Iframe & Scroll Sync ---

let isSyncingFromEditor = false;
let isSyncingFromIframe = false;
let editorScrollTimer = null;
let iframeScrollTimer = null;

/**
 * Change le mode d'affichage (Rapport ou Slide) et met à jour l'aperçu.
 * @param {'report'|'slide'} mode - Mode de visualisation cible
 * @returns {void}
 */
function setViewMode(mode) {
  state.currentViewport = mode;
  dom.btnViewReport.classList.toggle('active', mode === 'report');
  dom.btnViewSlide.classList.toggle('active', mode === 'slide');
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
 * Met à jour l'iframe de prévisualisation avec le document HTML autonome.
 * @returns {void}
 */
function updatePreview() {
  const iframe = dom.previewIframe;
  if (!iframe) return;

  let prevScrollRatio = 0;
  try {
    const prevDoc = iframe.contentDocument;
    if (prevDoc?.documentElement) {
      const maxPrev =
        prevDoc.documentElement.scrollHeight - prevDoc.documentElement.clientHeight;
      if (maxPrev > 0) {
        prevScrollRatio = (iframe.contentWindow?.scrollY || 0) / maxPrev;
      }
    }
  } catch {
    prevScrollRatio = 0;
  }

  const html = generateStandaloneHTML(state.markdown, {
    docTitle: resolveDocumentTitle(),
    viewMode: state.currentViewport,
    localImages: state.localImages,
  });

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(html);
  doc.close();

  const iframeWin = iframe.contentWindow;
  if (iframeWin && state.currentViewport === 'report') {
    setTimeout(() => {
      const newDoc = iframe.contentDocument;
      if (newDoc?.documentElement && prevScrollRatio > 0) {
        const maxNew =
          newDoc.documentElement.scrollHeight - newDoc.documentElement.clientHeight;
        iframeWin.scrollTo(0, prevScrollRatio * Math.max(0, maxNew));
      }
    }, 0);

    iframeWin.addEventListener('scroll', () => {
      if (isSyncingFromEditor || state.currentViewport !== 'report') return;
      const curDoc = iframe.contentDocument;
      if (!curDoc?.documentElement) return;

      const maxIframeScroll =
        curDoc.documentElement.scrollHeight - curDoc.documentElement.clientHeight;
      if (maxIframeScroll <= 0) return;

      const ratio = iframeWin.scrollY / maxIframeScroll;
      const maxEditorScroll = dom.mdEditor.scrollHeight - dom.mdEditor.clientHeight;

      isSyncingFromIframe = true;
      dom.mdEditor.scrollTop = ratio * Math.max(0, maxEditorScroll);
      clearTimeout(iframeScrollTimer);
      iframeScrollTimer = setTimeout(() => {
        isSyncingFromIframe = false;
      }, 60);
    });
  }
}

// --- Exports (HTML, DOCX, PPTX) ---

/**
 * F4 — Exporte le document au format HTML autonome (.html) avec CSS et menu de navigation.
 * @returns {void}
 */
function handleExportHtml() {
  state.markdown = serializeEditorToMarkdown();
  const title = resolveDocumentTitle();
  const html = generateStandaloneHTML(state.markdown, {
    docTitle: title,
    viewMode: state.currentViewport,
    localImages: state.localImages,
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
  state.markdown = serializeEditorToMarkdown();
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
  state.markdown = serializeEditorToMarkdown();
  if (!state.markdown.trim()) {
    showToast('Le document Markdown est vide', 'error');
    return;
  }

  const title = resolveDocumentTitle();
  const pptConfig = state.outputConfig || { templates: [] };
  showToast('Génération de la présentation PowerPoint (.pptx) en cours...');

  try {
    const blob = await generatePptx(
      state.markdown,
      title,
      pptConfig,
      'default',
      state.localImages
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
    dom.paneEditor.style.width = `${percentage}%`;
  });

  document.addEventListener('mouseup', () => {
    if (!isResizing) return;
    isResizing = false;
    dom.paneResizer.classList.remove('is-resizing');
    document.body.classList.remove('resizing-active');
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
