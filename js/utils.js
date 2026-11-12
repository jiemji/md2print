/**
 * @module utils
 * @description Fonctions utilitaires partagées : manipulation de fichiers, génération de slugs,
 * notifications textuelles (`showToast`), chargement dynamique à la demande des bibliothèques
 * d'export (`ensureJsZipLoaded`, `ensureDocxLoaded`), normalisation Markdown, gestion d'images Base64,
 * et ré-export centralisé des modules spécialisés {@link module:tagParsers} et {@link module:mermaidEngine}.
 *
 * @requires ./tagParsers.js
 * @requires ./mermaidEngine.js
 */

import {
  isExecutableHtmlFence,
  isHtmlBlockOpenLine,
  isHtmlBlockCloseLine,
  CALLOUT_CONFIGS,
  resolveCallout,
  BADGE_CONFIGS,
  resolveBadgeClass,
  KNOWN_METRIC_VARIANTS,
  METRIC_VARIANT_MAP,
  parseMetricTag,
  resolveMetricClass,
  COLUMN_COLOR_VARIANT_MAP,
  resolveColumnColor,
  parseColumnFontScale,
  parseColumnTagParams,
  TIMELINE_COLOR_MAP,
  parseTimelineStep,
} from './tagParsers.js';

import {
  normalizeMermaidCode,
  isMermaidHeaderLine,
  findUnfencedMermaidBlockEnd,
  wrapUnfencedMermaidBlocks,
  MERMAID_THEME_PRESETS,
  getMermaidTheme,
  setMermaidTheme,
  clearMermaidCache,
  renderMermaidToSvg,
  renderMermaidBlocksMap,
  MERMAID_FRAME,
  readSvgDiagramSize,
  getMermaidFramedSize,
  renderMermaidToPngDataUrl,
} from './mermaidEngine.js';

export {
  isExecutableHtmlFence,
  isHtmlBlockOpenLine,
  isHtmlBlockCloseLine,
  CALLOUT_CONFIGS,
  resolveCallout,
  BADGE_CONFIGS,
  resolveBadgeClass,
  KNOWN_METRIC_VARIANTS,
  METRIC_VARIANT_MAP,
  parseMetricTag,
  resolveMetricClass,
  COLUMN_COLOR_VARIANT_MAP,
  resolveColumnColor,
  parseColumnFontScale,
  parseColumnTagParams,
  TIMELINE_COLOR_MAP,
  parseTimelineStep,
  normalizeMermaidCode,
  isMermaidHeaderLine,
  findUnfencedMermaidBlockEnd,
  wrapUnfencedMermaidBlocks,
  MERMAID_THEME_PRESETS,
  getMermaidTheme,
  setMermaidTheme,
  clearMermaidCache,
  renderMermaidToSvg,
  renderMermaidBlocksMap,
  MERMAID_FRAME,
  readSvgDiagramSize,
  getMermaidFramedSize,
  renderMermaidToPngDataUrl,
};

const vendorScriptPromises = new Map();

/**
 * Charge dynamiquement un script tiers local (UMD) une seule fois à la demande.
 * @param {string} src - Chemin relatif du script (ex: 'vendor/jszip.min.js')
 * @param {function(): boolean} [isLoadedFn] - Prédicat vérifiant si la bibliothèque globale est déjà présente
 * @returns {Promise<void>}
 */
export const loadVendorScript = (src, isLoadedFn) => {
  if (typeof isLoadedFn === 'function' && isLoadedFn()) {
    return Promise.resolve();
  }
  if (typeof document === 'undefined') {
    return Promise.resolve();
  }
  if (vendorScriptPromises.has(src)) {
    return vendorScriptPromises.get(src);
  }
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      vendorScriptPromises.delete(src);
      reject(new Error(`Impossible de charger la bibliothèque locale : ${src}`));
    };
    document.head.appendChild(script);
  });
  vendorScriptPromises.set(src, promise);
  return promise;
};

/**
 * Garantit que la bibliothèque locale JSZip (vendor/jszip.min.js) est chargée en mémoire.
 * @returns {Promise<void>}
 */
export const ensureJsZipLoaded = () =>
  loadVendorScript(
    'vendor/jszip.min.js',
    () => typeof window !== 'undefined' && Boolean(window.JSZip)
  );

/**
 * Garantit que les bibliothèques locales docx (vendor/docx.umd.js) et JSZip sont chargées en mémoire.
 * @returns {Promise<void>}
 */
export const ensureDocxLoaded = async () => {
  await Promise.all([
    loadVendorScript(
      'vendor/docx.umd.js',
      () => typeof window !== 'undefined' && Boolean(window.docx)
    ),
    ensureJsZipLoaded(),
  ]);
};

/**
 * Transforme une chaîne de caractères en slug propre pour les ancres et noms de fichiers.
 * @param {string} str
 * @returns {string}
 */
export const toSlug = (str) => {
  if (!str) return 'document';
  return (
    str
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'document'
  );
};

/**
 * Échappe les caractères spéciaux HTML.
 * @param {string} str
 * @returns {string}
 */
export const escapeHtml = (str = '') =>
  String(str).replace(
    /[&<>'"]/g,
    (tag) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[tag] || tag
  );

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

let activeToastTimer = null;

/**
 * Affiche une notification textuelle temporaire en bas à droite de l'écran (sans icône ni émoji).
 * @param {string} message - Texte de la notification
 * @param {'info'|'success'|'error'} [type='info'] - Type de notification
 * @returns {void}
 */
export const showToast = (message, type = 'info') => {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('toastContainer');
  if (!container) return;
  container.innerHTML = '';
  if (activeToastTimer) clearTimeout(activeToastTimer);

  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast--error' : type === 'success' ? 'toast--success' : ''}`;
  toast.textContent = message;
  container.appendChild(toast);

  activeToastTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(6px)';
    setTimeout(() => toast.remove(), 200);
  }, 3200);
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
 * Compresse et redimensionne à la volée une Data URL d'image (via `<canvas>`)
 * afin de maîtriser le poids du CSS, d'IndexedDB et des exports autonomes.
 * - Préserve tels quels les formats vectoriels (`svg+xml`) et animés (`gif`).
 * - Redimensionne proportionnellement dans la boîte `maxWidth` x `maxHeight` (défaut : 1920x1080).
 * - Détecte automatiquement si l'image comporte de la transparence réelle (`alpha < 250`) :
 *   - Si l'image est opaque : encode en JPEG (`image/jpeg`, qualité `0.82` par défaut),
 *     nativement compatible avec HTML, CSS, Word (`.docx`) et PowerPoint (`.pptx`).
 *   - Si l'image possède de la transparence : conserve le canal alpha en `image/png`.
 * - Ne remplace l'image source que si la version compressée est effectivement plus légère.
 *
 * @param {string} dataUrl - Data URL Base64 d'origine
 * @param {object} [options={}] - Options de compression
 * @param {number} [options.maxWidth=1920] - Largeur maximale en pixels
 * @param {number} [options.maxHeight=1080] - Hauteur maximale en pixels
 * @param {number} [options.quality=0.82] - Qualité JPEG (entre 0.1 et 1.0)
 * @param {number} [options.minLengthToCompress=40960] - Seuil minimal de longueur Base64 avant compression (~30 Ko)
 * @returns {Promise<string>} Data URL optimisée
 */
export const compressImageDataUrl = (dataUrl, options = {}) =>
  new Promise((resolve) => {
    if (
      typeof document === 'undefined' ||
      typeof Image === 'undefined' ||
      !dataUrl ||
      typeof dataUrl !== 'string' ||
      !dataUrl.startsWith('data:image/')
    ) {
      resolve(dataUrl);
      return;
    }

    const mimeMatch = dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,/i);
    if (!mimeMatch) {
      resolve(dataUrl);
      return;
    }

    const subType = mimeMatch[1].toLowerCase();
    if (subType === 'svg+xml' || subType === 'gif') {
      resolve(dataUrl);
      return;
    }

    const maxWidth = options.maxWidth ?? 1920;
    const maxHeight = options.maxHeight ?? 1080;
    const quality = options.quality ?? 0.82;
    const minLengthToCompress = options.minLengthToCompress ?? 40960;

    if (
      dataUrl.length < minLengthToCompress &&
      (subType === 'jpeg' || subType === 'jpg' || subType === 'png')
    ) {
      resolve(dataUrl);
      return;
    }

    const img = new Image();
    img.onload = () => {
      try {
        const natW = img.naturalWidth || img.width || 0;
        const natH = img.naturalHeight || img.height || 0;
        if (natW <= 0 || natH <= 0) {
          resolve(dataUrl);
          return;
        }

        const { width: targetW, height: targetH } = fitDimensions(natW, natH, maxWidth, maxHeight);
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        if ('imageSmoothingQuality' in ctx) {
          ctx.imageSmoothingQuality = 'high';
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);

        let hasTransparency = false;
        if (subType !== 'jpeg' && subType !== 'jpg' && subType !== 'bmp') {
          try {
            const imgData = ctx.getImageData(0, 0, targetW, targetH).data;
            const step = 32; // Échantillonnage rapide 1 pixel sur 8 (8 * 4 canaux RGBA)
            for (let i = 3; i < imgData.length; i += step) {
              if (imgData[i] < 250) {
                hasTransparency = true;
                break;
              }
            }
          } catch {
            hasTransparency = subType === 'png';
          }
        }

        const outMime = hasTransparency ? 'image/png' : 'image/jpeg';
        const compressedUrl = hasTransparency
          ? canvas.toDataURL('image/png')
          : canvas.toDataURL('image/jpeg', quality);

        if (
          compressedUrl &&
          compressedUrl.startsWith('data:image/') &&
          (compressedUrl.length < dataUrl.length || subType === 'bmp')
        ) {
          resolve(compressedUrl);
        } else {
          resolve(dataUrl);
        }
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });

/**
 * Lit un fichier image local et le compresse automatiquement en Data URL Base64 optimisée.
 * @param {File} file - Fichier image à lire et compresser
 * @param {object} [options={}] - Options transmises à {@link compressImageDataUrl}
 * @returns {Promise<string>} Data URL Base64 compressée
 */
export const readAndCompressImageFile = async (file, options = {}) => {
  const rawDataUrl = await readFileAsDataURL(file);
  return compressImageDataUrl(rawDataUrl, options);
};

/**
 * Parcourt un texte (feuille CSS ou document Markdown) et compresse à la volée toutes les
 * images Base64 volumineuses (`data:image/...;base64,...`) qui y sont intégrées.
 * @param {string} text - Contenu CSS ou Markdown
 * @param {object} [options={}] - Options transmises à {@link compressImageDataUrl}
 * @returns {Promise<string>} Texte avec images Base64 optimisées
 */
export const compressEmbeddedImagesInText = async (text, options = {}) => {
  if (!text || typeof text !== 'string' || !text.includes('data:image/')) {
    return text;
  }
  const minLen = options.minLengthToCompress ?? 40960;
  const dataUrlRegex = /data:image\/(?:png|jpe?g|webp|bmp);base64,[A-Za-z0-9+/=]+/gi;
  const matches = text.match(dataUrlRegex);
  if (!matches || matches.length === 0) {
    return text;
  }

  const uniqueUrls = [...new Set(matches.filter((u) => u.length >= minLen))];
  if (uniqueUrls.length === 0) {
    return text;
  }

  const replacements = new Map();
  for (const rawUrl of uniqueUrls) {
    const compressed = await compressImageDataUrl(rawUrl, options);
    if (compressed && compressed.length < rawUrl.length) {
      replacements.set(rawUrl, compressed);
    }
  }

  if (replacements.size === 0) {
    return text;
  }

  return text.replace(dataUrlRegex, (match) => replacements.get(match) || match);
};

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
  resolved = resolved.replace(
    /\(data:image\/([a-zA-Z0-9+.-]+);(?!base64,)([^)]+)\)/gi,
    (match, _mime, rawPath) => {
      const path = rawPath.trim();
      const fileName = path.split(/[\\/]/).pop();
      if (localImages[path]) return `(${localImages[path]})`;
      if (localImages[fileName]) return `(${localImages[fileName]})`;

      const lowerPath = path.toLowerCase();
      const lowerName = fileName.toLowerCase();
      if (localImages[lowerPath]) return `(${localImages[lowerPath]})`;
      if (localImages[lowerName]) return `(${localImages[lowerName]})`;

      for (const [key, val] of Object.entries(localImages)) {
        if (
          key.toLowerCase() === lowerName ||
          key.split(/[\\/]/).pop().toLowerCase() === lowerName
        ) {
          return `(${val})`;
        }
      }
      return match;
    }
  );

  return resolved;
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
