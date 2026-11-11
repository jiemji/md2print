/**
 * @module tagParsers
 * @description Analyseurs et dictionnaires de résolution pour les balises enrichies de md2print :
 * - Alertes et callouts GitHub (`> [!NOTE]`, `> [!WARNING]`, etc.)
 * - Badges inline (`[badge:type:texte]`)
 * - Cartouches de données et indicateurs clés (`[chiffre:valeur:libellé:variante]`, `[kpi:...]`)
 * - Colonnes multiples (`[colonne:taille:titre:couleur:ratio police]`)
 * - Détection des blocs HTML exécutables (`[html]...[/html]`, `:::html`, ```` ```html-exec ````)
 */

/**
 * Indique si un identifiant de langage de bloc de code (ex: ```html-exec) désigne un bloc HTML exécutable.
 * @param {string} [fenceLang='']
 * @returns {boolean}
 */
export const isExecutableHtmlFence = (fenceLang = '') => {
  const clean = String(fenceLang).trim().toLowerCase();
  return /^(?:html-exec|html-live|html-run|html-widget|html!)(?:\s|$)/.test(clean);
};

/**
 * Indique si une ligne ouvre un bloc HTML exécutable via la syntaxe courte [html] ou :::html.
 * @param {string} [line='']
 * @returns {boolean}
 */
export const isHtmlBlockOpenLine = (line = '') => {
  const trimmed = String(line).trim().toLowerCase();
  return trimmed === '[html]' || trimmed === ':::html' || trimmed === '::: html';
};

/**
 * Indique si une ligne ferme un bloc HTML exécutable via [/html] ou :::.
 * @param {string} [line='']
 * @returns {boolean}
 */
export const isHtmlBlockCloseLine = (line = '') => {
  const trimmed = String(line).trim().toLowerCase();
  return trimmed === '[/html]' || trimmed === ':::';
};

/**
 * Dictionnaire de configuration des types d'alertes / callouts Markdown (syntaxe > [!TYPE]).
 * Associe chaque identifiant brut à un type normalisé et un titre par défaut en français.
 * @type {Record<string, { type: string, defaultTitle: string }>}
 */
export const CALLOUT_CONFIGS = {
  NOTE: { type: 'note', defaultTitle: 'NOTE' },
  INFO: { type: 'info', defaultTitle: 'INFORMATION' },
  INFORMATION: { type: 'info', defaultTitle: 'INFORMATION' },
  TIP: { type: 'tip', defaultTitle: 'ASTUCE' },
  ASTUCE: { type: 'tip', defaultTitle: 'ASTUCE' },
  SUCCESS: { type: 'tip', defaultTitle: 'SUCCÈS' },
  IMPORTANT: { type: 'important', defaultTitle: 'IMPORTANT' },
  WARNING: { type: 'warning', defaultTitle: 'AVERTISSEMENT' },
  AVERTISSEMENT: { type: 'warning', defaultTitle: 'AVERTISSEMENT' },
  WARN: { type: 'warning', defaultTitle: 'AVERTISSEMENT' },
  CAUTION: { type: 'danger', defaultTitle: 'ATTENTION' },
  ATTENTION: { type: 'danger', defaultTitle: 'ATTENTION' },
  DANGER: { type: 'danger', defaultTitle: 'DANGER' },
  CRITIQUE: { type: 'danger', defaultTitle: 'CRITIQUE' },
};

/**
 * @typedef {object} CalloutInfo
 * @property {string} kind - Identifiant canonique du type (ex: 'note', 'tip', 'warning', 'danger', 'important')
 * @property {string} title - Titre affiché (par défaut ou personnalisé)
 * @property {string} rawType - Type brut en majuscules (ex: 'NOTE', 'AVERTISSEMENT')
 */

/**
 * Résout le type normalisé et le libellé d'un callout Markdown.
 * @param {string} rawType - Type brut (ex: 'NOTE', 'WARNING', 'ASTUCE')
 * @param {string} [rawTitle] - Titre personnalisé optionnel
 * @returns {CalloutInfo}
 */
export function resolveCallout(rawType, rawTitle) {
  const upper = (rawType || '').trim().toUpperCase();
  const conf = CALLOUT_CONFIGS[upper] || {
    type: 'note',
    defaultTitle: upper || 'NOTE',
  };
  const title = (rawTitle || '').trim() || conf.defaultTitle;
  return {
    kind: conf.type,
    title,
    rawType: upper,
  };
}

/**
 * Dictionnaire de correspondance des classes de badges inline (syntaxe [badge:type:texte]).
 * @type {Record<string, string>}
 */
export const BADGE_CONFIGS = {
  info: 'badge-info',
  note: 'badge-info',
  blue: 'badge-info',
  success: 'badge-success',
  tip: 'badge-success',
  astuce: 'badge-success',
  valide: 'badge-success',
  ok: 'badge-success',
  green: 'badge-success',
  warning: 'badge-warning',
  warn: 'badge-warning',
  avertissement: 'badge-warning',
  orange: 'badge-warning',
  yellow: 'badge-warning',
  danger: 'badge-danger',
  error: 'badge-danger',
  critical: 'badge-danger',
  critique: 'badge-danger',
  attention: 'badge-danger',
  caution: 'badge-danger',
  red: 'badge-danger',
  important: 'badge-important',
  purple: 'badge-important',
  violet: 'badge-important',
  neutral: 'badge-neutral',
  neutre: 'badge-neutral',
  gray: 'badge-neutral',
  grey: 'badge-neutral',
  default: 'badge-neutral',
};

/**
 * Résout la classe CSS d'un badge inline.
 * @param {string} rawType - Type brut (ex: 'info', 'success', 'danger')
 * @returns {string} Classe CSS (ex: 'badge-info', 'badge-success')
 */
export function resolveBadgeClass(rawType) {
  const key = (rawType || '').trim().toLowerCase();
  return BADGE_CONFIGS[key] || 'badge-neutral';
}

/**
 * Ensemble des variantes reconnues pour les cartouches de données/métriques.
 * @type {Set<string>}
 */
export const KNOWN_METRIC_VARIANTS = new Set([
  'success',
  'danger',
  'warning',
  'info',
  'important',
  'neutral',
  'vert',
  'rouge',
  'orange',
  'jaune',
  'bleu',
  'violet',
  'gris',
  'ok',
  'critique',
  'urgent',
  'warn',
  'error',
  'tip',
  'note',
]);

/**
 * Dictionnaire de correspondance des classes CSS pour les cartouches de données/métriques.
 * @type {Record<string, string>}
 */
export const METRIC_VARIANT_MAP = {
  success: 'metric-card-success',
  vert: 'metric-card-success',
  ok: 'metric-card-success',
  tip: 'metric-card-success',
  danger: 'metric-card-danger',
  rouge: 'metric-card-danger',
  critique: 'metric-card-danger',
  urgent: 'metric-card-danger',
  error: 'metric-card-danger',
  warning: 'metric-card-warning',
  warn: 'metric-card-warning',
  orange: 'metric-card-warning',
  jaune: 'metric-card-warning',
  info: 'metric-card-info',
  bleu: 'metric-card-info',
  note: 'metric-card-info',
  important: 'metric-card-important',
  violet: 'metric-card-important',
  purple: 'metric-card-important',
  neutral: 'metric-card-neutral',
  gris: 'metric-card-neutral',
  gray: 'metric-card-neutral',
  default: 'metric-card-default',
};

/**
 * @typedef {object} MetricTagInfo
 * @property {string} val - Valeur principale du chiffre ou pourcentage (ex: '98%', '1,2 M€')
 * @property {string} label - Libellé explicatif optionnel
 * @property {string} variant - Variante de style (ex: 'success', 'danger', 'info', 'warning', 'default')
 */

/**
 * Analyse et extrait la valeur, le libellé et la variante d'une balise chiffre/métrique.
 * Supporte les formats :
 * - [chiffre:valeur:libellé:variante]
 * - [chiffre:valeur:libellé]
 * - [chiffre:valeur:variante]
 * - [chiffre:valeur]
 * ainsi que les alias [metric:...], [stat:...] et [kpi:...].
 * Tolère la présence de deux-points (':') dans les libellés descriptifs lorsque la
 * troisième composante ne correspond pas à une variante de style prédéfinie.
 * @param {string} valStr - Valeur brute (ex: '98%', '1,2 M€', '+42%')
 * @param {string} [part2] - Deuxième composante (libellé ou variante)
 * @param {string} [part3] - Troisième composante (variante de style ou fragment de libellé)
 * @returns {MetricTagInfo}
 */
export function parseMetricTag(valStr, part2, part3) {
  const val = (valStr || '').trim();
  let label = (part2 || '').trim();
  let variant = (part3 || '').trim().toLowerCase();

  if (label && !variant && KNOWN_METRIC_VARIANTS.has(label.toLowerCase())) {
    variant = label.toLowerCase();
    label = '';
  } else if (part3 && !KNOWN_METRIC_VARIANTS.has(variant)) {
    label = `${label}:${part3}`.trim();
    variant = 'default';
  }

  return { val, label, variant: variant || 'default' };
}

/**
 * Résout la classe CSS d'une cartouche métrique.
 * @param {string} rawVariant - Variante brute (ex: 'success', 'danger')
 * @returns {string} Classe CSS de la carte
 */
export function resolveMetricClass(rawVariant) {
  const k = (rawVariant || '').trim().toLowerCase();
  return METRIC_VARIANT_MAP[k] || 'metric-card-default';
}

/**
 * Dictionnaire de correspondance des variantes de couleur pour les en-têtes de colonnes.
 * Reprend la typologie des badges/tags (info, success, warning, danger, important, neutral).
 * @type {Record<string, string>}
 */
export const COLUMN_COLOR_VARIANT_MAP = {
  info: 'info',
  note: 'info',
  blue: 'info',
  bleu: 'info',
  success: 'success',
  tip: 'success',
  astuce: 'success',
  valide: 'success',
  ok: 'success',
  green: 'success',
  vert: 'success',
  warning: 'warning',
  warn: 'warning',
  avertissement: 'warning',
  orange: 'warning',
  yellow: 'warning',
  jaune: 'warning',
  danger: 'danger',
  error: 'danger',
  critical: 'danger',
  critique: 'danger',
  attention: 'danger',
  caution: 'danger',
  red: 'danger',
  rouge: 'danger',
  urgent: 'danger',
  important: 'important',
  purple: 'important',
  violet: 'important',
  neutral: 'neutral',
  neutre: 'neutral',
  gray: 'neutral',
  grey: 'neutral',
  gris: 'neutral',
  default: 'neutral',
};

/**
 * Résout une couleur d'en-tête de colonne à partir d'une typologie de badge/tag ou d'un code hexadécimal.
 * @param {string} rawColor - Typologie brute (ex: 'info', 'warning') ou couleur hexadécimale
 * @returns {{ variant: string, hex: string }|null}
 */
export function resolveColumnColor(rawColor) {
  const cleaned = (rawColor || '').trim();
  if (!cleaned) return null;
  const key = cleaned.toLowerCase();
  if (COLUMN_COLOR_VARIANT_MAP[key]) {
    return { variant: COLUMN_COLOR_VARIANT_MAP[key], hex: '' };
  }
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(cleaned)) {
    return { variant: '', hex: cleaned };
  }
  return null;
}

/**
 * Analyse un ratio d'échelle typographique de colonne (ex: '0.8', '1,25', '80%').
 * @param {string} rawScale - Chaîne brute du ratio
 * @param {boolean} [requireDecimalOrPercent=false] - Exige un séparateur décimal ou '%' (évite les faux positifs sur titres courts)
 * @returns {number|null} Facteur multiplicatif positif ou null si invalide
 */
export function parseColumnFontScale(rawScale, requireDecimalOrPercent = false) {
  const cleaned = (rawScale || '').trim();
  if (!cleaned) return null;
  if (/^\d+(?:[.,]\d+)?%$/.test(cleaned)) {
    const pct = parseFloat(cleaned.slice(0, -1).replace(',', '.'));
    return Number.isFinite(pct) && pct > 0 && pct <= 1000 ? pct / 100 : null;
  }
  const regex = requireDecimalOrPercent ? /^\d+[.,]\d+$/ : /^\d+(?:[.,]\d+)?$/;
  if (regex.test(cleaned)) {
    const val = parseFloat(cleaned.replace(',', '.'));
    return Number.isFinite(val) && val > 0 && val <= 10 ? val : null;
  }
  return null;
}

/**
 * @typedef {object} ColumnTagParams
 * @property {number} ratio - Facteur de dimensionnement proportionnel (défaut : 1)
 * @property {string} title - Titre optionnel de la colonne (rendu en #### centré en haut)
 * @property {string} colorVariant - Variante de couleur résolue ('info', 'success', 'warning', 'danger', 'important', 'neutral' ou '')
 * @property {string} colorHex - Couleur hexadécimale directe éventuelle (si fournie)
 * @property {number} fontScale - Ratio d'échelle de la police interne (titre et corps, défaut : 1)
 */

/**
 * Analyse les paramètres d'une balise ouvrante de colonne :
 *   [colonne:taille relative:titre:couleur:ratio police]
 * Les 4 composantes après `colonne` sont optionnelles.
 * Tolère une taille vide (`[colonne::Titre:info:0.85]`), une taille omise (`[colonne:Titre:info:0.85]`),
 * ou la présence de deux-points dans le titre.
 *
 * @param {string} [rawArgs=''] - Chaîne brute située après `[colonne:` (sans les crochets)
 * @returns {ColumnTagParams}
 */
export function parseColumnTagParams(rawArgs = '') {
  const emptyResult = { ratio: 1, title: '', colorVariant: '', colorHex: '', fontScale: 1 };
  if (!rawArgs || !rawArgs.trim()) {
    return emptyResult;
  }

  const parts = rawArgs.split(':');
  const firstRaw = parts[0].trim();
  const isNumericRatio = /^\d+(?:[.,]\d+)?$/.test(firstRaw);

  let ratio = 1;
  let rest = [];

  if (firstRaw === '' || isNumericRatio) {
    if (isNumericRatio) {
      const parsed = parseFloat(firstRaw.replace(',', '.'));
      if (Number.isFinite(parsed) && parsed > 0) ratio = parsed;
    }
    rest = parts.slice(1);
  } else {
    rest = parts;
  }

  if (rest.length === 0) {
    return { ratio, title: '', colorVariant: '', colorHex: '', fontScale: 1 };
  }

  if (rest.length === 1) {
    return { ratio, title: rest[0].trim(), colorVariant: '', colorHex: '', fontScale: 1 };
  }

  if (rest.length === 2) {
    const secondRaw = rest[1].trim();
    if (secondRaw === '') {
      return { ratio, title: rest[0].trim(), colorVariant: '', colorHex: '', fontScale: 1 };
    }
    const resolvedColor = resolveColumnColor(secondRaw);
    if (resolvedColor) {
      return {
        ratio,
        title: rest[0].trim(),
        colorVariant: resolvedColor.variant,
        colorHex: resolvedColor.hex,
        fontScale: 1,
      };
    }
    const parsedScale = parseColumnFontScale(secondRaw, true);
    if (parsedScale !== null) {
      return {
        ratio,
        title: rest[0].trim(),
        colorVariant: '',
        colorHex: '',
        fontScale: parsedScale,
      };
    }
    return { ratio, title: rest.join(':').trim(), colorVariant: '', colorHex: '', fontScale: 1 };
  }

  const lastRaw = rest[rest.length - 1].trim();
  const lastScale = parseColumnFontScale(lastRaw, false);

  if (lastRaw === '' || lastScale !== null) {
    const fontScale = lastScale !== null ? lastScale : 1;
    const beforeScale = rest.slice(0, -1);
    const colorRaw = beforeScale[beforeScale.length - 1].trim();

    if (colorRaw === '') {
      return {
        ratio,
        title: beforeScale.slice(0, -1).join(':').trim(),
        colorVariant: '',
        colorHex: '',
        fontScale,
      };
    }

    const resolvedColor = resolveColumnColor(colorRaw);
    if (resolvedColor) {
      return {
        ratio,
        title: beforeScale.slice(0, -1).join(':').trim(),
        colorVariant: resolvedColor.variant,
        colorHex: resolvedColor.hex,
        fontScale,
      };
    }

    return {
      ratio,
      title: beforeScale.join(':').trim(),
      colorVariant: '',
      colorHex: '',
      fontScale,
    };
  }

  const resolvedLastColor = resolveColumnColor(lastRaw);
  if (resolvedLastColor) {
    return {
      ratio,
      title: rest.slice(0, -1).join(':').trim(),
      colorVariant: resolvedLastColor.variant,
      colorHex: resolvedLastColor.hex,
      fontScale: 1,
    };
  }

  return { ratio, title: rest.join(':').trim(), colorVariant: '', colorHex: '', fontScale: 1 };
}

