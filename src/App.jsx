import React, { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const BRAND_COLORS = {
  blue: "#3B539E",
  red: "#BF0038",
  green: "#2C9F69",
  darkBlue: "#283869",
  lightBlue: "#36A7E9",
  yellow: "#C8DC30",
  lightGray: "#E2E8F0",
  stabileGray: "#AAB6C8",
  titleColor: "#4E64A8",
};

const PHASE_COLORS = {
  Awareness: BRAND_COLORS.blue,
  Consideration: BRAND_COLORS.blue,
  Conversion: BRAND_COLORS.blue,
  Tutte: BRAND_COLORS.darkBlue,
};

const OUTLOOK_COLORS = {
  POSITIVO: BRAND_COLORS.green,
  STABILE: BRAND_COLORS.stabileGray,
  NEGATIVO: BRAND_COLORS.red,
};

const STATUS_COLORS = {
  CRITICO: "#BF0038",
  DEBOLE: "#FF8F7A",
  DISCRETO: "#AAB6C8",
  SOLIDO: "#6F86A8",
  "MOLTO FORTE": "#3B539E",
};

const SCORE_BANDS = [
  { min: 0, max: 39, label: "Critico", color: "#BF0038" },
  { min: 40, max: 59, label: "Debole", color: "#FF8F7A" },
  { min: 60, max: 74, label: "Discreto", color: "#AAB6C8" },
  { min: 75, max: 89, label: "Solido", color: "#6F86A8" },
  { min: 90, max: 100, label: "Molto forte", color: "#3B539E" },
];

const phaseOptions = ["Tutte", "Awareness", "Consideration", "Conversion"];
const outlookOptions = ["Tutti", "POSITIVO", "STABILE", "NEGATIVO"];
const INVERTED_YOY_KPI_IDS = new Set(["3.2","3.5"]);

const MIN_SELECTABLE_QUARTER = "Q1 2026";
const QUARTER_VALUE_HEADER_RE = /^Q([1-4])\s+(20\d{2})$/i;
const QUARTER_FIELD_HEADER_RE = /^(YOY|BENCH|OUTLOOK)\s+Q([1-4])(\d{2})$/i;

function formatQuarterKey(quarter, year) {
  return `Q${quarter} ${year}`;
}

function parseQuarterValueHeader(header) {
  const match = normalizeText(header).match(QUARTER_VALUE_HEADER_RE);
  if (!match) return null;
  const [, quarter, year] = match;
  return formatQuarterKey(quarter, year);
}

function parseQuarterFieldHeader(header) {
  const match = normalizeText(header).match(QUARTER_FIELD_HEADER_RE);
  if (!match) return null;
  const [, field, quarter, shortYear] = match;
  return { field: field.toUpperCase(), quarterKey: formatQuarterKey(quarter, `20${shortYear}`) };
}

function compareQuarterKeys(a, b) {
  const ma = normalizeText(a).match(/^Q([1-4])\s+(20\d{2})$/i);
  const mb = normalizeText(b).match(/^Q([1-4])\s+(20\d{2})$/i);
  if (!ma || !mb) return normalizeText(a).localeCompare(normalizeText(b), "it-IT");
  const [, qa, ya] = ma;
  const [, qb, yb] = mb;
  const byYear = Number(ya) - Number(yb);
  return byYear !== 0 ? byYear : Number(qa) - Number(qb);
}

function getQuarterDisplayLabel(qKey) {
  return qKey ? `${qKey} Consuntivo` : "Periodo non disponibile";
}

function normalizeParsedCellValue(rawValue) {
  if (rawValue === "" || rawValue === undefined || rawValue === null || rawValue === "null" || rawValue === "-") {
    return null;
  }
  const numberValue = toNumberOrNull(rawValue);
  return numberValue !== null ? numberValue : String(rawValue).trim();
}

function isMetricDataRow(row) {
  return /^([0-9]+\.[0-9]+)/.test(normalizeText(row?.metric));
}

function hasQuarterMetricValue(rows, qKey) {
  return rows.some((row) => {
    if (!isMetricDataRow(row)) return false;
    const value = row?.quarters?.[qKey]?.value;
    return value !== null && value !== undefined && normalizeText(value) !== "";
  });
}

function isQuarterSelectable(rows, qKey, minQuarter = MIN_SELECTABLE_QUARTER) {
  if (!qKey) return false;
  if (compareQuarterKeys(qKey, minQuarter) < 0) return false;
  return hasQuarterMetricValue(rows, qKey);
}

function buildMetricHistory(row) {
  const allQuarterKeys = [...new Set([...Object.keys(row.quarterValues || {}), ...Object.keys(row.quarters || {})])]
    .sort(compareQuarterKeys);

  return allQuarterKeys
    .map((quarterKey) => {
      const match = normalizeText(quarterKey).match(/^Q([1-4])\s+(20\d{2})$/i);
      const value = row.quarterValues?.[quarterKey] ?? row.quarters?.[quarterKey]?.value ?? null;
      if (!match || value === null || value === undefined) return null;
      const [, quarter, year] = match;
      return { q: `Q${quarter} ${String(year).slice(-2)}`, v: value };
    })
    .filter(Boolean);
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeUpper(value) {
  return normalizeText(value).toUpperCase();
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    return Number.isNaN(value) ? null : value;
  }

  const cleaned = String(value).replace(",", ".").trim();
  const parsed = Number(cleaned);

  return Number.isNaN(parsed) ? null : parsed;
}

function getScoreBand(score) {
  return (
    SCORE_BANDS.find((band) => score >= band.min && score <= band.max) ||
    SCORE_BANDS[0]
  );
}

function getScoreLabelFromScore(score) {
  return getScoreBand(score).label;
}

function getStatusColor(status, score) {
  const normalized = normalizeUpper(status);
  return STATUS_COLORS[normalized] || getScoreBand(score).color;
}

function getQuarterData(row, qKey) {
  return row?.quarters?.[qKey] || { value: null, yoy: null, bench: null, outlook: null };
}

function getQuarterValue(row, qKey) {
  return getQuarterData(row, qKey).value;
}

function getQuarterYoY(row, qKey) {
  return getQuarterData(row, qKey).yoy;
}

function getQuarterBench(row, qKey) {
  return getQuarterData(row, qKey).bench;
}

function getQuarterOutlook(row, qKey) {
  return getQuarterData(row, qKey).outlook;
}

function getSummaryScore(row, qKey) {
  const quarterData = getQuarterData(row, qKey);
  const scoreFromQuarterColumn = toNumberOrNull(quarterData.value);
  if (scoreFromQuarterColumn !== null) return scoreFromQuarterColumn;
  const scoreFromOutlookColumn = toNumberOrNull(quarterData.outlook);
  if (scoreFromOutlookColumn !== null) return scoreFromOutlookColumn;
  return null;
}

function normalizeInsightKey(value) {
  const key = normalizeUpper(value);

  if (key.includes("OVERALL")) return "overall";
  if (key.includes("RISULTATO")) return "overall";
  if (key.includes("AWARENESS")) return "Awareness";
  if (key.includes("CONSIDERATION")) return "Consideration";
  if (key.includes("CONVERSION")) return "Conversion";

  return normalizeText(value);
}

function parseInsightText(rawText) {
  const text = normalizeText(rawText)
    .replace(/\u000b/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  if (!text) {
    return {
      title: "",
      bullets: [],
    };
  }

  const titleMatch = text.match(/TITLE:\s*([\s\S]*?)(?=\n\s*CORPO:|CORPO:|$)/i);
  const bodyMatch = text.match(/CORPO:\s*([\s\S]*)/i);

  const title = titleMatch ? normalizeText(titleMatch[1]) : "";
  const body = bodyMatch ? normalizeText(bodyMatch[1]) : text;

  const paragraphBullets = body
    .split(/\n+/)
    .map((item) => normalizeText(item))
    .filter(Boolean);

  const bullets =
    paragraphBullets.length > 1
      ? paragraphBullets
      : body
          .split(/(?<=[.!?])\s+(?=[A-ZÀ-Ú])/)
          .map((item) => normalizeText(item))
          .filter(Boolean);

  return {
    title,
    bullets,
  };
}

function isRateMetric(metric) {
  if (!metric || !metric.metric) return false;

  return (
    /(\bSHARE\b|\bCTR\b|%|\bER\b|\bREGOLARI\b)/i.test(metric.metric) &&
    !/(\bCPA\b|\bCPFS\b)/i.test(metric.metric)
  );
}

function fmtNumber(value) {
  let parsed = value;

  if (
    parsed === null ||
    parsed === undefined ||
    Number.isNaN(parsed) ||
    typeof parsed === "string"
  ) {
    if (parsed && !Number.isNaN(Number(parsed))) {
      parsed = Number(parsed);
    } else {
      return parsed || "n.d.";
    }
  }

  const abs = Math.abs(parsed);

  if (abs >= 1_000_000) {
    return `${(parsed / 1_000_000).toLocaleString("it-IT", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}M`;
  }

  if (abs >= 1_000) {
    return `${(parsed / 1_000).toLocaleString("it-IT", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}K`;
  }

  return parsed.toLocaleString("it-IT", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function fmtValue(metric, value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "n.d.";
  }

  if (isRateMetric(metric)) {
    const num = typeof value === "string" ? parseFloat(value) : value;

    return `${(num * 100).toLocaleString("it-IT", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}%`;
  }

  return fmtNumber(value);
}

function fmtPct(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "n.d.";
  }

  const num = typeof value === "string" ? parseFloat(value) : value;
  const sign = num > 0 ? "+" : "";

  return `${sign}${(num * 100).toLocaleString("it-IT", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function hexToRgba(hex, alpha = 1) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function isInvertedYoYKpi(metric) {
  return INVERTED_YOY_KPI_IDS.has(metric?.id);
}

function yoyColor(metric) {
  if (
    metric?.yoy === 0 ||
    metric?.yoy === null ||
    metric?.yoy === undefined
  ) {
    return "#E2B917";
  }

  const num = typeof metric.yoy === "string" ? parseFloat(metric.yoy) : metric.yoy;
  const isPositivePerformance = isInvertedYoYKpi(metric) ? num < 0 : num > 0;

  return isPositivePerformance ? BRAND_COLORS.green : BRAND_COLORS.red;
}

function outlookStyle(outlook) {
  const color = OUTLOOK_COLORS[outlook] || BRAND_COLORS.darkBlue;

  return {
    color,
    backgroundColor: hexToRgba(color, 0.12),
    boxShadow: `inset 0 0 0 1px ${hexToRgba(color, 0.3)}`,
  };
}

function Card({ children, className = "", style = {}, ...props }) {
  return (
    <div
      style={style}
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

function Badge({ children, className = "", style = {} }) {
  return (
    <span
      style={style}
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${className}`}
    >
      {children}
    </span>
  );
}

function Icon({ name, className = "", style = {} }) {
  const glyphs = {
    alert: "!",
    trend: "↗",
    insight: "i",
  };

  return (
    <span
      aria-hidden="true"
      style={style}
      className={`inline-flex shrink-0 items-center justify-center rounded-full text-center font-bold leading-none ${className}`}
    >
      {glyphs[name] || "•"}
    </span>
  );
}

function MetricTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lg">
      <div className="font-semibold text-slate-900">{label}</div>

      <div className="text-slate-600">
        Valore completo: {payload[0].value?.toLocaleString("it-IT")}
      </div>
    </div>
  );
}

function RankingTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const item = payload[0]?.payload;

  if (!item) return null;

  const outlookColor = OUTLOOK_COLORS[item.outlook] || BRAND_COLORS.darkBlue;

  return (
    <div className="max-w-xs rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lg">
      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
        Metrica {item.id}
      </div>

      <div className="mt-1 font-black leading-snug text-slate-900">
        {item.metric}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold">
        <div className="rounded-lg bg-slate-50 p-2">
          <div className="text-[9px] uppercase text-slate-400">YoY</div>
          <div style={{ color: yoyColor(item) }}>{fmtPct(item.yoy)}</div>
        </div>

        <div className="rounded-lg bg-slate-50 p-2">
          <div className="text-[9px] uppercase text-slate-400">Outlook</div>
          <div
            className="mt-1 inline-flex rounded px-2 py-0.5 text-[10px] font-black text-white"
            style={{ backgroundColor: outlookColor }}
          >
            {item.outlook}
          </div>
        </div>
      </div>
    </div>
  );
}

function InsightBox({ title = "Insight", insight }) {
  if (!insight || (!insight.title && !insight.bullets?.length)) {
    return (
      <Card className="h-full bg-slate-50/80 p-4">
        <div className="flex items-center gap-2">
          <Icon
            name="insight"
            className="h-5 w-5 text-white"
            style={{ backgroundColor: BRAND_COLORS.blue }}
          />

          <h3
            className="text-xs font-black uppercase tracking-wide"
            style={{ color: BRAND_COLORS.blue }}
          >
            {title}
          </h3>
        </div>

        <p className="mt-4 text-xs font-medium leading-relaxed text-slate-400">
          Nessun insight disponibile per il periodo selezionato.
        </p>
      </Card>
    );
  }

  return (
    <Card className="h-full bg-slate-50/80 p-4">
      <div className="flex items-center gap-2">
        <Icon
          name="insight"
          className="h-5 w-5 text-white"
          style={{ backgroundColor: BRAND_COLORS.blue }}
        />

        <h3
          className="text-xs font-black uppercase tracking-wide"
          style={{ color: BRAND_COLORS.blue }}
        >
          {title}
        </h3>
      </div>

      {insight.title && (
        <p
          className="mt-4 text-xs font-black leading-relaxed md:text-sm"
          style={{ color: BRAND_COLORS.blue }}
        >
          {insight.title}
        </p>
      )}

      {insight.bullets?.length > 0 && (
        <ul className="mt-4 space-y-2 pl-4 text-xs font-medium leading-relaxed text-slate-600 md:text-[13px]">
          {insight.bullets.map((bullet, index) => (
            <li key={`${bullet}-${index}`} className="list-disc">
              {bullet}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ScoreLegend({ score }) {
  return (
    <div className="space-y-1 text-xs font-semibold text-slate-600">
      {SCORE_BANDS.map((band) => {
        const active = score >= band.min && score <= band.max;

        return (
          <div key={band.label} className="flex items-center gap-2 whitespace-nowrap">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: band.color }}
            />

            <span className={active ? "text-slate-900 font-bold underline" : ""}>
              {band.min}–{band.max} = {band.label}
            </span>

            {active && (
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill={BRAND_COLORS.blue}
                className="ml-1 inline-block align-middle animate-pulse"
              >
                <path d="M20 4L4 12l16 8Z" />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ScoreGauge({ title, score, statusLabel, compact = false }) {
  const safeScore = toNumberOrNull(score) ?? 0;
  const band = getScoreBand(safeScore);
  const label = statusLabel || band.label;
  const statusColor = getStatusColor(label, safeScore);

  const sizeClass = compact ? "h-44 w-44" : "h-64 w-64";
  const numberClass = compact ? "text-6xl" : "text-7xl";

  return (
    <div className="flex flex-col items-center justify-center">
      {title && (
        <div className="mb-3 text-sm font-bold tracking-wide text-slate-700">
          {title}
        </div>
      )}

      <div className={`relative ${sizeClass}`}>
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle
            cx="60"
            cy="60"
            r="48"
            fill="none"
            stroke="#E2E8F0"
            strokeWidth="12"
          />

          <circle
            cx="60"
            cy="60"
            r="48"
            fill="none"
            stroke={statusColor}
            strokeWidth="12"
            strokeLinecap="round"
            pathLength="100"
            strokeDasharray={`${safeScore} 100`}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`${numberClass} font-black tracking-tight`}
            style={{ color: statusColor }}
          >
            {safeScore}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs font-bold">
        <span className="text-slate-400">STATUS:</span>

        <span
          className="rounded-full px-3 py-1 text-[10px] font-black text-white tracking-wider shadow-sm"
          style={{ backgroundColor: statusColor }}
        >
          {String(label).toUpperCase()}
        </span>
      </div>
    </div>
  );
}

function getPhaseShortLabel(phase) {
  const map = {
    Awareness: "AWAR.",
    Consideration: "CONSID.",
    Conversion: "CONV.",
  };

  return map[phase] || phase;
}

function PhaseScoreBars({ scores }) {
  return (
    <div className="h-full rounded-3xl bg-white p-6 shadow-lg ring-1 ring-slate-100">
      <div className="mb-5 text-sm font-bold tracking-wide text-slate-700">
        OKR SCORE PER FASE
      </div>

      <div className="grid h-72 grid-cols-3 items-end gap-3 border-b border-slate-200 px-2 pb-8">
        {scores.map((item) => {
          const safeScore = toNumberOrNull(item.score) ?? 0;
          const band = getScoreBand(safeScore);

          return (
            <div
              key={item.phase}
              className="relative flex h-full min-w-0 flex-col items-center justify-end"
            >
              <div className="relative flex h-56 w-14 items-end overflow-hidden rounded-t-xl bg-slate-50 ring-1 ring-slate-200 sm:w-16">
                <div
                  className="absolute bottom-0 left-0 right-0 flex items-center justify-center text-base font-black text-white shadow-inner"
                  style={{
                    height: `${safeScore}%`,
                    backgroundColor: band.color,
                  }}
                >
                  <span className="mb-2">{safeScore}</span>
                </div>
              </div>

              <div className="mt-3 whitespace-nowrap text-center text-[10px] font-black uppercase tracking-tight text-slate-500">
                {getPhaseShortLabel(item.phase)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricCard({ metric, selected, onSelect, qKey }) {
  const fullBench = metric.bench?.toLocaleString("it-IT") || "n.d.";
  const fullVal = metric.val?.toLocaleString("it-IT") || "n.d.";

  return (
    <button
      onClick={() => onSelect(metric.id)}
      className={`relative min-h-[190px] w-full overflow-hidden rounded-xl bg-white p-4 text-left shadow-md ring-1 transition hover:-translate-y-0.5 hover:shadow-xl ${
        selected ? "ring-2" : "ring-slate-100"
      }`}
      style={{
        boxShadow: selected ? `0 0 0 2px ${BRAND_COLORS.blue}` : undefined,
      }}
    >
      <div
        className="min-h-[58px] break-words pr-1 text-[11px] font-black uppercase leading-5 text-slate-700"
        style={{
          borderBottom: `1px dashed ${hexToRgba(BRAND_COLORS.blue, 0.2)}`,
          paddingBottom: "6px",
        }}
      >
        <span className="mr-1 font-black text-slate-400">{metric.id}</span>
        {metric.metric}
      </div>

      <div className="mt-3 text-[10px] font-bold text-slate-400">
        TARGET {qKey}:{" "}
        <span
          className="font-extrabold text-slate-600"
          title={`Valore esatto cloud: ${fullBench}`}
        >
          {fmtValue(metric, metric.bench)}
        </span>
      </div>

      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
        <span
          className="max-w-full break-words text-2xl font-black text-slate-800"
          title={`Valore esatto cloud: ${fullVal}`}
        >
          {fmtValue(metric, metric.val)}
        </span>

        <span
          className="rounded-md px-1.5 py-0.5 text-[10px] font-black"
          style={{
            color: yoyColor(metric),
            backgroundColor: hexToRgba(yoyColor(metric), 0.1),
          }}
        >
          {fmtPct(metric.yoy)} YoY
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold uppercase text-slate-400">
        <span>OUTLOOK:</span>

        <span
          className="rounded px-2 py-1 font-black tracking-wider text-white"
          style={{ backgroundColor: OUTLOOK_COLORS[metric.outlook] }}
        >
          {metric.outlook}
        </span>
      </div>
    </button>
  );
}

function PdfMetricCard({ metric, qKey }) {
  return (
    <div className="pdf-metric-card rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-100">
      <div
        className="pdf-metric-title text-[9px] font-black uppercase leading-4 text-slate-700"
        style={{
          borderBottom: `1px dashed ${hexToRgba(BRAND_COLORS.blue, 0.2)}`,
          paddingBottom: "5px",
        }}
      >
        <span className="mr-1 font-black text-slate-400">{metric.id}</span>
        {metric.metric}
      </div>

      <div className="mt-2 text-[9px] font-bold text-slate-400">
        TARGET {qKey}:{" "}
        <span className="font-extrabold text-slate-600">
          {fmtValue(metric, metric.bench)}
        </span>
      </div>

      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="text-xl font-black text-slate-800">
          {fmtValue(metric, metric.val)}
        </span>

        <span
          className="rounded-md px-1.5 py-0.5 text-[9px] font-black"
          style={{
            color: yoyColor(metric),
            backgroundColor: hexToRgba(yoyColor(metric), 0.1),
          }}
        >
          {fmtPct(metric.yoy)} YoY
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-[9px] font-bold uppercase text-slate-400">
        <span>OUTLOOK:</span>

        <span
          className="rounded px-2 py-1 font-black tracking-wider text-white"
          style={{ backgroundColor: OUTLOOK_COLORS[metric.outlook] }}
        >
          {metric.outlook}
        </span>
      </div>
    </div>
  );
}

function OverviewSection({ overall, overallStatus, phaseScores, insight }) {
  return (
    <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_390px]">
      <div className="grid grid-cols-1 gap-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100 lg:grid-cols-[1.15fr_0.85fr] lg:p-8">
        <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[240px_1fr]">
          <ScoreGauge
            title="OKR SCORE GLOBAL"
            score={overall}
            statusLabel={overallStatus}
          />

          <div className="flex justify-center rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
            <ScoreLegend score={overall} />
          </div>
        </div>

        <PhaseScoreBars scores={phaseScores} />
      </div>

      <InsightBox title="Insight Overall" insight={insight} />
    </section>
  );
}

function PhaseSection({
  phaseName,
  score,
  metrics,
  selectedId,
  onSelect,
  qKey,
  insight,
}) {
  return (
    <section className="space-y-5 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100 md:p-7">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2
            className="text-2xl font-black uppercase tracking-tight text-slate-800"
            style={{
              borderLeft: `5px solid ${PHASE_COLORS[phaseName]}`,
              paddingLeft: "12px",
            }}
          >
            {phaseName}
          </h2>

          <p className="text-sm text-slate-400">
            Score di fase e KPI card estratte.
          </p>
        </div>

        <Badge className="bg-slate-50 text-slate-700 ring-slate-200">
          {metrics.length} metriche visibili
        </Badge>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[220px_minmax(0,1fr)_360px] 2xl:grid-cols-[240px_minmax(0,1fr)_390px]">
        <div className="self-start rounded-2xl bg-white p-4 ring-1 ring-slate-100">
          <ScoreGauge
            title={`SCORE ${phaseName.toUpperCase()}`}
            score={score}
            compact
          />
        </div>

        <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-5">
          {metrics.length ? (
            metrics.map((metric) => (
              <MetricCard
                key={metric.id}
                metric={metric}
                selected={metric.id === selectedId}
                onSelect={onSelect}
                qKey={qKey}
              />
            ))
          ) : (
            <div className="col-span-full rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">
              Nessuna metrica disponibile per i filtri attivi.
            </div>
          )}
        </div>

        <div className="min-w-0 self-start">
          <InsightBox title={`Insight ${phaseName}`} insight={insight} />
        </div>
      </div>
    </section>
  );
}

function transformSheetsData(values) {
  if (!values || values.length < 2) return [];

  const rawHeaders = values[0].map((header) => String(header).trim());
  const baseHeaderMap = {
    "Fase (Nome)": "phase",
    "Fase (Numero)": "phaseNum",
    "Key Metric": "metric",
    "Reason Why": "reason",
    "Sorgente dati": "source",
    "Note sulla rilevazione": "note",
    "Target di fine anno": "yearTarget",
  };

  return values.slice(1).map((row) => {
    const obj = { phase: null, phaseNum: null, metric: null, reason: null, source: null, note: null, yearTarget: null, quarterValues: {}, quarters: {} };

    rawHeaders.forEach((header, index) => {
      const normalizedValue = normalizeParsedCellValue(row[index]);
      const baseField = baseHeaderMap[header];
      if (baseField) {
        obj[baseField] = normalizedValue;
        return;
      }

      const quarterValueKey = parseQuarterValueHeader(header);
      if (quarterValueKey) {
        obj.quarterValues[quarterValueKey] = normalizedValue;
        obj.quarters[quarterValueKey] ||= { value: null, yoy: null, bench: null, outlook: null };
        obj.quarters[quarterValueKey].value = normalizedValue;
        return;
      }

      const parsedField = parseQuarterFieldHeader(header);
      if (!parsedField) return;
      const { field, quarterKey } = parsedField;
      obj.quarters[quarterKey] ||= { value: null, yoy: null, bench: null, outlook: null };
      if (field === "YOY") obj.quarters[quarterKey].yoy = normalizedValue;
      if (field === "BENCH") obj.quarters[quarterKey].bench = normalizedValue;
      if (field === "OUTLOOK") obj.quarters[quarterKey].outlook = normalizedValue;
    });

    return obj;
  });
}

function transformInsightsData(values) {
  if (!values || values.length < 2) return {};

  const headers = values[0].map((header) => String(header).trim());
  const phaseIndex = headers.findIndex((header) => normalizeUpper(header) === "FASE");
  if (phaseIndex === -1) return {};

  const quarterColumns = headers
    .map((header, index) => {
      const parsedField = parseQuarterFieldHeader(header);
      if (!parsedField || parsedField.field !== "OUTLOOK") return null;
      return { index, quarterKey: parsedField.quarterKey };
    })
    .filter(Boolean);

  const insightsByQuarter = {};

  values.slice(1).forEach((row) => {
    const key = normalizeInsightKey(row[phaseIndex]);
    if (!key) return;
    quarterColumns.forEach(({ index, quarterKey }) => {
      insightsByQuarter[quarterKey] ||= {};
      insightsByQuarter[quarterKey][key] = parseInsightText(row[index]);
    });
  });

  return insightsByQuarter;
}

function PdfExportArea({ qKey, dataView, phaseScoresOnly, insights }) {
  const phasePdfData = ["Awareness", "Consideration", "Conversion"].map(
    (phaseName) => {
      const phaseScore = phaseScoresOnly.find((item) => item.phase === phaseName);
      const metrics = dataView.metrics.filter((metric) => metric.phase === phaseName);

      return {
        phaseName,
        score: phaseScore?.score ?? 0,
        metrics,
        insight: insights[phaseName],
      };
    }
  );

  return (
    <div id="pdf-export-area">
      <style>
        {`
          #pdf-export-area {
            display: none;
            background: #F7F8FA;
            color: #0f172a;
          }

          @media print {
            @page {
              size: 297mm 167mm;
              margin: 0;
            }

            html,
            body {
              width: 297mm;
              margin: 0 !important;
              padding: 0 !important;
              background: #F7F8FA !important;
              overflow: hidden !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            body * {
              visibility: hidden !important;
            }

            #pdf-export-area,
            #pdf-export-area * {
              visibility: visible !important;
            }

            #pdf-export-area {
              display: block !important;
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 297mm !important;
              background: #F7F8FA !important;
              color: #0f172a !important;
              z-index: 999999 !important;
            }

            #report-area > .max-w-7xl {
              display: none !important;
            }

            #pdf-export-area .pdf-page {
              width: 297mm !important;
              height: 167mm !important;
              overflow: hidden !important;
              background: #F7F8FA !important;
              padding: 6mm !important;
              box-sizing: border-box !important;
              page-break-after: always !important;
              break-after: page !important;
            }

            #pdf-export-area .pdf-page:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }
          }

          #pdf-export-area .pdf-page-inner {
            height: 100%;
            display: flex;
            flex-direction: column;
            gap: 18px;
          }

          #pdf-export-area .pdf-overall-grid {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 340px;
            gap: 20px;
            min-height: 0;
          }

          #pdf-export-area .pdf-overall-card {
            display: grid;
            grid-template-columns: 1.15fr 0.85fr;
            gap: 22px;
            align-items: center;
            border-radius: 24px;
            background: white;
            padding: 22px;
            box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
            border: 1px solid #e2e8f0;
          }

          #pdf-export-area .pdf-phase-section {
            height: 155mm;
            overflow: hidden;
            border-radius: 24px;
            background: white;
            padding: 18px;
            box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
            border: 1px solid #e2e8f0;
          }

          #pdf-export-area .pdf-phase-grid {
            display: grid;
            grid-template-columns: 180px minmax(0, 1fr) 340px;
            gap: 16px;
            align-items: start;
          }

          #pdf-export-area .pdf-metrics-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          #pdf-export-area .pdf-metric-card {
            min-height: 132px;
          }

          #pdf-export-area .pdf-metric-title {
            min-height: 38px;
            max-height: 42px;
            overflow: hidden;
          }

          #pdf-export-area .pdf-insight-wrapper {
            max-height: 135mm;
            overflow: hidden;
          }

          #pdf-export-area .pdf-insight-wrapper ul {
            font-size: 10.5px;
            line-height: 1.42;
          }

          #pdf-export-area .pdf-insight-wrapper p {
            font-size: 11.5px;
            line-height: 1.42;
          }

          #pdf-export-area .pdf-insight-wrapper .rounded-2xl {
            padding: 14px;
          }

          #pdf-export-area .pdf-score-compact .h-44 {
            height: 150px;
            width: 150px;
          }

          #pdf-export-area .pdf-score-compact .text-6xl {
            font-size: 48px;
          }

          #pdf-export-area .pdf-score-compact {
            transform: scale(0.92);
            transform-origin: top center;
          }
        `}
      </style>

      <div className="pdf-page">
        <div className="pdf-page-inner">
          <header className="bg-white p-6 rounded-3xl shadow-sm ring-1 ring-slate-100 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <img src="/logo.png" alt="Telethon" className="h-12 w-auto" />

              <div className="h-10 w-px bg-slate-200" />

              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  OKR Executive Dashboard
                </div>

                <h1
                  className="text-3xl font-black tracking-tight"
                  style={{ color: BRAND_COLORS.titleColor }}
                >
                  Performance OKR Fundraising Funnel
                </h1>

                <p className="mt-1 text-xs font-semibold text-slate-400">
                  Dashboard di valutazione delle Key Metrics di OKR.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700">
              {getQuarterDisplayLabel(qKey)}
            </div>
          </header>

          <div className="pdf-overall-grid">
            <div className="pdf-overall-card">
              <div className="grid grid-cols-[220px_1fr] items-center gap-5">
                <ScoreGauge
                  title="OKR SCORE GLOBAL"
                  score={dataView.overall}
                  statusLabel={dataView.overallStatus}
                  compact
                />

                <div className="flex justify-center rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                  <ScoreLegend score={dataView.overall} />
                </div>
              </div>

              <PhaseScoreBars scores={phaseScoresOnly} />
            </div>

            <InsightBox title="Insight Overall" insight={insights.overall} />
          </div>
        </div>
      </div>

      {phasePdfData.map((phaseItem) => (
        <div key={phaseItem.phaseName} className="pdf-page">
          <section className="pdf-phase-section">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h2
                  className="text-2xl font-black uppercase tracking-tight text-slate-800"
                  style={{
                    borderLeft: `5px solid ${PHASE_COLORS[phaseItem.phaseName]}`,
                    paddingLeft: "12px",
                  }}
                >
                  {phaseItem.phaseName}
                </h2>

                <p className="text-sm text-slate-400">
                  Score di fase e KPI card estratte.
                </p>
              </div>

              <Badge className="bg-slate-50 text-slate-700 ring-slate-200">
                {phaseItem.metrics.length} metriche visibili
              </Badge>
            </div>

            <div className="pdf-phase-grid">
              <div className="pdf-score-compact self-start rounded-2xl bg-white p-3 ring-1 ring-slate-100">
                <ScoreGauge
                  title={`SCORE ${phaseItem.phaseName.toUpperCase()}`}
                  score={phaseItem.score}
                  compact
                />
              </div>

              <div className="pdf-metrics-grid">
                {phaseItem.metrics.map((metric) => (
                  <PdfMetricCard key={metric.id} metric={metric} qKey={qKey} />
                ))}
              </div>

              <div className="pdf-insight-wrapper">
                <InsightBox
                  title={`Insight ${phaseItem.phaseName}`}
                  insight={phaseItem.insight}
                />
              </div>
            </div>
          </section>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const SPREADSHEET_ID =
    import.meta.env.VITE_GOOGLE_SHEET_ID || "1cv6c2VoUDK-GMiC1tMDKKVHzLUtllwbCY-LyRkePM0M";
  const API_KEY =
    import.meta.env.VITE_GOOGLE_SHEETS_API_KEY || "AIzaSyDuhqbqviJZS6urlY5i8YqPzB7InJxAoB8";
  const SHEET_RANGES = ["DB", "Insights"];

  const [rawRows, setRawRows] = useState([]);
  const [insightValues, setInsightValues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  const [qKey, setQKey] = useState("");
  const [phase, setPhase] = useState("Tutte");
  const [outlookFilter, setOutlookFilter] = useState("Tutti");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("1.1");

  useEffect(() => {
    const controller = new AbortController();
    const queryRanges = SHEET_RANGES.map((range) => `ranges=${encodeURIComponent(range)}`).join("&");
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchGet?${queryRanges}&key=${API_KEY}`;

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Errore Google Sheets: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const valueRanges = data.valueRanges || [];
        const dbValues = valueRanges.find((item) => normalizeUpper(item.range).startsWith("DB!"))?.values || [];
        const insightsSheetValues = valueRanges.find((item) => normalizeUpper(item.range).includes("INSIGHTS!"))?.values || [];
        setRawRows(transformSheetsData(dbValues));
        setInsightValues(insightsSheetValues);
        setLoading(false);
      })
      .catch((error) => {
        if (error.name === "AbortError") return;
        console.error(error);
        setFetchError(error.message || "Errore durante il caricamento dei dati.");
        setLoading(false);
      });

    return () => controller.abort();
  }, [API_KEY, SPREADSHEET_ID]);

  const insightsByQuarter = useMemo(() => transformInsightsData(insightValues), [insightValues]);

  const availableQuarters = useMemo(() => {
    const quarterSet = new Set();
    rawRows.forEach((row) => {
      Object.keys(row.quarters || {}).forEach((quarterKey) => quarterSet.add(quarterKey));
    });
    Object.keys(insightsByQuarter || {}).forEach((quarterKey) => quarterSet.add(quarterKey));
    return [...quarterSet]
      .filter((quarterKey) => isQuarterSelectable(rawRows, quarterKey, MIN_SELECTABLE_QUARTER))
      .sort(compareQuarterKeys);
  }, [insightsByQuarter, rawRows]);

  const isCurrentQuarterSelectable = useMemo(
    () => isQuarterSelectable(rawRows, qKey, MIN_SELECTABLE_QUARTER),
    [rawRows, qKey]
  );

  useEffect(() => {
    if (!availableQuarters.length) return;
    if (!qKey || !availableQuarters.includes(qKey)) {
      setQKey(availableQuarters[availableQuarters.length - 1]);
    }
  }, [availableQuarters, qKey]);

  const insights = useMemo(() => insightsByQuarter[qKey] || {}, [insightsByQuarter, qKey]);

  const dataView = useMemo(() => {
    const metrics = [];

    let awarenessScore = 0;
    let considerationScore = 0;
    let conversionScore = 0;
    let overallScore = 0;
    let overallStatus = "";

    rawRows.forEach((row) => {
      const phaseName = normalizeText(row.phase);
      const phaseNameUpper = normalizeUpper(row.phase);
      const metricName = normalizeText(row.metric);
      const metricNameUpper = normalizeUpper(row.metric);

      const summaryScore = getSummaryScore(row, qKey);
      const quarterOutlook = normalizeText(getQuarterOutlook(row, qKey));

      const isAwarenessScoreRow =
        metricNameUpper.includes("OKR") && metricNameUpper.includes("AWARENESS");

      const isConsiderationScoreRow =
        metricNameUpper.includes("OKR") && metricNameUpper.includes("CONSIDERATION");

      const isConversionScoreRow =
        metricNameUpper.includes("OKR") && metricNameUpper.includes("CONVERSION");

      const isOverallScoreRow =
        phaseNameUpper === "OKR SCORE" ||
        metricNameUpper === "OKR SCORE" ||
        phaseNameUpper.includes("OKR SCORE") ||
        metricNameUpper.includes("OKR SCORE");

      const isOverallStatusRow =
        phaseNameUpper === "OKR STATUS" ||
        metricNameUpper === "OKR STATUS" ||
        phaseNameUpper.includes("OKR STATUS") ||
        metricNameUpper.includes("OKR STATUS");

      if (isAwarenessScoreRow) {
        awarenessScore = summaryScore ?? awarenessScore;
        return;
      }

      if (isConsiderationScoreRow) {
        considerationScore = summaryScore ?? considerationScore;
        return;
      }

      if (isConversionScoreRow) {
        conversionScore = summaryScore ?? conversionScore;
        return;
      }

      if (isOverallScoreRow) {
        overallScore = summaryScore ?? overallScore;
        return;
      }

      if (isOverallStatusRow) {
        overallStatus = quarterOutlook || overallStatus;
        return;
      }

      const idMatch = metricName.match(/^([0-9]+\.[0-9]+)/);

      if (!idMatch) return;

      let out = normalizeUpper(getQuarterOutlook(row, qKey));

      if (out !== "POSITIVO" && out !== "NEGATIVO" && out !== "STABILE") {
        out = "STABILE";
      }

      metrics.push({
        id: idMatch[1],
        phase: row.phase,
        metric: metricName.replace(idMatch[0], "").trim(),
        source: row.source,
        reason: row.reason,
        val: getQuarterValue(row, qKey),
        yoy: getQuarterYoY(row, qKey),
        bench: getQuarterBench(row, qKey),
        outlook: out,
        history: buildMetricHistory(row),
      });
    });

    if (!overallStatus || !Number.isNaN(Number(overallStatus))) {
      overallStatus = getScoreLabelFromScore(overallScore);
    }

    const scores = [
      { phase: "Awareness", score: awarenessScore },
      { phase: "Consideration", score: considerationScore },
      { phase: "Conversion", score: conversionScore },
      { phase: "Tutte", score: overallScore },
    ];

    return {
      metrics,
      scores,
      overall: overallScore,
      overallStatus,
    };
  }, [rawRows, qKey]);

  const filteredMetrics = useMemo(() => {
    return dataView.metrics.filter((metric) => {
      const pMatch = phase === "Tutte" || metric.phase === phase;
      const oMatch = outlookFilter === "Tutti" || metric.outlook === outlookFilter;
      const qMatch =
        !query ||
        `${metric.metric} ${metric.reason} ${metric.id}`
          .toLowerCase()
          .includes(query.toLowerCase());

      return pMatch && oMatch && qMatch;
    });
  }, [dataView, phase, outlookFilter, query]);

  useEffect(() => {
    if (!filteredMetrics.some((metric) => metric.id === selectedId) && filteredMetrics[0]) {
      setSelectedId(filteredMetrics[0].id);
    }
  }, [filteredMetrics, selectedId]);

  const selectedMetric = useMemo(() => {
    return (
      dataView.metrics.find((metric) => metric.id === selectedId) ||
      filteredMetrics[0] ||
      dataView.metrics[0] ||
      {}
    );
  }, [dataView, selectedId, filteredMetrics]);

  const phaseScoresOnly = dataView.scores.filter((item) => item.phase !== "Tutte");

  const visiblePhaseScores =
    phase === "Tutte"
      ? phaseScoresOnly
      : phaseScoresOnly.filter((item) => item.phase === phase);

  const yoyRanking = useMemo(() => {
    return [...filteredMetrics]
      .filter((metric) => typeof metric.yoy === "number")
      .sort((a, b) => a.yoy - b.yoy)
      .map((metric) => ({
        id: metric.id,
        name: metric.id,
        metric: metric.metric,
        yoy: metric.yoy,
        phase: metric.phase,
        outlook: metric.outlook,
      }));
  }, [filteredMetrics]);

  const outlookDistribution = useMemo(() => {
    const total = filteredMetrics.length || 1;

    return ["POSITIVO", "STABILE", "NEGATIVO"]
      .map((name) => {
        const value = filteredMetrics.filter((metric) => metric.outlook === name).length;

        return {
          name,
          value,
          percent: value / total,
          hex: OUTLOOK_COLORS[name],
        };
      })
      .filter((item) => item.value > 0);
  }, [filteredMetrics]);

  const riskMetrics = useMemo(() => {
    return [...dataView.metrics]
      .filter((metric) => metric.outlook === "NEGATIVO")
      .sort((a, b) => a.yoy - b.yoy)
      .slice(0, 5);
  }, [dataView]);

  const acceleratorMetrics = useMemo(() => {
    return [...dataView.metrics]
      .filter((metric) => metric.outlook === "POSITIVO")
      .sort((a, b) => b.yoy - a.yoy)
      .slice(0, 5);
  }, [dataView]);

  const phaseSummary = useMemo(() => {
    return phaseScoresOnly.map((scoreObj) => {
      const rows = dataView.metrics.filter((metric) => metric.phase === scoreObj.phase);

      return {
        ...scoreObj,
        metricsCount: rows.length,
        positive: rows.filter((metric) => metric.outlook === "POSITIVO").length,
        stable: rows.filter((metric) => metric.outlook === "STABILE").length,
        negative: rows.filter((metric) => metric.outlook === "NEGATIVO").length,
      };
    });
  }, [dataView, phaseScoresOnly]);

  const exportPDF = () => {
    if (!isCurrentQuarterSelectable) {
      return;
    }
    document.body.classList.add("is-printing-dashboard");

    const cleanup = () => {
      document.body.classList.remove("is-printing-dashboard");
      window.removeEventListener("afterprint", cleanup);
    };

    window.addEventListener("afterprint", cleanup);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
      });
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center font-black text-slate-400 bg-slate-50 tracking-wider">
        SINCRONIZZAZIONE DATI CLOUD...
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="max-w-xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-black text-slate-800">
            Errore nel caricamento dei dati
          </h1>

          <p className="mt-3 text-sm font-semibold text-slate-500">{fetchError}</p>

          <p className="mt-4 text-xs text-slate-400">
            Controlla che gli sheet <strong>DB</strong> e <strong>Insights</strong>{" "}
            esistano e siano accessibili con API Key.
          </p>
        </div>
      </div>
    );
  }

  if (!availableQuarters.length) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="max-w-xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-black text-slate-800">Nessun periodo disponibile</h1>
          <p className="mt-3 text-sm font-semibold text-slate-500">
            Sono selezionabili solo i quarter da <strong>{MIN_SELECTABLE_QUARTER}</strong> in avanti con almeno un valore reale nella colonna del quarter.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      id="report-area"
      className="min-h-screen bg-[#F7F8FA] p-4 md:p-8 font-sans text-slate-900"
    >
      <PdfExportArea
        qKey={qKey}
        dataView={dataView}
        phaseScoresOnly={phaseScoresOnly}
        insights={insights}
      />

      <div className="max-w-7xl mx-auto space-y-7">
        <header className="bg-white p-6 rounded-3xl shadow-sm ring-1 ring-slate-100 flex flex-col gap-5 lg:flex-row lg:justify-between lg:items-center">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="Telethon" className="h-12 w-auto" />

            <div className="h-10 w-px bg-slate-200 hidden md:block" />

            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                OKR Executive Dashboard
              </div>

              <h1
                className="text-2xl md:text-3xl font-black tracking-tight"
                style={{ color: BRAND_COLORS.titleColor }}
              >
                Performance OKR Fundraising Funnel
              </h1>

              <p className="mt-1 text-xs font-semibold text-slate-400">
                Dashboard di valutazione delle Key Metrics di OKR.
              </p>
            </div>
          </div>

          <div
            data-html2pdf-ignore
            className="flex w-full flex-col gap-3 sm:flex-row sm:items-end lg:w-auto"
          >
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                Periodo Analisi
              </label>

              <select
                value={qKey}
                onChange={(event) => setQKey(event.target.value)}
                className="w-full min-w-[230px] bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 shadow-sm outline-none ring-2 ring-transparent focus:ring-[#3B539E]"
              >
                {availableQuarters.map((quarterOption) => (
                  <option key={quarterOption} value={quarterOption}>
                    {getQuarterDisplayLabel(quarterOption)}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={exportPDF}
              disabled={!isCurrentQuarterSelectable}
              className={`px-6 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 ${isCurrentQuarterSelectable ? "bg-[#3B539E] text-white hover:opacity-90" : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"}`}
            >
              🖨️ SALVA REPORT {qKey || ""} IN PDF
            </button>
          </div>
        </header>

        <OverviewSection
          overall={dataView.overall}
          overallStatus={dataView.overallStatus}
          phaseScores={phaseScoresOnly}
          insight={insights.overall}
        />

        <Card
          data-html2pdf-ignore
          className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white/70 backdrop-blur-md"
        >
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
              Fase Funnel
            </label>

            <select
              value={phase}
              onChange={(event) => setPhase(event.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl p-2 text-sm font-bold text-slate-700 outline-none ring-2 ring-transparent focus:ring-[#3B539E]"
            >
              {phaseOptions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
              Stato Outlook
            </label>

            <select
              value={outlookFilter}
              onChange={(event) => setOutlookFilter(event.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl p-2 text-sm font-bold text-slate-700 outline-none ring-2 ring-transparent focus:ring-[#3B539E]"
            >
              {outlookOptions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
              Ricerca Libera
            </label>

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cerca sorgente o KPI..."
              className="w-full bg-white border border-slate-200 rounded-xl p-2 text-sm font-bold text-slate-700 outline-none ring-2 ring-transparent focus:ring-[#3B539E]"
            />
          </div>
        </Card>

        <div className="space-y-7">
          {visiblePhaseScores.map((pScore) => {
            const rows = filteredMetrics.filter(
              (metric) => metric.phase === pScore.phase
            );

            return (
              <PhaseSection
                key={pScore.phase}
                phaseName={pScore.phase}
                score={pScore.score}
                metrics={rows}
                selectedId={selectedId}
                onSelect={setSelectedId}
                qKey={qKey}
                insight={insights[pScore.phase]}
              />
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-slate-800">
                Ranking YoY per metrica ({qKey})
              </h2>

              <p className="text-xs text-slate-400">
                Rendimento percentuale reale del canale.
              </p>
            </div>

            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={yoyRanking}
                  margin={{ top: 10, right: 20, left: 0, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />

                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    className="text-xs font-bold"
                  />

                  <YAxis
                    tickFormatter={(value) => `${Math.round(value * 100)}%`}
                    tickLine={false}
                    axisLine={false}
                    className="text-xs font-bold"
                  />

                  <Tooltip content={<RankingTooltip />} />

                  <Bar dataKey="yoy" radius={[6, 6, 0, 0]}>
                    {yoyRanking.map((entry) => (
                      <Cell key={entry.id} fill={yoyColor(entry)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <h2 className="text-xl font-bold text-slate-800">
              Distribuzione Outlook ({qKey})
            </h2>

            <p className="text-xs text-slate-400">
              Rapporto volumetrico dello stato operativo.
            </p>

            <div className="mt-4 h-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={outlookDistribution}
                    innerRadius={58}
                    outerRadius={88}
                    paddingAngle={4}
                    dataKey="value"
                    nameKey="name"
                    startAngle={90}
                    endAngle={-270}
                  >
                    {outlookDistribution.map((entry) => (
                      <Cell key={entry.name} fill={entry.hex} />
                    ))}
                  </Pie>

                  <Tooltip
                    formatter={(value, name, props) => [
                      `${value} KPI · ${fmtPct(props.payload.percent)}`,
                      name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-2 grid grid-cols-1 gap-1 text-xs font-bold">
              {outlookDistribution.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: item.hex }}
                    />

                    <span className="text-slate-600">{item.name}</span>
                  </div>

                  <div className="text-slate-700">
                    {item.value} KPI ({fmtPct(item.percent)})
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {selectedMetric.id && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-2 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">
                    Dettaglio metrica
                  </h2>

                  <p className="text-xs text-slate-400">
                    Profondità e analisi del KPI selezionato.
                  </p>
                </div>

                <Badge
                  style={outlookStyle(selectedMetric.outlook)}
                  className="font-black text-[10px] tracking-wider"
                >
                  {selectedMetric.outlook}
                </Badge>
              </div>

              <select
                data-html2pdf-ignore
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none"
              >
                {filteredMetrics.map((metric) => (
                  <option value={metric.id} key={metric.id}>
                    [{metric.id}] {metric.metric}
                  </option>
                ))}
              </select>

              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                <div className="text-xs font-black text-slate-400 uppercase tracking-wider">
                  FONTE: {selectedMetric.source || "Nessuna"}
                </div>

                <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
                  {selectedMetric.reason}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-bold">
                <div
                  className="rounded-2xl border border-slate-100 bg-slate-50 p-3 shadow-inner cursor-help"
                  title={`Numero originario: ${selectedMetric.val?.toLocaleString(
                    "it-IT"
                  )}`}
                >
                  <div className="text-slate-400 text-[10px] uppercase">
                    Valore Corrente
                  </div>

                  <div className="text-base font-black text-slate-700 mt-0.5">
                    {fmtValue(selectedMetric, selectedMetric.val)}
                  </div>
                </div>

                <div
                  className="rounded-2xl border border-slate-100 bg-slate-50 p-3 shadow-inner cursor-help"
                  title={`Numero originario: ${selectedMetric.bench?.toLocaleString(
                    "it-IT"
                  )}`}
                >
                  <div className="text-slate-400 text-[10px] uppercase">
                    Target {qKey}
                  </div>

                  <div className="text-base font-black text-slate-700 mt-0.5">
                    {fmtValue(selectedMetric, selectedMetric.bench)}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="lg:col-span-3">
              <h2 className="text-xl font-bold text-slate-800">
                Trend storico della metrica
              </h2>

              <p className="text-xs text-slate-400">
                Andamento consolidato nei vari Quarter.
              </p>

              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={selectedMetric.history}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />

                    <XAxis
                      dataKey="q"
                      tickLine={false}
                      axisLine={false}
                      className="text-xs font-bold"
                    />

                    <YAxis
                      tickFormatter={(value) => fmtNumber(value)}
                      tickLine={false}
                      axisLine={false}
                      className="text-xs font-bold"
                    />

                    <Tooltip content={<MetricTooltip />} />

                    <Line
                      type="monotone"
                      dataKey="v"
                      stroke={PHASE_COLORS[selectedMetric.phase] || BRAND_COLORS.blue}
                      strokeWidth={4}
                      dot={{
                        r: 5,
                        strokeWidth: 2,
                        fill: "#fff",
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card>
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800">
                <Icon name="alert" className="h-5 w-5 text-rose-500" />
                Top criticità
              </h2>

              <p className="mt-1 text-xs font-semibold text-slate-400">
                Key Metrics con Outlook Negativo
              </p>
            </div>

            <div className="mt-4 space-y-3">
              {riskMetrics.map((metric) => (
                <button
                  key={metric.id}
                  onClick={() => setSelectedId(metric.id)}
                  className="w-full rounded-2xl border border-slate-200 p-3 text-left transition hover:bg-slate-50 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <span className="text-xs font-black text-slate-400">
                      ID {metric.id}
                    </span>

                    <p className="line-clamp-1 text-sm font-bold text-slate-700 mt-0.5">
                      {metric.metric}
                    </p>
                  </div>

                  <span className="text-sm font-black text-rose-500 bg-rose-50 px-2 py-1 rounded-lg shrink-0">
                    {fmtPct(metric.yoy)}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <div>
              <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800">
                <Icon name="trend" className="h-5 w-5 text-emerald-500" />
                Top acceleratori
              </h2>

              <p className="mt-1 text-xs font-semibold text-slate-400">
                Key Metrics con Outlook Positivo
              </p>
            </div>

            <div className="mt-4 space-y-3">
              {acceleratorMetrics.map((metric) => (
                <button
                  key={metric.id}
                  onClick={() => setSelectedId(metric.id)}
                  className="w-full rounded-2xl border border-slate-200 p-3 text-left transition hover:bg-slate-50 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <span className="text-xs font-black text-slate-400">
                      ID {metric.id}
                    </span>

                    <p className="line-clamp-1 text-sm font-bold text-slate-700 mt-0.5">
                      {metric.metric}
                    </p>
                  </div>

                  <span className="text-sm font-black text-emerald-500 bg-emerald-50 px-2 py-1 rounded-lg shrink-0">
                    {fmtPct(metric.yoy)}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-xl font-bold text-slate-800">Sintesi per fase</h2>

            <div className="mt-4 space-y-3">
              {phaseSummary.map((item) => (
                <div
                  key={item.phase}
                  className="rounded-2xl border border-slate-200 p-3"
                >
                  <div className="flex items-center justify-between font-bold text-sm">
                    <span style={{ color: PHASE_COLORS[item.phase] }}>
                      {item.phase.toUpperCase()}
                    </span>

                    <span className="rounded-md bg-slate-100 px-2 py-0.5 font-black text-slate-700">
                      Score: {item.score}
                    </span>
                  </div>

                  <div className="mt-2 flex justify-between text-[11px] font-bold text-slate-400 uppercase">
                    <span>KPI totali: {item.metricsCount}</span>

                    <div className="flex gap-2">
                      <span className="text-emerald-500">▲ {item.positive}</span>
                      <span className="text-amber-500">● {item.stable}</span>
                      <span className="text-rose-500">▼ {item.negative}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
