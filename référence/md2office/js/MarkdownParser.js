/**
 * MarkdownParser — Parseur Markdown → AST structuré
 *
 * Produit un tableau de blocs :
 *   { type: 'header', level, text, runs }
 *   { type: 'paragraph', runs }
 *   { type: 'list_item', listType, level, runs }
 *   { type: 'table', rows: string[][] }
 *
 * Chaque "run" : { text, format: { bold, italic, underline, strike, code, color, background } }
 */

const DEFAULT_FORMAT = Object.freeze({
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  code: false,
  color: null,
  background: null
});

/**
 * Extrait les styles inline d'un texte Markdown et retourne un tableau de runs formatés.
 * Gère : **bold**, *italic*, __underline__, ~~strike~~, `code`
 * @param {string} text
 * @returns {Array<{text: string, format: object}>}
 */
export function extractInlineStyles(text) {
  if (!text || text.trim() === '') {
    return [{ text: text || '', format: { ...DEFAULT_FORMAT } }];
  }

  const runs = [];
  // Regex combinée pour capturer les différentes marques inline
  // Ordre : bold (**), italic (*), underline (__), strikethrough (~~), code (`)
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(__(.+?)__)|(\~\~(.+?)\~\~)|(`(.+?)`)/g;

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Texte avant le match
    if (match.index > lastIndex) {
      const before = text.substring(lastIndex, match.index);
      if (before) {
        runs.push({ text: before, format: { ...DEFAULT_FORMAT } });
      }
    }

    if (match[2] !== undefined) {
      // **bold**
      runs.push({ text: match[2], format: { ...DEFAULT_FORMAT, bold: true } });
    } else if (match[4] !== undefined) {
      // *italic*
      runs.push({ text: match[4], format: { ...DEFAULT_FORMAT, italic: true } });
    } else if (match[6] !== undefined) {
      // __underline__
      runs.push({ text: match[6], format: { ...DEFAULT_FORMAT, underline: true } });
    } else if (match[8] !== undefined) {
      // ~~strike~~
      runs.push({ text: match[8], format: { ...DEFAULT_FORMAT, strike: true } });
    } else if (match[10] !== undefined) {
      // `code`
      runs.push({ text: match[10], format: { ...DEFAULT_FORMAT, code: true } });
    }

    lastIndex = match.index + match[0].length;
  }

  // Texte restant après le dernier match
  if (lastIndex < text.length) {
    runs.push({ text: text.substring(lastIndex), format: { ...DEFAULT_FORMAT } });
  }

  return runs.length > 0 ? runs : [{ text, format: { ...DEFAULT_FORMAT } }];
}

/**
 * Vérifie si une ligne est une ligne d'en-tête Markdown
 */
function isHeader(line) {
  return /^#{1,6}\s+/.test(line.trim());
}

/**
 * Vérifie si une ligne est une puce non-ordonnée
 */
function isUnorderedList(line) {
  return /^(\s*)([-*+•])(?:\s+|$)/.test(line);
}

/**
 * Vérifie si une ligne est une puce ordonnée
 */
function isOrderedList(line) {
  return /^(\s*)\d+\.(?:\s+|$)/.test(line);
}

/**
 * Vérifie si une ligne démarre ou termine un bloc de code
 */
function isCodeBlockStart(line) {
  return line.trim().startsWith('```');
}

/**
 * Vérifie si une ligne est un séparateur horizontal
 */
function isHr(line) {
  return /^(-{3,}|\*{3,}|_{3,})$/.test(line.trim());
}

/**
 * Parse un texte Markdown complet en un AST structuré.
 * @param {string} mdText
 * @returns {Array<object>} AST blocks
 */
export function parseToAST(mdText) {
  if (!mdText) return [];

  const lines = mdText.split('\n');
  const ast = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trimEnd();

    // --- Ligne vide → ignorer ---
    if (trimmed.trim() === '') {
      i++;
      continue;
    }

    // --- Tableau Markdown ---
    if (isTableLine(trimmed) && i + 1 < lines.length && isTableSeparator(lines[i + 1]?.trim())) {
      const tableResult = parseTable(lines, i);
      ast.push(tableResult.block);
      i = tableResult.nextIndex;
      continue;
    }

    // --- Header ---
    const headerMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const text = headerMatch[2].trim();
      ast.push({
        type: 'header',
        level,
        text,
        runs: extractInlineStyles(text)
      });
      i++;
      continue;
    }

    // --- Liste non-ordonnée ---
    const ulMatch = line.match(/^(\s*)([-*+•])(?:\s+(.*)|\s*$)/);
    if (ulMatch) {
      const indent = ulMatch[1].length;
      const level = Math.floor(indent / 2);
      let text = (ulMatch[3] || '').trim();
      i++;

      // Si la puce est orpheline de texte (tiret/puce avec saut de ligne avant le texte)
      if (text === '') {
        while (i < lines.length && lines[i].trim() === '') {
          i++;
        }
        if (
          i < lines.length &&
          !isHeader(lines[i].trim()) &&
          !isUnorderedList(lines[i]) &&
          !isOrderedList(lines[i]) &&
          !isTableLine(lines[i].trim()) &&
          !isCodeBlockStart(lines[i].trim()) &&
          !isHr(lines[i].trim())
        ) {
          const itemLines = [];
          while (
            i < lines.length &&
            lines[i].trim() !== '' &&
            !isHeader(lines[i].trim()) &&
            !isUnorderedList(lines[i]) &&
            !isOrderedList(lines[i]) &&
            !isTableLine(lines[i].trim()) &&
            !isCodeBlockStart(lines[i].trim()) &&
            !isHr(lines[i].trim())
          ) {
            itemLines.push(lines[i].trim());
            i++;
          }
          text = itemLines.join(' ');
        }
      }

      if (text !== '') {
        ast.push({
          type: 'list_item',
          listType: 'unordered',
          level,
          text,
          runs: extractInlineStyles(text)
        });
      }
      continue;
    }

    // --- Liste ordonnée ---
    const olMatch = line.match(/^(\s*)(\d+)\.(?:\s+(.*)|\s*$)/);
    if (olMatch) {
      const indent = olMatch[1].length;
      const level = Math.floor(indent / 2);
      let text = (olMatch[3] || '').trim();
      i++;

      // Si le numéro est orphelin de texte
      if (text === '') {
        while (i < lines.length && lines[i].trim() === '') {
          i++;
        }
        if (
          i < lines.length &&
          !isHeader(lines[i].trim()) &&
          !isUnorderedList(lines[i]) &&
          !isOrderedList(lines[i]) &&
          !isTableLine(lines[i].trim()) &&
          !isCodeBlockStart(lines[i].trim()) &&
          !isHr(lines[i].trim())
        ) {
          const itemLines = [];
          while (
            i < lines.length &&
            lines[i].trim() !== '' &&
            !isHeader(lines[i].trim()) &&
            !isUnorderedList(lines[i]) &&
            !isOrderedList(lines[i]) &&
            !isTableLine(lines[i].trim()) &&
            !isCodeBlockStart(lines[i].trim()) &&
            !isHr(lines[i].trim())
          ) {
            itemLines.push(lines[i].trim());
            i++;
          }
          text = itemLines.join(' ');
        }
      }

      if (text !== '') {
        ast.push({
          type: 'list_item',
          listType: 'ordered',
          level,
          text,
          runs: extractInlineStyles(text)
        });
      }
      continue;
    }

    // --- Bloc de code (```) ---
    if (isCodeBlockStart(trimmed)) {
      const codeLines = [];
      const lang = trimmed.slice(3).trim();
      i++;
      while (i < lines.length && !lines[i].trimEnd().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // Skip closing ```
      ast.push({
        type: 'paragraph',
        runs: [{ text: codeLines.join('\n'), format: { ...DEFAULT_FORMAT, code: true } }]
      });
      continue;
    }

    // --- Séparateur horizontal ---
    if (isHr(trimmed)) {
      ast.push({ type: 'separator' });
      i++;
      continue;
    }

    // --- Paragraphe (texte normal) ---
    // Accumuler les lignes consécutives non-vides qui ne sont pas des headers/listes/tables
    const paraLines = [];
    while (i < lines.length) {
      const pLine = lines[i];
      const pTrimmed = pLine.trimEnd();

      if (pTrimmed.trim() === '') break;
      if (isHeader(pTrimmed)) break;
      if (isUnorderedList(pLine)) break;
      if (isOrderedList(pLine)) break;
      if (isTableLine(pTrimmed) && i + 1 < lines.length && isTableSeparator(lines[i + 1]?.trim())) break;
      if (isCodeBlockStart(pTrimmed)) break;
      if (isHr(pTrimmed)) break;

      paraLines.push(pTrimmed);
      i++;
    }

    if (paraLines.length > 0) {
      const fullText = paraLines.join('\n');
      ast.push({
        type: 'paragraph',
        runs: extractInlineStyles(fullText)
      });
    } else {
      // Sécurité anti-boucle infinie
      i++;
    }
  }

  return ast;
}

/**
 * Vérifie si une ligne est une ligne de tableau (contient des pipes)
 */
function isTableLine(line) {
  return line.includes('|') && line.trim().startsWith('|');
}

/**
 * Vérifie si une ligne est un séparateur de tableau (|---|---|)
 */
function isTableSeparator(line) {
  if (!line) return false;
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

/**
 * Parse un tableau Markdown à partir de la position donnée
 */
function parseTable(lines, startIndex) {
  const rows = [];
  let i = startIndex;

  // Ligne d'en-tête
  rows.push(parseTableRow(lines[i]));
  i++;

  // Ligne séparateur (skip)
  i++;

  // Lignes de données
  while (i < lines.length && isTableLine(lines[i].trimEnd())) {
    rows.push(parseTableRow(lines[i]));
    i++;
  }

  return {
    block: { type: 'table', rows },
    nextIndex: i
  };
}

/**
 * Parse une ligne de tableau en tableau de cellules
 */
function parseTableRow(line) {
  return line
    .split('|')
    .slice(1, -1) // Retirer les pipes extérieurs vides
    .map(cell => cell.trim());
}

/**
 * Export par défaut pour usage simple
 */
export const MarkdownParser = {
  parseToAST,
  extractInlineStyles
};
