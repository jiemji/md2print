/**
 * SlidePlanner.js — Planificateur unifié de diapositives pour md2print.
 * Partage les règles exactes de découpage en diapositives (titre, inter-titres,
 * pagination par dépassement de hauteur) entre la sortie HTML et la sortie PPTX.
 */
import { parseToAST } from './MarkdownParser.js';
import {
  toSlug,
  normalizeMermaidCode,
  readSvgDiagramSize,
  fitDimensions,
} from './utils.js';

/**
 * Modèle de template par défaut si aucun fichier de configuration n'est fourni.
 */
export const DEFAULT_PPT_TEMPLATE = {
  name: 'Fallback',
  layout: { name: 'LAYOUT_16x9', width: 13.33, height: 7.5 },
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

/**
 * Recherche une clé de master par correspondance exacte ou partielle.
 * @param {string[]} [keys=[]]
 * @param {string[]} [terms=[]]
 * @returns {string|null} Clé trouvée ou null
 */
export function findMaster(keys = [], terms = []) {
  if (!keys?.length || !terms?.length) return null;
  let found = keys.find((k) => k === terms[0]);
  if (!found) found = keys.find((k) => terms.some((t) => k.includes(t)));
  return found || null;
}

/**
 * Résout le template PowerPoint actif à partir de la configuration.
 * @param {object} [pptConfig] - Configuration issue de output_config.json
 * @param {string} [templateId='default'] - Identifiant du template souhaité
 * @returns {object} Template résolu
 */
export function resolvePptTemplate(pptConfig, templateId = 'default') {
  let template = pptConfig?.templates?.find((t) => t.id === templateId);
  if (!template) template = pptConfig?.templates?.[0];
  if (!template) template = DEFAULT_PPT_TEMPLATE;
  return template;
}

/**
 * Calcule la zone de contenu effective pour éviter tout chevauchement avec le pied de page.
 * @param {object} template - Configuration du template PowerPoint
 * @returns {{ x: number, y: number, w: number, h: number }}
 */
export function getEffectiveContentArea(template) {
  const masterKeys = Object.keys(template?.masters || {});
  const slideMasterKey = findMaster(masterKeys, ['SLIDE', 'CONTENT_SLIDE', 'CONTENU']);
  const slideMaster = slideMasterKey ? template?.masters?.[slideMasterKey] : null;
  const rawArea = slideMaster?.contentArea || { x: 0.5, y: 1.0, w: 9.0, h: 4.5 };
  const layoutH = template?.layout?.height || 7.5;
  const maxAvailableH = Math.max(2.5, layoutH - rawArea.y - 0.55);
  const effectiveH = Math.min(rawArea.h, maxAvailableH);

  return {
    x: rawArea.x,
    y: rawArea.y,
    w: rawArea.w,
    h: effectiveH,
  };
}

/**
 * Sépare le texte Markdown en sections basées sur les titres de niveau 2 (##).
 * Préserve les blocs de code pour éviter les faux positifs.
 * @param {string} mdText - Texte Markdown normalisé
 * @returns {Array<{ title: string, content: string }>}
 */
export function splitMdBySections(mdText) {
  const lines = (mdText || '').split('\n');
  const sections = [];
  let currentSection = null;
  let globalTitle = null;
  let inCodeFence = false;

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      inCodeFence = !inCodeFence;
    }

    const h1Match = !inCodeFence ? line.match(/^#\s+(.+)$/) : null;
    const h2Match = !inCodeFence ? line.match(/^##\s+(.+)$/) : null;

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

/**
 * Reconstruit le texte Markdown d'un bloc AST.
 * Utilise la propriété `raw` d'origine en priorité, avec un fallback structuré.
 * @param {object} block - Bloc AST
 * @returns {string}
 */
export function blockToMarkdown(block) {
  if (!block) return '';
  if (typeof block.raw === 'string' && block.raw.trim()) {
    return block.raw.trim();
  }

  switch (block.type) {
    case 'header':
      return `${'#'.repeat(block.level || 2)} ${block.text || ''}`;
    case 'separator':
      return '---';
    case 'mermaid':
      return `\`\`\`mermaid\n${block.code || ''}\n\`\`\``;
    case 'image':
      return `![${block.alt || ''}](${block.src || ''})`;
    case 'table': {
      if (!block.rows || !block.rows.length) return '';
      const header = `| ${block.rows[0].join(' | ')} |`;
      const sep = `| ${block.rows[0].map(() => '---').join(' | ')} |`;
      const body = block.rows
        .slice(1)
        .map((r) => `| ${r.join(' | ')} |`)
        .join('\n');
      return [header, sep, body].filter(Boolean).join('\n');
    }
    case 'list_item': {
      const indent = '  '.repeat(block.level || 0);
      const prefix = block.listType === 'ordered' ? '1.' : '-';
      return `${indent}${prefix} ${block.text || ''}`;
    }
    case 'paragraph': {
      const text = block.runs?.map((r) => r.text).join('') || block.text || '';
      if (block.isCode) {
        return `\`\`\`\n${text}\n\`\`\``;
      }
      if (block.isQuote) {
        return `> ${text}`;
      }
      return text;
    }
    default:
      return block.text || '';
  }
}

/**
 * @typedef {object} PlannedSlide
 * @property {string} id - Identifiant unique (ex: 'slide-1')
 * @property {number} slideNumber - Numéro de diapositive (1-based)
 * @property {'title'|'chapter'|'content'} type - Type de diapositive
 * @property {string} title - Titre affiché
 * @property {string} chapter - Titre du chapitre parent
 * @property {string} date - Date formatée
 * @property {number} sectionIndex - Index de la section (0-based, -1 pour la couverture)
 * @property {number} slideIndex - Index global de la diapositive (0-based)
 * @property {string} slug - Slug pour l'ancrage et la synchronisation avec le sommaire
 * @property {Array<object>} blocks - Blocs AST alloués à cette diapositive
 * @property {string} markdown - Markdown reconstitué pour le rendu de la diapositive
 */

/**
 * Découpe un document Markdown en diapositives selon les règles strictes de PowerPoint.
 * Génère exactement la même séquence de diapositives pour la sortie HTML et PPTX.
 * @param {string} mdText - Texte Markdown normalisé
 * @param {string} [docTitle='Document'] - Titre du document
 * @param {object} [options={}] - Options de planification
 * @param {object} [options.pptConfig] - Configuration output_config.json
 * @param {string} [options.templateId='default'] - Identifiant du template
 * @param {object} [options.template] - Template résolu directement
 * @param {Record<string, string>} [options.mermaidSvgMap={}] - Dictionnaire des SVG Mermaid
 * @param {string} [options.date] - Date personnalisée
 * @returns {PlannedSlide[]} Liste des diapositives planifiées
 */
export function planSlides(mdText, docTitle = 'Document', options = {}) {
  const cleanMd = mdText || '';
  const template = options.template || resolvePptTemplate(options.pptConfig, options.templateId);
  const masterKeys = Object.keys(template?.masters || {});
  const chapterMasterKey = findMaster(masterKeys, ['CHAPITRE', 'CHAPTER', 'SECTION']);
  const hasChapterMaster = Boolean(chapterMasterKey);

  const area = getEffectiveContentArea(template);
  const contentW = area.w;
  const maxY = area.y + area.h;
  const formattedDate = options.date || new Date().toLocaleDateString('fr-FR');
  const resolvedTitle = docTitle || 'Document';

  /** @type {PlannedSlide[]} */
  const slides = [];

  // Diapositive 1 : Couverture / Titre
  slides.push({
    id: `slide-${slides.length + 1}`,
    slideNumber: slides.length + 1,
    type: 'title',
    title: resolvedTitle,
    chapter: '',
    date: formattedDate,
    sectionIndex: -1,
    slideIndex: 0,
    slug: toSlug(resolvedTitle) || 'title',
    blocks: [],
    markdown: '',
  });

  const sections = splitMdBySections(cleanMd);

  for (let sIdx = 0; sIdx < sections.length; sIdx++) {
    const section = sections[sIdx];

    // Diapositive d'inter-titre (Chapitre) si un master de chapitre est défini
    if (hasChapterMaster) {
      slides.push({
        id: `slide-${slides.length + 1}`,
        slideNumber: slides.length + 1,
        type: 'chapter',
        title: section.title,
        chapter: section.title,
        date: formattedDate,
        sectionIndex: sIdx,
        slideIndex: slides.length,
        slug: toSlug(section.title) || `section-${sIdx + 1}`,
        blocks: [],
        markdown: '',
      });
    }

    // Découpage du contenu de la section en diapositives avec gestion du dépassement
    const ast = parseToAST(section.content);
    let activeTitle = section.title;
    /** @type {PlannedSlide|null} */
    let currentSlide = null;
    let currentY = area.y;
    let textH = 0;

    const finalizeCurrentSlide = () => {
      if (currentSlide) {
        if (currentSlide.blocks.length > 0) {
          currentSlide.markdown = currentSlide.blocks.map(blockToMarkdown).join('\n\n').trim();
          slides.push(currentSlide);
        }
        currentSlide = null;
      }
    };

    const ensureContentSlide = (titleToUse = activeTitle) => {
      if (!currentSlide) {
        currentSlide = {
          id: `slide-${slides.length + 1}`,
          slideNumber: slides.length + 1,
          type: 'content',
          title: titleToUse,
          chapter: section.title,
          date: formattedDate,
          sectionIndex: sIdx,
          slideIndex: slides.length,
          slug: toSlug(titleToUse) || `slide-${slides.length + 1}`,
          blocks: [],
          markdown: '',
        };
      }
      return currentSlide;
    };

    for (const block of ast) {
      if (block.type === 'table') {
        currentY += textH;
        textH = 0;
        const tH = (block.rows?.length || 1) * 0.4 + 0.2;
        if (currentY + tH > maxY && currentY > area.y) {
          finalizeCurrentSlide();
          currentY = area.y;
        }
        ensureContentSlide().blocks.push(block);
        currentY += tH;
      } else if (block.type === 'mermaid') {
        currentY += textH;
        textH = 0;
        const remainingH = maxY - currentY;
        if (remainingH < 1.8 && currentY > area.y) {
          finalizeCurrentSlide();
          currentY = area.y;
        }
        const availH = Math.max(1.8, maxY - currentY - 0.15);
        let mH = 2.2;
        const normalizedCode = normalizeMermaidCode(block.code);
        const svgMarkup = options.mermaidSvgMap?.[normalizedCode];
        if (svgMarkup) {
          const dims = readSvgDiagramSize(svgMarkup);
          if (dims && dims.width > 0 && dims.height > 0) {
            const fit = fitDimensions(dims.width / 96, dims.height / 96, contentW, availH);
            mH = fit.height;
          }
        }
        ensureContentSlide().blocks.push(block);
        currentY += mH + 0.2;
      } else if (block.type === 'image') {
        currentY += textH;
        textH = 0;
        const imgH = 2.8;
        if (currentY + imgH > maxY && currentY > area.y) {
          finalizeCurrentSlide();
          currentY = area.y;
        }
        ensureContentSlide().blocks.push(block);
        currentY += imgH + 0.2;
      } else if (block.type === 'separator') {
        // Un séparateur "---" force la création d'une nouvelle diapositive pour le contenu qui suit
        currentY += textH;
        textH = 0;
        finalizeCurrentSlide();
        currentY = area.y;
        continue;
      } else if (block.type === 'header') {
        if (block.level === 1) {
          currentY += textH;
          textH = 0;
          finalizeCurrentSlide();
          activeTitle = block.text;
          slides.push({
            id: `slide-${slides.length + 1}`,
            slideNumber: slides.length + 1,
            type: 'chapter',
            title: activeTitle,
            chapter: activeTitle,
            date: formattedDate,
            sectionIndex: sIdx,
            slideIndex: slides.length,
            slug: toSlug(activeTitle) || `chapter-${slides.length + 1}`,
            blocks: [],
            markdown: '',
          });
          currentY = area.y;
          continue;
        }
        if (block.level === 2) {
          currentY += textH;
          textH = 0;
          activeTitle = block.text;
          if (currentSlide !== null || currentY > area.y) {
            finalizeCurrentSlide();
            currentY = area.y;
          }
          continue;
        }

        let h = 0.3;
        if (block.level === 3) h = 0.5;
        else if (block.level === 4) h = 0.4;
        else if (block.level >= 5) h = 0.35;

        if (currentY + textH + h > maxY && (currentY > area.y || textH > 0)) {
          currentY += textH;
          textH = 0;
          finalizeCurrentSlide();
          currentY = area.y;
        }
        ensureContentSlide().blocks.push(block);
        textH += h;
      } else if (block.type === 'list_item') {
        const totalLen =
          block.runs?.reduce((acc, r) => acc + (r.text?.length || 0), 0) ||
          block.text?.length ||
          0;
        const h = 0.3 * Math.max(Math.ceil(totalLen / (contentW * 12)), 1);
        if (currentY + textH + h > maxY && (currentY > area.y || textH > 0)) {
          currentY += textH;
          textH = 0;
          finalizeCurrentSlide();
          currentY = area.y;
        }
        ensureContentSlide().blocks.push(block);
        textH += h;
      } else if (block.type === 'paragraph') {
        const fullBlockText = block.runs
          ? block.runs.map((r) => r.text).join('')
          : block.text || '';
        const explicitLineCount = fullBlockText.split('\n').length;
        const wrappedLineCount = Math.ceil(fullBlockText.length / (contentW * 12));
        const h = 0.28 * Math.max(explicitLineCount, wrappedLineCount, 1);
        if (currentY + textH + h > maxY && (currentY > area.y || textH > 0)) {
          currentY += textH;
          textH = 0;
          finalizeCurrentSlide();
          currentY = area.y;
        }
        ensureContentSlide().blocks.push(block);
        textH += h;
      }
    }

    currentY += textH;
    textH = 0;
    finalizeCurrentSlide();
  }

  return slides;
}
