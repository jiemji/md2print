/**
 * @module MarkdownParser
 * @description Parseur Markdown vers AST structuré et analyseur récursif de styles inline (pour DOCX et PPTX).
 *
 * Produit un tableau de blocs typés :
 * - { type: 'header', level: number, text: string, runs: Array, raw: string }
 * - { type: 'paragraph', runs: Array, isCode: boolean, isQuote: boolean, callout: object, raw: string }
 * - { type: 'list_item', listType: 'bullet'|'ordered', level: number, text: string, runs: Array, raw: string }
 * - { type: 'table', rows: string[][], raw: string }
 * - { type: 'image', alt: string, src: string, raw: string }
 * - { type: 'mermaid', code: string, raw: string }
 * - { type: 'html_exec', code: string, raw: string }
 * - { type: 'timeline', steps: Array, raw: string }
 * - { type: 'empty_line', count: number, raw: string }
 * - { type: 'separator', raw: string }
 * @requires utils
 */

import {
  resolveCallout,
  resolveBadgeClass,
  parseMetricTag,
  resolveMetricClass,
  isExecutableHtmlFence,
  parseTimelineStep,
} from './utils.js';

const DEFAULT_FORMAT = Object.freeze({
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  code: false,
  color: null,
  background: null,
  linkUrl: null,
});

/**
 * Extrait récursivement les styles inline d'un texte Markdown et retourne un tableau de runs formatés.
 * Gère : `code`, [libellé](url), ***gras+italique***, **gras**, __souligné__, <u>souligné</u>,
 * ~~barré~~, *italique*, _italique_, badges inline ([badge:type:texte]),
 * métriques/chiffres ([chiffre:valeur:libellé:variante]) ainsi que leurs imbrications.
 * @param {string} text - Segment de texte Markdown à analyser
 * @param {object} [inheritedFormat=DEFAULT_FORMAT] - Format parent hérité lors de l'analyse récursive
 * @returns {Array<{text: string, format: object}>}
 */
export const extractInlineStyles = (text, inheritedFormat = DEFAULT_FORMAT) => {
  const baseFormat = { ...DEFAULT_FORMAT, ...inheritedFormat };

  if (!text || text.trim() === '') {
    return [{ text: text || '', format: baseFormat }];
  }

  const runs = [];
  const inlineFormatRegex =
    /(`[^`\n]+?`)|((?<!\!)\[(?!image\s*:)([^\][\n]+)\]\(([^)\n]+)\))|(\*\*\*(?=\S)((?:(?!\*\*\*).)+?)(?<=\S)\*\*\*(?!\*))|(\*\*(?=\S)((?:(?!\*\*).)+?)(?<=\S)\*\*(?!\*))|(__(?=\S)((?:(?!__).)+?)(?<=\S)__(?!_))|(~~(?=\S)((?:(?!~~).)+?)(?<=\S)~~(?!~))|((?<!\*)\*(?!\*)(?=\S)((?:[^*]|\*\*)+?)(?<=\S)(?<!\*)\*(?!\*))|((?<![_\w])_(?!_)(?=\S)((?:[^_]|__)+?)(?<=\S)(?<!_)_(?![_\w]))|(<u>((?:(?!<\/u>).)+?)<\/u>)|(\[badge:(?:([a-zA-Z0-9_-]+):)?([^\]\n]+)\])|(\[(chiffre|metric|stat|kpi):([^:\]\n]+)(?::([^:\]\n]+))?(?::([^\]\n]+))?\])/g;

  let lastIndex = 0;
  let match;

  while ((match = inlineFormatRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const before = text.substring(lastIndex, match.index);
      if (before) {
        runs.push({ text: before, format: { ...baseFormat } });
      }
    }

    if (match[1] !== undefined) {
      // `code inline` (pas d'interprétation récursive à l'intérieur)
      runs.push({
        text: match[1].slice(1, -1),
        format: { ...baseFormat, code: true },
      });
    } else if (match[2] !== undefined) {
      // [libellé](url)
      runs.push(
        ...extractInlineStyles(match[3], {
          ...baseFormat,
          underline: true,
          linkUrl: match[4],
        })
      );
    } else if (match[5] !== undefined) {
      // ***gras et italique***
      runs.push(
        ...extractInlineStyles(match[6], {
          ...baseFormat,
          bold: true,
          italic: true,
        })
      );
    } else if (match[7] !== undefined) {
      // **gras**
      runs.push(
        ...extractInlineStyles(match[8], {
          ...baseFormat,
          bold: true,
        })
      );
    } else if (match[9] !== undefined) {
      // __souligné__
      runs.push(
        ...extractInlineStyles(match[10], {
          ...baseFormat,
          underline: true,
        })
      );
    } else if (match[11] !== undefined) {
      // ~~barré~~
      runs.push(
        ...extractInlineStyles(match[12], {
          ...baseFormat,
          strike: true,
        })
      );
    } else if (match[13] !== undefined) {
      // *italique*
      runs.push(
        ...extractInlineStyles(match[14], {
          ...baseFormat,
          italic: true,
        })
      );
    } else if (match[15] !== undefined) {
      // _italique_
      runs.push(
        ...extractInlineStyles(match[16], {
          ...baseFormat,
          italic: true,
        })
      );
    } else if (match[17] !== undefined) {
      // <u>souligné</u>
      runs.push(
        ...extractInlineStyles(match[18], {
          ...baseFormat,
          underline: true,
        })
      );
    } else if (match[19] !== undefined) {
      // [badge:type:texte] ou [badge:texte]
      const rawType = (match[20] || 'neutral').toLowerCase();
      const badgeText = match[21].trim();
      runs.push({
        text: `[ ${badgeText} ]`,
        format: {
          ...baseFormat,
          bold: true,
          badge: true,
          badgeType: rawType,
        },
      });
    } else if (match[22] !== undefined) {
      // [chiffre:valeur:libellé:variante]
      const parsed = parseMetricTag(match[24], match[25], match[26]);
      runs.push({
        text: parsed.val,
        format: {
          ...baseFormat,
          bold: true,
          metric: true,
          metricVal: parsed.val,
          metricLabel: parsed.label,
          metricVariant: parsed.variant,
        },
      });
      if (parsed.label) {
        runs.push({
          text: `\n${parsed.label}`,
          format: {
            ...baseFormat,
            italic: true,
            color: '64748B',
          },
        });
      }
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    runs.push({ text: text.substring(lastIndex), format: { ...baseFormat } });
  }

  return runs.length > 0 ? runs : [{ text, format: { ...baseFormat } }];
};

/**
 * Vérifie si une ligne est une ligne de tableau Markdown.
 * @param {string} line
 * @returns {boolean}
 */
const isTableLine = (line) => line.includes('|') && line.trim().startsWith('|');

/**
 * Vérifie si une ligne est un séparateur de tableau Markdown (|---|---|).
 * @param {string} line
 * @returns {boolean}
 */
const isTableSeparator = (line) => {
  if (!line) return false;
  return /^\|[\s\-:|]+\|$/.test(line.trim());
};

/**
 * Parse une ligne de tableau en tableau de cellules.
 * @param {string} line
 * @returns {string[]}
 */
const parseTableRow = (line) =>
  line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());

/**
 * Parse un tableau Markdown complet à partir de la ligne d'en-tête.
 * @param {string[]} lines
 * @param {number} startIndex
 * @returns {{ block: { type: 'table', rows: string[][] }, nextIndex: number }}
 */
const parseTable = (lines, startIndex) => {
  const rows = [];
  let i = startIndex;

  rows.push(parseTableRow(lines[i]));
  i += 2; // Saute l'en-tête et la ligne de séparation

  while (i < lines.length && isTableLine(lines[i].trimEnd())) {
    rows.push(parseTableRow(lines[i]));
    i++;
  }

  return {
    block: { type: 'table', rows },
    nextIndex: i,
  };
};

/**
 * Parse un texte Markdown complet en un AST structuré avec conservation des métadonnées de lignes.
 * Détecte les en-têtes, paragraphes, listes à puces/ordonnées, tableaux, images,
 * diagrammes Mermaid, blocs HTML exécutables (```html-exec), séparateurs horizontaux et lignes vides.
 *
 * @param {string} mdText - Texte Markdown complet
 * @returns {Array<object>} Tableau de nœuds AST typés
 */
export const parseToAST = (mdText) => {
  if (!mdText) return [];

  // Isole sur leur propre ligne les images Markdown ![alt](src) éventuellement collées à du texte
  // (hors blocs de code ```) afin qu'elles soient toujours reconnues comme blocs image par DOCX et PPTX.
  const rawLines = mdText.split('\n');
  const lines = [];
  let inCodeFence = false;
  for (const rawLine of rawLines) {
    if (rawLine.trimStart().startsWith('```')) {
      inCodeFence = !inCodeFence;
      lines.push(rawLine);
      continue;
    }
    if (!inCodeFence && /!\[[^\]]*\]\([^)]+\)/.test(rawLine) && !rawLine.trim().startsWith('|')) {
      const splitImg = rawLine
        .replace(/([^\n])(!\[[^\]]*\]\([^)]+\))/g, '$1\n$2')
        .replace(/(!\[[^\]]*\]\([^)]+\))([^\n])/g, '$1\n$2')
        .split('\n');
      lines.push(...splitImg);
    } else {
      lines.push(rawLine);
    }
  }

  const ast = [];
  let i = 0;

  // Mémorise pour chaque bloc son Markdown source (propriété raw), afin que l'aperçu HTML
  // en mode Slide puisse afficher exactement les mêmes blocs que chaque diapositive PowerPoint.
  let pendingStart = 0;
  let pendingSize = 0;
  const annotatePendingRaw = () => {
    while (pendingSize < ast.length) {
      const block = ast[pendingSize];
      if (block.raw === undefined) {
        block.raw = lines.slice(pendingStart, i).join('\n');
      }
      if (block.startLine === undefined) {
        block.startLine = pendingStart;
      }
      if (block.endLine === undefined) {
        block.endLine = Math.max(pendingStart, i - 1);
      }
      pendingSize++;
    }
  };

  while (i < lines.length) {
    annotatePendingRaw();
    pendingStart = i;
    pendingSize = ast.length;

    const line = lines[i];
    const trimmed = line.trimEnd();
    const trimmedBoth = line.trim();

    if (trimmedBoth === '') {
      const emptyStart = i;
      while (i < lines.length && lines[i].trim() === '') {
        i++;
      }
      const emptyCount = i - emptyStart;
      // Ignorer les lignes vides situées tout au début ou tout à la fin du document
      if (emptyStart === 0 || i >= lines.length) {
        continue;
      }
      const prevLine = lines[emptyStart - 1].trim();
      const nextLine = lines[i].trim();
      const isClosingTag = /^(?:\[\s*\/\s*(?:col(?:onne)?|cols?onnes?|frise|timeline)\s*\]|:::)$/i.test(nextLine);
      const isBetweenColumns =
        /^(?:\[\s*\/\s*(?:col(?:onne)?|cols?onnes?)\s*\]|:::)$/i.test(prevLine) &&
        /^(?:\[\s*(?:col(?:onne)?|cols?onnes?)\s*(?::[^\]]*)?\s*\]|:::\s*col)/i.test(nextLine);
      if (isClosingTag || isBetweenColumns) {
        continue;
      }
      ast.push({
        type: 'empty_line',
        count: emptyCount,
        raw: '\n'.repeat(emptyCount),
        startLine: emptyStart,
        endLine: i - 1,
      });
      continue;
    }

    // --- Image Markdown autonome ![alt](src) ---
    const imgMatch = trimmedBoth.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      ast.push({
        type: 'image',
        alt: imgMatch[1].trim() || 'Image',
        src: imgMatch[2].trim(),
      });
      i++;
      continue;
    }

    // --- Tableau Markdown ---
    if (isTableLine(trimmed) && i + 1 < lines.length && isTableSeparator(lines[i + 1].trim())) {
      const tableResult = parseTable(lines, i);
      ast.push(tableResult.block);
      i = tableResult.nextIndex;
      continue;
    }

    // --- Header (# à ######) ---
    const headerMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const text = headerMatch[2].trim();
      ast.push({
        type: 'header',
        level,
        text,
        runs: extractInlineStyles(text),
      });
      i++;
      continue;
    }

    // --- Frise chronologique ([frise]...[/frise], [timeline]...[/timeline], :::frise...:::) ---
    const isBracketTimelineOpen = /^\[\s*(?:frise|timeline)\s*\]$/i.test(trimmedBoth);
    const isColonTimelineOpen = /^:::\s*(?:frise|timeline)$/i.test(trimmedBoth);
    if (isBracketTimelineOpen || isColonTimelineOpen) {
      const startLine = i;
      const rawTimelineLines = [lines[i]];
      const steps = [];
      i++;
      while (i < lines.length) {
        const curTrimmed = lines[i].trim();
        const isClosing = isBracketTimelineOpen
          ? /^\[\s*\/\s*(?:frise|timeline)\s*\]$/i.test(curTrimmed)
          : /^:::(?:\s*\/\s*(?:frise|timeline))?$/i.test(curTrimmed);
        rawTimelineLines.push(lines[i]);
        if (isClosing) {
          i++;
          break;
        }
        const step = parseTimelineStep(lines[i]);
        if (step && (step.badge || step.title)) {
          steps.push(step);
        }
        i++;
      }
      ast.push({
        type: 'timeline',
        steps,
        raw: rawTimelineLines.join('\n'),
        startLine,
        endLine: Math.max(startLine, i - 1),
      });
      continue;
    }

    // --- Liste non-ordonnée (et checklist) ---
    const ulMatch = trimmed.match(/^(\s*)([-*+])\s+(.*)$/);
    if (ulMatch) {
      const indent = ulMatch[1].replace(/\t/g, '  ').length;
      const level = Math.ceil(indent / 2);
      const rawItemText = ulMatch[3].replace(/^\[([ xX])\]\s+/, (_, chk) => (chk.toLowerCase() === 'x' ? '[x] ' : '[ ] '));
      ast.push({
        type: 'list_item',
        listType: 'unordered',
        level,
        text: rawItemText,
        runs: extractInlineStyles(rawItemText),
      });
      i++;
      continue;
    }

    // --- Liste ordonnée ---
    const olMatch = trimmed.match(/^(\s*)(\d+)[.)]\s+(.*)$/);
    if (olMatch) {
      const indent = olMatch[1].replace(/\t/g, '  ').length;
      const level = Math.ceil(indent / 2);
      const text = olMatch[3];
      ast.push({
        type: 'list_item',
        listType: 'ordered',
        level,
        text,
        runs: extractInlineStyles(text),
      });
      i++;
      continue;
    }

    // --- Bloc de code (```) ou Schéma Mermaid (```mermaid) ---
    if (trimmed.trimStart().startsWith('```')) {
      const fenceHeader = trimmed.trimStart().replace(/^`+/, '').trim().toLowerCase();
      const isMermaid = fenceHeader === 'mermaid' || fenceHeader.startsWith('mermaid ');
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // Ferme ```
      const rawCode = codeLines.join('\n');
      if (isMermaid) {
        ast.push({
          type: 'mermaid',
          code: rawCode,
        });
      } else if (isExecutableHtmlFence(fenceHeader)) {
        ast.push({
          type: 'html_exec',
          code: rawCode,
        });
      } else {
        ast.push({
          type: 'paragraph',
          isCode: true,
          runs: [{ text: rawCode, format: { ...DEFAULT_FORMAT, code: true } }],
        });
      }
      continue;
    }

    // --- Séparateur horizontal ---
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmedBoth)) {
      ast.push({ type: 'separator' });
      i++;
      continue;
    }

    // --- Citation (> ...) ou Alerte / Callout (> [!NOTE] ...) ---
    if (trimmedBoth.startsWith('>')) {
      const quoteLines = [];
      const rawQuoteLines = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        rawQuoteLines.push(lines[i]);
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      const rawBlock = rawQuoteLines.join('\n');
      const firstLine = quoteLines[0] || '';
      const calloutMatch = firstLine.match(
        /^\[!([a-zA-Z0-9_-]+)\](?:[^\S\r\n]*([^\r\n]*))?$/
      );
      if (calloutMatch) {
        const rawType = calloutMatch[1];
        const rawTitle = calloutMatch[2];
        const callout = resolveCallout(rawType, rawTitle);
        const contentLines = quoteLines.slice(1);
        const quoteText = contentLines.join('\n');
        const runs = [
          { text: `${callout.title}\n`, format: { bold: true } },
          ...(quoteText.trim() ? extractInlineStyles(quoteText) : []),
        ];
        ast.push({
          type: 'paragraph',
          isQuote: true,
          callout,
          runs,
          raw: rawBlock,
        });
      } else {
        const quoteText = quoteLines.join('\n');
        ast.push({
          type: 'paragraph',
          isQuote: true,
          runs: extractInlineStyles(quoteText),
          raw: rawBlock,
        });
      }
      continue;
    }

    // --- Paragraphe standard ---
    const paraLines = [];
    while (i < lines.length) {
      const pLine = lines[i];
      const pTrimmed = pLine.trimEnd();
      const pTrimmedBoth = pLine.trim();

      if (pTrimmedBoth === '') break;
      if (/^!\[([^\]]*)\]\(([^)]+)\)$/.test(pTrimmedBoth)) break;
      if (/^#{1,6}\s+/.test(pTrimmed)) break;
      if (/^\s*[-*+]\s+/.test(pLine)) break;
      if (/^\s*\d+\.\s+/.test(pLine)) break;
      if (isTableLine(pTrimmed) && i + 1 < lines.length && isTableSeparator(lines[i + 1]?.trim())) break;
      if (pTrimmed.startsWith('```')) break;
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(pTrimmedBoth)) break;
      if (pTrimmedBoth.startsWith('>')) break;
      if (/^(?:\[\s*\/?\s*(?:col(?:onne)?|cols?onnes?|frise|timeline)(?:\s*:[^\]]*)?\s*\]|:::(?:\s*(?:col(?:onne)?|cols?onnes?|frise|timeline)(?:\s*:[^\r\n]*)?)?)$/i.test(pTrimmedBoth)) {
        if (paraLines.length === 0) {
          paraLines.push(pTrimmed);
          i++;
        }
        break;
      }

      paraLines.push(pTrimmed);
      i++;
    }

    if (paraLines.length > 0) {
      const fullText = paraLines.join('\n');
      ast.push({
        type: 'paragraph',
        runs: extractInlineStyles(fullText),
      });
    } else {
      // Garde-fou : ligne non reconnue par les règles précédentes (ex: "-" isolé) traitée comme texte
      ast.push({
        type: 'paragraph',
        runs: extractInlineStyles(lines[i].trim()),
      });
      i++;
    }
  }

  annotatePendingRaw();
  return ast;
};

export const MarkdownParser = {
  parseToAST,
  extractInlineStyles,
};
