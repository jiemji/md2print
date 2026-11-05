/**
 * @module modules/export/PptGeneratorService
 * @description Service de génération et d'exportation de présentations Microsoft PowerPoint (.pptx).
 * Crée des diapositives conformes aux masques OpenXML d'un modèle PowerPoint d'entreprise (.potx),
 * avec mise en page automatique et intégration haute définition des graphiques Chart.js.
 * @requires core/Utils
 * @requires core/UIFactory
 * @requires core/IOManager
 * @requires modules/export/PptxTemplateEngine
 */

import { Utils } from '../../core/Utils.js';
import { UI } from '../../core/UIFactory.js';
import { IOManager } from '../../core/IOManager.js';
import { loadPptxTemplateBuffer, generatePresentationFromTemplate } from './PptxTemplateEngine.js';

let pptConfig = null;

/**
 * Charge la configuration PowerPoint depuis config/output_config.json.
 * @async
 * @returns {Promise<Object>} Configuration des templates et masques PowerPoint
 */
async function loadPptConfig() {
    if (pptConfig) return pptConfig;
    try {
        const res = await fetch('config/output_config.json');
        if (res.ok) {
            pptConfig = await res.json();
        } else {
            console.warn("Impossible de charger config/output_config.json, utilisation défaut.");
            pptConfig = { templates: [] }; 
        }
    } catch (e) {
        console.error("Erreur chargement config/output_config.json", e);
        pptConfig = { templates: [] };
    }
    return pptConfig;
}

/**
 * Retourne la liste des modèles PowerPoint disponibles configurés dans config/output_config.json.
 *
 * @async
 * @returns {Promise<Array<{id: string, name: string, path: string}>>} Liste des gabarits disponibles
 */
export async function getPptTemplates() {
    await loadPptConfig();
    const pw = pptConfig?.powerpoint;
    if (pw?.templates && Array.isArray(pw.templates) && pw.templates.length > 0) {
        return pw.templates;
    }
    if (pw?.path) {
        return [{
            id: 'standard',
            name: pw.name || 'Modèle Standard Ezio',
            path: pw.path
        }];
    }
    return [{
        id: 'standard',
        name: 'Modèle Standard Ezio',
        path: 'templates/Modele_presentation.potx'
    }];
}

/**
 * Génère et télécharge le fichier PowerPoint pour un livrable donné.
 * Repose exclusivement sur la génération native OpenXML à partir d'un modèle PowerPoint d'entreprise (.potx),
 * soit importé à la volée (`options.pptCustomBuffer`), soit sélectionné dans le catalogue (`options.pptTemplateId`).
 *
 * @async
 * @param {Object} delivery - L'objet livrable (name, sections, blocks)
 * @param {string} [templateId='standard'] - L'ID du template choisi
 * @param {Function} [onLog=null] - Callback optionnel de journalisation
 * @param {Object} [options={}] - Options complémentaires d'exportation
 * @param {string} [options.pptTemplateId] - Identifiant du modèle sélectionné dans le catalogue
 * @param {ArrayBuffer|null} [options.pptCustomBuffer] - Tampon binaire du modèle .potx importé à la volée
 * @param {string|null} [options.pptCustomName] - Nom du fichier modèle .potx importé
 * @returns {Promise<void>}
 */
export async function downloadDeliveryPpt(delivery, templateId = 'standard', onLog = null, options = {}) {
    if (!delivery || !delivery.sections) {
        return;
    }

    if (!window.JSZip) {
        throw new Error("La bibliothèque JSZip est requise pour générer la présentation PowerPoint.");
    }

    await loadPptConfig();

    let templateBuffer = options.pptCustomBuffer || null;
    let templateLabel = options.pptCustomName || null;

    if (options.pptCustomName && !options.pptCustomName.toLowerCase().endsWith('.potx')) {
        throw new Error(`Format non supporté pour "${options.pptCustomName}". Seuls les fichiers modèles PowerPoint (.potx) sont acceptés.`);
    }

    if (!templateBuffer) {
        // Recherche dans le catalogue des modèles configurés
        const templatesList = await getPptTemplates();
        const targetId = options.pptTemplateId || templateId || 'standard';
        let matched = templatesList.find(t => t.id === targetId);
        if (!matched && templatesList.length > 0) matched = templatesList[0];

        const templatePath = matched?.path || 'templates/Modele_presentation.potx';
        if (!templatePath.toLowerCase().endsWith('.potx')) {
            throw new Error(`Le modèle configuré "${templatePath}" n'est pas un fichier .potx. Seuls les modèles .potx sont autorisés.`);
        }
        templateLabel = matched?.name ? `${matched.name} (${templatePath})` : templatePath;
        templateBuffer = await loadPptxTemplateBuffer(templatePath);
    } else {
        templateLabel = `Modèle personnalisé : ${options.pptCustomName || 'Fichier .potx importé'}`;
    }

    if (!templateBuffer) {
        throw new Error(`Impossible de charger le modèle PowerPoint "${templateLabel}". Vérifiez que le fichier .potx existe et est accessible.`);
    }

    if (typeof onLog === 'function') onLog(`Génération via le modèle PowerPoint natif (${templateLabel})...`, "info");
    const blob = await generatePresentationFromTemplate(delivery, templateBuffer, { pptConfig }, onLog);
    if (blob) {
        const filename = `${Utils.toSlug(delivery.name)}.pptx`;
        IOManager.downloadBlob(blob, filename);
    } else {
        throw new Error("La génération de la présentation PowerPoint a échoué (aucun fichier produit).");
    }
}
