/**
 * @module defaultThemeStyles
 * @description Feuilles de style CSS par défaut intégrées pour md2print.
 * Fournit les styles CSS paramétrables pour :
 *  - La vision Rapport (inspirée des styles, couleurs et marges de Modele_word.docx)
 *  - La vision Slide (inspirée de la charte 16:9 et des masques de Modele_presentation.potx)
 * Ces styles sont 100 % autonomes et fonctionnent sans dépendance externe ni connexion réseau.
 */

export const DEFAULT_REPORT_CSS = `/* ==========================================================================
   md2print — Thème par Défaut : Vision Rapport (Inspiré de Modele_word.docx)
   ========================================================================== */
:root {
  /* 1. Typographie (Modele_word.docx : Calibri Light & Calibri) */
  --report-font-body: 'Calibri', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --report-font-heading: 'Calibri Light', 'Segoe UI Light', 'Calibri', -apple-system, sans-serif;
  --report-font-mono: Consolas, 'JetBrains Mono', 'Courier New', monospace;

  --report-font-size-base: 1rem;
  --report-line-height-base: 1.55;

  --report-title-size: clamp(2rem, 3.2vw, 2.5rem);
  --report-h1-size: 1.65rem;
  --report-h2-size: 1.35rem;
  --report-h3-size: 1.18rem;
  --report-h4-size: 1.05rem;
  --report-h5-size: 0.95rem;
  --report-h6-size: 0.88rem;

  /* 2. Palette de couleurs (Modele_word.docx) */
  --report-color-h1: #C00000;
  --report-color-h2: #2F5496;
  --report-color-h3: #2F5496;
  --report-color-h4: #2F5496;
  --report-color-h5: #2F5496;
  --report-color-h6: #595959;
  --report-color-subtitle: #595959;

  --report-color-text: #272727;
  --report-color-muted: #595959;
  --report-color-dim: #8c8c8c;
  --report-color-link: #0563C1;
  --report-color-link-hover: #104a8e;

  --report-bg-backdrop: #f1f5f9;
  --report-bg-paper: #ffffff;
  --report-bg-sidebar: #f8fafc;
  --report-bg-header: #ffffff;
  --report-border-color: #d1d5db;
  --report-border-light: #e5e7eb;

  --report-accent-blue: #4472C4;
  --report-accent-orange: #ED7D31;
  --report-accent-gray: #A5A5A5;
  --report-accent-gold: #FFC000;
  --report-accent-cyan: #5B9BD5;
  --report-accent-green: #70AD47;

  /* 3. Mise en page & Marges Word (25 mm = 1417 dxa) */
  --report-page-max-width: 960px;
  --report-page-padding-y: 44px;
  --report-page-padding-x: 52px;
  --report-paper-shadow: 0 4px 20px rgba(15, 23, 42, 0.07), 0 1px 3px rgba(15, 23, 42, 0.04);
  --report-paper-radius: 4px;

  --report-header-height: 56px;
  --report-sidebar-width: 290px;
  --report-radius-sm: 4px;
  --report-radius-md: 6px;

  /* 4. Tableaux (TableauNormal Word & output_config.json) */
  --report-table-header-bg: #003366;
  --report-table-header-color: #ffffff;
  --report-table-border: #cccccc;
  --report-table-border-light: #e8e8e8;
  --report-table-row-even: #f9f9f9;
  --report-table-row-hover: #eef4fb;

  /* 5. Citations & Callouts */
  --report-quote-text: #404040;
  --report-quote-border: #2F5496;
  --report-quote-bg: rgba(47, 84, 150, 0.05);

  --report-callout-note-border: #2F5496;
  --report-callout-note-bg: rgba(47, 84, 150, 0.06);
  --report-callout-note-title: #1f3b6c;

  --report-callout-tip-border: #70AD47;
  --report-callout-tip-bg: rgba(112, 173, 71, 0.08);
  --report-callout-tip-title: #4d7a2f;

  --report-callout-warning-border: #ED7D31;
  --report-callout-warning-bg: rgba(237, 125, 49, 0.08);
  --report-callout-warning-title: #ad5319;

  --report-callout-danger-border: #C00000;
  --report-callout-danger-bg: rgba(192, 0, 0, 0.07);
  --report-callout-danger-title: #910000;

  --report-callout-important-border: #5B9BD5;
  --report-callout-important-bg: rgba(91, 155, 213, 0.08);
  --report-callout-important-title: #2b6da8;

  /* 6. Cartouches métriques & badges */
  --report-metric-val-size: clamp(3rem, 4.8rem, 5.2rem);
  --report-metric-val-color: #C00000;
  --report-metric-accent: #2F5496;
  --report-metric-bg-start: #ffffff;
  --report-metric-bg-end: #f8fafc;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
  font-size: 16px;
  background-color: var(--report-bg-backdrop);
}

body {
  font-family: var(--report-font-body);
  background-color: var(--report-bg-backdrop);
  color: var(--report-color-text);
  line-height: var(--report-line-height-base);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.top-banner {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  height: var(--report-header-height);
  background: var(--report-bg-header);
  border-bottom: 1px solid var(--report-border-color);
  z-index: 1000;
  display: flex;
  align-items: center;
  padding: 0 24px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
}

.banner-inner {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 16px;
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
  font-family: var(--report-font-heading);
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--report-color-h2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.banner-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
}

.banner-date {
  font-size: 0.82rem;
  color: var(--report-color-muted);
}

.banner-btn {
  background: #ffffff;
  border: 1px solid var(--report-border-color);
  color: var(--report-color-text);
  padding: 6px 14px;
  border-radius: var(--report-radius-sm);
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.banner-btn:hover {
  background: rgba(47, 84, 150, 0.08);
  border-color: var(--report-color-h2);
  color: var(--report-color-h2);
}

.document-layout {
  display: flex;
  flex: 1;
  width: 100%;
  min-height: calc(100vh - var(--report-header-height));
}

.toc-sidebar {
  width: var(--report-sidebar-width);
  min-width: var(--report-sidebar-width);
  background: var(--report-bg-sidebar);
  border-right: 1px solid var(--report-border-color);
  position: sticky;
  top: var(--report-header-height);
  height: calc(100vh - var(--report-header-height));
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 24px 16px;
  transition: margin-left 0.25s ease, opacity 0.2s ease;
  z-index: 500;
}

.toc-sidebar.collapsed {
  margin-left: calc(-1 * var(--report-sidebar-width));
  opacity: 0;
  pointer-events: none;
}

.toc-header-block {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--report-border-color);
}

.toc-title {
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--report-color-muted);
}

.toc-counter {
  font-size: 0.72rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--report-radius-sm);
  background: rgba(47, 84, 150, 0.1);
  color: var(--report-color-h2);
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
  border-radius: var(--report-radius-sm);
  text-decoration: none;
  color: var(--report-color-muted);
  font-size: 0.84rem;
  line-height: 1.4;
  border-left: 3px solid transparent;
  transition: background 0.15s ease, color 0.15s ease;
}

.toc-link:hover {
  color: var(--report-color-h2);
  background: #ffffff;
}

.toc-item.active > .toc-link {
  color: var(--report-color-h2);
  font-weight: 700;
  background: #ffffff;
  border-left-color: var(--report-color-h2);
}

.toc-h1 .toc-link {
  font-weight: 700;
  color: var(--report-color-text);
}

.toc-h2 .toc-link {
  padding-left: 16px;
  font-weight: 600;
}

.toc-h3 .toc-link {
  padding-left: 28px;
  font-size: 0.78rem;
}

.toc-empty {
  font-size: 0.8rem;
  color: var(--report-color-dim);
  font-style: italic;
  padding: 8px;
}

.document-body {
  flex: 1;
  padding: 32px 24px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-width: 0;
}

.markdown-rendered-content {
  background: var(--report-bg-paper);
  width: 100%;
  max-width: var(--report-page-max-width);
  padding: var(--report-page-padding-y) var(--report-page-padding-x);
  border-radius: var(--report-paper-radius);
  border: 1px solid var(--report-border-color);
  box-shadow: var(--report-paper-shadow);
  font-size: var(--report-font-size-base);
  color: var(--report-color-text);
}

.doc-heading {
  scroll-margin-top: calc(var(--report-header-height) + 24px);
}

.doc-main-title {
  font-family: var(--report-font-heading);
  font-size: var(--report-title-size);
  font-weight: 700;
  color: var(--report-color-h1);
  text-align: center;
  margin-top: 10px;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 2px solid var(--report-color-h1);
  line-height: 1.25;
  letter-spacing: -0.01em;
}

.doc-h2 {
  font-family: var(--report-font-heading);
  font-size: var(--report-h1-size);
  font-weight: 700;
  color: var(--report-color-h1);
  margin-top: 36px;
  margin-bottom: 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--report-border-light);
  line-height: 1.3;
}

.doc-h3 {
  font-family: var(--report-font-heading);
  font-size: var(--report-h2-size);
  font-weight: 600;
  color: var(--report-color-h2);
  margin-top: 26px;
  margin-bottom: 10px;
  line-height: 1.35;
}

.doc-h4 {
  font-family: var(--report-font-body);
  font-size: var(--report-h3-size);
  font-weight: 600;
  color: var(--report-color-h3);
  margin-top: 20px;
  margin-bottom: 8px;
  line-height: 1.4;
}

.doc-h5, .doc-h6 {
  font-family: var(--report-font-body);
  font-size: var(--report-h4-size);
  font-weight: 600;
  color: var(--report-color-h6);
  margin-top: 16px;
  margin-bottom: 6px;
}

p {
  margin-bottom: 14px;
  line-height: var(--report-line-height-base);
  text-align: justify;
}

ul, ol {
  margin-bottom: 16px;
  padding-left: 28px;
}

li {
  margin-bottom: 6px;
  line-height: var(--report-line-height-base);
}

.task-list-item {
  list-style: none;
  margin-left: -20px;
}

.task-box {
  font-family: var(--report-font-mono);
  font-size: 0.85em;
  color: var(--report-color-h2);
  font-weight: 700;
  margin-right: 6px;
}

.task-checked .task-label {
  color: var(--report-color-muted);
  text-decoration: line-through;
}

blockquote {
  margin: 20px 0;
  padding: 14px 20px;
  background: var(--report-quote-bg);
  border-left: 4px solid var(--report-quote-border);
  border-radius: 0 var(--report-radius-sm) var(--report-radius-sm) 0;
  color: var(--report-quote-text);
  font-style: italic;
}

blockquote p:last-child {
  margin-bottom: 0;
}

.callout {
  margin: 20px 0;
  padding: 14px 18px;
  border-radius: 0 var(--report-radius-sm) var(--report-radius-sm) 0;
  border-left: 4px solid var(--callout-border, var(--report-callout-note-border));
  background: var(--callout-bg, var(--report-callout-note-bg));
  color: var(--report-color-text);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.callout-header {
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--callout-title, var(--report-callout-note-title));
  margin-bottom: 6px;
  user-select: none;
}

.callout-body {
  font-size: 0.95rem;
  line-height: 1.55;
}

.callout-body > :first-child {
  margin-top: 0;
}

.callout-body > :last-child {
  margin-bottom: 0;
}

.callout-note, .callout-info {
  --callout-border: var(--report-callout-note-border);
  --callout-bg: var(--report-callout-note-bg);
  --callout-title: var(--report-callout-note-title);
}

.callout-tip, .callout-astuce, .callout-success {
  --callout-border: var(--report-callout-tip-border);
  --callout-bg: var(--report-callout-tip-bg);
  --callout-title: var(--report-callout-tip-title);
}

.callout-warning, .callout-avertissement, .callout-warn {
  --callout-border: var(--report-callout-warning-border);
  --callout-bg: var(--report-callout-warning-bg);
  --callout-title: var(--report-callout-warning-title);
}

.callout-danger, .callout-caution, .callout-attention, .callout-critique {
  --callout-border: var(--report-callout-danger-border);
  --callout-bg: var(--report-callout-danger-bg);
  --callout-title: var(--report-callout-danger-title);
}

.callout-important {
  --callout-border: var(--report-callout-important-border);
  --callout-bg: var(--report-callout-important-bg);
  --callout-title: var(--report-callout-important-title);
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.72rem;
  font-weight: 600;
  line-height: 1.2;
  padding: 0.2em 0.65em;
  border-radius: var(--report-radius-sm);
  vertical-align: baseline;
  letter-spacing: 0.02em;
  white-space: nowrap;
  margin: 0 0.25em;
}

.badge-info, .badge-note {
  background: rgba(47, 84, 150, 0.12);
  color: var(--report-color-h2);
  border: 1px solid rgba(47, 84, 150, 0.3);
}

.badge-success, .badge-tip, .badge-astuce, .badge-ok, .badge-valide {
  background: rgba(112, 173, 71, 0.15);
  color: #3b6321;
  border: 1px solid rgba(112, 173, 71, 0.35);
}

.badge-warning, .badge-warn, .badge-avertissement {
  background: rgba(237, 125, 49, 0.14);
  color: #a44810;
  border: 1px solid rgba(237, 125, 49, 0.35);
}

.badge-danger, .badge-caution, .badge-attention, .badge-critique, .badge-error {
  background: rgba(192, 0, 0, 0.12);
  color: var(--report-color-h1);
  border: 1px solid rgba(192, 0, 0, 0.35);
}

.badge-important {
  background: rgba(91, 155, 213, 0.15);
  color: #1f568a;
  border: 1px solid rgba(91, 155, 213, 0.4);
}

.badge-neutral, .badge-neutre, .badge-gray, .badge-default {
  background: rgba(165, 165, 165, 0.18);
  color: var(--report-color-text);
  border: 1px solid var(--report-border-color);
}

.metric-card {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  margin: 16px 14px 16px 0;
  padding: 20px 30px;
  min-width: 190px;
  border-radius: var(--report-radius-md);
  background: linear-gradient(180deg, var(--report-metric-bg-start) 0%, var(--report-metric-bg-end) 100%);
  border: 1px solid var(--report-border-color);
  border-top: 5px solid var(--report-metric-accent);
  box-shadow: 0 3px 12px rgba(15, 23, 42, 0.06);
  text-align: center;
}

.metric-value {
  font-family: var(--report-font-heading);
  font-size: var(--report-metric-val-size);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.02em;
  color: var(--report-metric-val-color);
}

.metric-label {
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--report-color-muted);
  margin-top: 8px;
  max-width: 240px;
  line-height: 1.3;
}

.table-responsive-wrapper {
  width: 100%;
  overflow-x: auto;
  margin: 20px 0;
  border: 1px solid var(--report-table-border);
  border-radius: var(--report-radius-sm);
  background: #ffffff;
}

.doc-table {
  width: 100%;
  border-collapse: collapse;
  border-spacing: 0;
}

.doc-table thead {
  background: var(--report-table-header-bg);
  color: var(--report-table-header-color);
}

.doc-table th {
  padding: 10px 14px;
  text-align: left;
  font-weight: 700;
  font-size: 0.85rem;
  border-right: 1px solid rgba(255, 255, 255, 0.15);
}

.doc-table th:last-child {
  border-right: none;
}

.doc-table td {
  padding: 9px 14px;
  border-top: 1px solid var(--report-table-border-light);
  border-right: 1px solid var(--report-table-border-light);
  font-size: 0.86rem;
  color: var(--report-color-text);
}

.doc-table td:last-child {
  border-right: none;
}

.doc-table tbody tr:nth-child(even) td {
  background: var(--report-table-row-even);
}

.doc-table tbody tr:hover td {
  background: var(--report-table-row-hover);
}

.mermaid-card {
  margin: 24px 0;
  padding: 20px 24px;
  background: #f8fafc;
  border: 1px solid var(--report-border-color);
  border-left: 4px solid var(--report-color-h2);
  border-radius: var(--report-radius-sm);
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.05);
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
}

pre.code-block {
  margin: 18px 0;
  padding: 14px 18px;
  border-radius: var(--report-radius-sm);
  border: 1px solid var(--report-border-color);
  background: #1e293b;
  overflow-x: auto;
}

code {
  font-family: var(--report-font-mono);
  font-size: 0.88rem;
}

p code, li code, td code {
  background: #eef2f6;
  color: var(--report-color-h2);
  padding: 2px 5px;
  border-radius: 3px;
  font-size: 0.85em;
  border: 1px solid var(--report-border-light);
}

.hljs { color: #f8fafc; background: transparent; }
.hljs-keyword, .hljs-selector-tag { color: #f43f5e; }
.hljs-title, .hljs-title.function_ { color: #60a5fa; font-weight: 600; }
.hljs-string, .hljs-regexp { color: #34d399; }
.hljs-comment { color: #94a3b8; font-style: italic; }
.hljs-number, .hljs-literal { color: #fbbf24; }

a {
  color: var(--report-color-link);
  text-decoration: underline;
}

a:hover {
  color: var(--report-color-link-hover);
}

img {
  max-width: 100%;
  height: auto;
  border-radius: var(--report-radius-sm);
  border: 1px solid var(--report-border-color);
  margin: 16px auto;
  display: block;
}

hr {
  border: none;
  height: 1px;
  background: var(--report-border-color);
  margin: 28px 0;
}

.slide-container, .slide-controls {
  display: none !important;
}

@media print {
  @page {
    size: A4 portrait;
    margin: 25mm;
  }

  .top-banner, .toc-sidebar {
    display: none !important;
  }

  body {
    background: #ffffff !important;
    height: auto !important;
    overflow: visible !important;
  }

  .document-layout, .document-body {
    display: block !important;
    padding: 0 !important;
    max-width: 100% !important;
  }

  .markdown-rendered-content {
    box-shadow: none !important;
    border: none !important;
    padding: 0 !important;
    max-width: 100% !important;
  }

  .doc-h2 {
    page-break-before: auto;
    break-before: auto;
  }

  .mermaid-card, .table-responsive-wrapper, .metric-card {
    page-break-inside: avoid;
    break-inside: avoid;
    box-shadow: none !important;
  }
}
`;

export const DEFAULT_SLIDE_CSS = `/* ==========================================================================
   md2print — Thème par Défaut : Vision Slide (Inspiré de Modele_presentation.potx)
   ========================================================================== */
:root {
  /* 1. Typographie (Modele_presentation.potx : Aptos Display & Aptos) */
  --slide-font-body: 'Aptos', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --slide-font-heading: 'Aptos Display', 'Segoe UI Semibold', 'Aptos', -apple-system, sans-serif;
  --slide-font-mono: Consolas, 'JetBrains Mono', 'Courier New', monospace;

  --slide-font-size-base: 1.25rem;
  --slide-line-height-base: 1.6;

  --slide-title-cover-size: clamp(2.4rem, 4.5vw, 3.4rem);
  --slide-title-chapter-size: clamp(2rem, 3.6vw, 2.6rem);
  --slide-title-content-size: clamp(1.6rem, 2.6vw, 2.1rem);

  /* 2. Palette de couleurs (Modele_presentation.potx) */
  --slide-brand-red: #C41718;
  --slide-brand-red-alt: #C00000;
  --slide-brand-amber: #FBAE40;
  --slide-brand-dark: #0E2841;

  --slide-accent-teal: #156082;
  --slide-accent-coral: #E97132;
  --slide-accent-green: #196B24;
  --slide-accent-cyan: #0F9ED5;
  --slide-accent-purple: #A02B93;

  --slide-text-main: #0E2841;
  --slide-text-body: #1e293b;
  --slide-text-muted: #64748b;
  --slide-text-dim: #94a3b8;

  --slide-stage-backdrop: #0b1120;
  --slide-canvas-bg: #ffffff;
  --slide-border-color: #cbd5e1;
  --slide-shadow: 0 16px 48px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.15);
  --slide-radius: 8px;

  /* 3. Proportions 16:9 standard */
  --slide-max-width: 1280px;
  --slide-aspect-ratio: 16 / 9;
  --slide-padding-y: 44px;
  --slide-padding-x: 56px;

  /* 4. Tableaux */
  --slide-table-header-bg: #0E2841;
  --slide-table-header-color: #ffffff;
  --slide-table-border: #cbd5e1;
  --slide-table-border-light: #e2e8f0;
  --slide-table-row-even: #f8fafc;
  --slide-table-row-hover: #eef2f6;

  /* 5. Callouts & Citations */
  --slide-callout-border-width: 5px;

  /* 6. Cartouches métriques */
  --slide-metric-val-size: clamp(3.6rem, 5.5rem, 6.5rem);
  --slide-metric-accent: #C41718;
  --slide-metric-val-color: #0E2841;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  height: 100%;
  overflow: hidden;
  background-color: var(--slide-stage-backdrop);
  color: var(--slide-text-body);
  font-family: var(--slide-font-body);
  line-height: var(--slide-line-height-base);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.markdown-rendered-content {
  display: none !important;
}

.document-layout {
  height: 100vh;
  width: 100vw;
  display: flex;
  overflow: hidden;
}

.document-body {
  flex: 1;
  height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow: hidden;
  position: relative;
}

.toc-sidebar, .top-banner {
  display: none !important;
}

.slide-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  max-width: var(--slide-max-width);
  max-height: calc(var(--slide-max-width) * 9 / 16);
  aspect-ratio: var(--slide-aspect-ratio);
  position: relative;
  margin: auto;
}

.slide {
  display: none;
  width: 100%;
  height: 100%;
  background: var(--slide-canvas-bg);
  border-radius: var(--slide-radius);
  box-shadow: var(--slide-shadow);
  overflow-y: auto;
  position: relative;
  animation: slideFadeIn 0.25s ease-out;
}

.slide.active {
  display: flex;
  flex-direction: column;
}

@keyframes slideFadeIn {
  from {
    opacity: 0;
    transform: scale(0.985);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.slide.slide-title {
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 60px 70px;
  background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
  position: relative;
}

.slide.slide-title::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 8px;
  background: linear-gradient(90deg, var(--slide-brand-red) 0%, var(--slide-brand-red) 70%, var(--slide-brand-amber) 100%);
  border-top-left-radius: var(--slide-radius);
  border-top-right-radius: var(--slide-radius);
}

.slide-title-inner {
  max-width: 960px;
  width: 100%;
  margin: auto;
}

.slide-title-card {
  padding: 44px 36px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.slide-main-title {
  font-family: var(--slide-font-heading);
  font-size: var(--slide-title-cover-size);
  font-weight: 700;
  color: var(--slide-text-main);
  line-height: 1.2;
  letter-spacing: -0.01em;
}

.slide-title-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 10px;
}

.slide-title-date {
  font-size: 1.05rem;
  color: var(--slide-text-muted);
  font-weight: 500;
  padding: 6px 16px;
  background: rgba(14, 40, 65, 0.06);
  border-radius: 9999px;
  border: 1px solid rgba(14, 40, 65, 0.12);
}

.slide.slide-chapter {
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 60px 70px;
  background: linear-gradient(145deg, #f8fafc 0%, #edf2f7 100%);
  position: relative;
}

.slide.slide-chapter::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 10px;
  background: var(--slide-brand-red);
  border-top-left-radius: var(--slide-radius);
  border-bottom-left-radius: var(--slide-radius);
}

.slide-chapter-inner {
  max-width: 900px;
  width: 100%;
  margin: auto;
}

.slide-chapter-card {
  padding: 40px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.slide-chapter-badge {
  display: inline-block;
  text-transform: uppercase;
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #ffffff;
  background: var(--slide-brand-dark);
  padding: 5px 16px;
  border-radius: 4px;
}

.slide-chapter-title {
  font-family: var(--slide-font-heading);
  font-size: var(--slide-title-chapter-size);
  font-weight: 700;
  color: var(--slide-text-main);
  line-height: 1.25;
}

.slide-chapter-date {
  font-size: 0.95rem;
  color: var(--slide-text-muted);
}

.slide.slide-content {
  justify-content: flex-start;
  align-items: stretch;
  padding: var(--slide-padding-y) var(--slide-padding-x);
  position: relative;
}

.slide.slide-content::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 6px;
  background: linear-gradient(90deg, var(--slide-brand-red) 0%, var(--slide-brand-red) 78%, var(--slide-brand-amber) 100%);
  border-top-left-radius: var(--slide-radius);
  border-top-right-radius: var(--slide-radius);
}

.slide-content-inner {
  width: 100%;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.slide-header {
  padding-bottom: 12px;
  margin-bottom: 20px;
  border-bottom: 2px solid var(--slide-border-color);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.slide-chapter-tag {
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--slide-brand-red);
}

.slide-header-title {
  font-family: var(--slide-font-heading);
  font-size: var(--slide-title-content-size);
  font-weight: 700;
  color: var(--slide-text-main);
  line-height: 1.25;
}

.slide-body {
  flex: 1;
  font-size: var(--slide-font-size-base);
  color: var(--slide-text-body);
}

.slide-body p, .slide-body li {
  font-size: var(--slide-font-size-base);
  line-height: var(--slide-line-height-base);
  margin-bottom: 12px;
}

.slide-body ul, .slide-body ol {
  margin-bottom: 18px;
  padding-left: 32px;
}

.slide-body li {
  margin-bottom: 8px;
}

.slide-body h3 {
  font-family: var(--slide-font-heading);
  font-size: 1.35rem;
  font-weight: 600;
  color: var(--slide-brand-dark);
  margin-top: 16px;
  margin-bottom: 8px;
}

.slide-body h4 {
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--slide-text-muted);
  margin-top: 12px;
  margin-bottom: 6px;
}

.slide-body .table-responsive-wrapper {
  margin: 16px 0;
  border: 1px solid var(--slide-table-border);
  border-radius: 4px;
  background: #ffffff;
}

.slide-body .doc-table {
  width: 100%;
  border-collapse: collapse;
}

.slide-body .doc-table thead {
  background: var(--slide-table-header-bg);
  color: var(--slide-table-header-color);
}

.slide-body .doc-table th {
  padding: 10px 14px;
  text-align: left;
  font-weight: 700;
  font-size: 0.95rem;
  border-right: 1px solid rgba(255, 255, 255, 0.15);
}

.slide-body .doc-table th:last-child {
  border-right: none;
}

.slide-body .doc-table td {
  padding: 9px 14px;
  font-size: 0.92rem;
  border-top: 1px solid var(--slide-table-border-light);
  border-right: 1px solid var(--slide-table-border-light);
  color: var(--slide-text-body);
}

.slide-body .doc-table td:last-child {
  border-right: none;
}

.slide-body .doc-table tbody tr:nth-child(even) td {
  background: var(--slide-table-row-even);
}

.slide-body .metric-card {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 14px 14px 14px 0;
  padding: 20px 32px;
  min-width: 200px;
  border-radius: 8px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid var(--slide-table-border);
  border-top: 6px solid var(--slide-metric-accent);
  box-shadow: 0 4px 16px rgba(14, 40, 65, 0.08);
}

.slide-body .metric-value {
  font-family: var(--slide-font-heading);
  font-size: var(--slide-metric-val-size);
  font-weight: 700;
  line-height: 1.05;
  color: var(--slide-metric-val-color);
}

.slide-body .metric-label {
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--slide-text-muted);
  margin-top: 8px;
}

.slide-body blockquote {
  margin: 16px 0;
  padding: 12px 18px;
  background: rgba(14, 40, 65, 0.05);
  border-left: 5px solid var(--slide-brand-dark);
  border-radius: 0 4px 4px 0;
  color: var(--slide-text-body);
  font-style: italic;
}

.slide-body .callout {
  margin: 16px 0;
  padding: 12px 18px;
  border-radius: 0 4px 4px 0;
  border-left: var(--slide-callout-border-width) solid var(--callout-border, var(--slide-brand-red));
  background: var(--callout-bg, rgba(196, 23, 24, 0.06));
  color: var(--slide-text-body);
}

.slide-body .callout-note, .slide-body .callout-info {
  --callout-border: var(--slide-brand-dark);
  --callout-bg: rgba(14, 40, 65, 0.06);
  --callout-title: var(--slide-brand-dark);
}

.slide-body .callout-tip, .slide-body .callout-success {
  --callout-border: var(--slide-accent-green);
  --callout-bg: rgba(25, 107, 36, 0.07);
  --callout-title: var(--slide-accent-green);
}

.slide-body .callout-warning, .slide-body .callout-warn {
  --callout-border: var(--slide-brand-amber);
  --callout-bg: rgba(251, 174, 64, 0.1);
  --callout-title: #995c00;
}

.slide-body .callout-danger, .slide-body .callout-caution {
  --callout-border: var(--slide-brand-red);
  --callout-bg: rgba(196, 23, 24, 0.07);
  --callout-title: var(--slide-brand-red);
}

.slide-body .callout-header {
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 6px;
}

.slide-body .mermaid-card {
  margin: 16px 0;
  padding: 16px 20px;
  background: #f8fafc;
  border: 1px solid var(--slide-table-border);
  border-left: 4px solid var(--slide-brand-red);
  border-radius: 4px;
}

.slide-body .mermaid-diagram svg {
  max-width: 100%;
  max-height: 380px;
  height: auto;
  display: block;
  margin: 0 auto;
}

.slide-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  position: fixed;
  bottom: 20px;
  right: 28px;
  z-index: 1000;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(8px);
  border: 1px solid var(--slide-border-color);
  padding: 6px 14px;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
}

.banner-btn, .slide-controls button {
  background: #ffffff;
  border: 1px solid var(--slide-border-color);
  color: var(--slide-text-main);
  padding: 6px 14px;
  border-radius: 4px;
  font-family: inherit;
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.banner-btn:hover:not(:disabled), .slide-controls button:hover:not(:disabled) {
  background: rgba(196, 23, 24, 0.08);
  border-color: var(--slide-brand-red);
  color: var(--slide-brand-red);
}

.banner-btn:disabled, .slide-controls button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.slide-counter {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--slide-brand-dark);
  padding: 0 6px;
  font-variant-numeric: tabular-nums;
}

@media print {
  @page {
    size: landscape;
    margin: 0;
  }

  body {
    background: #ffffff !important;
    height: auto !important;
    overflow: visible !important;
  }

  .slide-controls {
    display: none !important;
  }

  .slide-container {
    display: block !important;
    width: 100% !important;
    max-width: 100% !important;
    height: auto !important;
  }

  .slide {
    display: block !important;
    width: 100% !important;
    height: 100vh !important;
    page-break-after: always;
    break-after: page;
    box-shadow: none !important;
    border-radius: 0 !important;
    padding: 30mm 25mm !important;
  }
}
`;
