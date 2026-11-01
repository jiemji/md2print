/**
 * @module SlidePlanner
 * @description Planificateur unifié de diapositives pour md2print.
 * Partage les règles exactes de découpage en diapositives (titre, inter-titres,
 * séparateurs --- et pagination de contenu) entre la sortie HTML et la sortie PPTX.
 *
 * @requires ./MarkdownParser.js
 * @requires ./utils.js
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
 * Découpe un document Markdown en diapositives selon les règles unifiées de synchronisation
 * avec le moteur de présentation PowerPoint (.potx) {@link module:PptxTemplateEngine}.
 *
 * Règles partagées :
 *  - Niveau 1 (#) ou document global : Couverture (type 'title')
 *  - Niveau 2 (##) : Intercalaire de chapitre (type 'chapter')
 *  - Niveau 3+ (###..) : Diapositive de contenu (type 'content')
 *  - Séparateur horizontal (---) : Force la création d'une nouvelle diapositive
 *  - Tableaux, images et diagrammes Mermaid : Isolés sur une diapositive dédiée si nécessaire
 *  - Dépassement : Pagination en "(suite)" dès que 7 puces ou 6 paragraphes sont atteints
 *
 * @function planSlides
 * @param {string} mdText - Texte Markdown normalisé
 * @param {string} [docTitle='Document'] - Titre du document
 * @param {object} [options={}] - Options de planification
 * @returns {PlannedSlide[]} Liste des diapositives planifiées
 */
export function planSlides(mdText, docTitle = 'Document', options = {}) {
  const cleanMd = mdText || '';
  const formattedDate = options.date || new Date().toLocaleDateString('fr-FR');
  const ast = parseToAST(cleanMd);

  /** @type {PlannedSlide[]} */
  const slides = [];

  let globalTitle = docTitle || 'Document';
  let astStartIndex = 0;

  // 1. Détection du titre global (#)
  if (ast.length > 0 && ast[0].type === 'header' && ast[0].level === 1) {
    globalTitle = ast[0].text;
    astStartIndex = 1;
  }

  // Passer les éventuelles métadonnées du premier bloc
  while (astStartIndex < ast.length) {
    const block = ast[astStartIndex];
    if (block.type === 'header') break;
    astStartIndex++;
  }

  // Diapositive 1 : Couverture (type 'title')
  slides.push({
    id: `slide-1`,
    slideNumber: 1,
    type: 'title',
    title: globalTitle,
    chapter: '',
    date: formattedDate,
    sectionIndex: -1,
    slideIndex: 0,
    slug: toSlug(globalTitle) || 'title',
    blocks: [],
    markdown: '',
  });

  let currentSection = null;
  let sectionIndex = 0;
  let currentSlide = null;

  const flushSlide = () => {
    if (currentSlide && currentSlide.blocks.length > 0) {
      currentSlide.markdown = currentSlide.blocks.map(blockToMarkdown).join('\n\n').trim();
      slides.push(currentSlide);
      currentSlide = null;
    }
  };

  const ensureContentSlide = (title) => {
    if (!currentSlide) {
      const slideTitle = title || currentSection || 'Contenu';
      currentSlide = {
        id: `slide-${slides.length + 1}`,
        slideNumber: slides.length + 1,
        type: 'content',
        title: slideTitle,
        chapter: currentSection || globalTitle,
        date: formattedDate,
        sectionIndex,
        slideIndex: slides.length,
        slug: toSlug(slideTitle) || `slide-${slides.length + 1}`,
        blocks: [],
        markdown: '',
      };
    }
    return currentSlide;
  };

  for (let i = astStartIndex; i < ast.length; i++) {
    const block = ast[i];

    if (block.type === 'header') {
      flushSlide();

      if (block.level === 1) {
        // Nouveau titre principal de niveau 1
        slides.push({
          id: `slide-${slides.length + 1}`,
          slideNumber: slides.length + 1,
          type: 'title',
          title: block.text,
          chapter: '',
          date: formattedDate,
          sectionIndex: ++sectionIndex,
          slideIndex: slides.length,
          slug: toSlug(block.text) || `title-${slides.length + 1}`,
          blocks: [],
          markdown: '',
        });
        continue;
      }

      if (block.level === 2) {
        // Titre de section / chapitre
        currentSection = block.text;
        slides.push({
          id: `slide-${slides.length + 1}`,
          slideNumber: slides.length + 1,
          type: 'chapter',
          title: currentSection,
          chapter: currentSection,
          date: formattedDate,
          sectionIndex: ++sectionIndex,
          slideIndex: slides.length,
          slug: toSlug(currentSection) || `chapter-${slides.length + 1}`,
          blocks: [],
          markdown: '',
        });
        continue;
      }

      // Niveau 3 ou supérieur (###, etc.)
      currentSlide = {
        id: `slide-${slides.length + 1}`,
        slideNumber: slides.length + 1,
        type: 'content',
        title: block.text,
        chapter: currentSection || globalTitle,
        date: formattedDate,
        sectionIndex,
        slideIndex: slides.length,
        slug: toSlug(block.text) || `slide-${slides.length + 1}`,
        blocks: [],
        markdown: '',
      };
      continue;
    }

    if (block.type === 'separator') {
      // Délimiteur explicite de diapositive (---)
      flushSlide();
      continue;
    }

    if (!currentSlide) {
      ensureContentSlide();
    }

    if (block.type === 'table') {
      if (currentSlide.blocks.length > 2) {
        flushSlide();
        ensureContentSlide(currentSection ? `${currentSection} - Données` : 'Données');
      }
      currentSlide.blocks.push(block);
      flushSlide();
    } else if (block.type === 'image' || block.type === 'mermaid') {
      if (currentSlide.blocks.length > 2) {
        flushSlide();
        ensureContentSlide(currentSection ? `${currentSection} - Schéma` : 'Schéma');
      }
      currentSlide.blocks.push(block);
      flushSlide();
    } else if (block.type === 'list_item') {
      currentSlide.blocks.push(block);
      const listCount = currentSlide.blocks.filter((b) => b.type === 'list_item').length;
      if (listCount >= 7) {
        const prevTitle = currentSlide.title;
        flushSlide();
        ensureContentSlide(`${prevTitle} (suite)`);
      }
    } else if (block.type === 'paragraph') {
      currentSlide.blocks.push(block);
      const paraCount = currentSlide.blocks.filter((b) => b.type === 'paragraph').length;
      if (paraCount >= 6) {
        const prevTitle = currentSlide.title;
        flushSlide();
        ensureContentSlide(`${prevTitle} (suite)`);
      }
    }
  }

  flushSlide();
  return slides;
}
