/**
 * @module DocxGenerator
 * @description Génération Word (.docx) côté client depuis le Markdown normalisé.
 * Supporte les images Base64, les schémas Mermaid rastérisés en PNG haute résolution 2x,
 * les alertes/callouts avec bordure colorée, les blocs de code, citations, tableaux,
 * la conversion des en-têtes de colonnes ([colonne:...:titre:...]) en titres Word (HEADING_4),
 * et l'injection OpenXML dans un modèle personnalisé via JSZip.
 * Les blocs HTML exécutables (```html-exec) sont ignorés lors de l'export Word bureautique.
 * @requires MarkdownParser
 * @requires utils
 */
import { parseToAST, extractInlineStyles } from './MarkdownParser.js';
import {
  yieldToMain,
  ensureDocxLoaded,
  resolveImagePaths,
  normalizeMarkdown,
  ensureOfficeCompatibleImage,
  dataUrlToUint8Array,
  getImageDimensions,
  renderMermaidToPngDataUrl,
  parseColumnTagParams,
  TIMELINE_COLOR_MAP,
} from './utils.js';

/**
 * Génère un Blob DOCX à partir du Markdown.
 * @param {string} mdText - Texte Markdown brut
 * @param {string} docTitle - Titre du document
 * @param {object} docConfig - Configuration document (styles, tableFormat)
 * @param {ArrayBuffer|null} templateBuffer - Buffer du fichier template .docx
 * @param {Record<string, string>} [localImages={}] - Dictionnaire d'images Base64
 * @param {function} [onProgress] - Callback de progression
 * @returns {Promise<Blob>}
 */
export async function generateDocx(
  mdText,
  docTitle,
  docConfig,
  templateBuffer,
  localImages = {},
  onProgress
) {
  onProgress?.('Chargement du moteur Word...');
  await ensureDocxLoaded();
  if (!window.docx) {
    throw new Error("La bibliothèque docx n'est pas chargée.");
  }

  onProgress?.('Préparation et normalisation du Markdown...');
  const resolvedMd = resolveImagePaths(mdText || '', localImages);
  const cleanMd = normalizeMarkdown(resolvedMd);

  const allBlocks = await buildDocxBlocks(cleanMd, docConfig);

  const tempDoc = new window.docx.Document({
    sections: [{ properties: {}, children: allBlocks }],
  });

  await yieldToMain();
  onProgress?.('Compilation du document Word...');
  const tempBlob = await window.docx.Packer.toBlob(tempDoc);

  if (!templateBuffer || !window.JSZip) {
    return tempBlob;
  }

  onProgress?.('Injection dans le modèle Word...');
  return await injectIntoTemplate(tempBlob, templateBuffer, docTitle, onProgress);
}

/**
 * Détecte si un bloc AST est une balise d'ouverture de colonne (`[colonne...]` ou `:::colonne...`).
 * @param {object} block
 * @returns {RegExpMatchArray|null}
 */
function matchColumnOpenTag(block) {
  if (block?.type !== 'paragraph') return null;
  const rawTrim = (block.raw || '').trim();
  return (
    rawTrim.match(/^\[(?:col(?:onne)?)(?:\s*:\s*([^\]]*))?\]$/i) ||
    rawTrim.match(/^:::\s*(?:col(?:onne)?)(?:\s*:\s*([^\r\n]*))?$/i)
  );
}

/**
 * Détecte si un bloc AST est une balise de fermeture de colonne (`[/colonne]` ou `:::`).
 * @param {object} block
 * @returns {boolean}
 */
function isColumnCloseTag(block) {
  if (block?.type !== 'paragraph') return false;
  const rawTrim = (block.raw || '').trim();
  return (
    /^\[\/(?:col(?:onne)?)\]$/i.test(rawTrim) ||
    /^:::(?:\s*\/\s*(?:col(?:onne)?))?$/i.test(rawTrim)
  );
}

/**
 * Détecte si un bloc AST est un conteneur englobant optionnel (`[colonnes]`, `[/colonnes]`).
 * @param {object} block
 * @returns {boolean}
 */
function isColumnsContainerTag(block) {
  if (block?.type !== 'paragraph') return false;
  const rawTrim = (block.raw || '').trim();
  return (
    /^\[\/?(?:colonnes|cols)\]$/i.test(rawTrim) ||
    /^:::\s*\/?\s*(?:colonnes|cols)$/i.test(rawTrim)
  );
}

/**
 * Construit l'ensemble des paragraphes, tableaux et éléments docx depuis le Markdown normalisé.
 * Analyse l'arbre syntaxique abstrait (AST) généré par MarkdownParser :
 * - Associe les titres H1..H6 aux styles de paragraphe Word correspondants.
 * - Regroupe les blocs `[colonne:...]` ... `[/colonne]` adjacents en tableaux multi-colonnes côte à côte.
 * - Convertit les frises chronologiques `[frise]...[/frise]` en tableaux horizontaux structurés.
 * - Télécharge et convertit les images et schémas Mermaid en objets ImageRun OpenXML.
 *
 * @async
 * @function buildDocxBlocks
 * @param {string} cleanMd - Texte Markdown nettoyé et normalisé
 * @param {object} docConfig - Configuration de mise en page et styles Word
 * @returns {Promise<Array<object>>} Tableau de paragraphes et tableaux OpenXML docx
 */
async function buildDocxBlocks(cleanMd, docConfig) {
  const ast = parseToAST(cleanMd);
  return buildDocxBlocksFromAst(ast, docConfig, { isFirstH1: true });
}

/**
 * Compile récursivement une tranche de nœuds AST en éléments OpenXML docx.
 * @param {Array<object>} ast - Liste de nœuds AST
 * @param {object} docConfig - Configuration de mise en page et styles Word
 * @param {{ isFirstH1: boolean }} state - État partagé pour le premier H1
 * @returns {Promise<Array<object>>}
 */
async function buildDocxBlocksFromAst(ast, docConfig, state = { isFirstH1: true }) {
  const blocks = [];

  for (let idx = 0; idx < ast.length; idx++) {
    const block = ast[idx];
    const nextBlock = ast[idx + 1];
    const hasEmptyNext = nextBlock?.type === 'empty_line';

    if (isColumnsContainerTag(block)) {
      continue;
    }

    const firstColMatch = matchColumnOpenTag(block);
    if (firstColMatch) {
      const columnsGroup = [];
      let cursor = idx;

      while (cursor < ast.length) {
        const colMatch = matchColumnOpenTag(ast[cursor]);
        if (!colMatch) break;

        const params = parseColumnTagParams(colMatch[1]);
        const astSlice = [];
        cursor++;

        while (cursor < ast.length && !isColumnCloseTag(ast[cursor])) {
          astSlice.push(ast[cursor]);
          cursor++;
        }
        if (cursor < ast.length && isColumnCloseTag(ast[cursor])) {
          cursor++;
        }

        columnsGroup.push({ params, astSlice });

        const savedCursor = cursor;
        while (
          cursor < ast.length &&
          (ast[cursor].type === 'empty_line' || isColumnsContainerTag(ast[cursor]))
        ) {
          cursor++;
        }
        if (cursor < ast.length && matchColumnOpenTag(ast[cursor])) {
          continue;
        }
        cursor = savedCursor;
        break;
      }

      idx = cursor - 1;
      if (columnsGroup.length > 0) {
        const colTable = await createDocxColumnsTable(columnsGroup, docConfig, state);
        blocks.push(colTable);
      }
      continue;
    }

    if (block.type === 'timeline') {
      if (block.steps && block.steps.length > 0) {
        blocks.push(createDocxTimelineTable(block.steps));
      }
      continue;
    }

    if (block.type === 'empty_line') {
      const count = Math.max(1, Number(block.count) || 1);
      const styleP = docConfig?.styles?.p;
      for (let k = 0; k < count; k++) {
        blocks.push(
          new window.docx.Paragraph({
            children: [new window.docx.TextRun({ text: '' })],
            style: typeof styleP === 'string' ? styleP : undefined,
            spacing: { before: 0, after: 80 },
          })
        );
      }
      continue;
    }

    if (block.type === 'header') {
      if (block.level === 1 && state.isFirstH1) {
        state.isFirstH1 = false;
        const style = docConfig?.styles?.globalTitle || docConfig?.styles?.h1;
        blocks.push(
          new window.docx.Paragraph({
            children: block.runs.map((r) => new window.docx.TextRun({ text: r.text })),
            style: typeof style === 'string' ? style : undefined,
            heading: typeof style === 'string' ? undefined : window.docx.HeadingLevel.TITLE,
            spacing: { before: 400, after: 200 },
          })
        );
        continue;
      }

      const hMap = {
        1: { style: docConfig?.styles?.h1, fallback: window.docx.HeadingLevel.HEADING_1, sp: { before: 400, after: 200 } },
        2: { style: docConfig?.styles?.h1, fallback: window.docx.HeadingLevel.HEADING_1, sp: { before: 400, after: 200 } },
        3: { style: docConfig?.styles?.h2, fallback: window.docx.HeadingLevel.HEADING_2, sp: { before: 300, after: 150 } },
        4: { style: docConfig?.styles?.h3, fallback: window.docx.HeadingLevel.HEADING_3, sp: { before: 200, after: 100 } },
        5: { style: docConfig?.styles?.h4, fallback: window.docx.HeadingLevel.HEADING_4, sp: { before: 200, after: 100 } },
        6: { style: docConfig?.styles?.h5, fallback: window.docx.HeadingLevel.HEADING_5, sp: { before: 200, after: 100 } },
      };
      const cfg = hMap[block.level] || hMap[1];
      const st = cfg.style;
      blocks.push(
        new window.docx.Paragraph({
          children: toDocxRuns(block.runs),
          style: typeof st === 'string' ? st : undefined,
          heading: typeof st === 'string' ? undefined : cfg.fallback,
          spacing: cfg.sp,
        })
      );
    } else if (block.type === 'mermaid') {
      const pngDataUrl = await renderMermaidToPngDataUrl(block.code);
      const parsedImg = pngDataUrl ? dataUrlToUint8Array(pngDataUrl) : null;
      if (parsedImg) {
        const dims = await getImageDimensions(pngDataUrl, 540, 380);
        blocks.push(
          new window.docx.Paragraph({
            alignment: window.docx.AlignmentType.CENTER,
            children: [
              new window.docx.ImageRun({
                data: parsedImg.bytes,
                transformation: { width: dims.width, height: dims.height },
                type: 'png',
              }),
            ],
            spacing: { before: 180, after: 180 },
          })
        );
      } else {
        const codeBorder = {
          style: window.docx.BorderStyle.SINGLE,
          size: 4,
          color: 'CBD5E1',
          space: 4,
        };
        blocks.push(
          new window.docx.Paragraph({
            children: toDocxRuns([{ text: block.code || '', format: { code: true } }], {
              code: true,
              size: 19,
              color: '1E293B',
            }),
            shading: { fill: 'F1F5F9' },
            border: {
              top: codeBorder,
              bottom: codeBorder,
              left: { ...codeBorder, size: 12, color: '2563EB' },
              right: codeBorder,
            },
            indent: { left: 240, right: 240 },
            spacing: { before: 160, after: 160 },
          })
        );
      }
    } else if (block.type === 'image') {
      const compatSrc = await ensureOfficeCompatibleImage(block.src);
      const parsedImg = dataUrlToUint8Array(compatSrc);
      if (parsedImg) {
        const dims = await getImageDimensions(compatSrc, 520, 340);
        const docImgType = parsedImg.ext === 'jpg' ? 'jpg' : parsedImg.ext === 'gif' ? 'gif' : 'png';
        blocks.push(
          new window.docx.Paragraph({
            children: [
              new window.docx.ImageRun({
                data: parsedImg.bytes,
                transformation: { width: dims.width, height: dims.height },
                type: docImgType,
              }),
            ],
            spacing: { before: 160, after: 160 },
          })
        );
      }
    } else if (block.type === 'separator') {
      blocks.push(
        new window.docx.Paragraph({
          children: [],
          border: {
            bottom: {
              style: window.docx.BorderStyle.SINGLE,
              size: 6,
              color: 'CBD5E1',
              space: 1,
            },
          },
          spacing: { before: 240, after: 240 },
        })
      );
    } else if (block.type === 'list_item') {
      const styleList = docConfig?.styles?.[block.listType === 'ordered' ? 'ordered' : 'ul'] ||
        docConfig?.styles?.[block.listType === 'ordered' ? 'ol' : 'ul'];
      let appliedStyle;
      let appliedIndent;
      if (Array.isArray(styleList)) {
        appliedStyle = styleList[Math.min(block.level, styleList.length - 1)];
      } else if (typeof styleList === 'string') {
        appliedStyle = styleList;
        if (block.level > 0) appliedIndent = { left: 720 * block.level };
      }
      blocks.push(
        new window.docx.Paragraph({
          children: toDocxRuns(block.runs),
          style: appliedStyle,
          indent: appliedIndent,
          spacing: { after: 100 },
          bullet: appliedStyle ? undefined : { level: block.level },
        })
      );
    } else if (block.type === 'table') {
      blocks.push(createDocxTable(block.rows, docConfig));
    } else if (block.type === 'paragraph' && block.isCode) {
      const codeBorder = {
        style: window.docx.BorderStyle.SINGLE,
        size: 4,
        color: 'CBD5E1',
        space: 4,
      };
      blocks.push(
        new window.docx.Paragraph({
          children: toDocxRuns(block.runs, { code: true, size: 19, color: '1E293B' }),
          shading: { fill: 'F1F5F9' },
          border: {
            top: codeBorder,
            bottom: codeBorder,
            left: { ...codeBorder, size: 12, color: '2563EB' },
            right: codeBorder,
          },
          indent: { left: 240, right: 240 },
          spacing: { before: 160, after: 160 },
        })
      );
    } else if (block.type === 'paragraph' && block.isQuote) {
      const calloutColorMap = {
        note: '0284C7',
        info: '0284C7',
        tip: '16A34A',
        important: '7C3AED',
        warning: 'D97706',
        danger: 'DC2626',
      };
      const borderColor = block.callout
        ? calloutColorMap[block.callout.kind] || '0284C7'
        : '2563EB';

      blocks.push(
        new window.docx.Paragraph({
          children: toDocxRuns(block.runs, { italic: !block.callout, color: '334155' }),
          shading: { fill: 'F8FAFC' },
          border: {
            left: {
              style: window.docx.BorderStyle.SINGLE,
              size: block.callout ? 24 : 16,
              color: borderColor,
              space: 8,
            },
          },
          indent: { left: 360, right: 240 },
          spacing: { before: 140, after: 140 },
        })
      );
    } else if (block.type === 'paragraph') {
      if (isColumnCloseTag(block) || isColumnsContainerTag(block)) {
        continue;
      }
      const styleP = docConfig?.styles?.p;
      blocks.push(
        new window.docx.Paragraph({
          children: toDocxRuns(block.runs),
          style: typeof styleP === 'string' ? styleP : undefined,
          spacing: { after: hasEmptyNext ? 0 : 120 },
        })
      );
    }
  }
  return blocks;
}

/**
 * Convertit des runs internes en TextRun docx en préservant les sauts de ligne (\n -> break: 1).
 * @param {Array} runs - Segments de texte formatés
 * @param {object} [extraFormat={}] - Attributs de style forcés au niveau du bloc (code, quote)
 * @returns {Array}
 */
function toDocxRuns(runs, extraFormat = {}) {
  if (!runs?.length) return [new window.docx.TextRun({ text: '' })];
  const docxRuns = [];
  runs.forEach((r) => {
    const lines = String(r.text ?? '').split('\n');
    const runBg = r.format?.background ? String(r.format.background).replace(/^#/, '') : null;
    const resolvedColor = extraFormat.forceColor
      ? extraFormat.color
      : r.format?.color || extraFormat.color;
    const runColor = (resolvedColor || '').replace(/^#/, '') || undefined;
    lines.forEach((lineText, lineIdx) => {
      docxRuns.push(
        new window.docx.TextRun({
          text: lineText,
          break: lineIdx > 0 ? 1 : undefined,
          bold: extraFormat.bold || r.format.bold,
          italics: extraFormat.italic || r.format.italic,
          strike: r.format.strike,
          font: extraFormat.code || r.format.code ? 'Consolas' : undefined,
          size: extraFormat.size || (r.format.metric ? 56 : r.format.badge ? 19 : undefined),
          underline: r.format.underline
            ? { type: window.docx.UnderlineType.SINGLE }
            : undefined,
          color: runColor,
          shading:
            runBg && window.docx?.ShadingType
              ? {
                  type: window.docx.ShadingType.CLEAR,
                  color: 'auto',
                  fill: runBg,
                }
              : undefined,
        })
      );
    });
  });
  return docxRuns;
}

/**
 * Crée un tableau docx formaté.
 * @param {string[][]} rowsData
 * @param {object} docConfig
 * @returns {object}
 */
function createDocxTable(rowsData, docConfig) {
  const tf = docConfig?.tableFormat || {};
  const hFill = tf.headerFill || 'E0E0E0';
  const hCol = tf.headerColor || '000000';
  const rFill = tf.rowFill || 'FFFFFF';
  const rAlt = tf.rowAltFill || 'FFFFFF';
  const bCol = tf.borderColor || 'CCCCCC';
  const bSz = tf.borderSize ?? 4;
  const bDef = { style: window.docx.BorderStyle.SINGLE, size: bSz, color: bCol };
  const borders = {
    top: bDef,
    bottom: bDef,
    left: bDef,
    right: bDef,
    insideHorizontal: bDef,
    insideVertical: bDef,
  };

  return new window.docx.Table({
    width: { size: 100, type: window.docx.WidthType.PERCENTAGE },
    borders,
    rows: rowsData.map((row, ri) => {
      const isH = ri === 0;
      return new window.docx.TableRow({
        children: row.map((cellText) => {
          const fill = isH ? hFill : ri % 2 === 0 ? rFill : rAlt;
          const color = isH ? hCol : '000000';
          const runs = extractInlineStyles(cellText);
          return new window.docx.TableCell({
            children: [
              new window.docx.Paragraph({
                children: toDocxRuns(runs, {
                  bold: isH,
                  color,
                  forceColor: isH,
                }),
              }),
            ],
            shading: { fill },
          });
        }),
      });
    }),
  });
}

/**
 * Crée un tableau horizontal Word représentant une frise chronologique (`[frise]...[/frise]`).
 * La première ligne affiche les jalons colorés centrés avec une bordure inférieure épaisse formant l'axe,
 * et la seconde ligne présente les titres en gras suivis de leur description.
 *
 * @param {Array<{ badge: string, colorName: string, title: string, desc: string }>} steps
 * @returns {object} Instance `window.docx.Table`
 */
function createDocxTimelineTable(steps) {
  const count = Math.max(1, steps.length);
  const colPct = Math.floor(100 / count);
  const lightBorder = {
    style: window.docx.BorderStyle.SINGLE,
    size: 4,
    color: 'E2E8F0',
  };

  const badgeCells = steps.map((step, idx) => {
    const palette = TIMELINE_COLOR_MAP[step.colorName] || TIMELINE_COLOR_MAP.primary;
    const label = step.badge || String(idx + 1);
    return new window.docx.TableCell({
      width: { size: colPct, type: window.docx.WidthType.PERCENTAGE },
      shading: { fill: palette.bg },
      margins: { top: 100, bottom: 100, left: 120, right: 120 },
      borders: {
        top: { style: window.docx.BorderStyle.SINGLE, size: 6, color: palette.border },
        bottom: { style: window.docx.BorderStyle.SINGLE, size: 18, color: palette.border },
        left: lightBorder,
        right: lightBorder,
      },
      children: [
        new window.docx.Paragraph({
          alignment: window.docx.AlignmentType.CENTER,
          children: [
            new window.docx.TextRun({
              text: label,
              bold: true,
              color: palette.text,
              size: 22,
            }),
          ],
          spacing: { before: 60, after: 60 },
        }),
      ],
    });
  });

  const bodyCells = steps.map((step) => {
    const cellParas = [];
    if (step.title && (step.title !== step.badge || !step.desc)) {
      cellParas.push(
        new window.docx.Paragraph({
          alignment: window.docx.AlignmentType.CENTER,
          children: toDocxRuns(extractInlineStyles(step.title), {
            bold: true,
            color: '0F172A',
          }),
          spacing: { before: 80, after: step.desc ? 60 : 80 },
        })
      );
    }
    if (step.desc) {
      cellParas.push(
        new window.docx.Paragraph({
          alignment: window.docx.AlignmentType.CENTER,
          children: toDocxRuns(extractInlineStyles(step.desc), {
            color: '475569',
            size: 18,
          }),
          spacing: { before: 20, after: 80 },
        })
      );
    }
    if (cellParas.length === 0) {
      cellParas.push(new window.docx.Paragraph({ children: [] }));
    }

    return new window.docx.TableCell({
      width: { size: colPct, type: window.docx.WidthType.PERCENTAGE },
      shading: { fill: 'FFFFFF' },
      margins: { top: 100, bottom: 100, left: 120, right: 120 },
      borders: {
        top: lightBorder,
        bottom: lightBorder,
        left: lightBorder,
        right: lightBorder,
      },
      children: cellParas,
    });
  });

  return new window.docx.Table({
    width: { size: 100, type: window.docx.WidthType.PERCENTAGE },
    rows: [
      new window.docx.TableRow({ children: badgeCells }),
      new window.docx.TableRow({ children: bodyCells }),
    ],
  });
}

const COL_VARIANT_PALETTE = {
  info: { border: '0284C7', headerText: '0369A1', cellBg: 'F8FAFC' },
  success: { border: '16A34A', headerText: '15803D', cellBg: 'F0FDF4' },
  warning: { border: 'D97706', headerText: 'B45309', cellBg: 'FFFBEB' },
  danger: { border: 'DC2626', headerText: 'B91C1C', cellBg: 'FEF2F2' },
  important: { border: '7C3AED', headerText: '6D28D9', cellBg: 'FAF5FF' },
  neutral: { border: '64748B', headerText: '334155', cellBg: 'F8FAFC' },
};

/**
 * Construit un tableau multi-colonnes côte à côte pour restituer les groupes `[colonne:...]` ... `[/colonne]` dans Word.
 * Respecte les proportions relatives (`ratio`), affiche les titres d'en-tête centrés et applique les variantes de couleur.
 *
 * @param {Array<{ params: object, astSlice: Array<object> }>} columnsGroup
 * @param {object} docConfig
 * @param {{ isFirstH1: boolean }} state
 * @returns {Promise<object>} Instance `window.docx.Table`
 */
async function createDocxColumnsTable(columnsGroup, docConfig, state) {
  const totalRatio =
    columnsGroup.reduce((sum, col) => sum + (Number(col.params?.ratio) || 1), 0) || 1;

  const cells = [];
  for (const col of columnsGroup) {
    const ratio = Number(col.params?.ratio) || 1;
    const widthPct = Math.max(10, Math.round((ratio / totalRatio) * 100));
    const variant = col.params?.colorVariant || '';
    const customHex = (col.params?.colorHex || '').replace(/^#/, '').toUpperCase();
    const palette = COL_VARIANT_PALETTE[variant] || null;
    const borderColor = customHex || palette?.border || 'E2E8F0';
    const headerColor = customHex || palette?.headerText || '1E293B';
    const cellBg = palette?.cellBg || 'FFFFFF';
    const hasAccent = Boolean(palette || customHex);

    const innerBlocks = await buildDocxBlocksFromAst(col.astSlice, docConfig, state);
    const cellChildren = [];

    if (col.params?.title) {
      const stH4 = docConfig?.styles?.h3;
      cellChildren.push(
        new window.docx.Paragraph({
          alignment: window.docx.AlignmentType.CENTER,
          children: toDocxRuns(extractInlineStyles(col.params.title), {
            bold: true,
            color: headerColor,
          }),
          style: typeof stH4 === 'string' ? stH4 : undefined,
          heading: typeof stH4 === 'string' ? undefined : window.docx.HeadingLevel.HEADING_4,
          border: {
            bottom: {
              style: window.docx.BorderStyle.SINGLE,
              size: hasAccent ? 12 : 6,
              color: borderColor,
              space: 4,
            },
          },
          spacing: { before: 80, after: 140 },
        })
      );
    }

    cellChildren.push(...innerBlocks);

    const lastChild = cellChildren[cellChildren.length - 1];
    if (!lastChild || !(lastChild instanceof window.docx.Paragraph)) {
      cellChildren.push(new window.docx.Paragraph({ children: [] }));
    }

    const sideBorder = {
      style: window.docx.BorderStyle.SINGLE,
      size: hasAccent ? 6 : 4,
      color: borderColor,
    };

    cells.push(
      new window.docx.TableCell({
        width: { size: widthPct, type: window.docx.WidthType.PERCENTAGE },
        shading: { fill: cellBg },
        margins: { top: 140, bottom: 140, left: 180, right: 180 },
        borders: {
          top: {
            style: window.docx.BorderStyle.SINGLE,
            size: hasAccent ? 16 : 4,
            color: borderColor,
          },
          bottom: sideBorder,
          left: sideBorder,
          right: sideBorder,
        },
        children: cellChildren,
      })
    );
  }

  return new window.docx.Table({
    width: { size: 100, type: window.docx.WidthType.PERCENTAGE },
    rows: [new window.docx.TableRow({ children: cells })],
  });
}

/**
 * Injecte le contenu généré dans le template DOCX.
 * @param {Blob} tempBlob - Document DOCX temporaire généré par docx
 * @param {ArrayBuffer} templateBuffer - Buffer du modèle Word (.docx)
 * @param {string} docTitle - Titre du document pour le remplacement de {{TITRE}}
 * @param {function} [onProgress] - Callback de progression
 * @returns {Promise<Blob>}
 */
async function injectIntoTemplate(tempBlob, templateBuffer, docTitle, onProgress) {
  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  await yieldToMain();
  const tempZip = await window.JSZip.loadAsync(tempBlob);
  const tempXmlStr = await tempZip.file('word/document.xml').async('string');
  const tempXmlDoc = parser.parseFromString(tempXmlStr, 'text/xml');
  const tempBody = tempXmlDoc.getElementsByTagName('w:body')[0];
  const sourceNodes = Array.from(tempBody.childNodes).filter((n) => n.nodeName !== 'w:sectPr');

  const templateZip = await window.JSZip.loadAsync(templateBuffer);
  const safeTitle = (docTitle || '').replace(
    /[<>&'"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c])
  );
  const safeDate = new Date().toLocaleDateString('fr-FR');
  const replaceVars = (xml) => xml.replace(/\{\{TITRE\}\}/g, safeTitle).replace(/\{\{DATE\}\}/g, safeDate);

  for (const filename of Object.keys(templateZip.files)) {
    if (filename.startsWith('word/header') || filename.startsWith('word/footer')) {
      const hfXml = await templateZip.file(filename).async('string');
      templateZip.file(filename, replaceVars(hfXml));
    }
  }

  let tplXmlStr = await templateZip.file('word/document.xml').async('string');
  tplXmlStr = replaceVars(tplXmlStr);
  const tplXmlDoc = parser.parseFromString(tplXmlStr, 'text/xml');
  const tplBody = tplXmlDoc.getElementsByTagName('w:body')[0];

  onProgress?.('Transfert des médias...');
  await transferMedia(tempZip, templateZip, tempXmlDoc, parser);

  onProgress?.('Injection du contenu...');
  const paras = tplBody.getElementsByTagName('w:p');
  let placeholder = null;
  for (let i = 0; i < paras.length; i++) {
    if (paras[i].textContent.includes('{{CONTENU}}')) {
      placeholder = paras[i];
      break;
    }
  }

  if (placeholder) {
    sourceNodes.forEach((node) => {
      tplBody.insertBefore(tplXmlDoc.importNode(node, true), placeholder);
    });
    tplBody.removeChild(placeholder);
  } else {
    const lastChild = tplBody.lastChild;
    sourceNodes.forEach((node) => {
      const imported = tplXmlDoc.importNode(node, true);
      if (lastChild?.nodeName === 'w:sectPr') tplBody.insertBefore(imported, lastChild);
      else tplBody.appendChild(imported);
    });
  }

  templateZip.file('word/document.xml', serializer.serializeToString(tplXmlDoc));

  await yieldToMain();
  onProgress?.('Finalisation du fichier Word...');
  return await templateZip.generateAsync({ type: 'blob' });
}

/**
 * Transfère les médias (images) du document temporaire vers le template DOCX.
 * @param {object} tempZip - Instance JSZip du document temporaire
 * @param {object} templateZip - Instance JSZip du modèle Word
 * @param {Document} tempXmlDoc - Document XML word/document.xml temporaire
 * @param {DOMParser} parser - Instance DOMParser XML
 * @returns {Promise<void>}
 */
async function transferMedia(tempZip, templateZip, tempXmlDoc, parser) {
  const tempRelsFile = tempZip.file('word/_rels/document.xml.rels');
  const tplRelsFile = templateZip.file('word/_rels/document.xml.rels');
  if (!tempRelsFile || !tplRelsFile) return;

  let tplRelsStr = await tplRelsFile.async('string');
  const tempRelsStr = await tempRelsFile.async('string');
  const tempRelsDoc = parser.parseFromString(tempRelsStr, 'text/xml');
  const rels = Array.from(tempRelsDoc.getElementsByTagName('Relationship'));
  let newRels = '';

  for (const rel of rels) {
    const target = rel.getAttribute('Target');
    if (target?.startsWith('media/')) {
      const mediaFile = tempZip.file('word/' + target);
      if (mediaFile) {
        const data = await mediaFile.async('uint8array');
        const ext = target.split('.').pop() || 'png';
        const rand = Math.random().toString(36).substring(2, 7);
        const newTarget = `media/md2p_${Date.now()}_${rand}.${ext}`;
        templateZip.file('word/' + newTarget, data);
        const oldId = rel.getAttribute('Id');
        const newId = `rIdMd2p_${Date.now()}_${rand}`;
        newRels += `<Relationship Id="${newId}" Type="${rel.getAttribute('Type')}" Target="${newTarget}"/>`;
        const blips = tempXmlDoc.getElementsByTagName('a:blip');
        for (let i = 0; i < blips.length; i++) {
          if (blips[i].getAttribute('r:embed') === oldId) {
            blips[i].setAttribute('r:embed', newId);
          }
        }
      }
    }
  }

  if (newRels) {
    tplRelsStr = tplRelsStr.replace('</Relationships>', newRels + '</Relationships>');
    templateZip.file('word/_rels/document.xml.rels', tplRelsStr);
  }

  const ctFile = templateZip.file('[Content_Types].xml');
  if (ctFile) {
    let ctStr = await ctFile.async('string');
    if (!ctStr.includes('Extension="png"')) {
      ctStr = ctStr.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>');
    }
    if (!ctStr.includes('Extension="jpg"')) {
      ctStr = ctStr.replace('</Types>', '<Default Extension="jpg" ContentType="image/jpeg"/></Types>');
    }
    templateZip.file('[Content_Types].xml', ctStr);
  }
}
