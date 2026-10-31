/**
 * StorageService.js — Service de persistance locale basé sur IndexedDB
 * Gère le stockage asynchrone haute capacité du brouillon Markdown,
 * du dictionnaire d'images Base64 (sans la limite de 5 Mo du localStorage)
 * et des préférences d'interface (thème Sombre/Sépia, mode Rapport/Slide).
 */

const DB_NAME = 'md2print_db';
const DB_VERSION = 1;
const STORE_STATE = 'app_state';
const STORE_IMAGES = 'local_images';

let dbInstancePromise = null;

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
 * Sauvegarde les préférences d'affichage (thème et mode Rapport/Slide) dans IndexedDB.
 * @param {{ theme: string, currentViewport: string }} prefs
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
        updatedAt: Date.now(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    // Ignore silencieusement si IndexedDB est bloqué
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
  } catch {
    // Ignore silencieusement en cas d'erreur d'écriture IndexedDB
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
  } catch {
    // Ignore silencieusement
  }
}

/**
 * Charge les préférences, le brouillon Markdown et le dictionnaire d'images Base64 depuis IndexedDB.
 * @returns {Promise<{ prefs: object|null, draft: object|null, localImages: Record<string, string> }>}
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
        });
      };

      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    return { prefs: null, draft: null, localImages: {} };
  }
}
