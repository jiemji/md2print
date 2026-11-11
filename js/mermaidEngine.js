/**
 * @module mermaidEngine
 * @description Moteur de rendu, de mise en cache et de rastérisation des diagrammes Mermaid et xychart.
 * Gère :
 * - Les presets de thèmes visuels (`MERMAID_THEME_PRESETS`)
 * - La détection et l'encapsulation automatique des blocs Mermaid non délimités
 * - Le rendu vectoriel haute fidélité des graphiques `xychart` / `xychart-beta`
 * - Le cache mémoire LRU/FIFO des schémas SVG (`mermaidSvgCache`)
 * - La rastérisation PNG haute résolution (2x) avec cadre ombré pour Word (.docx) et PowerPoint (.pptx)
 *
 * @requires ./tagParsers.js
 */

import { isHtmlBlockOpenLine, isHtmlBlockCloseLine } from './tagParsers.js';

/**
 * Échappe les caractères spéciaux XML/HTML pour une injection sûre dans les nœuds SVG.
 * @param {string} [str='']
 * @returns {string}
 */
const escapeSvgXml = (str = '') =>
  String(str).replace(
    /[&<>'"]/g,
    (tag) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[tag] || tag
  );

/**
 * Normalise le code source d'un bloc Mermaid (fins de ligne LF et trim) pour servir de clé de cache fiable.
 * @param {string} [code='']
 * @returns {string}
 */
export const normalizeMermaidCode = (code = '') =>
  String(code)
    .replace(/\r\n?/g, '\n')
    .trim();

/**
 * Indique si une ligne correspond à l'en-tête de déclaration d'un diagramme Mermaid
 * (ex: graph TB, flowchart LR, sequenceDiagram, classDiagram, stateDiagram, erDiagram, gantt, pie...).
 * @param {string} [line='']
 * @returns {boolean}
 */
export const isMermaidHeaderLine = (line = '') => {
  const trimmed = line.trim();
  return /^(?:graph\s+(?:TB|TD|BT|RL|LR)|flowchart\s+(?:TB|TD|BT|RL|LR)|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|gantt|pie(?:\s+title\b)?|mindmap|timeline|journey|gitGraph|quadrantChart|xychart(?:-beta)?)\b/i.test(
    trimmed
  );
};

/**
 * Indique si une ligne fait partie de la syntaxe interne d'un diagramme Mermaid non délimité par ```.
 * @param {string} line
 * @returns {boolean}
 */
function isMermaidSyntaxLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;

  if (
    /^(?:subgraph|end|style|classDef|class|click|linkStyle|direction|participant|actor|note|loop|alt|else|opt|par|and|rect|activate|deactivate|autonumber|title|section|dateFormat|axisFormat|tickInterval|excludes|includes|todayMarker|state|accTitle|accDescr|%%|x-axis|y-axis|bar|line)\b/i.test(
      trimmed
    )
  ) {
    return true;
  }

  if (/-->|-\.->|==>|---|--\s|-\.-|\.\.>|o--o|x--x|<-->|:::/i.test(trimmed)) {
    return true;
  }

  if (/^[A-Za-z0-9_][\w-]*\s*(?:\[|\(|\{|\>|:)/.test(trimmed)) {
    return true;
  }

  if (/^(?: {2,}|\t+)\S/.test(line)) {
    return true;
  }

  return false;
}

/**
 * Détermine l'index de la dernière ligne appartenant à un bloc Mermaid non entouré de ```
 * commençant à l'index startIndex.
 * @param {string[]} lines - Tableau des lignes du document
 * @param {number} startIndex - Index de la ligne d'en-tête Mermaid (ex: graph TB)
 * @returns {number} Index de fin (inclusif) du bloc Mermaid
 */
export const findUnfencedMermaidBlockEnd = (lines, startIndex) => {
  let lastValidIdx = startIndex;
  let subgraphDepth = 0;
  let k = startIndex + 1;

  while (k < lines.length) {
    const rawLine = lines[k];
    const trimmed = rawLine.trim();

    if (trimmed === '') {
      k++;
      continue;
    }

    if (trimmed.startsWith('```')) {
      break;
    }

    if (subgraphDepth === 0) {
      if (
        /^#{1,6}\s+/.test(trimmed) ||
        /^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed) ||
        /^>\s?/.test(rawLine) ||
        /^\|.*\|/.test(trimmed) ||
        /^(?:[-*+]|\d+[.)])\s+/.test(rawLine)
      ) {
        break;
      }
    }

    if (subgraphDepth > 0 || isMermaidSyntaxLine(rawLine)) {
      if (/^(?:subgraph|loop|alt|opt|par|rect)\b/i.test(trimmed)) {
        subgraphDepth++;
      } else if (/^end\b/i.test(trimmed)) {
        subgraphDepth = Math.max(0, subgraphDepth - 1);
      }
      lastValidIdx = k;
      k++;
      continue;
    }

    break;
  }

  return lastValidIdx;
};

/**
 * Enveloppe automatiquement dans des balises ```mermaid ... ``` les schémas Mermaid
 * saisis directement dans le Markdown sans délimiteurs ``` (ou dans un bloc ``` sans langue),
 * afin qu'ils soient rendus uniformément en HTML, Word et PowerPoint.
 * @param {string} markdownText
 * @returns {string}
 */
export const wrapUnfencedMermaidBlocks = (markdownText) => {
  if (!markdownText) return '';
  const lines = markdownText.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmedStart = line.trimStart();

    if (trimmedStart.startsWith('```')) {
      const fenceLang = trimmedStart.replace(/^`+/, '').trim();
      const blockLines = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        blockLines.push(lines[i]);
        i++;
      }
      const closingFence = i < lines.length ? lines[i] : '```';
      if (i < lines.length) i++;

      const firstNonEmpty = blockLines.find((l) => l.trim().length > 0) || '';
      if (!fenceLang && isMermaidHeaderLine(firstNonEmpty)) {
        out.push('```mermaid');
      } else {
        out.push(line);
      }
      out.push(...blockLines);
      out.push(closingFence);
      continue;
    }

    if (isHtmlBlockOpenLine(line)) {
      let closeIdx = -1;
      for (let h = i + 1; h < lines.length; h++) {
        if (isHtmlBlockCloseLine(lines[h])) {
          closeIdx = h;
          break;
        }
      }
      if (closeIdx > i) {
        out.push('```html-exec');
        for (let h = i + 1; h < closeIdx; h++) {
          out.push(lines[h]);
        }
        out.push('```');
        i = closeIdx + 1;
        continue;
      }
    }

    if (isMermaidHeaderLine(line)) {
      const endIdx = findUnfencedMermaidBlockEnd(lines, i);
      if (endIdx > i) {
        out.push('```mermaid');
        for (let m = i; m <= endIdx; m++) {
          out.push(lines[m]);
        }
        out.push('```');
        i = endIdx + 1;
        continue;
      }
    }

    out.push(line);
    i++;
  }

  return out.join('\n');
};

let mermaidInitialized = false;
let mermaidIdSeq = 1;
const mermaidSvgCache = new Map();

/**
 * Presets de thèmes visuels applicables uniformément à tous les diagrammes Mermaid.
 * Chaque preset configure le thème Mermaid sous-jacent, les variables graphiques (themeVariables)
 * et le cadre haute résolution pour les exports Word (.docx) et PowerPoint (.pptx).
 * @type {Readonly<Record<string, { id: string, label: string, theme: string, themeVariables: Record<string, any>, xyChart: Record<string, any>, frame: { bg: string, border: string, accent: string }, sampleColors: Record<string, string> }>>}
 */
export const MERMAID_THEME_PRESETS = Object.freeze({
  default: {
    id: 'default',
    label: 'Standard (Mermaid par défaut)',
    theme: 'default',
    xyChart: {
      backgroundColor: 'transparent',
      titleColor: '#1f2937',
      xAxisTitleColor: '#1f2937',
      xAxisLabelColor: '#4b5563',
      xAxisTickColor: '#9ca3af',
      xAxisLineColor: '#9ca3af',
      yAxisTitleColor: '#1f2937',
      yAxisLabelColor: '#4b5563',
      yAxisTickColor: '#9ca3af',
      yAxisLineColor: '#9ca3af',
      plotColorPalette: '#3b82f6, #10b981, #f59e0b, #ef4444, #8b5cf6, #06b6d4, #ec4899, #14b8a6',
    },
    themeVariables: {
      plotColorPalette: '#3b82f6, #10b981, #f59e0b, #ef4444, #8b5cf6, #06b6d4, #ec4899, #14b8a6',
      pie1: '#3b82f6',
      pie2: '#10b981',
      pie3: '#f59e0b',
      pie4: '#ef4444',
      pie5: '#8b5cf6',
      pie6: '#06b6d4',
      pie7: '#ec4899',
      pie8: '#14b8a6',
      pie9: '#6366f1',
      pie10: '#84cc16',
      pie11: '#e11d48',
      pie12: '#0ea5e9',
      cScale0: '#3b82f6',
      cScale1: '#10b981',
      cScale2: '#f59e0b',
      cScale3: '#ef4444',
      cScale4: '#8b5cf6',
      cScale5: '#06b6d4',
      cScale6: '#ec4899',
      cScale7: '#14b8a6',
      git0: '#3b82f6',
      git1: '#10b981',
      git2: '#f59e0b',
      git3: '#ef4444',
      git4: '#8b5cf6',
      git5: '#06b6d4',
      git6: '#ec4899',
      git7: '#14b8a6',
      xyChart: {
        backgroundColor: 'transparent',
        titleColor: '#1f2937',
        xAxisTitleColor: '#1f2937',
        xAxisLabelColor: '#4b5563',
        xAxisTickColor: '#9ca3af',
        xAxisLineColor: '#9ca3af',
        yAxisTitleColor: '#1f2937',
        yAxisLabelColor: '#4b5563',
        yAxisTickColor: '#9ca3af',
        yAxisLineColor: '#9ca3af',
        plotColorPalette: '#3b82f6, #10b981, #f59e0b, #ef4444, #8b5cf6, #06b6d4, #ec4899, #14b8a6',
      },
    },
    frame: { bg: '#e6eef8', border: '#cbd5e1', accent: '#1e40af' },
    sampleColors: {
      node1: '#ECECFF',
      stroke1: '#9370DB',
      text1: '#111827',
      node2: '#ffffde',
      stroke2: '#aaaa33',
      text2: '#111827',
      line: '#333333',
    },
  },
  'noir-rouge': {
    id: 'noir-rouge',
    label: 'Noir & Rouge (Éditorial)',
    theme: 'base',
    xyChart: {
      backgroundColor: 'transparent',
      titleColor: '#111827',
      xAxisTitleColor: '#111827',
      xAxisLabelColor: '#4b5563',
      xAxisTickColor: '#C41718',
      xAxisLineColor: '#C41718',
      yAxisTitleColor: '#111827',
      yAxisLabelColor: '#4b5563',
      yAxisTickColor: '#C41718',
      yAxisLineColor: '#C41718',
      plotColorPalette: '#C41718, #111827, #ef4444, #4b5563, #991b1b, #6b7280, #f87171, #374151',
    },
    themeVariables: {
      primaryColor: '#ffffff',
      primaryTextColor: '#111827',
      primaryBorderColor: '#C41718',
      lineColor: '#C41718',
      secondaryColor: '#fef2f2',
      secondaryTextColor: '#111827',
      secondaryBorderColor: '#C41718',
      tertiaryColor: '#fff1f2',
      tertiaryTextColor: '#111827',
      tertiaryBorderColor: '#f87171',
      edgeLabelBackground: '#ffffff',
      clusterBkg: '#fff5f5',
      clusterBorder: '#f87171',
      actorBkg: '#ffffff',
      actorBorder: '#C41718',
      actorTextColor: '#111827',
      signalColor: '#C41718',
      signalTextColor: '#111827',
      labelBoxBkgColor: '#fef2f2',
      noteBkgColor: '#fef2f2',
      noteBorderColor: '#C41718',
      noteTextColor: '#991b1b',
      activationBkgColor: '#fca5a5',
      activationBorderColor: '#C41718',
      classText: '#111827',
      plotColorPalette: '#C41718, #111827, #ef4444, #4b5563, #991b1b, #6b7280, #f87171, #374151',
      pie1: '#C41718',
      pie2: '#111827',
      pie3: '#ef4444',
      pie4: '#6b7280',
      pie5: '#991b1b',
      pie6: '#374151',
      pie7: '#f87171',
      pie8: '#9ca3af',
      pie9: '#7f1d1d',
      pie10: '#4b5563',
      pie11: '#fca5a5',
      pie12: '#1f2937',
      cScale0: '#C41718',
      cScale1: '#111827',
      cScale2: '#ef4444',
      cScale3: '#4b5563',
      cScale4: '#991b1b',
      cScale5: '#6b7280',
      cScale6: '#f87171',
      cScale7: '#374151',
      git0: '#C41718',
      git1: '#111827',
      git2: '#ef4444',
      git3: '#4b5563',
      git4: '#991b1b',
      git5: '#6b7280',
      git6: '#f87171',
      git7: '#374151',
      quadrant1Fill: '#fef2f2',
      quadrant2Fill: '#fee2e2',
      quadrant3Fill: '#f3f4f6',
      quadrant4Fill: '#fff5f5',
      quadrantPointFill: '#C41718',
      quadrantTitleFill: '#111827',
      quadrantInternalBorderStrokeFill: '#fca5a5',
      quadrantExternalBorderStrokeFill: '#C41718',
      sectionBkgColor: '#fef2f2',
      altSectionBkgColor: '#ffffff',
      taskBkgColor: '#C41718',
      taskBorderColor: '#991b1b',
      taskTextColor: '#ffffff',
      activeTaskBkgColor: '#ef4444',
      activeTaskBorderColor: '#C41718',
      doneTaskBkgColor: '#4b5563',
      doneTaskBorderColor: '#111827',
      critBkgColor: '#991b1b',
      critBorderColor: '#7f1d1d',
      todayLineColor: '#C41718',
      gridColor: '#e5e7eb',
      xyChart: {
        backgroundColor: 'transparent',
        titleColor: '#111827',
        xAxisTitleColor: '#111827',
        xAxisLabelColor: '#4b5563',
        xAxisTickColor: '#C41718',
        xAxisLineColor: '#C41718',
        yAxisTitleColor: '#111827',
        yAxisLabelColor: '#4b5563',
        yAxisTickColor: '#C41718',
        yAxisLineColor: '#C41718',
        plotColorPalette: '#C41718, #111827, #ef4444, #4b5563, #991b1b, #6b7280, #f87171, #374151',
      },
    },
    frame: { bg: '#fef2f2', border: '#fca5a5', accent: '#C41718' },
    sampleColors: {
      node1: '#ffffff',
      stroke1: '#C41718',
      text1: '#111827',
      node2: '#fef2f2',
      stroke2: '#C41718',
      text2: '#991b1b',
      line: '#C41718',
    },
  },
  'bleu-corporate': {
    id: 'bleu-corporate',
    label: 'Bleu Corporate (Professionnel)',
    theme: 'base',
    xyChart: {
      backgroundColor: 'transparent',
      titleColor: '#0369a1',
      xAxisTitleColor: '#0369a1',
      xAxisLabelColor: '#075985',
      xAxisTickColor: '#0284c7',
      xAxisLineColor: '#0284c7',
      yAxisTitleColor: '#0369a1',
      yAxisLabelColor: '#075985',
      yAxisTickColor: '#0284c7',
      yAxisLineColor: '#0284c7',
      plotColorPalette: '#0284c7, #2563eb, #1e40af, #38bdf8, #0369a1, #60a5fa, #0c4a6e, #93c5fd',
    },
    themeVariables: {
      primaryColor: '#e0f2fe',
      primaryTextColor: '#0369a1',
      primaryBorderColor: '#0284c7',
      lineColor: '#2563eb',
      secondaryColor: '#f0f9ff',
      secondaryTextColor: '#075985',
      secondaryBorderColor: '#38bdf8',
      tertiaryColor: '#bae6fd',
      tertiaryTextColor: '#0c4a6e',
      tertiaryBorderColor: '#7dd3fc',
      edgeLabelBackground: '#ffffff',
      clusterBkg: '#f8fafc',
      clusterBorder: '#93c5fd',
      actorBkg: '#e0f2fe',
      actorBorder: '#0284c7',
      actorTextColor: '#0369a1',
      signalColor: '#2563eb',
      signalTextColor: '#1e3a8a',
      labelBoxBkgColor: '#f0f9ff',
      noteBkgColor: '#eff6ff',
      noteBorderColor: '#3b82f6',
      noteTextColor: '#1e40af',
      activationBkgColor: '#bfdbfe',
      activationBorderColor: '#2563eb',
      classText: '#0369a1',
      plotColorPalette: '#0284c7, #2563eb, #1e40af, #38bdf8, #0369a1, #60a5fa, #0c4a6e, #93c5fd',
      pie1: '#0284c7',
      pie2: '#2563eb',
      pie3: '#38bdf8',
      pie4: '#1e40af',
      pie5: '#0369a1',
      pie6: '#60a5fa',
      pie7: '#0c4a6e',
      pie8: '#93c5fd',
      pie9: '#1d4ed8',
      pie10: '#7dd3fc',
      pie11: '#1e3a8a',
      pie12: '#bae6fd',
      cScale0: '#0284c7',
      cScale1: '#2563eb',
      cScale2: '#1e40af',
      cScale3: '#38bdf8',
      cScale4: '#0369a1',
      cScale5: '#60a5fa',
      cScale6: '#0c4a6e',
      cScale7: '#93c5fd',
      git0: '#0284c7',
      git1: '#2563eb',
      git2: '#1e40af',
      git3: '#38bdf8',
      git4: '#0369a1',
      git5: '#60a5fa',
      git6: '#0c4a6e',
      git7: '#93c5fd',
      quadrant1Fill: '#f0f9ff',
      quadrant2Fill: '#e0f2fe',
      quadrant3Fill: '#bae6fd',
      quadrant4Fill: '#f0f9ff',
      quadrantPointFill: '#0284c7',
      quadrantTitleFill: '#0369a1',
      quadrantInternalBorderStrokeFill: '#93c5fd',
      quadrantExternalBorderStrokeFill: '#0284c7',
      sectionBkgColor: '#f0f9ff',
      altSectionBkgColor: '#ffffff',
      taskBkgColor: '#0284c7',
      taskBorderColor: '#0369a1',
      taskTextColor: '#ffffff',
      activeTaskBkgColor: '#2563eb',
      activeTaskBorderColor: '#1e40af',
      doneTaskBkgColor: '#64748b',
      doneTaskBorderColor: '#475569',
      critBkgColor: '#ef4444',
      critBorderColor: '#b91c1c',
      todayLineColor: '#0284c7',
      gridColor: '#e2e8f0',
      xyChart: {
        backgroundColor: 'transparent',
        titleColor: '#0369a1',
        xAxisTitleColor: '#0369a1',
        xAxisLabelColor: '#075985',
        xAxisTickColor: '#0284c7',
        xAxisLineColor: '#0284c7',
        yAxisTitleColor: '#0369a1',
        yAxisLabelColor: '#075985',
        yAxisTickColor: '#0284c7',
        yAxisLineColor: '#0284c7',
        plotColorPalette: '#0284c7, #2563eb, #1e40af, #38bdf8, #0369a1, #60a5fa, #0c4a6e, #93c5fd',
      },
    },
    frame: { bg: '#f0f9ff', border: '#bae6fd', accent: '#0284c7' },
    sampleColors: {
      node1: '#e0f2fe',
      stroke1: '#0284c7',
      text1: '#0369a1',
      node2: '#f0f9ff',
      stroke2: '#2563eb',
      text2: '#1e3a8a',
      line: '#2563eb',
    },
  },
  sombre: {
    id: 'sombre',
    label: 'Sombre (Fond sombre)',
    theme: 'dark',
    xyChart: {
      backgroundColor: 'transparent',
      titleColor: '#f1f5f9',
      xAxisTitleColor: '#f1f5f9',
      xAxisLabelColor: '#cbd5e1',
      xAxisTickColor: '#64748b',
      xAxisLineColor: '#64748b',
      yAxisTitleColor: '#f1f5f9',
      yAxisLabelColor: '#cbd5e1',
      yAxisTickColor: '#64748b',
      yAxisLineColor: '#64748b',
      plotColorPalette: '#38bdf8, #818cf8, #34d399, #fbbf24, #f87171, #a78bfa, #22d3ee, #f472b6',
    },
    themeVariables: {
      primaryColor: '#1e293b',
      primaryTextColor: '#f1f5f9',
      primaryBorderColor: '#475569',
      lineColor: '#94a3b8',
      secondaryColor: '#0f172a',
      secondaryTextColor: '#cbd5e1',
      secondaryBorderColor: '#334155',
      tertiaryColor: '#334155',
      tertiaryTextColor: '#f8fafc',
      tertiaryBorderColor: '#64748b',
      edgeLabelBackground: '#1e293b',
      clusterBkg: '#0f172a',
      clusterBorder: '#475569',
      actorBkg: '#1e293b',
      actorBorder: '#64748b',
      actorTextColor: '#f8fafc',
      signalColor: '#94a3b8',
      signalTextColor: '#f1f5f9',
      labelBoxBkgColor: '#1e293b',
      noteBkgColor: '#1e293b',
      noteBorderColor: '#64748b',
      noteTextColor: '#cbd5e1',
      activationBkgColor: '#334155',
      activationBorderColor: '#64748b',
      classText: '#f1f5f9',
      plotColorPalette: '#38bdf8, #818cf8, #34d399, #fbbf24, #f87171, #a78bfa, #22d3ee, #f472b6',
      pie1: '#38bdf8',
      pie2: '#818cf8',
      pie3: '#34d399',
      pie4: '#fbbf24',
      pie5: '#f87171',
      pie6: '#a78bfa',
      pie7: '#22d3ee',
      pie8: '#f472b6',
      pie9: '#60a5fa',
      pie10: '#4ade80',
      pie11: '#f87171',
      pie12: '#c084fc',
      cScale0: '#38bdf8',
      cScale1: '#818cf8',
      cScale2: '#34d399',
      cScale3: '#fbbf24',
      cScale4: '#f87171',
      cScale5: '#a78bfa',
      cScale6: '#22d3ee',
      cScale7: '#f472b6',
      git0: '#38bdf8',
      git1: '#818cf8',
      git2: '#34d399',
      git3: '#fbbf24',
      git4: '#f87171',
      git5: '#a78bfa',
      git6: '#22d3ee',
      git7: '#f472b6',
      quadrant1Fill: '#1e293b',
      quadrant2Fill: '#0f172a',
      quadrant3Fill: '#1e293b',
      quadrant4Fill: '#0f172a',
      quadrantPointFill: '#38bdf8',
      quadrantPointTextFill: '#f1f5f9',
      quadrantTitleFill: '#f1f5f9',
      quadrantXAxisTextFill: '#cbd5e1',
      quadrantYAxisTextFill: '#cbd5e1',
      quadrantInternalBorderStrokeFill: '#475569',
      quadrantExternalBorderStrokeFill: '#64748b',
      sectionBkgColor: '#1e293b',
      altSectionBkgColor: '#0f172a',
      taskBkgColor: '#38bdf8',
      taskBorderColor: '#0284c7',
      taskTextColor: '#0f172a',
      activeTaskBkgColor: '#818cf8',
      activeTaskBorderColor: '#6366f1',
      doneTaskBkgColor: '#475569',
      doneTaskBorderColor: '#334155',
      critBkgColor: '#f87171',
      critBorderColor: '#ef4444',
      todayLineColor: '#38bdf8',
      gridColor: '#334155',
      xyChart: {
        backgroundColor: 'transparent',
        titleColor: '#f1f5f9',
        xAxisTitleColor: '#f1f5f9',
        xAxisLabelColor: '#cbd5e1',
        xAxisTickColor: '#64748b',
        xAxisLineColor: '#64748b',
        yAxisTitleColor: '#f1f5f9',
        yAxisLabelColor: '#cbd5e1',
        yAxisTickColor: '#64748b',
        yAxisLineColor: '#64748b',
        plotColorPalette: '#38bdf8, #818cf8, #34d399, #fbbf24, #f87171, #a78bfa, #22d3ee, #f472b6',
      },
    },
    frame: { bg: '#0f172a', border: '#334155', accent: '#64748b' },
    sampleColors: {
      node1: '#1e293b',
      stroke1: '#475569',
      text1: '#f1f5f9',
      node2: '#0f172a',
      stroke2: '#64748b',
      text2: '#94a3b8',
      line: '#94a3b8',
    },
  },
  colore: {
    id: 'colore',
    label: 'Coloré (Pastel)',
    theme: 'base',
    xyChart: {
      backgroundColor: 'transparent',
      titleColor: '#166534',
      xAxisTitleColor: '#166534',
      xAxisLabelColor: '#374151',
      xAxisTickColor: '#6366f1',
      xAxisLineColor: '#6366f1',
      yAxisTitleColor: '#166534',
      yAxisLabelColor: '#374151',
      yAxisTickColor: '#6366f1',
      yAxisLineColor: '#6366f1',
      plotColorPalette: '#22c55e, #6366f1, #f59e0b, #ec4899, #06b6d4, #8b5cf6, #10b981, #f97316',
    },
    themeVariables: {
      primaryColor: '#dcfce7',
      primaryTextColor: '#166534',
      primaryBorderColor: '#22c55e',
      lineColor: '#4f46e5',
      secondaryColor: '#fef3c7',
      secondaryTextColor: '#92400e',
      secondaryBorderColor: '#f59e0b',
      tertiaryColor: '#fee2e2',
      tertiaryTextColor: '#991b1b',
      tertiaryBorderColor: '#f87171',
      edgeLabelBackground: '#ffffff',
      clusterBkg: '#faf5ff',
      clusterBorder: '#c084fc',
      actorBkg: '#e0e7ff',
      actorBorder: '#6366f1',
      actorTextColor: '#3730a3',
      signalColor: '#4f46e5',
      signalTextColor: '#1e1b4b',
      labelBoxBkgColor: '#fef3c7',
      noteBkgColor: '#fef3c7',
      noteBorderColor: '#f59e0b',
      noteTextColor: '#92400e',
      activationBkgColor: '#c7d2fe',
      activationBorderColor: '#4f46e5',
      classText: '#166534',
      plotColorPalette: '#22c55e, #6366f1, #f59e0b, #ec4899, #06b6d4, #8b5cf6, #10b981, #f97316',
      pie1: '#22c55e',
      pie2: '#6366f1',
      pie3: '#f59e0b',
      pie4: '#ec4899',
      pie5: '#06b6d4',
      pie6: '#8b5cf6',
      pie7: '#10b981',
      pie8: '#f97316',
      pie9: '#14b8a6',
      pie10: '#a855f7',
      pie11: '#ef4444',
      pie12: '#3b82f6',
      cScale0: '#22c55e',
      cScale1: '#6366f1',
      cScale2: '#f59e0b',
      cScale3: '#ec4899',
      cScale4: '#06b6d4',
      cScale5: '#8b5cf6',
      cScale6: '#10b981',
      cScale7: '#f97316',
      git0: '#22c55e',
      git1: '#6366f1',
      git2: '#f59e0b',
      git3: '#ec4899',
      git4: '#06b6d4',
      git5: '#8b5cf6',
      git6: '#10b981',
      git7: '#f97316',
      quadrant1Fill: '#dcfce7',
      quadrant2Fill: '#fef3c7',
      quadrant3Fill: '#fee2e2',
      quadrant4Fill: '#f3e8ff',
      quadrantPointFill: '#6366f1',
      quadrantTitleFill: '#166534',
      quadrantInternalBorderStrokeFill: '#cbd5e1',
      quadrantExternalBorderStrokeFill: '#6366f1',
      sectionBkgColor: '#f0fdf4',
      altSectionBkgColor: '#fefce8',
      taskBkgColor: '#22c55e',
      taskBorderColor: '#16a34a',
      taskTextColor: '#ffffff',
      activeTaskBkgColor: '#6366f1',
      activeTaskBorderColor: '#4f46e5',
      doneTaskBkgColor: '#94a3b8',
      doneTaskBorderColor: '#64748b',
      critBkgColor: '#ef4444',
      critBorderColor: '#dc2626',
      todayLineColor: '#f59e0b',
      gridColor: '#e2e8f0',
      xyChart: {
        backgroundColor: 'transparent',
        titleColor: '#166534',
        xAxisTitleColor: '#166534',
        xAxisLabelColor: '#374151',
        xAxisTickColor: '#6366f1',
        xAxisLineColor: '#6366f1',
        yAxisTitleColor: '#166534',
        yAxisLabelColor: '#374151',
        yAxisTickColor: '#6366f1',
        yAxisLineColor: '#6366f1',
        plotColorPalette: '#22c55e, #6366f1, #f59e0b, #ec4899, #06b6d4, #8b5cf6, #10b981, #f97316',
      },
    },
    frame: { bg: '#f8fafc', border: '#cbd5e1', accent: '#6366f1' },
    sampleColors: {
      node1: '#dcfce7',
      stroke1: '#22c55e',
      text1: '#166534',
      node2: '#fef3c7',
      stroke2: '#f59e0b',
      text2: '#92400e',
      line: '#4f46e5',
    },
  },
  monochrome: {
    id: 'monochrome',
    label: 'Monochrome (Noir & Blanc)',
    theme: 'base',
    xyChart: {
      backgroundColor: 'transparent',
      titleColor: '#111827',
      xAxisTitleColor: '#111827',
      xAxisLabelColor: '#374151',
      xAxisTickColor: '#111827',
      xAxisLineColor: '#111827',
      yAxisTitleColor: '#111827',
      yAxisLabelColor: '#374151',
      yAxisTickColor: '#111827',
      yAxisLineColor: '#111827',
      plotColorPalette: '#111827, #4b5563, #9ca3af, #1f2937, #6b7280, #374151, #d1d5db, #030712',
    },
    themeVariables: {
      primaryColor: '#ffffff',
      primaryTextColor: '#111827',
      primaryBorderColor: '#111827',
      lineColor: '#111827',
      secondaryColor: '#f3f4f6',
      secondaryTextColor: '#111827',
      secondaryBorderColor: '#4b5563',
      tertiaryColor: '#e5e7eb',
      tertiaryTextColor: '#111827',
      tertiaryBorderColor: '#9ca3af',
      edgeLabelBackground: '#ffffff',
      clusterBkg: '#f9fafb',
      clusterBorder: '#6b7280',
      actorBkg: '#ffffff',
      actorBorder: '#111827',
      actorTextColor: '#111827',
      signalColor: '#111827',
      signalTextColor: '#111827',
      labelBoxBkgColor: '#f3f4f6',
      noteBkgColor: '#f9fafb',
      noteBorderColor: '#4b5563',
      noteTextColor: '#111827',
      activationBkgColor: '#d1d5db',
      activationBorderColor: '#111827',
      classText: '#111827',
      plotColorPalette: '#111827, #4b5563, #9ca3af, #1f2937, #6b7280, #374151, #d1d5db, #030712',
      pie1: '#111827',
      pie2: '#4b5563',
      pie3: '#9ca3af',
      pie4: '#d1d5db',
      pie5: '#1f2937',
      pie6: '#6b7280',
      pie7: '#374151',
      pie8: '#e5e7eb',
      pie9: '#030712',
      pie10: '#9ca3af',
      pie11: '#4b5563',
      pie12: '#f3f4f6',
      cScale0: '#111827',
      cScale1: '#4b5563',
      cScale2: '#9ca3af',
      cScale3: '#d1d5db',
      cScale4: '#1f2937',
      cScale5: '#6b7280',
      cScale6: '#374151',
      cScale7: '#e5e7eb',
      git0: '#111827',
      git1: '#4b5563',
      git2: '#9ca3af',
      git3: '#d1d5db',
      git4: '#1f2937',
      git5: '#6b7280',
      git6: '#374151',
      git7: '#e5e7eb',
      quadrant1Fill: '#ffffff',
      quadrant2Fill: '#f9fafb',
      quadrant3Fill: '#f3f4f6',
      quadrant4Fill: '#e5e7eb',
      quadrantPointFill: '#111827',
      quadrantPointTextFill: '#111827',
      quadrantTitleFill: '#111827',
      quadrantInternalBorderStrokeFill: '#9ca3af',
      quadrantExternalBorderStrokeFill: '#111827',
      sectionBkgColor: '#f9fafb',
      altSectionBkgColor: '#ffffff',
      taskBkgColor: '#111827',
      taskBorderColor: '#000000',
      taskTextColor: '#ffffff',
      activeTaskBkgColor: '#4b5563',
      activeTaskBorderColor: '#111827',
      doneTaskBkgColor: '#9ca3af',
      doneTaskBorderColor: '#6b7280',
      critBkgColor: '#000000',
      critBorderColor: '#000000',
      todayLineColor: '#111827',
      gridColor: '#d1d5db',
      xyChart: {
        backgroundColor: 'transparent',
        titleColor: '#111827',
        xAxisTitleColor: '#111827',
        xAxisLabelColor: '#374151',
        xAxisTickColor: '#111827',
        xAxisLineColor: '#111827',
        yAxisTitleColor: '#111827',
        yAxisLabelColor: '#374151',
        yAxisTickColor: '#111827',
        yAxisLineColor: '#111827',
        plotColorPalette: '#111827, #4b5563, #9ca3af, #1f2937, #6b7280, #374151, #d1d5db, #030712',
      },
    },
    frame: { bg: '#f9fafb', border: '#d1d5db', accent: '#111827' },
    sampleColors: {
      node1: '#ffffff',
      stroke1: '#111827',
      text1: '#111827',
      node2: '#f3f4f6',
      stroke2: '#6b7280',
      text2: '#111827',
      line: '#111827',
    },
  },
});

let currentMermaidPreset = 'default';

/**
 * Retourne l'identifiant du preset de thème Mermaid actuellement sélectionné.
 * @returns {string} Identifiant du preset
 */
export const getMermaidTheme = () => currentMermaidPreset;

/**
 * Définit le preset de thème pour les diagrammes Mermaid et réinitialise le cache SVG.
 * @param {string} presetName - Identifiant du preset
 * @returns {void}
 */
export const setMermaidTheme = (presetName) => {
  const targetPreset = MERMAID_THEME_PRESETS[presetName] ? presetName : 'default';
  if (targetPreset === currentMermaidPreset && mermaidInitialized) {
    return;
  }
  currentMermaidPreset = targetPreset;
  mermaidSvgCache.clear();
  mermaidInitialized = false;
  ensureMermaidInitialized();
};

/**
 * Vide le cache mémoire des schémas SVG Mermaid.
 * @returns {void}
 */
export const clearMermaidCache = () => mermaidSvgCache.clear();

/**
 * Initialise la bibliothèque locale window.mermaid avec le preset actif si disponible.
 * @returns {boolean}
 */
function ensureMermaidInitialized() {
  if (typeof window === 'undefined' || !window.mermaid) return false;
  if (!mermaidInitialized) {
    const preset = MERMAID_THEME_PRESETS[currentMermaidPreset] || MERMAID_THEME_PRESETS.default;
    const themeVariables = {
      fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      ...(preset.themeVariables || {}),
      xyChart: {
        ...(preset.xyChart || {}),
      },
    };
    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: preset.theme,
      themeVariables,
      xyChart: {
        ...(preset.xyChart || {}),
      },
      flowchart: {
        htmlLabels: true,
        useMaxWidth: true,
        curve: 'basis',
        padding: 15,
      },
      sequence: {
        useMaxWidth: true,
      },
      gantt: {
        useMaxWidth: true,
      },
    });
    mermaidInitialized = true;
  }
  return true;
}

let modernChartSeq = 1;

/**
 * Analyse la syntaxe d'un bloc xychart / xychart-beta Mermaid en structure exploitable.
 * @param {string} text - Code source xychart
 * @returns {{ title: string, orientation: string, xAxis: Record<string, any>, yAxis: Record<string, any>, plots: Array<{ type: string, label: string, data: number[] }> }}
 */
function parseXyChart(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const chart = { title: '', orientation: 'vertical', xAxis: {}, yAxis: {}, plots: [] };

  for (const line of lines) {
    if (/^xychart(-beta)?\b/i.test(line)) {
      if (/horizontal/i.test(line)) chart.orientation = 'horizontal';
      continue;
    }
    const titleMatch = line.match(/^title\s+(?:"([^"]+)"|'([^']+)'|(.+))/i);
    if (titleMatch) {
      chart.title = (titleMatch[1] || titleMatch[2] || titleMatch[3] || '').trim();
      continue;
    }
    const xMatch = line.match(
      /^x-axis\s*(?:"([^"]*)"\s*)?(\[[^\]]*\]|[+-]?\d+(?:\.\d+)?\s*-->\s*[+-]?\d+(?:\.\d+)?)/i
    );
    if (xMatch) {
      const title = (xMatch[1] || '').trim();
      const dataStr = xMatch[2].trim();
      if (dataStr.startsWith('[')) {
        const cats = dataStr
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/^["']|["']$/g, ''));
        chart.xAxis = { type: 'band', title, categories: cats };
      } else {
        const [min, max] = dataStr.split('-->').map((s) => parseFloat(s.trim()));
        chart.xAxis = { type: 'linear', title, min, max };
      }
      continue;
    }
    const yMatch = line.match(
      /^y-axis\s*(?:"([^"]*)"\s*)?(\[[^\]]*\]|[+-]?\d+(?:\.\d+)?\s*-->\s*[+-]?\d+(?:\.\d+)?)/i
    );
    if (yMatch) {
      const title = (yMatch[1] || '').trim();
      const dataStr = yMatch[2].trim();
      if (dataStr.startsWith('[')) {
        const cats = dataStr
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/^["']|["']$/g, ''));
        chart.yAxis = { type: 'band', title, categories: cats };
      } else {
        const [min, max] = dataStr.split('-->').map((s) => parseFloat(s.trim()));
        chart.yAxis = { type: 'linear', title, min, max };
      }
      continue;
    }
    const plotMatch = line.match(/^(bar|line)\s*(?:"([^"]*)"\s*)?\[([^\]]*)\]/i);
    if (plotMatch) {
      const type = plotMatch[1].toLowerCase();
      const label = (plotMatch[2] || '').trim();
      const values = plotMatch[3]
        .split(',')
        .map((s) => parseFloat(s.trim()))
        .filter((n) => !isNaN(n));
      chart.plots.push({ type, label, data: values });
      continue;
    }
  }
  return chart;
}

/**
 * Calcule une trajectoire de spline fluide (Catmull-Rom / Bézier cubique) passant exactement par une liste de points.
 * @param {Array<{ x: number, y: number }>} points
 * @returns {string} Commande d SVG
 */
function createSplinePath(points) {
  if (!points || points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)},${points[1].y.toFixed(1)}`;
  }

  let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < points.length - 2 ? points[i + 2] : p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

/**
 * Convertit un hexadécimal couleur en rgba().
 * @param {string} hex
 * @param {number} alpha
 * @returns {string}
 */
function hexToRgba(hex, alpha) {
  if (!hex || hex === 'currentColor') return `rgba(91,139,247,${alpha})`;
  const cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  if (cleanHex.length >= 6) {
    const r = parseInt(cleanHex.slice(0, 2), 16);
    const g = parseInt(cleanHex.slice(2, 4), 16);
    const b = parseInt(cleanHex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return `rgba(91,139,247,${alpha})`;
}

/**
 * Résout les tokens stylistiques (palette, arrière-plan, grille matricielle) pour le moteur de graphiques.
 * @param {string} presetKey
 * @returns {{ isDark: boolean, bgCard: string, borderCard: string, textTitle: string, textMuted: string, dotColor: string, palette: string[] }}
 */
function getThemeChartStyle(presetKey) {
  switch (presetKey) {
    case 'sombre':
      return {
        isDark: true,
        bgCard: '#12151e',
        borderCard: '#232938',
        textTitle: '#f8fafc',
        textMuted: '#94a3b8',
        dotColor: 'rgba(255, 255, 255, 0.12)',
        palette: ['#5b8bf7', '#818cf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa'],
      };
    case 'noir-rouge':
      return {
        isDark: false,
        bgCard: '#ffffff',
        borderCard: '#fecaca',
        textTitle: '#111827',
        textMuted: '#4b5563',
        dotColor: 'rgba(196, 23, 24, 0.1)',
        palette: ['#C41718', '#111827', '#ef4444', '#4b5563', '#991b1b', '#6b7280'],
      };
    case 'bleu-corporate':
      return {
        isDark: false,
        bgCard: '#ffffff',
        borderCard: '#bae6fd',
        textTitle: '#0369a1',
        textMuted: '#075985',
        dotColor: 'rgba(2, 132, 199, 0.1)',
        palette: ['#0284c7', '#2563eb', '#1e40af', '#38bdf8', '#0369a1', '#60a5fa'],
      };
    case 'monochrome':
      return {
        isDark: false,
        bgCard: '#ffffff',
        borderCard: '#e5e7eb',
        textTitle: '#111827',
        textMuted: '#374151',
        dotColor: 'rgba(17, 24, 39, 0.08)',
        palette: ['#111827', '#4b5563', '#9ca3af', '#1f2937', '#6b7280', '#374151'],
      };
    case 'colore':
      return {
        isDark: false,
        bgCard: '#ffffff',
        borderCard: '#e2e8f0',
        textTitle: '#166534',
        textMuted: '#374151',
        dotColor: 'rgba(99, 102, 241, 0.1)',
        palette: ['#22c55e', '#6366f1', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6'],
      };
    default:
      return {
        isDark: false,
        bgCard: '#ffffff',
        borderCard: '#cbd5e1',
        textTitle: '#1f2937',
        textMuted: '#4b5563',
        dotColor: 'rgba(59, 130, 246, 0.1)',
        palette: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
      };
  }
}

/**
 * Génère un graphique SVG vectoriel moderne et haute-fidélité pour les spécifications xychart Mermaid :
 * - Grille matricielle à points (dotted grid)
 * - Barres capsules arrondies avec fond translucide et contour lumineux
 * - Courbes de Bézier lissées avec halo et pastilles de données
 * - Légende intégrée coordonnée
 * @param {Record<string, any>} chart
 * @param {string} [presetKey='default']
 * @returns {string} Balisage SVG complet
 */
function renderModernXyChart(chart, presetKey = 'default') {
  const width = 760;
  const height = 480;
  const uid = 'xyc-' + modernChartSeq++;
  const style = getThemeChartStyle(presetKey);

  const isHorizontal = chart.orientation === 'horizontal';

  const hasTitle = Boolean(chart.title);
  const hasLegend = chart.plots && chart.plots.length > 0;

  const padTop = hasTitle ? (hasLegend ? 96 : 64) : hasLegend ? 60 : 36;
  const padBottom = 60;
  const padLeft = isHorizontal ? 120 : 85;
  const padRight = 45;

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  let categories = [];
  if (isHorizontal) {
    categories =
      chart.xAxis.categories && chart.xAxis.categories.length
        ? chart.xAxis.categories
        : chart.yAxis.categories || [];
  } else {
    categories =
      chart.xAxis.categories && chart.xAxis.categories.length
        ? chart.xAxis.categories
        : chart.yAxis.categories || [];
  }
  const numCats = categories.length || 1;

  let numMin = 0;
  let numMax = null;
  const numAxis = isHorizontal
    ? chart.yAxis.min !== undefined
      ? chart.yAxis
      : chart.xAxis
    : chart.yAxis.min !== undefined
      ? chart.yAxis
      : chart.xAxis;

  if (numAxis && numAxis.min !== undefined) numMin = numAxis.min;
  if (numAxis && numAxis.max !== undefined) numMax = numAxis.max;

  if (typeof numMax !== 'number') {
    let maxVal = -Infinity;
    (chart.plots || []).forEach((p) =>
      (p.data || []).forEach((v) => {
        if (v > maxVal) maxVal = v;
      })
    );
    numMax = maxVal === -Infinity ? 100 : Math.ceil(maxVal * 1.15);
  }
  if (numMax <= numMin) numMax = numMin + 100;

  const numTicks = 5;
  const tickStep = (numMax - numMin) / numTicks;
  const ticks = [];
  for (let i = 0; i <= numTicks; i++) {
    ticks.push(numMin + i * tickStep);
  }

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;display:block;border-radius:16px;background:${style.bgCard};border:1px solid ${style.borderCard};box-shadow:0 8px 24px rgba(0,0,0,${style.isDark ? '0.35' : '0.04'});font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;box-sizing:border-box;">\n`;

  // Définition de la grille matricielle à points discrets
  svg += `  <defs>\n`;
  svg += `    <pattern id="dot-${uid}" width="28" height="28" patternUnits="userSpaceOnUse">\n`;
  svg += `      <circle cx="2" cy="2" r="1.3" fill="${style.dotColor}" />\n`;
  svg += `    </pattern>\n`;
  svg += `  </defs>\n`;

  // Aire de tracé avec grille
  svg += `  <rect x="${padLeft}" y="${padTop}" width="${plotW}" height="${plotH}" fill="url(#dot-${uid})" rx="8" />\n`;

  // Titre principal
  if (chart.title) {
    svg += `  <text x="${width / 2}" y="38" text-anchor="middle" font-size="18" font-weight="700" fill="${style.textTitle}" letter-spacing="0.02em">${escapeSvgXml(chart.title)}</text>\n`;
  }

  // Légende intégrée automatique
  if (hasLegend) {
    const legY = hasTitle ? 68 : 34;
    let totalItemW = 0;
    const legendData = chart.plots.map((p, idx) => {
      const color = style.palette[idx % style.palette.length];
      const label = p.label || (p.type === 'bar' ? `Bar ${idx + 1}` : `Line ${idx + 1}`);
      const itemW = label.length * 8 + 36;
      totalItemW += itemW;
      return { type: p.type, label, color, itemW };
    });

    let curX = Math.max(padLeft, (width - totalItemW) / 2);
    svg += `  <g class="chart-legend" font-size="12" font-weight="600" fill="${style.textMuted}">\n`;
    legendData.forEach((item) => {
      const safeLabel = escapeSvgXml(item.label);
      if (item.type === 'bar') {
        svg += `    <rect x="${curX.toFixed(1)}" y="${(legY - 9).toFixed(1)}" width="14" height="11" rx="3" fill="${hexToRgba(item.color, 0.28)}" stroke="${item.color}" stroke-width="2" />\n`;
        svg += `    <text x="${(curX + 20).toFixed(1)}" y="${legY.toFixed(1)}">${safeLabel}</text>\n`;
      } else {
        svg += `    <line x1="${curX.toFixed(1)}" y1="${(legY - 4).toFixed(1)}" x2="${(curX + 16).toFixed(1)}" y2="${(legY - 4).toFixed(1)}" stroke="${item.color}" stroke-width="2.5" />\n`;
        svg += `    <circle cx="${(curX + 8).toFixed(1)}" cy="${(legY - 4).toFixed(1)}" r="3.2" fill="${item.color}" />\n`;
        svg += `    <text x="${(curX + 22).toFixed(1)}" y="${legY.toFixed(1)}">${safeLabel}</text>\n`;
      }
      curX += item.itemW;
    });
    svg += `  </g>\n`;
  }

  if (!isHorizontal) {
    // GRAPHIQUE VERTICAL
    const getXCat = (catIdx) => padLeft + (catIdx + 0.5) * (plotW / numCats);
    const getYVal = (val) => padTop + plotH - ((val - numMin) / (numMax - numMin)) * plotH;

    // Graduations Y
    ticks.forEach((t) => {
      const yPos = getYVal(t);
      svg += `  <text x="${padLeft - 14}" y="${(yPos + 4).toFixed(1)}" text-anchor="end" font-size="13" font-weight="500" fill="${style.textMuted}">${Math.round(t)}</text>\n`;
    });

    // Titre de l'axe Y
    if (chart.yAxis && chart.yAxis.title) {
      svg += `  <text x="24" y="${(padTop + plotH / 2).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="700" fill="${style.textTitle}" transform="rotate(-90, 24, ${(padTop + plotH / 2).toFixed(1)})">${escapeSvgXml(chart.yAxis.title)}</text>\n`;
    }

    // Catégories X
    categories.forEach((cat, idx) => {
      const xPos = getXCat(idx);
      svg += `  <text x="${xPos.toFixed(1)}" y="${(padTop + plotH + 26).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="500" fill="${style.textMuted}">${escapeSvgXml(String(cat))}</text>\n`;
    });

    // Séries de barres groupées côte-à-côte
    const barPlots = (chart.plots || []).filter((p) => p.type === 'bar');
    const numBars = barPlots.length;
    if (numBars > 0) {
      const catW = plotW / numCats;
      const groupW = Math.min(catW * 0.72, numBars * 42);
      const gap = numBars > 1 ? 4 : 0;
      const barW = (groupW - (numBars - 1) * gap) / numBars;

      barPlots.forEach((plot, bIdx) => {
        const plotColor = style.palette[chart.plots.indexOf(plot) % style.palette.length];
        const rx = Math.min(8, barW / 2);

        (plot.data || []).forEach((val, cIdx) => {
          const centerX = getXCat(cIdx);
          const startGroupX = centerX - groupW / 2;
          const x = startGroupX + bIdx * (barW + gap);
          const y = getYVal(val);
          const h = Math.max(0, padTop + plotH - y);

          svg += `  <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${rx.toFixed(1)}" fill="${hexToRgba(plotColor, 0.22)}" stroke="${plotColor}" stroke-width="2" />\n`;
        });
      });
    }

    // Séries de courbes lissées avec points
    const linePlots = (chart.plots || []).filter((p) => p.type === 'line');
    linePlots.forEach((plot) => {
      const plotColor = style.palette[chart.plots.indexOf(plot) % style.palette.length];
      const pts = (plot.data || []).map((val, idx) => ({
        x: getXCat(idx),
        y: getYVal(val),
      }));

      const d = createSplinePath(pts);
      svg += `  <path d="${d}" fill="none" stroke="rgba(0,0,0,${style.isDark ? '0.45' : '0.12'})" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" transform="translate(0, 3)" />\n`;
      svg += `  <path d="${d}" fill="none" stroke="${plotColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />\n`;

      pts.forEach((pt) => {
        svg += `  <circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="4.8" fill="${plotColor}" stroke="${style.bgCard}" stroke-width="2.2" class="line-plot-dot" />\n`;
      });
    });
  } else {
    // GRAPHIQUE HORIZONTAL
    const getYCat = (catIdx) => padTop + (catIdx + 0.5) * (plotH / numCats);
    const getXVal = (val) => padLeft + ((val - numMin) / (numMax - numMin)) * plotW;

    // Graduations X en bas
    ticks.forEach((t) => {
      const xPos = getXVal(t);
      svg += `  <text x="${xPos.toFixed(1)}" y="${(padTop + plotH + 24).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="500" fill="${style.textMuted}">${Math.round(t)}</text>\n`;
    });

    // Catégories Y à gauche
    categories.forEach((cat, idx) => {
      const yPos = getYCat(idx);
      svg += `  <text x="${(padLeft - 14).toFixed(1)}" y="${(yPos + 4).toFixed(1)}" text-anchor="end" font-size="13" font-weight="500" fill="${style.textMuted}">${escapeSvgXml(String(cat))}</text>\n`;
    });

    // Barres horizontales
    const barPlots = (chart.plots || []).filter((p) => p.type === 'bar');
    const numBars = barPlots.length;
    if (numBars > 0) {
      const catH = plotH / numCats;
      const groupH = Math.min(catH * 0.72, numBars * 36);
      const gap = numBars > 1 ? 4 : 0;
      const barH = (groupH - (numBars - 1) * gap) / numBars;

      barPlots.forEach((plot, bIdx) => {
        const plotColor = style.palette[chart.plots.indexOf(plot) % style.palette.length];
        const rx = Math.min(8, barH / 2);

        (plot.data || []).forEach((val, cIdx) => {
          const centerY = getYCat(cIdx);
          const startGroupY = centerY - groupH / 2;
          const y = startGroupY + bIdx * (barH + gap);
          const w = Math.max(0, getXVal(val) - padLeft);

          svg += `  <rect x="${padLeft}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${barH.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${rx.toFixed(1)}" fill="${hexToRgba(plotColor, 0.22)}" stroke="${plotColor}" stroke-width="2" />\n`;
        });
      });
    }

    // Courbes horizontales
    const linePlots = (chart.plots || []).filter((p) => p.type === 'line');
    linePlots.forEach((plot) => {
      const plotColor = style.palette[chart.plots.indexOf(plot) % style.palette.length];
      const pts = (plot.data || []).map((val, idx) => ({
        x: getXVal(val),
        y: getYCat(idx),
      }));

      const d = createSplinePath(pts);
      svg += `  <path d="${d}" fill="none" stroke="rgba(0,0,0,${style.isDark ? '0.45' : '0.12'})" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" transform="translate(0, 3)" />\n`;
      svg += `  <path d="${d}" fill="none" stroke="${plotColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />\n`;

      pts.forEach((pt) => {
        svg += `  <circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="4.8" fill="${plotColor}" stroke="${style.bgCard}" stroke-width="2.2" class="line-plot-dot" />\n`;
      });
    });
  }

  svg += `</svg>`;
  return svg;
}

/**
 * Modernise le rendu SVG standard de Mermaid pour l'ensemble des diagrammes structurels
 * (flowcharts, diagrammes de séquence, mindmaps, etc.) :
 * - Arrondi soigné sur les nœuds rectangulaires
 * - Finition vectorielle élégante
 * @param {string} svgString - Balisage SVG brut produit par Mermaid
 * @returns {string} Balisage SVG modernisé
 */
function enhanceGeneralMermaidSvg(svgString) {
  if (!svgString || typeof svgString !== 'string') return svgString;

  let result = svgString.replace(
    /(<g\b[^>]*\bclass="[^"]*(?:node|actor|note)[^"]*"[^>]*>[\s\S]*?)(<rect\b(?![^>]*\brx=)[^>]*?>)/gi,
    (_match, prefix, rectTag) => {
      return `${prefix}${rectTag.replace(/<rect\b/i, '<rect rx="8" ry="8"')}`;
    }
  );

  return result;
}

/**
 * Convertit un bloc de code Mermaid en chaîne SVG.
 * Intercepte nativement les diagrammes xychart pour générer le rendu moderne haute fidélité
 * (grille matricielle à points, barres capsules, courbes splines et légendes), et applique
 * le design system modernisé sur tous les autres types de diagrammes.
 * @param {string} code - Code source du schéma Mermaid
 * @returns {Promise<string|null>} Balisage <svg> ou null si la syntaxe est incomplète/invalide
 */
export const renderMermaidToSvg = async (code) => {
  const trimmedCode = normalizeMermaidCode(code);
  if (!trimmedCode) return null;

  const cacheKey = `${currentMermaidPreset}:::${trimmedCode}`;
  if (mermaidSvgCache.has(cacheKey)) {
    return mermaidSvgCache.get(cacheKey);
  }

  // 1. Détection et interception des diagrammes xychart (histogrammes et courbes)
  if (/^\s*xychart(-beta)?\b/i.test(trimmedCode)) {
    try {
      const chartData = parseXyChart(trimmedCode);
      if (chartData && chartData.plots && chartData.plots.length > 0) {
        const modernSvg = renderModernXyChart(chartData, currentMermaidPreset);
        if (modernSvg) {
          if (mermaidSvgCache.size >= 80) {
            const firstKey = mermaidSvgCache.keys().next().value;
            mermaidSvgCache.delete(firstKey);
          }
          mermaidSvgCache.set(cacheKey, modernSvg);
          return modernSvg;
        }
      }
    } catch {
      // En cas d'exception de parsing, poursuite transparente vers Mermaid natif
    }
  }

  // 2. Traitement standard Mermaid pour tous les autres diagrammes (flowchart, sequence, etc.)
  if (!ensureMermaidInitialized()) return null;

  const renderId = `md2print-mmd-${mermaidIdSeq++}`;
  let hostEl = null;
  try {
    if (typeof document !== 'undefined' && document.body) {
      hostEl = document.createElement('div');
      hostEl.id = `host-${renderId}`;
      const isDarkPreset = currentMermaidPreset === 'sombre';
      hostEl.style.cssText = `position:fixed;left:-9999px;top:0;width:1600px;background:${isDarkPreset ? '#0f172a' : '#ffffff'};color:${isDarkPreset ? '#f1f5f9' : '#0f172a'};font-family:"Segoe UI",Roboto,Arial,sans-serif;font-size:14px;line-height:1.4;opacity:0;pointer-events:none;z-index:-1;`;
      document.body.appendChild(hostEl);
    }

    const result = await window.mermaid.render(renderId, trimmedCode, hostEl || undefined);
    let svg = result?.svg || null;
    if (svg) {
      svg = enhanceGeneralMermaidSvg(svg);
      if (mermaidSvgCache.size >= 80) {
        const firstKey = mermaidSvgCache.keys().next().value;
        mermaidSvgCache.delete(firstKey);
      }
      mermaidSvgCache.set(cacheKey, svg);
    }
    return svg;
  } catch {
    return null;
  } finally {
    if (typeof document !== 'undefined') {
      hostEl?.remove();
      document.getElementById(renderId)?.remove();
      document.getElementById(`d${renderId}`)?.remove();
      document.getElementById(`i${renderId}`)?.remove();
    }
  }
};

/**
 * Pré-calcule le rendu SVG de tous les blocs Mermaid (délimités par ```mermaid ou directs)
 * présents dans un texte Markdown.
 * @param {string} markdownText - Texte Markdown brut ou normalisé
 * @returns {Promise<Record<string, string>>} Dictionnaire { [codeMermaidNormalized]: svgMarkup }
 */
export const renderMermaidBlocksMap = async (markdownText) => {
  const map = {};
  if (!markdownText) return map;

  const wrappedMarkdown = wrapUnfencedMermaidBlocks(markdownText);
  if (!/```+\s*mermaid\b/i.test(wrappedMarkdown)) return map;

  const lines = wrappedMarkdown.split('\n');
  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trimStart();
    if (/^```+\s*mermaid\b/i.test(trimmed)) {
      const blockLines = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        blockLines.push(lines[i]);
        i++;
      }
      i++;
      const blockCode = normalizeMermaidCode(blockLines.join('\n'));
      if (blockCode && !map[blockCode]) {
        const svg = await renderMermaidToSvg(blockCode);
        if (svg) {
          map[blockCode] = svg;
        }
      }
      continue;
    }
    i++;
  }
  return map;
};

/**
 * Dessine un rectangle aux coins arrondis dans un contexte Canvas 2D.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r
 * @returns {void}
 */
function traceRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * Remplace les éventuels <foreignObject> d'un élément SVG par des éléments <text> / <tspan> SVG purs
 * (en préservant les sauts de ligne <br/>) pour garantir l'absence de restriction SecurityError
 * lors de la rastérisation Canvas vers PNG pour Word et PowerPoint.
 * @param {SVGElement} svgEl
 * @returns {void}
 */
function convertForeignObjectsToSvgText(svgEl) {
  const foreignObjects = Array.from(svgEl.querySelectorAll('foreignObject, foreignobject'));
  foreignObjects.forEach((fo) => {
    const clone = fo.cloneNode(true);
    clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
    const rawLines = (clone.textContent || '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const w = parseFloat(fo.getAttribute('width') || '120') || 120;
    const h = parseFloat(fo.getAttribute('height') || '24') || 24;
    const x = parseFloat(fo.getAttribute('x') || '0') || 0;
    const y = parseFloat(fo.getAttribute('y') || '0') || 0;

    const textEl = svgEl.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'text');
    const centerX = x + w / 2;
    const lineHeight = 16;
    const totalTextH = Math.max(0, (rawLines.length - 1) * lineHeight);
    const startY = y + h / 2 - totalTextH / 2 + 4.5;

    textEl.setAttribute('text-anchor', 'middle');
    textEl.setAttribute('fill', '#0f172a');
    textEl.setAttribute('font-family', 'Segoe UI, Arial, sans-serif');
    textEl.setAttribute('font-size', '13');

    if (rawLines.length <= 1) {
      textEl.setAttribute('x', String(centerX));
      textEl.setAttribute('y', String(startY));
      textEl.textContent = rawLines[0] || '';
    } else {
      rawLines.forEach((lineStr, idx) => {
        const tspan = svgEl.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        tspan.setAttribute('x', String(centerX));
        tspan.setAttribute('y', String(startY + idx * lineHeight));
        tspan.textContent = lineStr;
        textEl.appendChild(tspan);
      });
    }
    fo.replaceWith(textEl);
  });
}

/**
 * Géométrie du cadre ombré dessiné autour des schémas Mermaid lors de la rastérisation PNG.
 * Partagée avec le planificateur de diapositives pour un calcul de hauteur identique HTML / PPTX.
 * @type {Readonly<{ padX: number, padY: number, shadowPad: number, scale: number, minW: number, minH: number }>}
 */
export const MERMAID_FRAME = Object.freeze({
  padX: 28,
  padY: 22,
  shadowPad: 12,
  scale: 2,
  minW: 220,
  minH: 110,
});

/**
 * Lit la taille intrinsèque (viewBox ou width/height) d'un élément <svg> Mermaid ou d'une chaîne SVG,
 * bornée aux dimensions minimales du cadre.
 * Compatible avec les navigateurs et Node.js.
 * @param {SVGElement|string} svgElOrString
 * @returns {{ diagramW: number, diagramH: number }}
 */
export function readSvgDiagramSize(svgElOrString) {
  let vbWidth = 680;
  let vbHeight = 380;
  if (!svgElOrString) {
    return {
      diagramW: MERMAID_FRAME.minW,
      diagramH: MERMAID_FRAME.minH,
    };
  }

  if (typeof svgElOrString === 'string') {
    if (typeof DOMParser !== 'undefined') {
      try {
        const doc = new DOMParser().parseFromString(svgElOrString, 'image/svg+xml');
        const svgEl = doc.querySelector('svg');
        if (svgEl) return readSvgDiagramSize(svgEl);
      } catch {
        // Fallback regex ci-dessous
      }
    }
    const vbMatch = svgElOrString.match(/viewBox=["']([^"']+)["']/i);
    if (vbMatch) {
      const parts = vbMatch[1].trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        vbWidth = parts[2];
        vbHeight = parts[3];
      }
    } else {
      const wMatch = svgElOrString.match(/\bwidth=["']([0-9.]+)(?:px)?["']/i);
      const hMatch = svgElOrString.match(/\bheight=["']([0-9.]+)(?:px)?["']/i);
      if (wMatch && hMatch) {
        vbWidth = parseFloat(wMatch[1]);
        vbHeight = parseFloat(hMatch[1]);
      }
    }
    return {
      diagramW: Math.max(MERMAID_FRAME.minW, Math.ceil(vbWidth)),
      diagramH: Math.max(MERMAID_FRAME.minH, Math.ceil(vbHeight)),
    };
  }

  const svgEl = svgElOrString;
  const viewBoxAttr = svgEl?.getAttribute?.('viewBox');
  if (viewBoxAttr) {
    const parts = viewBoxAttr
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      vbWidth = parts[2];
      vbHeight = parts[3];
    }
  } else if (svgEl?.getAttribute) {
    const wAttr = parseFloat(svgEl.getAttribute('width') || '');
    const hAttr = parseFloat(svgEl.getAttribute('height') || '');
    if (wAttr > 0 && hAttr > 0) {
      vbWidth = wAttr;
      vbHeight = hAttr;
    }
  }
  return {
    diagramW: Math.max(MERMAID_FRAME.minW, Math.ceil(vbWidth)),
    diagramH: Math.max(MERMAID_FRAME.minH, Math.ceil(vbHeight)),
  };
}

/**
 * Retourne la taille en pixels (échelle 2x) de l'image PNG encadrée qui sera produite
 * par renderMermaidToPngDataUrl(), sans rastériser le schéma.
 * @param {string} code - Code source du schéma Mermaid
 * @returns {Promise<{ width: number, height: number } | null>} Taille ou null si le schéma est invalide
 */
export const getMermaidFramedSize = async (code) => {
  const svgMarkup = await renderMermaidToSvg(code);
  if (!svgMarkup) return null;
  const svgEl = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml').querySelector('svg');
  if (!svgEl) return null;
  const { diagramW, diagramH } = readSvgDiagramSize(svgEl);
  const { padX, padY, shadowPad, scale } = MERMAID_FRAME;
  return {
    width: (diagramW + padX * 2 + shadowPad * 2) * scale,
    height: (diagramH + padY * 2 + shadowPad * 2) * scale,
  };
};

/**
 * Rastérise un schéma Mermaid sous forme d'image PNG haute résolution (2x)
 * intégrée dans un cadre au fond légèrement plus foncé avec bordure et léger ombrage,
 * prête à être insérée dans les exports Word (.docx) et PowerPoint (.pptx).
 * @param {string} code - Code source du schéma Mermaid
 * @returns {Promise<string|null>} Data URL image/png ou null en cas d'erreur
 */
export const renderMermaidToPngDataUrl = async (code) => {
  const svgMarkup = await renderMermaidToSvg(code);
  if (!svgMarkup) return null;

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgMarkup, 'image/svg+xml');
  const svgEl = doc.querySelector('svg');
  if (!svgEl) return null;

  const { diagramW, diagramH } = readSvgDiagramSize(svgEl);
  svgEl.setAttribute('width', String(diagramW));
  svgEl.setAttribute('height', String(diagramH));
  svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svgEl.style.maxWidth = 'none';

  const drawFramedDiagram = (svgElement) =>
    new Promise((resolve) => {
      const serializer = new XMLSerializer();
      const serialized = serializer.serializeToString(svgElement);
      const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;

      const img = new Image();
      img.onload = () => {
        try {
          const scale = 2;
          const padX = 28;
          const padY = 22;
          const shadowPad = 12;
          const cardW = diagramW + padX * 2;
          const cardH = diagramH + padY * 2;
          const totalW = cardW + shadowPad * 2;
          const totalH = cardH + shadowPad * 2;

          const canvas = document.createElement('canvas');
          canvas.width = totalW * scale;
          canvas.height = totalH * scale;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }

          ctx.scale(scale, scale);

          const preset =
            MERMAID_THEME_PRESETS[currentMermaidPreset] || MERMAID_THEME_PRESETS.default;
          const frameColors = preset.frame || {
            bg: '#e6eef8',
            border: '#cbd5e1',
            accent: '#1e40af',
          };

          // Ombrage doux et fond de cadre adapté au preset
          ctx.save();
          ctx.shadowColor =
            currentMermaidPreset === 'sombre'
              ? 'rgba(0, 0, 0, 0.4)'
              : 'rgba(15, 23, 42, 0.11)';
          ctx.shadowBlur = 12;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 4;
          traceRoundedRect(ctx, shadowPad, shadowPad, cardW, cardH, 10);
          ctx.fillStyle = frameColors.bg;
          ctx.fill();
          ctx.restore();

          // Bordure du cadre
          ctx.save();
          traceRoundedRect(ctx, shadowPad, shadowPad, cardW, cardH, 10);
          ctx.strokeStyle = frameColors.border;
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.restore();

          // Barre latérale d'accentuation gauche (style carte)
          ctx.save();
          traceRoundedRect(ctx, shadowPad, shadowPad, cardW, cardH, 10);
          ctx.clip();
          ctx.fillStyle = frameColors.accent;
          ctx.fillRect(shadowPad, shadowPad, 5, cardH);
          ctx.restore();

          // Dessin du schéma Mermaid centré dans le cadre
          ctx.drawImage(img, shadowPad + padX, shadowPad + padY, diagramW, diagramH);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = svgDataUrl;
    });

  let pngUrl = await drawFramedDiagram(svgEl);
  if (!pngUrl) {
    convertForeignObjectsToSvgText(svgEl);
    pngUrl = await drawFramedDiagram(svgEl);
  }
  return pngUrl;
};

