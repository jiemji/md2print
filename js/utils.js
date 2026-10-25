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
  if (ext === 'svg+xml') ext = 'png';
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
      let w = img.naturalWidth || maxWidth;
      let h = img.naturalHeight || maxHeight;
      if (w > maxWidth) {
        h = Math.round((h * maxWidth) / w);
        w = maxWidth;
      }
      if (h > maxHeight) {
        w = Math.round((w * maxHeight) / h);
        h = maxHeight;
      }
      resolve({ width: Math.max(1, w), height: Math.max(1, h) });
    };
    img.onerror = () => resolve({ width: maxWidth, height: Math.round(maxHeight * 0.65) });
    img.src = dataUrl;
  });

/**
 * Génère la cartouche textuelle sur 2 lignes représentant une image Base64 dans l'éditeur.
 * @param {string} id - Identifiant interne de l'image (ex: 'img-1')
 * @param {string} [alt='image'] - Texte alternatif / nom de l'image
 * @returns {string} Cartouche sur 2 lignes
 */
export const createImageCartouche = (id, alt = 'image') => {
  const cleanAlt = (alt || 'image').replace(/[\r\n[\]()]/g, '').trim() || 'image';
  return `[image : ${cleanAlt} (${id})]\n[binaire base64 masqué]`;
};

/**
 * Remplace toutes les images Base64 brutes ![alt](data:image/...;base64,...) d'un texte Markdown
 * par des cartouches de 2 lignes [image] tout en stockant le binaire dans localImages.
 * @param {string} markdownText - Contenu Markdown brut (ex: à l'ouverture d'un fichier .md)
 * @param {Record<string, string>} localImages - Dictionnaire en mémoire des images
 * @param {function(): string} nextIdFn - Fonction générant un identifiant unique (ex: 'img-1')
 * @returns {string} Contenu Markdown avec cartouches [image] sur 2 lignes
 */
export const collapseBase64ToCartouches = (markdownText, localImages, nextIdFn) => {
  if (!markdownText) return '';
  return markdownText.replace(
    /!\[([^\]]*)\]\((data:image\/[a-zA-Z0-9+.-]+;base64,[^)]+)\)/gi,
    (_match, alt, dataUrl) => {
      const id = nextIdFn();
      localImages[id] = dataUrl.trim();
      return createImageCartouche(id, alt || 'image');
    }
  );
};

/**
 * Remplace les cartouches de 2 lignes [image] ainsi que les chemins d'images locaux
 * par leur Data URL Base64 stockée dans localImages (pour l'aperçu, la sauvegarde .md et les exports).
 * @param {string} markdownText
 * @param {Record<string, string>} localImages
 * @returns {string}
 */
export const resolveImagePaths = (markdownText, localImages = {}) => {
  if (!markdownText) return '';

  // 1. Résolution des cartouches sur 2 lignes [image : alt (img-X)]\n[binaire base64 masqué]
  let resolved = markdownText.replace(
    /\[image\s*:\s*([^\n]*?)\s*\((img-\d+)\)\]\r?\n\[binaire base64 masqué\]/gi,
    (match, alt, id) => {
      const dataUrl = localImages[id];
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
 * Normalise et répare automatiquement les tableaux et particularités Markdown.
 * @param {string} rawMarkdown
 * @returns {string}
 */
export const normalizeMarkdown = (rawMarkdown) => {
  if (!rawMarkdown) return '';

  // Nettoie les ancres factices devant les titres (ex: [title](link)# Mon Titre)
  let text = rawMarkdown.replace(/^\[.*?\]\(.*?\)\s*(#+)/gm, '$1');

  // Espaces insécables devant le symbole €
  text = text
    .replace(/(\d+)\s+(\d+)\s+(\d+)\s*€/g, '$1\u00A0$2\u00A0$3\u00A0€')
    .replace(/(\d+)\s+(\d+)\s*€/g, '$1\u00A0$2\u00A0€')
    .replace(/(\d+)\s*€/g, '$1\u00A0€');

  const lines = text.split('\n');
  const normalizedLines = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.includes('|') && !trimmed.startsWith('```') && i + 1 < lines.length) {
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

    normalizedLines.push(line);
    i++;
  }

  return normalizedLines.join('\n');
};
