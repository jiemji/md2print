/**
 * PptxSlideBuilders.js — Constructeurs de diapositives PowerPoint (textes, listes, tableaux, images Base64)
 */
import { parseToAST } from './MarkdownParser.js';

/**
 * Dessine les éléments du masque (master) sur une diapositive.
 * @param {object} pptx - Instance PptxGenJS
 * @param {object} slide - Diapositive cible
 * @param {Array<object>} elements - Éléments graphiques et textuels du master
 * @param {Record<string, string>} placeholders - Dictionnaire de remplacement ({{title}}, {{DATE}}, etc.)
 * @param {object} template - Configuration du template actif
 * @returns {void}
 */
export function drawMasterElements(pptx, slide, elements, placeholders, template) {
  if (!elements) return;
  const merged = consolidateElements(elements);
  merged.forEach((el) => {
    let text = el.text || '';
    if (typeof text === 'string') {
      Object.keys(placeholders).forEach((key) => {
        text = text.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), placeholders[key]);
      });
    }
    const opts = {
      x: el.x,
      y: el.y,
      w: el.w,
      h: el.h,
      fill: el.fill ? { color: el.fill } : undefined,
      align: el.align,
      fontSize: el.fontSize,
      fontFace: el.fontFace || template.fonts?.title,
      bold: el.bold,
      color: el.color || template.theme?.text,
      shadow: el.shadow,
      rotate: el.rotate,
      valign: el.valign,
      margin: el.margin ? [el.margin[3], el.margin[1], el.margin[2], el.margin[0]] : undefined,
    };
    if (el.border) {
      opts.border = el.border;
      opts.line = el.border;
    }
    if (el.type === 'text') slide.addText(text, opts);
    else if (el.type === 'rect') slide.addShape(pptx.ShapeType?.rect || 'rect', opts);
    else if (el.type === 'ellipse') slide.addShape(pptx.ShapeType?.ellipse || 'ellipse', opts);
    else if (el.type === 'line') slide.addShape(pptx.ShapeType?.line || 'line', opts);
    else if (el.type === 'image' && (opts.path || opts.data)) slide.addImage(opts);
  });
}

/**
 * Parse une section Markdown et injecte son contenu sur une ou plusieurs diapositives.
 * @param {function} createSlideFn - Factory créant une nouvelle diapositive
 * @param {string} mdText - Contenu Markdown de la section
 * @param {{ x: number, y: number, w: number, h: number }} area - Zone de contenu utile
 * @param {object} template - Configuration du template actif
 * @param {object} [tableFormat={}] - Formatage des tableaux
 * @param {string|null} [initialTitle=null] - Titre initial de la section
 * @returns {void}
 */
export function parseMarkdownToSlide(
  createSlideFn,
  mdText,
  area,
  template,
  tableFormat = {},
  initialTitle = null
) {
  const ast = parseToAST(mdText);
  let activeTitle = initialTitle;
  let slide = null;
  let currentY = area.y;
  const marginX = area.x;
  const contentW = area.w;
  const maxY = area.y + area.h;
  const getSlide = () => {
    if (!slide) slide = createSlideFn(activeTitle);
    return slide;
  };
  const theme = template.theme;
  const fontBody = template.fonts?.body || 'Calibri';
  let textRuns = [];
  let textH = 0;

  const flushText = () => {
    if (textRuns.length > 0) {
      getSlide().addText(textRuns, {
        x: marginX,
        y: currentY,
        w: contentW,
        h: textH,
        fontFace: fontBody,
        color: theme?.text || '333333',
        fontSize: 12,
        valign: 'top',
        margin: 0,
      });
      currentY += textH;
      textRuns = [];
      textH = 0;
    }
  };

  for (const block of ast) {
    if (block.type === 'table') {
      flushText();
      const tH = block.rows.length * 0.4 + 0.2;
      if (currentY + tH > maxY && currentY > area.y) {
        slide = null;
        currentY = area.y;
      }
      addPptTable(getSlide(), block.rows, currentY, marginX, contentW, theme, fontBody, tableFormat);
      currentY += tH;
    } else if (block.type === 'image') {
      if (block.src && block.src.startsWith('data:image/')) {
        flushText();
        const imgH = 2.8;
        const imgW = 4.6;
        if (currentY + imgH > maxY && currentY > area.y) {
          slide = null;
          currentY = area.y;
        }
        getSlide().addImage({
          data: block.src,
          x: marginX,
          y: currentY,
          w: imgW,
          h: imgH,
        });
        currentY += imgH + 0.2;
      }
    } else if (block.type === 'header') {
      if (block.level === 1) {
        flushText();
        activeTitle = block.text;
        createSlideFn(activeTitle, 'chapter');
        slide = null;
        currentY = area.y;
        continue;
      }
      if (block.level === 2) {
        flushText();
        activeTitle = block.text;
        if (slide !== null || currentY > area.y) {
          slide = null;
          currentY = area.y;
        }
        continue;
      }
      let bOpts = { breakLine: true };
      let h = 0.3;
      if (block.level === 3) {
        bOpts = {
          fontSize: 18,
          bold: true,
          color: theme?.primary || '003366',
          fontFace: template.fonts?.title || 'Calibri',
        };
        h = 0.5;
      } else if (block.level === 4) {
        bOpts = {
          fontSize: 16,
          bold: true,
          color: theme?.secondary || '666666',
          fontFace: template.fonts?.title || 'Calibri',
        };
        h = 0.4;
      } else if (block.level >= 5) {
        bOpts = {
          fontSize: 14,
          underline: true,
          color: theme?.text || '333333',
          fontFace: template.fonts?.title || 'Calibri',
        };
        h = 0.35;
      }
      if (currentY + textH + h > maxY && (currentY > area.y || textH > 0)) {
        flushText();
        slide = null;
        currentY = area.y;
      }
      pushRuns(block.runs, bOpts, textRuns);
      textH += h;
    } else if (block.type === 'list_item') {
      const bOpts = {
        fontSize: 12,
        color: theme?.text || '333333',
        fontFace: fontBody,
        breakLine: true,
      };
      if (block.listType === 'unordered') bOpts.bullet = true;
      else if (block.listType === 'ordered') bOpts.bullet = { type: 'number' };
      if (block.level > 0) bOpts.indentLevel = block.level;
      const totalLen = block.runs.reduce((a, r) => a + r.text.length, 0);
      const h = 0.3 * Math.max(Math.ceil(totalLen / (contentW * 12)), 1);
      if (currentY + textH + h > maxY && (currentY > area.y || textH > 0)) {
        flushText();
        slide = null;
        currentY = area.y;
      }
      pushRuns(block.runs, bOpts, textRuns);
      textH += h;
    } else if (block.type === 'paragraph') {
      const bOpts = {
        fontSize: 12,
        color: theme?.text || '333333',
        fontFace: block.isCode ? 'Consolas' : fontBody,
        breakLine: true,
      };
      const totalLen = block.runs.reduce((a, r) => a + r.text.length, 0);
      const h = 0.3 * Math.max(Math.ceil(totalLen / (contentW * 12)), 1);
      if (currentY + textH + h > maxY && (currentY > area.y || textH > 0)) {
        flushText();
        slide = null;
        currentY = area.y;
      }
      if (block.runs.length === 0) textRuns.push({ text: '', options: bOpts });
      else pushRuns(block.runs, bOpts, textRuns);
      textH += h;
    }
  }
  flushText();
}

/**
 * Ajoute des segments de texte formatés (runs) dans le tampon de la diapositive courante.
 * @param {Array<{text: string, format: object}>} runs - Segments de texte avec styles inline
 * @param {object} baseOpts - Options PptxGenJS de base du bloc
 * @param {Array<object>} textRuns - Tampon de sortie PptxGenJS
 * @returns {void}
 */
function pushRuns(runs, baseOpts, textRuns) {
  if (!runs?.length) return;
  runs.forEach((run, i) => {
    const opts = {
      ...baseOpts,
      bold: baseOpts.bold || run.format.bold,
      italic: baseOpts.italic || run.format.italic,
      underline: baseOpts.underline || run.format.underline,
      breakLine: i === runs.length - 1,
    };
    if (run.format.color) opts.color = run.format.color;
    if (i > 0) {
      delete opts.bullet;
      delete opts.indentLevel;
    }
    textRuns.push({ text: run.text, options: opts });
  });
}

/**
 * Crée et positionne un tableau formaté sur une diapositive PowerPoint.
 * @param {object} slide - Diapositive cible
 * @param {string[][]} rows - Lignes et cellules du tableau
 * @param {number} y - Position verticale
 * @param {number} x - Position horizontale
 * @param {number} w - Largeur totale
 * @param {object} theme - Thème de couleurs du template
 * @param {string} font - Police de caractères
 * @param {object} [tf={}] - Configuration tableFormat
 * @returns {void}
 */
function addPptTable(slide, rows, y, x, w, theme, font, tf = {}) {
  if (!rows.length) return;
  const cc = rows[0].length;
  const fmt = {
    hFill: tf.headerFill || 'E0E0E0',
    hColor: tf.headerColor || '000000',
    hBold: tf.headerBold !== undefined ? tf.headerBold : true,
    rFill: tf.rowFill || 'FFFFFF',
    rAlt: tf.rowAltFill || 'FFFFFF',
    bSz: tf.borderSize ?? 1,
    bCol: tf.borderColor || 'CCCCCC',
    fSz: tf.fontSize || 10,
  };
  const fRows = rows.map((row, ri) => {
    const isH = ri === 0;
    return row.map((cell) => ({
      text: cell.replace(/<br\s*\/?>/gi, '\n'),
      options: {
        fill: isH ? fmt.hFill : ri % 2 === 0 ? fmt.rFill : fmt.rAlt,
        color: isH ? fmt.hColor : theme?.text || '333333',
        bold: isH ? fmt.hBold : false,
        fontFace: font,
        fontSize: fmt.fSz,
        border: { pt: fmt.bSz, color: fmt.bCol },
      },
    }));
  });
  slide.addTable(fRows, { x, y, w, colW: Array(cc).fill(w / cc), rowH: 0.4 });
}

/**
 * Fusionne les éléments textuels consécutifs partageant la même colonne et le même style dans un master.
 * @param {Array<object>} elements - Liste brute d'éléments du master
 * @returns {Array<object>} Liste consolidée
 */
function consolidateElements(elements) {
  if (!elements?.length) return [];
  const result = [];
  let cur = null;
  elements.forEach((el) => {
    if (!cur) {
      cur = { ...el };
      return;
    }
    if (cur.type === 'text' && el.type === 'text') {
      const sameCol = Math.abs(cur.x - el.x) < 0.2 && Math.abs(cur.w - el.w) < 0.2;
      const yGap = el.y - (cur.y + cur.h);
      if (
        sameCol &&
        yGap > -0.1 &&
        yGap < 0.5 &&
        cur.fontSize === el.fontSize &&
        cur.bold === el.bold &&
        cur.color === el.color
      ) {
        cur.text = (cur.text || '') + '\n' + (el.text || '');
        cur.h = el.y + el.h - cur.y;
        return;
      }
    }
    result.push(cur);
    cur = { ...el };
  });
  if (cur) result.push(cur);
  return result;
}
