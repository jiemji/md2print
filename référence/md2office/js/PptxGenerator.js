/**
 * @module PptxGenerator
 * @description Point d'entrée principal de la génération de présentations PowerPoint (.pptx) pour md2office.
 * Orchestre la résolution du modèle OpenXML (.potx) et délègue la transformation du Markdown vers
 * le moteur de gabarit natif {@link module:PptxTemplateEngine}.
 *
 * @requires ./PptxTemplateEngine.js
 */

import { generatePresentationFromTemplate, loadPptxTemplateBuffer } from './PptxTemplateEngine.js';

/**
 * Génère une présentation PowerPoint (.pptx) prête au téléchargement à partir
 * d'un texte Markdown et d'un modèle d'entreprise OpenXML (.potx).
 *
 * En l'absence de buffer binaire fourni explicitement pour le modèle, cette fonction
 * inspecte la configuration passée en paramètre (`output_config.json`) pour localiser
 * et charger le fichier `.potx` par défaut.
 *
 * @async
 * @function generatePptx
 * @param {string} mdText - Contenu Markdown source complet à convertir en diapositives
 * @param {string} docTitle - Titre principal du document ou de la présentation
 * @param {ArrayBuffer|null} [pptTemplateBuffer=null] - Données binaires du modèle .potx pré-chargé en mémoire (optionnel)
 * @param {Object} [config={}] - Configuration complète issue de `output_config.json`
 * @param {function(string): void|null} [onProgress=null] - Callback optionnel de notification d'avancement pour l'interface utilisateur
 * @returns {Promise<Blob>} Objet Blob contenant l'archive binaire .pptx OpenXML finale
 * @throws {Error} Si aucun modèle .potx valide ne peut être chargé depuis le chemin configuré ou le buffer
 */
export async function generatePptx(mdText, docTitle, pptTemplateBuffer = null, config = {}, onProgress = null) {
  let templateBuffer = pptTemplateBuffer;

  // Si aucun buffer n'est fourni, tenter de charger le modèle configuré dans output_config.json
  if (!templateBuffer) {
    onProgress?.("Chargement du modèle PowerPoint configuré...");
    const pw = config?.powerpoint || config?.pptConfig?.powerpoint;
    const defaultTemplate = pw?.templates?.find(t => t.id === pw.default) || pw?.templates?.[0];
    const pptPath = defaultTemplate?.path || 'templates/Modele_presentation.potx';
    templateBuffer = await loadPptxTemplateBuffer(pptPath);
  }

  // Vérification de sécurité : impossible de poursuivre sans gabarit OpenXML
  if (!templateBuffer) {
    throw new Error("Impossible de charger le modèle PowerPoint (.potx). Vérifiez la présence du fichier modèle configuré ou chargez un fichier .potx personnalisé.");
  }

  return await generatePresentationFromTemplate(mdText, docTitle, templateBuffer, config, onProgress);
}
