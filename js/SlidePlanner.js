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
  if (block.type === 'empty_line') {
    const c = Math.max(1, Number(block.count) || 1);
    return Array(c).fill('%%MD2PRINT_EMPTY_LINE%%').join('\n\n');
  }
  if (typeof block.raw === 'string' && block.raw.trim()) {
    // Pour les éléments de liste, préserver impérativement l'indentation (espaces de début)
    // qui détermine le niveau hiérarchique du bullet point.
    if (block.type === 'list_item') {
      return block.raw.trimEnd();
    }
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
 * Reconstruit le texte Markdown complet d'une série de blocs AST pour une diapositive.
 * Les éléments de liste consécutifs au sein d'une même liste sont reliés par un simple saut
 * de ligne (\n) afin de préserver l'imbrication des sous-niveaux d'indentation,
 * tandis que les blocs de natures différentes ou séparés par des lignes vides sont espacés par (\n\n).
 * 
 * @function blocksToMarkdown
 * @param {Array<object>} blocks - Liste des blocs AST de la diapositive
 * @returns {string} Texte Markdown reconstitué
 */
export function blocksToMarkdown(blocks) {
  if (!blocks || !blocks.length) return '';
  const parts = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const text = blockToMarkdown(block);
    if (!text) continue;
    if (parts.length === 0) {
      parts.push(text);
    } else {
      const prevBlock = blocks[i - 1];
      const hasBlankLine =
        block.startLine !== undefined &&
        prevBlock?.endLine !== undefined &&
        block.startLine > prevBlock.endLine + 1;

      const isTightList =
        !hasBlankLine &&
        prevBlock?.type === 'list_item' &&
        block.type === 'list_item';

      parts.push(isTightList ? '\n' + text : '\n\n' + text);
    }
  }
  return parts.join('').trim();
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
 * Règles unifiées de découpage :
 *  - Titre # (Niveau 1) : Déclenche une diapositive de couverture (type 'title').
 *  - Titre ## (Niveau 2) : Déclenche une diapositive de chapitre (type 'chapter').
 *  - Titre ### (Niveau 3) : Crée une diapositive de contenu (type 'content') et mémorise son titre.
 *  - Titres supérieurs à ### (####, #####, ######) : N'entraînent aucun saut de diapositive et sont intégrés comme sous-sections dans le corps de la diapositive courante.
 *  - Séparateur horizontal (---) : Force la création d'une nouvelle diapositive en reprenant le titre du dernier ### qui précède.
 *
 * @function planSlides
 * @param {string} mdText - Texte Markdown normalisé
 * @param {string} [docTitle='Document'] - Titre du document
 * @param {object} [options={}] - Options de planification
 * @param {string} [options.date] - Date optionnelle au format texte
 * @returns {PlannedSlide[]} Liste des diapositives planifiées
 */
export function planSlides(mdText, docTitle = 'Document', options = {}) {
  const cleanMd = mdText || '';
  const formattedDate = options.date || new Date().toLocaleDateString('fr-FR');
  const ast = parseToAST(cleanMd);

  /** @type {PlannedSlide[]} */
  const slides = [];

  let globalTitle = docTitle || 'Document';
  let currentSection = null;
  let lastH3Title = null;
  let sectionIndex = 0;
  let currentSlide = null;

  const flushSlide = () => {
    if (currentSlide) {
      while (
        currentSlide.blocks.length > 0 &&
        currentSlide.blocks[currentSlide.blocks.length - 1].type === 'empty_line'
      ) {
        currentSlide.blocks.pop();
      }
      if (currentSlide.blocks.length > 0 || currentSlide.isExplicit) {
        currentSlide.markdown = blocksToMarkdown(currentSlide.blocks);
        slides.push(currentSlide);
      }
      currentSlide = null;
    }
  };

  const ensureContentSlide = (title, blockStartLine = null) => {
    if (!currentSlide) {
      const slideTitle = title || lastH3Title || currentSection || globalTitle || 'Contenu';
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
        startLine: blockStartLine !== null ? blockStartLine : 0,
        endLine: blockStartLine !== null ? blockStartLine : 0,
      };
    }
    return currentSlide;
  };

  for (let i = 0; i < ast.length; i++) {
    const block = ast[i];

    if (block.type === 'header') {
      if (block.level === 1) {
        // Règle 1 : Un titre # déclenche un slide de couverture
        flushSlide();

        globalTitle = block.text;
        lastH3Title = null;

        const coverSlide = {
          id: `slide-${slides.length + 1}`,
          slideNumber: slides.length + 1,
          type: 'title',
          title: block.text,
          chapter: '',
          date: formattedDate,
          metadata: '',
          sectionIndex: ++sectionIndex,
          slideIndex: slides.length,
          slug: toSlug(block.text) || `title-${slides.length + 1}`,
          blocks: [],
          markdown: '',
          startLine: block.startLine ?? 0,
          endLine: block.endLine ?? block.startLine ?? 0,
        };

        // Capturer d'éventuelles métadonnées (sous-titre, auteur) immédiatement sous le titre #
        const metaTexts = [];
        let j = i + 1;
        while (j < ast.length && ast[j].type !== 'header' && ast[j].type !== 'separator') {
          if (ast[j].type === 'paragraph' || ast[j].type === 'list_item') {
            const txt = ast[j].text || ast[j].runs?.map((r) => r.text).join('') || '';
            if (txt) metaTexts.push(txt);
            coverSlide.endLine = ast[j].endLine ?? ast[j].startLine ?? coverSlide.endLine;
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
        // Règle 2 : Un titre ## déclenche un slide de chapitre
        flushSlide();

        currentSection = block.text;
        lastH3Title = null;

        slides.push({
          id: `slide-${slides.length + 1}`,
          slideNumber: slides.length + 1,
          type: 'chapter',
          title: block.text,
          chapter: block.text,
          date: formattedDate,
          sectionIndex: ++sectionIndex,
          slideIndex: slides.length,
          slug: toSlug(block.text) || `chapter-${slides.length + 1}`,
          blocks: [],
          markdown: '',
          startLine: block.startLine ?? 0,
          endLine: block.endLine ?? block.startLine ?? 0,
        });
        currentSlide = null;
        continue;
      }

      if (block.level === 3) {
        // Règle 3 : Un titre ### crée un slide de type slide
        flushSlide();

        lastH3Title = block.text;

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
          startLine: block.startLine ?? 0,
          endLine: block.endLine ?? block.startLine ?? 0,
        };
        continue;
      }

      // Règle 4 : Les titres supérieurs à ### ne créent pas de nouveaux slides
      // Ils deviennent des sous-sections de contenu dans la diapositive courante
      if (!currentSlide) {
        ensureContentSlide(lastH3Title || currentSection || globalTitle || 'Contenu', block.startLine ?? 0);
      }
      if (currentSlide.startLine === undefined) {
        currentSlide.startLine = block.startLine ?? 0;
      }
      if (block.endLine !== undefined) {
        currentSlide.endLine = block.endLine;
      }
      currentSlide.blocks.push(block);
      currentSlide.isExplicit = false;
      continue;
    }

    if (block.type === 'separator') {
      // Règle 5 : Saut de slide avec --- reprenant le titre du ### qui précède
      flushSlide();
      const inheritedTitle = lastH3Title || currentSection || globalTitle || 'Contenu';
      currentSlide = {
        id: `slide-${slides.length + 1}`,
        slideNumber: slides.length + 1,
        type: 'content',
        title: inheritedTitle,
        chapter: currentSection || globalTitle,
        date: formattedDate,
        sectionIndex,
        slideIndex: slides.length,
        slug: toSlug(inheritedTitle) || `slide-${slides.length + 1}`,
        blocks: [],
        markdown: '',
        startLine: block.endLine !== undefined ? block.endLine + 1 : (block.startLine ?? 0) + 1,
        endLine: block.endLine !== undefined ? block.endLine + 1 : (block.startLine ?? 0) + 1,
        isExplicit: true,
      };
      continue;
    }

    // Ignorer les lignes vides orphelines lorsqu'aucune diapositive de contenu n'est ouverte
    if (block.type === 'empty_line' && !currentSlide) {
      continue;
    }

    // Autres blocs de contenu (paragraphes, listes, tableaux, diagrammes, images, lignes vides)
    if (!currentSlide) {
      ensureContentSlide(lastH3Title || currentSection || globalTitle || 'Contenu', block.startLine ?? 0);
    }

    if (currentSlide.startLine === undefined) {
      currentSlide.startLine = block.startLine ?? 0;
    }
    if (block.endLine !== undefined) {
      currentSlide.endLine = block.endLine;
    }

    currentSlide.blocks.push(block);
    currentSlide.isExplicit = false;
  }

  flushSlide();

  // Découpage et continuité des intervalles de lignes pour synchronisation bidirectionnelle
  const totalDocLines = (cleanMd || '').split('\n').length;
  for (let sIdx = 0; sIdx < slides.length; sIdx++) {
    const s = slides[sIdx];
    if (s.startLine === undefined) {
      s.startLine = s.blocks?.[0]?.startLine ?? 0;
    }
    if (sIdx === 0) {
      s.startLine = 0;
    }
    if (sIdx < slides.length - 1) {
      const nextSlide = slides[sIdx + 1];
      const nextStart = nextSlide.startLine !== undefined ? nextSlide.startLine : (nextSlide.blocks?.[0]?.startLine ?? totalDocLines);
      s.endLine = Math.max(s.startLine, nextStart - 1);
    } else {
      s.endLine = Math.max(s.startLine, totalDocLines - 1);
    }
  }

  return slides;
}

/**
 * Trouve l'index de la diapositive correspondant à une ligne donnée dans le texte Markdown.
 * @param {PlannedSlide[]} slides - Liste des diapositives planifiées
 * @param {number} lineIndex - Index de la ligne (0-based)
 * @returns {number} Index de la diapositive (0-based)
 */
export function findSlideIndexForLine(slides, lineIndex) {
  if (!slides || slides.length === 0) return 0;
  if (lineIndex <= 0) return 0;

  for (let i = 0; i < slides.length; i++) {
    const s = slides[i];
    if (lineIndex >= s.startLine && lineIndex <= s.endLine) {
      return i;
    }
  }

  // Si au-delà de la dernière diapositive
  if (lineIndex > slides[slides.length - 1].endLine) {
    return slides.length - 1;
  }

  return 0;
}
