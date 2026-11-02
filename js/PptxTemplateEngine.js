/**
 * @module PptxTemplateEngine
 * @description Moteur de génération PowerPoint natif fondé sur des modèles OpenXML (.potx).
 * Instancie des diapositives OpenXML conformes ECMA-376 à partir des masques de disposition (slideLayouts)
 * d'un modèle d'entreprise (.potx). Associe les niveaux Markdown aux dispositions configurées
 * dans `output_config.json`, injecte le texte typographié dans les placeholders appropriés,
 * génère des tableaux DrawingML natifs (<a:tbl>), insère les schémas Mermaid et les images
 * dans des conteneurs graphiques (<p:pic>) haute fidélité, et met à jour l'arborescence complète
 * du package ([Content_Types].xml, ppt/presentation.xml, fichiers de relations .rels).
 *
 * @requires ./MarkdownParser.js
 * @requires ./utils.js
 */

import { parseToAST, extractInlineStyles } from './MarkdownParser.js';
import {
  yieldToMain,
  toSlug,
  resolveImagePaths,
  normalizeMarkdown,
  ensureOfficeCompatibleImage,
  getImageDimensions,
  renderMermaidToPngDataUrl,
} from './utils.js';

/**
 * Coordonnées spatiales et dimensions d'un placeholder au format EMU (English Metric Units).
 * @typedef {Object} SlideLayoutBounds
 * @property {string} x - Décalage horizontal (EMU)
 * @property {string} y - Décalage vertical (EMU)
 * @property {string} cx - Largeur de la forme (EMU)
 * @property {string} cy - Hauteur de la forme (EMU)
 */

/**
 * Descripteur d'un masque de disposition (slideLayout) extrait d'un modèle OpenXML .potx.
 * @typedef {Object} SlideLayout
 * @property {number} num - Numéro séquentiel d'index du masque (ex: 1 pour slideLayout1.xml)
 * @property {string} path - Chemin relatif du fichier XML dans le package ZIP
 * @property {string} name - Nom de la disposition déclaré dans l'attribut `name` de `<p:cSld>`
 * @property {boolean} hasTitle - Présence d'un placeholder de titre (`type="title"` ou `type="ctrTitle"`)
 * @property {boolean} hasCtrTitle - Présence spécifique d'un titre centré (`type="ctrTitle"`)
 * @property {'title'|'ctrTitle'} titleType - Type de placeholder de titre à instancier sur la diapositive
 * @property {boolean} hasBody - Présence d'un placeholder de contenu principal (`type="body"` ou `type="obj"`)
 * @property {string} bodyIdx - Identifiant d'index du placeholder de contenu (attribut `idx`)
 * @property {'body'|'obj'} bodyType - Type OpenXML du placeholder de contenu détecté
 * @property {SlideLayoutBounds} bodyBounds - Boîte englobante du placeholder de contenu
 */

/**
 * Dictionnaire de prototypes de diapositives résolus pour la génération.
 * @typedef {Object} SlidePrototypes
 * @property {SlideLayout} cover - Masque associé à la couverture (titre global ou titre #)
 * @property {SlideLayout} chapter - Masque associé aux séparateurs de section/chapitre (##)
 * @property {SlideLayout} content - Masque de contenu standard (###)
 * @property {SlideLayout} [kpi] - Masque dédié aux diapositives d'indicateurs clés / données chiffrées
 * @property {SlideLayout} [h1] - Masque spécifique pour le niveau de titre Markdown 1
 * @property {SlideLayout} [h2] - Masque spécifique pour le niveau de titre Markdown 2
 * @property {SlideLayout} [h3] - Masque spécifique pour le niveau de titre Markdown 3
 * @property {SlideLayout} [h4] - Masque spécifique pour le niveau de titre Markdown 4
 * @property {SlideLayout} [h5] - Masque spécifique pour le niveau de titre Markdown 5
 * @property {SlideLayout} [h6] - Masque spécifique pour le niveau de titre Markdown 6
 * @property {Array<SlideLayout>} all - Ensemble de tous les masques détectés dans le fichier .potx
 */

/**
 * Représentation d'une diapositive prête à être compilée dans le flux OpenXML.
 * @typedef {Object} SlideItem
 * @property {'cover'|'chapter'|'content'} type - Rôle structurel de la diapositive
 * @property {number} [level] - Niveau de titre Markdown d'origine
 * @property {SlideLayout} proto - Prototype de masque de disposition appliqué
 * @property {string} [section] - Titre de la section ou du chapitre parent
 * @property {string} title - Titre textuel de la diapositive
 * @property {string} [metadata] - Métadonnées associées (date, sous-titres)
 * @property {Array<{type: 'list_item'|'paragraph', level?: number, runs: Array<{text: string, format: Object}>}>} items - Éléments textuels
 * @property {string[][]} [table] - Données matricielles de tableau
 * @property {Array<{alt: string, src: string}>} [images] - Images intégrées
 * @property {Array<{code: string}>} [mermaids] - Schémas Mermaid intégrés
 */

/**
 * Échappe les caractères réservés XML (&, <, >, ", ') et filtre les caractères
 * de contrôle ASCII invalides en XML 1.0 (plages [0x00-0x08], [0x0B-0x0C], [0x0E-0x1F]).
 *
 * @function escapeXml
 * @param {*} unsafe - Valeur ou chaîne brute à assainir
 * @returns {string} Chaîne échappée valide pour une injection dans les balises XML OpenXML
 */
export function escapeXml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Télécharge et charge le contenu binaire d'un modèle de présentation PowerPoint (.potx).
 * Seules les extensions `.potx` sont admises afin de garantir la présence de masques de disposition réutilisables.
 *
 * @async
 * @function loadPptxTemplateBuffer
 * @param {string} [templatePath='templates/Modele_presentation.potx'] - Chemin d'accès relatif ou absolu du fichier .potx
 * @returns {Promise<ArrayBuffer|null>} Données binaires du fichier, ou `null` en cas d'échec
 */
export async function loadPptxTemplateBuffer(templatePath = 'templates/Modele_presentation.potx') {
  if (!templatePath || !templatePath.toLowerCase().endsWith('.potx')) {
    console.warn(`[PptxTemplateEngine] Seuls les fichiers .potx sont supportés : ${templatePath}`);
    return null;
  }
  try {
    const res = await fetch(templatePath);
    if (!res.ok) {
      console.warn(`[PptxTemplateEngine] Modèle .potx introuvable : ${templatePath} (${res.status})`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (err) {
    console.warn(`[PptxTemplateEngine] Erreur de chargement du modèle .potx :`, err);
    return null;
  }
}

/**
 * Extrait le dictionnaire de configuration des masques de disposition depuis l'objet config.
 * Résout la configuration selon une cascade de priorités pour tolérer plusieurs schémas :
 *  1. `config.layouts` direct
 *  2. `config.powerpoint.templates[id===default].layouts`
 *  3. `config.powerpoint.layouts`
 *  4. `config.templates[0].layouts`
 *  5. Objet encapsulé dans `config.pptConfig`
 *
 * @function getLayoutsConfig
 * @param {Object} [config={}] - Objet global de configuration issu de output_config.json
 * @returns {Object<string, string>} Dictionnaire associant les rôles (cover, chapter, content, h1..h6) aux noms de masques
 */
export function getLayoutsConfig(config = {}) {
  if (!config) return {};

  if (config.layouts && typeof config.layouts === 'object') {
    return config.layouts;
  }

  const pw = config.powerpoint || config.pptConfig?.powerpoint;
  if (pw) {
    const targetId = pw.default || 'standard';
    const tpl = pw.templates?.find((t) => t.id === targetId) || pw.templates?.[0];
    if (tpl?.layouts) return tpl.layouts;
    if (pw.layouts) return pw.layouts;
  }

  if (Array.isArray(config.templates) && config.templates.length > 0) {
    const tpl = config.templates[0];
    if (tpl?.layouts) return tpl.layouts;
  }

  if (config.pptConfig) {
    return getLayoutsConfig(config.pptConfig);
  }

  return {};
}

/**
 * Détecte et extrait les masques de disposition (`ppt/slideLayouts/slideLayout*.xml`) du modèle OpenXML.
 *
 * Analyse les formes de chaque masque pour déterminer la présence de placeholders de titre
 * (`title` ou `ctrTitle`) et de contenu (`body` ou `obj`), extrait leur index (`idx`) et leurs
 * dimensions géométriques pour le positionnement ultérieur des tableaux, graphiques et textes.
 *
 * Associe STRICTEMENT chaque rôle ou niveau de titre (`cover`, `chapter`, `content`, `kpi`, `h1`..`h6`)
 * au masque portant le nom exact spécifié dans `output_config.json`.
 *
 * @async
 * @function detectSlidePrototypes
 * @param {Object} zip - Instance JSZip contenant l'archive décompressée du .potx
 * @param {DOMParser} parser - Instance de DOMParser XML
 * @param {Object<string, string>} [layoutConfig={}] - Configuration de mappage des masques
 * @returns {Promise<SlidePrototypes>} Dictionnaire des masques résolus
 * @throws {Error} Si aucun masque n'est présent dans le modèle, ou si un masque requis est introuvable
 */
export async function detectSlidePrototypes(zip, parser, layoutConfig = {}) {
  const layoutFiles = Object.keys(zip.files).filter((k) =>
    /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(k)
  );
  if (layoutFiles.length === 0) {
    throw new Error('Modèle PowerPoint invalide : aucun masque de disposition (slideLayout) trouvé.');
  }

  const layouts = [];

  for (const path of layoutFiles) {
    const num = parseInt(path.match(/\d+/)[0], 10);
    const xml = await zip.file(path).async('string');
    const nameMatch = xml.match(/<p:cSld[^>]*name="([^"]+)"/);
    const name = nameMatch ? nameMatch[1] : `Disposition ${num}`;

    const hasCtrTitle = xml.includes('type="ctrTitle"');
    const hasTitle = xml.includes('type="title"') || hasCtrTitle;
    const titleType = hasCtrTitle ? 'ctrTitle' : 'title';

    let bodyIdx = null;
    let bodyBounds = null;
    let bodyType = 'body';

    const spMatches = xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g);
    for (const sp of spMatches) {
      const spXml = sp[0];
      const phMatch = spXml.match(/<p:ph([^>]*)>/);
      if (phMatch) {
        const phAttrs = phMatch[1];
        const typeMatch = phAttrs.match(/type="([^"]+)"/);
        const idxMatch = phAttrs.match(/idx="([^"]+)"/);
        const phType = typeMatch ? typeMatch[1] : 'obj';
        const phIdx = idxMatch ? idxMatch[1] : null;

        // Identifier le placeholder de contenu principal (body ou obj)
        if (phType === 'body' || phType === 'obj') {
          bodyIdx = phIdx || (phType === 'body' ? '10' : '1');
          bodyType = phType;

          const offM = spXml.match(/<a:off\s+x="([^"]+)"\s+y="([^"]+)"/);
          const extM = spXml.match(/<a:ext\s+cx="([^"]+)"\s+cy="([^"]+)"/);
          if (offM && extM) {
            bodyBounds = { x: offM[1], y: offM[2], cx: extM[1], cy: extM[2] };
          }
          break;
        }
      }
    }

    layouts.push({
      num,
      path,
      name,
      hasTitle,
      hasCtrTitle,
      titleType,
      hasBody: bodyIdx !== null,
      bodyIdx: bodyIdx || '1',
      bodyType,
      bodyBounds: bodyBounds || { x: '735013', y: '1144588', cx: '10937875', cy: '5137150' },
    });
  }

  // Fonction de recherche stricte par nom exact (insensible à la casse, espaces rognés)
  const findLayoutStrict = (targetName, roleLabel) => {
    if (!targetName) return null;
    const cleanTarget = String(targetName).trim().toLowerCase();
    const found = layouts.find((l) => l.name && l.name.trim().toLowerCase() === cleanTarget);
    if (!found) {
      const availableNames = layouts.map((l) => `"${l.name}"`).join(', ');
      throw new Error(
        `Masque PowerPoint introuvable : aucun masque nommé "${targetName}" (configuré pour "${roleLabel}") n'a été trouvé dans le modèle .potx. Masques disponibles : ${availableNames}`
      );
    }
    return found;
  };

  // Résolution stricte selon le paramétrage présent dans output_config.json
  const coverTarget =
    layoutConfig.cover || layoutConfig.h1 || layoutConfig.globalTitle || layoutConfig.title;
  const chapterTarget = layoutConfig.chapter || layoutConfig.h2 || layoutConfig.section;
  const contentTarget = layoutConfig.content || layoutConfig.h3 || layoutConfig.slide;
  const kpiTarget = layoutConfig.kpi;

  let cover = coverTarget ? findLayoutStrict(coverTarget, 'cover / titre #') : null;
  let chapter = chapterTarget ? findLayoutStrict(chapterTarget, 'chapter / titre ##') : null;
  let content = contentTarget ? findLayoutStrict(contentTarget, 'content / titre ### / slide') : null;
  let kpi = kpiTarget ? findLayoutStrict(kpiTarget, 'kpi') : content || null;

  // Détection des niveaux de titre spécifiques h1..h6
  const hLayouts = {};
  for (let lvl = 1; lvl <= 6; lvl++) {
    const key = `h${lvl}`;
    if (layoutConfig[key]) {
      hLayouts[key] = findLayoutStrict(layoutConfig[key], `niveau de titre ${key}`);
    }
  }

  // Si aucune configuration n'est passée, chercher strictement les noms standards
  if (!cover && !chapter && !content) {
    if (layouts.some((l) => l.name.trim().toLowerCase() === 'couverture')) {
      cover = findLayoutStrict('Couverture', 'cover');
    }
    if (layouts.some((l) => l.name.trim().toLowerCase() === 'section')) {
      chapter = findLayoutStrict('Section', 'chapter');
    }
    if (layouts.some((l) => l.name.trim().toLowerCase() === 'slide')) {
      content = findLayoutStrict('Slide', 'content');
    }
    if (!kpi) kpi = content;
  }

  if (!cover || !content) {
    const availableNames = layouts.map((l) => `"${l.name}"`).join(', ');
    throw new Error(
      `Impossible d'associer les masques PowerPoint obligatoires. Vérifiez output_config.json. Masques disponibles dans le .potx : ${availableNames}`
    );
  }

  if (!chapter) {
    chapter = cover;
  }

  return { cover, chapter, content, kpi, ...hLayouts, all: layouts };
}

/**
 * Convertit des segments textuels enrichis (runs Markdown) en éléments DrawingML `<a:r>` et `<a:br>` OpenXML.
 * Préserve les styles typographiques : gras (`b="1"`), italique (`i="1"`), souligné (`u="sng"`),
 * barré (`strike="sngStrike"`), police à espacement fixe Consolas pour le code inline,
 * et sérialise fidèlement les sauts de ligne internes (`\n`) sous forme de balises `<a:br>` conformes ECMA-376.
 *
 * @function formatRunsToXml
 * @param {Array<{text: string, format: {bold?: boolean, italic?: boolean, underline?: boolean, strike?: boolean, code?: boolean}}>} runs - Segments textuels formatés
 * @returns {string} Fragments XML OpenXML DrawingML (`<a:r>` et `<a:br>`)
 */
function formatRunsToXml(runs) {
  if (!runs || runs.length === 0) return '';
  const out = [];
  for (const r of runs) {
    const bAttr = r.format?.bold ? ' b="1"' : '';
    const iAttr = r.format?.italic ? ' i="1"' : '';
    const uAttr = r.format?.underline ? ' u="sng"' : '';
    const sAttr = r.format?.strike ? ' strike="sngStrike"' : '';
    const codeFont = r.format?.code
      ? '<a:latin typeface="Consolas"/><a:cs typeface="Consolas"/>'
      : '';
    const rPr = `<a:rPr lang="fr-FR"${bAttr}${iAttr}${uAttr}${sAttr}>${codeFont}</a:rPr>`;

    const lines = String(r.text ?? '').split('\n');
    lines.forEach((line, idx) => {
      if (idx > 0) {
        out.push(`<a:br>${rPr}</a:br>`);
      }
      if (line.length > 0) {
        out.push(`<a:r>${rPr}<a:t>${escapeXml(line)}</a:t></a:r>`);
      }
    });
  }
  return out.join('');
}

/**
 * Construit l'élément XML `<p:graphicFrame>` DrawingML OpenXML encapsulant un tableau natif (`<a:tbl>`).
 *
 * @function buildTableGraphicFrame
 * @param {string[][]} rows - Matrice bidirectionnelle de chaînes représentant les cellules du tableau
 * @param {number} shapeId - Identifiant numérique unique de forme attribué à la frame dans la slide
 * @param {SlideLayoutBounds} bounds - Coordonnées (x, y) et dimensions (cx, cy) de la zone cible en EMU
 * @param {Object} [tableFormat={}] - Paramètres de style du tableau issus de la configuration
 * @returns {string} Fragment XML OpenXML DrawingML `<p:graphicFrame>`
 */
function buildTableGraphicFrame(rows, shapeId, bounds, tableFormat = {}) {
  if (!rows || rows.length === 0) return '';

  const colCount = rows[0].length || 1;
  const colW = Math.floor(parseInt(bounds.cx, 10) / colCount);
  const totalW = colW * colCount;

  const headerFill = tableFormat.headerFill || '003366';
  const headerColor = tableFormat.headerColor || 'FFFFFF';
  const rowFill = tableFormat.rowFill || 'FFFFFF';
  const rowAltFill = tableFormat.rowAltFill || 'F9F9F9';
  const borderColor = tableFormat.borderColor || 'CCCCCC';

  const gridColsXml = Array(colCount)
    .fill(0)
    .map(() => `<a:gridCol w="${colW}"/>`)
    .join('');

  const rowsXml = rows
    .map((row, ri) => {
      const isHeader = ri === 0;
      const fillHex = isHeader ? headerFill : ri % 2 === 0 ? rowFill : rowAltFill;
      const textHex = isHeader ? headerColor : '333333';
      const rowH = isHeader ? '420000' : '360000';

      const cellsXml = row
        .map((cellText) => {
          const runs = extractInlineStyles(cellText.replace(/<br\s*\/?>/gi, ' '));
          const formattedRuns = runs
            .map((r) => {
              const b = isHeader || r.format?.bold ? ' b="1"' : '';
              const it = r.format?.italic ? ' i="1"' : '';
              return `<a:r><a:rPr lang="fr-FR"${b}${it}><a:solidFill><a:srgbClr val="${textHex}"/></a:solidFill></a:rPr><a:t>${escapeXml(
                r.text
              )}</a:t></a:r>`;
            })
            .join('');

          return `
        <a:tc>
          <a:txBody>
            <a:bodyPr anchor="ctr" lIns="72000" rIns="72000" tIns="54000" bIns="54000"/>
            <a:lstStyle/>
            <a:p>
              <a:pPr algn="${isHeader ? 'ctr' : 'l'}"/>
              ${formattedRuns || `<a:r><a:rPr lang="fr-FR"/><a:t></a:t></a:r>`}
            </a:p>
          </a:txBody>
          <a:tcPr>
            <a:solidFill><a:srgbClr val="${fillHex}"/></a:solidFill>
            <a:lnL w="12700"><a:solidFill><a:srgbClr val="${borderColor}"/></a:solidFill></a:lnL>
            <a:lnR w="12700"><a:solidFill><a:srgbClr val="${borderColor}"/></a:solidFill></a:lnR>
            <a:lnT w="12700"><a:solidFill><a:srgbClr val="${borderColor}"/></a:solidFill></a:lnT>
            <a:lnB w="12700"><a:solidFill><a:srgbClr val="${borderColor}"/></a:solidFill></a:lnB>
          </a:tcPr>
        </a:tc>`;
        })
        .join('');

      return `<a:tr h="${rowH}">${cellsXml}</a:tr>`;
    })
    .join('');

  return `
    <p:graphicFrame>
      <p:nvGraphicFramePr>
        <p:cNvPr id="${shapeId}" name="Tableau ${shapeId}"/>
        <p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr>
        <p:nvPr/>
      </p:nvGraphicFramePr>
      <p:xfrm>
        <a:off x="${bounds.x}" y="${bounds.y}"/>
        <a:ext cx="${totalW}" cy="${rows.length * 380000}"/>
      </p:xfrm>
      <a:graphic>
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
          <a:tbl>
            <a:tblPr firstRow="1" bandRow="1"/>
            <a:tblGrid>
              ${gridColsXml}
            </a:tblGrid>
            ${rowsXml}
          </a:tbl>
        </a:graphicData>
      </a:graphic>
    </p:graphicFrame>`;
}

/**
 * Construit un conteneur d'image DrawingML `<p:pic>` pour insérer un schéma ou une illustration.
 *
 * @function buildPicGraphicFrame
 * @param {string} relId - Identifiant de la relation vers le média (ex: 'rIdImg_1')
 * @param {number} shapeId - Identifiant numérique unique de la forme
 * @param {SlideLayoutBounds} bounds - Boîte englobante ajustée (x, y, cx, cy)
 * @param {string} [name='Image'] - Nom affiché de l'image
 * @returns {string} Fragment XML OpenXML DrawingML `<p:pic>`
 */
function buildPicGraphicFrame(relId, shapeId, bounds, name = 'Image') {
  return `
    <p:pic>
      <p:nvPicPr>
        <p:cNvPr id="${shapeId}" name="${escapeXml(name)} ${shapeId}"/>
        <p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>
        <p:nvPr/>
      </p:nvPicPr>
      <p:blipFill>
        <a:blip r:embed="${relId}"/>
        <a:stretch><a:fillRect/></a:stretch>
      </p:blipFill>
      <p:spPr>
        <a:xfrm>
          <a:off x="${bounds.x}" y="${bounds.y}"/>
          <a:ext cx="${bounds.cx}" cy="${bounds.cy}"/>
        </a:xfrm>
        <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
      </p:spPr>
    </p:pic>`;
}

/**
 * Ajuste les dimensions d'une image dans une boîte cible en conservant son ratio d'aspect.
 *
 * @function fitBoundsToAspectRatio
 * @param {SlideLayoutBounds} targetBounds - Boîte maximale autorisée
 * @param {number} imgW - Largeur naturelle en pixels
 * @param {number} imgH - Hauteur naturelle en pixels
 * @returns {SlideLayoutBounds} Boîte recalculée et centrée
 */
function fitBoundsToAspectRatio(targetBounds, imgW, imgH) {
  const boxW = parseInt(targetBounds.cx, 10);
  const boxH = parseInt(targetBounds.cy, 10);
  const ratio = imgW > 0 && imgH > 0 ? imgW / imgH : 16 / 9;
  const boxRatio = boxW / boxH;

  let finalW = boxW;
  let finalH = boxH;

  if (ratio > boxRatio) {
    finalW = boxW;
    finalH = Math.round(boxW / ratio);
  } else {
    finalH = boxH;
    finalW = Math.round(boxH * ratio);
  }

  const finalX = parseInt(targetBounds.x, 10) + Math.round((boxW - finalW) / 2);
  const finalY = parseInt(targetBounds.y, 10) + Math.round((boxH - finalH) / 2);

  return {
    x: String(finalX),
    y: String(finalY),
    cx: String(finalW),
    cy: String(finalH),
  };
}

/**
 * Extrait le texte brut sans balisage d'un bloc AST pour l'injection dans les métadonnées de présentation.
 * Filtre les balises de structure ([colonne], [/colonne]) et concatène les segments de texte enrichi (runs).
 *
 * @function blockToPlainText
 * @param {object} block - Bloc AST (paragraph, list_item, etc.)
 * @returns {string} Texte brut extrait et nettoyé
 */
export function blockToPlainText(block) {
  if (!block) return '';
  const rawTrim = (block.raw || block.text || '').trim();
  if (
    /^\[\/?(?:col(?:onne)?|cols?onnes?)(?::[0-9.]+)?\]$/i.test(rawTrim) ||
    /^:::(?:col(?:onne)?|cols?onnes?)(?::[0-9.]+)?$/i.test(rawTrim)
  ) {
    return '';
  }
  if (typeof block.text === 'string' && block.text.trim()) {
    return block.text.trim();
  }
  if (Array.isArray(block.runs) && block.runs.length > 0) {
    return block.runs.map((r) => r.text || '').join('').trim();
  }
  if (typeof block.raw === 'string' && block.raw.trim()) {
    return block.raw.trim();
  }
  return '';
}

/**
 * Découpe et organise l'AST Markdown en diapositives structurées en fonction des masques OpenXML configurés.
 *
 * Logique de découpage unifiée :
 *  - Titre `#` (Niveau 1) : Déclenche une diapositive de couverture (`cover` ou `h1`).
 *  - Titre `##` (Niveau 2) : Déclenche une diapositive de chapitre (`chapter` ou `h2`).
 *  - Titre `###` (Niveau 3) : Crée une diapositive de contenu (`content` ou `h3`) et mémorise son titre.
 *  - Titres supérieurs à `###` (`####`..`######`) : N'entraînent aucun saut de diapositive et sont intégrés comme sous-sections dans la diapositive courante.
 *  - Séparateur horizontal (`---`) : Force la création d'une nouvelle diapositive en reprenant le titre du dernier `###` qui précède.
 *
 * @function segmentMarkdownToSlides
 * @param {string} mdText - Texte source Markdown brut
 * @param {string} docTitle - Titre principal du document
 * @param {SlidePrototypes} prototypes - Dictionnaire des prototypes de masques résolus
 * @param {Object<string, string>} [layoutsConfig={}] - Configuration de mappage des masques
 * @returns {Array<SlideItem>} Liste ordonnée des diapositives prêtes pour la compilation OpenXML
 */
export function segmentMarkdownToSlides(mdText, docTitle, prototypes, layoutsConfig = {}) {
  const ast = parseToAST(mdText);
  const slides = [];

  let globalTitle = docTitle || 'Présentation';
  let currentSection = null;
  let lastH3Title = null;
  let currentSlide = null;

  const flushSlide = () => {
    if (
      currentSlide &&
      (currentSlide.items.length > 0 ||
        currentSlide.table ||
        currentSlide.images?.length > 0 ||
        currentSlide.mermaids?.length > 0 ||
        currentSlide.isExplicit)
    ) {
      slides.push(currentSlide);
      currentSlide = null;
    }
  };

  for (let i = 0; i < ast.length; i++) {
    const block = ast[i];

    if (block.type === 'header') {
      if (block.level === 1) {
        // Règle 1 : Titre # déclenche un slide de couverture
        if (currentSlide && !currentSlide.items.length && !currentSlide.table && !currentSlide.images?.length && !currentSlide.mermaids?.length) {
          currentSlide = null;
        } else {
          flushSlide();
        }

        globalTitle = block.text;
        lastH3Title = null;

        const coverSlide = {
          type: 'cover',
          proto: prototypes.h1 || prototypes.cover,
          title: block.text,
          metadata: '',
          items: [],
        };

        const metaTexts = [];
        let j = i + 1;
        while (j < ast.length && ast[j].type !== 'header' && ast[j].type !== 'separator') {
          if (ast[j].type === 'paragraph' || ast[j].type === 'list_item') {
            const lineText = blockToPlainText(ast[j]);
            if (lineText) metaTexts.push(lineText);
          }
          j++;
        }
        if (metaTexts.length > 0) {
          coverSlide.metadata = metaTexts.join('  •  ');
          i = j - 1;
        }

        slides.push(coverSlide);
        currentSlide = null;
        continue;
      }

      if (block.level === 2) {
        // Règle 2 : Titre ## déclenche un slide de chapitre
        if (currentSlide && !currentSlide.items.length && !currentSlide.table && !currentSlide.images?.length && !currentSlide.mermaids?.length) {
          currentSlide = null;
        } else {
          flushSlide();
        }

        currentSection = block.text;
        lastH3Title = null;

        slides.push({
          type: 'chapter',
          proto: prototypes.h2 || prototypes.chapter,
          title: block.text,
          section: block.text,
          items: [],
        });
        currentSlide = null;
        continue;
      }

      if (block.level === 3) {
        // Règle 3 : Titre ### crée un slide de contenu
        if (currentSlide && !currentSlide.items.length && !currentSlide.table && !currentSlide.images?.length && !currentSlide.mermaids?.length) {
          currentSlide = null;
        } else {
          flushSlide();
        }

        lastH3Title = block.text;

        currentSlide = {
          type: 'content',
          proto: prototypes.h3 || prototypes.content,
          section: currentSection || globalTitle,
          title: block.text,
          items: [],
        };
        continue;
      }

      // Règle 4 : Les titres supérieurs à ### ne créent pas de nouveaux slides
      if (!currentSlide) {
        const fallbackTitle = lastH3Title || currentSection || globalTitle || 'Contenu';
        currentSlide = {
          type: 'content',
          proto: prototypes.content,
          section: currentSection || globalTitle,
          title: fallbackTitle,
          items: [],
        };
      }
      currentSlide.items.push({
        type: 'header',
        level: block.level,
        text: block.text,
        runs: block.runs || [{ text: block.text, format: { bold: true } }],
      });
      currentSlide.isExplicit = false;
      continue;
    }

    if (block.type === 'separator') {
      // Règle 5 : Saut de slide avec --- reprenant le titre du ### qui précède
      flushSlide();
      const nextTitle = lastH3Title || currentSection || globalTitle || 'Contenu';
      currentSlide = {
        type: 'content',
        proto: prototypes.content,
        section: currentSection || globalTitle,
        title: nextTitle,
        items: [],
        isExplicit: true,
      };
      continue;
    }

    if (!currentSlide) {
      const fallbackTitle = lastH3Title || currentSection || globalTitle || 'Contenu';
      currentSlide = {
        type: 'content',
        proto: prototypes.content,
        section: currentSection || globalTitle,
        title: fallbackTitle,
        items: [],
      };
    }

    if (block.type === 'table') {
      currentSlide.table = block.rows;
      currentSlide.isExplicit = false;
    } else if (block.type === 'image') {
      if (!currentSlide.images) currentSlide.images = [];
      currentSlide.images.push(block);
      currentSlide.isExplicit = false;
    } else if (block.type === 'mermaid') {
      if (!currentSlide.mermaids) currentSlide.mermaids = [];
      currentSlide.mermaids.push(block);
      currentSlide.isExplicit = false;
    } else if (block.type === 'list_item') {
      currentSlide.items.push({
        type: 'list_item',
        level: block.level || 0,
        text: block.text,
        runs: block.runs || [{ text: block.text }],
      });
      currentSlide.isExplicit = false;
    } else if (block.type === 'paragraph') {
      const rawTrim = (block.raw || block.text || '').trim();
      // Filtrer les balises structurelles de colonnes ([colonne], [/colonne], etc.)
      // afin qu'elles ne soient pas injectées sous forme de texte brut dans la diapositive PowerPoint
      if (/^\[\/?(?:col(?:onne)?|cols?onnes?)(?::[0-9.]+)?\]$/i.test(rawTrim) || /^:::(?:col(?:onne)?|cols?onnes?)(?::[0-9.]+)?$/i.test(rawTrim)) {
        continue;
      }
      currentSlide.items.push({
        type: 'paragraph',
        text: block.text,
        runs: block.runs || [{ text: block.text }],
      });
      currentSlide.isExplicit = false;
    }
  }

  flushSlide();
  return slides;
}

/**
 * Orchestre la génération complète d'une présentation PowerPoint (.pptx) à partir d'un modèle OpenXML (.potx).
 *
 * Étapes de compilation :
 *  1. Analyse des masques de disposition (slideLayouts) selon la configuration stricte de `output_config.json`.
 *  2. Résolution des images locales et schémas Mermaid rasterisés en PNG.
 *  3. Segmentation et pagination du contenu Markdown en diapositives structurées.
 *  4. Purge des diapositives résiduelles présentes dans le modèle .potx d'origine.
 *  5. Matérialisation de chaque diapositive (`ppt/slides/slideN.xml`) avec injection des formes de titre (`title` ou `ctrTitle`),
 *     des métadonnées, des paragraphes/puces, des tableaux DrawingML (`<a:tbl>`), et des images/schémas (`<p:pic>`).
 *  6. Mise à jour du catalogue de présentation (`ppt/presentation.xml` - balise `<p:sldIdLst>`).
 *  7. Ré-indexation des relations de diapositives (`ppt/_rels/presentation.xml.rels`).
 *  8. Adaptation des déclarations de types MIME dans `[Content_Types].xml` (conversion de potx en pptx).
 *  9. Compression ZIP DEFLATE finale et production d'un Blob binaire.
 *
 * @async
 * @function generatePresentationFromTemplate
 * @param {string} mdText - Texte source Markdown complet
 * @param {string} docTitle - Titre par défaut de la présentation
 * @param {ArrayBuffer} templateBuffer - Données binaires du gabarit .potx d'entreprise
 * @param {Object} [config={}] - Configuration complète issue de output_config.json
 * @param {function(string): void|null} [onProgress=null] - Callback de notification de progression
 * @param {Object} [options={}] - Options complémentaires (localImages, etc.)
 * @returns {Promise<Blob>} Blob binaire du fichier .pptx prêt au téléchargement
 * @throws {Error} Si la bibliothèque JSZip n'est pas chargée dans le contexte global
 * @throws {Error} Si aucun modèle .potx valide n'est fourni
 */
export async function generatePresentationFromTemplate(
  mdText,
  docTitle,
  templateBuffer,
  config = {},
  onProgress = null,
  options = {}
) {
  const log = (msg) => {
    if (typeof onProgress === 'function') onProgress(msg);
  };

  if (!window.JSZip) {
    throw new Error('La bibliothèque JSZip est requise pour la génération PowerPoint OpenXML.');
  }
  if (!templateBuffer) {
    throw new Error("Aucun modèle PowerPoint (.potx) n'a été fourni.");
  }

  log('Lecture et décompression du modèle .potx...');
  const zip = await window.JSZip.loadAsync(templateBuffer);
  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  // 1. Analyse et association stricte des masques selon output_config.json
  log('Analyse des masques de disposition OpenXML...');
  const layoutsConfig = getLayoutsConfig(config);
  const prototypes = await detectSlidePrototypes(zip, parser, layoutsConfig);

  // 2. Normalisation et résolution des images cartouches
  log('Préparation et résolution du contenu Markdown...');
  const localImages = options.localImages || {};
  const resolvedMd = resolveImagePaths(mdText || '', localImages);
  const cleanMd = normalizeMarkdown(resolvedMd);

  // 3. Segmentation du Markdown en diapositives selon les niveaux de titre
  log('Analyse et découpage du contenu Markdown...');
  const targetSlides = segmentMarkdownToSlides(cleanMd, docTitle, prototypes, layoutsConfig);
  log(`${targetSlides.length} diapositives à générer.`);

  // 4. Suppression des anciennes diapositives résiduelles du modèle
  Object.keys(zip.files)
    .filter((k) => /^ppt\/slides\//.test(k))
    .forEach((k) => zip.remove(k));

  const pw = config.powerpoint || config.pptConfig?.powerpoint;
  const tpl = pw?.templates?.find((t) => t.id === (pw.default || 'standard')) || pw?.templates?.[0];
  const tableFormat = tpl?.tableFormat || config.templates?.[0]?.tableFormat || config.tableFormat || {};

  let globalMediaCounter = 1;

  // 5. Génération de chaque diapositive
  for (let i = 0; i < targetSlides.length; i++) {
    await yieldToMain();
    const slideIndex = i + 1;
    const slideItem = targetSlides[i];
    const layout = slideItem.proto;

    log(`Création de la diapositive ${slideIndex}/${targetSlides.length} : ${slideItem.title || slideItem.type}`);

    // Relations de la slide (vers son slideLayout et les éventuelles images)
    const relationships = [
      {
        id: 'rId1',
        type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout',
        target: `../slideLayouts/slideLayout${layout.num}.xml`,
      },
    ];

    let spTreeShapes = '';
    let shapeId = 2;

    const titleType =
      layout.titleType ||
      (slideItem.type === 'cover' || slideItem.type === 'chapter' ? 'ctrTitle' : 'title');

    if (slideItem.type === 'cover') {
      // Titre de couverture
      spTreeShapes += `
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${shapeId++}" name="Titre de couverture"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph type="${titleType}"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="fr-FR"/>
              <a:t>${escapeXml(slideItem.title)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>`;

      // Métadonnées (Date, auteur, sous-titre)
      const dateStr = new Date().toLocaleDateString('fr-FR');
      const metaText = slideItem.metadata ? `${slideItem.metadata}   |   ${dateStr}` : `Date : ${dateStr}`;

      spTreeShapes += `
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${shapeId++}" name="Métadonnées"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="782488" y="3900000"/><a:ext cx="6500000" cy="1200000"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:noFill/>
        </p:spPr>
        <p:txBody>
          <a:bodyPr anchor="t"/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="fr-FR" sz="1200" b="0"><a:solidFill><a:srgbClr val="666666"/></a:solidFill></a:rPr>
              <a:t>${escapeXml(metaText)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>`;
    } else if (slideItem.type === 'chapter') {
      // Intercalaire de chapitre
      spTreeShapes += `
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${shapeId++}" name="Titre de chapitre"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph type="${titleType}"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="fr-FR"/>
              <a:t>${escapeXml(slideItem.title)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>`;
    } else {
      // Diapositive de contenu standard
      const slideTitle = slideItem.title || slideItem.section || 'Contenu';

      spTreeShapes += `
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${shapeId++}" name="Titre de contenu"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph type="${titleType}"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="fr-FR"/>
              <a:t>${escapeXml(slideTitle)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>`;

      if (slideItem.table) {
        // Rendu du tableau Markdown en <a:tbl>
        const bounds = layout.bodyBounds || {
          x: '735013',
          y: '1144588',
          cx: '10937875',
          cy: '5137150',
        };
        spTreeShapes += buildTableGraphicFrame(slideItem.table, shapeId++, bounds, tableFormat);
      } else if (slideItem.images?.length > 0 || slideItem.mermaids?.length > 0) {
        // Rendu des images ou schémas Mermaid
        const bb = layout.bodyBounds || {
          x: '735013',
          y: '1144588',
          cx: '10937875',
          cy: '5137150',
        };

        // Images standard
        if (slideItem.images?.length > 0) {
          for (const img of slideItem.images) {
            try {
              let imgSrc = img.src;
              if (localImages[imgSrc]) imgSrc = localImages[imgSrc];
              const compatSrc = await ensureOfficeCompatibleImage(imgSrc);
              const commaIdx = compatSrc.indexOf('base64,');
              if (commaIdx !== -1) {
                const rawBase64 = compatSrc.slice(commaIdx + 7);
                const mediaFileName = `image_${globalMediaCounter++}.png`;
                zip.file(`ppt/media/${mediaFileName}`, rawBase64, { base64: true });

                const relId = `rIdImg_${relationships.length + 1}`;
                relationships.push({
                  id: relId,
                  type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
                  target: `../media/${mediaFileName}`,
                });

                const dims = await getImageDimensions(compatSrc, 800, 500);
                const fittedBounds = fitBoundsToAspectRatio(bb, dims.width, dims.height);
                spTreeShapes += buildPicGraphicFrame(relId, shapeId++, fittedBounds, img.alt || 'Image');
              }
            } catch (err) {
              console.warn(`[PptxTemplateEngine] Impossible d'insérer l'image :`, err);
            }
          }
        }

        // Schémas Mermaid
        if (slideItem.mermaids?.length > 0) {
          for (const m of slideItem.mermaids) {
            try {
              const pngDataUrl = await renderMermaidToPngDataUrl(m.code);
              if (pngDataUrl) {
                const commaIdx = pngDataUrl.indexOf('base64,');
                const rawBase64 = commaIdx !== -1 ? pngDataUrl.slice(commaIdx + 7) : pngDataUrl;
                const mediaFileName = `mermaid_${globalMediaCounter++}.png`;
                zip.file(`ppt/media/${mediaFileName}`, rawBase64, { base64: true });

                const relId = `rIdImg_${relationships.length + 1}`;
                relationships.push({
                  id: relId,
                  type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
                  target: `../media/${mediaFileName}`,
                });

                const dims = await getImageDimensions(pngDataUrl, 900, 520);
                const fittedBounds = fitBoundsToAspectRatio(bb, dims.width, dims.height);
                spTreeShapes += buildPicGraphicFrame(relId, shapeId++, fittedBounds, 'Schéma Mermaid');
              }
            } catch (err) {
              console.warn(`[PptxTemplateEngine] Erreur de rastérisation Mermaid :`, err);
            }
          }
        }
      } else {
        // Rendu des paragraphes et listes à puces
        const paragraphsXml = slideItem.items
          .map((it) => {
            if (it.type === 'list_item') {
              const lvl = Math.min(it.level || 0, 4);
              return `
          <a:p>
            <a:pPr lvl="${lvl}"/>
            ${formatRunsToXml(it.runs)}
          </a:p>`;
            } else {
              return `
          <a:p>
            <a:pPr marL="0" indent="0"><a:buNone/></a:pPr>
            ${formatRunsToXml(it.runs)}
          </a:p>`;
            }
          })
          .join('');

        const bodyPhXml =
          layout.bodyType === 'obj'
            ? `<p:ph idx="${layout.bodyIdx || '1'}"/>`
            : layout.bodyIdx
            ? `<p:ph type="body" idx="${layout.bodyIdx}"/>`
            : `<p:ph type="body"/>`;

        spTreeShapes += `
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${shapeId++}" name="Contenu"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr>${bodyPhXml}</p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          ${paragraphsXml || `<a:p><a:r><a:rPr lang="fr-FR"/><a:t></a:t></a:r></a:p>`}
        </p:txBody>
      </p:sp>`;
      }
    }

    const relsEntriesXml = relationships
      .map((rel) => `<Relationship Id="${rel.id}" Type="${rel.type}" Target="${rel.target}"/>`)
      .join('\n  ');

    const relsXmlStr = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${relsEntriesXml}
</Relationships>`;

    const slideXmlStr = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      ${spTreeShapes}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr>
    <a:masterClrMapping/>
  </p:clrMapOvr>
</p:sld>`;

    zip.file(`ppt/slides/slide${slideIndex}.xml`, slideXmlStr.replace(/\s*xmlns=""/g, ''));
    zip.file(`ppt/slides/_rels/slide${slideIndex}.xml.rels`, relsXmlStr.replace(/\s*xmlns=""/g, ''));
  }

  // 6. Mise à jour de ppt/presentation.xml (<p:sldIdLst>)
  log("Finalisation de l'arborescence de présentation...");
  const presXmlStr = await zip.file('ppt/presentation.xml').async('string');
  const presDoc = parser.parseFromString(presXmlStr, 'text/xml');
  let sldIdLst = presDoc.getElementsByTagName('p:sldIdLst')[0];

  if (!sldIdLst) {
    sldIdLst = presDoc.createElementNS(
      'http://schemas.openxmlformats.org/presentationml/2006/main',
      'p:sldIdLst'
    );
    const sldSz = presDoc.getElementsByTagName('p:sldSz')[0];
    if (sldSz && sldSz.parentNode) {
      sldSz.parentNode.insertBefore(sldIdLst, sldSz);
    } else {
      presDoc.documentElement.appendChild(sldIdLst);
    }
  } else {
    while (sldIdLst.firstChild) sldIdLst.removeChild(sldIdLst.firstChild);
  }

  for (let i = 0; i < targetSlides.length; i++) {
    const sldIdNode = presDoc.createElementNS(
      'http://schemas.openxmlformats.org/presentationml/2006/main',
      'p:sldId'
    );
    sldIdNode.setAttribute('id', String(256 + i));
    sldIdNode.setAttribute('r:id', `rIdSlide_${i + 1}`);
    sldIdLst.appendChild(sldIdNode);
  }

  let serializedPres = serializer.serializeToString(presDoc);
  serializedPres = serializedPres.replace(/\s*xmlns=""/g, '');
  // Nettoyer les sections orphelines du template .potx
  serializedPres = serializedPres.replace(
    /<p:ext uri="\{521415D9-36F7-43E2-AB2F-B90AF26B5E84\}">[\s\S]*?<\/p:ext>/g,
    ''
  );
  zip.file('ppt/presentation.xml', serializedPres);

  // 7. Mise à jour de ppt/_rels/presentation.xml.rels
  const presRelsStr = await zip.file('ppt/_rels/presentation.xml.rels').async('string');
  const presRelsDoc = parser.parseFromString(presRelsStr, 'text/xml');
  const presRelsRoot = presRelsDoc.getElementsByTagName('Relationships')[0];

  const existingRels = Array.from(presRelsRoot.getElementsByTagName('Relationship'));
  existingRels.forEach((rel) => {
    const type = rel.getAttribute('Type') || '';
    if (type.endsWith('/slide')) presRelsRoot.removeChild(rel);
  });

  for (let i = 0; i < targetSlides.length; i++) {
    const relNode = presRelsDoc.createElementNS(
      'http://schemas.openxmlformats.org/package/2006/relationships',
      'Relationship'
    );
    relNode.setAttribute('Id', `rIdSlide_${i + 1}`);
    relNode.setAttribute(
      'Type',
      'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide'
    );
    relNode.setAttribute('Target', `slides/slide${i + 1}.xml`);
    presRelsRoot.appendChild(relNode);
  }

  let serializedPresRels = serializer.serializeToString(presRelsDoc);
  serializedPresRels = serializedPresRels.replace(/\s*xmlns=""/g, '');
  zip.file('ppt/_rels/presentation.xml.rels', serializedPresRels);

  // 8. Mise à jour de [Content_Types].xml
  const contentTypesStr = await zip.file('[Content_Types].xml').async('string');
  const contentTypesDoc = parser.parseFromString(contentTypesStr, 'text/xml');
  const typesRoot = contentTypesDoc.getElementsByTagName('Types')[0];

  // Convertir le type MIME de modèle (.potx) vers présentation (.pptx)
  const presOverrides = Array.from(typesRoot.getElementsByTagName('Override'));
  presOverrides.forEach((ov) => {
    const partName = ov.getAttribute('PartName') || '';
    if (partName === '/ppt/presentation.xml') {
      ov.setAttribute(
        'ContentType',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml'
      );
    }
  });

  // Nettoyage des anciens overrides de slides
  const existingSlideOverrides = Array.from(typesRoot.getElementsByTagName('Override'));
  existingSlideOverrides.forEach((ov) => {
    const partName = ov.getAttribute('PartName') || '';
    if (/^\/ppt\/slides\/slide\d+\.xml$/.test(partName)) typesRoot.removeChild(ov);
  });

  // Ajout des overrides pour chaque nouvelle slide
  for (let i = 0; i < targetSlides.length; i++) {
    const ovNode = contentTypesDoc.createElementNS(
      'http://schemas.openxmlformats.org/package/2006/content-types',
      'Override'
    );
    ovNode.setAttribute('PartName', `/ppt/slides/slide${i + 1}.xml`);
    ovNode.setAttribute('ContentType', 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml');
    typesRoot.appendChild(ovNode);
  }

  // Déclaration des extensions graphiques par défaut (PNG, JPG)
  const existingDefaults = Array.from(typesRoot.getElementsByTagName('Default'));
  const hasPngDefault = existingDefaults.some(
    (d) => d.getAttribute('Extension')?.toLowerCase() === 'png'
  );
  if (!hasPngDefault) {
    const pngDefault = contentTypesDoc.createElementNS(
      'http://schemas.openxmlformats.org/package/2006/content-types',
      'Default'
    );
    pngDefault.setAttribute('Extension', 'png');
    pngDefault.setAttribute('ContentType', 'image/png');
    typesRoot.appendChild(pngDefault);
  }

  const hasJpgDefault = existingDefaults.some(
    (d) =>
      d.getAttribute('Extension')?.toLowerCase() === 'jpeg' ||
      d.getAttribute('Extension')?.toLowerCase() === 'jpg'
  );
  if (!hasJpgDefault) {
    const jpgDefault = contentTypesDoc.createElementNS(
      'http://schemas.openxmlformats.org/package/2006/content-types',
      'Default'
    );
    jpgDefault.setAttribute('Extension', 'jpeg');
    jpgDefault.setAttribute('ContentType', 'image/jpeg');
    typesRoot.appendChild(jpgDefault);
  }

  let serializedContentTypes = serializer.serializeToString(contentTypesDoc);
  serializedContentTypes = serializedContentTypes.replace(/\s*xmlns=""/g, '');
  zip.file('[Content_Types].xml', serializedContentTypes);

  // 9. Recompression ZIP finale
  log('Compression finale du livrable PowerPoint...');
  await yieldToMain();
  const finalBlob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return finalBlob;
}
