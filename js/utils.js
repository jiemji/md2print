/**
 * utils.js — Fonctions utilitaires partagées (fichiers, slugs, normalisation Markdown, images)
 */

/**
 * Transforme une chaîne de caractères en slug propre pour les ancres et noms de fichiers.
 * @param {string} str
 * @returns {string}
 */
export const toSlug = (str) => {
  if (!str) return 'document';
  return str
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'document';
};

/**
 * Échappe les caractères spéciaux HTML.
 * @param {string} str
 * @returns {string}
 */
export const escapeHtml = (str = '') =>
  String(str).replace(/[&<>'"]/g, (tag) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag
  ));

/**
 * Extrait le premier titre de niveau 1 (# Titre) d'un texte Markdown.
 * @param {string} mdText
 * @returns {string|null}
 */
export const extractTitle = (mdText) => {
  if (!mdText) return null;
  const match = mdText.match(/^#\s+(.+)$/m);
  return match ? match[1].replace(/[*_`]/g, '').trim() : null;
};

/**
 * Déclenche le téléchargement d'un Blob par le navigateur.
 * @param {Blob} blob
 * @param {string} filename
 * @returns {void}
 */
export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * Lit un fichier local sous forme de texte UTF-8.
 * @param {File} file
 * @returns {Promise<string>}
 */
export const readFileAsText = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Impossible de lire le fichier texte.'));
    reader.readAsText(file, 'UTF-8');
  });

/**
 * Lit un fichier local sous forme d'ArrayBuffer.
 * @param {File} file
 * @returns {Promise<ArrayBuffer>}
 */
export const readFileAsArrayBuffer = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Impossible de lire le fichier binaire.'));
    reader.readAsArrayBuffer(file);
  });

/**
 * Lit un fichier local sous forme de Data URL Base64.
 * @param {File} file
 * @returns {Promise<string>}
 */
export const readFileAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Impossible de convertir le fichier en Base64.'));
    reader.readAsDataURL(file);
  });

/**
 * Redonne la main au thread principal du navigateur pour garder l'interface fluide.
 * @returns {Promise<void>}
 */
export const yieldToMain = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Convertit si nécessaire une Data URL d'image (notamment SVG ou WebP) en Data URL PNG
 * via un élément <canvas> hors-écran afin d'assurer la compatibilité native avec Word et PowerPoint.
 * Les images déjà au format PNG, JPEG ou GIF sont retournées telles quelles sans recompression.
 * @param {string} dataUrl - Data URL Base64 de l'image source
 * @returns {Promise<string>} Data URL Base64 compatible Office (PNG, JPEG ou GIF)
 */
export const ensureOfficeCompatibleImage = (dataUrl) =>
  new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      resolve(dataUrl);
      return;
    }

    const mimeMatch = dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);/i);
    const subType = mimeMatch ? mimeMatch[1].toLowerCase() : '';
    if (subType === 'png' || subType === 'jpeg' || subType === 'jpg' || subType === 'gif') {
      resolve(dataUrl);
      return;
    }

    const img = new Image();
    img.onload = () => {
      try {
        const width = img.naturalWidth || img.width || 800;
        const height = img.naturalHeight || img.height || 600;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });

/**
 * Convertit une Data URL Base64 en tableau d'octets Uint8Array pour l'intégration DOCX.
 * @param {string} dataUrl
 * @returns {{ bytes: Uint8Array, mime: string, ext: string } | null}
 */
export const dataUrlToUint8Array = (dataUrl) => {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return null;
  const match = dataUrl.match(/^data:(image\/([a-zA-Z0-9+.-]+));base64,(.+)$/);
  if (!match) return null;
  const mime = match[1];
  let ext = match[2].toLowerCase();
  if (ext === 'jpeg') ext = 'jpg';
  try {
    const binary = atob(match[3]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return { bytes, mime, ext };
  } catch {
    return null;
  }
};

/**
 * Réduit des dimensions (en conservant le ratio) pour qu'elles tiennent dans une boîte maximale.
 * Algorithme partagé par getImageDimensions() et le planificateur de diapositives (SlidePlanner.js).
 * @param {number} width - Largeur d'origine
 * @param {number} height - Hauteur d'origine
 * @param {number} maxWidth - Largeur maximale autorisée
 * @param {number} maxHeight - Hauteur maximale autorisée
 * @returns {{ width: number, height: number }}
 */
export const fitDimensions = (width, height, maxWidth, maxHeight) => {
  let w = width || maxWidth;
  let h = height || maxHeight;
  if (w > maxWidth) {
    h = Math.round((h * maxWidth) / w);
    w = maxWidth;
  }
  if (h > maxHeight) {
    w = Math.round((w * maxHeight) / h);
    h = maxHeight;
  }
  return { width: Math.max(1, w), height: Math.max(1, h) };
};

/**
 * Calcule les dimensions d'affichage d'une image Base64 en conservant son ratio.
 * @param {string} dataUrl
 * @param {number} maxWidth
 * @param {number} maxHeight
 * @returns {Promise<{ width: number, height: number }>}
 */
export const getImageDimensions = (dataUrl, maxWidth = 520, maxHeight = 340) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve(fitDimensions(img.naturalWidth, img.naturalHeight, maxWidth, maxHeight));
    };
    img.onerror = () => resolve({ width: maxWidth, height: Math.round(maxHeight * 0.65) });
    img.src = dataUrl;
  });

/**
 * Génère le jeton interne représentant une image Base64 dans le flux Markdown de l'éditeur.
 * @param {string} id - Identifiant interne de l'image (ex: 'img-1')
 * @param {string} [alt='image'] - Texte alternatif / nom de l'image
 * @returns {string} Jeton interne de cartouche
 */
export const createImageCartouche = (id, alt = 'image') => {
  const cleanAlt = (alt || 'image').replace(/[\r\n[\]()]/g, '').trim() || 'image';
  return `[image : ${cleanAlt} (${id})]`;
};

/**
 * Remplace toutes les images Base64 brutes ![alt](data:image/...;base64,...) d'un texte Markdown
 * par des jetons de cartouches [image] tout en stockant le binaire dans localImages.
 * @param {string} markdownText - Contenu Markdown brut (ex: à l'ouverture d'un fichier .md)
 * @param {Record<string, string>} localImages - Dictionnaire en mémoire des images
 * @param {function(): string} nextIdFn - Fonction générant un identifiant unique (ex: 'img-1')
 * @returns {string} Contenu Markdown avec jetons [image]
 */
export const collapseBase64ToCartouches = (markdownText, localImages, nextIdFn) => {
  if (!markdownText) return '';
  return markdownText.replace(
    /!\[([^\]]*)\]\((data:image\/[^;)]+(?:;[^;)]+)*;base64,[^)]+)\)/gi,
    (_match, alt, rawDataUrl) => {
      const cleanDataUrl = rawDataUrl.replace(/\s+/g, '');
      let existingId = Object.keys(localImages).find(
        (k) => /^img-\d+$/i.test(k) && localImages[k] === cleanDataUrl
      );
      if (!existingId) {
        existingId = nextIdFn();
        localImages[existingId] = cleanDataUrl;
      }
      return createImageCartouche(existingId, alt || 'image');
    }
  );
};

/**
 * Remplace les jetons de cartouches [image] ainsi que les chemins d'images locaux
 * par leur Data URL Base64 stockée dans localImages (pour l'aperçu, la sauvegarde .md et les exports).
 * @param {string} markdownText
 * @param {Record<string, string>} localImages
 * @returns {string}
 */
export const resolveImagePaths = (markdownText, localImages = {}) => {
  if (!markdownText) return '';

  // 1. Résolution des cartouches [image : alt (img-X)] (avec ou sans ligne secondaire historique)
  let resolved = markdownText.replace(
    /\[image\s*:\s*([^\n]*?)\s*\((img-\d+)\)\](?:\r?\n\[binaire base64 masqué\])?/gi,
    (_match, alt, id) => {
      const dataUrl = localImages[id] || localImages[id.toLowerCase()];
      if (!dataUrl) return '';
      const cleanAlt = (alt || 'image').trim();
      return `![${cleanAlt}](${dataUrl})`;
    }
  );

  // 2. Résolution des chemins locaux éventuels (data:image/png;c:\chemin\image.png)
  resolved = resolved.replace(/\(data:image\/([a-zA-Z0-9+.-]+);(?!base64,)([^)]+)\)/gi, (match, _mime, rawPath) => {
    const path = rawPath.trim();
    const fileName = path.split(/[\\/]/).pop();
    if (localImages[path]) return `(${localImages[path]})`;
    if (localImages[fileName]) return `(${localImages[fileName]})`;

    const lowerPath = path.toLowerCase();
    const lowerName = fileName.toLowerCase();
    if (localImages[lowerPath]) return `(${localImages[lowerPath]})`;
    if (localImages[lowerName]) return `(${localImages[lowerName]})`;

    for (const [key, val] of Object.entries(localImages)) {
      if (key.toLowerCase() === lowerName || key.split(/[\\/]/).pop().toLowerCase() === lowerName) {
        return `(${val})`;
      }
    }
    return match;
  });

  return resolved;
};

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
  return /^(?:graph\s+(?:TB|TD|BT|RL|LR)|flowchart\s+(?:TB|TD|BT|RL|LR)|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|gantt|pie(?:\s+title\b)?|mindmap|timeline|journey|gitGraph|quadrantChart|xychart-beta)\b/i.test(
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
    /^(?:subgraph|end|style|classDef|class|click|linkStyle|direction|participant|actor|note|loop|alt|else|opt|par|and|rect|activate|deactivate|autonumber|title|section|dateFormat|axisFormat|tickInterval|excludes|includes|todayMarker|state|accTitle|accDescr|%%)\b/i.test(
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

/**
 * Normalise et répare automatiquement les tableaux et particularités Markdown.
 * @param {string} rawMarkdown
 * @returns {string}
 */
export const normalizeMarkdown = (rawMarkdown) => {
  if (!rawMarkdown) return '';

  // Encapsule les éventuels schémas Mermaid non délimités par ```mermaid
  let text = wrapUnfencedMermaidBlocks(rawMarkdown);

  // Nettoie les ancres factices devant les titres (ex: [title](link)# Mon Titre)
  text = text.replace(/^\[.*?\]\(.*?\)\s*(#+)/gm, '$1');

  const lines = text.split('\n');
  const normalizedLines = [];
  let inCodeFence = false;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      inCodeFence = !inCodeFence;
      normalizedLines.push(line);
      i++;
      continue;
    }

    if (inCodeFence) {
      normalizedLines.push(line);
      i++;
      continue;
    }

    // Espaces insécables devant le symbole € hors blocs de code
    const formattedLine = line
      .replace(/(\d+)\s+(\d+)\s+(\d+)\s*€/g, '$1\u00A0$2\u00A0$3\u00A0€')
      .replace(/(\d+)\s+(\d+)\s*€/g, '$1\u00A0$2\u00A0€')
      .replace(/(\d+)\s*€/g, '$1\u00A0€');

    if (trimmed.includes('|') && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      const isDelimiterCandidate =
        /^\|?(\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?$/.test(nextLine) ||
        (/^\|?\s*:?-{2,}:?\s*\|/.test(nextLine) && nextLine.includes('---'));

      if (isDelimiterCandidate) {
        let headerCells = trimmed.split('|');
        if (trimmed.startsWith('|')) headerCells.shift();
        if (trimmed.endsWith('|')) headerCells.pop();
        headerCells = headerCells.map((c) => c.trim());
        const colCount = headerCells.length;

        if (colCount > 0) {
          let delimitCells = nextLine.split('|');
          if (nextLine.startsWith('|')) delimitCells.shift();
          if (nextLine.endsWith('|')) delimitCells.pop();
          delimitCells = delimitCells.map((c) => c.trim()).filter((c) => c.length > 0);

          const alignRules = [];
          for (let c = 0; c < colCount; c++) {
            if (delimitCells[c]) {
              const item = delimitCells[c];
              const leftColon = item.startsWith(':');
              const rightColon = item.endsWith(':');
              if (leftColon && rightColon) alignRules.push(':---:');
              else if (rightColon) alignRules.push('---:');
              else if (leftColon) alignRules.push(':---');
              else alignRules.push('---');
            } else {
              alignRules.push('---');
            }
          }
          const fixedDelimitRow = '| ' + alignRules.join(' | ') + ' |';

          if (normalizedLines.length > 0 && normalizedLines[normalizedLines.length - 1].trim() !== '') {
            normalizedLines.push('');
          }

          normalizedLines.push('| ' + headerCells.join(' | ') + ' |');
          normalizedLines.push(fixedDelimitRow);

          i += 2;

          while (i < lines.length) {
            const rowLine = lines[i];
            const rowTrimmed = rowLine.trim();

            if (
              rowTrimmed === '' ||
              rowTrimmed.startsWith('#') ||
              rowTrimmed.startsWith('```') ||
              rowTrimmed.startsWith('---')
            ) {
              break;
            }

            if (rowTrimmed.includes('|')) {
              let rowCells = rowTrimmed.split('|');
              if (rowTrimmed.startsWith('|')) rowCells.shift();
              if (rowTrimmed.endsWith('|')) rowCells.pop();
              rowCells = rowCells.map((c) => c.trim());

              while (rowCells.length < colCount) {
                rowCells.push('');
              }
              if (rowCells.length > colCount) {
                rowCells = rowCells.slice(0, colCount);
              }

              normalizedLines.push('| ' + rowCells.join(' | ') + ' |');
              i++;
            } else {
              break;
            }
          }

          normalizedLines.push('');
          continue;
        }
      }
    }

    normalizedLines.push(formattedLine);
    i++;
  }

  return normalizedLines.join('\n');
};

/**
 * Vérifie la conformité structurelle d'un objet de configuration output_config.json.
 * @param {unknown} configData - Données JSON parsées à valider
 * @returns {{ valid: boolean, error: string|null }} Résultat de validation
 */
export const validateOutputConfig = (configData) => {
  if (!configData || typeof configData !== 'object' || Array.isArray(configData)) {
    return {
      valid: false,
      error: 'Le fichier JSON doit représenter un objet de configuration.',
    };
  }

  if (configData.documents !== undefined && !Array.isArray(configData.documents)) {
    return {
      valid: false,
      error: 'La propriété "documents" doit être un tableau.',
    };
  }

  if (configData.templates !== undefined && !Array.isArray(configData.templates)) {
    return {
      valid: false,
      error: 'La propriété "templates" doit être un tableau.',
    };
  }

  const hasDocuments = Array.isArray(configData.documents) && configData.documents.length > 0;
  const hasTemplates = Array.isArray(configData.templates) && configData.templates.length > 0;

  if (!hasDocuments && !hasTemplates) {
    return {
      valid: false,
      error: 'Configuration invalide : aucune section "documents" ou "templates" détectée.',
    };
  }

  return { valid: true, error: null };
};

/**
 * Nettoie du dictionnaire localImages les identifiants internes (img-X) qui ne sont plus
 * référencés dans le texte Markdown courant.
 * @param {string} markdownText - Contenu Markdown courant avec jetons [image]
 * @param {Record<string, string>} localImages - Dictionnaire en mémoire des images Base64
 * @returns {Record<string, string>} Dictionnaire nettoyé (muté sur place et retourné)
 */
export const pruneUnusedLocalImages = (markdownText = '', localImages = {}) => {
  const usedIds = new Set();
  const cartoucheRegex = /\[image\s*:\s*[^\n]*?\((img-\d+)\)\]/gi;
  let match;

  while ((match = cartoucheRegex.exec(markdownText)) !== null) {
    usedIds.add(match[1]);
  }

  for (const key of Object.keys(localImages)) {
    if (/^img-\d+$/.test(key) && !usedIds.has(key)) {
      delete localImages[key];
    }
  }

  return localImages;
};

let mermaidInitialized = false;
let mermaidIdSeq = 1;
const mermaidSvgCache = new Map();

/**
 * Initialise la bibliothèque locale window.mermaid si disponible.
 * @returns {boolean}
 */
function ensureMermaidInitialized() {
  if (typeof window === 'undefined' || !window.mermaid) return false;
  if (!mermaidInitialized) {
    window.mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'default',
      fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      flowchart: {
        htmlLabels: true,
        useMaxWidth: true,
        curve: 'basis',
        padding: 15,
      },
      sequence: {
        useMaxWidth: true,
      },
    });
    mermaidInitialized = true;
  }
  return true;
}

/**
 * Convertit un bloc de code Mermaid en chaîne SVG via window.mermaid.render().
 * Utilise un conteneur hors-écran sur fond clair pour garantir des mesures DOM exactes
 * quel que soit le thème actif (Sombre ou Sépia), ainsi qu'un cache en mémoire.
 * @param {string} code - Code source du schéma Mermaid
 * @returns {Promise<string|null>} Balisage <svg> ou null si la syntaxe est incomplète/invalide
 */
export const renderMermaidToSvg = async (code) => {
  const trimmedCode = normalizeMermaidCode(code);
  if (!trimmedCode || !ensureMermaidInitialized()) return null;

  if (mermaidSvgCache.has(trimmedCode)) {
    return mermaidSvgCache.get(trimmedCode);
  }

  const renderId = `md2print-mmd-${mermaidIdSeq++}`;
  let hostEl = null;
  try {
    if (typeof document !== 'undefined' && document.body) {
      hostEl = document.createElement('div');
      hostEl.id = `host-${renderId}`;
      hostEl.style.cssText =
        'position:fixed;left:-9999px;top:0;width:1600px;background:#ffffff;color:#0f172a;font-family:"Segoe UI",Roboto,Arial,sans-serif;font-size:14px;line-height:1.4;opacity:0;pointer-events:none;z-index:-1;';
      document.body.appendChild(hostEl);
    }

    const result = await window.mermaid.render(renderId, trimmedCode, hostEl || undefined);
    const svg = result?.svg || null;
    if (svg) {
      if (mermaidSvgCache.size >= 60) {
        const firstKey = mermaidSvgCache.keys().next().value;
        mermaidSvgCache.delete(firstKey);
      }
      mermaidSvgCache.set(trimmedCode, svg);
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
  const svgEl = new DOMParser()
    .parseFromString(svgMarkup, 'image/svg+xml')
    .querySelector('svg');
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

          // Ombrage doux et fond de cadre légèrement plus foncé (#e6eef8)
          ctx.save();
          ctx.shadowColor = 'rgba(15, 23, 42, 0.11)';
          ctx.shadowBlur = 12;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 4;
          traceRoundedRect(ctx, shadowPad, shadowPad, cardW, cardH, 10);
          ctx.fillStyle = '#e6eef8';
          ctx.fill();
          ctx.restore();

          // Bordure du cadre
          ctx.save();
          traceRoundedRect(ctx, shadowPad, shadowPad, cardW, cardH, 10);
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.restore();

          // Barre latérale d'accentuation gauche (style carte)
          ctx.save();
          traceRoundedRect(ctx, shadowPad, shadowPad, cardW, cardH, 10);
          ctx.clip();
          ctx.fillStyle = '#1e40af';
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

/**
 * Dictionnaire de configuration des types d'alertes / callouts Markdown (syntaxe > [!TYPE]).
 * Associe chaque identifiant brut à un type normalisé et un titre par défaut en français.
 * @type {Record<string, { type: string, defaultTitle: string }>}
 */
export const CALLOUT_CONFIGS = {
  NOTE: { type: 'note', defaultTitle: 'NOTE' },
  INFO: { type: 'info', defaultTitle: 'INFORMATION' },
  INFORMATION: { type: 'info', defaultTitle: 'INFORMATION' },
  TIP: { type: 'tip', defaultTitle: 'ASTUCE' },
  ASTUCE: { type: 'tip', defaultTitle: 'ASTUCE' },
  SUCCESS: { type: 'tip', defaultTitle: 'SUCCÈS' },
  IMPORTANT: { type: 'important', defaultTitle: 'IMPORTANT' },
  WARNING: { type: 'warning', defaultTitle: 'AVERTISSEMENT' },
  AVERTISSEMENT: { type: 'warning', defaultTitle: 'AVERTISSEMENT' },
  WARN: { type: 'warning', defaultTitle: 'AVERTISSEMENT' },
  CAUTION: { type: 'danger', defaultTitle: 'ATTENTION' },
  ATTENTION: { type: 'danger', defaultTitle: 'ATTENTION' },
  DANGER: { type: 'danger', defaultTitle: 'DANGER' },
  CRITIQUE: { type: 'danger', defaultTitle: 'CRITIQUE' },
};

/**
 * Résout le type normalisé et le libellé d'un callout Markdown.
 * @param {string} rawType - Type brut (ex: 'NOTE', 'WARNING', 'ASTUCE')
 * @param {string} [rawTitle] - Titre personnalisé optionnel
 * @returns {{ kind: string, title: string, rawType: string }}
 */
export function resolveCallout(rawType, rawTitle) {
  const upper = (rawType || '').trim().toUpperCase();
  const conf = CALLOUT_CONFIGS[upper] || {
    type: 'note',
    defaultTitle: upper || 'NOTE',
  };
  const title = (rawTitle || '').trim() || conf.defaultTitle;
  return {
    kind: conf.type,
    title,
    rawType: upper,
  };
}

/**
 * Dictionnaire de correspondance des classes de badges inline (syntaxe [badge:type:texte]).
 * @type {Record<string, string>}
 */
export const BADGE_CONFIGS = {
  info: 'badge-info',
  note: 'badge-info',
  blue: 'badge-info',
  success: 'badge-success',
  tip: 'badge-success',
  astuce: 'badge-success',
  valide: 'badge-success',
  ok: 'badge-success',
  green: 'badge-success',
  warning: 'badge-warning',
  warn: 'badge-warning',
  avertissement: 'badge-warning',
  orange: 'badge-warning',
  yellow: 'badge-warning',
  danger: 'badge-danger',
  error: 'badge-danger',
  critical: 'badge-danger',
  critique: 'badge-danger',
  attention: 'badge-danger',
  caution: 'badge-danger',
  red: 'badge-danger',
  important: 'badge-important',
  purple: 'badge-important',
  violet: 'badge-important',
  neutral: 'badge-neutral',
  neutre: 'badge-neutral',
  gray: 'badge-neutral',
  grey: 'badge-neutral',
  default: 'badge-neutral',
};

/**
 * Résout la classe CSS d'un badge inline.
 * @param {string} rawType - Type brut (ex: 'info', 'success', 'danger')
 * @returns {string} Classe CSS (ex: 'badge-info', 'badge-success')
 */
export function resolveBadgeClass(rawType) {
  const key = (rawType || '').trim().toLowerCase();
  return BADGE_CONFIGS[key] || 'badge-neutral';
}

/**
 * Ensemble des variantes reconnues pour les cartouches de données/métriques.
 * @type {Set<string>}
 */
export const KNOWN_METRIC_VARIANTS = new Set([
  'success',
  'danger',
  'warning',
  'info',
  'important',
  'neutral',
  'vert',
  'rouge',
  'orange',
  'jaune',
  'bleu',
  'violet',
  'gris',
  'ok',
  'critique',
  'urgent',
  'warn',
  'error',
  'tip',
  'note',
]);

/**
 * Dictionnaire de correspondance des classes CSS pour les cartouches de données/métriques.
 * @type {Record<string, string>}
 */
export const METRIC_VARIANT_MAP = {
  success: 'metric-card-success',
  vert: 'metric-card-success',
  ok: 'metric-card-success',
  tip: 'metric-card-success',
  danger: 'metric-card-danger',
  rouge: 'metric-card-danger',
  critique: 'metric-card-danger',
  urgent: 'metric-card-danger',
  error: 'metric-card-danger',
  warning: 'metric-card-warning',
  warn: 'metric-card-warning',
  orange: 'metric-card-warning',
  jaune: 'metric-card-warning',
  info: 'metric-card-info',
  bleu: 'metric-card-info',
  note: 'metric-card-info',
  important: 'metric-card-important',
  violet: 'metric-card-important',
  purple: 'metric-card-important',
  neutral: 'metric-card-neutral',
  gris: 'metric-card-neutral',
  gray: 'metric-card-neutral',
  default: 'metric-card-default',
};

/**
 * Analyse et extrait la valeur, le libellé et la variante d'une balise chiffre/métrique.
 * Supporte les formats :
 * - [chiffre:valeur:libellé:variante]
 * - [chiffre:valeur:libellé]
 * - [chiffre:valeur:variante]
 * - [chiffre:valeur]
 * ainsi que les alias [metric:...], [stat:...] et [kpi:...].
 * @param {string} valStr - Valeur brute (ex: '98%', '1,2 M€', '+42%')
 * @param {string} [part2] - Deuxième composante (libellé ou variante)
 * @param {string} [part3] - Troisième composante (variante)
 * @returns {{ val: string, label: string, variant: string }}
 */
export function parseMetricTag(valStr, part2, part3) {
  const val = (valStr || '').trim();
  let label = (part2 || '').trim();
  let variant = (part3 || '').trim().toLowerCase();

  if (label && !variant && KNOWN_METRIC_VARIANTS.has(label.toLowerCase())) {
    variant = label.toLowerCase();
    label = '';
  }

  return { val, label, variant: variant || 'default' };
}

/**
 * Résout la classe CSS d'une cartouche métrique.
 * @param {string} rawVariant - Variante brute (ex: 'success', 'danger')
 * @returns {string} Classe CSS de la carte
 */
export function resolveMetricClass(rawVariant) {
  const k = (rawVariant || '').trim().toLowerCase();
  return METRIC_VARIANT_MAP[k] || 'metric-card-default';
}


