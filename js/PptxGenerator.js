/**
 * PptxGenerator.js — Génération PowerPoint (.pptx) depuis un AST Markdown
 */
import { yieldToMain, resolveImagePaths, normalizeMarkdown } from './utils.js';
import { drawMasterElements, parseMarkdownToSlide } from './PptxSlideBuilders.js';

/**
 * Génère un Blob PPTX à partir du contenu Markdown.
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

  let template = pptConfig?.templates?.find((t) => t.id === templateId);
  if (!template) template = pptConfig?.templates?.[0];
  if (!template) {
    template = {
      name: 'Fallback',
      theme: {
        primary: '003366',
        secondary: 'c43e1c',
        text: '333333',
        background: 'FFFFFF',
        surface: 'F7F7F7',
      },
      fonts: { title: 'Arial', body: 'Arial' },
      masters: {
        TITRE: { elements: [] },
        CHAPITRE: { elements: [] },
        SLIDE: { elements: [], contentArea: { x: 0.5, y: 1.0, w: 9.0, h: 4.5 } },
      },
    };
  }

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
  const findMaster = (keys, terms) => {
    let found = keys.find((k) => k === terms[0]);
    if (!found) found = keys.find((k) => terms.some((t) => k.includes(t)));
    return found;
  };

  let titleMasterKey = findMaster(masterKeys, ['TITLE_SLIDE', 'TITRE']);
  if (!titleMasterKey && masterKeys.length > 0) titleMasterKey = masterKeys[0];
  const titleMaster = template.masters?.[titleMasterKey];

  onProgress?.('Création de la diapositive de couverture...');
  const slideTitle = pptx.addSlide();
  if (titleMaster) {
    if (titleMaster.background?.color) {
      slideTitle.background = { color: titleMaster.background.color };
    }
    drawMasterElements(
      pptx,
      slideTitle,
      titleMaster.elements,
      {
        TITLE: docTitle,
        TITRE: docTitle,
        title: docTitle,
        titre: docTitle,
        DATE: new Date().toLocaleDateString('fr-FR'),
      },
      template
    );
  } else {
    slideTitle.addText(docTitle, {
      x: 0.8,
      y: 2.2,
      w: 8.4,
      h: 1.2,
      fontSize: 32,
      bold: true,
      color: '003366',
    });
  }

  const chapterMasterKey = findMaster(masterKeys, ['CHAPITRE', 'CHAPTER', 'SECTION']);
  let slideMasterKey = findMaster(masterKeys, ['SLIDE', 'CONTENT_SLIDE', 'CONTENU']);
  if (!slideMasterKey && masterKeys.length > 1) slideMasterKey = masterKeys[1];
  const chapterMaster = chapterMasterKey ? template.masters[chapterMasterKey] : null;
  const slideMaster = slideMasterKey ? template.masters[slideMasterKey] : null;

  const sections = splitMdBySections(cleanMd);

  for (let sIdx = 0; sIdx < sections.length; sIdx++) {
    await yieldToMain();
    const section = sections[sIdx];
    onProgress?.(`Section ${sIdx + 1}/${sections.length} : ${section.title}`);

    if (chapterMaster) {
      const chapSlide = pptx.addSlide();
      if (chapterMaster.background?.color) {
        chapSlide.background = { color: chapterMaster.background.color };
      }
      drawMasterElements(
        pptx,
        chapSlide,
        chapterMaster.elements,
        {
          chapter: section.title,
          chapitre: section.title,
          TITLE: section.title,
          DATE: new Date().toLocaleDateString('fr-FR'),
        },
        template
      );
    }

    const area = slideMaster?.contentArea || { x: 0.5, y: 1.0, w: 9.0, h: 4.5 };
    const createBlockSlide = (customTitle, type = 'content') => {
      const slideT = customTitle || section.title;
      const slide = pptx.addSlide();
      const masterToUse = type === 'chapter' ? chapterMaster : slideMaster;
      if (masterToUse) {
        if (masterToUse.background?.color) {
          slide.background = { color: masterToUse.background.color };
        }
        drawMasterElements(
          pptx,
          slide,
          masterToUse.elements,
          {
            title: slideT,
            chapter: slideT,
            chapitre: slideT,
            TITLE: slideT,
            SLIDE_NUMBER: (sIdx + 1).toString(),
            DATE: new Date().toLocaleDateString('fr-FR'),
          },
          template
        );
      } else {
        slide.addText(slideT, {
          x: 0.5,
          y: 0.5,
          fontSize: type === 'chapter' ? 24 : 18,
          bold: true,
          color: '363636',
        });
      }
      return slide;
    };

    parseMarkdownToSlide(
      createBlockSlide,
      section.content,
      area,
      template,
      tableFormat,
      section.title
    );
  }

  await yieldToMain();
  onProgress?.('Génération du fichier PowerPoint...');
  return await pptx.write({ outputType: 'blob' });
}

/**
 * Sépare le texte Markdown en sections basées sur les titres de niveau 2 (##).
 * @param {string} mdText - Texte Markdown normalisé
 * @returns {Array<{ title: string, content: string }>}
 */
function splitMdBySections(mdText) {
  const lines = mdText.split('\n');
  const sections = [];
  let currentSection = null;
  let globalTitle = null;

  for (const line of lines) {
    const h1Match = line.match(/^#\s+(.+)$/);
    const h2Match = line.match(/^##\s+(.+)$/);

    if (h1Match && !globalTitle) {
      globalTitle = h1Match[1].trim();
      continue;
    }

    if (h2Match) {
      if (currentSection) sections.push(currentSection);
      currentSection = { title: h2Match[1].trim(), lines: [] };
      continue;
    }

    if (currentSection) {
      currentSection.lines.push(line);
    } else if (line.trim()) {
      currentSection = { title: globalTitle || 'Document', lines: [line] };
    }
  }

  if (currentSection) sections.push(currentSection);

  return sections.map((s) => ({ title: s.title, content: s.lines.join('\n') }));
}
