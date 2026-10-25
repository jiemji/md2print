/**
 * DocxGenerator.js — Génération Word (.docx) depuis Markdown avec support des images Base64 et injection dans un template
 */
import { parseToAST, extractInlineStyles } from './MarkdownParser.js';
import {
  yieldToMain,
  resolveImagePaths,
  normalizeMarkdown,
  dataUrlToUint8Array,
  getImageDimensions,
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
 * Construit les blocs docx depuis le Markdown normalisé.
 * @param {string} cleanMd
 * @param {object} docConfig
 * @returns {Promise<Array>}
 */
async function buildDocxBlocks(cleanMd, docConfig) {
  const ast = parseToAST(cleanMd);
  const blocks = [];
  let isFirstH1 = true;

  for (const block of ast) {
    if (block.type === 'header') {
      if (block.level === 1 && isFirstH1) {
        isFirstH1 = false;
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
          children: block.runs.map(
            (r) =>
              new window.docx.TextRun({
                text: r.text,
                bold: r.format.bold,
                italics: r.format.italic,
              })
          ),
          style: typeof st === 'string' ? st : undefined,
          heading: typeof st === 'string' ? undefined : cfg.fallback,
          spacing: cfg.sp,
        })
      );
    } else if (block.type === 'image') {
      const parsedImg = dataUrlToUint8Array(block.src);
      if (parsedImg) {
        const dims = await getImageDimensions(block.src, 520, 340);
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
    } else if (block.type === 'list_item') {
      const styleList = docConfig?.styles?.[block.listType === 'ordered' ? 'ol' : 'ul'];
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
    } else if (block.type === 'paragraph') {
      const styleP = docConfig?.styles?.p;
      blocks.push(
        new window.docx.Paragraph({
          children: toDocxRuns(block.runs),
          style: typeof styleP === 'string' ? styleP : undefined,
          spacing: { after: 120 },
        })
      );
    }
  }
  return blocks;
}

/**
 * Convertit des runs internes en TextRun docx.
 * @param {Array} runs
 * @returns {Array}
 */
function toDocxRuns(runs) {
  if (!runs?.length) return [new window.docx.TextRun({ text: '' })];
  return runs.map(
    (r) =>
      new window.docx.TextRun({
        text: r.text,
        bold: r.format.bold,
        italics: r.format.italic,
        strike: r.format.strike,
        font: r.format.code ? 'Consolas' : undefined,
        underline: r.format.underline ? { type: window.docx.UnderlineType.SINGLE } : undefined,
        color: r.format.color || undefined,
      })
  );
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
                children: runs.map(
                  (r) =>
                    new window.docx.TextRun({
                      text: r.text,
                      bold: isH || r.format.bold,
                      italics: r.format.italic,
                      color,
                    })
                ),
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
