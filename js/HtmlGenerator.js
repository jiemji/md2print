/**
 * HtmlGenerator.js — Génération du document HTML autonome (et de l'aperçu iframe)
 * Intègre CSS (thème Azur classique), Sommaire latéral repliable avec ScrollSpy,
 * et support des modes Rapport continu et Slide interactif (100 % textuel, sans icône ni émoji).
 */
import { toSlug, escapeHtml, normalizeMarkdown, resolveImagePaths } from './utils.js';

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
 * Convertit le Markdown normalisé en HTML via Marked.js et Highlight.js.
 * @param {string} cleanMarkdown
 * @returns {string}
 */
const parseMarkdownToHTML = (cleanMarkdown) => {
  if (typeof window.marked === 'undefined') {
    return '<p>Erreur : La bibliothèque Marked.js n\'est pas chargée.</p>';
  }

  const renderer = new window.marked.Renderer();
  const usedSlugs = new Set();

  renderer.heading = ({ text, depth }) => {
    const cleanTitle = text.replace(/<[^>]*>/g, '').replace(/[*_`]/g, '').trim();
    const baseSlug = toSlug(cleanTitle) || `section-${depth}`;
    let uniqueSlug = baseSlug;
    let counter = 1;
    while (usedSlugs.has(uniqueSlug)) {
      uniqueSlug = `${baseSlug}-${counter++}`;
    }
    usedSlugs.add(uniqueSlug);

    if (depth === 1) {
      return `<h1 id="${uniqueSlug}" class="doc-heading doc-main-title">${text}</h1>`;
    }
    return `<h${depth} id="${uniqueSlug}" class="doc-heading doc-h${depth}">${text}</h${depth}>`;
  };

  // Rendu sobre des blocs de code avec coloration syntaxique, sans en-tête ni bouton Copier
  renderer.code = ({ text, lang }) => {
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

  renderer.listitem = ({ text, task, checked }) => {
    let formattedText = text;
    if (typeof formattedText === 'string' && formattedText.includes('**')) {
      formattedText = formattedText.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    }
    if (task) {
      const checkClass = checked ? 'task-checked' : 'task-unchecked';
      const boxText = checked ? '[x]' : '[ ]';
      return `<li class="task-list-item ${checkClass}"><span class="task-box">${boxText}</span> <span class="task-label">${formattedText}</span></li>`;
    }
    return `<li>${formattedText}</li>`;
  };

  window.marked.setOptions({
    renderer,
    gfm: true,
    breaks: true,
  });

  const parsed = window.marked.parse(cleanMarkdown);

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
 * @returns {string} Code HTML autonome complet
 */
export const generateStandaloneHTML = (rawMarkdown, options = {}) => {
  const {
    docTitle = 'Document',
    viewMode = 'report',
    localImages = {},
  } = options;

  const resolvedMarkdown = resolveImagePaths(rawMarkdown || '', localImages);
  const cleanMarkdown = normalizeMarkdown(resolvedMarkdown);
  const tocList = extractTOC(cleanMarkdown);
  const parsedContent = parseMarkdownToHTML(cleanMarkdown);
  const formattedDate = new Date().toLocaleDateString('fr-FR');

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
      padding: 40px 80px 72px;
      overflow-y: auto;
      font-size: var(--slide-font-size);
    }

    .slide.active {
      display: flex;
      flex-direction: column;
    }

    .slide.slide-h2 {
      justify-content: center;
      align-items: center;
      text-align: center;
    }

    .slide.slide-h2 .slide-inner {
      max-width: 920px;
      width: 100%;
      margin: auto;
    }

    .slide.slide-h3 {
      justify-content: flex-start;
      align-items: flex-start;
      text-align: left;
    }

    .slide.slide-h3 .slide-inner {
      max-width: 1040px;
      width: 100%;
      margin: 0 auto;
    }

    .slide p, .slide li {
      font-size: 1.35rem;
      line-height: 1.6;
    }

    .slide .doc-table th, .slide .doc-table td {
      font-size: 1rem;
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
        if (document.body.getAttribute('data-view-mode') !== 'slide') return;
        const content = document.querySelector('.markdown-rendered-content');
        const container = document.getElementById('slideContainer');
        if (!content || !container) return;

        container.innerHTML = '';
        const children = Array.from(content.children);
        if (children.length === 0) return;

        const slides = [];
        let currentElements = [];
        let currentLevel = 2;
        let currentSlug = '';

        function flushSlide() {
          if (currentElements.length === 0) return;
          const slide = document.createElement('div');
          slide.className = 'slide ' + (currentLevel === 3 ? 'slide-h3' : 'slide-h2');
          if (currentSlug) slide.dataset.slug = currentSlug;

          const inner = document.createElement('div');
          inner.className = 'slide-inner';
          currentElements.forEach((el) => inner.appendChild(el.cloneNode(true)));
          slide.appendChild(inner);
          slides.push(slide);
          currentElements = [];
        }

        children.forEach((child) => {
          const tag = child.tagName;
          if (tag === 'H1' || tag === 'H2') {
            flushSlide();
            currentLevel = 2;
            currentSlug = child.id || '';
            currentElements.push(child);
          } else if (tag === 'H3') {
            flushSlide();
            currentLevel = 3;
            currentSlug = child.id || '';
            currentElements.push(child);
          } else {
            currentElements.push(child);
          }
        });
        flushSlide();

        slides.forEach((slide, idx) => {
          if (idx === 0) slide.classList.add('active');
          container.appendChild(slide);
        });

        totalSlides = slides.length;
        currentSlideIndex = 0;
        updateSlideControls();

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
      <div class="slide-container" id="slideContainer"></div>
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
