/**
 * @module StorageService
 * @description Service de persistance locale basé sur IndexedDB pour md2print.
 * Gère le stockage asynchrone haute capacité du brouillon Markdown,
 * du dictionnaire d'images Base64 (sans la limite de 5 Mo du localStorage),
 * des préférences d'interface (thème, mode Rapport/Slide, défilement lié, largeur du séparateur)
 * et des fichiers de configuration / modèles d'entreprise personnalisés (Word .docx et PowerPoint .potx).
 */

import { showToast } from './utils.js';

const DB_NAME = 'md2print_db';
const DB_VERSION = 1;
const STORE_STATE = 'app_state';
const STORE_IMAGES = 'local_images';

let dbInstancePromise = null;
let lastQuotaWarningAt = 0;

/**
 * Journalise une erreur IndexedDB et avertit l'utilisateur en cas de dépassement du quota disque.
 * @param {string} operation - Nom de l'opération en échec
 * @param {unknown} err - Erreur interceptée
 * @returns {void}
 */
function handleStorageError(operation, err) {
  console.warn(`[StorageService] Échec lors de ${operation} :`, err);
  const isQuotaError =
    err &&
    typeof err === 'object' &&
    (err.name === 'QuotaExceededError' || err.code === 22);
  if (isQuotaError && typeof document !== 'undefined') {
    const now = Date.now();
    if (now - lastQuotaWarningAt > 30000) {
      lastQuotaWarningAt = now;
      showToast(
        "Espace de stockage local saturé : certaines données n'ont pas pu être sauvegardées.",
        'error'
      );
    }
  }
}

/**
 * Supprime les anciennes clés localStorage éventuellement créées par les versions précédentes.
 * @returns {void}
 */
function cleanupLegacyLocalStorage() {
  try {
    localStorage.removeItem('md2print_draft_v1');
    localStorage.removeItem('md2print_prefs_v1');
  } catch {
    // Ignore si localStorage est inaccessible
  }
}

/**
 * Ouvre (ou initialise) la base de données IndexedDB de l'application.
 * @returns {Promise<IDBDatabase>}
 */
export function openDatabase() {
  if (dbInstancePromise) return dbInstancePromise;

  cleanupLegacyLocalStorage();

  dbInstancePromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB non pris en charge par ce navigateur.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_STATE)) {
        db.createObjectStore(STORE_STATE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_IMAGES)) {
        db.createObjectStore(STORE_IMAGES, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      db.onversionchange = () => {
        db.close();
        dbInstancePromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      dbInstancePromise = null;
      reject(request.error || new Error("Impossible d'ouvrir la base IndexedDB."));
    };
  });

  return dbInstancePromise;
}

/**
 * Sauvegarde les préférences d'affichage (thème, mode Rapport/Slide et largeur de l'éditeur) dans IndexedDB.
 * @param {{ theme: string, currentViewport: string, editorWidthPct?: number }} prefs
 * @returns {Promise<void>}
 */
export async function savePreferences(prefs) {
  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_STATE], 'readwrite');
      const stateStore = tx.objectStore(STORE_STATE);
      stateStore.put({
        id: 'prefs',
        theme: prefs.theme,
        currentViewport: prefs.currentViewport,
        editorWidthPct:
          typeof prefs.editorWidthPct === 'number' ? prefs.editorWidthPct : 50,
        syncScroll: typeof prefs.syncScroll === 'boolean' ? prefs.syncScroll : true,
        updatedAt: Date.now(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    handleStorageError('savePreferences', err);
  }
}

/**
 * Sauvegarde une configuration output_config.json personnalisée dans IndexedDB.
 * @param {{ outputConfig: object, configFileName: string }} configPayload
 * @returns {Promise<void>}
 */
export async function saveCustomConfig({ outputConfig, configFileName }) {
  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_STATE], 'readwrite');
      tx.objectStore(STORE_STATE).put({
        id: 'custom_config',
        outputConfig,
        configFileName,
        updatedAt: Date.now(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    handleStorageError('saveCustomConfig', err);
  }
}

/**
 * Sauvegarde un modèle Word (.docx) personnalisé (ArrayBuffer) dans IndexedDB.
 * @param {{ templateBuffer: ArrayBuffer, templateFileName: string }} templatePayload
 * @returns {Promise<void>}
 */
export async function saveCustomTemplate({ templateBuffer, templateFileName }) {
  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_STATE], 'readwrite');
      tx.objectStore(STORE_STATE).put({
        id: 'custom_template',
        templateBuffer,
        templateFileName,
        updatedAt: Date.now(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    handleStorageError('saveCustomTemplate', err);
  }
}

/**
 * Sauvegarde un modèle PowerPoint (.potx) personnalisé (ArrayBuffer) dans IndexedDB.
 * @param {{ pptTemplateBuffer: ArrayBuffer, pptTemplateFileName: string }} pptTemplatePayload
 * @returns {Promise<void>}
 */
export async function saveCustomPptTemplate({ pptTemplateBuffer, pptTemplateFileName }) {
  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_STATE], 'readwrite');
      tx.objectStore(STORE_STATE).put({
        id: 'custom_ppt_template',
        pptTemplateBuffer,
        pptTemplateFileName,
        updatedAt: Date.now(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    handleStorageError('saveCustomPptTemplate', err);
  }
}

/**
 * Sauvegarde une feuille de style CSS personnalisée (vision rapport ou slide) dans IndexedDB.
 * Effectue une fusion non destructive : si seule la feuille rapport ou slide est fournie,
 * la feuille existante de l'autre mode déjà stockée dans IndexedDB est préservée.
 *
 * @param {object} cssPayload - Données de la feuille de style
 * @param {string|null} [cssPayload.reportCss] - Code CSS personnalisé pour la Vision Rapport
 * @param {string|null} [cssPayload.slideCss] - Code CSS personnalisé pour la Vision Slide
 * @param {string} [cssPayload.fileName] - Nom du fichier de style source
 * @returns {Promise<void>}
 */
export async function saveCustomCss(cssPayload) {
  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_STATE], 'readwrite');
      const store = tx.objectStore(STORE_STATE);
      const getReq = store.get('custom_css');
      getReq.onsuccess = () => {
        const existing = getReq.result || {};
        store.put({
          id: 'custom_css',
          reportCss:
            typeof cssPayload.reportCss === 'string'
              ? cssPayload.reportCss
              : (existing.reportCss || null),
          slideCss:
            typeof cssPayload.slideCss === 'string'
              ? cssPayload.slideCss
              : (existing.slideCss || null),
          fileName: cssPayload.fileName || existing.fileName || 'custom.css',
          updatedAt: Date.now(),
        });
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    handleStorageError('saveCustomCss', err);
  }
}

/**
 * Sauvegarde les configurations de personnalisation des balises (Rapport et Slide) dans IndexedDB.
 * @param {{ report?: object, slide?: object }} configs
 * @returns {Promise<void>}
 */
export async function saveThemeConfigs(configs) {
  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_STATE], 'readwrite');
      tx.objectStore(STORE_STATE).put({
        id: 'custom_theme_configs',
        configs: configs && typeof configs === 'object' ? configs : {},
        updatedAt: Date.now(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    handleStorageError('saveThemeConfigs', err);
  }
}

/**
 * Supprime la configuration JSON, les modèles Word/PowerPoint et les styles CSS personnalisés de IndexedDB.
 * @returns {Promise<void>}
 */
export async function clearCustomConfigAndTemplate() {
  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_STATE], 'readwrite');
      const store = tx.objectStore(STORE_STATE);
      store.delete('custom_config');
      store.delete('custom_template');
      store.delete('custom_ppt_template');
      store.delete('custom_css');
      store.delete('custom_theme_configs');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    handleStorageError('clearCustomConfigAndTemplate', err);
  }
}

/**
 * Supprime l'ensemble des styles CSS et configurations de thèmes personnalisés d'IndexedDB.
 * @returns {Promise<void>}
 */
export async function clearCustomStyles() {
  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_STATE], 'readwrite');
      const store = tx.objectStore(STORE_STATE);
      store.delete('custom_css');
      store.delete('custom_theme_configs');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    handleStorageError('clearCustomStyles', err);
  }
}

/**
 * Supprime les surcharges personnalisées d'un mode spécifique ('report' ou 'slide') dans IndexedDB.
 * Si aucun style personnalisé ne subsiste pour aucun mode, supprime les entrées d'IndexedDB.
 * @param {'report'|'slide'} mode - Mode ciblé ('report' ou 'slide')
 * @returns {Promise<void>}
 */
export async function removeCustomStyleForMode(mode) {
  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_STATE], 'readwrite');
      const store = tx.objectStore(STORE_STATE);

      // Traitement de custom_css
      const getCssReq = store.get('custom_css');
      getCssReq.onsuccess = () => {
        const item = getCssReq.result;
        if (item) {
          if (mode === 'slide') item.slideCss = null;
          if (mode === 'report') item.reportCss = null;
          if (!item.slideCss && !item.reportCss) {
            store.delete('custom_css');
          } else {
            item.updatedAt = Date.now();
            store.put(item);
          }
        }
      };

      // Traitement de custom_theme_configs
      const getThemeReq = store.get('custom_theme_configs');
      getThemeReq.onsuccess = () => {
        const item = getThemeReq.result;
        if (item && item.configs) {
          delete item.configs[mode];
          if (Object.keys(item.configs).length === 0) {
            store.delete('custom_theme_configs');
          } else {
            item.updatedAt = Date.now();
            store.put(item);
          }
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    handleStorageError('removeCustomStyleForMode', err);
  }
}

/**
 * Sauvegarde de manière atomique le brouillon Markdown et l'ensemble de ses images Base64 dans IndexedDB.
 * @param {object} draftData
 * @param {string} draftData.markdown - Contenu Markdown courant (avec jetons [image])
 * @param {string} draftData.currentFileName - Nom du fichier actif
 * @param {boolean} draftData.isDirty - Indicateur de modifications non sauvegardées
 * @param {number} draftData.imageSeq - Compteur séquentiel d'identifiants d'images
 * @param {Record<string, string>} draftData.localImages - Dictionnaire d'images Base64
 * @returns {Promise<void>}
 */
export async function saveDraftState({
  markdown,
  currentFileName,
  isDirty,
  imageSeq,
  localImages = {},
}) {
  try {
    const db = await openDatabase();
    const cleanImages = {};
    for (const [imgId, dataUrl] of Object.entries(localImages || {})) {
      if (imgId && typeof dataUrl === 'string' && dataUrl.length > 0) {
        cleanImages[imgId] = dataUrl;
      }
    }

    const hasImages = Object.keys(cleanImages).length > 0;

    if (!markdown && !hasImages && currentFileName === 'Sans titre.md' && !isDirty) {
      await clearDraftState();
      return;
    }

    await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_STATE, STORE_IMAGES], 'readwrite');
      const stateStore = tx.objectStore(STORE_STATE);
      const imagesStore = tx.objectStore(STORE_IMAGES);

      stateStore.put({
        id: 'draft',
        markdown: markdown || '',
        currentFileName: currentFileName || 'Sans titre.md',
        isDirty: Boolean(isDirty),
        imageSeq: typeof imageSeq === 'number' && imageSeq > 0 ? imageSeq : 1,
        localImages: cleanImages,
        updatedAt: Date.now(),
      });

      imagesStore.clear();
      for (const [imgId, dataUrl] of Object.entries(cleanImages)) {
        imagesStore.put({ id: imgId, dataUrl });
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    handleStorageError('saveDraftState', err);
  }
}

/**
 * Efface le brouillon courant et toutes les images Base64 associées dans IndexedDB.
 * @returns {Promise<void>}
 */
export async function clearDraftState() {
  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_STATE, STORE_IMAGES], 'readwrite');
      tx.objectStore(STORE_STATE).delete('draft');
      tx.objectStore(STORE_IMAGES).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    handleStorageError('clearDraftState', err);
  }
}

/**
 * Charge les préférences, le brouillon Markdown, le dictionnaire d'images Base64
 * et les éventuels fichiers de configuration/modèle personnalisés depuis IndexedDB.
 * @returns {Promise<{
 *   prefs: object|null,
 *   draft: object|null,
 *   localImages: Record<string, string>,
 *   customConfig: object|null,
 *   customTemplate: object|null,
 *   customPptTemplate: object|null,
 *   customCss: object|null,
 *   customThemeConfigs: Record<string, object>|null
 * }>}
 */
export async function loadStoredState() {
  try {
    const db = await openDatabase();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_STATE, STORE_IMAGES], 'readonly');
      const stateStore = tx.objectStore(STORE_STATE);
      const imagesStore = tx.objectStore(STORE_IMAGES);

      const prefsReq = stateStore.get('prefs');
      const draftReq = stateStore.get('draft');
      const customConfigReq = stateStore.get('custom_config');
      const customTemplateReq = stateStore.get('custom_template');
      const customPptTemplateReq = stateStore.get('custom_ppt_template');
      const customCssReq = stateStore.get('custom_css');
      const customThemeConfigsReq = stateStore.get('custom_theme_configs');
      const imagesReq = imagesStore.getAll();

      tx.oncomplete = () => {
        const draft = draftReq.result || null;
        const localImages = {
          ...(draft?.localImages && typeof draft.localImages === 'object'
            ? draft.localImages
            : {}),
        };

        const imageRecords = Array.isArray(imagesReq.result) ? imagesReq.result : [];
        for (const rec of imageRecords) {
          if (rec?.id && typeof rec.dataUrl === 'string') {
            localImages[rec.id] = rec.dataUrl;
          }
        }

        resolve({
          prefs: prefsReq.result || null,
          draft,
          localImages,
          customConfig: customConfigReq.result || null,
          customTemplate: customTemplateReq.result || null,
          customPptTemplate: customPptTemplateReq.result || null,
          customCss: customCssReq.result || null,
          customThemeConfigs: customThemeConfigsReq.result?.configs || null,
        });
      };

      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    handleStorageError('loadStoredState', err);
    return {
      prefs: null,
      draft: null,
      localImages: {},
      customConfig: null,
      customTemplate: null,
      customPptTemplate: null,
      customCss: null,
      customThemeConfigs: null,
    };
  }
}
