import { Utils } from '../../core/Utils.js';
import { UI } from '../../core/UIFactory.js';
import { DOM } from '../../ui/DOM.js';
import { currentForm, store } from '../../core/State.js';
import { exportWidgetImage } from '../WidgetRenderer.js';
import { DataUtils } from '../../core/DataUtils.js';
import { AIContextBuilder } from '../../core/AIContextBuilder.js';
import { MarkdownUtils } from '../../core/MarkdownUtils.js';
import { IOManager } from '../../core/IOManager.js';

const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

/**
 * Génère et télécharge le fichier Word pour un livrable donné de façon asynchrone pour ne pas figer l'UI.
 * Supporte l'injection dans un modèle (.docx/.dotx) si fourni.
 * 
 * @param {Object} delivery - L'objet livrable
 * @param {ArrayBuffer} [templateBuffer] - Le buffer du fichier modèle (optionnel)
 */
export async function downloadDeliveryWord(delivery, templateBuffer, docConfig) {
    if (!delivery || !delivery.sections || !window.docx) {
        if (!window.docx) UI.showToast("La librairie docx n'est pas chargée.", "danger");
        return;
    }

    // 1. Générer le contenu du rapport (Document temporaire)
    const allBlocks = [];

    for (let i = 0; i < delivery.sections.length; i++) {
        await yieldToMain(); // Évite de figer l'UI pendant l'itération des sections
        const section = delivery.sections[i];
        
        // Titre de Section (Niveau 1)
        const sectionTitleStyle = docConfig?.styles?.h1 || window.docx.HeadingLevel.HEADING_1;
        allBlocks.push(
            new window.docx.Paragraph({
                text: section.name || 'Section',
                style: typeof sectionTitleStyle === 'string' ? sectionTitleStyle : undefined,
                heading: typeof sectionTitleStyle === 'string' ? undefined : sectionTitleStyle,
                spacing: { before: 400, after: 200 }
            })
        );

        const blocks = section.blocks || [];
        for (let block of blocks) {
            await yieldToMain(); // Évite de figer l'UI pendant l'itération des blocs

            // Titre de Bloc (Niveau 2 systématique selon feedback utilisateur)
            const blockTitleStyle = docConfig?.styles?.h2 || window.docx.HeadingLevel.HEADING_2;
            allBlocks.push(
                new window.docx.Paragraph({
                    text: block.title || block.type || 'Bloc',
                    style: typeof blockTitleStyle === 'string' ? blockTitleStyle : undefined,
                    heading: typeof blockTitleStyle === 'string' ? undefined : blockTitleStyle,
                    spacing: { before: 300, after: 150 }
                })
            );

            // Contenu du Bloc
            if (block.type === 'text') {
                allBlocks.push(...parseMarkdownToDocx(block.content || '', docConfig));
            } else if (block.type === 'synthese') {
                allBlocks.push(...parseMarkdownToDocx(block.content || block.config?.result || '', docConfig));
            } else if (block.type === 'context') {
                allBlocks.push(...parseMarkdownToDocx(block.content || '', docConfig));
            } else if (block.type === 'datatable') {
                const tableMd = AIContextBuilder.buildTable(block.config.scope, block.config.columns, currentForm);
                if (tableMd) {
                    allBlocks.push(...parseMarkdownToDocx(tableMd, docConfig));
                }
            } else if (block.type === 'kpi') {
                const ids = block.widgetIds || (block.widgetId ? [block.widgetId] : []);
                for (const id of ids) {
                    await yieldToMain(); // Render Chart.js peut être très lourd, on yield avant
                    const widgetDef = (currentForm.statics || []).find(w => w.id === id);
                    if (!widgetDef) continue;
                    try {
                        const b64DataUri = await exportWidgetImage(widgetDef, currentForm);
                        if (b64DataUri) {
                            const kpiTitleStyle = docConfig?.styles?.h3 || window.docx.HeadingLevel.HEADING_3;
                            allBlocks.push(new window.docx.Paragraph({
                                text: widgetDef.title || 'Graphique',
                                style: typeof kpiTitleStyle === 'string' ? kpiTitleStyle : undefined,
                                heading: typeof kpiTitleStyle === 'string' ? undefined : kpiTitleStyle,
                                spacing: { before: 200, after: 100 }
                            }));

                            const rawBase64 = b64DataUri.replace(/^data:image\/\w+;base64,/, '');
                            allBlocks.push(new window.docx.Paragraph({
                                children: [
                                    new window.docx.ImageRun({
                                        data: Uint8Array.from(atob(rawBase64), c => c.charCodeAt(0)),
                                        transformation: { width: 600, height: 300 },
                                        type: 'png'
                                    })
                                ],
                                spacing: { before: 200, after: 200 },
                                alignment: window.docx.AlignmentType.CENTER
                            }));
                        }
                    } catch (err) {
                        console.error(`Erreur export widget Word ${id}:`, err);
                        allBlocks.push(new window.docx.Paragraph({
                            text: `[📊 Graphique manquant : ${widgetDef?.title || 'Inconnu'}]`,
                            style: docConfig?.styles?.p || undefined,
                            spacing: { before: 100, after: 100 },
                            alignment: window.docx.AlignmentType.CENTER
                        }));
                    }
                }
                if (block.comment?.trim()) {
                    allBlocks.push(...parseMarkdownToDocx(block.comment, docConfig));
                }
            }
        }
    }

    const tempDoc = new window.docx.Document({
        sections: [{
            properties: {},
            children: allBlocks
        }]
    });

    try {
        await yieldToMain(); // Packer peut prendre du temps
        const tempBlob = await window.docx.Packer.toBlob(tempDoc);

        if (!templateBuffer) {
            IOManager.downloadBlob(tempBlob, Utils.toSlug(delivery.name) + ".docx");
            return;
        }

        if (!window.JSZip) {
            UI.showToast("La librairie JSZip est manquante.", "danger");
            IOManager.downloadBlob(tempBlob, Utils.toSlug(delivery.name) + ".docx");
            return;
        }

        await yieldToMain(); // Zip loading
        const tempZip = await window.JSZip.loadAsync(tempBlob);
        const tempXmlStr = await tempZip.file("word/document.xml").async("string");
        const parser = new DOMParser();
        const tempXmlDoc = parser.parseFromString(tempXmlStr, "text/xml");

        const tempBody = tempXmlDoc.getElementsByTagName("w:body")[0];
        const sourceNodes = Array.from(tempBody.childNodes).filter(node => node.nodeName !== "w:sectPr");

        const templateZip = await window.JSZip.loadAsync(templateBuffer);

        const safeTitle = (delivery.name || "").replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;' }[c]));
        const safeDate = new Date().toLocaleDateString('fr-FR');

        const replaceVarsInXml = (xmlStr) => {
            let res = xmlStr.replace(/\{\{TITRE\}\}/g, safeTitle);
            res = res.replace(/\{\{DATE\}\}/g, safeDate);
            return res;
        };

        await yieldToMain(); // Regex replace in headers
        for (let filename of Object.keys(templateZip.files)) {
            if (filename.startsWith("word/header") || filename.startsWith("word/footer")) {
                let hfXml = await templateZip.file(filename).async("string");
                templateZip.file(filename, replaceVarsInXml(hfXml));
            }
        }

        let templateXmlStr = await templateZip.file("word/document.xml").async("string");
        templateXmlStr = replaceVarsInXml(templateXmlStr);
        const templateXmlDoc = parser.parseFromString(templateXmlStr, "text/xml");
        const templateBody = templateXmlDoc.getElementsByTagName("w:body")[0];

        // GESTION DES MÉDIAS
        await yieldToMain();
        const tempRelsFile = tempZip.file("word/_rels/document.xml.rels");
        const templateRelsFile = templateZip.file("word/_rels/document.xml.rels");
        if (tempRelsFile && templateRelsFile) {
            let templateRelsStr = await templateRelsFile.async("string");
            const tempRelsStr = await tempRelsFile.async("string");
            const tempRelsDoc = parser.parseFromString(tempRelsStr, "text/xml");
            const rels = Array.from(tempRelsDoc.getElementsByTagName("Relationship"));
            let newRelsXml = "";

            for (const rel of rels) {
                const target = rel.getAttribute("Target");
                if (target && target.startsWith("media/")) {
                    const mediaFileData = tempZip.file("word/" + target);
                    if (mediaFileData) {
                        const mediaData = await mediaFileData.async("uint8array");
                        const randStr = Math.random().toString(36).substring(2, 7);
                        const newTarget = `media/ezio_${Date.now()}_${randStr}.png`;
                        templateZip.file("word/" + newTarget, mediaData);

                        const oldRId = rel.getAttribute("Id");
                        const newRId = `rIdEzio_${Date.now()}_${randStr}`;

                        newRelsXml += `<Relationship Id="${newRId}" Type="${rel.getAttribute("Type")}" Target="${newTarget}"/>`;

                        const blips = tempXmlDoc.getElementsByTagName("a:blip");
                        for (let i = 0; i < blips.length; i++) {
                            if (blips[i].getAttribute("r:embed") === oldRId) {
                                blips[i].setAttribute("r:embed", newRId);
                            }
                        }
                    }
                }
            }
            if (newRelsXml) {
                templateRelsStr = templateRelsStr.replace('</Relationships>', newRelsXml + '</Relationships>');
                templateZip.file("word/_rels/document.xml.rels", templateRelsStr);
            }
            
            const ctFile = templateZip.file("[Content_Types].xml");
            if (ctFile) {
                let ctStr = await ctFile.async("string");
                if (!ctStr.includes('Extension="png"')) {
                    ctStr = ctStr.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>');
                    templateZip.file("[Content_Types].xml", ctStr);
                }
            }
        }

        // Injection
        await yieldToMain();
        let placeholderPara = null;
        const paras = templateBody.getElementsByTagName("w:p");

        for (let i = 0; i < paras.length; i++) {
            if (paras[i].textContent.includes("{{CONTENU}}")) {
                placeholderPara = paras[i];
                break;
            }
        }

        if (placeholderPara) {
            sourceNodes.forEach(node => {
                const importedNode = templateXmlDoc.importNode(node, true);
                templateBody.insertBefore(importedNode, placeholderPara);
            });
            templateBody.removeChild(placeholderPara);
        } else {
            const lastChild = templateBody.lastChild;
            sourceNodes.forEach(node => {
                const importedNode = templateXmlDoc.importNode(node, true);
                if (lastChild && lastChild.nodeName === "w:sectPr") {
                    templateBody.insertBefore(importedNode, lastChild);
                } else {
                    templateBody.appendChild(importedNode);
                }
            });
        }

        // Sauvegarde
        const serializer = new XMLSerializer();
        const newTemplateXml = serializer.serializeToString(templateXmlDoc);
        templateZip.file("word/document.xml", newTemplateXml);

        await yieldToMain(); // Dernier yield avant génération finale
        const finalBlob = await templateZip.generateAsync({ type: "blob" });
        IOManager.downloadBlob(finalBlob, Utils.toSlug(delivery.name) + ".docx");

    } catch (e) {
        console.error("Erreur lors de la génération Word", e);
        UI.showToast("Erreur lors de la génération : " + e.message, "danger");
    }
}

function parseMarkdownToDocx(mdText, docConfig) {
    const children = [];
    const ast = MarkdownUtils.parseToAST(mdText);

    for (const block of ast) {
        if (block.type === 'table') {
            children.push(createDocxTable(block.rows, docConfig));
        } else if (block.type === 'header') {
            const hStyleMap = {
                1: { style: docConfig?.styles?.h1 || window.docx.HeadingLevel.TITLE, spacing: { before: 400, after: 200 } },
                2: { style: docConfig?.styles?.h2 || window.docx.HeadingLevel.HEADING_1, spacing: { before: 300, after: 150 } },
                3: { style: docConfig?.styles?.h3 || window.docx.HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 } },
                4: { style: docConfig?.styles?.h4 || window.docx.HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 } },
                5: { style: docConfig?.styles?.h5 || window.docx.HeadingLevel.HEADING_4, spacing: { before: 200, after: 100 } },
                6: { style: docConfig?.styles?.h6 || window.docx.HeadingLevel.HEADING_5, spacing: { before: 200, after: 100 } },
            };
            const config = hStyleMap[block.level] || hStyleMap[1];

            children.push(new window.docx.Paragraph({
                children: block.runs.map(r => new window.docx.TextRun({ text: r.text, color: r.format.color, shading: r.format.background ? { type: window.docx.ShadingType.CLEAR, color: r.format.background, fill: r.format.background } : undefined })),
                style: typeof config.style === 'string' ? config.style : undefined,
                heading: typeof config.style === 'string' ? undefined : config.style,
                spacing: config.spacing
            }));
        } else if (block.type === 'list_item') {
            const styleList = docConfig?.styles?.[block.listType === 'ordered' ? 'ol' : 'ul'];
            let appliedStyle = undefined;
            let appliedIndent = undefined;

            if (Array.isArray(styleList)) {
                appliedStyle = styleList[Math.min(block.level, styleList.length - 1)];
            } else if (typeof styleList === 'string') {
                appliedStyle = styleList;
                if (block.level > 0) {
                    appliedIndent = { left: 720 * block.level };
                }
            }

            children.push(new window.docx.Paragraph({
                children: convertRunsToDocx(block.runs),
                style: appliedStyle,
                indent: appliedIndent,
                spacing: { after: 100 },
                bullet: appliedStyle ? undefined : { level: block.level }
            }));
        } else if (block.type === 'paragraph') {
            const styleP = docConfig?.styles?.p;
            children.push(new window.docx.Paragraph({
                children: convertRunsToDocx(block.runs),
                style: typeof styleP === 'string' ? styleP : undefined,
                spacing: { after: 100 }
            }));
        }
    }

    return children;
}

function convertRunsToDocx(runs, baseColor, baseBold) {
    if (!runs || runs.length === 0) return [new window.docx.TextRun({ text: "" })];
    return runs.map(r => {
        const tr = {
            text: r.text,
            bold: r.format.bold || baseBold,
            italics: r.format.italic,
            strike: r.format.strike,
            underline: r.format.underline ? { type: window.docx.UnderlineType.SINGLE } : undefined,
            color: r.format.color || baseColor,
            shading: r.format.background ? {
                type: window.docx.ShadingType.CLEAR,
                color: r.format.background,
                fill: r.format.background
            } : undefined
        };
        return new window.docx.TextRun(tr);
    });
}

function createDocxTable(rowsData, docConfig) {
    const tFmt = (docConfig && docConfig.tableFormat) ? docConfig.tableFormat : {};
    const headerFill = tFmt.headerFill || "E0E0E0";
    const headerColor = tFmt.headerColor || "000000";
    const rowFill = tFmt.rowFill || "FFFFFF";
    const rowAltFill = tFmt.rowAltFill || "FFFFFF";
    const borderColor = tFmt.borderColor || "CCCCCC";
    const borderSize = tFmt.borderSize !== undefined ? tFmt.borderSize : 4; 

    const borderDef = {
        style: window.docx.BorderStyle.SINGLE,
        size: borderSize,
        color: borderColor
    };
    const tableBorders = {
        top: borderDef, bottom: borderDef, left: borderDef, right: borderDef, insideHorizontal: borderDef, insideVertical: borderDef
    };

    return new window.docx.Table({
        width: { size: 100, type: window.docx.WidthType.PERCENTAGE },
        borders: tableBorders,
        rows: rowsData.map((row, rIdx) => {
            const isHeader = rIdx === 0;
            return new window.docx.TableRow({
                children: row.map(cellText => {
                    let cellFill = isHeader ? headerFill : (rIdx % 2 === 0 ? rowFill : rowAltFill);
                    let cellColor = isHeader ? headerColor : "000000";
                    let rawText = cellText;

                    let runs = MarkdownUtils.extractInlineStyles(rawText);

                    const bgRun = runs.find(r => r.format.background);
                    if (bgRun) cellFill = bgRun.format.background;

                    runs = runs.map(r => {
                        const newFormat = { ...r.format };
                        if (newFormat.color) cellColor = newFormat.color;
                        delete newFormat.background;
                        return { text: r.text, format: newFormat };
                    });

                    return new window.docx.TableCell({
                        children: parseMarkdownCellText(rawText, docConfig, cellColor, isHeader),
                        shading: { fill: cellFill }
                    });
                })
            });
        })
    });
}

function parseMarkdownCellText(rawText, docConfig, cellColor, isHeader) {
    const lines = rawText.split(/<br\s*\/?>|\n/i);
    const paragraphs = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line && i === lines.length - 1) continue;

        let bulletActive = false;
        let textToParse = line;

        const matchUl = line.match(/^[-*]\s+(.*)/);
        if (matchUl) {
            bulletActive = true;
            textToParse = matchUl[1];
        } else {
            const matchOl = line.match(/^(\d+\.)\s+(.*)/);
            if (matchOl) {
                bulletActive = true;
                textToParse = matchOl[2];
            }
        }

        const pConfig = {
            children: convertRunsToDocx(MarkdownUtils.extractInlineStyles(textToParse), cellColor, isHeader)
        };

        if (bulletActive) pConfig.bullet = { level: 0 };

        paragraphs.push(new window.docx.Paragraph(pConfig));
    }

    if (paragraphs.length === 0) {
        paragraphs.push(new window.docx.Paragraph({ children: [new window.docx.TextRun({ text: "", color: cellColor })] }));
    }

    return paragraphs;
}
