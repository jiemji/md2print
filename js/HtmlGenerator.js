/**
 * @module HtmlGenerator
 * @description Génération du document HTML autonome et du flux de prévisualisation iframe.
 * Intègre le CSS (thème Azur classique), le sommaire latéral repliable avec ScrollSpy,
 * les schémas Mermaid vectoriels, les alertes/callouts GitHub, les badges inline,
 * les cartouches de données/métriques agrandies (5x), et le support des modes
 * Rapport continu et Diaporama interactif.
 * @requires utils
 * @requires SlidePlanner
 */
import {
  toSlug,
  escapeHtml,
  normalizeMarkdown,
  resolveImagePaths,
  normalizeMermaidCode,
  resolveCallout,
  resolveBadgeClass,
  parseMetricTag,
  resolveMetricClass,
} from './utils.js';
import { planSlides } from './SlidePlanner.js';
import { DEFAULT_REPORT_CSS, DEFAULT_SLIDE_CSS } from './defaultThemeStyles.js';

let markedExtensionsInitialized = false;

/**
 * Enregistre les extensions personnalisées de Marked.js (badges [badge:...] et chiffres [chiffre:...]).
 */
function ensureMarkedExtensions() {
  if (markedExtensionsInitialized || typeof window.marked === 'undefined') return;
  window.marked.use({
    extensions: [
      {
        name: 'badge',
        level: 'inline',
        start(src) {
          return src.indexOf('[badge:');
        },
        tokenizer(src) {
          const match = /^\[badge:(?:([a-zA-Z0-9_-]+):)?([^\]\n]+)\]/.exec(src);
          if (match) {
            return {
              type: 'badge',
              raw: match[0],
              badgeType: (match[1] || 'neutral').toLowerCase(),
              text: match[2].trim(),
            };
          }
        },
        renderer(token) {
          const badgeClass = resolveBadgeClass(token.badgeType);
          return `<span class="badge ${badgeClass}">${escapeHtml(token.text)}</span>`;
        },
      },
      {
        name: 'metric',
        level: 'inline',
        start(src) {
          const match = src.match(/\[(chiffre|metric|stat|kpi):/i);
          return match ? match.index : -1;
        },
        tokenizer(src) {
          const match =
            /^\[(chiffre|metric|stat|kpi):([^:\]\n]+)(?::([^:\]\n]+))?(?::([^\]\n]+))?\]/i.exec(src);
          if (match) {
            const parsed = parseMetricTag(match[2], match[3], match[4]);
            return {
              type: 'metric',
              raw: match[0],
              val: parsed.val,
              label: parsed.label,
              variant: parsed.variant,
            };
          }
        },
        renderer(token) {
          const variantClass = resolveMetricClass(token.variant);
          const labelHtml = token.label
            ? `<span class="metric-label">${escapeHtml(token.label)}</span>`
            : '';
          return `<span class="metric-card ${variantClass}"><span class="metric-value">${escapeHtml(token.val)}</span>${labelHtml}</span>`;
        },
      },
    ],
  });
  markedExtensionsInitialized = true;
}

/**
 * Extrait la table des matières (H1, H2, H3) du texte Markdown normalisé.
 * @param {string} normalizedMarkdown
 * @returns {Array<{ level: number, title: string, slug: string }>}
 */
export const extractTOC = (normalizedMarkdown) => {
  if (!normalizedMarkdown) return [];
  const lines = normalizedMarkdown.split('\n');
  const toc = [];
  const usedSlugs = new Set();
  let inCodeBlock = false;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      return;
    }
    if (inCodeBlock) return;

    const match = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const title = match[2].replace(/[*_`]/g, '').trim();
      const baseSlug = toSlug(title) || `section-${level}`;
      let uniqueSlug = baseSlug;
      let counter = 1;
      while (usedSlugs.has(uniqueSlug)) {
        uniqueSlug = `${baseSlug}-${counter++}`;
      }
      usedSlugs.add(uniqueSlug);
      toc.push({ level, title, slug: uniqueSlug });
    }
  });

  return toc;
};

/**
 * Convertit le Markdown normalisé en HTML via Marked.js, Highlight.js et Mermaid.js.
 * @param {string} cleanMarkdown
 * @param {Record<string, string>} [mermaidSvgMap={}] - Dictionnaire des schémas Mermaid pré-rendus en SVG
 * @returns {string}
 */
const parseMarkdownToHTML = (cleanMarkdown, mermaidSvgMap = {}) => {
  if (typeof window.marked === 'undefined') {
    return '<p>Erreur : La bibliothèque Marked.js n\'est pas chargée.</p>';
  }

  const renderer = new window.marked.Renderer();
  const usedSlugs = new Set();

  renderer.heading = function ({ text, depth, tokens }) {
    const cleanTitle = text.replace(/<[^>]*>/g, '').replace(/[*_`]/g, '').trim();
    const baseSlug = toSlug(cleanTitle) || `section-${depth}`;
    let uniqueSlug = baseSlug;
    let counter = 1;
    while (usedSlugs.has(uniqueSlug)) {
      uniqueSlug = `${baseSlug}-${counter++}`;
    }
    usedSlugs.add(uniqueSlug);

    const renderedText =
      this.parser && tokens ? this.parser.parseInline(tokens) : text;

    if (depth === 1) {
      return `<h1 id="${uniqueSlug}" class="doc-heading doc-main-title">${renderedText}</h1>`;
    }
    return `<h${depth} id="${uniqueSlug}" class="doc-heading doc-h${depth}">${renderedText}</h${depth}>`;
  };

  // Interprète __texte__ comme du souligné (<u>) et **texte** comme du gras (<strong>)
  renderer.strong = function ({ tokens, raw, text }) {
    const inner = this.parser && tokens ? this.parser.parseInline(tokens) : text;
    if (typeof raw === 'string' && raw.startsWith('__')) {
      return `<u>${inner}</u>`;
    }
    return `<strong>${inner}</strong>`;
  };

  // Rendu des schémas Mermaid dans un cadre ombré et des blocs de code avec coloration syntaxique
  renderer.code = ({ text, lang }) => {
    const cleanLang = (lang || '').trim().toLowerCase();
    if (cleanLang === 'mermaid') {
      const trimmedCode = normalizeMermaidCode(text);
      const svgMarkup = mermaidSvgMap[trimmedCode];
      if (svgMarkup) {
        return `<figure class="mermaid-card"><div class="mermaid-diagram">${svgMarkup}</div></figure>`;
      }
      return `<figure class="mermaid-card mermaid-card--pending"><pre class="mermaid-source"><code>${escapeHtml(text)}</code></pre></figure>`;
    }

    const hasHljs = typeof window.hljs !== 'undefined';
    const validLang = hasHljs && lang && window.hljs.getLanguage(lang) ? lang : '';
    let highlighted = '';
    if (hasHljs) {
      try {
        highlighted = validLang
          ? window.hljs.highlight(text, { language: validLang }).value
          : window.hljs.highlightAuto(text).value;
      } catch {
        highlighted = escapeHtml(text);
      }
    } else {
      highlighted = escapeHtml(text);
    }
    return `<pre class="code-block"><code class="hljs ${escapeHtml(validLang)}">${highlighted}</code></pre>`;
  };

  renderer.listitem = function ({ text, task, checked, tokens, loose }) {
    const formattedText =
      this.parser && tokens ? this.parser.parse(tokens, Boolean(loose)) : text;
    if (task) {
      const checkClass = checked ? 'task-checked' : 'task-unchecked';
      const boxText = checked ? '[x]' : '[ ]';
      return `<li class="task-list-item ${checkClass}"><span class="task-box">${boxText}</span> <span class="task-label">${formattedText}</span></li>`;
    }
    return `<li>${formattedText}</li>`;
  };

  // Traitement spécifique des alertes / callouts GitHub (> [!NOTE], > [!TIP], etc.)
  renderer.blockquote = function (token) {
    if (token.tokens && token.tokens.length > 0 && token.tokens[0].type === 'paragraph') {
      const match = token.tokens[0].text.match(
        /^\[!([a-zA-Z0-9_-]+)\](?:[^\S\r\n]*([^\r\n]*))?(?:\r?\n([\s\S]*))?$/
      );
      if (match) {
        const rawType = match[1];
        const customTitle = (match[2] || '').trim();
        const rest = match[3] || '';
        const callout = resolveCallout(rawType, customTitle);
        let bodyHtml = '';
        if (rest.trim()) {
          bodyHtml += `<p>${window.marked.parseInline(rest)}</p>`;
        }
        if (token.tokens.length > 1) {
          bodyHtml += this.parser.parse(token.tokens.slice(1));
        }
        return `<aside class="callout callout-${callout.kind}"><div class="callout-header"><span class="callout-title">${escapeHtml(callout.title)}</span></div><div class="callout-body">${bodyHtml}</div></aside>`;
      }
    }
    return `<blockquote>${this.parser.parse(token.tokens)}</blockquote>`;
  };

  renderer.image = function ({ href, title, text }) {
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
    const altAttr = text ? ` alt="${escapeHtml(text)}"` : ' alt=""';
    return `<figure class="slide-image-box"><img src="${escapeHtml(href)}"${altAttr}${titleAttr} class="slide-image" loading="lazy"></figure>`;
  };

  renderer.paragraph = function ({ tokens, text }) {
    if (
      tokens &&
      tokens.length > 0 &&
      tokens.every((tok) => tok.type === 'image' || (tok.type === 'text' && !tok.text.trim()))
    ) {
      return this.parser.parseInline(tokens);
    }
    const inner = this.parser && tokens ? this.parser.parseInline(tokens) : text;
    return `<p>${inner}</p>\n`;
  };

  ensureMarkedExtensions();

  window.marked.setOptions({
    renderer,
    gfm: true,
    breaks: true,
  });

  // Normalise l'indentation des sous-listes (4 espaces par niveau) pour que Marked.js
  // imbrique uniformément les listes à puces (- *) et les listes numérotées (1.)
  let inFence = false;
  const markedReadyMarkdown = cleanMarkdown
    .split('\n')
    .map((line) => {
      if (line.trimStart().startsWith('```')) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      const listMatch = line.match(/^([ \t]+)((?:[-*+]|\d+[.)])[ \t]+.*)$/);
      if (listMatch) {
        const spaceCount = listMatch[1].replace(/\t/g, '  ').length;
        const level = Math.ceil(spaceCount / 2);
        return ' '.repeat(level * 4) + listMatch[2];
      }
      return line;
    })
    .join('\n');

  const parsed = window.marked.parse(markedReadyMarkdown);

  let processedHtml = parsed.replace(/(<table\b[^>]*>[\s\S]*?<\/table>)/gi, (match) => {
    let tableHtml = match;
    if (!/class=["'][^"']*doc-table[^"']*["']/i.test(tableHtml)) {
      if (/class=["']/i.test(tableHtml)) {
        tableHtml = tableHtml.replace(/(<table\b[^>]*class=["'])([^"']*)/i, '$1$2 doc-table');
      } else {
        tableHtml = tableHtml.replace(/^<table\b/i, '<table class="doc-table"');
      }
    }
    return `<div class="table-responsive-wrapper">${tableHtml}</div>`;
  });

  // Envelopper les balises métriques d'une même ligne dans un conteneur flex dédié
  processedHtml = processedHtml.replace(/<p\b[^>]*>([\s\S]*?<span class="metric-card[\s\S]*?)<\/p>/gi, (match, inner) => {
    const cleaned = inner.replace(/<\/span>\s+<span class="metric-card/g, '</span><span class="metric-card');
    return `<div class="metric-group-row">${cleaned}</div>`;
  });

  return processedHtml;
};

/**
 * Génère le document HTML complet et autonome.
 * @param {string} rawMarkdown - Contenu Markdown brut
 * @param {object} options
 * @param {string} [options.docTitle] - Titre du document
 * @param {string} [options.viewMode='report'] - Mode d'affichage ('report' | 'slide')
 * @param {Record<string, string>} [options.localImages={}] - Dictionnaire d'images Base64
 * @param {Record<string, string>} [options.mermaidSvgMap={}] - Dictionnaire des schémas Mermaid pré-rendus en SVG
 * @param {object} [options.pptConfig] - Configuration PPTX issue de output_config.json
 * @param {string} [options.templateId='default'] - Identifiant du template PPTX
 * @param {string|null} [options.reportCss=null] - Feuille de style CSS personnalisée pour la vision rapport
 * @param {string|null} [options.slideCss=null] - Feuille de style CSS personnalisée pour la vision slide
 * @returns {string} Code HTML autonome complet
 */
export const generateStandaloneHTML = (rawMarkdown, options = {}) => {
  const {
    docTitle = 'Document',
    viewMode = 'report',
    localImages = {},
    mermaidSvgMap = {},
    pptConfig = null,
    templateId = 'default',
    reportCss = null,
    slideCss = null,
  } = options;

  const isSlide = viewMode === 'slide';
  const resolvedMarkdown = resolveImagePaths(rawMarkdown || '', localImages);
  const cleanMarkdown = normalizeMarkdown(resolvedMarkdown);
  const tocList = extractTOC(cleanMarkdown);
  const formattedDate = new Date().toLocaleDateString('fr-FR');

  let parsedContent = '';
  let slidesHTML = '';

  if (isSlide) {
    // Découpage unifié des diapositives synchronisé avec PowerPoint (.pptx)
    const plannedSlides = planSlides(cleanMarkdown, docTitle, {
      pptConfig,
      templateId,
      mermaidSvgMap,
      date: formattedDate,
    });

    slidesHTML = plannedSlides
      .map((slide, idx) => {
        const activeClass = idx === 0 ? 'active' : '';
        if (slide.type === 'title') {
          return `
            <div class="slide slide-title ${activeClass}" data-slide-index="${idx}" data-slug="${escapeHtml(slide.slug)}">
              <div class="slide-inner slide-title-inner">
                <div class="slide-title-card">
                  <h1 class="slide-main-title">${escapeHtml(slide.title || docTitle || 'Document')}</h1>
                  <div class="slide-title-meta">
                    ${slide.metadata ? `<span class="slide-title-metadata">${escapeHtml(slide.metadata)}</span>` : ''}
                    <span class="slide-title-date">${escapeHtml(slide.date)}</span>
                  </div>
                </div>
              </div>
            </div>
          `;
        }
        if (slide.type === 'chapter') {
          return `
            <div class="slide slide-chapter ${activeClass}" data-slide-index="${idx}" data-slug="${escapeHtml(slide.slug)}">
              <div class="slide-inner slide-chapter-inner">
                <div class="slide-chapter-card">
                  <h2 class="slide-chapter-title">${escapeHtml(slide.title)}</h2>
                </div>
              </div>
            </div>
          `;
        }

        const slideContentHtml = parseMarkdownToHTML(slide.markdown, mermaidSvgMap);
        const showChapterTag = slide.chapter && slide.chapter !== slide.title;
        return `
          <div class="slide slide-content ${activeClass}" data-slide-index="${idx}" data-slug="${escapeHtml(slide.slug)}">
            <div class="slide-inner slide-content-inner">
              <header class="slide-header">
                ${showChapterTag ? `<span class="slide-chapter-tag">${escapeHtml(slide.chapter)}</span>` : ''}
                <h2 class="slide-header-title">${escapeHtml(slide.title)}</h2>
              </header>
              <div class="slide-body">
                ${slideContentHtml}
              </div>
            </div>
          </div>
        `;
      })
      .join('\n');
  } else {
    parsedContent = parseMarkdownToHTML(cleanMarkdown, mermaidSvgMap);
  }

  let tocItemsHTML = '';
  if (tocList.length === 0) {
    tocItemsHTML = '<li class="toc-empty">Aucune section détectée</li>';
  } else {
    tocItemsHTML = tocList
      .map((item) => {
        const levelClass = `toc-item toc-h${item.level}`;
        return `
          <li class="${levelClass}" data-slug="${escapeHtml(item.slug)}">
            <a href="#${escapeHtml(item.slug)}" class="toc-link" onclick="handleTocClick(event, '${escapeHtml(item.slug)}')">
              <span class="toc-text">${escapeHtml(item.title)}</span>
            </a>
          </li>
        `;
      })
      .join('');
  }

  const activeCSS =
    isSlide
      ? (slideCss || DEFAULT_SLIDE_CSS)
      : (reportCss || DEFAULT_REPORT_CSS);

  const slideContainmentCSS = isSlide
    ? `
/* === Confinement impératif 16:9 et intégration proportionnelle des images === */
.slide {
  overflow: hidden !important;
}
.slide-content-inner {
  width: 100% !important;
  height: 100% !important;
  display: flex !important;
  flex-direction: column !important;
  flex: 1 1 0 !important;
  min-height: 0 !important;
  min-width: 0 !important;
  overflow: hidden !important;
}
.slide-header {
  flex-shrink: 0 !important;
}
.slide-body {
  flex: 1 1 0 !important;
  min-height: 0 !important;
  min-width: 0 !important;
  height: 100% !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
}
/* === Dimensionnement pleine largeur et partage horizontal des KPI / Chiffres clés === */
.metric-group-row,
.slide-body p:has(.metric-card) {
  display: flex !important;
  flex-direction: row !important;
  align-items: stretch !important;
  gap: 16px !important;
  width: 100% !important;
  margin: 14px 0 !important;
  box-sizing: border-box !important;
}
.metric-group-row > br,
.slide-body p:has(.metric-card) > br {
  display: none !important;
}
.slide-body .metric-group-row .metric-card,
.slide-body .metric-card {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  flex: 1 1 0% !important;
  width: 100% !important;
  min-width: 0 !important;
  margin: 0 !important;
  padding: 20px 24px !important;
  box-sizing: border-box !important;
}
.slide-body > .metric-card {
  width: 100% !important;
  margin: 14px 0 !important;
}
.slide-image-box,
.slide-body figure,
.slide-body p:has(img) {
  flex: 1 1 0 !important;
  min-height: 0 !important;
  min-width: 0 !important;
  max-height: 100% !important;
  max-width: 100% !important;
  width: 100% !important;
  height: 100% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
}
.slide-image,
.slide-image-box img,
.slide-body img,
.slide img {
  max-width: 100% !important;
  max-height: 100% !important;
  width: auto !important;
  height: auto !important;
  object-fit: contain !important;
  display: block !important;
  margin: auto !important;
  box-sizing: border-box !important;
}
`
    : `
/* === Rendu propre des images en vision Rapport === */
.slide-image-box, figure {
  margin: 16px auto;
  text-align: center;
  max-width: 100%;
}
.slide-image, .slide-image-box img {
  max-width: 100%;
  height: auto;
  border-radius: var(--report-radius-sm, 6px);
  border: 1px solid var(--report-border-color, #e2e8f0);
  margin: 0 auto;
  display: block;
}
`;

  const documentJS = `
    (function() {
      const isSlideMode = ${isSlide ? 'true' : 'false'};
      let currentSlideIndex = 0;
      let totalSlides = 0;

      window.toggleTocSidebar = function() {
        const sidebar = document.getElementById('tocSidebar');
        if (sidebar) {
          sidebar.classList.toggle('collapsed');
        }
      };

      window.handleTocClick = function(event, targetId) {
        event.preventDefault();

        if (isSlideMode) {
          const slides = document.querySelectorAll('.slide');
          for (let i = 0; i < slides.length; i++) {
            if (
              slides[i].dataset.slug === targetId ||
              (slides[i].querySelector && slides[i].querySelector('#' + CSS.escape(targetId)))
            ) {
              showSlide(i);
              break;
            }
          }
          const sidebar = document.getElementById('tocSidebar');
          if (sidebar) {
            sidebar.classList.add('collapsed');
          }
          return;
        }

        const target = document.getElementById(targetId);
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };

      function updateSlideControls() {
        const counter = document.getElementById('slideCounter');
        if (counter) {
          counter.textContent = (totalSlides > 0 ? currentSlideIndex + 1 : 0) + ' / ' + totalSlides;
        }
        const prevBtn = document.getElementById('slidePrev');
        const nextBtn = document.getElementById('slideNext');
        if (prevBtn) prevBtn.disabled = currentSlideIndex <= 0;
        if (nextBtn) nextBtn.disabled = currentSlideIndex >= totalSlides - 1;
      }

      function showSlide(index) {
        if (index < 0 || index >= totalSlides) return;
        currentSlideIndex = index;
        const slides = document.querySelectorAll('.slide');
        slides.forEach((s, i) => s.classList.toggle('active', i === index));
        updateSlideControls();

        const activeSlide = slides[index];
        if (activeSlide && activeSlide.dataset.slug) {
          document.querySelectorAll('.toc-item').forEach((item) => {
            item.classList.toggle('active', item.getAttribute('data-slug') === activeSlide.dataset.slug);
          });
        }
      }

      window.showSlide = showSlide;
      window.getCurrentSlideIndex = function() {
        return currentSlideIndex;
      };
      window.getTotalSlides = function() {
        return totalSlides;
      };

      window.prevSlide = function() {
        if (currentSlideIndex > 0) showSlide(currentSlideIndex - 1);
      };

      window.nextSlide = function() {
        if (currentSlideIndex < totalSlides - 1) showSlide(currentSlideIndex + 1);
      };

      function initSlideMode() {
        const slides = document.querySelectorAll('.slide');
        totalSlides = slides.length;
        currentSlideIndex = 0;

        if (totalSlides > 0) {
          showSlide(0);
        } else {
          updateSlideControls();
        }

        document.addEventListener('keydown', (e) => {
          if (document.body.getAttribute('data-view-mode') !== 'slide') return;
          if (e.key === 'Escape') {
            const sidebar = document.getElementById('tocSidebar');
            if (sidebar && !sidebar.classList.contains('collapsed')) {
              sidebar.classList.add('collapsed');
            }
            return;
          }
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
            e.preventDefault();
            window.nextSlide();
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
            e.preventDefault();
            window.prevSlide();
          }
        });

        let lastWheelTime = 0;
        const WHEEL_COOLDOWN = 350;

        /**
         * Détermine récursivement si un élément ou l'un de ses ancêtres peut défiler verticalement.
         * @param {EventTarget} target - Élément source sous le pointeur
         * @param {number} deltaY - Amplitude du déplacement de la molette
         * @returns {boolean} true si l'élément possède une marge de défilement actif
         */
        function canElementScroll(target, deltaY) {
          let el = target;
          while (el && el !== document.body && el !== document.documentElement) {
            if (el.id === 'tocSidebar') {
              return !el.classList.contains('collapsed');
            }
            const style = window.getComputedStyle(el);
            const overflowY = style.overflowY;
            if (overflowY === 'auto' || overflowY === 'scroll') {
              if (deltaY > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) {
                return true;
              }
              if (deltaY < 0 && el.scrollTop > 1) {
                return true;
              }
            }
            el = el.parentElement;
          }
          return false;
        }

        window.addEventListener(
          'wheel',
          (e) => {
            if (document.body.getAttribute('data-view-mode') !== 'slide') return;
            if (e.ctrlKey) return;
            if (canElementScroll(e.target, e.deltaY)) return;

            if (Math.abs(e.deltaY) < 15) return;

            const now = Date.now();
            if (now - lastWheelTime < WHEEL_COOLDOWN) {
              e.preventDefault();
              return;
            }

            if (e.deltaY > 0) {
              e.preventDefault();
              lastWheelTime = now;
              window.nextSlide();
            } else if (e.deltaY < 0) {
              e.preventDefault();
              lastWheelTime = now;
              window.prevSlide();
            }
          },
          { passive: false }
        );
      }

      function initScrollSpy() {
        const headings = document.querySelectorAll('.doc-heading');
        const tocItems = document.querySelectorAll('.toc-item');

        window.addEventListener('scroll', () => {
          if (document.body.getAttribute('data-view-mode') === 'slide') return;
          const bannerHeight = document.querySelector('.top-banner')?.offsetHeight || 56;
          let currentSlug = '';

          headings.forEach((heading) => {
            const top = heading.getBoundingClientRect().top;
            if (top <= bannerHeight + 48) {
              currentSlug = heading.id;
            }
          });

          if (!currentSlug && headings.length > 0) {
            currentSlug = headings[0].id;
          }

          if (currentSlug) {
            tocItems.forEach((item) => {
              item.classList.toggle('active', item.getAttribute('data-slug') === currentSlug);
            });
          }
        });
      }

      function initDocument() {
        if (isSlideMode) {
          initSlideMode();
        } else {
          initScrollSpy();
        }
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDocument);
      } else {
        initDocument();
      }
    })();
  `;

  const tocSidebarClass = isSlide ? 'toc-sidebar collapsed' : 'toc-sidebar';
  const mainContentHTML = isSlide
    ? `<div class="slide-container" id="slideContainer">\n${slidesHTML}\n      </div>`
    : `<article class="markdown-rendered-content">\n        ${parsedContent}\n      </article>`;
  const controlsHTML = isSlide
    ? `\n  <div class="slide-controls">\n    <button type="button" class="banner-btn" id="slidePrev" onclick="prevSlide()">Précédent</button>\n    <span class="slide-counter" id="slideCounter">0 / 0</span>\n    <button type="button" class="banner-btn" id="slideNext" onclick="nextSlide()">Suivant</button>\n  </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(docTitle || 'Document')}</title>
  <style id="documentStyle">${activeCSS}\n${slideContainmentCSS}</style>
</head>
<body data-view-mode="${escapeHtml(viewMode)}">
  <header class="top-banner">
    <div class="banner-inner">
      <div class="banner-left">
        <button type="button" class="banner-btn" id="btnToggleToc" onclick="toggleTocSidebar()">Sommaire</button>
      </div>
      <div class="banner-center">
        <div class="banner-main-title">${escapeHtml(docTitle || 'Document')}</div>
      </div>
      <div class="banner-actions">
        <span class="banner-date">${escapeHtml(formattedDate)}</span>
        <button type="button" class="banner-btn" onclick="window.print()">Imprimer</button>
      </div>
    </div>
  </header>

  <div class="document-layout">
    <aside class="${tocSidebarClass}" id="tocSidebar">
      <div class="toc-header-block">
        <span class="toc-title">Navigation</span>
        <span class="toc-counter">${tocList.length}</span>
      </div>
      <nav class="toc-nav">
        <ul class="toc-list">
          ${tocItemsHTML}
        </ul>
      </nav>
    </aside>

    <main class="document-body">
      ${mainContentHTML}
    </main>
  </div>${controlsHTML}

  <script>${documentJS}</script>
</body>
</html>`;
};
