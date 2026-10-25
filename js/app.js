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
 * Calcule la longueur en unités de curseur d'un nœud DOM
 * (1 par caractère texte ou saut de ligne, 1 par objet graphique .image-cartouche, 0 pour la sentinelle).
 * @param {Node} node
 * @returns {number}
 */
function getNodeUnitLength(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.nodeValue.length;
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    if (node.classList.contains('image-cartouche')) return 1;
    if (node.tagName === 'BR') return node.dataset.sentinel === 'true' ? 0 : 1;
    let sum = 0;
    for (const child of node.childNodes) {
      sum += getNodeUnitLength(child);
    }
    return sum;
  }
  return 0;
}

/**
 * Calcule l'offset en unités depuis le début de root jusqu'au point DOM (targetContainer, targetOffset).
 * @param {HTMLElement} root
 * @param {Node} targetContainer
 * @param {number} targetOffset
 * @returns {number|null}
 */
function getPointOffset(root, targetContainer, targetOffset) {
  let offset = 0;
  let found = false;

  const walk = (node) => {
    if (found) return;
    if (node === targetContainer) {
      if (node.nodeType === Node.TEXT_NODE) {
        offset += targetOffset;
      } else {
        for (let i = 0; i < targetOffset && i < node.childNodes.length; i++) {
          offset += getNodeUnitLength(node.childNodes[i]);
        }
      }
      found = true;
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      offset += node.nodeValue.length;
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.classList.contains('image-cartouche')) {
        if (node.contains(targetContainer)) {
          offset += 1;
          found = true;
          return;
        }
        offset += 1;
        return;
      }
      if (node.tagName === 'BR') {
        if (node.dataset.sentinel !== 'true') offset += 1;
        return;
      }
      for (const child of node.childNodes) {
        walk(child);
        if (found) return;
      }
    }
  };

  walk(root);
  return found ? offset : null;
}

/**
 * Retourne les offsets (start, end) de la sélection courante dans #mdEditor.
 * @returns {{ start: number, end: number } | null}
 */
function getEditorSelectionOffsets() {
  if (!dom.mdEditor) return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !dom.mdEditor.contains(sel.anchorNode)) {
    return null;
  }
  const range = sel.getRangeAt(0);
  const start = getPointOffset(dom.mdEditor, range.startContainer, range.startOffset);
  const end = range.collapsed
    ? start
    : getPointOffset(dom.mdEditor, range.endContainer, range.endOffset);
  if (start === null || end === null) return null;
  return { start, end };
}

/**
 * Retrouve le couple (container, offset) DOM correspondant à un nombre d'unités depuis le début de root.
 * @param {HTMLElement} root
 * @param {number} targetUnits
 * @returns {{ container: Node, offset: number }}
 */
function findDomPosition(root, targetUnits) {
  let remaining = Math.max(0, targetUnits);
  let result = null;

  const walk = (node) => {
    if (result) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.nodeValue.length;
      if (remaining <= len) {
        result = { container: node, offset: remaining };
        return;
      }
      remaining -= len;
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.classList.contains('image-cartouche')) {
        const parent = node.parentNode;
        const idx = Array.from(parent.childNodes).indexOf(node);
        if (remaining === 0) {
          result = { container: parent, offset: idx };
          return;
        }
        if (remaining === 1) {
          result = { container: parent, offset: idx + 1 };
          return;
        }
        remaining -= 1;
        return;
      }
      if (node.tagName === 'BR') {
        if (node.dataset.sentinel === 'true') {
          const parent = node.parentNode;
          const idx = Array.from(parent.childNodes).indexOf(node);
          result = { container: parent, offset: idx };
          return;
        }
        remaining -= 1;
        return;
      }
      for (const child of node.childNodes) {
        walk(child);
        if (result) return;
      }
    }
  };

  walk(root);

  if (!result) {
    const sentinel = root.querySelector('br[data-sentinel="true"]');
    if (sentinel) {
      const idx = Array.from(root.childNodes).indexOf(sentinel);
      return { container: root, offset: idx };
    }
    return { container: root, offset: root.childNodes.length };
  }
  return result;
}

/**
 * Restaure la sélection / position du curseur dans #mdEditor à partir des offsets en unités.
 * @param {{ start: number, end: number } | null} offsets
 * @returns {void}
 */
function restoreEditorSelectionOffsets(offsets) {
  if (!dom.mdEditor || !offsets) return;
  const startPos = findDomPosition(dom.mdEditor, offsets.start);
  const endPos =
    offsets.end === offsets.start
      ? startPos
      : findDomPosition(dom.mdEditor, offsets.end);

  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.setStart(startPos.container, startPos.offset);
  range.setEnd(endPos.container, endPos.offset);
  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * Parse récursivement un segment de texte brut (sans cartouche image) pour appliquer
 * le formatage non-WYSIWYG aux balises inline :
 * - Code inline (`...`)
 * - Liens ([libellé](url))
 * - Gras + Italique (***...***)
 * - Gras (**...**)
 * - Souligné (__...__ ou <u>...</u>)
 * - Barré (~~...~~)
 * - Italique (*...* ou _..._)
 * tout en conservant l'ensemble des délimiteurs visibles.
 * L'invariant de longueur (1 caractère = 1 unité de sélection) est intégralement préservé.
 * @param {string} text
 * @returns {DocumentFragment}
 */
function buildFormattedTextNodes(text) {
  const fragment = document.createDocumentFragment();
  if (!text) return fragment;

  const inlineFormatRegex =
    /(`[^`\n]+?`)|(\[(?!image\s*:)([^\][\n]+)\]\(([^)\n]+)\))|(\*\*\*(?=\S)((?:(?!\*\*\*).)+?)(?<=\S)\*\*\*(?!\*))|(\*\*(?=\S)((?:(?!\*\*).)+?)(?<=\S)\*\*(?!\*))|(__(?=\S)((?:(?!__).)+?)(?<=\S)__(?!_))|(~~(?=\S)((?:(?!~~).)+?)(?<=\S)~~(?!~))|((?<!\*)\*(?!\*)(?=\S)((?:[^*]|\*\*)+?)(?<=\S)(?<!\*)\*(?!\*))|((?<![_\w])_(?!_)(?=\S)((?:[^_]|__)+?)(?<=\S)(?<!_)_(?![_\w]))|(<u>((?:(?!<\/u>).)+?)<\/u>)/g;

  let lastIndex = 0;
  let match;

  while ((match = inlineFormatRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      fragment.appendChild(
        document.createTextNode(text.substring(lastIndex, match.index))
      );
    }

    const span = document.createElement('span');

    if (match[1] !== undefined) {
      // `code inline` (pas d'interprétation récursive à l'intérieur)
      span.className = 'md-inline-code';
      span.appendChild(document.createTextNode(match[1]));
    } else if (match[2] !== undefined) {
      // [libellé](url)
      span.className = 'md-link';
      const openBracket = document.createElement('span');
      openBracket.className = 'md-link-bracket';
      openBracket.textContent = '[';

      const labelSpan = document.createElement('span');
      labelSpan.className = 'md-link-label';
      labelSpan.appendChild(buildFormattedTextNodes(match[3]));

      const midBracket = document.createElement('span');
      midBracket.className = 'md-link-bracket';
      midBracket.textContent = '](';

      const urlSpan = document.createElement('span');
      urlSpan.className = 'md-link-url';
      urlSpan.textContent = match[4];

      const closeBracket = document.createElement('span');
      closeBracket.className = 'md-link-bracket';
      closeBracket.textContent = ')';

      span.appendChild(openBracket);
      span.appendChild(labelSpan);
      span.appendChild(midBracket);
      span.appendChild(urlSpan);
      span.appendChild(closeBracket);
    } else if (match[5] !== undefined) {
      // ***gras et italique***
      span.className = 'md-bold md-italic';
      span.appendChild(document.createTextNode('***'));
      span.appendChild(buildFormattedTextNodes(match[6]));
      span.appendChild(document.createTextNode('***'));
    } else if (match[7] !== undefined) {
      // **gras**
      span.className = 'md-bold';
      span.appendChild(document.createTextNode('**'));
      span.appendChild(buildFormattedTextNodes(match[8]));
      span.appendChild(document.createTextNode('**'));
    } else if (match[9] !== undefined) {
      // __souligné__
      span.className = 'md-underline';
      span.appendChild(document.createTextNode('__'));
      span.appendChild(buildFormattedTextNodes(match[10]));
      span.appendChild(document.createTextNode('__'));
    } else if (match[11] !== undefined) {
      // ~~barré~~
      span.className = 'md-strike';
      span.appendChild(document.createTextNode('~~'));
      span.appendChild(buildFormattedTextNodes(match[12]));
      span.appendChild(document.createTextNode('~~'));
    } else if (match[13] !== undefined) {
      // *italique*
      span.className = 'md-italic';
      span.appendChild(document.createTextNode('*'));
      span.appendChild(buildFormattedTextNodes(match[14]));
      span.appendChild(document.createTextNode('*'));
    } else if (match[15] !== undefined) {
      // _italique_
      span.className = 'md-italic';
      span.appendChild(document.createTextNode('_'));
      span.appendChild(buildFormattedTextNodes(match[16]));
      span.appendChild(document.createTextNode('_'));
    } else if (match[17] !== undefined) {
      // <u>souligné</u>
      span.className = 'md-underline';
      span.appendChild(document.createTextNode('<u>'));
      span.appendChild(buildFormattedTextNodes(match[18]));
      span.appendChild(document.createTextNode('</u>'));
    }

    span.normalize();
    fragment.appendChild(span);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
  }

  return fragment;
}

/**
 * Construit un DocumentFragment pour une ligne de texte en remplaçant les jetons [image]
 * par les objets graphiques .image-cartouche correspondants et en formatant les balises inline
 * (code inline, liens, gras, souligné, barré, italique) sans masquer les délimiteurs.
 * @param {string} lineText
 * @returns {DocumentFragment}
 */
function buildLineInlineNodes(lineText) {
  const fragment = document.createDocumentFragment();
  if (!lineText) return fragment;

  const cartoucheRegex = /\[image\s*:\s*([^\n]*?)\s*\((img-\d+)\)\]/gi;
  let lastIndex = 0;
  let match;

  while ((match = cartoucheRegex.exec(lineText)) !== null) {
    if (match.index > lastIndex) {
      fragment.appendChild(
        buildFormattedTextNodes(lineText.substring(lastIndex, match.index))
      );
    }
    const alt = (match[1] || 'image').trim();
    const id = match[2];
    fragment.appendChild(createCartoucheElement(id, alt));
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < lineText.length) {
    fragment.appendChild(
      buildFormattedTextNodes(lineText.substring(lastIndex))
    );
  }

  return fragment;
}

/**
 * Indique si une ligne Markdown fait partie d'un tableau (commence par | et contient au moins un second |).
 * @param {string} line
 * @returns {boolean}
 */
function isMarkdownTableLine(line) {
  return /^\s*\|.*\|/.test(line);
}

/**
 * Construit les éléments <span class="md-table-line"> pour un bloc contigu de lignes de tableau
 * en calculant la largeur maximale (en ch) de chaque colonne afin d'aligner visuellement toutes
 * les barres verticales | sans modifier le texte Markdown sous-jacent.
 * @param {string[]} tableLines
 * @returns {HTMLSpanElement[]}
 */
function buildTableBlockRowSpans(tableLines) {
  let maxPrefixWidth = 0;
  const maxColWidths = [];

  const splitRows = tableLines.map((line) => {
    const parts = line.split('|');
    const prefixLen = parts[0].replace(/\t/g, '  ').length;
    if (prefixLen > maxPrefixWidth) {
      maxPrefixWidth = prefixLen;
    }

    // Les segments compris entre deux barres | (indices 1 à parts.length - 2) forment les colonnes fermées
    for (let p = 1; p < parts.length - 1; p++) {
      const colIdx = p - 1;
      const visualLen = parts[p].replace(
        /\[image\s*:\s*([^\n]*?)\s*\((img-\d+)\)\]/gi,
        '              '
      ).length;
      const prevMax = maxColWidths[colIdx] || 0;
      if (visualLen > prevMax) {
        maxColWidths[colIdx] = visualLen;
      }
    }
    return parts;
  });

  return splitRows.map((parts) => {
    const rowSpan = document.createElement('span');
    rowSpan.className = 'md-table-line';

    if (maxPrefixWidth > 0) {
      const prefixSpan = document.createElement('span');
      prefixSpan.className = 'md-table-prefix';
      prefixSpan.style.minWidth = `${maxPrefixWidth}ch`;
      if (parts[0].length > 0) {
        prefixSpan.appendChild(buildLineInlineNodes(parts[0]));
      }
      rowSpan.appendChild(prefixSpan);
    } else if (parts[0].length > 0) {
      rowSpan.appendChild(buildLineInlineNodes(parts[0]));
    }

    for (let p = 1; p < parts.length - 1; p++) {
      const colIdx = p - 1;
      const pipeSpan = document.createElement('span');
      pipeSpan.className = 'md-table-pipe';
      pipeSpan.textContent = '|';
      rowSpan.appendChild(pipeSpan);

      const cellSpan = document.createElement('span');
      cellSpan.className = 'md-table-cell';
      const targetWidth = Math.max(1, maxColWidths[colIdx] || 1);
      cellSpan.style.minWidth = `${targetWidth}ch`;
      if (parts[p].length > 0) {
        cellSpan.appendChild(buildLineInlineNodes(parts[p]));
      }
      rowSpan.appendChild(cellSpan);
    }

    const lastPipeSpan = document.createElement('span');
    lastPipeSpan.className = 'md-table-pipe';
    lastPipeSpan.textContent = '|';
    rowSpan.appendChild(lastPipeSpan);

    const trailingPart = parts[parts.length - 1];
    if (trailingPart.length > 0) {
      rowSpan.appendChild(buildLineInlineNodes(trailingPart));
    }

    return rowSpan;
  });
}

/**
 * Peuple l'éditeur (#mdEditor) à partir d'un texte Markdown :
 * - Convertit les images Base64 / jetons en objets graphiques .image-cartouche
 * - Formate les blocs de code (``` ... ```) sans interpréter le Markdown interne
 * - Aligne visuellement les colonnes des tableaux Markdown via CSS sans altérer le fichier .md
 * - Formate les séparateurs horizontaux (---, ***, ___), les titres (# à #####) et les citations (> ...)
 * - Décale les listes (- *, 1.) et listes de tâches (- [ ], - [x]) de 5 caractères par niveau d'imbrication
 * @param {string} markdownText
 * @param {boolean} [preserveCaret=false] - Si true, sauvegarde et restaure la position du curseur
 * @returns {void}
 */
function setEditorContent(markdownText, preserveCaret = false) {
  if (!dom.mdEditor) return;

  const savedOffsets = preserveCaret ? getEditorSelectionOffsets() : null;
  dom.mdEditor.innerHTML = '';

  if (!markdownText) {
    return;
  }

  const normalizedText = collapseBase64ToCartouches(
    markdownText,
    state.localImages,
    getNextImageId
  ).replace(/\[binaire base64 masqué\]\r?\n?/gi, '');

  const lines = normalizedText.split('\n');
  const fragment = document.createDocumentFragment();
  let inCodeBlock = false;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Délimiteur de bloc de code (```)
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      if (line.length > 0) {
        const fenceSpan = document.createElement('span');
        fenceSpan.className = 'md-codeblock-fence';
        fenceSpan.textContent = line;
        fragment.appendChild(fenceSpan);
      }
      if (i < lines.length - 1) {
        fragment.appendChild(document.createTextNode('\n'));
      }
      i++;
      continue;
    }

    // Contenu interne d'un bloc de code (pas d'interprétation Markdown)
    if (inCodeBlock) {
      if (line.length > 0) {
        const codeLineSpan = document.createElement('span');
        codeLineSpan.className = 'md-codeblock-line';
        codeLineSpan.textContent = line;
        fragment.appendChild(codeLineSpan);
      }
      if (i < lines.length - 1) {
        fragment.appendChild(document.createTextNode('\n'));
      }
      i++;
      continue;
    }

    // Regroupement et alignement automatique des colonnes pour les blocs de tableaux Markdown
    if (isMarkdownTableLine(line)) {
      const tableLines = [];
      let j = i;
      while (j < lines.length && isMarkdownTableLine(lines[j])) {
        tableLines.push(lines[j]);
        j++;
      }

      const tableRowSpans = buildTableBlockRowSpans(tableLines);
      tableRowSpans.forEach((rowSpan, rowOffset) => {
        fragment.appendChild(rowSpan);
        const absoluteLineIdx = i + rowOffset;
        if (absoluteLineIdx < lines.length - 1) {
          fragment.appendChild(document.createTextNode('\n'));
        }
      });

      i = j;
      continue;
    }

    if (line.length > 0) {
      const hrMatch = line.match(/^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/);
      const headingMatch = !hrMatch ? line.match(/^(#{1,5})(?!#)/) : null;
      const quoteMatch =
        !hrMatch && !headingMatch ? line.match(/^([ \t]*)(>+)[ \t]*/) : null;
      const listMatch =
        !hrMatch && !headingMatch && !quoteMatch
          ? line.match(/^([ \t]*)(?:[-*]|\d+[.)])[ \t]+/)
          : null;

      if (hrMatch) {
        const hrSpan = document.createElement('span');
        hrSpan.className = 'md-hr-line';
        hrSpan.textContent = line;
        fragment.appendChild(hrSpan);
      } else if (headingMatch) {
        const level = headingMatch[1].length;
        const headingSpan = document.createElement('span');
        headingSpan.className = `md-heading-line md-h${level}`;
        headingSpan.appendChild(buildLineInlineNodes(line));
        fragment.appendChild(headingSpan);
      } else if (quoteMatch) {
        const quoteLevel = quoteMatch[2].length;
        const quoteSpan = document.createElement('span');
        quoteSpan.className = 'md-quote-line';
        quoteSpan.style.paddingLeft = `${quoteLevel * 2}ch`;
        quoteSpan.appendChild(buildLineInlineNodes(line));
        fragment.appendChild(quoteSpan);
      } else if (listMatch) {
        const rawIndent = listMatch[1];
        const indentSpaces = rawIndent.replace(/\t/g, '  ').length;
        const rawVisualWidth = rawIndent.length;
        const nestingLevel = Math.ceil(indentSpaces / 2);
        const targetShiftCh = (nestingLevel + 1) * 5;
        const paddingLeftCh = Math.max(0, targetShiftCh - rawVisualWidth);

        const listSpan = document.createElement('span');
        listSpan.dataset.listLevel = String(nestingLevel);
        listSpan.style.paddingLeft = `${paddingLeftCh}ch`;

        const taskMatch = line.match(
          /^([ \t]*(?:[-*]|\d+[.)])[ \t]+)(\[([ xX])\])([ \t]+.*|$)/
        );

        if (taskMatch) {
          const isChecked = taskMatch[3].toLowerCase() === 'x';
          listSpan.className = isChecked
            ? 'md-list-line md-task-line md-task-checked'
            : 'md-list-line md-task-line';

          listSpan.appendChild(document.createTextNode(taskMatch[1]));

          const boxSpan = document.createElement('span');
          boxSpan.className = 'md-task-box';
          boxSpan.textContent = taskMatch[2];
          listSpan.appendChild(boxSpan);

          if (taskMatch[4]) {
            const textSpan = document.createElement('span');
            textSpan.className = 'md-task-text';
            textSpan.appendChild(buildLineInlineNodes(taskMatch[4]));
            listSpan.appendChild(textSpan);
          }
        } else {
          listSpan.className = 'md-list-line';
          listSpan.appendChild(buildLineInlineNodes(line));
        }

        fragment.appendChild(listSpan);
      } else {
        fragment.appendChild(buildLineInlineNodes(line));
      }
    }

    if (i < lines.length - 1) {
      fragment.appendChild(document.createTextNode('\n'));
    }
    i++;
  }

  dom.mdEditor.appendChild(fragment);
  ensureTrailingSentinel();

  if (savedOffsets) {
    restoreEditorSelectionOffsets(savedOffsets);
  }
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
    setEditorContent(state.markdown, true);
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

  // F2 — Éditeur de texte standard avec objets graphiques .image-cartouche et balises # à ##### (Moitié gauche)
  dom.mdEditor.addEventListener('input', (e) => {
    if (e.isComposing) return;
    syncFromEditorDOM();
  });

  dom.mdEditor.addEventListener('compositionend', () => {
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

      const sel = window.getSelection();
      const offsets = getEditorSelectionOffsets();
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
                restoreEditorSelectionOffsets({
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
          restoreEditorSelectionOffsets({
            start: offsets.start + 2,
            end: offsets.end + 2,
          });
        }
        return;
      }

      if (!e.shiftKey) {
        insertNodeAtEditorCaret(document.createTextNode('  '));
        syncFromEditorDOM();
      }
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
