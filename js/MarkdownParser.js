/**
 * MarkdownParser.js — Parseur Markdown vers AST structuré (pour DOCX et PPTX)
 *
 * Produit un tableau de blocs :
 *   { type: 'header', level, text, runs }
 *   { type: 'paragraph', runs, isCode, isQuote }
 *   { type: 'list_item', listType, level, text, runs }
 *   { type: 'table', rows: string[][] }
 *   { type: 'image', alt: string, src: string }
 *   { type: 'separator' }
 */

const DEFAULT_FORMAT = Object.freeze({
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  code: false,
  color: null,
  background: null,
});

/**
 * Extrait les styles inline d'un texte Markdown et retourne un tableau de runs formatés.
 * Gère : **bold**, *italic*, __underline__, ~~strike~~, `code`
 * @param {string} text
 * @returns {Array<{text: string, format: object}>}
 */
export const extractInlineStyles = (text) => {
  if (!text || text.trim() === '') {
    return [{ text: text || '', format: { ...DEFAULT_FORMAT } }];
  }

  const runs = [];
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(__(.+?)__)|(~~(.+?)~~)|(`(.+?)`)/g;

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const before = text.substring(lastIndex, match.index);
      if (before) {
        runs.push({ text: before, format: { ...DEFAULT_FORMAT } });
      }
    }

    if (match[2] !== undefined) {
      runs.push({ text: match[2], format: { ...DEFAULT_FORMAT, bold: true } });
    } else if (match[4] !== undefined) {
      runs.push({ text: match[4], format: { ...DEFAULT_FORMAT, italic: true } });
    } else if (match[6] !== undefined) {
      runs.push({ text: match[6], format: { ...DEFAULT_FORMAT, underline: true } });
    } else if (match[8] !== undefined) {
      runs.push({ text: match[8], format: { ...DEFAULT_FORMAT, strike: true } });
    } else if (match[10] !== undefined) {
      runs.push({ text: match[10], format: { ...DEFAULT_FORMAT, code: true } });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    runs.push({ text: text.substring(lastIndex), format: { ...DEFAULT_FORMAT } });
  }

  return runs.length > 0 ? runs : [{ text, format: { ...DEFAULT_FORMAT } }];
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
 * Parse un texte Markdown complet en un AST structuré.
 * @param {string} mdText
 * @returns {Array<object>}
 */
export const parseToAST = (mdText) => {
  if (!mdText) return [];

  const lines = mdText.split('\n');
  const ast = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trimEnd();
    const trimmedBoth = line.trim();

    if (trimmedBoth === '') {
      i++;
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

    // --- Liste non-ordonnée (et checklist) ---
    const ulMatch = trimmed.match(/^(\s*)([-*+])\s+(.*)$/);
    if (ulMatch) {
      const indent = ulMatch[1].length;
      const level = Math.floor(indent / 2);
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
    const olMatch = trimmed.match(/^(\s*)(\d+)\.\s+(.*)$/);
    if (olMatch) {
      const indent = olMatch[1].length;
      const level = Math.floor(indent / 2);
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

    // --- Bloc de code (```) ---
    if (trimmed.startsWith('```')) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trimEnd().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // Ferme ```
      ast.push({
        type: 'paragraph',
        isCode: true,
        runs: [{ text: codeLines.join('\n'), format: { ...DEFAULT_FORMAT, code: true } }],
      });
      continue;
    }

    // --- Séparateur horizontal ---
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmedBoth)) {
      ast.push({ type: 'separator' });
      i++;
      continue;
    }

    // --- Citation (> ...) ---
    if (trimmedBoth.startsWith('>')) {
      const quoteLines = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      const quoteText = quoteLines.join('\n');
      ast.push({
        type: 'paragraph',
        isQuote: true,
        runs: extractInlineStyles(quoteText),
      });
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

      paraLines.push(pTrimmed);
      i++;
    }

    if (paraLines.length > 0) {
      const fullText = paraLines.join('\n');
      ast.push({
        type: 'paragraph',
        runs: extractInlineStyles(fullText),
      });
    }
  }

  return ast;
};

export const MarkdownParser = {
  parseToAST,
  extractInlineStyles,
};
