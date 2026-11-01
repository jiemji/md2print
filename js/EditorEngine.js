/**
 * EditorEngine.js — Moteur de l'éditeur Markdown non-WYSIWYG (contenteditable="true")
 * Gère les objets graphiques .image-cartouche (2 lignes de hauteur), la préservation
 * exacte des offsets de sélection (1 caractère = 1 unité, 1 cartouche = 1 unité),
 * la sentinelle finale <br data-sentinel="true">, l'alignement des tableaux en grille CSS
 * et le formatage syntaxique en direct.
 */
import {
  createImageCartouche,
  collapseBase64ToCartouches,
  isMermaidHeaderLine,
  findUnfencedMermaidBlockEnd,
} from './utils.js';

/**
 * Crée l'élément DOM graphique (cartouche de 2 lignes de hauteur) représentant une image Base64.
 * @param {string} imgId - Identifiant interne dans state.localImages
 * @param {string} [alt='image'] - Texte alternatif de l'image
 * @returns {HTMLSpanElement}
 */
export function createCartoucheElement(imgId, alt = 'image') {
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
 * @param {HTMLElement|null} editorEl - Conteneur DOM de l'éditeur
 * @returns {string}
 */
export function serializeEditorToMarkdown(editorEl) {
  if (!editorEl) return '';
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

  walk(editorEl);
  return result.replace(/\u00A0/g, ' ');
}

/**
 * Calcule la longueur en unités de curseur d'un nœud DOM
 * (1 par caractère texte ou saut de ligne, 1 par objet graphique .image-cartouche, 0 pour la sentinelle).
 * @param {Node} node
 * @returns {number}
 */
export function getNodeUnitLength(node) {
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
export function getPointOffset(root, targetContainer, targetOffset) {
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
 * @param {HTMLElement|null} editorEl - Conteneur DOM de l'éditeur
 * @returns {{ start: number, end: number } | null}
 */
export function getEditorSelectionOffsets(editorEl) {
  if (!editorEl) return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !editorEl.contains(sel.anchorNode)) {
    return null;
  }
  const range = sel.getRangeAt(0);
  const start = getPointOffset(editorEl, range.startContainer, range.startOffset);
  const end = range.collapsed
    ? start
    : getPointOffset(editorEl, range.endContainer, range.endOffset);
  if (start === null || end === null) return null;
  return { start, end };
}

/**
 * Retrouve le couple (container, offset) DOM correspondant à un nombre d'unités depuis le début de root.
 * @param {HTMLElement} root
 * @param {number} targetUnits
 * @returns {{ container: Node, offset: number }}
 */
export function findDomPosition(root, targetUnits) {
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
 * @param {HTMLElement|null} editorEl - Conteneur DOM de l'éditeur
 * @param {{ start: number, end: number } | null} offsets
 * @returns {void}
 */
export function restoreEditorSelectionOffsets(editorEl, offsets) {
  if (!editorEl || !offsets) return;
  const startPos = findDomPosition(editorEl, offsets.start);
  const endPos =
    offsets.end === offsets.start
      ? startPos
      : findDomPosition(editorEl, offsets.end);

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
export function buildFormattedTextNodes(text) {
  const fragment = document.createDocumentFragment();
  if (!text) return fragment;

  const inlineFormatRegex =
    /(`[^`\n]+?`)|((?<!\!)\[(?!image\s*:)([^\][\n]+)\]\(([^)\n]+)\))|(\*\*\*(?=\S)((?:(?!\*\*\*).)+?)(?<=\S)\*\*\*(?!\*))|(\*\*(?=\S)((?:(?!\*\*).)+?)(?<=\S)\*\*(?!\*))|(__(?=\S)((?:(?!__).)+?)(?<=\S)__(?!_))|(~~(?=\S)((?:(?!~~).)+?)(?<=\S)~~(?!~))|((?<!\*)\*(?!\*)(?=\S)((?:[^*]|\*\*)+?)(?<=\S)(?<!\*)\*(?!\*))|((?<![_\w])_(?!_)(?=\S)((?:[^_]|__)+?)(?<=\S)(?<!_)_(?![_\w]))|(<u>((?:(?!<\/u>).)+?)<\/u>)/g;

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
      span.className = 'md-inline-code';
      span.appendChild(document.createTextNode(match[1]));
    } else if (match[2] !== undefined) {
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
      span.className = 'md-bold md-italic';
      span.appendChild(document.createTextNode('***'));
      span.appendChild(buildFormattedTextNodes(match[6]));
      span.appendChild(document.createTextNode('***'));
    } else if (match[7] !== undefined) {
      span.className = 'md-bold';
      span.appendChild(document.createTextNode('**'));
      span.appendChild(buildFormattedTextNodes(match[8]));
      span.appendChild(document.createTextNode('**'));
    } else if (match[9] !== undefined) {
      span.className = 'md-underline';
      span.appendChild(document.createTextNode('__'));
      span.appendChild(buildFormattedTextNodes(match[10]));
      span.appendChild(document.createTextNode('__'));
    } else if (match[11] !== undefined) {
      span.className = 'md-strike';
      span.appendChild(document.createTextNode('~~'));
      span.appendChild(buildFormattedTextNodes(match[12]));
      span.appendChild(document.createTextNode('~~'));
    } else if (match[13] !== undefined) {
      span.className = 'md-italic';
      span.appendChild(document.createTextNode('*'));
      span.appendChild(buildFormattedTextNodes(match[14]));
      span.appendChild(document.createTextNode('*'));
    } else if (match[15] !== undefined) {
      span.className = 'md-italic';
      span.appendChild(document.createTextNode('_'));
      span.appendChild(buildFormattedTextNodes(match[16]));
      span.appendChild(document.createTextNode('_'));
    } else if (match[17] !== undefined) {
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
 * sans masquer les délimiteurs.
 * @param {string} lineText
 * @returns {DocumentFragment}
 */
export function buildLineInlineNodes(lineText) {
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
export function isMarkdownTableLine(line) {
  return /^\s*\|.*\|/.test(line);
}

/**
 * Largeur maximale (en caractères ch) d'une colonne de tableau dans l'éditeur non-WYSIWYG.
 * Au-delà de cette limite, le contenu de la cellule passe automatiquement à la ligne.
 * @type {number}
 */
export const MAX_TABLE_COL_WIDTH_CH = 60;

/**
 * Construit les éléments <span class="md-table-line"> pour un bloc contigu de lignes de tableau
 * en calculant la largeur maximale (en ch, plafonnée à MAX_TABLE_COL_WIDTH_CH = 60) de chaque colonne
 * afin d'aligner visuellement toutes les barres verticales | et de renvoyer à la ligne les textes longs
 * sans modifier le texte Markdown sous-jacent.
 * @param {string[]} tableLines
 * @returns {HTMLSpanElement[]}
 */
export function buildTableBlockRowSpans(tableLines) {
  let maxPrefixWidth = 0;
  const maxColWidths = [];

  const splitRows = tableLines.map((line) => {
    const parts = line.split('|');
    const prefixLen = parts[0].replace(/\t/g, '  ').length;
    if (prefixLen > maxPrefixWidth) {
      maxPrefixWidth = prefixLen;
    }

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
      const targetWidth = Math.min(
        MAX_TABLE_COL_WIDTH_CH,
        Math.max(1, maxColWidths[colIdx] || 1)
      );
      cellSpan.style.width = `${targetWidth}ch`;
      cellSpan.style.minWidth = `${targetWidth}ch`;
      cellSpan.style.maxWidth = `${targetWidth}ch`;
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
 * Maintient un élément <br data-sentinel="true"> en fin d'éditeur contenteditable
 * afin qu'un seul appui sur Entrée (\n) en fin de texte crée immédiatement une nouvelle ligne visible.
 * @param {HTMLElement|null} editorEl - Conteneur DOM de l'éditeur
 * @returns {void}
 */
export function ensureTrailingSentinel(editorEl) {
  if (!editorEl) return;

  const existingSentinels = Array.from(
    editorEl.querySelectorAll('br[data-sentinel="true"]')
  );

  const hasRealContent = Array.from(editorEl.childNodes).some((node) => {
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

  if (editorEl.lastChild !== sentinel) {
    editorEl.appendChild(sentinel);
  }
}

/**
 * Peuple l'éditeur (#mdEditor) à partir d'un texte Markdown :
 * - Convertit les images Base64 / jetons en objets graphiques .image-cartouche
 * - Formate les blocs de code (``` ... ```) sans interpréter le Markdown interne
 * - Aligne visuellement les colonnes des tableaux Markdown via CSS sans altérer le fichier .md
 * - Formate les séparateurs horizontaux (---, ***, ___), les titres (# à #####) et les citations (> ...)
 * - Décale les listes (- *, 1.) et listes de tâches (- [ ], - [x]) de 5 caractères par niveau d'imbrication
 * @param {HTMLElement|null} editorEl - Conteneur DOM de l'éditeur
 * @param {string} markdownText - Contenu Markdown
 * @param {Record<string, string>} localImages - Dictionnaire d'images en mémoire
 * @param {function(): string} getNextImageIdFn - Générateur d'identifiant d'image unique
 * @param {boolean} [preserveCaret=false] - Si true, sauvegarde et restaure la position du curseur
 * @returns {void}
 */
export function setEditorContent(
  editorEl,
  markdownText,
  localImages,
  getNextImageIdFn,
  preserveCaret = false
) {
  if (!editorEl) return;

  const savedOffsets = preserveCaret ? getEditorSelectionOffsets(editorEl) : null;
  editorEl.innerHTML = '';

  if (!markdownText) {
    return;
  }

  const normalizedText = collapseBase64ToCartouches(
    markdownText.replace(/\r\n?/g, '\n'),
    localImages,
    getNextImageIdFn
  ).replace(/\[binaire base64 masqué\]\r?\n?/gi, '');

  const lines = normalizedText.split('\n');
  const fragment = document.createDocumentFragment();
  let inCodeBlock = false;
  let inMermaidBlock = false;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Délimiteur de bloc de code (```) ou de schéma Mermaid (```mermaid)
    if (line.trimStart().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        const fenceLang = line.trimStart().replace(/^`+/, '').trim();
        if (/^mermaid\b/i.test(fenceLang)) {
          inMermaidBlock = true;
        } else if (!fenceLang) {
          let lookahead = i + 1;
          while (
            lookahead < lines.length &&
            !lines[lookahead].trimStart().startsWith('```') &&
            lines[lookahead].trim() === ''
          ) {
            lookahead++;
          }
          inMermaidBlock =
            lookahead < lines.length && isMermaidHeaderLine(lines[lookahead]);
        } else {
          inMermaidBlock = false;
        }
      } else {
        const closingMermaid = inMermaidBlock;
        inCodeBlock = false;
        inMermaidBlock = false;
        if (line.length > 0) {
          const fenceSpan = document.createElement('span');
          fenceSpan.className = closingMermaid
            ? 'md-mermaid-fence'
            : 'md-codeblock-fence';
          fenceSpan.textContent = line;
          fragment.appendChild(fenceSpan);
        }
        if (i < lines.length - 1) {
          fragment.appendChild(document.createTextNode('\n'));
        }
        i++;
        continue;
      }

      if (line.length > 0) {
        const fenceSpan = document.createElement('span');
        fenceSpan.className = inMermaidBlock
          ? 'md-mermaid-fence'
          : 'md-codeblock-fence';
        fenceSpan.textContent = line;
        fragment.appendChild(fenceSpan);
      }
      if (i < lines.length - 1) {
        fragment.appendChild(document.createTextNode('\n'));
      }
      i++;
      continue;
    }

    // Contenu interne d'un bloc de code ou d'un schéma Mermaid (pas d'interprétation Markdown)
    if (inCodeBlock) {
      if (line.length > 0) {
        const codeLineSpan = document.createElement('span');
        codeLineSpan.className = inMermaidBlock
          ? 'md-mermaid-line'
          : 'md-codeblock-line';
        codeLineSpan.textContent = line;
        fragment.appendChild(codeLineSpan);
      }
      if (i < lines.length - 1) {
        fragment.appendChild(document.createTextNode('\n'));
      }
      i++;
      continue;
    }

    // Schéma Mermaid saisi directement sans délimiteurs ``` (ex: graph TB, flowchart LR, sequenceDiagram...)
    if (isMermaidHeaderLine(line)) {
      const endMermaidIdx = findUnfencedMermaidBlockEnd(lines, i);
      if (endMermaidIdx > i) {
        for (let m = i; m <= endMermaidIdx; m++) {
          const mLine = lines[m];
          if (mLine.length > 0) {
            const mSpan = document.createElement('span');
            mSpan.className = m === i ? 'md-mermaid-fence' : 'md-mermaid-line';
            mSpan.textContent = mLine;
            fragment.appendChild(mSpan);
          }
          if (m < lines.length - 1) {
            fragment.appendChild(document.createTextNode('\n'));
          }
        }
        i = endMermaidIdx + 1;
        continue;
      }
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

  editorEl.appendChild(fragment);
  ensureTrailingSentinel(editorEl);

  if (savedOffsets) {
    restoreEditorSelectionOffsets(editorEl, savedOffsets);
  }
}

/**
 * Insère un nœud DOM (texte ou objet graphique .image-cartouche) à la position courante du curseur dans #mdEditor.
 * @param {HTMLElement|null} editorEl - Conteneur DOM de l'éditeur
 * @param {Node} node
 * @returns {void}
 */
export function insertNodeAtEditorCaret(editorEl, node) {
  if (!editorEl) return;
  editorEl.focus();
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !editorEl.contains(sel.anchorNode)) {
    const sentinel = editorEl.querySelector('br[data-sentinel="true"]');
    if (sentinel) {
      editorEl.insertBefore(node, sentinel);
    } else {
      editorEl.appendChild(node);
    }
    ensureTrailingSentinel(editorEl);
    return;
  }

  const range = sel.getRangeAt(0);
  range.deleteContents();

  const sentinel = editorEl.querySelector('br[data-sentinel="true"]');
  if (
    sentinel &&
    ((range.startContainer === editorEl &&
      range.startOffset >= Array.from(editorEl.childNodes).indexOf(sentinel)) ||
      range.startContainer === sentinel)
  ) {
    editorEl.insertBefore(node, sentinel);
  } else {
    range.insertNode(node);
  }

  ensureTrailingSentinel(editorEl);

  const afterRange = document.createRange();
  afterRange.setStartAfter(node);
  afterRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(afterRange);
}

/**
 * Retire l'état visuel de sélection sur toutes les cartouches graphiques.
 * @param {HTMLElement|null} editorEl - Conteneur DOM de l'éditeur
 * @returns {void}
 */
export function clearCartoucheSelectionStyles(editorEl) {
  editorEl
    ?.querySelectorAll('.image-cartouche.is-selected')
    .forEach((el) => el.classList.remove('is-selected'));
}

/**
 * Synchronise la sélection native du navigateur avec l'état visuel (.is-selected) des cartouches.
 * @param {HTMLElement|null} editorEl - Conteneur DOM de l'éditeur
 * @returns {void}
 */
export function updateCartoucheSelectionHighlight(editorEl) {
  if (!editorEl) return;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
    clearCartoucheSelectionStyles(editorEl);
    return;
  }
  const range = sel.getRangeAt(0);
  editorEl.querySelectorAll('.image-cartouche').forEach((cartouche) => {
    cartouche.classList.toggle('is-selected', range.intersectsNode(cartouche));
  });
}

/**
 * Gère la suppression d'un objet graphique .image-cartouche avec Suppr (Delete) ou Backspace
 * lorsqu'il est sélectionné (au clic ou dans une sélection de texte) ou adjacent au curseur.
 * @param {HTMLElement|null} editorEl - Conteneur DOM de l'éditeur
 * @param {KeyboardEvent} e - Événement clavier
 * @param {function(): void} onSync - Callback de resynchronisation après suppression
 * @returns {boolean} true si une cartouche graphique a été supprimée
 */
export function handleCartoucheDeletion(editorEl, e, onSync) {
  if (!editorEl || (e.key !== 'Backspace' && e.key !== 'Delete')) return false;

  // 1. Cartouche(s) explicitement marquée(s) comme sélectionnée(s)
  const selectedCartouches = Array.from(
    editorEl.querySelectorAll('.image-cartouche.is-selected')
  );
  if (selectedCartouches.length > 0) {
    e.preventDefault();
    selectedCartouches.forEach((el) => el.remove());
    onSync();
    return true;
  }

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);

  // 2. Plage de texte sélectionnée englobant ou intersectant une cartouche graphique
  if (!range.collapsed) {
    const intersecting = Array.from(editorEl.querySelectorAll('.image-cartouche')).filter(
      (el) => range.intersectsNode(el)
    );
    if (intersecting.length > 0) {
      e.preventDefault();
      range.deleteContents();
      intersecting.forEach((el) => {
        if (el.parentNode) el.remove();
      });
      onSync();
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
        onSync();
        return true;
      }
    } else if (startContainer.nodeType === Node.ELEMENT_NODE && startOffset > 0) {
      const prev = startContainer.childNodes[startOffset - 1];
      if (prev?.nodeType === Node.ELEMENT_NODE && prev.classList.contains('image-cartouche')) {
        e.preventDefault();
        prev.remove();
        onSync();
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
        onSync();
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
        onSync();
        return true;
      }
    }
  }

  return false;
}
