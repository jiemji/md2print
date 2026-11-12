import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveCallout,
  resolveBadgeClass,
  parseMetricTag,
  resolveMetricClass,
  parseColumnFontScale,
  parseColumnTagParams,
  parseTimelineStep,
  isExecutableHtmlFence,
} from '../js/tagParsers.js';
import { normalizeMermaidCode, wrapUnfencedMermaidBlocks } from '../js/mermaidEngine.js';
import { parseToAST, extractInlineStyles } from '../js/MarkdownParser.js';
import { planSlides, findSlideIndexForLine } from '../js/SlidePlanner.js';
import { extractAndGroupColumns, extractAndRenderTimelines } from '../js/HtmlGenerator.js';
import { segmentMarkdownToSlides, blockToPlainText } from '../js/PptxTemplateEngine.js';
import { generateDocx } from '../js/DocxGenerator.js';
import {
  parseConfigFromCss,
  generateThemeCss,
  DEFAULT_STYLE_CONFIG,
} from '../js/themeCssEngine.js';
import { compressImageDataUrl, compressEmbeddedImagesInText } from '../js/utils.js';

describe('tagParsers — Callouts, Badges, KPIs, Colonnes et Frises', () => {
  it('resolveCallout analyse les types d alerte GitHub et les titres personnalises', () => {
    const note = resolveCallout('NOTE', 'Information cle');
    assert.equal(note.kind, 'note');
    assert.equal(note.title, 'Information cle');

    const danger = resolveCallout('CAUTION', '');
    assert.equal(danger.kind, 'danger');
    assert.equal(danger.title, 'ATTENTION');

    const fallback = resolveCallout('UNKNOWN_TYPE', '');
    assert.equal(fallback.kind, 'note');
  });

  it('resolveBadgeClass associe les variantes et alias francais aux classes CSS', () => {
    assert.equal(resolveBadgeClass('succes'), 'badge-success');
    assert.equal(resolveBadgeClass('rouge'), 'badge-danger');
    assert.equal(resolveBadgeClass('warning'), 'badge-warning');
    assert.equal(resolveBadgeClass('inconnu'), 'badge-neutral');
  });

  it('parseMetricTag et resolveMetricClass analysent les cartouches [chiffre:...]', () => {
    const kpi1 = parseMetricTag('99,98 %', 'Disponibilite', 'succes');
    assert.deepEqual(kpi1, {
      val: '99,98 %',
      label: 'Disponibilite',
      variant: 'succes',
    });
    assert.equal(resolveMetricClass(kpi1.variant), 'metric-card-success');

    // Cas a 2 arguments ou le 2e est directement une variante connue
    const kpi2 = parseMetricTag('42', 'danger', undefined);
    assert.deepEqual(kpi2, {
      val: '42',
      label: '',
      variant: 'danger',
    });
  });

  it('parseColumnTagParams analyse les parametres de [colonne:ratio:titre:couleur:echelle]', () => {
    assert.deepEqual(parseColumnTagParams(undefined), {
      ratio: 1,
      title: '',
      colorVariant: '',
      colorHex: '',
      fontScale: 1,
    });

    assert.deepEqual(parseColumnTagParams('2:Architecture Cible:info:0.9'), {
      ratio: 2,
      title: 'Architecture Cible',
      colorVariant: 'info',
      colorHex: '',
      fontScale: 0.9,
    });

    assert.deepEqual(parseColumnTagParams('1:Bilan Financier:#1e40af:85%'), {
      ratio: 1,
      title: 'Bilan Financier',
      colorVariant: '',
      colorHex: '#1e40af',
      fontScale: 0.85,
    });

    assert.equal(parseColumnFontScale('1,25', true), 1.25);
    assert.equal(parseColumnFontScale('80%', false), 0.8);
  });

  it('parseTimelineStep analyse les jalons, couleurs, titres et descriptions de [frise]', () => {
    const step1 = parseTimelineStep(
      '- **T0** (danger) | **Detection** | Alerte sonde et qualification SOC'
    );
    assert.deepEqual(step1, {
      badge: 'T0',
      colorName: 'danger',
      title: 'Detection',
      desc: 'Alerte sonde et qualification SOC',
    });

    const step2 = parseTimelineStep('1. J+15 (vert) : Go-Live : Ouverture du service');
    assert.deepEqual(step2, {
      badge: 'J+15',
      colorName: 'success',
      title: 'Go-Live',
      desc: 'Ouverture du service',
    });

    assert.equal(parseTimelineStep('   '), null);
    assert.equal(parseTimelineStep('%%MD2PRINT_EMPTY_LINE%%'), null);
  });

  it('isExecutableHtmlFence reconnait les blocs html-exec', () => {
    assert.equal(isExecutableHtmlFence('html-exec'), true);
    assert.equal(isExecutableHtmlFence('html-live'), true);
    assert.equal(isExecutableHtmlFence('html!'), true);
    assert.equal(isExecutableHtmlFence('html'), false);
  });
});

describe('MarkdownParser — AST et styles inline', () => {
  it('extractInlineStyles extrait le gras, italique, code, badges et chiffres KPI', () => {
    const runs = extractInlineStyles(
      'Texte **gras** et `code` avec [badge:info:Actif] et [chiffre:98%:SLA:vert]'
    );
    assert.ok(runs.some((r) => r.text === 'gras' && r.format.bold === true));
    assert.ok(runs.some((r) => r.text === 'code' && r.format.code === true));
    const badgeRun = runs.find((r) => r.format.badge === true && r.format.badgeType === 'info');
    assert.ok(badgeRun);
    assert.equal(badgeRun.format.color, '1D4ED8');
    assert.equal(badgeRun.format.background, 'DBEAFE');
    const metricRun = runs.find((r) => r.format.metric === true && r.format.metricVal === '98%');
    assert.ok(metricRun);
    assert.equal(metricRun.format.color, '16A34A');
  });

  it('parseToAST construit des noeuds types incluant table, callout et timeline ([frise])', () => {
    const sampleMd = [
      '# Titre Principal',
      '',
      '## Chapitre 1',
      '',
      '### Vue Chronologique',
      '',
      '[frise]',
      '- **Q1** (info) | **Cadrage** | Audit de l existant',
      '- **Q2** (vert) | **Deploiement** | Bascule production',
      '[/frise]',
      '',
      '> [!WARNING] Point d attention',
      '> Verifier la bande passante.',
      '',
      '| Critere | Valeur |',
      '| :--- | :--- |',
      '| Latence | 12 ms |',
    ].join('\n');

    const ast = parseToAST(sampleMd);
    const timelineNode = ast.find((n) => n.type === 'timeline');
    assert.ok(timelineNode, 'Le bloc [frise] doit produire un noeud AST de type timeline');
    assert.equal(timelineNode.steps.length, 2);
    assert.equal(timelineNode.steps[0].badge, 'Q1');
    assert.equal(timelineNode.steps[0].colorName, 'info');
    assert.equal(timelineNode.steps[1].badge, 'Q2');
    assert.equal(timelineNode.steps[1].colorName, 'success');

    const calloutNode = ast.find((n) => n.type === 'paragraph' && n.isQuote && n.callout);
    assert.ok(calloutNode);
    assert.equal(calloutNode.callout.kind, 'warning');
    assert.equal(calloutNode.callout.title, "Point d attention");

    const tableNode = ast.find((n) => n.type === 'table');
    assert.ok(tableNode);
    assert.deepEqual(tableNode.rows, [
      ['Critere', 'Valeur'],
      ['Latence', '12 ms'],
    ]);
  });
});

describe('SlidePlanner & PptxTemplateEngine — Planification et synchronisation des slides', () => {
  it('planSlides decoupe les diapositives et restitue le bloc [frise] dans le Markdown du slide', () => {
    const md = [
      '# Presentation Strategie',
      'Sous-titre direction',
      '',
      '## 1. Feuille de route',
      '',
      '### Jalons 2026',
      '',
      '[frise]',
      '- **T0** (rouge) | **Alerte** | Detection initiale',
      '- **T+2h** (vert) | **Remise en service** | Validation PRA',
      '[/frise]',
    ].join('\n');

    const slides = planSlides(md, 'Presentation Strategie', { date: '11/11/2026' });
    assert.equal(slides.length, 3);
    assert.equal(slides[0].type, 'title');
    assert.equal(slides[0].metadata, 'Sous-titre direction');
    assert.equal(slides[1].type, 'chapter');
    assert.equal(slides[2].type, 'content');
    assert.ok(slides[2].markdown.includes('[frise]'));
    assert.ok(slides[2].markdown.includes('[/frise]'));

    // Verification de findSlideIndexForLine
    assert.equal(findSlideIndexForLine(slides, 0), 0);
    assert.equal(findSlideIndexForLine(slides, 3), 1);
    assert.equal(findSlideIndexForLine(slides, 8), 2);
  });

  it('segmentMarkdownToSlides convertit [frise] en tableau horizontal et structure [colonne]', () => {
    const mockPrototypes = {
      cover: { num: 1, titleType: 'ctrTitle' },
      chapter: { num: 2, titleType: 'ctrTitle' },
      content: { num: 3, titleType: 'title' },
    };

    const md = [
      '### Frise Seule',
      '[frise]',
      '- **M1** (info) | **Etape 1** | Cadrage',
      '- **M2** (vert) | **Etape 2** | Bilan',
      '[/frise]',
      '---',
      '### Comparatif Colonnes',
      '[colonne:1:Avant:danger]',
      '- Processus manuel',
      '[/colonne]',
      '[colonne:2:Apres:success]',
      '- Automatisation complete',
      '[/colonne]',
    ].join('\n');

    const pptxSlides = segmentMarkdownToSlides(md, 'Test PPTX', mockPrototypes);
    assert.equal(pptxSlides.length, 2);

    // Slide 1 : la frise seule est convertie en tableau PowerPoint 2 lignes
    assert.ok(Array.isArray(pptxSlides[0].table));
    assert.equal(pptxSlides[0].table.length, 2);
    assert.deepEqual(pptxSlides[0].table[0], ['M1', 'M2']);
    assert.ok(pptxSlides[0].table[1][0].includes('Etape 1'));

    // Slide 2 : les 2 colonnes sont enregistrees avec leurs ratios et items
    assert.ok(Array.isArray(pptxSlides[1].columns));
    assert.equal(pptxSlides[1].columns.length, 2);
    assert.equal(pptxSlides[1].columns[0].ratio, 1);
    assert.equal(pptxSlides[1].columns[0].title, 'Avant');
    assert.equal(pptxSlides[1].columns[1].ratio, 2);
    assert.equal(pptxSlides[1].columns[1].title, 'Apres');

    // blockToPlainText sur un noeud timeline
    const txt = blockToPlainText({
      type: 'timeline',
      steps: [{ badge: 'J1', title: 'Lancement', desc: 'Kickoff' }],
    });
    assert.equal(txt, 'J1 : Lancement : Kickoff');
  });
});

describe('HtmlGenerator & StyleSettingsManager — Extraction colonnes, frises et CSS', () => {
  it('extractAndGroupColumns et extractAndRenderTimelines transforment les balises sans toucher aux blocs de code', () => {
    const mdWithCols = [
      '[colonne:1:Gauche:info]',
      'Contenu A',
      '[/colonne]',
      '[colonne:2:Droite:success]',
      'Contenu B',
      '[/colonne]',
      '```markdown',
      '[colonne:1:Exemple ignore]',
      '[/colonne]',
      '```',
    ].join('\n');

    const colRes = extractAndGroupColumns(mdWithCols);
    assert.equal(colRes.groups.length, 1);
    assert.equal(colRes.groups[0].length, 2);
    assert.equal(colRes.groups[0][0].title, 'Gauche');
    assert.equal(colRes.groups[0][1].ratio, 2);

    const mdWithTimeline = [
      '[frise]',
      '- **2025** (info) | ** Genese ** | Prototype',
      '- **2026** (vert) | ** Industrialisation ** | V2',
      '[/frise]',
    ].join('\n');
    const tlRes = extractAndRenderTimelines(mdWithTimeline);
    assert.equal(tlRes.timelineHtmls.length, 1);
    assert.ok(tlRes.timelineHtmls[0].includes('timeline-step'));
    assert.ok(tlRes.timelineHtmls[0].includes('timeline-node-info'));
    assert.ok(tlRes.timelineHtmls[0].includes('timeline-node-success'));
  });

  it('normalizeMermaidCode et wrapUnfencedMermaidBlocks nettoient les diagrammes Mermaid', () => {
    const raw = 'flowchart LR\n  A["Noeud<br/>1"] --> B';
    const norm = normalizeMermaidCode(raw);
    assert.ok(norm.includes('flowchart LR'));

    const unfenced = 'Texte avant\nflowchart TD\n  A --> B\n\nTexte apres';
    const wrapped = wrapUnfencedMermaidBlocks(unfenced);
    assert.ok(wrapped.includes('```mermaid'));
  });

  it('parseConfigFromCss extrait les parametres de theme et les tailles de frise', () => {
    const customCss = [
      '/* [md2print-config:mode=slide] {"timeline":{"dotSize":"84px","badgeFontSize":"1.3rem","titleFontSize":"1.1rem","descFontSize":"0.9rem"}} [/md2print-config] */',
      ':root { --slide-timeline-dot-size: 84px; }',
    ].join('\n');

    const parsed = parseConfigFromCss(customCss, 'slide');
    assert.ok(parsed);
    assert.equal(parsed.mode, 'slide');
    assert.equal(parsed.config.timeline.dotSize, '84px');
    assert.equal(parsed.config.timeline.badgeFontSize, '1.3rem');
    assert.equal(parsed.config.timeline.titleFontSize, '1.1rem');
    assert.equal(parsed.config.timeline.descFontSize, '0.9rem');

    // Vérification de la non-duplication Base64 dans generateThemeCss
    const slideCfg = JSON.parse(JSON.stringify(DEFAULT_STYLE_CONFIG.slide));
    slideCfg.contentSlide.bgImage = 'data:image/jpeg;base64,SAMPLE_BG_DATA';
    const generatedCss = generateThemeCss('slide', slideCfg);
    const matches = generatedCss.match(/SAMPLE_BG_DATA/g) || [];
    assert.equal(matches.length, 1, 'L image Base64 ne doit apparaitre qu une seule fois dans le CSS');
    const reparsed = parseConfigFromCss(generatedCss, 'slide');
    assert.equal(reparsed.config.contentSlide.bgImage, 'data:image/jpeg;base64,SAMPLE_BG_DATA');
  });

  it('generateDocx construit des tableaux Word multi-colonnes pour [colonne] et [frise]', async () => {
    class MockParagraph {
      constructor(opts) {
        Object.assign(this, opts);
      }
    }
    class MockTextRun {
      constructor(opts) {
        Object.assign(this, opts);
      }
    }
    class MockTableCell {
      constructor(opts) {
        Object.assign(this, opts);
      }
    }
    class MockTableRow {
      constructor(opts) {
        Object.assign(this, opts);
      }
    }
    class MockTable {
      constructor(opts) {
        Object.assign(this, opts);
      }
    }
    class MockDocument {
      constructor(opts) {
        Object.assign(this, opts);
      }
    }

    let capturedDoc = null;
    globalThis.window = {
      docx: {
        Paragraph: MockParagraph,
        TextRun: MockTextRun,
        TableCell: MockTableCell,
        TableRow: MockTableRow,
        Table: MockTable,
        Document: MockDocument,
        HeadingLevel: {
          TITLE: 'Title',
          HEADING_1: 'Heading1',
          HEADING_2: 'Heading2',
          HEADING_3: 'Heading3',
          HEADING_4: 'Heading4',
          HEADING_5: 'Heading5',
        },
        AlignmentType: { CENTER: 'center' },
        BorderStyle: { SINGLE: 'single' },
        WidthType: { PERCENTAGE: 'pct' },
        UnderlineType: { SINGLE: 'single' },
        Packer: {
          toBlob: async (doc) => {
            capturedDoc = doc;
            return { mockBlob: true };
          },
        },
      },
    };

    const md = [
      '# Rapport Word',
      '',
      '[frise]',
      '- **T0** (danger) | **Alerte** | Detection SOC',
      '- **T+4h** (vert) | **Cloture** | Retour a la normale',
      '[/frise]',
      '',
      '[colonne:1:Constat:warning]',
      '- Point de vigilance',
      '[/colonne]',
      '[colonne:2:Plan d action:success]',
      '- Automatisation du patch',
      '[/colonne]',
    ].join('\n');

    await generateDocx(md, 'Rapport Word', {}, null);
    assert.ok(capturedDoc);
    const children = capturedDoc.sections[0].children;
    const tables = children.filter((c) => c instanceof MockTable);
    assert.equal(tables.length, 2, 'Doit produire 1 tableau pour [frise] et 1 tableau pour [colonne]');

    // Tableau 1 : [frise] -> 2 lignes (jalons + contenus), 2 colonnes
    assert.equal(tables[0].rows.length, 2);
    assert.equal(tables[0].rows[0].children.length, 2);
    assert.equal(tables[0].rows[1].children.length, 2);

    // Tableau 2 : [colonne] -> 1 ligne, 2 cellules de largeurs 33% et 67%
    assert.equal(tables[1].rows.length, 1);
    assert.equal(tables[1].rows[0].children.length, 2);
    assert.equal(tables[1].rows[0].children[0].width.size, 33);
    assert.equal(tables[1].rows[0].children[1].width.size, 67);

    delete globalThis.window;
  });

  it('compressImageDataUrl et compressEmbeddedImagesInText compressent en live les images volumineuses', async () => {
    globalThis.document = {
      createElement: (tag) => {
        if (tag === 'canvas') {
          return {
            width: 0,
            height: 0,
            getContext: () => ({
              imageSmoothingEnabled: true,
              drawImage: () => {},
              getImageData: () => ({ data: new Uint8ClampedArray([255, 255, 255, 255]) }),
            }),
            toDataURL: (mime) => `data:${mime};base64,COMPRESSED_PAYLOAD`,
          };
        }
        return {};
      },
    };
    globalThis.Image = class {
      constructor() {
        this.naturalWidth = 3840;
        this.naturalHeight = 2160;
      }
      set src(val) {
        this._src = val;
        if (this.onload) this.onload();
      }
    };

    const bigPayload = 'A'.repeat(50000);
    const rawPngUrl = `data:image/png;base64,${bigPayload}`;
    const compressed = await compressImageDataUrl(rawPngUrl, { minLengthToCompress: 1000 });
    assert.equal(compressed, 'data:image/jpeg;base64,COMPRESSED_PAYLOAD');

    // Préservation des SVG vectoriels
    const svgUrl = `data:image/svg+xml;base64,${bigPayload}`;
    assert.equal(await compressImageDataUrl(svgUrl, { minLengthToCompress: 1000 }), svgUrl);

    // Compression à la volée dans une feuille CSS
    const cssWithBigImg = `.slide { background-image: url('${rawPngUrl}'); }`;
    const compressedCss = await compressEmbeddedImagesInText(cssWithBigImg, {
      minLengthToCompress: 1000,
    });
    assert.ok(compressedCss.includes('data:image/jpeg;base64,COMPRESSED_PAYLOAD'));

    delete globalThis.document;
    delete globalThis.Image;
  });
});
