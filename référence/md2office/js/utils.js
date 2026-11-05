/**
 * Utilitaires partagés pour md2office
 */

/**
 * Convertit un texte en slug (nom de fichier sûr)
 * @param {string} text
 * @returns {string}
 */
export const toSlug = (text) =>
  (text || 'document')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

/**
 * Télécharge un Blob en tant que fichier
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
  URL.revokeObjectURL(url);
};

/**
 * Yield au main thread pour éviter de figer l'UI
 * @returns {Promise<void>}
 */
export const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

/**
 * Lit un fichier texte depuis un objet File
 * @param {File} file
 * @returns {Promise<string>}
 */
export const readFileAsText = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });

/**
 * Lit un fichier en ArrayBuffer depuis un objet File
 * @param {File} file
 * @returns {Promise<ArrayBuffer>}
 */
export const readFileAsArrayBuffer = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
