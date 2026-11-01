/**
 * HtmlGenerator.js — Génération du document HTML autonome (et de l'aperçu iframe)
 * Intègre CSS (thème Azur classique), Sommaire latéral repliable avec ScrollSpy,
 * et support des modes Rapport continu et Slide interactif (100 % textuel, sans icône ni émoji).
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

  return parsed.replace(/(<table\b[^>]*>[\s\S]*?<\/table>)/gi, (match) => {
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
  } = options;

  const resolvedMarkdown = resolveImagePaths(rawMarkdown || '', localImages);
  const cleanMarkdown = normalizeMarkdown(resolvedMarkdown);
  const tocList = extractTOC(cleanMarkdown);
  const parsedContent = parseMarkdownToHTML(cleanMarkdown, mermaidSvgMap);
  const formattedDate = new Date().toLocaleDateString('fr-FR');

  // Découpage unifié des diapositives synchronisé avec PowerPoint (.pptx)
  const plannedSlides = planSlides(cleanMarkdown, docTitle, {
    pptConfig,
    templateId,
    mermaidSvgMap,
    date: formattedDate,
  });

  const slidesHTML = plannedSlides
    .map((slide, idx) => {
      const activeClass = idx === 0 ? 'active' : '';
      if (slide.type === 'title') {
        return `
          <div class="slide slide-title ${activeClass}" data-slide-index="${idx}" data-slug="${escapeHtml(slide.slug)}">
            <div class="slide-inner slide-title-inner">
              <div class="slide-title-card">
                <h1 class="slide-main-title">${escapeHtml(docTitle || 'Document')}</h1>
                <div class="slide-title-meta">
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
                <span class="slide-chapter-badge">Chapitre</span>
                <h2 class="slide-chapter-title">${escapeHtml(slide.title)}</h2>
                <span class="slide-chapter-date">${escapeHtml(slide.date)}</span>
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

  const documentCSS = `
    :root {
      --primary: #2563eb;
      --primary-dark: #1d4ed8;
      --primary-light: #eff6ff;
      --text-main: #0f172a;
      --text-muted: #475569;
      --text-dim: #94a3b8;
      --bg-page: #ffffff;
      --bg-sidebar: #f8fafc;
      --border-color: #e2e8f0;
      --border-light: #f1f5f9;
      --header-height: 56px;
      --sidebar-width: 280px;
      --radius-sm: 4px;
      --radius-md: 6px;
      --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      --font-mono: Consolas, 'JetBrains Mono', 'Courier New', monospace;
      --content-font-size: 1rem;
      --content-line-height: 1.7;
      --slide-font-size: 1.85rem;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html {
      scroll-behavior: smooth;
      font-size: 16px;
    }

    body {
      font-family: var(--font-sans);
      background-color: var(--bg-page);
      color: var(--text-main);
      line-height: var(--content-line-height);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* === Bandeau Supérieur Fixe === */
    .top-banner {
      position: sticky;
      top: 0;
      left: 0;
      right: 0;
      height: var(--header-height);
      background: #ffffff;
      border-bottom: 1px solid var(--border-color);
      z-index: 1000;
      display: flex;
      align-items: center;
      padding: 0 20px;
    }

    .banner-inner {
      width: 100%;
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 12px;
    }

    .banner-left {
      display: flex;
      align-items: center;
      justify-content: flex-start;
    }

    .banner-center {
      text-align: center;
      min-width: 0;
    }

    .banner-main-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--text-main);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .banner-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
    }

    .banner-date {
      font-size: 0.82rem;
      color: var(--text-muted);
    }

    .banner-btn {
      background: #ffffff;
      border: 1px solid var(--border-color);
      color: var(--text-main);
      padding: 6px 12px;
      border-radius: var(--radius-sm);
      font-family: inherit;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }

    .banner-btn:hover {
      background: var(--primary-light);
      border-color: var(--primary);
      color: var(--primary);
    }

    /* === Layout Global : Sommaire + Contenu === */
    .document-layout {
      display: flex;
      flex: 1;
      width: 100%;
      min-height: calc(100vh - var(--header-height));
    }

    /* === Sommaire Latéral Repliable === */
    .toc-sidebar {
      width: var(--sidebar-width);
      min-width: var(--sidebar-width);
      background: var(--bg-sidebar);
      border-right: 1px solid var(--border-color);
      position: sticky;
      top: var(--header-height);
      height: calc(100vh - var(--header-height));
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      padding: 20px 14px;
      transition: margin-left 0.25s ease, opacity 0.2s ease;
      z-index: 500;
    }

    .toc-sidebar.collapsed {
      margin-left: calc(-1 * var(--sidebar-width));
      opacity: 0;
      pointer-events: none;
    }

    .toc-header-block {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--border-color);
    }

    .toc-title {
      font-size: 0.82rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }

    .toc-counter {
      font-size: 0.72rem;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: var(--radius-sm);
      background: var(--primary-light);
      color: var(--primary);
    }

    .toc-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .toc-link {
      display: block;
      padding: 6px 10px;
      border-radius: var(--radius-sm);
      text-decoration: none;
      color: var(--text-muted);
      font-size: 0.84rem;
      line-height: 1.4;
      border-left: 3px solid transparent;
      transition: background 0.15s ease, color 0.15s ease;
    }

    .toc-link:hover {
      color: var(--primary);
      background: #ffffff;
    }

    .toc-item.active > .toc-link {
      color: var(--primary);
      font-weight: 700;
      background: #ffffff;
      border-left-color: var(--primary);
    }

    .toc-h1 .toc-link {
      font-weight: 700;
      color: var(--text-main);
    }

    .toc-h2 .toc-link {
      padding-left: 14px;
      font-weight: 600;
    }

    .toc-h3 .toc-link {
      padding-left: 26px;
      font-size: 0.78rem;
    }

    .toc-empty {
      font-size: 0.8rem;
      color: var(--text-dim);
      font-style: italic;
      padding: 8px;
    }

    /* === Corps du Document === */
    .document-body {
      flex: 1;
      padding: 32px 44px;
      max-width: 1100px;
      margin: 0 auto;
      width: 100%;
      min-width: 0;
    }

    .markdown-rendered-content {
      font-size: var(--content-font-size);
      color: var(--text-main);
    }

    .doc-heading {
      scroll-margin-top: calc(var(--header-height) + 20px);
    }

    .doc-main-title {
      font-size: 2rem;
      font-weight: 800;
      color: var(--text-main);
      margin-bottom: 22px;
      padding-bottom: 12px;
      border-bottom: 2px solid var(--border-color);
      line-height: 1.25;
    }

    .doc-h2 {
      font-size: 1.45rem;
      font-weight: 700;
      margin-top: 38px;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border-color);
      color: var(--text-main);
    }

    .doc-h3 {
      font-size: 1.18rem;
      font-weight: 600;
      margin-top: 26px;
      margin-bottom: 12px;
      color: var(--text-main);
    }

    .doc-h4, .doc-h5, .doc-h6 {
      font-size: 1.02rem;
      font-weight: 600;
      margin-top: 20px;
      margin-bottom: 10px;
      color: var(--text-muted);
    }

    p {
      margin-bottom: 16px;
      line-height: var(--content-line-height);
    }

    ul, ol {
      margin-bottom: 18px;
      padding-left: 24px;
    }

    li {
      margin-bottom: 6px;
      line-height: var(--content-line-height);
    }

    .task-list-item {
      list-style: none;
      margin-left: -20px;
    }

    .task-box {
      font-family: var(--font-mono);
      font-size: 0.85em;
      color: var(--primary);
      font-weight: 700;
      margin-right: 6px;
    }

    .task-checked .task-label {
      color: var(--text-muted);
      text-decoration: line-through;
    }

    blockquote {
      margin: 20px 0;
      padding: 14px 18px;
      background: var(--primary-light);
      border-left: 4px solid var(--primary);
      border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
      color: var(--text-main);
    }

    blockquote p:last-child {
      margin-bottom: 0;
    }

    /* === Callouts / Alertes GitHub-style (> [!NOTE], > [!TIP], etc.) === */
    .callout {
      margin: 20px 0;
      padding: 14px 18px;
      border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
      border-left: 4px solid var(--callout-border, #0284c7);
      background: var(--callout-bg, rgba(2, 132, 199, 0.07));
      color: var(--text-main);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }

    .callout-header {
      font-size: 0.82rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--callout-title, #0369a1);
      margin-bottom: 8px;
      user-select: none;
    }

    .callout-body {
      font-size: 0.95rem;
      line-height: 1.6;
    }

    .callout-body > :first-child {
      margin-top: 0;
    }

    .callout-body > :last-child {
      margin-bottom: 0;
    }

    .callout-note,
    .callout-info {
      --callout-border: #0284c7;
      --callout-bg: rgba(2, 132, 199, 0.07);
      --callout-title: #0369a1;
    }

    .callout-tip,
    .callout-astuce,
    .callout-success {
      --callout-border: #16a34a;
      --callout-bg: rgba(22, 163, 74, 0.07);
      --callout-title: #15803d;
    }

    .callout-important {
      --callout-border: #7c3aed;
      --callout-bg: rgba(124, 58, 237, 0.07);
      --callout-title: #6d28d9;
    }

    .callout-warning,
    .callout-avertissement,
    .callout-warn {
      --callout-border: #d97706;
      --callout-bg: rgba(217, 119, 6, 0.08);
      --callout-title: #b45309;
    }

    .callout-danger,
    .callout-caution,
    .callout-attention,
    .callout-critique {
      --callout-border: #dc2626;
      --callout-bg: rgba(220, 38, 38, 0.07);
      --callout-title: #b91c1c;
    }

    /* === Badges / Étiquettes inline ([badge:type:texte]) === */
    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.72rem;
      font-weight: 600;
      line-height: 1.2;
      padding: 0.2em 0.65em;
      border-radius: 9999px;
      vertical-align: baseline;
      letter-spacing: 0.02em;
      white-space: nowrap;
      margin: 0 0.25em;
      transition: background-color 0.15s ease, border-color 0.15s ease;
    }

    .badge-info,
    .badge-note {
      background: rgba(2, 132, 199, 0.12);
      color: #0369a1;
      border: 1px solid rgba(2, 132, 199, 0.35);
    }

    .badge-success,
    .badge-tip,
    .badge-astuce,
    .badge-ok,
    .badge-valide {
      background: rgba(22, 163, 74, 0.12);
      color: #15803d;
      border: 1px solid rgba(22, 163, 74, 0.35);
    }

    .badge-warning,
    .badge-warn,
    .badge-avertissement {
      background: rgba(217, 119, 6, 0.14);
      color: #b45309;
      border: 1px solid rgba(217, 119, 6, 0.4);
    }

    .badge-danger,
    .badge-caution,
    .badge-attention,
    .badge-critique,
    .badge-error {
      background: rgba(220, 38, 38, 0.12);
      color: #b91c1c;
      border: 1px solid rgba(220, 38, 38, 0.35);
    }

    .badge-important,
    .badge-purple,
    .badge-violet {
      background: rgba(124, 58, 237, 0.12);
      color: #6d28d9;
      border: 1px solid rgba(124, 58, 237, 0.35);
    }

    .badge-neutral,
    .badge-neutre,
    .badge-gray,
    .badge-default {
      background: rgba(100, 116, 139, 0.12);
      color: #475569;
      border: 1px solid rgba(100, 116, 139, 0.35);
    }

    /* === Cartouches de Données / Métriques / Chiffres ([chiffre:valeur:libellé]) === */
    .metric-card {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      vertical-align: middle;
      margin: 16px 14px 16px 0;
      padding: 22px 32px;
      min-width: 190px;
      border-radius: 12px;
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      border: 1px solid #cbd5e1;
      border-top: 5px solid var(--metric-accent, #0284c7);
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.85);
      text-align: center;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .metric-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 18px rgba(15, 23, 42, 0.11), inset 0 1px 0 rgba(255, 255, 255, 0.9);
    }

    .metric-value {
      font-size: clamp(3.2rem, 5rem, 5.5rem);
      font-weight: 800;
      line-height: 1.05;
      letter-spacing: -0.03em;
      color: var(--metric-val-color, #0369a1);
      font-family: var(--font-sans);
    }

    .metric-label {
      font-size: 0.82rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-muted, #64748b);
      margin-top: 10px;
      max-width: 260px;
      line-height: 1.35;
    }

    .metric-card-default,
    .metric-card-info {
      --metric-accent: #0284c7;
      --metric-val-color: #0369a1;
      background: linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 100%);
      border-color: #bae6fd;
    }

    .metric-card-success {
      --metric-accent: #16a34a;
      --metric-val-color: #15803d;
      background: linear-gradient(180deg, #f0fdf4 0%, #dcfce7 100%);
      border-color: #bbf7d0;
    }

    .metric-card-danger {
      --metric-accent: #dc2626;
      --metric-val-color: #b91c1c;
      background: linear-gradient(180deg, #fef2f2 0%, #fee2e2 100%);
      border-color: #fecaca;
    }

    .metric-card-warning {
      --metric-accent: #d97706;
      --metric-val-color: #b45309;
      background: linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%);
      border-color: #fde68a;
    }

    .metric-card-important {
      --metric-accent: #7c3aed;
      --metric-val-color: #6d28d9;
      background: linear-gradient(180deg, #faf5ff 0%, #f3e8ff 100%);
      border-color: #e9d5ff;
    }

    .metric-card-neutral {
      --metric-accent: #64748b;
      --metric-val-color: #334155;
      background: linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%);
      border-color: #cbd5e1;
    }

    hr {
      border: none;
      height: 1px;
      background: var(--border-color);
      margin: 32px 0;
    }

    a {
      color: var(--primary);
      text-decoration: underline;
    }

    img {
      max-width: 100%;
      height: auto;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-color);
      margin: 16px auto;
      display: block;
    }

    /* === Cadre des Schémas Mermaid (Fond légèrement plus foncé + léger ombrage) === */
    .mermaid-card {
      margin: 24px 0;
      padding: 22px 26px;
      background: linear-gradient(180deg, #e9f0f8 0%, #e1eaf5 100%);
      border: 1px solid #cbd5e1;
      border-left: 4px solid var(--primary);
      border-radius: 10px;
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.09), inset 0 1px 0 rgba(255, 255, 255, 0.65);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow-x: auto;
    }

    .mermaid-diagram {
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .mermaid-diagram svg {
      max-width: 100%;
      height: auto !important;
      display: block;
      margin: 0 auto;
    }

    .mermaid-card--pending {
      align-items: stretch;
    }

    .mermaid-source {
      margin: 0;
      font-family: var(--font-mono);
      font-size: 0.86rem;
      color: var(--text-main);
      white-space: pre-wrap;
    }

    /* === Tableaux === */
    .table-responsive-wrapper {
      width: 100%;
      overflow-x: auto;
      margin: 20px 0;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-sm);
      background: #ffffff;
    }

    .doc-table {
      width: 100%;
      border-collapse: collapse;
      border-spacing: 0;
    }

    .doc-table thead {
      background: var(--primary);
      color: #ffffff;
    }

    .doc-table th {
      padding: 10px 12px;
      text-align: left;
      font-weight: 700;
      font-size: 0.82rem;
      border-right: 1px solid rgba(255, 255, 255, 0.2);
    }

    .doc-table th:last-child {
      border-right: none;
    }

    .doc-table td {
      padding: 9px 12px;
      border-top: 1px solid var(--border-color);
      border-right: 1px solid var(--border-light);
      font-size: 0.85rem;
      color: var(--text-main);
    }

    .doc-table td:last-child {
      border-right: none;
    }

    .doc-table tbody tr:nth-child(even) td {
      background: #f8fafc;
    }

    /* === Blocs de Code Sobres === */
    pre.code-block {
      margin: 20px 0;
      padding: 16px 18px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-color);
      background: #1e293b;
      overflow-x: auto;
    }

    code {
      font-family: var(--font-mono);
      font-size: 0.88rem;
    }

    p code, li code, td code {
      background: #f1f5f9;
      color: var(--primary-dark);
      padding: 2px 5px;
      border-radius: 3px;
      font-size: 0.85em;
      border: 1px solid var(--border-color);
    }

    .hljs { color: #f8fafc; background: transparent; }
    .hljs-keyword, .hljs-selector-tag { color: #f43f5e; }
    .hljs-title, .hljs-title.function_ { color: #60a5fa; font-weight: 600; }
    .hljs-string, .hljs-regexp { color: #34d399; }
    .hljs-comment { color: #94a3b8; font-style: italic; }
    .hljs-number, .hljs-literal { color: #fbbf24; }
    .hljs-attr, .hljs-variable { color: #a78bfa; }

    /* === Mode Slide === */
    .slide-container,
    .slide-controls {
      display: none;
    }

    body[data-view-mode="slide"] {
      overflow: hidden;
      height: 100vh;
    }

    body[data-view-mode="slide"] .document-layout {
      height: calc(100vh - var(--header-height));
      overflow: hidden;
    }

    body[data-view-mode="slide"] .document-body {
      padding: 0;
      max-width: 100%;
      height: calc(100vh - var(--header-height));
      overflow: hidden;
      position: relative;
    }

    body[data-view-mode="slide"] .markdown-rendered-content {
      display: none;
    }

    body[data-view-mode="slide"] .slide-container {
      display: block;
      width: 100%;
      height: calc(100vh - var(--header-height));
    }

    .slide {
      display: none;
      width: 100%;
      height: calc(100vh - var(--header-height));
      padding: 40px 60px 80px;
      overflow-y: auto;
      font-size: var(--slide-font-size);
    }

    .slide.active {
      display: flex;
      flex-direction: column;
    }

    .slide-inner {
      width: 100%;
      margin: 0 auto;
    }

    /* Diapositive de titre / couverture */
    .slide.slide-title {
      justify-content: center;
      align-items: center;
      text-align: center;
    }

    .slide-title-inner {
      max-width: 900px;
      margin: auto;
    }

    .slide-title-card {
      padding: 56px 48px;
      background: linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%);
      border: 1px solid var(--border-color);
      border-top: 6px solid var(--primary);
      border-radius: var(--radius-md);
      box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);
    }

    .slide-main-title {
      font-size: 2.6rem;
      font-weight: 800;
      color: var(--text-main);
      margin-bottom: 20px;
      line-height: 1.25;
    }

    .slide-title-meta {
      font-size: 1.05rem;
      color: var(--text-muted);
      font-weight: 500;
    }

    /* Diapositive d'inter-titre / chapitre */
    .slide.slide-chapter {
      justify-content: center;
      align-items: center;
      text-align: center;
    }

    .slide-chapter-inner {
      max-width: 860px;
      margin: auto;
    }

    .slide-chapter-card {
      padding: 48px 40px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1px solid #bfdbfe;
      border-left: 6px solid var(--primary);
      border-radius: var(--radius-md);
      box-shadow: 0 8px 20px rgba(37, 99, 235, 0.08);
    }

    .slide-chapter-badge {
      display: inline-block;
      text-transform: uppercase;
      font-size: 0.82rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--primary);
      background: #ffffff;
      padding: 4px 12px;
      border-radius: var(--radius-sm);
      margin-bottom: 16px;
      border: 1px solid #bfdbfe;
    }

    .slide-chapter-title {
      font-size: 2.2rem;
      font-weight: 700;
      color: var(--text-main);
      line-height: 1.3;
      margin-bottom: 14px;
    }

    .slide-chapter-date {
      font-size: 0.92rem;
      color: var(--text-muted);
    }

    /* Diapositive de contenu */
    .slide.slide-content {
      justify-content: flex-start;
      align-items: stretch;
    }

    .slide-content-inner {
      max-width: 1100px;
      width: 100%;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      flex: 1;
    }

    .slide-header {
      padding-bottom: 14px;
      margin-bottom: 22px;
      border-bottom: 2px solid var(--border-color);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .slide-chapter-tag {
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--primary);
    }

    .slide-header-title {
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--text-main);
      line-height: 1.3;
    }

    .slide-body {
      flex: 1;
    }

    .slide-body p, .slide-body li {
      font-size: 1.25rem;
      line-height: 1.65;
      margin-bottom: 12px;
    }

    .slide-body h3 {
      font-size: 1.4rem;
      margin-top: 18px;
      margin-bottom: 10px;
      color: var(--primary);
    }

    .slide-body h4 {
      font-size: 1.2rem;
      margin-top: 14px;
      margin-bottom: 8px;
      color: var(--text-muted);
    }

    .slide-body .table-responsive-wrapper {
      margin: 16px 0;
    }

    .slide-body .doc-table th, .slide-body .doc-table td {
      font-size: 0.95rem;
      padding: 8px 12px;
    }

    .slide-body .mermaid-card {
      margin: 18px 0;
      padding: 16px 20px;
    }

    body[data-view-mode="slide"] .slide-controls {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
      position: fixed;
      bottom: 16px;
      right: 24px;
      z-index: 800;
      background: rgba(255, 255, 255, 0.95);
      border: 1px solid var(--border-color);
      padding: 6px 12px;
      border-radius: var(--radius-md);
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
    }

    .slide-counter {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-main);
    }

    @media print {
      .top-banner, .toc-sidebar, .slide-controls {
        display: none !important;
      }
      body {
        height: auto !important;
        overflow: visible !important;
      }
      .document-layout, .document-body {
        display: block !important;
        padding: 0 !important;
        max-width: 100% !important;
      }
      .markdown-rendered-content {
        display: block !important;
      }
      .slide-container {
        display: none !important;
      }
      .mermaid-card {
        background: #e6eef8 !important;
        border: 1px solid #cbd5e1 !important;
        border-left: 4px solid var(--primary) !important;
        box-shadow: none !important;
        page-break-inside: avoid;
        break-inside: avoid;
      }
    }
  `;

  const documentJS = `
    (function() {
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

        if (document.body.getAttribute('data-view-mode') === 'slide') {
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
          return;
        }

        const target = document.getElementById(targetId);
        if (!target) return;

        const banner = document.querySelector('.top-banner');
        const bannerHeight = banner ? banner.offsetHeight : 56;
        const elementPos = target.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo({
          top: elementPos - bannerHeight - 16,
          behavior: 'smooth'
        });
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
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
            e.preventDefault();
            window.nextSlide();
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
            e.preventDefault();
            window.prevSlide();
          }
        });
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
        initScrollSpy();
        initSlideMode();
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDocument);
      } else {
        initDocument();
      }
    })();
  `;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(docTitle || 'Document')}</title>
  <style>${documentCSS}</style>
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
    <aside class="toc-sidebar" id="tocSidebar">
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
      <article class="markdown-rendered-content">
        ${parsedContent}
      </article>
      <div class="slide-container" id="slideContainer">
        ${slidesHTML}
      </div>
    </main>
  </div>

  <div class="slide-controls">
    <button type="button" class="banner-btn" id="slidePrev" onclick="prevSlide()">Précédent</button>
    <span class="slide-counter" id="slideCounter">0 / 0</span>
    <button type="button" class="banner-btn" id="slideNext" onclick="nextSlide()">Suivant</button>
  </div>

  <script>${documentJS}</script>
</body>
</html>`;
};
