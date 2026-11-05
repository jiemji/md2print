/**
 * @module modules/export/PptxTemplateEngine
 * @description Moteur de génération PowerPoint natif fondé sur des modèles réels Microsoft PowerPoint (.potx exclusivement).
 * Réalise l'instanciation directe de diapositives OpenXML à partir des masques de disposition (slideLayouts),
 * le renseignement des zones réservées (placeholders titre, corps, sous-titres), l'insertion haute définition
 * des graphiques KPI Chart.js et la ré-indexation stricte des relations OpenXML pour garantir des livrables 100% fidèles au masque d'entreprise.
 *
 * @requires core/Utils
 * @requires core/UIFactory
 * @requires modules/WidgetRenderer
 * @requires core/State
 * @requires JSZip (via window.JSZip)
 */

/**
 * @typedef {Object} SlideBounds
 * @property {string} x - Coordonnée X en EMUs (English Metric Units)
 * @property {string} y - Coordonnée Y en EMUs
 * @property {string} cx - Largeur en EMUs
 * @property {string} cy - Hauteur en EMUs
 */

/**
 * @typedef {Object} SlidePrototype
 * @property {number} num - Numéro séquentiel du slideLayout (ex: 1 pour slideLayout1.xml)
 * @property {string} path - Chemin dans le package OpenXML (ex: 'ppt/slideLayouts/slideLayout1.xml')
 * @property {string} name - Nom d'affichage de la disposition
 * @property {boolean} hasTitle - Indique si un placeholder titre (title ou ctrTitle) est présent
 * @property {boolean} hasBody - Indique si un placeholder de corps de texte (body) est présent
 * @property {string} bodyIdx - Identifiant d'index du corps de texte (ex: "10")
 * @property {SlideBounds} bodyBounds - Boîte englobante de la zone de contenu
 */

/**
 * @typedef {Object} SlidePrototypesMap
 * @property {SlidePrototype} cover - Disposition sélectionnée pour la couverture
 * @property {SlidePrototype} chapter - Disposition sélectionnée pour les intercalaires de section
 * @property {SlidePrototype} content - Disposition sélectionnée pour les fiches de texte et tableaux
 * @property {SlidePrototype} kpi - Disposition sélectionnée pour les graphiques KPI
 */

/**
 * @typedef {Object} DeliveryBlock
 * @property {string} type - Type de bloc ('text', 'table', 'kpi', etc.)
 * @property {string} [title] - Titre du bloc
 * @property {string} [content] - Contenu textuel ou Markdown du bloc
 * @property {string[]} [widgetIds] - Identifiants des widgets KPI associés
 * @property {string} [widgetId] - Identifiant unique d'un widget KPI
 * @property {string} [comment] - Commentaire ou analyse accompagnant le KPI
 * @property {Object} [config] - Configuration additionnelle du bloc
 */

/**
 * @typedef {Object} DeliverySection
 * @property {string} name - Nom ou titre du module/chapitre
 * @property {DeliveryBlock[]} blocks - Liste ordonnée des blocs de la section
 */

/**
 * @typedef {Object} DeliveryData
 * @property {string} name - Titre global du livrable
 * @property {DeliverySection[]} sections - Liste ordonnée des sections composant le livrable
 */

/**
 * @typedef {Object} TargetSlideItem
 * @property {SlidePrototype} proto - Prototype de disposition OpenXML cible
 * @property {'cover'|'chapter'|'content'|'kpi'} type - Rôle fonctionnel de la diapositive
 * @property {Object<string, string>} placeholders - Dictionnaire clé/valeur des zones réservées
 * @property {string|null} [kpiImage] - Données Base64 de l'image du graphique KPI
 */

import { Utils } from '../../core/Utils.js';
import { UI } from '../../core/UIFactory.js';
import { currentForm, store } from '../../core/State.js';
import { exportWidgetImage } from '../WidgetRenderer.js';

const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

/**
 * Échappe les caractères spéciaux pour l'insertion sécurisée dans un flux XML.
 * Élimine également les caractères de contrôle non autorisés par la norme XML 1.0.
 *
 * @param {*} unsafe - Valeur à échapper
 * @returns {string} Chaîne échappée compatible XML
 */
function escapeXml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Charge le buffer binaire d'un modèle PowerPoint d'entreprise (.potx).
 * Seuls les fichiers modèles avec l'extension .potx sont autorisés.
 *
 * @async
 * @param {string} [templatePath='templates/Modele_presentation.potx'] - Chemin relatif du fichier modèle .potx
 * @returns {Promise<ArrayBuffer|null>} Buffer binaire du modèle ou null en cas d'indisponibilité
 */
export async function loadPptxTemplateBuffer(templatePath = 'templates/Modele_presentation.potx') {
    if (!templatePath || !templatePath.toLowerCase().endsWith('.potx')) {
        console.warn(`[PptxTemplateEngine] Seuls les fichiers modèles PowerPoint (.potx) sont autorisés : ${templatePath}`);
        return null;
    }
    try {
        const response = await fetch(templatePath);
        if (!response.ok) {
            console.warn(`[PptxTemplateEngine] Modèle .potx introuvable : ${templatePath} (${response.status})`);
            return null;
        }
        return await response.arrayBuffer();
    } catch (err) {
        console.warn(`[PptxTemplateEngine] Erreur réseau lors du chargement du modèle .potx (${templatePath}) :`, err);
        return null;
    }
}

/**
 * Détecte et extrait les masques de disposition (slideLayouts) contenus dans le modèle OpenXML (.potx).
 * Identifie les rôles selon les noms et types de zones réservées (Couverture, Intercalaire, Contenu, KPI).
 *
 * @async
 * @param {Object} zip - Instance JSZip chargée
 * @param {DOMParser} parser - Instance native DOMParser
 * @returns {Promise<Object>} Dictionnaire des prototypes identifiés (cover, chapter, content, kpi)
 */
async function detectSlidePrototypes(zip, parser) {
    const layoutFiles = Object.keys(zip.files).filter(k => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(k));
    if (layoutFiles.length === 0) {
        throw new Error("Format invalide : ce fichier ne comporte aucun masque de disposition. Seuls les modèles PowerPoint (.potx) sont pris en charge.");
    }

    const layouts = [];

    for (let path of layoutFiles) {
        const num = parseInt(path.match(/\d+/)[0], 10);
        const xml = await zip.file(path).async('string');
        const nameMatch = xml.match(/<p:cSld[^>]*name="([^"]+)"/);
        const name = nameMatch ? nameMatch[1] : `Disposition ${num}`;

        const hasTitle = xml.includes('type="title"') || xml.includes('type="ctrTitle"');
        const bodyMatch = xml.match(/<p:ph[^>]*type="body"[^>]*idx="([^"]+)"/) || xml.match(/<p:ph[^>]*idx="([^"]+)"[^>]*type="body"/);
        const bodyIdx = bodyMatch ? bodyMatch[1] : (xml.includes('type="body"') ? "1" : null);

        let bodyBounds = null;
        if (bodyIdx !== null || xml.includes('type="body"')) {
            const spMatches = xml.matchAll(/<p:sp>[\s\S]*?<\/p:sp>/g);
            for (const sp of spMatches) {
                if (sp[0].includes('type="body"')) {
                    const offM = sp[0].match(/<a:off\s+x="([^"]+)"\s+y="([^"]+)"/);
                    const extM = sp[0].match(/<a:ext\s+cx="([^"]+)"\s+cy="([^"]+)"/);
                    if (offM && extM) {
                        bodyBounds = { x: offM[1], y: offM[2], cx: extM[1], cy: extM[2] };
                    }
                    break;
                }
            }
        }

        layouts.push({
            num,
            path,
            name,
            hasTitle,
            hasBody: bodyIdx !== null || xml.includes('type="body"'),
            bodyIdx: bodyIdx || "10",
            bodyBounds: bodyBounds || { x: "735013", y: "1144588", cx: "10937875", cy: "5137150" }
        });
    }

    // Heuristiques de sélection des masques
    const cover = layouts.find(l => /une de page|titre|title|cover|garde/i.test(l.name)) 
               || layouts.find(l => l.hasTitle && !l.hasBody) 
               || layouts[0];

    const chapter = layouts.find(l => /transition|chapitre|chapter|intercalaire|section/i.test(l.name))
                 || layouts.find(l => l.hasTitle && !l.hasBody && l.num !== cover.num)
                 || layouts[1] 
                 || cover;

    const content = layouts.find(l => /standard|contenu|content|texte/i.test(l.name) && l.hasBody)
                 || layouts.find(l => l.hasBody)
                 || layouts[2] 
                 || cover;

    const kpi = layouts.find(l => /kpi|graph|chart|visuel/i.test(l.name)) || content;

    return { cover, chapter, content, kpi };
}

/**
 * Nettoie le Markdown pour l'affichage en diapositives de présentation.
 * Supprime les astérisques de gras/italique et simplifie les listes à puces.
 *
 * @param {string} md - Texte Markdown source
 * @returns {string} Texte épuré
 */
function sanitizeMarkdownForSlide(md) {
    if (!md) return '';
    return md
        .replace(/^#{1,6}\s+(.*)$/gm, '$1') // Titres en texte simple
        .replace(/\*\*(.*?)\*\*/g, '$1')     // Gras
        .replace(/\*(.*?)\*/g, '$1')         // Italique
        .replace(/`{1,3}(.*?)`{1,3}/g, '$1') // Code
        .replace(/\[(.*?)\]\(.*?\)/g, '$1')  // Liens
        .replace(/^[-*+]\s+/gm, '• ')        // Puces standardisées
        .trim();
}

/**
 * Génère la présentation PowerPoint complète (.pptx) exclusivement à partir du modèle de masques .potx.
 * Instancie chaque diapositive en héritant directement des slideLayouts du modèle OpenXML.
 *
 * @async
 * @param {DeliveryData} delivery - Données structurées du livrable (name, sections, blocks)
 * @param {ArrayBuffer} templateBuffer - Données binaires du fichier modèle .potx
 * @param {Object} [options={}] - Options complémentaires (configuration d'export, etc.)
 * @param {Function} [onLog=null] - Callback de journalisation pour l'affichage temps réel
 * @throws {Error} Si JSZip est absent ou si le fichier modèle ne contient aucun slideLayout valide
 * @returns {Promise<Blob>} Blob du fichier PowerPoint final (.pptx) prêt au téléchargement
 */
export async function generatePresentationFromTemplate(delivery, templateBuffer, options = {}, onLog = null) {
    const log = (msg, type = 'info') => {
        if (typeof onLog === 'function') onLog(msg, type);
    };

    if (!window.JSZip) {
        throw new Error("La bibliothèque JSZip est requise pour le moteur PowerPoint natif.");
    }

    log("Initialisation du moteur PowerPoint OpenXML...", "info");
    const zip = await window.JSZip.loadAsync(templateBuffer);
    const parser = new DOMParser();
    const serializer = new XMLSerializer();

    // 1. Détection des gabarits disponibles dans le modèle
    log("Analyse des masques et gabarits du modèle...", "info");
    const prototypes = await detectSlidePrototypes(zip, parser);

    const clientName = store.get()?.context?.companyName?.trim() || 'Client';
    const auditDate = new Date().toLocaleDateString('fr-FR');
    const globalPlaceholders = {
        TITRE: delivery.name || 'Rapport d\'Audit',
        TITLE: delivery.name || 'Rapport d\'Audit',
        SOUS_TITRE: 'Synthèse d\'évaluation & Plan d\'action',
        CLIENT: clientName,
        DATE: auditDate,
        AUDITEUR: 'Ezio Platform'
    };

    const targetSlides = [];

    // 2. Diapositive de couverture
    if (prototypes.cover) {
        targetSlides.push({
            proto: prototypes.cover,
            type: 'cover',
            placeholders: { ...globalPlaceholders }
        });
    }

    // 3. Parcours des sections et construction des diapositives
    const sections = delivery.sections || [];
    for (let sIdx = 0; sIdx < sections.length; sIdx++) {
        await yieldToMain();
        const section = sections[sIdx];
        const secName = section.name || `Section ${sIdx + 1}`;

        log(`Traitement de la section : ${secName}...`, "info");

        // Diapositive intercalaire de section
        if (prototypes.chapter) {
            targetSlides.push({
                proto: prototypes.chapter,
                type: 'chapter',
                placeholders: {
                    ...globalPlaceholders,
                    CHAPITRE: secName,
                    CHAPTER: secName,
                    SECTION: secName,
                    NUMERO: String(sIdx + 1)
                }
            });
        }

        const blocks = section.blocks || [];
        for (let bIdx = 0; bIdx < blocks.length; bIdx++) {
            await yieldToMain();
            const block = blocks[bIdx];
            const blockTitle = block.title || block.type || `Bloc ${bIdx + 1}`;

            if (block.type === 'kpi') {
                // Diapositive pour graphique KPI
                const widgetIds = block.widgetIds || (block.widgetId ? [block.widgetId] : []);
                for (const wId of widgetIds) {
                    await yieldToMain();
                    const appState = store.get() || currentForm;
                    const allWidgets = [...(appState?.statics || []), ...(appState?.recoStatics || [])];
                    const widgetDef = allWidgets.find(w => w.id === wId || w.title === wId || w.name === wId);
                    
                    let b64 = null;
                    if (widgetDef) {
                        try {
                            b64 = await exportWidgetImage(widgetDef, currentForm, { hd: true });
                        } catch (e) {
                            console.warn(`[PptxTemplateEngine] Échec capture widget KPI ${wId}:`, e);
                        }
                    }

                    targetSlides.push({
                        proto: prototypes.kpi || prototypes.content,
                        type: 'kpi',
                        kpiImage: b64,
                        placeholders: {
                            ...globalPlaceholders,
                            SECTION: secName,
                            TITRE_BLOC: widgetDef?.title || blockTitle,
                            COMMENTAIRE: block.content ? sanitizeMarkdownForSlide(block.content) : (widgetDef?.comment || '')
                        }
                    });
                }
            } else {
                // Diapositive de contenu textuel / synthèse / tableau
                const cleanContent = sanitizeMarkdownForSlide(block.content || block.config?.result || '');

                targetSlides.push({
                    proto: prototypes.content,
                    type: 'content',
                    placeholders: {
                        ...globalPlaceholders,
                        SECTION: secName,
                        TITRE_BLOC: blockTitle,
                        CONTENU: cleanContent,
                        TEXTE: cleanContent
                    }
                });
            }
        }
    }

    log(`Assemblage de ${targetSlides.length} diapositives OpenXML à partir des masques...`, "info");

    // 4. Suppression des anciennes diapositives résiduelles s'il y en avait
    Object.keys(zip.files).filter(k => /^ppt\/slides\//.test(k)).forEach(k => zip.remove(k));

    // 5. Génération de chaque diapositive héritant directement de son masque
    for (let i = 0; i < targetSlides.length; i++) {
        await yieldToMain();
        const slideIndex = i + 1;
        const slideItem = targetSlides[i];
        const layout = slideItem.proto;
        const relIdKpi = `rIdKpi_${slideIndex}`;
        let hasKpiImage = false;

        if (slideItem.type === 'kpi' && slideItem.kpiImage) {
            const commaIdx = slideItem.kpiImage.indexOf('base64,');
            const rawBase64 = commaIdx !== -1 ? slideItem.kpiImage.slice(commaIdx + 7) : slideItem.kpiImage;
            const mediaFileName = `image_kpi_${slideIndex}.png`;
            zip.file(`ppt/media/${mediaFileName}`, rawBase64, { base64: true });
            hasKpiImage = true;
        }

        // Fichier de relations pointant vers le masque de disposition associé
        const relsXmlStr = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout${layout.num}.xml"/>
  ${hasKpiImage ? `<Relationship Id="${relIdKpi}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image_kpi_${slideIndex}.png"/>` : ''}
</Relationships>`;

        let spTreeShapes = '';
        let shapeId = 2;

        if (slideItem.type === 'cover') {
            const coverTitle = slideItem.placeholders.TITRE || 'Rapport d\'Audit';
            spTreeShapes += `
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${shapeId++}" name="Titre"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph type="title"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="fr-FR"/>
              <a:t>${escapeXml(coverTitle)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>`;

            const subtitle = slideItem.placeholders.SOUS_TITRE || '';
            const client = slideItem.placeholders.CLIENT || '';
            const date = slideItem.placeholders.DATE || '';
            spTreeShapes += `
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${shapeId++}" name="Sous-titre et Métadonnées"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="1242789" y="3600000"/><a:ext cx="5000000" cy="800000"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:noFill/>
        </p:spPr>
        <p:txBody>
          <a:bodyPr anchor="t"/>
          <a:lstStyle/>
          ${subtitle ? `<a:p><a:r><a:rPr lang="fr-FR" sz="1300" b="1"/><a:t>${escapeXml(subtitle)}</a:t></a:r></a:p>` : ''}
          ${client || date ? `<a:p><a:r><a:rPr lang="fr-FR" sz="1100"/><a:t>${escapeXml(`${client ? `Client : ${client}` : ''}${client && date ? '   |   ' : ''}${date ? `Date : ${date}` : ''}`)}</a:t></a:r></a:p>` : ''}
        </p:txBody>
      </p:sp>`;

        } else if (slideItem.type === 'chapter') {
            const chapTitle = slideItem.placeholders.CHAPITRE || slideItem.placeholders.SECTION || 'Section';
            spTreeShapes += `
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${shapeId++}" name="Titre"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph type="title"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="fr-FR"/>
              <a:t>${escapeXml(chapTitle)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>`;

        } else if (slideItem.type === 'kpi') {
            const kpiTitle = slideItem.placeholders.TITRE_BLOC || 'Graphique KPI';
            spTreeShapes += `
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${shapeId++}" name="Titre"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph type="title"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="fr-FR"/>
              <a:t>${escapeXml(kpiTitle)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>`;

            if (hasKpiImage) {
                const bb = layout.bodyBounds || { x: "735013", y: "1144588", cx: "10937875", cy: "5137150" };
                spTreeShapes += `
      <p:pic>
        <p:nvPicPr>
          <p:cNvPr id="${shapeId++}" name="Graphique KPI ${slideIndex}"/>
          <p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>
          <p:nvPr/>
        </p:nvPicPr>
        <p:blipFill>
          <a:blip r:embed="${relIdKpi}"/>
          <a:stretch><a:fillRect/></a:stretch>
        </p:blipFill>
        <p:spPr>
          <a:xfrm>
            <a:off x="${bb.x}" y="${bb.y}"/>
            <a:ext cx="${bb.cx}" cy="${bb.cy}"/>
          </a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
      </p:pic>`;
            }

        } else {
            // Contenu textuel standard
            const title = slideItem.placeholders.TITRE_BLOC || slideItem.placeholders.SECTION || 'Contenu';
            spTreeShapes += `
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${shapeId++}" name="Titre"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph type="title"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="fr-FR"/>
              <a:t>${escapeXml(title)}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>`;

            const rawContent = slideItem.placeholders.CONTENU || slideItem.placeholders.TEXTE || '';
            const lines = rawContent.split('\n').map(l => l.trimEnd()).filter(l => l.length > 0);
            const paragraphsXml = lines.map(line => {
                const isBullet = line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('*');
                const cleanText = isBullet ? line.replace(/^[\s•\-*]+/, '').trim() : line.trim();
                const isSubBullet = line.startsWith('  ') || line.startsWith('\t');
                const pPr = isBullet ? `<a:pPr lvl="${isSubBullet ? '1' : '0'}"/>` : '<a:pPr/>';
                return `
          <a:p>
            ${pPr}
            <a:r>
              <a:rPr lang="fr-FR"/>
              <a:t>${escapeXml(cleanText)}</a:t>
            </a:r>
          </a:p>`;
            }).join('');

            const bodyIdxAttr = layout.bodyIdx ? ` idx="${layout.bodyIdx}"` : '';
            spTreeShapes += `
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${shapeId++}" name="Contenu"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph type="body"${bodyIdxAttr}/></p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          ${paragraphsXml}
        </p:txBody>
      </p:sp>`;
        }

        const slideXmlStr = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      ${spTreeShapes}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr>
    <a:masterClrMapping/>
  </p:clrMapOvr>
</p:sld>`;

        zip.file(`ppt/slides/slide${slideIndex}.xml`, slideXmlStr.replace(/\s*xmlns=""/g, ''));
        zip.file(`ppt/slides/_rels/slide${slideIndex}.xml.rels`, relsXmlStr.replace(/\s*xmlns=""/g, ''));
    }

    // 6. Mise à jour de `ppt/presentation.xml`
    log("Mise à jour de l'arborescence de présentation...", "info");
    const presXmlStr = await zip.file('ppt/presentation.xml').async('string');
    const presDoc = parser.parseFromString(presXmlStr, 'text/xml');
    let sldIdLst = presDoc.getElementsByTagName('p:sldIdLst')[0];
    if (!sldIdLst) {
        sldIdLst = presDoc.createElementNS('http://schemas.openxmlformats.org/presentationml/2006/main', 'p:sldIdLst');
        // Insérer avant p:sldSz pour respecter l'ordre strict du schéma OpenXML PresentationML
        const sldSz = presDoc.getElementsByTagName('p:sldSz')[0];
        if (sldSz && sldSz.parentNode) {
            sldSz.parentNode.insertBefore(sldIdLst, sldSz);
        } else {
            presDoc.documentElement.appendChild(sldIdLst);
        }
    } else {
        while (sldIdLst.firstChild) sldIdLst.removeChild(sldIdLst.firstChild);
    }

    for (let i = 0; i < targetSlides.length; i++) {
        const sldIdNode = presDoc.createElementNS('http://schemas.openxmlformats.org/presentationml/2006/main', 'p:sldId');
        sldIdNode.setAttribute('id', String(256 + i));
        sldIdNode.setAttribute('r:id', `rIdSlide_${i + 1}`);
        sldIdLst.appendChild(sldIdNode);
    }

    let serializedPres = serializer.serializeToString(presDoc);
    serializedPres = serializedPres.replace(/\s*xmlns=""/g, '');
    // Nettoyer les sections PowerPoint 2010 orphelines/vides du modèle .potx pour éviter toute incohérence de structure
    serializedPres = serializedPres.replace(/<p:ext uri="\{521415D9-36F7-43E2-AB2F-B90AF26B5E84\}">[\s\S]*?<\/p:ext>/g, '');
    zip.file('ppt/presentation.xml', serializedPres);

    // 7. Mise à jour de `ppt/_rels/presentation.xml.rels`
    const presRelsStr = await zip.file('ppt/_rels/presentation.xml.rels').async('string');
    const presRelsDoc = parser.parseFromString(presRelsStr, 'text/xml');
    const presRelsRoot = presRelsDoc.getElementsByTagName('Relationships')[0];

    // Supprimer les anciennes relations de diapositives
    const existingRels = Array.from(presRelsRoot.getElementsByTagName('Relationship'));
    existingRels.forEach(rel => {
        const type = rel.getAttribute('Type') || '';
        if (type.endsWith('/slide')) {
            presRelsRoot.removeChild(rel);
        }
    });

    // Ajouter les nouvelles relations
    for (let i = 0; i < targetSlides.length; i++) {
        const relNode = presRelsDoc.createElementNS('http://schemas.openxmlformats.org/package/2006/relationships', 'Relationship');
        relNode.setAttribute('Id', `rIdSlide_${i + 1}`);
        relNode.setAttribute('Type', 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide');
        relNode.setAttribute('Target', `slides/slide${i + 1}.xml`);
        presRelsRoot.appendChild(relNode);
    }
    let serializedPresRels = serializer.serializeToString(presRelsDoc);
    serializedPresRels = serializedPresRels.replace(/\s*xmlns=""/g, '');
    zip.file('ppt/_rels/presentation.xml.rels', serializedPresRels);

    // 8. Mise à jour de `[Content_Types].xml`
    const contentTypesStr = await zip.file('[Content_Types].xml').async('string');
    const contentTypesDoc = parser.parseFromString(contentTypesStr, 'text/xml');
    const typesRoot = contentTypesDoc.getElementsByTagName('Types')[0];

    // Convertir template.main+xml en presentation.main+xml si le modèle source est un modèle .potx
    const presOverrides = Array.from(typesRoot.getElementsByTagName('Override'));
    presOverrides.forEach(ov => {
        const partName = ov.getAttribute('PartName') || '';
        if (partName === '/ppt/presentation.xml') {
            ov.setAttribute('ContentType', 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml');
        }
    });

    // Supprimer les anciens overrides de slides
    const existingSlideOverrides = Array.from(typesRoot.getElementsByTagName('Override'));
    existingSlideOverrides.forEach(ov => {
        const partName = ov.getAttribute('PartName') || '';
        if (/^\/ppt\/slides\/slide\d+\.xml$/.test(partName)) {
            typesRoot.removeChild(ov);
        }
    });

    // Ajouter les nouveaux overrides pour chaque slide
    for (let i = 0; i < targetSlides.length; i++) {
        const ovNode = contentTypesDoc.createElementNS('http://schemas.openxmlformats.org/package/2006/content-types', 'Override');
        ovNode.setAttribute('PartName', `/ppt/slides/slide${i + 1}.xml`);
        ovNode.setAttribute('ContentType', 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml');
        typesRoot.appendChild(ovNode);
    }

    // Assurer que le type PNG est déclaré
    const existingDefaults = Array.from(typesRoot.getElementsByTagName('Default'));
    const hasPngDefault = existingDefaults.some(d => d.getAttribute('Extension')?.toLowerCase() === 'png');
    if (!hasPngDefault) {
        const pngDefault = contentTypesDoc.createElementNS('http://schemas.openxmlformats.org/package/2006/content-types', 'Default');
        pngDefault.setAttribute('Extension', 'png');
        pngDefault.setAttribute('ContentType', 'image/png');
        typesRoot.appendChild(pngDefault);
    }

    let serializedContentTypes = serializer.serializeToString(contentTypesDoc);
    serializedContentTypes = serializedContentTypes.replace(/\s*xmlns=""/g, '');
    zip.file('[Content_Types].xml', serializedContentTypes);

    // 9. Recompression ZIP & Production du Blob final
    log("Recompression finale du livrable PowerPoint...", "info");
    await yieldToMain();
    const finalBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
    });

    return finalBlob;
}
