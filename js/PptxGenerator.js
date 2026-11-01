/**
 * PptxGenerator.js — Génération PowerPoint (.pptx) depuis un AST Markdown
 */
import { yieldToMain, resolveImagePaths, normalizeMarkdown } from './utils.js';
import { drawMasterElements, renderBlocksToPptxSlide } from './PptxSlideBuilders.js';
import {
  planSlides,
  findMaster,
  resolvePptTemplate,
  getEffectiveContentArea,
  splitMdBySections,
} from './SlidePlanner.js';

export { splitMdBySections };

/**
 * Génère un Blob PPTX à partir du contenu Markdown.
 * Utilise le planificateur unifié de diapositives (SlidePlanner) pour garantir
 * une pagination rigoureusement identique à l'affichage HTML en mode Slide.
 * @param {string} mdText - Texte Markdown brut
 * @param {string} docTitle - Titre du document
 * @param {object} pptConfig - Configuration PPTX (output_config.json)
 * @param {string} [templateId='default'] - ID du template à utiliser
 * @param {Record<string, string>} [localImages={}] - Dictionnaire d'images Base64
 * @param {function} [onProgress] - Callback de progression
 * @returns {Promise<Blob>}
 */
export async function generatePptx(
  mdText,
  docTitle,
  pptConfig,
  templateId = 'default',
  localImages = {},
  onProgress
) {
  if (!window.PptxGenJS) {
    throw new Error("La bibliothèque PptxGenJS n'est pas chargée.");
  }

  onProgress?.('Préparation et normalisation du Markdown...');
  const resolvedMd = resolveImagePaths(mdText || '', localImages);
  const cleanMd = normalizeMarkdown(resolvedMd);

  const template = resolvePptTemplate(pptConfig, templateId);
  const tableFormat = template.tableFormat || pptConfig?.tableFormat || {};

  const pptx = new window.PptxGenJS();
  pptx.author = 'md2print';
  pptx.company = 'md2print';
  pptx.title = docTitle;

  if (template.layout) {
    pptx.defineLayout({
      name: template.layout.name || 'customLayout',
      width: template.layout.width,
      height: template.layout.height,
    });
    pptx.layout = template.layout.name || 'customLayout';
  } else {
    pptx.layout = 'LAYOUT_16x9';
  }

  const masterKeys = Object.keys(template.masters || {});
  let titleMasterKey = findMaster(masterKeys, ['TITLE_SLIDE', 'TITRE']);
  if (!titleMasterKey && masterKeys.length > 0) titleMasterKey = masterKeys[0];
  const titleMaster = template.masters?.[titleMasterKey];

  const chapterMasterKey = findMaster(masterKeys, ['CHAPITRE', 'CHAPTER', 'SECTION']);
  let slideMasterKey = findMaster(masterKeys, ['SLIDE', 'CONTENT_SLIDE', 'CONTENU']);
  if (!slideMasterKey && masterKeys.length > 1) slideMasterKey = masterKeys[1];
  const chapterMaster = chapterMasterKey ? template.masters[chapterMasterKey] : null;
  const slideMaster = slideMasterKey ? template.masters[slideMasterKey] : null;

  const area = getEffectiveContentArea(template);

  onProgress?.('Planification unifiée des diapositives...');
  const plannedSlides = planSlides(cleanMd, docTitle, {
    template,
    pptConfig,
    templateId,
  });

  for (let idx = 0; idx < plannedSlides.length; idx++) {
    await yieldToMain();
    const plannedSlide = plannedSlides[idx];
    onProgress?.(`Diapositive ${idx + 1}/${plannedSlides.length} : ${plannedSlide.title}`);

    if (plannedSlide.type === 'title') {
      const slide = pptx.addSlide();
      if (titleMaster?.background?.color) {
        slide.background = { color: titleMaster.background.color };
      }
      if (titleMaster) {
        drawMasterElements(
          pptx,
          slide,
          titleMaster.elements,
          {
            TITLE: docTitle,
            TITRE: docTitle,
            title: docTitle,
            titre: docTitle,
            DATE: plannedSlide.date,
          },
          template
        );
      } else {
        slide.addText(docTitle, {
          x: 0.8,
          y: 2.2,
          w: 8.4,
          h: 1.2,
          fontSize: 32,
          bold: true,
          color: template.theme?.primary || '003366',
        });
      }
    } else if (plannedSlide.type === 'chapter') {
      const slide = pptx.addSlide();
      if (chapterMaster?.background?.color) {
        slide.background = { color: chapterMaster.background.color };
      }
      if (chapterMaster) {
        drawMasterElements(
          pptx,
          slide,
          chapterMaster.elements,
          {
            chapter: plannedSlide.title,
            chapitre: plannedSlide.title,
            TITLE: plannedSlide.title,
            DATE: plannedSlide.date,
          },
          template
        );
      } else {
        slide.addText(plannedSlide.title, {
          x: 0.8,
          y: 2.2,
          w: 8.4,
          h: 1.2,
          fontSize: 28,
          bold: true,
          color: template.theme?.primary || '003366',
        });
      }
    } else if (plannedSlide.type === 'content') {
      const slide = pptx.addSlide();
      if (slideMaster?.background?.color) {
        slide.background = { color: slideMaster.background.color };
      }
      if (slideMaster) {
        drawMasterElements(
          pptx,
          slide,
          slideMaster.elements,
          {
            title: plannedSlide.title,
            chapter: plannedSlide.chapter || plannedSlide.title,
            chapitre: plannedSlide.chapter || plannedSlide.title,
            TITLE: plannedSlide.title,
            SLIDE_NUMBER: plannedSlide.slideNumber.toString(),
            DATE: plannedSlide.date,
          },
          template
        );
      } else {
        slide.addText(plannedSlide.title, {
          x: area.x,
          y: 0.5,
          fontSize: 18,
          bold: true,
          color: template.theme?.text || '363636',
        });
      }

      await renderBlocksToPptxSlide(
        pptx,
        slide,
        plannedSlide.blocks,
        area,
        template,
        tableFormat
      );
    }
  }

  await yieldToMain();
  onProgress?.('Génération du fichier PowerPoint...');
  return await pptx.write({ outputType: 'blob' });
}
