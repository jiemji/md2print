/**
 * @module app
 * @description Orchestrateur principal de l'application md2office.
 * Gère l'état global du document, le chargement initial des gabarits PowerPoint et Word
 * depuis `output_config.json`, la gestion des événements de glisser-déposer (dropzone),
 * la prévisualisation de la structure Markdown (AST), et le déclenchement des exports.
 *
 * @requires ./MarkdownParser.js
 * @requires ./PptxGenerator.js
 * @requires ./DocxGenerator.js
 * @requires ./utils.js
 */
import { parseToAST } from './MarkdownParser.js';
import { generatePptx } from './PptxGenerator.js';
import { generateDocx } from './DocxGenerator.js';
import { toSlug, downloadBlob, readFileAsText, readFileAsArrayBuffer } from './utils.js';

/**
 * Structure de l'état global réactif de l'application.
 * @typedef {Object} AppState
 * @property {string|null} mdText - Contenu Markdown brut chargé en mémoire
 * @property {string|null} mdFileName - Nom du fichier Markdown d'origine
 * @property {Object|null} outputConfig - Configuration de rendu chargée depuis output_config.json
 * @property {ArrayBuffer|null} pptTemplateBuffer - Données binaires du gabarit PowerPoint (.potx) actif
 * @property {string|null} pptTemplateFileName - Nom du fichier modèle PowerPoint actif
 * @property {ArrayBuffer|null} templateBuffer - Données binaires du gabarit Word (.docx) actif
 * @property {string|null} templateFileName - Nom du fichier modèle Word actif
 */

// --- État global réactif ---
/** @type {AppState} */
const state = {
  mdText: null,
  mdFileName: null,
  outputConfig: null,
  pptTemplateBuffer: null,
  pptTemplateFileName: null,
  templateBuffer: null,
  templateFileName: null,
};

// --- Raccourcis sélecteurs DOM ---
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// --- Initialisation au chargement du DOM ---
document.addEventListener('DOMContentLoaded', async () => {
  // Charger la config par défaut
  try {
    const res = await fetch('config/output_config.json');
    if (res.ok) state.outputConfig = await res.json();
  } catch (e) {
    console.warn('Config par défaut non trouvée, utilisation des valeurs internes.');
  }

  // Charger le template PowerPoint par défaut (.potx) selon output_config.json
  try {
    const pw = state.outputConfig?.powerpoint;
    const defaultTemplate = pw?.templates?.find(t => t.id === pw.default) || pw?.templates?.[0];
    const pptPath = defaultTemplate?.path || 'templates/Modele_presentation.potx';
    const res = await fetch(pptPath);
    if (res.ok) {
      state.pptTemplateBuffer = await res.arrayBuffer();
      state.pptTemplateFileName = pptPath.split('/').pop();
      updatePptTemplateStatus();
    }
  } catch (e) {
    console.warn('Template PowerPoint par défaut non trouvé.');
  }

  // Charger le template Word par défaut (.docx)
  try {
    const docPath = state.outputConfig?.documents?.[0]?.path;
    if (docPath) {
      const res = await fetch(docPath);
      if (res.ok) {
        state.templateBuffer = await res.arrayBuffer();
        state.templateFileName = docPath.split('/').pop();
        updateTemplateStatus();
      }
    }
  } catch (e) {
    console.warn('Template Word par défaut non trouvé.');
  }

  setupDropzone();
  setupConfigUploads();
  setupExportButtons();
  updateUI();
});

// --- Dropzone Markdown ---

/**
 * Initialise les gestionnaires d'événements pour la zone de dépôt (dropzone) du fichier Markdown.
 * Prend en charge le clic pour ouverture de l'explorateur de fichiers ainsi que le glisser-déposer.
 *
 * @function setupDropzone
 * @returns {void}
 */
function setupDropzone() {
  const dropzone = $('#md-dropzone');
  const input = $('#md-input');

  dropzone.addEventListener('click', () => input.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dropzone--active');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dropzone--active');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dropzone--active');
    const file = e.dataTransfer.files[0];
    if (file) handleMdFile(file);
  });

  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleMdFile(file);
  });
}

/**
 * Traite le fichier Markdown fourni par l'utilisateur (glissé ou sélectionné).
 * Vérifie l'extension, lit le contenu texte asynchrone, met à jour l'état global
 * et déclenche l'affichage des métadonnées du fichier et de son aperçu structurel.
 *
 * @async
 * @function handleMdFile
 * @param {File} file - Fichier Markdown sélectionné par l'utilisateur
 * @returns {Promise<void>}
 */
async function handleMdFile(file) {
  if (!file.name.endsWith('.md') && !file.name.endsWith('.markdown') && !file.name.endsWith('.txt')) {
    showToast('Veuillez sélectionner un fichier Markdown (.md)', 'error');
    return;
  }

  try {
    state.mdText = await readFileAsText(file);
    state.mdFileName = file.name;
    showFileInfo(file);
    showStructure();
    updateUI();
    showToast(`${file.name} chargé avec succès`, 'success');
  } catch (err) {
    showToast('Erreur de lecture du fichier: ' + err.message, 'error');
  }
}

/**
 * Affiche la carte d'information du fichier Markdown chargé dans le DOM
 * (nom du fichier, taille en Ko, nombre de lignes) et attache le bouton de suppression.
 *
 * @function showFileInfo
 * @param {File} file - Fichier source chargé
 * @returns {void}
 */
function showFileInfo(file) {
  const container = $('#file-info-container');
  const sizeKB = (file.size / 1024).toFixed(1);
  const lines = state.mdText.split('\n').length;

  container.innerHTML = `
    <div class="file-info">
      <span class="file-info__icon">📄</span>
      <div class="file-info__details">
        <div class="file-info__name">${file.name}</div>
        <div class="file-info__meta">${sizeKB} Ko · ${lines} lignes</div>
      </div>
      <button class="file-info__remove" id="btn-remove-md" title="Retirer">✕</button>
    </div>
  `;

  $('#btn-remove-md').addEventListener('click', () => {
    state.mdText = null;
    state.mdFileName = null;
    container.innerHTML = '';
    const structEl = $('#md-structure');
    structEl.innerHTML = '';
    structEl.classList.add('hidden');
    $('#md-input').value = '';
    updateUI();
  });
}

/**
 * Analyse l'AST du texte Markdown chargé et génère une représentation visuelle
 * hiérarchique des diapositives et sections dans le volet d'aperçu latéral.
 *
 * @function showStructure
 * @returns {void}
 */
function showStructure() {
  const container = $('#md-structure');
  const ast = parseToAST(state.mdText);
  let html = '';

  for (const block of ast) {
    if (block.type === 'header') {
      const cls = `md-structure__item--h${block.level}`;
      let badge = '';
      if (block.level === 1) badge = '<span class="md-structure__badge md-structure__badge--cover">Couverture</span>';
      else if (block.level === 2) badge = '<span class="md-structure__badge md-structure__badge--chapter">Chapitre</span>';
      else if (block.level === 3) badge = '<span class="md-structure__badge md-structure__badge--slide">Slide</span>';

      html += `<div class="md-structure__item ${cls}">${'#'.repeat(block.level)} ${escapeHtml(block.text)} ${badge}</div>`;
    } else if (block.type === 'table') {
      html += `<div class="md-structure__item md-structure__item--content">📊 Tableau (${block.rows.length} lignes × ${block.rows[0]?.length || 0} colonnes)</div>`;
    } else if (block.type === 'list_item') {
      const icon = block.listType === 'ordered' ? '🔢' : '•';
      html += `<div class="md-structure__item md-structure__item--content">${'  '.repeat(block.level)}${icon} ${escapeHtml(truncate(block.text, 60))}</div>`;
    }
  }

  container.innerHTML = html || '<div class="md-structure__item md-structure__item--content">Aucune structure détectée</div>';
  container.classList.remove('hidden');
}

// --- Config uploads ---

/**
 * Configure les écouteurs d'événements pour le chargement des fichiers de configuration :
 *  - Fichier JSON de configuration (`output_config.json`)
 *  - Fichier modèle PowerPoint (.potx)
 *  - Fichier modèle Word (.docx)
 *
 * Lorsque la configuration JSON est modifiée, recherche et charge automatiquement
 * le modèle PowerPoint correspondant s'il est spécifié.
 *
 * @function setupConfigUploads
 * @returns {void}
 */
function setupConfigUploads() {
  const configZone = $('#config-json-zone');
  const configInput = $('#config-json-input');
  const templatePotxZone = $('#template-potx-zone');
  const templatePotxInput = $('#template-potx-input');
  const templateDocxZone = $('#template-docx-zone');
  const templateDocxInput = $('#template-docx-input');

  // JSON Config
  configZone.addEventListener('click', () => configInput.click());
  configInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      state.outputConfig = JSON.parse(text);
      configZone.textContent = `✓ ${file.name}`;
      configZone.classList.add('config-item__dropzone--loaded');
      showToast('Configuration chargée', 'success');

      // Tenter de recharger le template PowerPoint si configuré
      const pw = state.outputConfig?.powerpoint;
      const defaultTemplate = pw?.templates?.find(t => t.id === pw.default) || pw?.templates?.[0];
      const pptPath = defaultTemplate?.path;
      if (pptPath) {
        try {
          const res = await fetch(pptPath);
          if (res.ok) {
            state.pptTemplateBuffer = await res.arrayBuffer();
            state.pptTemplateFileName = pptPath.split('/').pop();
            updatePptTemplateStatus();
          }
        } catch (_) {}
      }
    } catch (err) {
      showToast('Erreur JSON: ' + err.message, 'error');
    }
  });

  // Template PowerPoint (.potx)
  templatePotxZone.addEventListener('click', () => templatePotxInput.click());
  templatePotxInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.potx')) {
      showToast('Veuillez sélectionner un fichier modèle PowerPoint (.potx)', 'error');
      return;
    }
    try {
      state.pptTemplateBuffer = await readFileAsArrayBuffer(file);
      state.pptTemplateFileName = file.name;
      updatePptTemplateStatus();
      showToast('Template PowerPoint chargé', 'success');
    } catch (err) {
      showToast('Erreur lecture template PPTX: ' + err.message, 'error');
    }
  });

  // Template Word (.docx)
  templateDocxZone.addEventListener('click', () => templateDocxInput.click());
  templateDocxInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      state.templateBuffer = await readFileAsArrayBuffer(file);
      state.templateFileName = file.name;
      updateTemplateStatus();
      showToast('Template Word chargé', 'success');
    } catch (err) {
      showToast('Erreur lecture template: ' + err.message, 'error');
    }
  });
}

/**
 * Met à jour l'indicateur visuel de la zone de dépôt du modèle PowerPoint
 * pour refléter le nom du fichier .potx actuellement en mémoire.
 *
 * @function updatePptTemplateStatus
 * @returns {void}
 */
function updatePptTemplateStatus() {
  const zone = $('#template-potx-zone');
  if (zone && state.pptTemplateFileName) {
    zone.textContent = `✓ ${state.pptTemplateFileName}`;
    zone.classList.add('config-item__dropzone--loaded');
  }
}

/**
 * Met à jour l'indicateur visuel de la zone de dépôt du modèle Word
 * pour refléter le nom du fichier .docx actuellement en mémoire.
 *
 * @function updateTemplateStatus
 * @returns {void}
 */
function updateTemplateStatus() {
  const zone = $('#template-docx-zone');
  if (zone && state.templateFileName) {
    zone.textContent = `✓ ${state.templateFileName}`;
    zone.classList.add('config-item__dropzone--loaded');
  }
}

// --- Export ---

/**
 * Enregistre les gestionnaires d'événements de clic sur les boutons d'export PPTX et DOCX.
 *
 * @function setupExportButtons
 * @returns {void}
 */
function setupExportButtons() {
  $('#btn-export-pptx').addEventListener('click', handleExportPptx);
  $('#btn-export-docx').addEventListener('click', handleExportDocx);
}

/**
 * Déclenche la génération et le téléchargement du fichier PowerPoint (.pptx).
 * Verrouille le bouton d'action, instancie un toast avec suivi de progression,
 * appelle {@link module:PptxGenerator.generatePptx} et initie le téléchargement du Blob résultant.
 *
 * @async
 * @function handleExportPptx
 * @returns {Promise<void>}
 */
async function handleExportPptx() {
  if (!state.mdText) return;

  const btn = $('#btn-export-pptx');
  btn.disabled = true;

  const toastEl = showToast('Génération PowerPoint en cours...', 'info', true);

  try {
    const config = state.outputConfig || {};
    const title = extractTitle(state.mdText) || state.mdFileName?.replace(/\.\w+$/, '') || 'Document';

    const blob = await generatePptx(state.mdText, title, state.pptTemplateBuffer, config, (msg) => {
      if (toastEl) toastEl.querySelector('.toast__text').textContent = msg;
    });

    downloadBlob(blob, `${toSlug(title)}.pptx`);
    removeToast(toastEl);
    showToast('PowerPoint généré avec succès !', 'success');
  } catch (err) {
    removeToast(toastEl);
    showToast('Erreur PPTX: ' + err.message, 'error');
    console.error(err);
  } finally {
    btn.disabled = false;
  }
}

/**
 * Déclenche la génération et le téléchargement du document Word (.docx).
 * Verrouille le bouton d'action, affiche un toast de progression,
 * appelle {@link module:DocxGenerator.generateDocx} et déclenche le téléchargement du Blob produit.
 *
 * @async
 * @function handleExportDocx
 * @returns {Promise<void>}
 */
async function handleExportDocx() {
  if (!state.mdText) return;

  const btn = $('#btn-export-docx');
  btn.disabled = true;

  const toastEl = showToast('Génération Word en cours...', 'info', true);

  try {
    const docConfig = state.outputConfig?.documents?.[0] || {};
    const title = extractTitle(state.mdText) || state.mdFileName?.replace(/\.\w+$/, '') || 'Document';

    const blob = await generateDocx(state.mdText, title, docConfig, state.templateBuffer, (msg) => {
      if (toastEl) toastEl.querySelector('.toast__text').textContent = msg;
    });

    downloadBlob(blob, `${toSlug(title)}.docx`);
    removeToast(toastEl);
    showToast('Document Word généré avec succès !', 'success');
  } catch (err) {
    removeToast(toastEl);
    showToast('Erreur DOCX: ' + err.message, 'error');
    console.error(err);
  } finally {
    btn.disabled = false;
  }
}

// --- UI Helpers ---

/**
 * Rafraîchit la visibilité des sections et l'état actif/inactif des boutons d'export
 * en fonction de la présence ou de l'absence de texte Markdown dans l'état global.
 *
 * @function updateUI
 * @returns {void}
 */
function updateUI() {
  const hasMd = !!state.mdText;
  $('#btn-export-pptx').disabled = !hasMd;
  $('#btn-export-docx').disabled = !hasMd;
  $('#section-config').classList.toggle('hidden', !hasMd);
  $('#section-export').classList.toggle('hidden', !hasMd);
}

/**
 * Extrait le titre de premier niveau (`# ...`) à partir d'un texte Markdown brut.
 *
 * @function extractTitle
 * @param {string} mdText - Texte source Markdown
 * @returns {string|null} Le titre extrait, ou `null` si aucun titre de niveau 1 n'est présent
 */
function extractTitle(mdText) {
  const match = mdText.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

/**
 * Échappe les entités HTML pour prévenir les failles XSS lors de l'insertion dans le DOM.
 *
 * @function escapeHtml
 * @param {string} text - Chaîne brute à assainir
 * @returns {string} Chaîne sécurisée avec entités HTML échappées
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Tronque une chaîne de caractères à une longueur maximale donnée en ajoutant des points de suspension.
 *
 * @function truncate
 * @param {string} text - Chaîne de caractères source
 * @param {number} maxLen - Longueur maximale autorisée
 * @returns {string} Chaîne tronquée avec une ellipse si elle dépasse la limite
 */
function truncate(text, maxLen) {
  return text.length > maxLen ? text.substring(0, maxLen) + '…' : text;
}

// --- Toast system ---
let toastTimeout = null;

/**
 * Affiche une notification toast flottante temporaire ou persistante à l'écran.
 *
 * @function showToast
 * @param {string} message - Message textuel à afficher
 * @param {'info'|'success'|'error'} [type='info'] - Type de notification déterminant la couleur et l'icône
 * @param {boolean} [persistent=false] - Si vrai, le toast reste affiché jusqu'à un retrait explicite avec spinner
 * @returns {HTMLDivElement} L'élément DOM représentant le toast créé
 */
function showToast(message, type = 'info', persistent = false) {
  // Supprimer le toast précédent non-persistent
  const existing = document.querySelector('.toast:not(.toast--persistent)');
  if (existing) existing.remove();
  if (toastTimeout) clearTimeout(toastTimeout);

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  if (persistent) toast.classList.add('toast--persistent');

  const spinner = type === 'info' && persistent ? '<div class="toast__spinner"></div>' : '';
  const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : '';
  toast.innerHTML = `${spinner}<span class="toast__icon">${icon}</span><span class="toast__text">${escapeHtml(message)}</span>`;

  document.body.appendChild(toast);

  if (!persistent) {
    toastTimeout = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = 'all 300ms ease-in';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  return toast;
}

/**
 * Anime la disparition d'un élément toast et le supprime du document DOM.
 *
 * @function removeToast
 * @param {HTMLDivElement|null} toastEl - Élément DOM du toast à retirer
 * @returns {void}
 */
function removeToast(toastEl) {
  if (toastEl) {
    toastEl.style.opacity = '0';
    toastEl.style.transform = 'translateX(20px)';
    toastEl.style.transition = 'all 200ms ease-in';
    setTimeout(() => toastEl.remove(), 200);
  }
}
