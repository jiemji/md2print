/**
 * @module EditorEngine
 * @description Moteur de l'éditeur Markdown non-WYSIWYG (contenteditable="true").
 * Gère les objets graphiques .image-cartouche, .mermaid-cartouche et .html-cartouche, la préservation
 * exacte des offsets de sélection (1 caractère = 1 unité, 1 cartouche = 1 unité),
 * la sentinelle finale <br data-sentinel="true">, l'alignement des tableaux en grille CSS,
 * le retour à la ligne des colonnes de plus de 60 caractères, et le formatage syntaxique
 * en direct (titres, citations, callouts, listes, inline, badges et métriques).
 * @requires ./utils.js
 */
import {
  createImageCartouche,
  collapseBase64ToCartouches,
  isMermaidHeaderLine,
  findUnfencedMermaidBlockEnd,
  isExecutableHtmlFence,
  isHtmlBlockOpenLine,
  isHtmlBlockCloseLine,
  resolveBadgeClass,
  parseMetricTag,
  resolveMetricClass,
  toSlug,
} from './utils.js';

let currentDraggedCartouche = null;

/**
 * Retourne la cartouche graphique en cours de déplacement par glisser-déposer.
 * @returns {HTMLElement|null}
 */
export function getDraggedCartouche() {
  return currentDraggedCartouche;
}

/**
 * Définit ou réinitialise la cartouche graphique en cours de déplacement.
 * @param {HTMLElement|null} el
 * @returns {void}
 */
export function setDraggedCartouche(el) {
  currentDraggedCartouche = el;
}

/**
 * Calcule l'objet Range du curseur DOM à partir des coordonnées écran de la souris.
 * Supporte document.caretRangeFromPoint (Chrome/Edge/Safari) et document.caretPositionFromPoint (Firefox).
 * @param {number} clientX
 * @param {number} clientY
 * @returns {Range|null}
 */
export function getCaretRangeFromPoint(clientX, clientY) {
  if (typeof document.caretRangeFromPoint === 'function') {
    return document.caretRangeFromPoint(clientX, clientY);
  }
  if (typeof document.caretPositionFromPoint === 'function') {
    const pos = document.caretPositionFromPoint(clientX, clientY);
    if (pos && pos.offsetNode) {
      const range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.collapse(true);
      return range;
    }
  }
  return null;
}

/**
 * Attache les écouteurs de glisser-déposer sur une cartouche graphique (.image-cartouche, .mermaid-cartouche ou .html-cartouche).
 * @param {HTMLElement} cartoucheEl
 * @returns {void}
 */
export function attachCartoucheDragEvents(cartoucheEl) {
  cartoucheEl.draggable = true;

  cartoucheEl.addEventListener('dragstart', (e) => {
    // Si l'utilisateur manipule le texte dans le textarea d'un bloc déplié, ne pas déclencher le drag
    if (
      e.target.closest('.mermaid-code-textarea') ||
      e.target.closest('.html-code-textarea')
    ) {
      e.preventDefault();
      return;
    }

    currentDraggedCartouche = cartoucheEl;
    cartoucheEl.classList.add('is-dragging');

    const isImage = cartoucheEl.classList.contains('image-cartouche');
    const isHtml = cartoucheEl.classList.contains('html-cartouche');
    const type = isImage ? 'image' : isHtml ? 'html' : 'mermaid';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-md2print-cartouche', type);

    if (isImage) {
      const id = cartoucheEl.dataset.imageId || '';
      const alt = cartoucheEl.dataset.imageAlt || 'image';
      e.dataTransfer.setData('text/plain', createImageCartouche(id, alt));
    } else if (isHtml) {
      const textarea = cartoucheEl.querySelector('.html-code-textarea');
      const code = (textarea ? textarea.value : cartoucheEl.dataset.htmlCode) || '';
      e.dataTransfer.setData('text/plain', '```html-exec\n' + code.trim() + '\n```');
    } else {
      const textarea = cartoucheEl.querySelector('.mermaid-code-textarea');
      const code = (textarea ? textarea.value : cartoucheEl.dataset.mermaidCode) || '';
      e.dataTransfer.setData('text/plain', '```mermaid\n' + code.trim() + '\n```');
    }
  });

  cartoucheEl.addEventListener('dragend', () => {
    cartoucheEl.classList.remove('is-dragging');
    if (currentDraggedCartouche === cartoucheEl) {
      currentDraggedCartouche = null;
    }
    document
      .querySelectorAll(
        '.image-cartouche.is-dragging, .mermaid-cartouche.is-dragging, .html-cartouche.is-dragging'
      )
      .forEach((el) => el.classList.remove('is-dragging'));
  });
}

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
  span.title = alt
    ? `Image : ${alt} (Glisser-déposer pour déplacer)`
    : 'Image encapsulée en Base64 (Glisser-déposer pour déplacer)';
  span.textContent = '[image]';
  attachCartoucheDragEvents(span);
  return span;
}

/**
 * Crée l'élément DOM graphique représentant un schéma Mermaid (cartouche verte pliable/dépliable).
 * Par défaut, la cartouche est repliée et affiche une bordure verte, le libellé [mermaid] et une flèche basse ▼.
 * Un clic sur la flèche déplie le code source au sein d'un éditeur textarea intégré.
 * @param {string} code - Code source du schéma Mermaid
 * @param {object} [options={}] - Options d'initialisation
 * @param {boolean} [options.isExpanded=false] - État initial déplié ou replié
 * @param {function(): void} [options.onSync] - Callback de synchronisation lors des modifications du code
 * @returns {HTMLSpanElement}
 */
export function createMermaidCartoucheElement(code = '', options = {}) {
  const { isExpanded = false, onSync = null } = options;
  const span = document.createElement('span');
  span.className = 'mermaid-cartouche' + (isExpanded ? ' is-expanded' : ' is-collapsed');
  span.contentEditable = 'false';
  span.dataset.mermaidCode = code || '';

  // En-tête de la cartouche avec bouton flèche
  const header = document.createElement('span');
  header.className = 'mermaid-cartouche-header';
  header.title = 'Schéma Mermaid — Cliquer sur la flèche pour déplier / replier (Glisser-déposer pour déplacer)';

  const badge = document.createElement('span');
  badge.className = 'mermaid-cartouche-label';
  badge.textContent = '[mermaid]';

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'mermaid-cartouche-toggle';
  toggleBtn.setAttribute('aria-label', isExpanded ? 'Replier le schéma' : 'Déplier le schéma');
  toggleBtn.textContent = isExpanded ? '▲' : '▼';

  header.appendChild(badge);
  header.appendChild(toggleBtn);

  // Corps dépliable avec éditeur textarea
  const body = document.createElement('span');
  body.className = 'mermaid-cartouche-body';

  const textarea = document.createElement('textarea');
  textarea.className = 'mermaid-code-textarea';
  textarea.value = code || '';
  textarea.placeholder = 'graph TB\n    A --> B';
  textarea.spellcheck = false;

  // Empêcher le glisser-déposer de la cartouche lors de la manipulation du texte dans le textarea
  textarea.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    span.draggable = false;
  });
  textarea.addEventListener('mouseup', () => {
    span.draggable = true;
  });
  textarea.addEventListener('blur', () => {
    span.draggable = true;
  });

  const adjustHeight = () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.max(90, textarea.scrollHeight + 4) + 'px';
  };

  body.appendChild(textarea);
  span.appendChild(header);
  span.appendChild(body);

  attachCartoucheDragEvents(span);

  const toggleExpand = (e) => {
    e.stopPropagation();
    const expanded = span.classList.toggle('is-expanded');
    span.classList.toggle('is-collapsed', !expanded);
    toggleBtn.textContent = expanded ? '▲' : '▼';
    toggleBtn.setAttribute('aria-label', expanded ? 'Replier le schéma' : 'Déplier le schéma');
    if (expanded) {
      adjustHeight();
      textarea.focus();
    }
  };

  toggleBtn.addEventListener('click', toggleExpand);
  header.addEventListener('click', (e) => {
    if (e.target !== toggleBtn) {
      toggleExpand(e);
    }
  });

  textarea.addEventListener('input', (e) => {
    e.stopPropagation();
    span.dataset.mermaidCode = textarea.value;
    adjustHeight();
    span.dispatchEvent(new CustomEvent('cartouche-input', { bubbles: true }));
    onSync?.();
  });

  textarea.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      textarea.setRangeText('    ', start, end, 'end');
      span.dataset.mermaidCode = textarea.value;
      span.dispatchEvent(new CustomEvent('cartouche-input', { bubbles: true }));
      onSync?.();
    }
  });

  if (isExpanded) {
    setTimeout(adjustHeight, 0);
  }

  return span;
}

/**
 * Crée l'élément DOM graphique représentant un bloc HTML/CSS/JS exécutable (cartouche ambrée pliable/dépliable).
 * Par défaut, la cartouche est repliée et affiche le libellé [html] et une flèche basse ▼.
 * Un clic sur la flèche déplie le code source au sein d'un éditeur textarea intégré.
 * @param {string} code - Code source HTML / CSS / JS
 * @param {object} [options={}] - Options d'initialisation
 * @param {boolean} [options.isExpanded=false] - État initial déplié ou replié
 * @param {function(): void} [options.onSync] - Callback de synchronisation lors des modifications du code
 * @returns {HTMLSpanElement}
 */
export function createHtmlCartoucheElement(code = '', options = {}) {
  const { isExpanded = false, onSync = null } = options;
  const span = document.createElement('span');
  span.className = 'html-cartouche' + (isExpanded ? ' is-expanded' : ' is-collapsed');
  span.contentEditable = 'false';
  span.dataset.htmlCode = code || '';

  // En-tête de la cartouche avec bouton flèche
  const header = document.createElement('span');
  header.className = 'html-cartouche-header';
  header.title =
    'Bloc HTML / JS exécutable — Cliquer sur la flèche pour déplier / replier (Glisser-déposer pour déplacer)';

  const badge = document.createElement('span');
  badge.className = 'html-cartouche-label';
  badge.textContent = '[html]';

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'html-cartouche-toggle';
  toggleBtn.setAttribute('aria-label', isExpanded ? 'Replier le bloc HTML' : 'Déplier le bloc HTML');
  toggleBtn.textContent = isExpanded ? '▲' : '▼';

  header.appendChild(badge);
  header.appendChild(toggleBtn);

  // Corps dépliable avec éditeur textarea
  const body = document.createElement('span');
  body.className = 'html-cartouche-body';

  const textarea = document.createElement('textarea');
  textarea.className = 'html-code-textarea';
  textarea.value = code || '';
  textarea.placeholder =
    '<div class="mon-composant">\n  <!-- Contenu HTML / CSS / JS -->\n</div>';
  textarea.spellcheck = false;

  // Empêcher le glisser-déposer de la cartouche lors de la manipulation du texte dans le textarea
  textarea.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    span.draggable = false;
  });
  textarea.addEventListener('mouseup', () => {
    span.draggable = true;
  });
  textarea.addEventListener('blur', () => {
    span.draggable = true;
  });

  const adjustHeight = () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.max(90, textarea.scrollHeight + 4) + 'px';
  };

  body.appendChild(textarea);
  span.appendChild(header);
  span.appendChild(body);

  attachCartoucheDragEvents(span);

  const toggleExpand = (e) => {
    e.stopPropagation();
    const expanded = span.classList.toggle('is-expanded');
    span.classList.toggle('is-collapsed', !expanded);
    toggleBtn.textContent = expanded ? '▲' : '▼';
    toggleBtn.setAttribute(
      'aria-label',
      expanded ? 'Replier le bloc HTML' : 'Déplier le bloc HTML'
    );
    if (expanded) {
      adjustHeight();
      textarea.focus();
    }
  };

  toggleBtn.addEventListener('click', toggleExpand);
  header.addEventListener('click', (e) => {
    if (e.target !== toggleBtn) {
      toggleExpand(e);
    }
  });

  textarea.addEventListener('input', (e) => {
    e.stopPropagation();
    span.dataset.htmlCode = textarea.value;
    adjustHeight();
    span.dispatchEvent(new CustomEvent('cartouche-input', { bubbles: true }));
    onSync?.();
  });

  textarea.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      textarea.setRangeText('  ', start, end, 'end');
      span.dataset.htmlCode = textarea.value;
      span.dispatchEvent(new CustomEvent('cartouche-input', { bubbles: true }));
      onSync?.();
    }
  });

  if (isExpanded) {
    setTimeout(adjustHeight, 0);
  }

  return span;
}

/**
 * Sérialise le contenu DOM de l'éditeur (#mdEditor) en chaîne Markdown,
 * en convertissant chaque objet graphique .image-cartouche, .mermaid-cartouche et .html-cartouche en syntaxe Markdown.
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
        } else if (child.classList.contains('mermaid-cartouche')) {
          const textarea = child.querySelector('.mermaid-code-textarea');
          const code = (textarea ? textarea.value : child.dataset.mermaidCode) || '';
          if (result.length > 0 && !result.endsWith('\n')) {
            result += '\n';
          }
          result += '```mermaid\n' + code.trim() + '\n```';
          const next = child.nextSibling;
          const nextIsNewline =
            next &&
            next.nodeType === Node.TEXT_NODE &&
            next.nodeValue.startsWith('\n');
          if (!nextIsNewline) {
            result += '\n';
          }
          continue;
        } else if (child.classList.contains('html-cartouche')) {
          const textarea = child.querySelector('.html-code-textarea');
          const code = (textarea ? textarea.value : child.dataset.htmlCode) || '';
          if (result.length > 0 && !result.endsWith('\n')) {
            result += '\n';
          }
          result += '```html-exec\n' + code.trim() + '\n```';
          const next = child.nextSibling;
          const nextIsNewline =
            next &&
            next.nodeType === Node.TEXT_NODE &&
            next.nodeValue.startsWith('\n');
          if (!nextIsNewline) {
            result += '\n';
          }
          continue;
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
 * (1 par caractère texte ou saut de ligne, 1 par objet graphique cartouche, 0 pour la sentinelle).
 * @param {Node} node
 * @returns {number}
 */
export function getNodeUnitLength(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.nodeValue.length;
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    if (
      node.classList.contains('image-cartouche') ||
      node.classList.contains('mermaid-cartouche') ||
      node.classList.contains('html-cartouche')
    ) {
      return 1;
    }
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
      if (
        node.classList.contains('image-cartouche') ||
        node.classList.contains('mermaid-cartouche') ||
        node.classList.contains('html-cartouche')
      ) {
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
      if (
        node.classList.contains('image-cartouche') ||
        node.classList.contains('mermaid-cartouche') ||
        node.classList.contains('html-cartouche')
      ) {
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
 * - Badges inline ([badge:type:texte])
 * - Cartouches de données / métriques ([chiffre:valeur:libellé])
 * tout en conservant l'ensemble des délimiteurs visibles.
 * L'invariant de longueur (1 caractère = 1 unité de sélection) est intégralement préservé.
 * @param {string} text - Segment de texte brut
 * @returns {DocumentFragment}
 */
export function buildFormattedTextNodes(text) {
  const fragment = document.createDocumentFragment();
  if (!text) return fragment;

  const inlineFormatRegex =
    /(`[^`\n]+?`)|((?<!\!)\[(?!image\s*:)([^\][\n]+)\]\(([^)\n]+)\))|(\*\*\*(?=\S)((?:(?!\*\*\*).)+?)(?<=\S)\*\*\*(?!\*))|(\*\*(?=\S)((?:(?!\*\*).)+?)(?<=\S)\*\*(?!\*))|(__(?=\S)((?:(?!__).)+?)(?<=\S)__(?!_))|(~~(?=\S)((?:(?!~~).)+?)(?<=\S)~~(?!~))|((?<!\*)\*(?!\*)(?=\S)((?:[^*]|\*\*)+?)(?<=\S)(?<!\*)\*(?!\*))|((?<![_\w])_(?!_)(?=\S)((?:[^_]|__)+?)(?<=\S)(?<!_)_(?![_\w]))|(<u>((?:(?!<\/u>).)+?)<\/u>)|(\[badge:(?:([a-zA-Z0-9_-]+):)?([^\]\n]+)\])|(\[(chiffre|metric|stat|kpi):([^:\]\n]+)(?::([^:\]\n]+))?(?::([^\]\n]+))?\])/g;

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
    } else if (match[19] !== undefined) {
      const rawType = (match[20] || 'neutral').toLowerCase();
      const badgeClass = resolveBadgeClass(rawType);
      span.className = `md-badge ${badgeClass}`;
      span.appendChild(document.createTextNode(match[19]));
    } else if (match[22] !== undefined) {
      const parsed = parseMetricTag(match[24], match[25], match[26]);
      const metricClass = resolveMetricClass(parsed.variant);
      span.className = `md-metric ${metricClass}`;
      span.appendChild(document.createTextNode(match[22]));
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
 * - Formate les séparateurs horizontaux (---, ***, ___), les titres (# à #####) avec slugs uniques et index de ligne exacts, et les citations (> ...)
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

  // Mémorise les index des cartouches Mermaid et HTML qui étaient dépliées avant la réinitialisation du DOM
  const openMermaidIndexes = new Set();
  editorEl.querySelectorAll('.mermaid-cartouche').forEach((el, idx) => {
    if (el.classList.contains('is-expanded')) {
      openMermaidIndexes.add(idx);
    }
  });
  let mermaidCartoucheCount = 0;

  const openHtmlIndexes = new Set();
  editorEl.querySelectorAll('.html-cartouche').forEach((el, idx) => {
    if (el.classList.contains('is-expanded')) {
      openHtmlIndexes.add(idx);
    }
  });
  let htmlCartoucheCount = 0;

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
  const usedHeadingSlugs = new Set();
  let inCodeBlock = false;
  let activeCalloutType = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Délimiteur de bloc de code (```), de schéma Mermaid (```mermaid) ou de bloc HTML exécutable (```html-exec)
    if (line.trimStart().startsWith('```')) {
      activeCalloutType = null;
      const fenceLang = line.trimStart().replace(/^`+/, '').trim();
      let isMermaid = /^mermaid\b/i.test(fenceLang);
      const isHtmlExec = !isMermaid && isExecutableHtmlFence(fenceLang);
      if (!isMermaid && !isHtmlExec && !fenceLang) {
        let lookahead = i + 1;
        while (
          lookahead < lines.length &&
          !lines[lookahead].trimStart().startsWith('```') &&
          lines[lookahead].trim() === ''
        ) {
          lookahead++;
        }
        isMermaid =
          lookahead < lines.length && isMermaidHeaderLine(lines[lookahead]);
      }

      if (isMermaid || isHtmlExec) {
        let hasClosingFence = false;
        let lookahead = i + 1;
        while (lookahead < lines.length) {
          if (lines[lookahead].trimStart().startsWith('```')) {
            hasClosingFence = true;
            break;
          }
          lookahead++;
        }

        // Si le bloc n'est pas encore fermé (ex: en cours de frappe dans l'éditeur),
        // on le formate en bloc de code pour permettre la saisie ligne par ligne
        if (!hasClosingFence) {
          inCodeBlock = true;
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

        const innerLines = [];
        let j = i + 1;
        while (j < lines.length && !lines[j].trimStart().startsWith('```')) {
          innerLines.push(lines[j]);
          j++;
        }
        if (j < lines.length && lines[j].trimStart().startsWith('```')) {
          j++; // Sauter la ligne de fermeture ```
        }
        const blockCode = innerLines.join('\n');
        let cartoucheEl;
        if (isHtmlExec) {
          const isExp = openHtmlIndexes.has(htmlCartoucheCount);
          htmlCartoucheCount++;
          cartoucheEl = createHtmlCartoucheElement(blockCode, {
            isExpanded: isExp,
          });
        } else {
          const isExp = openMermaidIndexes.has(mermaidCartoucheCount);
          mermaidCartoucheCount++;
          cartoucheEl = createMermaidCartoucheElement(blockCode, {
            isExpanded: isExp,
          });
        }
        fragment.appendChild(cartoucheEl);
        if (j < lines.length) {
          fragment.appendChild(document.createTextNode('\n'));
        }
        i = j;
        continue;
      }

      if (!inCodeBlock) {
        inCodeBlock = true;
      } else {
        inCodeBlock = false;
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

    // Contenu interne d'un bloc de code ordinaire (pas d'interprétation Markdown)
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

    // Bloc HTML exécutable saisi avec la syntaxe [html] ... [/html] ou :::html ... :::
    if (isHtmlBlockOpenLine(line)) {
      let closeIdx = -1;
      for (let j = i + 1; j < lines.length; j++) {
        if (isHtmlBlockCloseLine(lines[j])) {
          closeIdx = j;
          break;
        }
      }
      if (closeIdx > i) {
        activeCalloutType = null;
        const htmlLines = lines.slice(i + 1, closeIdx);
        const htmlCode = htmlLines.join('\n');
        const isExp = openHtmlIndexes.has(htmlCartoucheCount);
        htmlCartoucheCount++;
        const cartoucheEl = createHtmlCartoucheElement(htmlCode, {
          isExpanded: isExp,
        });
        fragment.appendChild(cartoucheEl);
        if (closeIdx < lines.length - 1) {
          fragment.appendChild(document.createTextNode('\n'));
        }
        i = closeIdx + 1;
        continue;
      }
    }

    // Schéma Mermaid saisi directement sans délimiteurs ``` (ex: graph TB, flowchart LR, sequenceDiagram...)
    if (isMermaidHeaderLine(line)) {
      activeCalloutType = null;
      const endMermaidIdx = findUnfencedMermaidBlockEnd(lines, i);
      if (endMermaidIdx > i) {
        const mermaidLines = lines.slice(i, endMermaidIdx + 1);
        const mermaidCode = mermaidLines.join('\n');
        const isExp = openMermaidIndexes.has(mermaidCartoucheCount);
        mermaidCartoucheCount++;
        const cartoucheEl = createMermaidCartoucheElement(mermaidCode, {
          isExpanded: isExp,
        });
        fragment.appendChild(cartoucheEl);
        if (endMermaidIdx < lines.length - 1) {
          fragment.appendChild(document.createTextNode('\n'));
        }
        i = endMermaidIdx + 1;
        continue;
      }
    }

    // Regroupement et alignement automatique des colonnes pour les blocs de tableaux Markdown
    if (isMarkdownTableLine(line)) {
      activeCalloutType = null;
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
        activeCalloutType = null;
        const hrSpan = document.createElement('span');
        hrSpan.className = 'md-hr-line';
        hrSpan.textContent = line;
        fragment.appendChild(hrSpan);
      } else if (headingMatch) {
        activeCalloutType = null;
        const level = headingMatch[1].length;
        const headingSpan = document.createElement('span');
        headingSpan.className = `md-heading-line md-h${level}`;
        const headingText = line.replace(/^#{1,6}\s+/, '').trim();
        // Attribution d'un slug unique et du numéro de ligne source exact pour la synchronisation bidirectionnelle avec le sommaire HTML
        const baseSlug = toSlug(headingText) || `section-${level}`;
        let uniqueSlug = baseSlug;
        let counter = 1;
        while (usedHeadingSlugs.has(uniqueSlug)) {
          uniqueSlug = `${baseSlug}-${counter++}`;
        }
        usedHeadingSlugs.add(uniqueSlug);
        headingSpan.dataset.headingText = headingText;
        headingSpan.dataset.slug = uniqueSlug;
        headingSpan.dataset.lineIndex = String(i);
        headingSpan.appendChild(buildLineInlineNodes(line));
        fragment.appendChild(headingSpan);
      } else if (quoteMatch) {
        const quoteLevel = quoteMatch[2].length;
        const quoteSpan = document.createElement('span');
        const calloutHeaderMatch = line.match(/^([ \t]*>+[ \t]*)\[!([a-zA-Z0-9_-]+)\]/);
        if (calloutHeaderMatch) {
          activeCalloutType = calloutHeaderMatch[2].toLowerCase();
          quoteSpan.className = `md-quote-line md-callout-header md-callout-${activeCalloutType}`;
        } else if (activeCalloutType) {
          quoteSpan.className = `md-quote-line md-callout-line md-callout-${activeCalloutType}`;
        } else {
          quoteSpan.className = 'md-quote-line';
        }
        quoteSpan.style.paddingLeft = `${quoteLevel * 2}ch`;
        quoteSpan.appendChild(buildLineInlineNodes(line));
        fragment.appendChild(quoteSpan);
      } else if (listMatch) {
        activeCalloutType = null;
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
        activeCalloutType = null;
        fragment.appendChild(buildLineInlineNodes(line));
      }
    } else {
      activeCalloutType = null;
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
    if (sel) {
      const afterRange = document.createRange();
      afterRange.setStartAfter(node);
      afterRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(afterRange);
    }
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
    ?.querySelectorAll(
      '.image-cartouche.is-selected, .mermaid-cartouche.is-selected, .html-cartouche.is-selected'
    )
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
  editorEl
    .querySelectorAll('.image-cartouche, .mermaid-cartouche, .html-cartouche')
    .forEach((cartouche) => {
      cartouche.classList.toggle('is-selected', range.intersectsNode(cartouche));
    });
}

/**
 * Gère la suppression d'un objet graphique .image-cartouche, .mermaid-cartouche ou .html-cartouche avec Suppr (Delete) ou Backspace
 * lorsqu'il est sélectionné (au clic ou dans une sélection de texte) ou adjacent au curseur.
 * @param {HTMLElement|null} editorEl - Conteneur DOM de l'éditeur
 * @param {KeyboardEvent} e - Événement clavier
 * @param {function(): void} onSync - Callback de resynchronisation après suppression
 * @returns {boolean} true si une cartouche graphique a été supprimée
 */
export function handleCartoucheDeletion(editorEl, e, onSync) {
  if (!editorEl || (e.key !== 'Backspace' && e.key !== 'Delete')) return false;

  const isCartouche = (n) =>
    n?.nodeType === Node.ELEMENT_NODE &&
    (n.classList.contains('image-cartouche') ||
      n.classList.contains('mermaid-cartouche') ||
      n.classList.contains('html-cartouche'));

  // 1. Cartouche(s) explicitement marquée(s) comme sélectionnée(s)
  const selectedCartouches = Array.from(
    editorEl.querySelectorAll(
      '.image-cartouche.is-selected, .mermaid-cartouche.is-selected, .html-cartouche.is-selected'
    )
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
    const intersecting = Array.from(
      editorEl.querySelectorAll('.image-cartouche, .mermaid-cartouche, .html-cartouche')
    ).filter((el) => range.intersectsNode(el));
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
      if (isCartouche(prev)) {
        e.preventDefault();
        prev.remove();
        onSync();
        return true;
      }
    } else if (startContainer.nodeType === Node.ELEMENT_NODE && startOffset > 0) {
      const prev = startContainer.childNodes[startOffset - 1];
      if (isCartouche(prev)) {
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
      if (isCartouche(next)) {
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
      if (isCartouche(next)) {
        e.preventDefault();
        next.remove();
        onSync();
        return true;
      }
    }
  }

  return false;
}
