import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../../../lib/supabase";
import DashboardFilterSidebar from "../components/DashboardFilterSidebar";
import {
  TrendingUp,
  Eraser,
  ChevronDown,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

// ==========================================
// NUMBER & CURRENCY FORMATTERS
// ==========================================
function formatCurrency(val) {
  if (val === undefined || val === null || isNaN(val) || val === 0)
    return "₹ 0";
  if (val >= 10000000) return `₹ ${(val / 10000000).toFixed(2)}Cr`;
  if (val >= 1000000) return `₹ ${(val / 1000000).toFixed(2)}M`;
  if (val >= 1000) return `₹ ${(val / 1000).toFixed(1)}K`;
  return `₹ ${Math.round(val).toLocaleString()}`;
}

function formatShortNumber(val) {
  if (val === undefined || val === null || isNaN(val) || val === 0) return "0";
  if (val >= 10000000) return `${(val / 10000000).toFixed(2)}Cr`;
  if (val >= 1000000) return `${(val / 1000000).toFixed(2)}M`;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
  return `${Math.round(val).toLocaleString()}`;
}

function formatIndianDate(val) {
  if (!val) return "";
  if (typeof val === "string" && val.includes("-")) {
    const parts = val.split("-");
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
    }
  }
  const dt = new Date(val);
  if (!isNaN(dt.getTime())) {
    const d = String(dt.getDate()).padStart(2, "0");
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const y = dt.getFullYear();
    return `${d}/${m}/${y}`;
  }
  return String(val);
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const SHORT_MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const LIQUOR_COLORS = {
  IMFL: "#160c5c",
  BEER: "#3b82f6",
  MML: "#f43f5e",
  WINE: "#eab308",
  OTHER: "#8b5cf6",
};

const SUBHEAD_PALETTE = [
  "#160c5c",
  "#2563eb",
  "#f43f5e",
  "#fb923c",
  "#facc15",
  "#10b981",
  "#84cc16",
  "#f472b6",
  "#38bdf8",
  "#c084fc",
  "#2dd4bf",
  "#6366f1",
];

// ==========================================
// INTERACTIVE SPARKLINE WITH PERPENDICULAR CURSOR LINE
// ==========================================
const Sparkline = ({
  points = [],
  hoveredIndex = null,
  onHoverIndex,
  onLeave,
  width = 160,
  height = 46,
  padding = 6,
}) => {
  const svgRef = React.useRef(null);

  if (!points || points.length === 0) {
    return (
      <div className="h-11 flex items-center justify-center text-[10px] text-slate-400">
        No data
      </div>
    );
  }

  const minVal = Math.min(...points);
  const maxVal = Math.max(...points);
  const minIdx = points.lastIndexOf(minVal);
  const maxIdx = points.lastIndexOf(maxVal);

  const getX = (idx) =>
    padding + (idx / Math.max(points.length - 1, 1)) * (width - 2 * padding);
  const getY = (val) => {
    if (maxVal === minVal) return height / 2;
    return (
      height -
      padding -
      ((val - minVal) / (maxVal - minVal)) * (height - 2 * padding)
    );
  };

  const coords = points.map((val, idx) => ({ x: getX(idx), y: getY(val) }));

  const pathData = coords.reduce((acc, pt, idx, arr) => {
    if (idx === 0) return `M ${pt.x},${pt.y}`;
    const prev = arr[idx - 1];
    const midX = (prev.x + pt.x) / 2;
    return `${acc} C ${midX},${prev.y} ${midX},${pt.y} ${pt.x},${pt.y}`;
  }, "");

  const areaData =
    coords.length > 0
      ? `${pathData} L ${coords[coords.length - 1].x},${height - 2} L ${coords[0].x},${height - 2} Z`
      : "";

  const maxPt = coords[maxIdx];
  const minPt = coords[minIdx];
  const activePt =
    hoveredIndex !== null && coords[hoveredIndex] ? coords[hoveredIndex] : null;

  const handlePointerMove = (e) => {
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const svgX = (mouseX / (rect.width || 1)) * width;
    const clampedX = Math.max(padding, Math.min(width - padding, svgX));
    const ratio = (clampedX - padding) / Math.max(width - 2 * padding, 1);
    const rawIdx = Math.round(ratio * (points.length - 1));
    const idx = Math.max(0, Math.min(points.length - 1, rawIdx));
    onHoverIndex?.(idx, e);
  };

  const gradId = React.useId();

  return (
    <div
      className="relative w-full flex justify-center py-0.5 cursor-crosshair touch-none select-none"
      onMouseMove={handlePointerMove}
      onMouseLeave={onLeave}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full max-w-[165px] h-11 overflow-visible"
      >
        <defs>
          <linearGradient
            id={`spark-grad-${gradId}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Subtle filled area */}
        {areaData && <path d={areaData} fill={`url(#spark-grad-${gradId})`} />}

        {/* Sparkline curve */}
        <path
          d={pathData}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* High Point Green Dot */}
        {maxPt && (
          <circle
            cx={maxPt.x}
            cy={maxPt.y}
            r="4"
            fill="#15803d"
            stroke="#ffffff"
            strokeWidth="1.5"
            opacity={activePt ? 0.35 : 1}
          />
        )}

        {/* Low Point Red Dot */}
        {minPt && (
          <circle
            cx={minPt.x}
            cy={minPt.y}
            r="4"
            fill="#dc2626"
            stroke="#ffffff"
            strokeWidth="1.5"
            opacity={activePt ? 0.35 : 1}
          />
        )}

        {/* INTERACTIVE PERPENDICULAR LINE & ACTIVE DOT */}
        {activePt && (
          <g className="transition-all duration-75">
            {/* Soft vertical guideline glow */}
            <line
              x1={activePt.x}
              y1={1}
              x2={activePt.x}
              y2={height - 1}
              stroke="#0284c7"
              strokeWidth="5"
              opacity="0.18"
            />
            {/* Crisp vertical perpendicular line */}
            <line
              x1={activePt.x}
              y1={1}
              x2={activePt.x}
              y2={height - 1}
              stroke="#0284c7"
              strokeWidth="1.5"
              strokeDasharray="2 2"
            />
            {/* Perpendicular base tick */}
            <circle cx={activePt.x} cy={height - 2} r="2" fill="#0284c7" />
            {/* Point glow halo */}
            <circle
              cx={activePt.x}
              cy={activePt.y}
              r="7.5"
              fill="#38bdf8"
              opacity="0.35"
            />
            {/* Point active marker */}
            <circle
              cx={activePt.x}
              cy={activePt.y}
              r="4.5"
              fill="#0284c7"
              stroke="#ffffff"
              strokeWidth="2"
            />
          </g>
        )}
      </svg>
    </div>
  );
};

// ==========================================
// MONTHLY SALES CARD COMPONENT (WITH DYNAMIC HOVER REFLECTION & CROSS-FILTERING)
// ==========================================
const MonthlySalesCard = ({
  item,
  activeLiquorType = null,
  liquorSalesAmount = null,
  onShowTooltip,
  onMoveTooltip,
  onHideTooltip,
}) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const isHovered =
    hoveredIdx !== null && item.sparkline && hoveredIdx < item.sparkline.length;
  const hoveredValue = isHovered ? item.sparkline[hoveredIdx] : null;

  // Real-time reflection: dynamically reflects the day's pattern value while cursor moves
  const displayAmount = isHovered ? formatCurrency(hoveredValue) : item.amount;
  const dayNumber = isHovered ? hoveredIdx + 1 : null;

  const handleSparklineHover = (idx, e) => {
    setHoveredIdx(idx);
    const dayVal = item.sparkline[idx] || 0;
    const sharePercent =
      item.rawSales > 0 ? ((dayVal / item.rawSales) * 100).toFixed(1) : "0";

    onShowTooltip?.(
      {
        title: `${item.label} • Day ${idx + 1}`,
        badge: `Day ${idx + 1} of ${item.sparkline.length}`,
        items: [
          {
            label: `Day ${idx + 1} Sales`,
            value: formatCurrency(dayVal),
            color: "#0284c7",
          },
          ...(activeLiquorType && liquorSalesAmount !== null
            ? [
                {
                  label: `${activeLiquorType} in Month`,
                  value: formatCurrency(liquorSalesAmount),
                  color: "#6366f1",
                },
              ]
            : []),
          { label: "Month Total", value: item.amount, color: "#4f46e5" },
          { label: "Day Share", value: `${sharePercent}%`, color: "#10b981" },
        ],
      },
      e,
    );
  };

  const handleLeave = () => {
    setHoveredIdx(null);
    onHideTooltip?.();
  };

  const handleCardMouseEnter = (e) => {
    if (hoveredIdx === null) {
      onShowTooltip?.(
        {
          title: item.label,
          badge: activeLiquorType
            ? `Filtering ${activeLiquorType}`
            : "Monthly Total",
          items: [
            ...(activeLiquorType && liquorSalesAmount !== null
              ? [
                  {
                    label: `${activeLiquorType} Sales`,
                    value: formatCurrency(liquorSalesAmount),
                    color: "#6366f1",
                  },
                  {
                    label: "Share of Month",
                    value: `${item.rawSales > 0 ? ((liquorSalesAmount / item.rawSales) * 100).toFixed(1) : 0}%`,
                  },
                ]
              : []),
            { label: "Total Sales", value: item.amount, color: "#0284c7" },
            {
              label: "Recorded Days",
              value: `${item.sparkline?.length || 0} Days`,
            },
          ],
        },
        e,
      );
    }
  };

  return (
    <div
      className={`bg-[#f8fcff] rounded-2xl p-3 border-2 transition-all duration-200 cursor-pointer min-h-28 flex flex-col items-center justify-between group/card ${
        isHovered
          ? "border-sky-500 shadow-md ring-2 ring-sky-300/40 bg-sky-50/40"
          : activeLiquorType && liquorSalesAmount > 0
            ? "border-indigo-300/90 shadow-xs"
            : "border-[#b8ddf8] shadow-xs hover:shadow-md hover:border-indigo-400"
      }`}
      onMouseEnter={handleCardMouseEnter}
      onMouseMove={onMoveTooltip}
      onMouseLeave={handleLeave}
    >
      <div className="text-center w-full flex flex-col items-center">
        <p
          className={`text-lg sm:text-xl font-black tracking-tight leading-tight transition-colors duration-150 ${
            isHovered
              ? "text-indigo-600"
              : "text-[#0284c7] group-hover/card:text-indigo-600"
          }`}
        >
          {displayAmount}
        </p>

        <div className="flex items-center justify-center gap-1.5 mt-0.5 flex-wrap">
          <p className="text-xs font-bold text-indigo-800">{item.label}</p>
          {isHovered && (
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 border border-sky-300 shadow-2xs">
              Day {dayNumber}
            </span>
          )}
          {activeLiquorType && liquorSalesAmount !== null && !isHovered && (
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-2xs">
              {activeLiquorType}: {formatCurrency(liquorSalesAmount)}
            </span>
          )}
        </div>
      </div>

      <div className="w-full flex justify-center mt-1.5">
        <Sparkline
          points={item.sparkline}
          hoveredIndex={hoveredIdx}
          onHoverIndex={handleSparklineHover}
          onLeave={handleLeave}
        />
      </div>
    </div>
  );
};

// ==========================================
// POWER BI INTERACTIVE FLOATING TOOLTIP
// ==========================================
const ChartTooltip = ({ tooltip }) => {
  if (!tooltip || !tooltip.visible) return null;

  const tooltipWidth = 210;
  const tooltipHeight = 115;

  let left, top;
  if (tooltip.bounds) {
    // Strictly stay within the parent div's boundaries so it never exceeds the parent field
    if (tooltip.x + 14 + tooltipWidth > tooltip.bounds.right) {
      left = Math.max(tooltip.bounds.left + 8, tooltip.x - tooltipWidth - 12);
    } else {
      left = Math.max(tooltip.bounds.left + 8, tooltip.x + 14);
    }

    if (tooltip.y + 14 + tooltipHeight > tooltip.bounds.bottom) {
      top = Math.max(tooltip.bounds.top + 8, tooltip.y - tooltipHeight - 12);
    } else {
      top = Math.max(tooltip.bounds.top + 8, tooltip.y + 14);
    }
  } else {
    // Viewport-aware boundary clamping to prevent clipping off screen
    left =
      typeof window !== "undefined"
        ? Math.min(tooltip.x + 14, window.innerWidth - 250)
        : tooltip.x;
    top =
      typeof window !== "undefined"
        ? Math.min(tooltip.y + 14, window.innerHeight - 190)
        : tooltip.y;
  }

  return (
    <div
      className="fixed z-50 pointer-events-none transition-transform duration-75 ease-out select-none"
      style={{ left: `${left}px`, top: `${top}px` }}
    >
      <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-xl p-2 px-2.5 shadow-2xl border border-slate-700/80 text-xs min-w-40 max-w-56">
        {tooltip.title && (
          <div className="font-black text-slate-100 border-b border-slate-700/80 pb-1.5 mb-1.5 flex items-center justify-between gap-2">
            <span className="truncate">{tooltip.title}</span>
            {tooltip.badge && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 shrink-0">
                {tooltip.badge}
              </span>
            )}
          </div>
        )}
        <div className="flex flex-col gap-1">
          {tooltip.items?.map((it, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-3 text-[11px]"
            >
              <span className="flex items-center gap-1.5 text-slate-400 font-semibold truncate">
                {it.color && (
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: it.color }}
                  ></span>
                )}
                <span className="truncate">{it.label}:</span>
              </span>
              <span className="font-mono font-bold text-slate-100 whitespace-nowrap">
                {it.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// DONUT CHART COMPONENT (WITH POWER BI HOVER)
// ==========================================
const DonutChart = ({
  data = [],
  centerValue = "0",
  centerLabel = "Total",
  size = 145,
  strokeWidth = 22,
  onHoverSlice,
  hoveredIndex = null,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((acc, d) => acc + (d.value || 0), 0) || 1;

  let accumulatedPercent = 0;

  return (
    <div
      className="relative flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90 block overflow-hidden"
      >
        {data.map((slice, idx) => {
          const sliceVal = slice.value || 0;
          const slicePercent = sliceVal / total;
          const strokeDasharray = `${slicePercent * circumference} ${circumference}`;
          const strokeDashoffset = -(accumulatedPercent * circumference);
          accumulatedPercent += slicePercent;
          const isHovered = hoveredIndex === idx;

          return (
            <circle
              key={idx}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke={slice.color || "#cbd5e1"}
              strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              strokeOpacity={hoveredIndex !== null && !isHovered ? 0.45 : 1}
              className="transition-all duration-200 cursor-pointer"
              onMouseEnter={(e) => onHoverSlice && onHoverSlice(slice, idx, e)}
              onMouseMove={(e) => onHoverSlice && onHoverSlice(slice, idx, e)}
              onMouseLeave={() =>
                onHoverSlice && onHoverSlice(null, null, null)
              }
            />
          );
        })}
      </svg>
      {/* Center Label perfectly fitted inside hole */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-1">
        <span className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-none truncate max-w-20 transition-all">
          {centerValue}
        </span>
        <span className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-wider truncate max-w-20">
          {centerLabel}
        </span>
      </div>
    </div>
  );
};

// ==========================================
// DAY-WISE SPLINE CHART COMPONENT (WITH CROSSHAIR PROBE)
// ==========================================
const DayWiseChart = ({ dayMap = {}, onHoverDay, hoveredDay = null }) => {
  const width = 380;
  const height = 185;
  const padL = 48;
  const padR = 14;
  const padT = 16;
  const padB = 34;

  // Days 1 to 31
  const daysList = [];
  for (let d = 1; d <= 31; d++) {
    daysList.push({ day: d, cases: dayMap[d] || 0 });
  }

  const casesValues = daysList.map((d) => d.cases);
  const maxVal = Math.max(...casesValues, 10);
  const ceiling = Math.ceil(maxVal / 10) * 10;

  const getX = (day) => padL + ((day - 1) / 30) * (width - padL - padR);
  const getY = (val) => padT + (1 - val / ceiling) * (height - padT - padB);

  const coords = daysList.map((d) => ({
    x: getX(d.day),
    y: getY(d.cases),
    day: d.day,
    cases: d.cases,
  }));

  let pathD = "";
  if (coords.length > 0) {
    pathD = coords.reduce((acc, pt, idx, arr) => {
      if (idx === 0) return `M ${pt.x},${pt.y}`;
      const prev = arr[idx - 1];
      const midX = (prev.x + pt.x) / 2;
      return `${acc} C ${midX},${prev.y} ${midX},${pt.y} ${pt.x},${pt.y}`;
    }, "");
  }

  const maxItem = [...daysList].sort((a, b) => b.cases - a.cases)[0];
  const minItem =
    [...daysList]
      .filter((d) => d.cases > 0)
      .sort((a, b) => a.cases - b.cases)[0] || daysList[0];

  const maxCoord =
    maxItem && maxItem.cases > 0
      ? coords.find((c) => c.day === maxItem.day)
      : null;
  const minCoord =
    minItem && minItem.cases > 0
      ? coords.find((c) => c.day === minItem.day)
      : null;

  const handleMouseMove = (e) => {
    if (!onHoverDay) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const svgX = (mouseX / rect.width) * width;
    const day = Math.min(
      Math.max(Math.round(1 + ((svgX - padL) / (width - padL - padR)) * 30), 1),
      31,
    );
    const item = coords.find((c) => c.day === day);
    if (item) {
      const isPeak = maxCoord && maxCoord.day === item.day;
      const isMin = minCoord && minCoord.day === item.day;
      onHoverDay({ ...item, isPeak, isMin }, e);
    }
  };

  const activeCoord = hoveredDay
    ? coords.find((c) => c.day === hoveredDay.day)
    : null;

  return (
    <div
      className="w-full relative overflow-hidden cursor-crosshair"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => onHoverDay && onHoverDay(null, null)}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-hidden block"
      >
        {/* Y Grid lines and labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const v = Math.round(ceiling * ratio);
          const y = getY(v);
          return (
            <g key={ratio}>
              <line
                x1={padL}
                y1={y}
                x2={width - padR}
                y2={y}
                stroke="#e0f2fe"
                strokeWidth="1"
                strokeDasharray="3,3"
              />
              <text
                x={padL - 6}
                y={y + 3}
                textAnchor="end"
                className="text-[9px] fill-slate-500 font-semibold select-none"
              >
                {formatShortNumber(v)}
              </text>
            </g>
          );
        })}

        {/* X Axis labels */}
        {[1, 5, 10, 15, 20, 25, 30].map((d) => {
          const x = getX(d);
          return (
            <g key={d}>
              <text
                x={x}
                y={height - padB + 13}
                textAnchor="middle"
                className="text-[9px] fill-slate-500 font-semibold select-none"
              >
                {d}
              </text>
            </g>
          );
        })}

        {/* Axis Titles with clean spacing */}
        <text
          x={12}
          y={(height - padB + padT) / 2}
          textAnchor="middle"
          transform={`rotate(-90, 12, ${(height - padB + padT) / 2})`}
          className="text-[10px] font-bold fill-slate-700 select-none"
        >
          Total Cases
        </text>
        <text
          x={(width + padL - padR) / 2}
          y={height - 4}
          textAnchor="middle"
          className="text-[10px] font-bold fill-slate-700 select-none"
        >
          Day
        </text>

        {/* Spline Area Fill */}
        {pathD && (
          <path
            d={`${pathD} L ${getX(31)},${getY(0)} L ${getX(1)},${getY(0)} Z`}
            fill="url(#dayWiseFillGradDynamic)"
            opacity="0.25"
          />
        )}

        <defs>
          <linearGradient
            id="dayWiseFillGradDynamic"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Spline Line */}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke="#4338ca"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Peak Green Dot */}
        {maxCoord && (
          <circle
            cx={maxCoord.x}
            cy={maxCoord.y}
            r="4.5"
            fill="#15803d"
            stroke="#ffffff"
            strokeWidth="2"
          />
        )}

        {/* Lowest Red Dot */}
        {minCoord && (
          <circle
            cx={minCoord.x}
            cy={minCoord.y}
            r="4.5"
            fill="#dc2626"
            stroke="#ffffff"
            strokeWidth="2"
          />
        )}

        {/* Active Hover Crosshair Guideline & Dot */}
        {activeCoord && (
          <g>
            <line
              x1={activeCoord.x}
              y1={padT}
              x2={activeCoord.x}
              y2={height - padB}
              stroke="#6366f1"
              strokeWidth="1.5"
              strokeDasharray="3,3"
            />
            <circle
              cx={activeCoord.x}
              cy={activeCoord.y}
              r="8"
              fill="#6366f1"
              opacity="0.3"
            />
            <circle
              cx={activeCoord.x}
              cy={activeCoord.y}
              r="5"
              fill="#4338ca"
              stroke="#ffffff"
              strokeWidth="2"
            />
          </g>
        )}
      </svg>
    </div>
  );
};

// ==========================================
// CARD METRIC FILTER SELECTOR (TOTAL AMOUNT / TOTAL CASES)
// ==========================================
const CardMetricSelector = ({ value, onChange }) => (
  <div className="relative inline-flex items-center shrink-0">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-[#6366f1]/10 hover:bg-[#6366f1]/20 text-[#3730a3] text-[11px] font-extrabold py-1 pl-2.5 pr-7 rounded-lg border border-[#6366f1]/30 appearance-none cursor-pointer outline-none transition-all shadow-xs"
    >
      <option value="amount">Total Amount</option>
      <option value="cases">Total Cases</option>
    </select>
    <ChevronDown className="w-3.5 h-3.5 text-[#3730a3] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
  </div>
);

// ==========================================
// 1. DATE-WISE SALES & PROFIT DUAL LINE CHART (WITH POINTS ON EVERY DAY)
// ==========================================
const DateSalesProfitChart = ({
  dateList = [],
  metric = "amount",
  hoveredDate = null,
  onHoverDate,
}) => {
  const width = 640;
  const height = 240;
  const padL = 76;
  const padR = 18;
  const padT = 24;
  const padB = 48;

  if (!dateList.length) {
    return (
      <div className="h-56 flex items-center justify-center text-slate-400 text-xs font-semibold">
        No data for selected filters
      </div>
    );
  }

  const isAmount = metric === "amount";
  const val1Key = isAmount ? "sales" : "cases";
  const val2Key = isAmount ? "profit" : "targetCases";

  const maxVal =
    Math.max(
      ...dateList.map((d) => Math.max(d[val1Key] || 0, d[val2Key] || 0)),
      1,
    ) * 1.15;
  const ceiling = maxVal;

  const getX = (idx) =>
    padL + (idx / Math.max(dateList.length - 1, 1)) * (width - padL - padR);
  const getY = (val) =>
    padT + (1 - Math.min(val, ceiling) / ceiling) * (height - padT - padB);

  const coords1 = dateList.map((d, i) => ({
    x: getX(i),
    y: getY(d[val1Key] || 0),
    ...d,
  }));
  const coords2 = dateList.map((d, i) => ({
    x: getX(i),
    y: getY(d[val2Key] || 0),
    ...d,
  }));

  const makeStraightPath = (coords) =>
    coords.reduce((acc, pt, idx) => {
      if (idx === 0) return `M ${pt.x},${pt.y}`;
      return `${acc} L ${pt.x},${pt.y}`;
    }, "");

  const path1 = makeStraightPath(coords1);
  const path2 = makeStraightPath(coords2);

  const area1 =
    coords1.length > 0
      ? `${path1} L ${coords1[coords1.length - 1].x},${getY(0)} L ${coords1[0].x},${getY(0)} Z`
      : "";

  const labelStep = Math.max(1, Math.floor(dateList.length / 7));

  const handleMouseMove = (e) => {
    if (!onHoverDate || !dateList.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio =
      (((e.clientX - rect.left) / rect.width) * width - padL) /
      Math.max(width - padL - padR, 1);
    const idx = Math.min(
      Math.max(Math.round(ratio * (dateList.length - 1)), 0),
      dateList.length - 1,
    );
    onHoverDate(dateList[idx], idx, e);
  };

  const activeIdx = hoveredDate
    ? dateList.findIndex((d) => d.date === hoveredDate)
    : -1;

  return (
    <div
      className="w-full relative select-none cursor-crosshair"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => onHoverDate?.(null, -1, null)}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto block overflow-visible"
      >
        <defs>
          <linearGradient id="dateSalesGradDynamic" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Y Grid lines and values */}
        {[0, 0.25, 0.5, 0.75, 1].map((r) => {
          const y = getY(ceiling * r);
          const v = ceiling * r;
          return (
            <g key={r}>
              <line
                x1={padL}
                y1={y}
                x2={width - padR}
                y2={y}
                stroke="#e0e7ff"
                strokeWidth="1"
                strokeDasharray="3,3"
              />
              <text
                x={padL - 8}
                y={y + 4}
                textAnchor="end"
                className="text-[10px] fill-slate-500 font-bold select-none"
              >
                {formatShortNumber(v)}
              </text>
            </g>
          );
        })}

        {/* X Axis date labels in Indian format DD/MM/YYYY */}
        {dateList.map((d, i) => {
          if (i % labelStep !== 0 && i !== dateList.length - 1) return null;
          const parts = (d.date || "").split("-");
          const label =
            parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d.date;
          return (
            <text
              key={i}
              x={getX(i)}
              y={height - padB + 16}
              textAnchor="middle"
              className="text-[10px] fill-slate-600 font-bold select-none"
            >
              {label}
            </text>
          );
        })}

        {/* Axis titles with clean non-colliding clearance */}
        <text
          x={16}
          y={(padT + height - padB) / 2}
          textAnchor="middle"
          transform={`rotate(-90, 16, ${(padT + height - padB) / 2})`}
          className="text-[11.5px] fill-slate-700 font-extrabold select-none"
        >
          {isAmount ? "Total Amount (₹)" : "Total Cases"}
        </text>
        <text
          x={(width + padL - padR) / 2}
          y={height - 4}
          textAnchor="middle"
          className="text-[11.5px] fill-slate-700 font-extrabold select-none"
        >
          Date
        </text>

        {/* Gradient Area Fill */}
        {area1 && <path d={area1} fill="url(#dateSalesGradDynamic)" />}

        {/* Straight Line 1 (Main Sales / Cases) */}
        {path1 && (
          <path
            d={path1}
            fill="none"
            stroke="#4f46e5"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Straight Line 2 (Profit / Target if Amount) */}
        {isAmount && path2 && (
          <path
            d={path2}
            fill="none"
            stroke="#10b981"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="4,2"
          />
        )}

        {/* POINT ON EVERY SINGLE DAY READING */}
        {coords1.map((pt, i) => {
          const isAct = activeIdx === i;
          return (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={isAct ? 6 : 3.8}
              fill={isAct ? "#312e81" : "#4f46e5"}
              stroke="#ffffff"
              strokeWidth={isAct ? 2 : 1.5}
              className="transition-all"
            />
          );
        })}

        {/* Active Crosshair */}
        {activeIdx >= 0 && coords1[activeIdx] && (
          <g>
            <line
              x1={coords1[activeIdx].x}
              y1={padT}
              x2={coords1[activeIdx].x}
              y2={height - padB}
              stroke="#6366f1"
              strokeWidth="1.5"
              strokeDasharray="3,3"
            />
            <circle
              cx={coords1[activeIdx].x}
              cy={coords1[activeIdx].y}
              r={7.5}
              fill="#6366f1"
              opacity="0.35"
            />
            <circle
              cx={coords1[activeIdx].x}
              cy={coords1[activeIdx].y}
              r={4.5}
              fill="#4338ca"
              stroke="#fff"
              strokeWidth="2"
            />
          </g>
        )}
      </svg>
    </div>
  );
};

// ==========================================
// 2. TOP 10 BRANDS ON SALES BY PRODUCT (VERTICAL COLUMN BAR CHART)
// ==========================================
const Top10BrandsBarChart = ({
  products = [],
  metric = "amount",
  hoveredIdx = null,
  onHoverProduct,
}) => {
  const top10 = products.slice(0, 10);
  if (!top10.length) {
    return (
      <div className="h-56 flex items-center justify-center text-slate-400 text-xs font-semibold">
        No data
      </div>
    );
  }

  const isAmount = metric === "amount";
  const valKey = isAmount ? "amount" : "cases";
  const maxVal = Math.max(...top10.map((p) => p[valKey] || 0), 1) * 1.18;
  const ceiling = maxVal;

  const width = 640;
  const height = 265;
  const padL = 76;
  const padR = 18;
  const padT = 32;
  const padB = 88;

  const chartW = width - padL - padR;
  const chartH = height - padT - padB;
  const numBars = top10.length;
  const slotW = chartW / Math.max(numBars, 1);
  const barW = Math.min(Math.max(slotW * 0.65, 14), 32);

  const getY = (val) => padT + (1 - Math.min(val, ceiling) / ceiling) * chartH;

  return (
    <div className="w-full relative select-none">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto block overflow-visible"
      >
        {/* Y Grid lines and values */}
        {[0, 0.33, 0.66, 1].map((r) => {
          const y = getY(ceiling * r);
          const v = ceiling * r;
          return (
            <g key={r}>
              <line
                x1={padL}
                y1={y}
                x2={width - padR}
                y2={y}
                stroke="#e0e7ff"
                strokeWidth="1"
                strokeDasharray="3,3"
              />
              <text
                x={padL - 8}
                y={y + 4}
                textAnchor="end"
                className="text-[10px] fill-slate-500 font-bold select-none"
              >
                {formatShortNumber(v)}
              </text>
            </g>
          );
        })}

        {/* Y Axis Title */}
        <text
          x={16}
          y={(padT + height - padB) / 2}
          textAnchor="middle"
          transform={`rotate(-90, 16, ${(padT + height - padB) / 2})`}
          className="text-[11.5px] fill-slate-700 font-extrabold select-none"
        >
          {isAmount ? "Total Sales (₹)" : "Total Cases"}
        </text>

        {/* X Axis Title */}
        <text
          x={(width + padL - padR) / 2}
          y={height - 4}
          textAnchor="middle"
          className="text-[11.5px] fill-slate-700 font-extrabold select-none"
        >
          Top 10 Brands
        </text>

        {/* Vertical Bars */}
        {top10.map((p, idx) => {
          const val = p[valKey] || 0;
          const barH = (val / ceiling) * chartH;
          const x = padL + idx * slotW + (slotW - barW) / 2;
          const y = getY(val);
          const isH = hoveredIdx === idx;
          const labelVal = formatShortNumber(val);

          return (
            <g
              key={idx}
              className="cursor-pointer transition-all duration-200"
              onMouseEnter={(e) => onHoverProduct && onHoverProduct(p, idx, e)}
              onMouseLeave={() =>
                onHoverProduct && onHoverProduct(null, null, null)
              }
            >
              {/* Invisible wide hover area */}
              <rect
                x={padL + idx * slotW}
                y={padT}
                width={slotW}
                height={chartH}
                fill={isH ? "#6366f1" : "transparent"}
                opacity={isH ? 0.08 : 0}
                rx={4}
              />

              {/* Value Label above bar with headroom */}
              {val > 0 && (
                <text
                  x={x + barW / 2}
                  y={y - 6}
                  textAnchor="middle"
                  className={`text-[9.5px] select-none font-black ${isH ? "fill-indigo-950 font-black" : "fill-slate-700"}`}
                >
                  {labelVal}
                </text>
              )}

              {/* Bar */}
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(barH, 2)}
                rx={3}
                fill={isH ? "#4338ca" : "#6366f1"}
                className="transition-colors duration-150"
              />

              {/* Angled Brand Name below X-axis baseline */}
              <g
                transform={`translate(${x + barW / 2}, ${padT + chartH + 8})`}
              >
                <text
                  x={0}
                  y={0}
                  textAnchor="end"
                  transform="rotate(-42)"
                  className={`text-[9.5px] select-none font-bold transition-colors ${
                    isH ? "fill-indigo-950 font-black" : "fill-slate-650"
                  }`}
                  title={p.name}
                >
                  {p.name && p.name.length > 13
                    ? p.name.slice(0, 12) + "…"
                    : p.name}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ==========================================
// 3. TARGET SALES VS ACTUAL SALES DIFF BY MONTH/DAY
// ==========================================
const TargetActualDifferenceChart = ({
  dayList = [],
  metric = "amount",
  hoveredDay = null,
  onHoverDay,
}) => {
  const width = 640;
  const height = 240;
  const padL = 76;
  const padR = 18;
  const padT = 24;
  const padB = 48;

  if (!dayList.length) {
    return (
      <div className="h-56 flex items-center justify-center text-slate-400 text-xs font-semibold">
        No data
      </div>
    );
  }

  const isAmount = metric === "amount";
  const actualKey = isAmount ? "sales" : "cases";
  const targetKey = isAmount ? "targetSales" : "targetCases";

  const maxVal =
    Math.max(
      ...dayList.map((d) => Math.max(d[actualKey] || 0, d[targetKey] || 0)),
      1,
    ) * 1.18;
  const ceiling = maxVal;

  const getX = (idx) =>
    padL + (idx / Math.max(dayList.length - 1, 1)) * (width - padL - padR);
  const getY = (val) =>
    padT + (1 - Math.min(val, ceiling) / ceiling) * (height - padT - padB);

  const actualCoords = dayList.map((d, i) => ({
    x: getX(i),
    y: getY(d[actualKey] || 0),
    ...d,
  }));
  const targetCoords = dayList.map((d, i) => ({
    x: getX(i),
    y: getY(d[targetKey] || 0),
    ...d,
  }));

  const makePath = (coords) =>
    coords.reduce((acc, pt, idx, arr) => {
      if (idx === 0) return `M ${pt.x},${pt.y}`;
      const prev = arr[idx - 1];
      const midX = (prev.x + pt.x) / 2;
      return `${acc} C ${midX},${prev.y} ${midX},${pt.y} ${pt.x},${pt.y}`;
    }, "");

  const actualPath = makePath(actualCoords);
  const targetPath = makePath(targetCoords);

  const handleMouseMove = (e) => {
    if (!onHoverDay || !dayList.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio =
      (((e.clientX - rect.left) / rect.width) * width - padL) /
      Math.max(width - padL - padR, 1);
    const idx = Math.min(
      Math.max(Math.round(ratio * (dayList.length - 1)), 0),
      dayList.length - 1,
    );
    onHoverDay(dayList[idx], idx, e);
  };

  const activeIdx = hoveredDay
    ? dayList.findIndex((d) => d.day === hoveredDay)
    : -1;

  return (
    <div
      className="w-full relative select-none cursor-crosshair"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => onHoverDay?.(null, -1, null)}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto block overflow-visible"
      >
        {/* Y Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((r) => {
          const y = getY(ceiling * r);
          const v = ceiling * r;
          return (
            <g key={r}>
              <line
                x1={padL}
                y1={y}
                x2={width - padR}
                y2={y}
                stroke="#e0e7ff"
                strokeWidth="1"
                strokeDasharray="3,3"
              />
              <text
                x={padL - 8}
                y={y + 4}
                textAnchor="end"
                className="text-[10px] fill-slate-500 font-bold select-none"
              >
                {formatShortNumber(v)}
              </text>
            </g>
          );
        })}

        {/* X Axis ticks */}
        {dayList.map((d, i) => {
          if (
            i % Math.max(1, Math.floor(dayList.length / 7)) !== 0 &&
            i !== dayList.length - 1
          )
            return null;
          return (
            <text
              key={i}
              x={getX(i)}
              y={height - padB + 16}
              textAnchor="middle"
              className="text-[10px] fill-slate-600 font-bold select-none"
            >
              {d.label || d.day}
            </text>
          );
        })}

        {/* Axis titles */}
        <text
          x={16}
          y={(padT + height - padB) / 2}
          textAnchor="middle"
          transform={`rotate(-90, 16, ${(padT + height - padB) / 2})`}
          className="text-[11.5px] fill-slate-700 font-extrabold select-none"
        >
          {isAmount ? "Total Sales (₹)" : "Total Cases"}
        </text>
        <text
          x={(width + padL - padR) / 2}
          y={height - 4}
          textAnchor="middle"
          className="text-[11.5px] fill-slate-700 font-extrabold select-none"
        >
          Day
        </text>

        {/* Target Path (Cyan) */}
        {targetPath && (
          <path
            d={targetPath}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Actual Path (Purple) */}
        {actualPath && (
          <path
            d={actualPath}
            fill="none"
            stroke="#7c3aed"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Target Dots */}
        {targetCoords.map((pt, i) => (
          <circle
            key={`t-${i}`}
            cx={pt.x}
            cy={pt.y}
            r={3.8}
            fill="#38bdf8"
            stroke="#fff"
            strokeWidth={1.5}
          />
        ))}

        {/* Actual Dots & Periodic Value Badges */}
        {actualCoords.map((pt, i) => {
          const val = pt[actualKey] || 0;
          const showLabel =
            (i % Math.max(1, Math.floor(dayList.length / 6)) === 0 &&
              val > 0) ||
            activeIdx === i;
          return (
            <g key={`a-${i}`}>
              <circle
                cx={pt.x}
                cy={pt.y}
                r={activeIdx === i ? 6 : 3.8}
                fill="#7c3aed"
                stroke="#fff"
                strokeWidth={activeIdx === i ? 2 : 1.5}
              />
              {showLabel && (
                <g>
                  <rect
                    x={pt.x - 20}
                    y={pt.y - 19}
                    width={40}
                    height={15}
                    rx={3.5}
                    fill="#ffffff"
                    stroke="#cbd5e1"
                    strokeWidth={1}
                    className="shadow-xs"
                  />
                  <text
                    x={pt.x}
                    y={pt.y - 8}
                    textAnchor="middle"
                    className="text-[9.5px] font-black fill-purple-950 select-none"
                  >
                    {formatShortNumber(val)}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Active Hover Crosshair */}
        {activeIdx >= 0 && actualCoords[activeIdx] && (
          <g>
            <line
              x1={actualCoords[activeIdx].x}
              y1={padT}
              x2={actualCoords[activeIdx].x}
              y2={height - padB}
              stroke="#7c3aed"
              strokeWidth="1.5"
              strokeDasharray="3,3"
            />
          </g>
        )}
      </svg>
    </div>
  );
};

// ==========================================
// 4. SELL BY SUB HEAD CATEGORY (HORIZONTAL BAR CHART)
// ==========================================
const CategoryHorizontalBarChart = ({
  categories = [],
  metric = "amount",
  hoveredIdx = null,
  onHoverCategory,
}) => {
  if (!categories.length) {
    return (
      <div className="h-56 flex items-center justify-center text-slate-400 text-xs font-semibold">
        No data
      </div>
    );
  }

  const isAmount = metric === "amount";
  const valKey = isAmount ? "amount" : "cases";
  const maxVal = Math.max(...categories.map((c) => c[valKey] || 0), 1);

  return (
    <div className="w-full flex items-stretch gap-3 py-1 min-w-0">
      {/* Y-Axis Rotated Title: Subhead Category */}
      <div className="w-6 shrink-0 flex items-center justify-center select-none">
        <span className="text-[11.5px] font-extrabold text-slate-700 -rotate-90 whitespace-nowrap transform origin-center">
          Subhead Category
        </span>
      </div>

      {/* Main Bar Chart Container */}
      <div className="flex-1 flex flex-col justify-between gap-2 min-w-0">
        {/* Categories Rows */}
        <div className="flex flex-col gap-1.5 w-full max-h-[220px] overflow-y-auto pr-1.5 custom-scrollbar">
          {categories.map((cat, idx) => {
            const val = cat[valKey] || 0;
            const barW = Math.max(Math.min((val / maxVal) * 100, 100), 2);
            const isH = hoveredIdx === idx;
            const displayVal = isAmount
              ? formatCurrency(val)
              : `${formatShortNumber(val)} Cases`;

            return (
              <div
                key={idx}
                className={`flex items-center gap-2.5 min-w-0 cursor-pointer rounded-lg px-2 py-0.5 transition-all ${
                  isH
                    ? "bg-indigo-50/90 ring-1 ring-indigo-200"
                    : "hover:bg-slate-50"
                }`}
                onMouseEnter={(e) =>
                  onHoverCategory && onHoverCategory(cat, idx, e)
                }
                onMouseLeave={() =>
                  onHoverCategory && onHoverCategory(null, null, null)
                }
              >
                {/* Subhead Category Name */}
                <span
                  className="w-36 sm:w-44 text-[11px] font-bold text-slate-700 text-right truncate shrink-0"
                  title={cat.name}
                >
                  {cat.name}
                </span>

                {/* Bar + Value */}
                <div className="flex-1 flex items-center gap-2.5 min-w-0">
                  <div className="flex-1 bg-slate-100 rounded-md h-5 overflow-hidden flex items-center">
                    <div
                      className={`h-full rounded-md transition-all duration-300 ${
                        isH
                          ? "bg-indigo-600 shadow-sm"
                          : "bg-indigo-500 hover:bg-indigo-600"
                      }`}
                      style={{ width: `${barW}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-black text-slate-800 whitespace-nowrap shrink-0">
                    {displayVal}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Scale footer */}
        <div className="border-t border-indigo-100/80 pt-1.5 mt-0.5 flex items-center text-[10.5px] font-bold text-slate-500">
          <div className="w-36 sm:w-44 shrink-0 text-right pr-2 text-indigo-950/60 font-semibold">
            0 Axis
          </div>
          <div className="flex-1 flex items-center justify-between px-1">
            <span>0</span>
            <span>
              {isAmount
                ? formatCurrency(maxVal * 0.5)
                : `${formatShortNumber(maxVal * 0.5)} Cases`}
            </span>
            <span>
              {isAmount
                ? formatCurrency(maxVal)
                : `${formatShortNumber(maxVal)} Cases`}
            </span>
          </div>
        </div>
        <p className="text-center text-[11.5px] font-extrabold text-slate-700">
          Total Sell
        </p>
      </div>
    </div>
  );
};

// ==========================================
// MAIN DASHBOARD COMPONENT (100% REAL DATA)
// ==========================================
export default function StockBalanceDashboard({ onCollapseSidebar }) {
  // Auto-collapse the system AppSidebar when this dashboard mounts,
  // and restore it when navigating away. This is ONLY for the Stock Balance Dashboard.
  useEffect(() => {
    if (onCollapseSidebar) {
      onCollapseSidebar(true);
      return () => onCollapseSidebar(false);
    }
  }, [onCollapseSidebar]);

  // Navigation tab state
  const [activeTab, setActiveTab] = useState("Overview");

  // Interactive Floating Tooltip State
  const [tooltip, setTooltip] = useState({
    visible: false,
    x: 0,
    y: 0,
    title: "",
    badge: "",
    items: [],
  });

  const [hoveredLiquorIndex, setHoveredLiquorIndex] = useState(null);
  const [hoveredLiquorItem, setHoveredLiquorItem] = useState(null);

  const [hoveredSubheadIndex, setHoveredSubheadIndex] = useState(null);
  const [hoveredSubheadItem, setHoveredSubheadItem] = useState(null);

  const [hoveredDayProbe, setHoveredDayProbe] = useState(null);

  // Sales tab specific hover states
  const [hoveredSalesDate, setHoveredSalesDate] = useState(null);
  const [hoveredProductIdx, setHoveredProductIdx] = useState(null);
  const [hoveredMonthTrend, setHoveredMonthTrend] = useState(null);

  // Cross-chart interactive link state:
  // Related data only shows when a liquor type div is clicked (not on hover).
  // Selection clears ONLY when user clicks outside the card or clicks the same item again.
  const [clickedLiquorType, setClickedLiquorType] = useState(null);
  const [hoveredLiquorRow, setHoveredLiquorRow] = useState(null);
  const activeLiquorType = clickedLiquorType;
  const card1Ref = React.useRef(null);

  const showTooltip = useCallback((info, e) => {
    if (!e) return;
    setTooltip({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      title: info.title || "",
      badge: info.badge || "",
      items: info.items || [],
      bounds: info.bounds || null,
    });
  }, []);

  const moveTooltip = useCallback((e) => {
    if (!e) return;
    setTooltip((prev) =>
      prev.visible ? { ...prev, x: e.clientX, y: e.clientY } : prev,
    );
  }, []);

  const hideTooltip = useCallback(() => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  }, []);

  // Global click-outside listener: deselect when clicking anywhere outside card1.
  // Attached only when a selection is active; auto-cleans up on deselect or unmount.
  useEffect(() => {
    if (!clickedLiquorType) return;
    const handleClickOutside = (e) => {
      if (card1Ref.current && !card1Ref.current.contains(e.target)) {
        setClickedLiquorType(null);
        hideTooltip();
      }
    };
    // capture=true: fires at top of DOM tree before child onClick handlers
    document.addEventListener("click", handleClickOutside, true);
    return () =>
      document.removeEventListener("click", handleClickOutside, true);
  }, [clickedLiquorType, hideTooltip]);

  // Dynamic current month date range helper
  const getCurrentMonthRange = useCallback(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    return {
      start: `${y}-${m}-01`,
      end: `${y}-${m}-${String(lastDay).padStart(2, "0")}`,
    };
  }, []);

  // Filter States — strictly default to current month, fully customizable by user
  const [selectedStore, setSelectedStore] = useState("All");
  const [selectedLiquorType, setSelectedLiquorType] = useState("All");
  const [selectedSubhead, setSelectedSubhead] = useState("All");
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    return `${y}-${m}-${String(lastDay).padStart(2, "0")}`;
  });

  // Individual Metric Filters for all 4 Divs on Sales Tab ('amount' | 'cases')
  const [card1Metric, setCard1Metric] = useState("amount");
  const [card2Metric, setCard2Metric] = useState("amount");
  const [card3Metric, setCard3Metric] = useState("amount");
  const [card4Metric, setCard4Metric] = useState("amount");

  // Dynamic filter options populated strictly from database
  const [storeOptions, setStoreOptions] = useState(["All"]);
  const [liquorTypeOptions, setLiquorTypeOptions] = useState([
    "All",
    "IMFL",
    "BEER",
    "MML",
    "WINE",
  ]);
  const [subheadOptions, setSubheadOptions] = useState(["All"]);

  // Loading & Database state
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);

  // 1. Initial metadata loader: Get registered shops from shop table & stock records
  useEffect(() => {
    async function loadMetadata() {
      try {
        const [shopsRes, distinctShopsRes] = await Promise.all([
          supabase.from("shop").select("shop_name"),
          supabase.from("stock_balance_records").select("shop_id").limit(2000),
        ]);

        const names = new Set();
        if (shopsRes.data) {
          shopsRes.data.forEach((s) => {
            if (s.shop_name) names.add(s.shop_name.trim());
          });
        }
        if (distinctShopsRes.data) {
          distinctShopsRes.data.forEach((s) => {
            if (s.shop_id) names.add(s.shop_id.trim());
          });
        }

        if (names.size > 0) {
          setStoreOptions(["All", ...Array.from(names).sort()]);
        }
      } catch (err) {
        console.warn("Metadata load notice:", err);
      }
    }
    loadMetadata();
  }, []);

  // 2. Fetch real data from stock_balance_records strictly based on filters
  const fetchRealStockData = useCallback(async () => {
    setLoading(true);
    try {
      const batchSize = 1000;
      const numBatches = 8;
      const promises = [];

      for (let i = 0; i < numBatches; i++) {
        let q = supabase
          .from("stock_balance_records")
          .select(
            "date, shop_id, liquor_type, subhead, item_name, quantity_out, mrp_rate, purchase_rate, b_cs",
          )
          .gt("quantity_out", 0);

        if (selectedStore !== "All") {
          q = q.eq("shop_id", selectedStore);
        }
        if (selectedLiquorType !== "All") {
          q = q.ilike("liquor_type", `%${selectedLiquorType}%`);
        }
        if (selectedSubhead !== "All") {
          q = q.ilike("subhead", `%${selectedSubhead}%`);
        }
        if (startDate) {
          q = q.gte("date", startDate);
        }
        if (endDate) {
          q = q.lte("date", endDate);
        }

        promises.push(q.range(i * batchSize, (i + 1) * batchSize - 1));
      }

      const results = await Promise.all(promises);
      const rows = [];
      results.forEach((res) => {
        if (res.data) rows.push(...res.data);
      });

      setRecords(rows);

      // Extract dynamic subhead and liquor options from fetched real rows
      const dynamicSubheads = new Set();
      const dynamicLiquorTypes = new Set(["IMFL", "BEER", "MML", "WINE"]);
      rows.forEach((r) => {
        if (r.subhead) dynamicSubheads.add(r.subhead.trim().toUpperCase());
        if (r.liquor_type) {
          let lt = r.liquor_type.trim().toUpperCase();
          if (lt.includes("BEER")) dynamicLiquorTypes.add("BEER");
          else if (lt.includes("MML")) dynamicLiquorTypes.add("MML");
          else if (lt.includes("WINE")) dynamicLiquorTypes.add("WINE");
          else if (lt.includes("IMFL")) dynamicLiquorTypes.add("IMFL");
          else dynamicLiquorTypes.add(lt);
        }
      });

      if (dynamicSubheads.size > 0) {
        setSubheadOptions(["All", ...Array.from(dynamicSubheads).sort()]);
      }
      setLiquorTypeOptions(["All", ...Array.from(dynamicLiquorTypes).sort()]);
    } catch (err) {
      console.error("Error fetching real stock data:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedStore, selectedLiquorType, selectedSubhead, startDate, endDate]);

  useEffect(() => {
    fetchRealStockData();
  }, [fetchRealStockData]);

  // Reset filters (resets date filter strictly back to current month)
  const handleResetFilters = () => {
    setSelectedStore("All");
    setSelectedLiquorType("All");
    setSelectedSubhead("All");
    const curRange = getCurrentMonthRange();
    setStartDate(curRange.start);
    setEndDate(curRange.end);
    setClickedLiquorType(null);
    setHoveredLiquorRow(null);
    setCard1Metric("amount");
    setCard2Metric("amount");
    setCard3Metric("amount");
    setCard4Metric("amount");
  };

  // ==========================================
  // PURE DYNAMIC AGGREGATIONS (NO HARDCODING)
  // ==========================================
  const computed = useMemo(() => {
    let totalQty = 0;
    let totalSales = 0;
    let totalCost = 0;
    let totalCases = 0;

    const monthlyMap = {};
    const liquorSalesMap = { IMFL: 0, BEER: 0, MML: 0, WINE: 0 };
    const liquorCasesMap = { IMFL: 0, BEER: 0, MML: 0, WINE: 0 };
    const storeSalesMap = {};
    const subheadSalesMap = {};
    const dayWiseCasesMap = {};
    const dayWiseStatsMap = {};

    // Interactive cross-div breakdowns by liquor type
    const storeLiquorSalesMap = {};
    const subheadByLiquorMap = { IMFL: {}, BEER: {}, MML: {}, WINE: {} };
    const monthlyLiquorSalesMap = {};

    // Sales tab aggregations
    const dateWiseSalesProfitMap = {};
    const itemWiseStatsMap = {};

    records.forEach((row) => {
      const q = Number(row.quantity_out) || 0;
      const mrp = Number(row.mrp_rate) || 0;
      const pur = Number(row.purchase_rate) || 0;
      const bcs = Number(row.b_cs) > 0 ? Number(row.b_cs) : 12;

      const sale = q * mrp;
      const cost = q * pur;
      const cases = q / bcs;

      totalQty += q;
      totalSales += sale;
      totalCost += cost;
      totalCases += cases;

      // 1. Month Aggregation
      const dateStr = row.date || "";
      const monthKey = dateStr.substring(0, 7); // YYYY-MM
      const dayNum = parseInt(dateStr.split("-")[2] || "0", 10);

      if (monthKey) {
        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = {
            key: monthKey,
            sales: 0,
            cases: 0,
            cost: 0,
            imfl: 0,
            beer: 0,
            mml: 0,
            wine: 0,
            days: {},
          };
        }
        monthlyMap[monthKey].sales += sale;
        monthlyMap[monthKey].cases += cases;
        monthlyMap[monthKey].cost += cost;
        if (dayNum > 0) {
          monthlyMap[monthKey].days[dayNum] =
            (monthlyMap[monthKey].days[dayNum] || 0) + sale;
        }
      }

      // 2. Liquor Type Aggregation
      let lt = (row.liquor_type || "IMFL").trim().toUpperCase();
      if (lt.includes("BEER")) lt = "BEER";
      else if (lt.includes("MML")) lt = "MML";
      else if (lt.includes("WINE")) lt = "WINE";
      else if (lt.includes("IMFL")) lt = "IMFL";
      else lt = "IMFL";

      liquorSalesMap[lt] = (liquorSalesMap[lt] || 0) + sale;
      liquorCasesMap[lt] = (liquorCasesMap[lt] || 0) + cases;

      if (monthKey && monthlyMap[monthKey]) {
        if (lt === "IMFL") monthlyMap[monthKey].imfl += cases;
        else if (lt === "BEER") monthlyMap[monthKey].beer += cases;
        else if (lt === "MML") monthlyMap[monthKey].mml += cases;
        else if (lt === "WINE") monthlyMap[monthKey].wine += cases;
      }

      // 3. Store Aggregation
      const store = (row.shop_id || "Other").trim();
      storeSalesMap[store] = (storeSalesMap[store] || 0) + sale;

      // Cross-aggregation: store sales by liquor type
      if (!storeLiquorSalesMap[store]) storeLiquorSalesMap[store] = {};
      storeLiquorSalesMap[store][lt] =
        (storeLiquorSalesMap[store][lt] || 0) + sale;

      // 4. Subhead Aggregation
      const sh = (row.subhead || "OTHER").trim().toUpperCase();
      if (!subheadSalesMap[sh]) {
        subheadSalesMap[sh] = { amount: 0, cases: 0 };
      }
      subheadSalesMap[sh].amount += sale;
      subheadSalesMap[sh].cases += cases;

      // Cross-aggregation: subhead sales by liquor type
      if (!subheadByLiquorMap[lt]) subheadByLiquorMap[lt] = {};
      subheadByLiquorMap[lt][sh] = (subheadByLiquorMap[lt][sh] || 0) + sale;

      // Cross-aggregation: monthly sales by liquor type
      if (monthKey) {
        if (!monthlyLiquorSalesMap[monthKey])
          monthlyLiquorSalesMap[monthKey] = {};
        monthlyLiquorSalesMap[monthKey][lt] =
          (monthlyLiquorSalesMap[monthKey][lt] || 0) + sale;
      }

      // 5. Day-Wise Stats
      if (dayNum > 0) {
        dayWiseCasesMap[dayNum] = (dayWiseCasesMap[dayNum] || 0) + cases;
        if (!dayWiseStatsMap[dayNum]) {
          dayWiseStatsMap[dayNum] = {
            day: dayNum,
            sales: 0,
            cost: 0,
            cases: 0,
            qty: 0,
          };
        }
        dayWiseStatsMap[dayNum].sales += sale;
        dayWiseStatsMap[dayNum].cost += cost;
        dayWiseStatsMap[dayNum].cases += cases;
        dayWiseStatsMap[dayNum].qty += q;
      }

      // 6. Date-wise Sales & Profit (for Sales tab)
      if (dateStr) {
        if (!dateWiseSalesProfitMap[dateStr]) {
          dateWiseSalesProfitMap[dateStr] = {
            sales: 0,
            profit: 0,
            cases: 0,
            qty: 0,
          };
        }
        dateWiseSalesProfitMap[dateStr].sales += sale;
        dateWiseSalesProfitMap[dateStr].profit += sale - cost;
        dateWiseSalesProfitMap[dateStr].cases += cases;
        dateWiseSalesProfitMap[dateStr].qty += q;
      }

      // 7. Item-wise Stats (for Top 10 Products by amount and cases)
      const itemName = (row.item_name || "Unknown Item").trim();
      if (!itemWiseStatsMap[itemName]) {
        itemWiseStatsMap[itemName] = {
          name: itemName,
          amount: 0,
          cases: 0,
          qty: 0,
        };
      }
      itemWiseStatsMap[itemName].amount += sale;
      itemWiseStatsMap[itemName].cases += cases;
      itemWiseStatsMap[itemName].qty += q;
    });

    // 1. Top KPI Summary
    const totalProfit = totalSales - totalCost;

    // 2. Monthly Cards Data
    const sortedMonths = Object.keys(monthlyMap).sort();
    const monthlySalesCards = sortedMonths.map((mKey) => {
      const parts = mKey.split("-");
      const year = parseInt(parts[0], 10) || 2026;
      const monthIdx = parseInt(parts[1], 10) - 1;
      const monthLabel = `${SHORT_MONTH_NAMES[monthIdx] || parts[1]} Sales`;
      const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

      const mObj = monthlyMap[mKey];
      const sparkline = [];
      for (let d = 1; d <= daysInMonth; d++) {
        sparkline.push(mObj.days[d] || 0);
      }

      return {
        key: mKey,
        label: monthLabel,
        amount: formatCurrency(mObj.sales),
        rawSales: mObj.sales,
        daysInMonth,
        sparkline,
      };
    });

    // 3. Liquor Type Sales Breakdown
    const liquorTypeSalesList = Object.entries(liquorSalesMap)
      .map(([type, amount]) => ({
        type,
        amount,
        formatted: formatCurrency(amount),
      }))
      .sort((a, b) => b.amount - a.amount);

    const maxLiquorSale = Math.max(
      ...liquorTypeSalesList.map((l) => l.amount),
      1,
    );

    // 4. Liquor Type Case Breakdown (Donut)
    const liquorTypeCaseList = Object.entries(liquorCasesMap)
      .map(([type, cases]) => {
        const percent = totalCases > 0 ? (cases / totalCases) * 100 : 0;
        return {
          type,
          cases,
          casesFormatted: formatShortNumber(cases),
          percent: `${percent.toFixed(1)}%`,
          value: cases,
          color: LIQUOR_COLORS[type] || "#8b5cf6",
        };
      })
      .sort((a, b) => b.cases - a.cases);

    // 5. Store-Wise Sales Breakdown
    const storeWiseSalesList = Object.entries(storeSalesMap)
      .map(([store, amount]) => ({
        store,
        amount,
        formatted: formatCurrency(amount),
      }))
      .sort((a, b) => b.amount - a.amount);

    const maxStoreSale = Math.max(
      ...storeWiseSalesList.map((s) => s.amount),
      1,
    );

    // 6. Monthly Liquor Type Stacked Cases
    const monthlyStackedCases = sortedMonths.map((mKey) => {
      const parts = mKey.split("-");
      const monthIdx = parseInt(parts[1], 10) - 1;
      const mObj = monthlyMap[mKey];

      return {
        monthName: MONTH_NAMES[monthIdx] || mKey,
        totalCases: mObj.cases,
        totalFormatted: formatShortNumber(mObj.cases),
        imfl: mObj.imfl,
        beer: mObj.beer,
        mml: mObj.mml,
        wine: mObj.wine,
      };
    });

    // 7. Subhead Category Donut (Top 10)
    const sortedSubheads = Object.entries(subheadSalesMap).sort(
      (a, b) => b[1].amount - a[1].amount,
    );
    const topSubheads = sortedSubheads.slice(0, 10);
    const subheadCategoriesList = topSubheads.map(([name, data], idx) => {
      const percent = totalSales > 0 ? (data.amount / totalSales) * 100 : 0;
      return {
        name,
        amount: data.amount,
        cases: data.cases,
        amountFormatted: formatCurrency(data.amount),
        casesFormatted: `${formatShortNumber(data.cases)} Cases`,
        percent: `${percent.toFixed(1)}%`,
        value: data.amount,
        color: SUBHEAD_PALETTE[idx % SUBHEAD_PALETTE.length],
      };
    });

    // Precompute subhead breakdown per liquor type for instant responsive cross-filtering
    const subheadsByLiquorLists = {};
    ["IMFL", "BEER", "MML", "WINE"].forEach((ltype) => {
      const map = subheadByLiquorMap[ltype] || {};
      const sorted = Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      const lTotal = liquorSalesMap[ltype] || 1;
      subheadsByLiquorLists[ltype] = sorted.map(([name, amount], idx) => {
        const percent = (amount / lTotal) * 100;
        return {
          name,
          amount,
          amountFormatted: formatCurrency(amount),
          percent: `${percent.toFixed(1)}%`,
          value: amount,
          color: SUBHEAD_PALETTE[idx % SUBHEAD_PALETTE.length],
        };
      });
    });

    // 8. Monthly profit map
    const monthlyProfitMap = {};
    sortedMonths.forEach((mKey) => {
      let mProfit = 0;
      Object.entries(dateWiseSalesProfitMap).forEach(([date, v]) => {
        if (date.substring(0, 7) === mKey) mProfit += v.profit;
      });
      monthlyProfitMap[mKey] = mProfit;
    });

    // 9. Continuous date-wise list for Card 1 (every calendar day from startDate to endDate, with 0 if no reading)
    const dateWiseSalesList = [];
    if (startDate && endDate) {
      const [sy, sm, sd] = startDate.split("-").map(Number);
      const [ey, em, ed] = endDate.split("-").map(Number);
      const cur = new Date(sy, sm - 1, sd);
      const end = new Date(ey, em - 1, ed);

      while (cur <= end) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, "0");
        const d = String(cur.getDate()).padStart(2, "0");
        const dateKey = `${y}-${m}-${d}`;
        const entry = dateWiseSalesProfitMap[dateKey] || {
          sales: 0,
          profit: 0,
          cases: 0,
          qty: 0,
        };
        dateWiseSalesList.push({
          date: dateKey,
          sales: entry.sales || 0,
          profit: entry.profit || 0,
          cases: entry.cases || 0,
          qty: entry.qty || 0,
          targetCases: (entry.cases || 0) * 1.05,
        });
        cur.setDate(cur.getDate() + 1);
      }
    } else {
      Object.keys(dateWiseSalesProfitMap)
        .sort()
        .forEach((dateKey) => {
          const entry = dateWiseSalesProfitMap[dateKey];
          dateWiseSalesList.push({
            date: dateKey,
            sales: entry.sales || 0,
            profit: entry.profit || 0,
            cases: entry.cases || 0,
            qty: entry.qty || 0,
            targetCases: (entry.cases || 0) * 1.05,
          });
        });
    }

    // 10. Top 10 products for Card 2 (Top 10 brands on sales by product)
    const topProductsByAmount = Object.values(itemWiseStatsMap)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
      .map((p) => ({
        ...p,
        formatted: formatCurrency(p.amount),
        casesFormatted: `${formatShortNumber(p.cases)} Cases`,
      }));

    const topProductsByCases = Object.values(itemWiseStatsMap)
      .sort((a, b) => b.cases - a.cases)
      .slice(0, 10)
      .map((p) => ({
        ...p,
        formatted: formatCurrency(p.amount),
        casesFormatted: `${formatShortNumber(p.cases)} Cases`,
      }));

    // 11. Day-wise comparison list for Card 3 (Target Sales vs Actual sales diff)
    const dayWiseTrendList = [];
    const avgDailySales =
      totalSales / Math.max(Object.keys(dayWiseStatsMap).length, 1);
    const avgDailyCases =
      totalCases / Math.max(Object.keys(dayWiseStatsMap).length, 1);

    for (let d = 1; d <= 31; d++) {
      const item = dayWiseStatsMap[d] || {
        day: d,
        sales: 0,
        cost: 0,
        cases: 0,
        qty: 0,
      };
      const profit = item.sales - item.cost;
      // Benchmark average line without artificial variance
      const targetSales = avgDailySales;
      const targetCases = avgDailyCases;

      dayWiseTrendList.push({
        day: d,
        label: `${d}`,
        sales: item.sales,
        cost: item.cost,
        profit,
        cases: item.cases,
        qty: item.qty,
        targetSales,
        targetCases,
      });
    }

    // 12. Subhead category breakdown for Card 4 (Sales by Product Category)
    const categoryBreakdownByAmount = sortedSubheads
      .slice(0, 10)
      .map(([name, data]) => ({
        name,
        amount: data.amount,
        cases: data.cases,
        amountFormatted: formatCurrency(data.amount),
        casesFormatted: `${formatShortNumber(data.cases)} Cases`,
      }));

    const categoryBreakdownByCases = Object.entries(subheadSalesMap)
      .sort((a, b) => b[1].cases - a[1].cases)
      .slice(0, 10)
      .map(([name, data]) => ({
        name,
        amount: data.amount,
        cases: data.cases,
        amountFormatted: formatCurrency(data.amount),
        casesFormatted: `${formatShortNumber(data.cases)} Cases`,
      }));

    return {
      totalProfitFormatted: formatCurrency(totalProfit),
      totalQtyFormatted: formatShortNumber(totalQty),
      totalCasesFormatted: formatShortNumber(totalCases),
      totalSalesFormatted: formatCurrency(totalSales),
      totalSalesRaw: totalSales,
      totalCasesRaw: totalCases,
      monthlySalesCards,
      liquorTypeSalesList,
      maxLiquorSale,
      liquorTypeCaseList,
      storeWiseSalesList,
      maxStoreSale,
      monthlyStackedCases,
      dayWiseCasesMap,
      subheadCategoriesList,
      storeLiquorSalesMap,
      subheadByLiquorMap,
      monthlyLiquorSalesMap,
      subheadsByLiquorLists,
      dateWiseSalesList,
      topProductsByAmount,
      topProductsByCases,
      dayWiseTrendList,
      categoryBreakdownByAmount,
      categoryBreakdownByCases,
      monthlyProfitMap,
    };
  }, [records, startDate, endDate]);

  return (
    <div className="min-h-screen bg-[#f5f0e8] p-2.5 sm:p-4 font-sans text-slate-800 flex justify-center">
      <div className="w-full max-w-[1680px] bg-white rounded-3xl border border-[#C9A84C]/30 shadow-xl overflow-hidden flex flex-col lg:flex-row">
        {/* ========================================================= */}
        {/* COMMON SIDEBAR CONTROLS & BRANDING ACROSS ALL TABS */}
        {/* ========================================================= */}
        <DashboardFilterSidebar
          computed={computed}
          activeLiquorType={activeLiquorType}
          selectedStore={selectedStore}
          setSelectedStore={setSelectedStore}
          storeOptions={storeOptions}
          selectedLiquorType={selectedLiquorType}
          setSelectedLiquorType={setSelectedLiquorType}
          liquorTypeOptions={liquorTypeOptions}
          selectedSubhead={selectedSubhead}
          setSelectedSubhead={setSelectedSubhead}
          subheadOptions={subheadOptions}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          formatIndianDate={formatIndianDate}
        />

        {/* ========================================================= */}
        {/* MAIN DASHBOARD CONTENT AREA */}
        {/* ========================================================= */}
        <main className="flex-1 p-3.5 sm:p-5 flex flex-col gap-3.5 overflow-x-hidden">
          {/* TOP HEADER */}
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5 flex-1">
              <button
                onClick={() => setActiveTab("Overview")}
                className={`min-w-28 py-2.5 sm:py-3 px-5 sm:px-8 rounded-2xl font-bold text-sm tracking-wide transition-all shadow-sm cursor-pointer ${
                  activeTab === "Overview"
                    ? "bg-[#180e5b] text-white shadow-indigo-950/20"
                    : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab("Sales")}
                className={`min-w-28 py-2.5 sm:py-3 px-5 sm:px-8 rounded-2xl font-bold text-sm tracking-wide transition-all shadow-sm cursor-pointer ${
                  activeTab === "Sales"
                    ? "bg-[#180e5b] text-white shadow-indigo-950/20"
                    : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
                }`}
              >
                Sales
              </button>
            </div>

            {/* Eraser / Reset Button */}
            <button
              onClick={handleResetFilters}
              title="Reset All Filters"
              className="p-3 px-3.5 bg-[#7878fa] hover:bg-[#6060ee] text-white rounded-2xl shadow-sm transition-all flex items-center justify-center shrink-0 cursor-pointer"
            >
              <Eraser className="w-5 h-5 stroke-2" />
            </button>
          </header>

          {/* LOADING STATE INDICATOR */}
          {loading && (
            <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-2 rounded-xl flex items-center gap-2 text-xs font-bold animate-pulse">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
              <span>
                Fetching and aggregating real stock balance records from
                database...
              </span>
            </div>
          )}

          {/* EMPTY STATE IF 0 RECORDS MATCH */}
          {!loading && records.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="text-xs">
                <p className="font-bold">
                  No stock balance records found for the selected filter
                  criteria.
                </p>
                <p className="text-amber-700 mt-0.5">
                  Try resetting filters or expanding the date range to see real
                  stock data.
                </p>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TOP MONTHLY SALES CARDS WITH REAL SPARKLINES */}
          {/* ========================================================= */}
          {activeTab === "Overview" && (
            <>
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {computed.monthlySalesCards.map((item, idx) => (
                  <MonthlySalesCard
                    key={item.key || idx}
                    item={item}
                    activeLiquorType={activeLiquorType}
                    liquorSalesAmount={
                      activeLiquorType
                        ? computed.monthlyLiquorSalesMap[item.key]?.[
                            activeLiquorType
                          ] || 0
                        : null
                    }
                    onShowTooltip={showTooltip}
                    onMoveTooltip={moveTooltip}
                    onHideTooltip={hideTooltip}
                  />
                ))}
              </section>

              {/* ========================================================= */}
              {/* MIDDLE ROW: 3 MAJOR REAL VISUALIZATIONS */}
              {/* ========================================================= */}
              <section className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
                {/* Card 1: Liquor Type Wise Sale Amount (Real DB) */}
                <div
                  ref={card1Ref}
                  className={`bg-[#f8fcff] rounded-2xl p-3.5 sm:p-4 border-2 transition-all flex flex-col min-w-0 overflow-hidden shadow-xs relative ${activeLiquorType ? "border-indigo-400 ring-2 ring-indigo-200/50" : "border-[#b8ddf8]"}`}
                  onMouseLeave={() => {
                    hideTooltip();
                  }}
                >
                  {/* Centered Title with absolute badges */}
                  <div className="relative mb-2.5 min-w-0 flex items-center justify-center">
                    <h2 className="text-center text-sm sm:text-base font-extrabold text-slate-800 tracking-tight">
                      Liquor Type Wise Sale Amount
                    </h2>
                    {clickedLiquorType ? (
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-300 flex items-center gap-1 shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
                          Showing: {clickedLiquorType}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setClickedLiquorType(null);
                            hideTooltip();
                          }}
                          className="text-[9px] font-bold text-slate-500 hover:text-slate-900 cursor-pointer bg-slate-200/80 hover:bg-slate-300 px-1.5 py-0.5 rounded"
                          title="Clear selection"
                        >
                          ✕
                        </button>
                      </div>
                    ) : hoveredLiquorRow ? (
                      <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[9px] text-indigo-700 font-bold bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full shadow-2xs shrink-0 truncate max-w-36 animate-fade-in">
                        Click div to view related data
                      </span>
                    ) : null}
                  </div>

                  <div className="flex-1 flex items-center min-w-0 overflow-hidden">
                    <div className="w-5 -rotate-90 text-[10px] font-bold text-slate-700 text-center whitespace-nowrap select-none shrink-0">
                      Liquor Type
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-center gap-2.5 py-1">
                      {computed.liquorTypeSalesList.map((item, idx) => {
                        const widthPercent = Math.min(
                          (item.amount / computed.maxLiquorSale) * 100,
                          100,
                        );
                        const sharePercent =
                          computed.totalSalesRaw > 0
                            ? (
                                (item.amount / computed.totalSalesRaw) *
                                100
                              ).toFixed(1)
                            : "0";
                        const isSelected = activeLiquorType === item.type;
                        const isOther =
                          activeLiquorType !== null && !isSelected;

                        return (
                          <div
                            key={idx}
                            className={`flex items-center gap-2 min-w-0 group/bar cursor-pointer rounded-xl px-2 py-1 transition-all duration-200 select-none ${
                              isSelected
                                ? "bg-indigo-100 shadow-sm ring-2 ring-indigo-500 font-black"
                                : isOther
                                  ? "opacity-40 hover:opacity-85"
                                  : "hover:bg-indigo-50/80"
                            }`}
                            onMouseEnter={(e) => {
                              setHoveredLiquorRow(item.type);
                              // When clicked, hide any tooltip and don't show hover div for it
                              if (clickedLiquorType === item.type) {
                                hideTooltip();
                                return;
                              }
                              const rect = card1Ref.current
                                ? card1Ref.current.getBoundingClientRect()
                                : null;
                              showTooltip(
                                {
                                  title: item.type,
                                  badge: "Click to view related data",
                                  bounds: rect
                                    ? {
                                        left: rect.left,
                                        right: rect.right,
                                        top: rect.top,
                                        bottom: rect.bottom,
                                      }
                                    : null,
                                  items: [
                                    {
                                      label: "Sales Amount",
                                      value: item.formatted,
                                      color:
                                        LIQUOR_COLORS[item.type] || "#818cf8",
                                    },
                                    {
                                      label: "Exact Sales (₹)",
                                      value:
                                        "₹ " +
                                        Math.round(item.amount).toLocaleString(
                                          "en-IN",
                                        ),
                                    },
                                    {
                                      label: "Share of Sales",
                                      value: `${sharePercent}%`,
                                    },
                                  ],
                                },
                                e,
                              );
                            }}
                            onMouseMove={(e) => {
                              if (clickedLiquorType === item.type) return;
                              moveTooltip(e);
                            }}
                            onMouseLeave={() => {
                              setHoveredLiquorRow(null);
                              hideTooltip();
                              // NOTE: do NOT unclick on hover-out — only global click-outside deselects
                            }}
                            onClick={() => {
                              setClickedLiquorType((prev) =>
                                prev === item.type ? null : item.type,
                              );
                              hideTooltip(); // Hide hover div immediately when clicked!
                            }}
                          >
                            <span
                              className={`w-11 text-[11px] text-right shrink-0 transition-colors pointer-events-none ${
                                isSelected
                                  ? "text-indigo-950 font-black"
                                  : "text-slate-700 font-bold"
                              }`}
                            >
                              {item.type}
                            </span>
                            <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden pointer-events-none">
                              <div
                                className={`h-7 rounded-r-xs transition-all duration-300 shrink-0 shadow-xs ${
                                  isSelected
                                    ? "bg-indigo-600 scale-y-110 shadow-md ring-2 ring-indigo-300"
                                    : "bg-[#818cf8] group-hover/bar:bg-indigo-500"
                                }`}
                                style={{
                                  width: `${Math.min(Math.max(widthPercent * 0.7, 4), 70)}%`,
                                }}
                              ></div>
                              <span
                                className={`text-[10px] sm:text-[11px] whitespace-nowrap shrink-0 transition-colors ${
                                  isSelected
                                    ? "text-indigo-950 font-black scale-105"
                                    : "text-slate-700 font-bold"
                                }`}
                              >
                                {item.formatted}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* X Axis scale */}
                  <div className="border-t border-[#b8ddf8] pt-1.5 mt-2 min-w-0">
                    <div className="flex justify-between text-[9px] font-semibold text-slate-500 pl-14 pr-1 min-w-0">
                      <span>0</span>
                      <span className="truncate px-1">
                        {formatCurrency(computed.maxLiquorSale * 0.33)}
                      </span>
                      <span className="truncate px-1">
                        {formatCurrency(computed.maxLiquorSale * 0.66)}
                      </span>
                      <span className="truncate">
                        {formatCurrency(computed.maxLiquorSale)}
                      </span>
                    </div>
                    <p className="text-center text-[10px] font-bold text-slate-700 mt-0.5">
                      Sales Amount (₹)
                    </p>
                  </div>
                </div>

                {/* Card 2: Liquor Type Wise Case Sale (Real DB) */}
                <div
                  className={`bg-[#f8fcff] rounded-2xl p-3.5 sm:p-4 border-2 transition-all flex flex-col min-w-0 overflow-hidden shadow-xs ${activeLiquorType ? "border-indigo-400 ring-2 ring-indigo-200/50" : "border-[#b8ddf8]"}`}
                >
                  {/* Centered Title with absolute badge */}
                  <div className="relative mb-2.5 min-w-0 flex items-center justify-center">
                    <h2 className="text-center text-sm sm:text-base font-extrabold text-slate-800 tracking-tight">
                      Liquor Type Wise Case Sale
                    </h2>
                    {activeLiquorType && (
                      <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[9px] font-black text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-200 shrink-0">
                        Linked: {activeLiquorType}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-2 py-1 min-w-0 overflow-hidden">
                    <div className="relative p-1 shrink-0">
                      <DonutChart
                        data={computed.liquorTypeCaseList}
                        centerValue={
                          activeLiquorType
                            ? computed.liquorTypeCaseList.find(
                                (l) => l.type === activeLiquorType,
                              )?.casesFormatted || "0"
                            : hoveredLiquorItem
                              ? hoveredLiquorItem.casesFormatted
                              : computed.totalCasesFormatted
                        }
                        centerLabel={
                          activeLiquorType
                            ? activeLiquorType
                            : hoveredLiquorItem
                              ? hoveredLiquorItem.type
                              : "Total Cases"
                        }
                        size={140}
                        strokeWidth={20}
                        hoveredIndex={
                          activeLiquorType
                            ? computed.liquorTypeCaseList.findIndex(
                                (l) => l.type === activeLiquorType,
                              )
                            : hoveredLiquorIndex
                        }
                        onHoverSlice={(slice, idx, e) => {
                          setHoveredLiquorIndex(idx);
                          setHoveredLiquorItem(slice);
                          if (slice && e) {
                            showTooltip(
                              {
                                title: slice.type,
                                badge: "Cases Share",
                                items: [
                                  {
                                    label: "Cases Sold",
                                    value: slice.casesFormatted + " Cases",
                                    color: slice.color,
                                  },
                                  {
                                    label: "Exact Cases",
                                    value: Math.round(
                                      slice.cases,
                                    ).toLocaleString("en-IN"),
                                  },
                                  {
                                    label: "Share of Cases",
                                    value: slice.percent,
                                  },
                                ],
                              },
                              e,
                            );
                          } else {
                            hideTooltip();
                          }
                        }}
                      />
                    </div>

                    {/* Legend with real cases and percentages */}
                    <div className="flex flex-col gap-1.5 min-w-0 flex-1 max-w-[130px] pl-1">
                      <span className="text-[11px] font-black text-slate-800 mb-0.5">
                        Liquor Type
                      </span>
                      {computed.liquorTypeCaseList.map((item, idx) => {
                        const isLinked = activeLiquorType === item.type;
                        const isOther = activeLiquorType !== null && !isLinked;

                        return (
                          <div
                            key={idx}
                            className={`flex items-center gap-1.5 text-[11px] font-bold min-w-0 cursor-pointer p-1 rounded transition-all ${
                              isLinked
                                ? "bg-indigo-100 text-indigo-950 font-black ring-1 ring-indigo-400 scale-102 shadow-2xs"
                                : isOther
                                  ? "opacity-35 text-slate-400"
                                  : hoveredLiquorIndex === idx
                                    ? "bg-indigo-50 text-indigo-900 font-black"
                                    : "text-slate-700 hover:text-slate-900"
                            }`}
                            onMouseEnter={(e) => {
                              setHoveredLiquorIndex(idx);
                              setHoveredLiquorItem(item);
                              showTooltip(
                                {
                                  title: item.type,
                                  badge: "Cases Share",
                                  items: [
                                    {
                                      label: "Cases Sold",
                                      value: item.casesFormatted + " Cases",
                                      color: item.color,
                                    },
                                    {
                                      label: "Exact Cases",
                                      value: Math.round(
                                        item.cases,
                                      ).toLocaleString("en-IN"),
                                    },
                                    {
                                      label: "Share of Cases",
                                      value: item.percent,
                                    },
                                  ],
                                },
                                e,
                              );
                            }}
                            onMouseMove={moveTooltip}
                            onMouseLeave={() => {
                              setHoveredLiquorIndex(null);
                              setHoveredLiquorItem(null);
                              hideTooltip();
                            }}
                          >
                            <div
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: item.color }}
                            ></div>
                            <span className="truncate">{item.type}</span>
                            <span
                              className={`text-[9px] ml-auto shrink-0 ${isLinked ? "font-black text-indigo-900" : "text-slate-500"}`}
                            >
                              {item.percent}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Bottom callout summary from real data */}
                  <div className="grid grid-cols-4 gap-1 text-center border-t border-[#b8ddf8] pt-1.5 text-[9px] font-bold text-slate-600 min-w-0">
                    {computed.liquorTypeCaseList
                      .slice(0, 4)
                      .map((item, idx) => {
                        const isLinked = activeLiquorType === item.type;
                        return (
                          <div
                            key={idx}
                            className={`truncate transition-all ${isLinked ? "bg-indigo-100/90 text-indigo-950 rounded py-0.5 ring-1 ring-indigo-300 font-black scale-105" : activeLiquorType ? "opacity-40" : ""}`}
                          >
                            <span className="block text-slate-900 font-black truncate">
                              {item.casesFormatted}
                            </span>
                            <span className="truncate">{item.percent}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Card 3: Store Wise Sale Amount (Real DB) */}
                <div
                  className={`bg-[#f8fcff] rounded-2xl p-3.5 sm:p-4 border-2 transition-all flex flex-col min-w-0 overflow-hidden shadow-xs ${activeLiquorType ? "border-indigo-400 ring-2 ring-indigo-200/50" : "border-[#b8ddf8]"}`}
                >
                  {/* Centered Title with absolute badge */}
                  <div className="relative mb-2.5 min-w-0 flex items-center justify-center">
                    <h2 className="text-center text-sm sm:text-base font-extrabold text-slate-800 tracking-tight">
                      Store Wise Sale Amount
                    </h2>
                    {activeLiquorType && (
                      <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[9px] font-black text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-200 shrink-0">
                        Showing: {activeLiquorType}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 flex items-center min-w-0 overflow-hidden">
                    <div className="w-5 -rotate-90 text-[10px] font-bold text-slate-700 text-center whitespace-nowrap select-none shrink-0">
                      Store
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-center gap-1.5 py-0.5">
                      {computed.storeWiseSalesList.map((item, idx) => {
                        const widthPercent = Math.min(
                          (item.amount / computed.maxStoreSale) * 100,
                          100,
                        );
                        const contribution =
                          computed.totalSalesRaw > 0
                            ? (
                                (item.amount / computed.totalSalesRaw) *
                                100
                              ).toFixed(1)
                            : "0";

                        const storeLiquorSale = activeLiquorType
                          ? computed.storeLiquorSalesMap[item.store]?.[
                              activeLiquorType
                            ] || 0
                          : 0;
                        const liquorShare =
                          item.amount > 0 && activeLiquorType
                            ? ((storeLiquorSale / item.amount) * 100).toFixed(0)
                            : "0";

                        return (
                          <div
                            key={idx}
                            className="flex items-center gap-1.5 min-w-0 group/store cursor-pointer rounded-lg px-1 py-0.5 transition-colors hover:bg-indigo-50/80"
                            onMouseEnter={(e) =>
                              showTooltip(
                                {
                                  title: item.store,
                                  badge: activeLiquorType
                                    ? `${activeLiquorType} Sales`
                                    : "Store Sales",
                                  items: [
                                    ...(activeLiquorType
                                      ? [
                                          {
                                            label: `${activeLiquorType} Sales`,
                                            value:
                                              formatCurrency(storeLiquorSale),
                                            color: "#4f46e5",
                                          },
                                          {
                                            label: "Exact Liquor (₹)",
                                            value:
                                              "₹ " +
                                              Math.round(
                                                storeLiquorSale,
                                              ).toLocaleString("en-IN"),
                                          },
                                          {
                                            label: `Share of ${item.store}`,
                                            value: `${liquorShare}%`,
                                          },
                                          {
                                            label: "Store Total Sales",
                                            value: item.formatted,
                                          },
                                        ]
                                      : [
                                          {
                                            label: "Sales Amount",
                                            value: item.formatted,
                                            color: "#818cf8",
                                          },
                                          {
                                            label: "Exact Sales (₹)",
                                            value:
                                              "₹ " +
                                              Math.round(
                                                item.amount,
                                              ).toLocaleString("en-IN"),
                                          },
                                          {
                                            label: "Contribution",
                                            value: `${contribution}% of Total`,
                                          },
                                        ]),
                                  ],
                                },
                                e,
                              )
                            }
                            onMouseMove={moveTooltip}
                            onMouseLeave={hideTooltip}
                          >
                            <span
                              className="w-22 text-[10px] font-bold text-slate-700 text-right truncate shrink-0 group-hover/store:text-indigo-900"
                              title={item.store}
                            >
                              {item.store}
                            </span>

                            <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden">
                              {activeLiquorType ? (
                                // Cross-highlight dual bar
                                <div
                                  className="relative h-4 rounded-r-xs overflow-hidden shrink-0 bg-slate-200/90"
                                  style={{
                                    width: `${Math.min(Math.max(widthPercent * 0.68, 5), 68)}%`,
                                  }}
                                >
                                  <div
                                    className="h-full bg-indigo-600 rounded-r-xs transition-all duration-300 shadow-xs"
                                    style={{
                                      width: `${Math.min(Math.max((storeLiquorSale / (item.amount || 1)) * 100, storeLiquorSale > 0 ? 5 : 0), 100)}%`,
                                    }}
                                  ></div>
                                </div>
                              ) : (
                                <div
                                  className="h-4 bg-[#818cf8] rounded-r-xs transition-all duration-300 group-hover/store:bg-indigo-600 group-hover/store:scale-y-110 shrink-0 shadow-xs"
                                  style={{
                                    width: `${Math.min(Math.max(widthPercent * 0.68, 5), 68)}%`,
                                  }}
                                ></div>
                              )}

                              <span className="text-[9px] sm:text-[10px] font-bold text-slate-700 whitespace-nowrap shrink-0 group-hover/store:text-indigo-900">
                                {activeLiquorType
                                  ? formatCurrency(storeLiquorSale)
                                  : item.formatted}
                                {activeLiquorType && storeLiquorSale > 0 && (
                                  <span className="text-[8px] text-indigo-600 ml-1 font-black">
                                    ({liquorShare}%)
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* X Axis scale */}
                  <div className="border-t border-[#b8ddf8] pt-1.5 mt-1 min-w-0">
                    <div className="flex justify-between text-[9px] font-semibold text-slate-500 pl-24 pr-1 min-w-0">
                      <span>0</span>
                      <span className="truncate px-1">
                        {formatCurrency(computed.maxStoreSale * 0.5)}
                      </span>
                      <span className="truncate">
                        {formatCurrency(computed.maxStoreSale)}
                      </span>
                    </div>
                    <p className="text-center text-[10px] font-bold text-slate-700 mt-0.5">
                      {activeLiquorType
                        ? `${activeLiquorType} Sales Amount (₹)`
                        : "Sales Amount (₹)"}
                    </p>
                  </div>
                </div>
              </section>

              {/* ========================================================= */}
              {/* BOTTOM ROW: 3 MAJOR REAL VISUALIZATIONS */}
              {/* ========================================================= */}
              <section className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
                {/* Card 4: Monthly Liquor Type Case Sold (Real DB Stacked Columns) */}
                <div
                  className={`bg-[#f8fcff] rounded-2xl p-3.5 sm:p-4 border-2 transition-all flex flex-col min-w-0 overflow-hidden shadow-xs ${activeLiquorType ? "border-indigo-400 ring-2 ring-indigo-200/50" : "border-[#b8ddf8]"}`}
                >
                  {/* Centered Title with absolute badge */}
                  <div className="relative mb-2 min-w-0 flex items-center justify-center">
                    <h2 className="text-center text-sm sm:text-base font-extrabold text-slate-800 tracking-tight">
                      Monthly Liquor Type Case Sold
                    </h2>
                    {activeLiquorType && (
                      <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[9px] font-black text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-200 shrink-0">
                        Linked: {activeLiquorType} Cases
                      </span>
                    )}
                  </div>

                  {/* Top Legend */}
                  <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] font-bold text-slate-700 mb-2">
                    <span className="font-black text-slate-800">
                      Liquor Type:
                    </span>
                    {[
                      { type: "IMFL", color: "#160c5c" },
                      { type: "BEER", color: "#3b82f6" },
                      { type: "MML", color: "#f43f5e" },
                      { type: "WINE", color: "#eab308" },
                    ].map((lg) => {
                      const isLinked = activeLiquorType === lg.type;
                      const isOther = activeLiquorType !== null && !isLinked;
                      return (
                        <span
                          key={lg.type}
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full transition-all cursor-pointer ${
                            isLinked
                              ? "bg-indigo-100 ring-1 ring-indigo-400 font-black text-indigo-950 scale-105"
                              : isOther
                                ? "opacity-35 text-slate-400"
                                : "hover:bg-slate-100"
                          }`}
                          onClick={() =>
                            setPinnedLiquorType((prev) =>
                              prev === lg.type ? null : lg.type,
                            )
                          }
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: lg.color }}
                          ></span>
                          {lg.type}
                        </span>
                      );
                    })}
                  </div>

                  {/* Chart with Y-Axis and Stacked Columns strictly contained */}
                  <div className="flex-1 flex items-stretch min-w-0 overflow-hidden">
                    <div className="w-5 -rotate-90 text-[10px] font-bold text-slate-700 self-center whitespace-nowrap select-none shrink-0">
                      Total Cases
                    </div>

                    <div className="flex-1 flex items-end justify-around gap-2 px-2 pt-2 pb-1 h-40 overflow-hidden">
                      {computed.monthlyStackedCases.map((m, idx) => {
                        const maxTotalCases = Math.max(
                          ...computed.monthlyStackedCases.map(
                            (i) => i.totalCases,
                          ),
                          1,
                        );
                        const maxStackH = 105; // fixed max stack height in px
                        const stackHeight = Math.max(
                          (m.totalCases / maxTotalCases) * maxStackH,
                          14,
                        );
                        const sumCases = m.imfl + m.beer + m.mml + m.wine || 1;

                        const imflH = (m.imfl / sumCases) * stackHeight;
                        const beerH = (m.beer / sumCases) * stackHeight;
                        const mmlH = (m.mml / sumCases) * stackHeight;
                        const wineH = (m.wine / sumCases) * stackHeight;

                        return (
                          <div
                            key={idx}
                            className="flex-1 flex flex-col items-center h-full justify-end max-w-20 min-w-0"
                          >
                            <span
                              className={`text-[10px] font-black mb-1 truncate ${activeLiquorType ? "text-indigo-700 bg-indigo-50 px-1 rounded border border-indigo-200" : "text-slate-900"}`}
                            >
                              {activeLiquorType
                                ? formatShortNumber(
                                    m[activeLiquorType.toLowerCase()],
                                  )
                                : m.totalFormatted}
                            </span>

                            <div className="w-full max-w-11 rounded-t-xs overflow-hidden flex flex-col-reverse shadow-xs shrink-0">
                              {imflH > 0 && (
                                <div
                                  className={`bg-[#160c5c] text-white text-[8px] font-black flex items-center justify-center overflow-hidden shrink-0 cursor-pointer transition-all ${
                                    activeLiquorType === "IMFL"
                                      ? "brightness-125 z-10 ring-2 ring-white scale-x-105 shadow-md"
                                      : activeLiquorType
                                        ? "opacity-25 grayscale-30"
                                        : "hover:brightness-125"
                                  }`}
                                  style={{ height: `${imflH}px` }}
                                  onMouseEnter={(e) =>
                                    showTooltip(
                                      {
                                        title: `${m.monthName} - IMFL`,
                                        badge: "Monthly Stack",
                                        items: [
                                          {
                                            label: "IMFL Cases",
                                            value:
                                              formatShortNumber(m.imfl) +
                                              " Cases",
                                            color: "#160c5c",
                                          },
                                          {
                                            label: "Exact Cases",
                                            value: Math.round(
                                              m.imfl,
                                            ).toLocaleString("en-IN"),
                                          },
                                          {
                                            label: "Month Total",
                                            value: m.totalFormatted + " Cases",
                                          },
                                          {
                                            label: "Month Share",
                                            value: `${((m.imfl / (sumCases || 1)) * 100).toFixed(1)}%`,
                                          },
                                        ],
                                      },
                                      e,
                                    )
                                  }
                                  onMouseMove={moveTooltip}
                                  onMouseLeave={hideTooltip}
                                >
                                  {activeLiquorType === "IMFL"
                                    ? formatShortNumber(m.imfl)
                                    : imflH >= 16
                                      ? formatShortNumber(m.imfl)
                                      : null}
                                </div>
                              )}
                              {beerH > 0 && (
                                <div
                                  className={`bg-[#3b82f6] text-white text-[8px] font-black flex items-center justify-center overflow-hidden shrink-0 cursor-pointer transition-all ${
                                    activeLiquorType === "BEER"
                                      ? "brightness-125 z-10 ring-2 ring-white scale-x-105 shadow-md"
                                      : activeLiquorType
                                        ? "opacity-25 grayscale-30"
                                        : "hover:brightness-125"
                                  }`}
                                  style={{ height: `${beerH}px` }}
                                  onMouseEnter={(e) =>
                                    showTooltip(
                                      {
                                        title: `${m.monthName} - BEER`,
                                        badge: "Monthly Stack",
                                        items: [
                                          {
                                            label: "BEER Cases",
                                            value:
                                              formatShortNumber(m.beer) +
                                              " Cases",
                                            color: "#3b82f6",
                                          },
                                          {
                                            label: "Exact Cases",
                                            value: Math.round(
                                              m.beer,
                                            ).toLocaleString("en-IN"),
                                          },
                                          {
                                            label: "Month Total",
                                            value: m.totalFormatted + " Cases",
                                          },
                                          {
                                            label: "Month Share",
                                            value: `${((m.beer / (sumCases || 1)) * 100).toFixed(1)}%`,
                                          },
                                        ],
                                      },
                                      e,
                                    )
                                  }
                                  onMouseMove={moveTooltip}
                                  onMouseLeave={hideTooltip}
                                >
                                  {activeLiquorType === "BEER"
                                    ? formatShortNumber(m.beer)
                                    : beerH >= 16
                                      ? formatShortNumber(m.beer)
                                      : null}
                                </div>
                              )}
                              {mmlH > 0 && (
                                <div
                                  className={`bg-[#f43f5e] text-white text-[8px] font-black flex items-center justify-center overflow-hidden shrink-0 cursor-pointer transition-all ${
                                    activeLiquorType === "MML"
                                      ? "brightness-125 z-10 ring-2 ring-white scale-x-105 shadow-md"
                                      : activeLiquorType
                                        ? "opacity-25 grayscale-30"
                                        : "hover:brightness-125"
                                  }`}
                                  style={{ height: `${mmlH}px` }}
                                  onMouseEnter={(e) =>
                                    showTooltip(
                                      {
                                        title: `${m.monthName} - MML`,
                                        badge: "Monthly Stack",
                                        items: [
                                          {
                                            label: "MML Cases",
                                            value:
                                              formatShortNumber(m.mml) +
                                              " Cases",
                                            color: "#f43f5e",
                                          },
                                          {
                                            label: "Exact Cases",
                                            value: Math.round(
                                              m.mml,
                                            ).toLocaleString("en-IN"),
                                          },
                                          {
                                            label: "Month Total",
                                            value: m.totalFormatted + " Cases",
                                          },
                                          {
                                            label: "Month Share",
                                            value: `${((m.mml / (sumCases || 1)) * 100).toFixed(1)}%`,
                                          },
                                        ],
                                      },
                                      e,
                                    )
                                  }
                                  onMouseMove={moveTooltip}
                                  onMouseLeave={hideTooltip}
                                >
                                  {activeLiquorType === "MML"
                                    ? formatShortNumber(m.mml)
                                    : mmlH >= 16
                                      ? formatShortNumber(m.mml)
                                      : null}
                                </div>
                              )}
                              {wineH > 0 && (
                                <div
                                  className={`bg-[#eab308] text-white text-[8px] font-black flex items-center justify-center overflow-hidden shrink-0 cursor-pointer transition-all ${
                                    activeLiquorType === "WINE"
                                      ? "brightness-125 z-10 ring-2 ring-white scale-x-105 shadow-md"
                                      : activeLiquorType
                                        ? "opacity-25 grayscale-30"
                                        : "hover:brightness-125"
                                  }`}
                                  style={{ height: `${wineH}px` }}
                                  onMouseEnter={(e) =>
                                    showTooltip(
                                      {
                                        title: `${m.monthName} - WINE`,
                                        badge: "Monthly Stack",
                                        items: [
                                          {
                                            label: "WINE Cases",
                                            value:
                                              formatShortNumber(m.wine) +
                                              " Cases",
                                            color: "#eab308",
                                          },
                                          {
                                            label: "Exact Cases",
                                            value: Math.round(
                                              m.wine,
                                            ).toLocaleString("en-IN"),
                                          },
                                          {
                                            label: "Month Total",
                                            value: m.totalFormatted + " Cases",
                                          },
                                          {
                                            label: "Month Share",
                                            value: `${((m.wine / (sumCases || 1)) * 100).toFixed(1)}%`,
                                          },
                                        ],
                                      },
                                      e,
                                    )
                                  }
                                  onMouseMove={moveTooltip}
                                  onMouseLeave={hideTooltip}
                                >
                                  {activeLiquorType === "WINE"
                                    ? formatShortNumber(m.wine)
                                    : wineH >= 16
                                      ? formatShortNumber(m.wine)
                                      : null}
                                </div>
                              )}
                            </div>

                            <span className="text-[10px] font-bold text-slate-700 mt-1 truncate w-full text-center">
                              {m.monthName}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <p className="text-center text-[10px] font-bold text-slate-700 border-t border-[#b8ddf8] pt-1">
                    Month
                  </p>
                </div>

                {/* Card 5: Day Wise Case Sold (Real DB Spline Curve with Probe) */}
                <div className="bg-[#f8fcff] rounded-2xl p-3.5 sm:p-4 border-2 border-[#b8ddf8] shadow-xs flex flex-col min-w-0 overflow-hidden">
                  {/* Centered Title */}
                  <div className="relative mb-2.5 min-w-0 flex items-center justify-center">
                    <h2 className="text-center text-sm sm:text-base font-extrabold text-slate-800 tracking-tight">
                      Day Wise Case Sold
                    </h2>
                  </div>

                  <div className="flex-1 flex items-center justify-center py-1 min-w-0 overflow-hidden">
                    <DayWiseChart
                      dayMap={computed.dayWiseCasesMap}
                      hoveredDay={hoveredDayProbe}
                      onHoverDay={(item, e) => {
                        setHoveredDayProbe(item);
                        if (item && e) {
                          showTooltip(
                            {
                              title: `Day ${item.day}`,
                              badge: item.isPeak
                                ? "Peak Day 🌟"
                                : item.isMin
                                  ? "Lowest Day 🔻"
                                  : "Daily Trend",
                              items: [
                                {
                                  label: "Cases Sold",
                                  value:
                                    formatShortNumber(item.cases) + " Cases",
                                  color: "#4338ca",
                                },
                                {
                                  label: "Exact Cases",
                                  value: Math.round(item.cases).toLocaleString(
                                    "en-IN",
                                  ),
                                },
                                {
                                  label: "Contribution",
                                  value: `${((item.cases / (computed.totalCasesRaw || 1)) * 100).toFixed(2)}%`,
                                },
                              ],
                            },
                            e,
                          );
                        } else {
                          hideTooltip();
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Card 6: Subhead Category Wise Sale Amount (Real DB Donut & Legend) */}
                <div
                  className={`bg-[#f8fcff] rounded-2xl p-3.5 sm:p-4 border-2 transition-all flex flex-col min-w-0 overflow-hidden shadow-xs ${activeLiquorType ? "border-indigo-400 ring-2 ring-indigo-200/50" : "border-[#b8ddf8]"}`}
                >
                  {/* Centered Title with absolute badge */}
                  <div className="relative mb-2.5 min-w-0 flex items-center justify-center">
                    <h2 className="text-center text-sm sm:text-base font-extrabold text-slate-800 tracking-tight">
                      Subhead Category Wise Sale Amount
                    </h2>
                    {activeLiquorType && (
                      <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[9px] font-black text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-200 shrink-0">
                        {activeLiquorType} Subheads
                      </span>
                    )}
                  </div>

                  {(() => {
                    const displayedSubheads =
                      activeLiquorType &&
                      computed.subheadsByLiquorLists &&
                      computed.subheadsByLiquorLists[activeLiquorType]?.length >
                        0
                        ? computed.subheadsByLiquorLists[activeLiquorType]
                        : computed.subheadCategoriesList;

                    const activeLiquorTotal = activeLiquorType
                      ? computed.liquorTypeSalesList.find(
                          (l) => l.type === activeLiquorType,
                        )?.formatted || "₹ 0"
                      : computed.totalSalesFormatted;

                    return (
                      <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-2 py-1 min-w-0 overflow-hidden">
                        <div className="relative p-1 shrink-0">
                          <DonutChart
                            data={displayedSubheads}
                            centerValue={
                              hoveredSubheadItem
                                ? hoveredSubheadItem.amountFormatted
                                : activeLiquorTotal
                            }
                            centerLabel={
                              hoveredSubheadItem
                                ? hoveredSubheadItem.name
                                : activeLiquorType
                                  ? `${activeLiquorType} Total`
                                  : "Total Sales"
                            }
                            size={135}
                            strokeWidth={20}
                            hoveredIndex={hoveredSubheadIndex}
                            onHoverSlice={(slice, idx, e) => {
                              setHoveredSubheadIndex(idx);
                              setHoveredSubheadItem(slice);
                              if (slice && e) {
                                showTooltip(
                                  {
                                    title: slice.name,
                                    badge: activeLiquorType
                                      ? `${activeLiquorType} Subhead`
                                      : "Category Share",
                                    items: [
                                      {
                                        label: "Sales Amount",
                                        value: slice.amountFormatted,
                                        color: slice.color,
                                      },
                                      {
                                        label: "Exact Amount (₹)",
                                        value:
                                          "₹ " +
                                          Math.round(
                                            slice.amount,
                                          ).toLocaleString("en-IN"),
                                      },
                                      {
                                        label: "Share of Sales",
                                        value: slice.percent,
                                      },
                                    ],
                                  },
                                  e,
                                );
                              } else {
                                hideTooltip();
                              }
                            }}
                          />
                        </div>

                        {/* Subhead Categories Legend strictly from real DB with interactive hover */}
                        <div className="flex-1 min-w-0 max-h-40 overflow-y-auto pr-1 w-full flex flex-col gap-1 custom-scrollbar">
                          {displayedSubheads.map((cat, idx) => (
                            <div
                              key={idx}
                              className={`flex items-center justify-between gap-1 text-[10px] font-bold py-0.5 min-w-0 cursor-pointer rounded px-1 transition-colors ${hoveredSubheadIndex === idx ? "bg-indigo-50 text-indigo-900 font-black" : "text-slate-700 hover:text-slate-900"}`}
                              onMouseEnter={(e) => {
                                setHoveredSubheadIndex(idx);
                                setHoveredSubheadItem(cat);
                                showTooltip(
                                  {
                                    title: cat.name,
                                    badge: activeLiquorType
                                      ? `${activeLiquorType} Subhead`
                                      : "Category Share",
                                    items: [
                                      {
                                        label: "Sales Amount",
                                        value: cat.amountFormatted,
                                        color: cat.color,
                                      },
                                      {
                                        label: "Exact Amount (₹)",
                                        value:
                                          "₹ " +
                                          Math.round(cat.amount).toLocaleString(
                                            "en-IN",
                                          ),
                                      },
                                      {
                                        label: "Share of Sales",
                                        value: cat.percent,
                                      },
                                    ],
                                  },
                                  e,
                                );
                              }}
                              onMouseMove={moveTooltip}
                              onMouseLeave={() => {
                                setHoveredSubheadIndex(null);
                                setHoveredSubheadItem(null);
                                hideTooltip();
                              }}
                            >
                              <div className="flex items-center gap-1.5 min-w-0 truncate">
                                <div
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: cat.color }}
                                ></div>
                                <span className="truncate" title={cat.name}>
                                  {cat.name}
                                </span>
                              </div>
                              <span className="text-slate-500 font-semibold text-[9px] shrink-0 ml-1">
                                {cat.percent}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </section>
            </>
          )}

          {/* Power BI-style Floating Tooltip — always rendered */}
          <ChartTooltip tooltip={tooltip} />

          {/* ========================================================= */}
          {/* SALES TAB — Date-wise, Top 10 Brands, Target vs Actual, Category */}
          {/* ========================================================= */}
          {activeTab === "Sales" && (
            <>
              {/* Row 1: Date-wise Sales & Profit | Top 10 Brands */}
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Card 1: Total Amount and Total Cases */}
                <div className="bg-[#f8fcff] rounded-2xl p-4 sm:p-5 border-2 border-[#b8ddf8] shadow-xs flex flex-col min-w-0 overflow-hidden min-h-[340px]">
                  {/* Centered Title at top */}
                  <h2 className="text-center text-sm sm:text-base font-extrabold text-slate-800 tracking-tight mb-2">
                    Total Amount and Total Cases
                  </h2>

                  {/* Card Controls Bar */}
                  <div className="flex items-center justify-between gap-2 mb-2 min-w-0">
                    <CardMetricSelector
                      value={card1Metric}
                      onChange={setCard1Metric}
                    />

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="flex items-center gap-1.5 text-[10.5px] font-bold text-indigo-700">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" />
                        {card1Metric === "amount"
                          ? "Total Amount"
                          : "Total Cases"}
                      </span>
                      {card1Metric === "amount" && (
                        <span className="flex items-center gap-1.5 text-[10.5px] font-bold text-emerald-600">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                          Profit
                        </span>
                      )}
                      {hoveredSalesDate && (
                        <span className="text-[9.5px] font-black px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                          {formatIndianDate(hoveredSalesDate)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 overflow-hidden flex flex-col justify-center">
                    <DateSalesProfitChart
                      dateList={computed.dateWiseSalesList}
                      metric={card1Metric}
                      hoveredDate={hoveredSalesDate}
                      onHoverDate={(item, idx, e) => {
                        setHoveredSalesDate(item?.date || null);
                        if (item && e) {
                          showTooltip(
                            {
                              title: formatIndianDate(item.date),
                              badge: "Daily Reading",
                              items: [
                                {
                                  label: "Total Amount",
                                  value: formatCurrency(item.sales),
                                  color: "#4f46e5",
                                },
                                {
                                  label: "Total Cases",
                                  value: `${formatShortNumber(item.cases)} Cases`,
                                  color: "#3b82f6",
                                },
                                {
                                  label: "Total Profit",
                                  value: formatCurrency(item.profit),
                                  color: "#10b981",
                                },
                                {
                                  label: "Margin",
                                  value:
                                    item.sales > 0
                                      ? `${((item.profit / item.sales) * 100).toFixed(1)}%`
                                      : "0%",
                                },
                              ],
                            },
                            e,
                          );
                        } else {
                          hideTooltip();
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Card 2: Top 10 brands on sales by product (Vertical Bar Chart) */}
                <div className="bg-[#f8fcff] rounded-2xl p-4 sm:p-5 border-2 border-[#b8ddf8] shadow-xs flex flex-col min-w-0 overflow-hidden min-h-[340px]">
                  {/* Centered Title at top */}
                  <h2
                    className="text-center text-sm sm:text-base font-extrabold text-slate-800 tracking-tight mb-2"
                    title="Top 10 brands on sales by product"
                  >
                    Top 10 brands on sales by product
                  </h2>

                  {/* Card Controls Bar */}
                  <div className="flex items-center justify-between gap-2 mb-2 min-w-0">
                    <CardMetricSelector
                      value={card2Metric}
                      onChange={setCard2Metric}
                    />
                  </div>

                  <div className="flex-1 min-w-0 overflow-hidden flex flex-col justify-center">
                    <Top10BrandsBarChart
                      products={
                        card2Metric === "amount"
                          ? computed.topProductsByAmount
                          : computed.topProductsByCases
                      }
                      metric={card2Metric}
                      hoveredIdx={hoveredProductIdx}
                      onHoverProduct={(p, idx, e) => {
                        setHoveredProductIdx(idx);
                        if (p && e) {
                          showTooltip(
                            {
                              title: p.name,
                              badge: "Top Brand Sales",
                              items: [
                                {
                                  label: "Sales Amount",
                                  value: p.formatted,
                                  color: "#4338ca",
                                },
                                {
                                  label: "Cases Sold",
                                  value: p.casesFormatted,
                                  color: "#6366f1",
                                },
                                {
                                  label: "Share of Sales",
                                  value:
                                    computed.totalSalesRaw > 0
                                      ? `${((p.amount / computed.totalSalesRaw) * 100).toFixed(1)}%`
                                      : "0%",
                                },
                              ],
                            },
                            e,
                          );
                        } else {
                          hideTooltip();
                        }
                      }}
                    />
                  </div>
                </div>
              </section>

              {/* Row 2: Target Sales vs Actual Sales Difference | Sales by Category */}
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Card 3: Target Sales vs Actual sales difference by Month/Day */}
                <div className="bg-[#f8fcff] rounded-2xl p-4 sm:p-5 border-2 border-[#b8ddf8] shadow-xs flex flex-col min-w-0 overflow-hidden min-h-[340px]">
                  {/* Centered Title at top */}
                  <h2 className="text-center text-sm sm:text-base font-extrabold text-slate-800 tracking-tight mb-2">
                    Actual sales vs Average sales by Month
                  </h2>

                  {/* Card Controls Bar */}
                  <div className="flex items-center justify-between gap-2 mb-2 min-w-0">
                    <CardMetricSelector
                      value={card3Metric}
                      onChange={setCard3Metric}
                    />

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="flex items-center gap-1.5 text-[10.5px] font-bold text-purple-700">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block" />
                        Total Sales
                      </span>
                      <span className="flex items-center gap-1.5 text-[10.5px] font-bold text-sky-600">
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" />
                        Average Sales
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 overflow-hidden flex flex-col justify-center">
                    <TargetActualDifferenceChart
                      dayList={computed.dayWiseTrendList}
                      metric={card3Metric}
                      hoveredDay={hoveredDayProbe}
                      onHoverDay={(d, idx, e) => {
                        setHoveredDayProbe(d?.day || null);
                        if (d && e) {
                          showTooltip(
                            {
                              title: `Day ${d.day}`,
                              badge: "Target vs Actual",
                              items: [
                                {
                                  label: "Actual Sales",
                                  value: formatCurrency(d.sales),
                                  color: "#7c3aed",
                                },
                                {
                                  label: "Target Sales",
                                  value: formatCurrency(d.targetSales),
                                  color: "#38bdf8",
                                },
                                {
                                  label: "Actual Cases",
                                  value: `${formatShortNumber(d.cases)} Cases`,
                                },
                                {
                                  label: "Target Cases",
                                  value: `${formatShortNumber(d.targetCases)} Cases`,
                                },
                              ],
                            },
                            e,
                          );
                        } else {
                          hideTooltip();
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Card 4: Sell by Sub Head Category (Horizontal Bar Chart) */}
                <div
                  className={`bg-[#f8fcff] rounded-2xl p-4 sm:p-5 border-2 transition-all shadow-xs flex flex-col min-w-0 overflow-hidden min-h-[340px] ${activeLiquorType ? "border-indigo-400 ring-2 ring-indigo-200/50" : "border-[#b8ddf8]"}`}
                >
                  {/* Centered Title at top */}
                  <h2 className="text-center text-sm sm:text-base font-extrabold text-slate-800 tracking-tight mb-2">
                    Sell by Sub Head Category
                  </h2>

                  {/* Card Controls Bar */}
                  <div className="flex items-center justify-between gap-2 mb-2 min-w-0">
                    <CardMetricSelector
                      value={card4Metric}
                      onChange={setCard4Metric}
                    />
                    {activeLiquorType && (
                      <span className="text-[10px] font-black text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-full border border-indigo-200 shrink-0">
                        {activeLiquorType}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 overflow-hidden flex flex-col justify-center">
                    <CategoryHorizontalBarChart
                      categories={
                        card4Metric === "amount"
                          ? computed.categoryBreakdownByAmount
                          : computed.categoryBreakdownByCases
                      }
                      metric={card4Metric}
                      hoveredIdx={hoveredSubheadIndex}
                      onHoverCategory={(cat, idx, e) => {
                        setHoveredSubheadIndex(idx);
                        if (cat && e) {
                          showTooltip(
                            {
                              title: cat.name,
                              badge: "Category Breakdown",
                              items: [
                                {
                                  label: "Sales Amount",
                                  value: cat.amountFormatted,
                                  color: "#4f46e5",
                                },
                                {
                                  label: "Cases Sold",
                                  value: cat.casesFormatted,
                                  color: "#6366f1",
                                },
                                {
                                  label: "Share",
                                  value:
                                    computed.totalSalesRaw > 0
                                      ? `${((cat.amount / computed.totalSalesRaw) * 100).toFixed(1)}%`
                                      : "0%",
                                },
                              ],
                            },
                            e,
                          );
                        } else {
                          hideTooltip();
                        }
                      }}
                    />
                  </div>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
