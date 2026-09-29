import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { 
  TrendingUp, Calendar, Eraser, ChevronDown, RefreshCw, AlertCircle
} from 'lucide-react';

// ==========================================
// NUMBER & CURRENCY FORMATTERS
// ==========================================
function formatCurrency(val) {
  if (val === undefined || val === null || isNaN(val) || val === 0) return '₹ 0';
  if (val >= 10000000) return `₹ ${(val / 10000000).toFixed(2)}Cr`;
  if (val >= 1000000) return `₹ ${(val / 1000000).toFixed(2)}M`;
  if (val >= 1000) return `₹ ${(val / 1000).toFixed(1)}K`;
  return `₹ ${Math.round(val).toLocaleString()}`;
}

function formatShortNumber(val) {
  if (val === undefined || val === null || isNaN(val) || val === 0) return '0';
  if (val >= 10000000) return `${(val / 10000000).toFixed(2)}Cr`;
  if (val >= 1000000) return `${(val / 1000000).toFixed(2)}M`;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
  return `${Math.round(val).toLocaleString()}`;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const SHORT_MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const LIQUOR_COLORS = {
  IMFL: '#160c5c',
  BEER: '#3b82f6',
  MML: '#f43f5e',
  WINE: '#eab308',
  OTHER: '#8b5cf6'
};

const SUBHEAD_PALETTE = [
  '#160c5c', '#2563eb', '#f43f5e', '#fb923c', '#facc15', '#10b981',
  '#84cc16', '#f472b6', '#38bdf8', '#c084fc', '#2dd4bf', '#6366f1'
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
  padding = 6
}) => {
  const svgRef = React.useRef(null);

  if (!points || points.length === 0) {
    return <div className="h-11 flex items-center justify-center text-[10px] text-slate-400">No data</div>;
  }

  const minVal = Math.min(...points);
  const maxVal = Math.max(...points);
  const minIdx = points.lastIndexOf(minVal);
  const maxIdx = points.lastIndexOf(maxVal);

  const getX = (idx) => padding + (idx / Math.max(points.length - 1, 1)) * (width - 2 * padding);
  const getY = (val) => {
    if (maxVal === minVal) return height / 2;
    return height - padding - ((val - minVal) / (maxVal - minVal)) * (height - 2 * padding);
  };

  const coords = points.map((val, idx) => ({ x: getX(idx), y: getY(val) }));

  const pathData = coords.reduce((acc, pt, idx, arr) => {
    if (idx === 0) return `M ${pt.x},${pt.y}`;
    const prev = arr[idx - 1];
    const midX = (prev.x + pt.x) / 2;
    return `${acc} C ${midX},${prev.y} ${midX},${pt.y} ${pt.x},${pt.y}`;
  }, '');

  const areaData = coords.length > 0 
    ? `${pathData} L ${coords[coords.length - 1].x},${height - 2} L ${coords[0].x},${height - 2} Z`
    : '';

  const maxPt = coords[maxIdx];
  const minPt = coords[minIdx];
  const activePt = hoveredIndex !== null && coords[hoveredIndex] ? coords[hoveredIndex] : null;

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
          <linearGradient id={`spark-grad-${gradId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Subtle filled area */}
        {areaData && (
          <path
            d={areaData}
            fill={`url(#spark-grad-${gradId})`}
          />
        )}

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
            <circle
              cx={activePt.x}
              cy={height - 2}
              r="2"
              fill="#0284c7"
            />
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
  onHideTooltip 
}) => {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const isHovered = hoveredIdx !== null && item.sparkline && hoveredIdx < item.sparkline.length;
  const hoveredValue = isHovered ? item.sparkline[hoveredIdx] : null;

  // Real-time reflection: dynamically reflects the day's pattern value while cursor moves
  const displayAmount = isHovered ? formatCurrency(hoveredValue) : item.amount;
  const dayNumber = isHovered ? hoveredIdx + 1 : null;

  const handleSparklineHover = (idx, e) => {
    setHoveredIdx(idx);
    const dayVal = item.sparkline[idx] || 0;
    const sharePercent = item.rawSales > 0 ? ((dayVal / item.rawSales) * 100).toFixed(1) : '0';

    onShowTooltip?.({
      title: `${item.label} • Day ${idx + 1}`,
      badge: `Day ${idx + 1} of ${item.sparkline.length}`,
      items: [
        { label: `Day ${idx + 1} Sales`, value: formatCurrency(dayVal), color: '#0284c7' },
        ...(activeLiquorType && liquorSalesAmount !== null ? [
          { label: `${activeLiquorType} in Month`, value: formatCurrency(liquorSalesAmount), color: '#6366f1' }
        ] : []),
        { label: 'Month Total', value: item.amount, color: '#4f46e5' },
        { label: 'Day Share', value: `${sharePercent}%`, color: '#10b981' }
      ]
    }, e);
  };

  const handleLeave = () => {
    setHoveredIdx(null);
    onHideTooltip?.();
  };

  const handleCardMouseEnter = (e) => {
    if (hoveredIdx === null) {
      onShowTooltip?.({
        title: item.label,
        badge: activeLiquorType ? `Filtering ${activeLiquorType}` : 'Monthly Total',
        items: [
          ...(activeLiquorType && liquorSalesAmount !== null ? [
            { label: `${activeLiquorType} Sales`, value: formatCurrency(liquorSalesAmount), color: '#6366f1' },
            { label: 'Share of Month', value: `${item.rawSales > 0 ? ((liquorSalesAmount / item.rawSales) * 100).toFixed(1) : 0}%` }
          ] : []),
          { label: 'Total Sales', value: item.amount, color: '#0284c7' },
          { label: 'Recorded Days', value: `${item.sparkline?.length || 0} Days` }
        ]
      }, e);
    }
  };

  return (
    <div 
      className={`bg-[#f8fcff] rounded-2xl p-3 border-2 transition-all duration-200 cursor-pointer min-h-28 flex flex-col items-center justify-between group/card ${
        isHovered 
          ? 'border-sky-500 shadow-md ring-2 ring-sky-300/40 bg-sky-50/40' 
          : activeLiquorType && liquorSalesAmount > 0
            ? 'border-indigo-300/90 shadow-xs'
            : 'border-[#b8ddf8] shadow-xs hover:shadow-md hover:border-indigo-400'
      }`}
      onMouseEnter={handleCardMouseEnter}
      onMouseMove={onMoveTooltip}
      onMouseLeave={handleLeave}
    >
      <div className="text-center w-full flex flex-col items-center">
        <p className={`text-lg sm:text-xl font-black tracking-tight leading-tight transition-all duration-150 ${
          isHovered ? 'text-indigo-600 scale-105' : 'text-[#0284c7] group-hover/card:text-indigo-600'
        }`}>
          {displayAmount}
        </p>

        <div className="flex items-center justify-center gap-1.5 mt-0.5 flex-wrap">
          <p className="text-xs font-bold text-indigo-800">
            {item.label}
          </p>
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

  // Viewport-aware boundary clamping to prevent clipping off screen
  const left = typeof window !== 'undefined' ? Math.min(tooltip.x + 14, window.innerWidth - 250) : tooltip.x;
  const top = typeof window !== 'undefined' ? Math.min(tooltip.y + 14, window.innerHeight - 190) : tooltip.y;

  return (
    <div 
      className="fixed z-50 pointer-events-none transition-transform duration-75 ease-out select-none"
      style={{ left: `${left}px`, top: `${top}px` }}
    >
      <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-xl p-2.5 px-3 shadow-2xl border border-slate-700/80 text-xs min-w-44 max-w-68">
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
            <div key={idx} className="flex items-center justify-between gap-3 text-[11px]">
              <span className="flex items-center gap-1.5 text-slate-400 font-semibold truncate">
                {it.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: it.color }}></span>}
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
  hoveredIndex = null
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((acc, d) => acc + (d.value || 0), 0) || 1;

  let accumulatedPercent = 0;

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90 block overflow-hidden">
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
              stroke={slice.color || '#cbd5e1'}
              strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              strokeOpacity={hoveredIndex !== null && !isHovered ? 0.45 : 1}
              className="transition-all duration-200 cursor-pointer"
              onMouseEnter={(e) => onHoverSlice && onHoverSlice(slice, idx, e)}
              onMouseMove={(e) => onHoverSlice && onHoverSlice(slice, idx, e)}
              onMouseLeave={() => onHoverSlice && onHoverSlice(null, null, null)}
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

  const casesValues = daysList.map(d => d.cases);
  const maxVal = Math.max(...casesValues, 10);
  const ceiling = Math.ceil(maxVal / 10) * 10;

  const getX = (day) => padL + ((day - 1) / 30) * (width - padL - padR);
  const getY = (val) => padT + (1 - val / ceiling) * (height - padT - padB);

  const coords = daysList.map(d => ({ x: getX(d.day), y: getY(d.cases), day: d.day, cases: d.cases }));

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
  const minItem = [...daysList].filter(d => d.cases > 0).sort((a, b) => a.cases - b.cases)[0] || daysList[0];

  const maxCoord = maxItem && maxItem.cases > 0 ? coords.find(c => c.day === maxItem.day) : null;
  const minCoord = minItem && minItem.cases > 0 ? coords.find(c => c.day === minItem.day) : null;

  const handleMouseMove = (e) => {
    if (!onHoverDay) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const svgX = (mouseX / rect.width) * width;
    const day = Math.min(Math.max(Math.round(1 + ((svgX - padL) / (width - padL - padR)) * 30), 1), 31);
    const item = coords.find(c => c.day === day);
    if (item) {
      const isPeak = maxCoord && maxCoord.day === item.day;
      const isMin = minCoord && minCoord.day === item.day;
      onHoverDay({ ...item, isPeak, isMin }, e);
    }
  };

  const activeCoord = hoveredDay ? coords.find(c => c.day === hoveredDay.day) : null;

  return (
    <div 
      className="w-full relative overflow-hidden cursor-crosshair"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => onHoverDay && onHoverDay(null, null)}
    >
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-hidden block">
        {/* Y Grid lines and labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const v = Math.round(ceiling * ratio);
          const y = getY(v);
          return (
            <g key={ratio}>
              <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#e0f2fe" strokeWidth="1" strokeDasharray="3,3" />
              <text x={padL - 6} y={y + 3} textAnchor="end" className="text-[9px] fill-slate-500 font-semibold select-none">
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
              <text x={x} y={height - padB + 13} textAnchor="middle" className="text-[9px] fill-slate-500 font-semibold select-none">
                {d}
              </text>
            </g>
          );
        })}

        {/* Axis Titles with clean spacing */}
        <text x={12} y={(height - padB + padT) / 2} textAnchor="middle" transform={`rotate(-90, 12, ${(height - padB + padT) / 2})`} className="text-[10px] font-bold fill-slate-700 select-none">
          Total Cases
        </text>
        <text x={(width + padL - padR) / 2} y={height - 4} textAnchor="middle" className="text-[10px] font-bold fill-slate-700 select-none">
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
          <linearGradient id="dayWiseFillGradDynamic" x1="0" y1="0" x2="0" y2="1">
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
          <circle cx={maxCoord.x} cy={maxCoord.y} r="4.5" fill="#15803d" stroke="#ffffff" strokeWidth="2" />
        )}

        {/* Lowest Red Dot */}
        {minCoord && (
          <circle cx={minCoord.x} cy={minCoord.y} r="4.5" fill="#dc2626" stroke="#ffffff" strokeWidth="2" />
        )}

        {/* Active Hover Crosshair Guideline & Dot */}
        {activeCoord && (
          <g>
            <line x1={activeCoord.x} y1={padT} x2={activeCoord.x} y2={height - padB} stroke="#6366f1" strokeWidth="1.5" strokeDasharray="3,3" />
            <circle cx={activeCoord.x} cy={activeCoord.y} r="8" fill="#6366f1" opacity="0.3" />
            <circle cx={activeCoord.x} cy={activeCoord.y} r="5" fill="#4338ca" stroke="#ffffff" strokeWidth="2" />
          </g>
        )}
      </svg>
    </div>
  );
};

// ==========================================
// MAIN DASHBOARD COMPONENT (100% REAL DATA)
// ==========================================
export default function StockBalanceDashboard() {
  // Navigation tab state
  const [activeTab, setActiveTab] = useState('Overview');

  // Interactive Floating Tooltip State
  const [tooltip, setTooltip] = useState({
    visible: false,
    x: 0,
    y: 0,
    title: '',
    badge: '',
    items: []
  });

  const [hoveredLiquorIndex, setHoveredLiquorIndex] = useState(null);
  const [hoveredLiquorItem, setHoveredLiquorItem] = useState(null);

  const [hoveredSubheadIndex, setHoveredSubheadIndex] = useState(null);
  const [hoveredSubheadItem, setHoveredSubheadItem] = useState(null);

  const [hoveredDayProbe, setHoveredDayProbe] = useState(null);

  // Cross-chart interactive link state triggered by hovering on Liquor Type bars
  const [hoveredLiquorType, setHoveredLiquorType] = useState(null);
  const [pinnedLiquorType, setPinnedLiquorType] = useState(null);
  const activeLiquorType = hoveredLiquorType || pinnedLiquorType;

  const showTooltip = useCallback((info, e) => {
    if (!e) return;
    setTooltip({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      title: info.title || '',
      badge: info.badge || '',
      items: info.items || []
    });
  }, []);

  const moveTooltip = useCallback((e) => {
    if (!e) return;
    setTooltip(prev => prev.visible ? { ...prev, x: e.clientX, y: e.clientY } : prev);
  }, []);

  const hideTooltip = useCallback(() => {
    setTooltip(prev => ({ ...prev, visible: false }));
  }, []);

  // Filter States
  const [selectedStore, setSelectedStore] = useState('All');
  const [selectedLiquorType, setSelectedLiquorType] = useState('All');
  const [selectedSubhead, setSelectedSubhead] = useState('All');
  const [startDate, setStartDate] = useState('2026-02-01');
  const [endDate, setEndDate] = useState('2026-09-30');

  // Dynamic filter options populated strictly from database
  const [storeOptions, setStoreOptions] = useState(['All']);
  const [liquorTypeOptions, setLiquorTypeOptions] = useState(['All', 'IMFL', 'BEER', 'MML', 'WINE']);
  const [subheadOptions, setSubheadOptions] = useState(['All']);

  // Loading & Database state
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);

  // 1. Initial metadata loader: Get registered shops from shop table & stock records
  useEffect(() => {
    async function loadMetadata() {
      try {
        const [shopsRes, distinctShopsRes] = await Promise.all([
          supabase.from('shop').select('shop_name'),
          supabase.from('stock_balance_records').select('shop_id').limit(2000)
        ]);

        const names = new Set();
        if (shopsRes.data) {
          shopsRes.data.forEach(s => { if (s.shop_name) names.add(s.shop_name.trim()); });
        }
        if (distinctShopsRes.data) {
          distinctShopsRes.data.forEach(s => { if (s.shop_id) names.add(s.shop_id.trim()); });
        }

        if (names.size > 0) {
          setStoreOptions(['All', ...Array.from(names).sort()]);
        }
      } catch (err) {
        console.warn('Metadata load notice:', err);
      }
    }
    loadMetadata();
  }, []);

  // 2. Fetch real data from stock_balance_records strictly based on filters
  const fetchRealStockData = useCallback(async () => {
    setLoading(true);
    try {
      // Query sold records in parallel batches for fast response
      const batchSize = 1000;
      const numBatches = 8;
      const promises = [];

      for (let i = 0; i < numBatches; i++) {
        let q = supabase
          .from('stock_balance_records')
          .select('date, shop_id, liquor_type, subhead, item_name, quantity_out, mrp_rate, purchase_rate, b_cs')
          .gt('quantity_out', 0);

        if (selectedStore !== 'All') {
          q = q.eq('shop_id', selectedStore);
        }
        if (selectedLiquorType !== 'All') {
          q = q.ilike('liquor_type', `%${selectedLiquorType}%`);
        }
        if (selectedSubhead !== 'All') {
          q = q.ilike('subhead', `%${selectedSubhead}%`);
        }
        if (startDate) {
          q = q.gte('date', startDate);
        }
        if (endDate) {
          q = q.lte('date', endDate);
        }

        promises.push(q.range(i * batchSize, (i + 1) * batchSize - 1));
      }

      const results = await Promise.all(promises);
      const rows = [];
      results.forEach(res => {
        if (res.data) rows.push(...res.data);
      });

      setRecords(rows);

      // Extract dynamic subhead and liquor options from fetched real rows
      const dynamicSubheads = new Set();
      const dynamicLiquorTypes = new Set(['IMFL', 'BEER', 'MML', 'WINE']);
      rows.forEach(r => {
        if (r.subhead) dynamicSubheads.add(r.subhead.trim().toUpperCase());
        if (r.liquor_type) {
          let lt = r.liquor_type.trim().toUpperCase();
          if (lt.includes('BEER')) dynamicLiquorTypes.add('BEER');
          else if (lt.includes('MML')) dynamicLiquorTypes.add('MML');
          else if (lt.includes('WINE')) dynamicLiquorTypes.add('WINE');
          else if (lt.includes('IMFL')) dynamicLiquorTypes.add('IMFL');
          else dynamicLiquorTypes.add(lt);
        }
      });

      if (dynamicSubheads.size > 0) {
        setSubheadOptions(['All', ...Array.from(dynamicSubheads).sort()]);
      }
      setLiquorTypeOptions(['All', ...Array.from(dynamicLiquorTypes).sort()]);
    } catch (err) {
      console.error('Error fetching real stock data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedStore, selectedLiquorType, selectedSubhead, startDate, endDate]);

  useEffect(() => {
    fetchRealStockData();
  }, [fetchRealStockData]);

  // Reset filters
  const handleResetFilters = () => {
    setSelectedStore('All');
    setSelectedLiquorType('All');
    setSelectedSubhead('All');
    setStartDate('2026-02-01');
    setEndDate('2026-09-30');
    setHoveredLiquorType(null);
    setPinnedLiquorType(null);
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

    // Interactive cross-div breakdowns by liquor type
    const storeLiquorSalesMap = {};
    const subheadByLiquorMap = { IMFL: {}, BEER: {}, MML: {}, WINE: {} };
    const monthlyLiquorSalesMap = {};

    records.forEach(row => {
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
      const dateStr = row.date || '';
      const monthKey = dateStr.substring(0, 7); // YYYY-MM
      const dayNum = parseInt(dateStr.split('-')[2] || '0', 10);

      if (monthKey) {
        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = {
            key: monthKey,
            sales: 0,
            cases: 0,
            imfl: 0,
            beer: 0,
            mml: 0,
            wine: 0,
            days: {}
          };
        }
        monthlyMap[monthKey].sales += sale;
        monthlyMap[monthKey].cases += cases;
        if (dayNum > 0) {
          monthlyMap[monthKey].days[dayNum] = (monthlyMap[monthKey].days[dayNum] || 0) + sale;
        }
      }

      // 2. Liquor Type Aggregation
      let lt = (row.liquor_type || 'IMFL').trim().toUpperCase();
      if (lt.includes('BEER')) lt = 'BEER';
      else if (lt.includes('MML')) lt = 'MML';
      else if (lt.includes('WINE')) lt = 'WINE';
      else if (lt.includes('IMFL')) lt = 'IMFL';
      else lt = 'IMFL';

      liquorSalesMap[lt] = (liquorSalesMap[lt] || 0) + sale;
      liquorCasesMap[lt] = (liquorCasesMap[lt] || 0) + cases;

      if (monthKey && monthlyMap[monthKey]) {
        if (lt === 'IMFL') monthlyMap[monthKey].imfl += cases;
        else if (lt === 'BEER') monthlyMap[monthKey].beer += cases;
        else if (lt === 'MML') monthlyMap[monthKey].mml += cases;
        else if (lt === 'WINE') monthlyMap[monthKey].wine += cases;
      }

      // 3. Store Aggregation
      const store = (row.shop_id || 'Other').trim();
      storeSalesMap[store] = (storeSalesMap[store] || 0) + sale;

      // Cross-aggregation: store sales by liquor type
      if (!storeLiquorSalesMap[store]) storeLiquorSalesMap[store] = {};
      storeLiquorSalesMap[store][lt] = (storeLiquorSalesMap[store][lt] || 0) + sale;

      // 4. Subhead Aggregation
      const sh = (row.subhead || 'OTHER').trim().toUpperCase();
      subheadSalesMap[sh] = (subheadSalesMap[sh] || 0) + sale;

      // Cross-aggregation: subhead sales by liquor type
      if (!subheadByLiquorMap[lt]) subheadByLiquorMap[lt] = {};
      subheadByLiquorMap[lt][sh] = (subheadByLiquorMap[lt][sh] || 0) + sale;

      // Cross-aggregation: monthly sales by liquor type
      if (monthKey) {
        if (!monthlyLiquorSalesMap[monthKey]) monthlyLiquorSalesMap[monthKey] = {};
        monthlyLiquorSalesMap[monthKey][lt] = (monthlyLiquorSalesMap[monthKey][lt] || 0) + sale;
      }

      // 5. Day-Wise Cases
      if (dayNum > 0) {
        dayWiseCasesMap[dayNum] = (dayWiseCasesMap[dayNum] || 0) + cases;
      }
    });

    // 1. Top KPI Summary
    const totalProfit = totalSales - totalCost;

    // 2. Monthly Cards Data
    const sortedMonths = Object.keys(monthlyMap).sort();
    const monthlySalesCards = sortedMonths.map(mKey => {
      const parts = mKey.split('-');
      const year = parseInt(parts[0], 10) || 2026;
      const monthIdx = parseInt(parts[1], 10) - 1;
      const monthLabel = `${SHORT_MONTH_NAMES[monthIdx] || parts[1]} Sales`;
      const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
      
      const mObj = monthlyMap[mKey];
      // Generate daily sales sparkline for exact days in that month
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
        sparkline
      };
    });

    // 3. Liquor Type Sales Breakdown
    const liquorTypeSalesList = Object.entries(liquorSalesMap).map(([type, amount]) => ({
      type,
      amount,
      formatted: formatCurrency(amount)
    })).sort((a, b) => b.amount - a.amount);

    const maxLiquorSale = Math.max(...liquorTypeSalesList.map(l => l.amount), 1);

    // 4. Liquor Type Case Breakdown (Donut)
    const liquorTypeCaseList = Object.entries(liquorCasesMap).map(([type, cases]) => {
      const percent = totalCases > 0 ? (cases / totalCases) * 100 : 0;
      return {
        type,
        cases,
        casesFormatted: formatShortNumber(cases),
        percent: `${percent.toFixed(1)}%`,
        value: cases,
        color: LIQUOR_COLORS[type] || '#8b5cf6'
      };
    }).sort((a, b) => b.cases - a.cases);

    // 5. Store-Wise Sales Breakdown
    const storeWiseSalesList = Object.entries(storeSalesMap).map(([store, amount]) => ({
      store,
      amount,
      formatted: formatCurrency(amount)
    })).sort((a, b) => b.amount - a.amount);

    const maxStoreSale = Math.max(...storeWiseSalesList.map(s => s.amount), 1);

    // 6. Monthly Liquor Type Stacked Cases
    const monthlyStackedCases = sortedMonths.map(mKey => {
      const parts = mKey.split('-');
      const monthIdx = parseInt(parts[1], 10) - 1;
      const mObj = monthlyMap[mKey];

      return {
        monthName: MONTH_NAMES[monthIdx] || mKey,
        totalCases: mObj.cases,
        totalFormatted: formatShortNumber(mObj.cases),
        imfl: mObj.imfl,
        beer: mObj.beer,
        mml: mObj.mml,
        wine: mObj.wine
      };
    });

    // 7. Subhead Category Donut (Top 10)
    const sortedSubheads = Object.entries(subheadSalesMap).sort((a, b) => b[1] - a[1]);
    const topSubheads = sortedSubheads.slice(0, 10);
    const subheadCategoriesList = topSubheads.map(([name, amount], idx) => {
      const percent = totalSales > 0 ? (amount / totalSales) * 100 : 0;
      return {
        name,
        amount,
        amountFormatted: formatCurrency(amount),
        percent: `${percent.toFixed(1)}%`,
        value: amount,
        color: SUBHEAD_PALETTE[idx % SUBHEAD_PALETTE.length]
      };
    });

    // Precompute subhead breakdown per liquor type for instant responsive cross-filtering
    const subheadsByLiquorLists = {};
    ['IMFL', 'BEER', 'MML', 'WINE'].forEach(ltype => {
      const map = subheadByLiquorMap[ltype] || {};
      const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10);
      const lTotal = liquorSalesMap[ltype] || 1;
      subheadsByLiquorLists[ltype] = sorted.map(([name, amount], idx) => {
        const percent = (amount / lTotal) * 100;
        return {
          name,
          amount,
          amountFormatted: formatCurrency(amount),
          percent: `${percent.toFixed(1)}%`,
          value: amount,
          color: SUBHEAD_PALETTE[idx % SUBHEAD_PALETTE.length]
        };
      });
    });

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
      subheadsByLiquorLists
    };
  }, [records]);

  return (
    <div className="min-h-screen bg-[#eaf4fc] p-2.5 sm:p-4 font-sans text-slate-800 flex justify-center">
      <div className="w-full max-w-[1680px] bg-[#f0f8ff] rounded-3xl border-2 border-[#b8ddf8] shadow-xl overflow-hidden flex flex-col lg:flex-row">
        
        {/* ========================================================= */}
        {/* LEFT SIDEBAR CONTROLS & BRANDING */}
        {/* ========================================================= */}
        <aside className="w-full lg:w-72 bg-[#e2f1fc] border-b lg:border-b-0 lg:border-r-2 border-[#b8ddf8] p-4 sm:p-5 flex flex-col gap-3.5 shrink-0">
          
          {/* Brand Header */}
          <div className="bg-[#edf6fe] rounded-2xl p-4 border border-[#badbf4] flex flex-col items-center justify-center text-center shadow-xs">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
            DrinqKart
            </h1>
            <div className="w-20 h-16 flex items-end justify-center relative pb-1">
              <div className="flex items-end gap-1.5 h-12">
                <div className="w-3.5 h-6 bg-[#38bdf8] rounded-t-xs"></div>
                <div className="w-3.5 h-9 bg-[#2563eb] rounded-t-xs"></div>
                <div className="w-3.5 h-12 bg-[#fbbf24] rounded-t-xs"></div>
              </div>
              <div className="absolute top-0 right-1 text-[#15803d]">
                <TrendingUp className="w-8 h-8 stroke-3" />
              </div>
            </div>
          </div>

          {/* Metric Card 1: Total Profit (100% Real DB) */}
          <div className="bg-linear-to-r from-[#6b6bf7] to-[#7f58e8] rounded-2xl p-4 text-white shadow-md shadow-indigo-200/50 flex flex-col items-center justify-center text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-100">
              Total Profit
            </span>
            <span className="text-2xl sm:text-3xl font-black tracking-tight mt-0.5">
              {computed.totalProfitFormatted}
            </span>
          </div>

          {/* Metric Card 2: Total Quantity Sold (100% Real DB) */}
          <div className="bg-linear-to-r from-[#6b6bf7] to-[#7f58e8] rounded-2xl p-4 text-white shadow-md shadow-indigo-200/50 flex flex-col items-center justify-center text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-100">
              Total Quantity Sold
            </span>
            <span className="text-2xl sm:text-3xl font-black tracking-tight mt-0.5">
              {computed.totalQtyFormatted}
            </span>
          </div>

          {/* Metric Card 3: Total Case Sold (100% Real DB) */}
          <div className="bg-linear-to-r from-[#6b6bf7] to-[#7f58e8] rounded-2xl p-4 text-white shadow-md shadow-indigo-200/50 flex flex-col items-center justify-center text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-100">
              Total Case Sold
            </span>
            <span className="text-2xl sm:text-3xl font-black tracking-tight mt-0.5">
              {computed.totalCasesFormatted}
            </span>
          </div>

          {/* Filter 1: Select Store */}
          <div className="bg-[#edf6fe] rounded-2xl p-3.5 border-2 border-[#badbf4] flex flex-col shadow-xs my-1 hover:border-indigo-400 transition-all">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-black text-indigo-950 uppercase tracking-wider">
                Select Store
              </label>
              <span className="text-[9px] font-bold text-indigo-600 bg-indigo-100/80 px-2 py-0.5 rounded-md border border-indigo-200/50">
                Shop Filter
              </span>
            </div>
            <div className="relative bg-white/95 rounded-xl border border-[#badbf4] hover:border-indigo-400 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-200/60 shadow-2xs transition-all">
              <select
                value={selectedStore}
                onChange={(e) => setSelectedStore(e.target.value)}
                className="w-full bg-transparent py-2.5 pl-3.5 pr-8 text-xs sm:text-sm font-bold text-slate-800 outline-none cursor-pointer appearance-none"
              >
                {storeOptions.map((st) => (
                  <option key={st} value={st} className="py-2.5 px-3 my-1 bg-white text-slate-800 font-semibold text-xs sm:text-sm">
                    {st}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-indigo-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Filter 2: Liquor Type */}
          <div className="bg-[#edf6fe] rounded-2xl p-3.5 border-2 border-[#badbf4] flex flex-col shadow-xs my-1 hover:border-indigo-400 transition-all">
            <label className="text-[11px] font-black text-indigo-950 uppercase tracking-wider mb-1.5">
              Liquor Type
            </label>
            <div className="relative bg-white/95 rounded-xl border border-[#badbf4] hover:border-indigo-400 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-200/60 shadow-2xs transition-all">
              <select
                value={selectedLiquorType}
                onChange={(e) => setSelectedLiquorType(e.target.value)}
                className="w-full bg-transparent py-2.5 pl-3.5 pr-8 text-xs sm:text-sm font-bold text-slate-800 outline-none cursor-pointer appearance-none"
              >
                {liquorTypeOptions.map((lt) => (
                  <option key={lt} value={lt} className="py-2.5 px-3 my-1 bg-white text-slate-800 font-semibold text-xs sm:text-sm">{lt}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-indigo-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Filter 3: Category / Subhead */}
          <div className="bg-[#edf6fe] rounded-2xl p-3.5 border-2 border-[#badbf4] flex flex-col shadow-xs my-1 hover:border-indigo-400 transition-all">
            <label className="text-[11px] font-black text-indigo-950 uppercase tracking-wider mb-1.5">
              Category / Subhead
            </label>
            <div className="relative bg-white/95 rounded-xl border border-[#badbf4] hover:border-indigo-400 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-200/60 shadow-2xs transition-all">
              <select
                value={selectedSubhead}
                onChange={(e) => setSelectedSubhead(e.target.value)}
                className="w-full bg-transparent py-2.5 pl-3.5 pr-8 text-xs sm:text-sm font-bold text-slate-800 outline-none cursor-pointer appearance-none"
              >
                {subheadOptions.map((sh) => (
                  <option key={sh} value={sh} className="py-2.5 px-3 my-1 bg-white text-slate-800 font-semibold text-xs sm:text-sm">{sh}</option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-indigo-600 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Filter 4: Start Date */}
          <div className="bg-[#edf6fe] rounded-2xl p-3.5 border-2 border-[#badbf4] flex flex-col shadow-xs my-1 hover:border-indigo-400 transition-all">
            <label className="text-[11px] font-black text-indigo-950 uppercase tracking-wider mb-1.5">
              Start Date
            </label>
            <div className="relative bg-white/95 rounded-xl border border-[#badbf4] hover:border-indigo-400 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-200/60 shadow-2xs transition-all flex items-center justify-between">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-transparent py-2.5 pl-3.5 pr-7 text-xs font-bold text-slate-800 outline-none cursor-pointer"
              />
              <Calendar className="w-4 h-4 text-indigo-600 absolute right-3 pointer-events-none" />
            </div>
          </div>

          {/* Filter 5: End Date */}
          <div className="bg-[#edf6fe] rounded-2xl p-3.5 border-2 border-[#badbf4] flex flex-col shadow-xs my-1 hover:border-indigo-400 transition-all">
            <label className="text-[11px] font-black text-indigo-950 uppercase tracking-wider mb-1.5">
              End Date
            </label>
            <div className="relative bg-white/95 rounded-xl border border-[#badbf4] hover:border-indigo-400 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-200/60 shadow-2xs transition-all flex items-center justify-between">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-transparent py-2.5 pl-3.5 pr-7 text-xs font-bold text-slate-800 outline-none cursor-pointer"
              />
              <Calendar className="w-4 h-4 text-indigo-600 absolute right-3 pointer-events-none" />
            </div>
          </div>

        </aside>

        {/* ========================================================= */}
        {/* MAIN DASHBOARD CONTENT AREA */}
        {/* ========================================================= */}
        <main className="flex-1 p-3.5 sm:p-5 flex flex-col gap-3.5 overflow-x-hidden">
          
          {/* TOP HEADER */}
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5 flex-1">
              <button
                onClick={() => setActiveTab('Overview')}
                className="min-w-36 py-2.5 sm:py-3 px-6 sm:px-10 rounded-2xl font-bold text-sm sm:text-base tracking-wide transition-all shadow-sm bg-[#180e5b] text-white shadow-indigo-950/20 cursor-pointer"
              >
                Overview
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
              <span>Fetching and aggregating real stock balance records from database...</span>
            </div>
          )}

          {/* EMPTY STATE IF 0 RECORDS MATCH */}
          {!loading && records.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="text-xs">
                <p className="font-bold">No stock balance records found for the selected filter criteria.</p>
                <p className="text-amber-700 mt-0.5">Try resetting filters or expanding the date range to see real stock data.</p>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TOP MONTHLY SALES CARDS WITH REAL SPARKLINES */}
          {/* ========================================================= */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {computed.monthlySalesCards.map((item, idx) => (
              <MonthlySalesCard
                key={item.key || idx}
                item={item}
                activeLiquorType={activeLiquorType}
                liquorSalesAmount={activeLiquorType ? (computed.monthlyLiquorSalesMap[item.key]?.[activeLiquorType] || 0) : null}
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
            <div className={`bg-[#f8fcff] rounded-2xl p-3.5 sm:p-4 border-2 transition-all flex flex-col min-w-0 overflow-hidden shadow-xs ${activeLiquorType ? 'border-indigo-400 ring-2 ring-indigo-200/50' : 'border-[#b8ddf8]'}`}>
              <div className="flex items-center justify-between mb-3 min-w-0">
                <h2 className="text-sm font-bold text-slate-800 truncate">
                  Liquor Type Wise Sale Amount
                </h2>
                {activeLiquorType && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-300 flex items-center gap-1 animate-pulse shadow-2xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                      Cross-filtering: {activeLiquorType}
                    </span>
                    {pinnedLiquorType && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setPinnedLiquorType(null); }}
                        className="text-[9px] font-bold text-slate-500 hover:text-slate-900 cursor-pointer bg-slate-200/80 hover:bg-slate-300 px-1.5 py-0.5 rounded"
                        title="Clear pinned filter"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex-1 flex items-center min-w-0 overflow-hidden">
                <div className="w-5 -rotate-90 text-[10px] font-bold text-slate-700 text-center whitespace-nowrap select-none shrink-0">
                  Liquor Type
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-center gap-2.5 py-1">
                  {computed.liquorTypeSalesList.map((item, idx) => {
                    const widthPercent = Math.min((item.amount / computed.maxLiquorSale) * 100, 100);
                    const sharePercent = computed.totalSalesRaw > 0 ? ((item.amount / computed.totalSalesRaw) * 100).toFixed(1) : '0';
                    const isSelected = activeLiquorType === item.type;
                    const isOther = activeLiquorType !== null && !isSelected;

                    return (
                      <div 
                        key={idx} 
                        className={`flex items-center gap-2 min-w-0 group/bar cursor-pointer rounded-xl px-2 py-1 transition-all duration-200 ${
                          isSelected 
                            ? 'bg-indigo-100 shadow-sm ring-1 ring-indigo-400' 
                            : isOther 
                              ? 'opacity-40 hover:opacity-85' 
                              : 'hover:bg-indigo-50/80'
                        }`}
                        onMouseEnter={(e) => {
                          setHoveredLiquorType(item.type);
                          showTooltip({
                            title: item.type,
                            badge: 'Cross-Highlight Active',
                            items: [
                              { label: 'Sales Amount', value: item.formatted, color: LIQUOR_COLORS[item.type] || '#818cf8' },
                              { label: 'Exact Sales (₹)', value: '₹ ' + Math.round(item.amount).toLocaleString('en-IN') },
                              { label: 'Share of Sales', value: `${sharePercent}%` },
                              { label: 'Interactive Link', value: 'Related data updated across other divs 🔗' }
                            ]
                          }, e);
                        }}
                        onMouseMove={moveTooltip}
                        onMouseLeave={() => {
                          setHoveredLiquorType(null);
                          hideTooltip();
                        }}
                        onClick={() => {
                          setPinnedLiquorType(prev => prev === item.type ? null : item.type);
                        }}
                      >
                        <span className={`w-11 text-[11px] font-bold text-right shrink-0 transition-colors ${
                          isSelected ? 'text-indigo-950 font-black' : 'text-slate-700'
                        }`}>
                          {item.type}
                        </span>
                        <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden">
                          <div 
                            className={`h-7 rounded-r-xs transition-all duration-300 shrink-0 shadow-xs ${
                              isSelected 
                                ? 'bg-indigo-600 scale-y-110 shadow-md ring-2 ring-indigo-300' 
                                : 'bg-[#818cf8] group-hover/bar:bg-indigo-500'
                            }`}
                            style={{ width: `${Math.min(Math.max(widthPercent * 0.70, 4), 70)}%` }}
                          ></div>
                          <span className={`text-[10px] sm:text-[11px] font-bold whitespace-nowrap shrink-0 transition-colors ${
                            isSelected ? 'text-indigo-950 font-black scale-105' : 'text-slate-700'
                          }`}>
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
                  <span className="truncate px-1">{formatCurrency(computed.maxLiquorSale * 0.33)}</span>
                  <span className="truncate px-1">{formatCurrency(computed.maxLiquorSale * 0.66)}</span>
                  <span className="truncate">{formatCurrency(computed.maxLiquorSale)}</span>
                </div>
                <p className="text-center text-[10px] font-bold text-slate-700 mt-0.5">
                  Sales Amount (₹)
                </p>
              </div>
            </div>

            {/* Card 2: Liquor Type Wise Case Sale (Real DB) */}
            <div className={`bg-[#f8fcff] rounded-2xl p-3.5 sm:p-4 border-2 transition-all flex flex-col min-w-0 overflow-hidden shadow-xs ${activeLiquorType ? 'border-indigo-400 ring-2 ring-indigo-200/50' : 'border-[#b8ddf8]'}`}>
              <div className="flex items-center justify-between mb-1 min-w-0">
                <h2 className="text-sm font-bold text-slate-800 truncate">
                  Liquor Type Wise Case Sale
                </h2>
                {activeLiquorType && (
                  <span className="text-[9px] font-black text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-200 shrink-0">
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
                        ? (computed.liquorTypeCaseList.find(l => l.type === activeLiquorType)?.casesFormatted || '0')
                        : (hoveredLiquorItem ? hoveredLiquorItem.casesFormatted : computed.totalCasesFormatted)
                    }
                    centerLabel={
                      activeLiquorType 
                        ? activeLiquorType 
                        : (hoveredLiquorItem ? hoveredLiquorItem.type : "Total Cases")
                    }
                    size={140}
                    strokeWidth={20}
                    hoveredIndex={
                      activeLiquorType
                        ? computed.liquorTypeCaseList.findIndex(l => l.type === activeLiquorType)
                        : hoveredLiquorIndex
                    }
                    onHoverSlice={(slice, idx, e) => {
                      setHoveredLiquorIndex(idx);
                      setHoveredLiquorItem(slice);
                      if (slice && e) {
                        showTooltip({
                          title: slice.type,
                          badge: 'Cases Share',
                          items: [
                            { label: 'Cases Sold', value: slice.casesFormatted + ' Cases', color: slice.color },
                            { label: 'Exact Cases', value: Math.round(slice.cases).toLocaleString('en-IN') },
                            { label: 'Share of Cases', value: slice.percent }
                          ]
                        }, e);
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
                            ? 'bg-indigo-100 text-indigo-950 font-black ring-1 ring-indigo-400 scale-102 shadow-2xs' 
                            : isOther 
                              ? 'opacity-35 text-slate-400' 
                              : hoveredLiquorIndex === idx 
                                ? 'bg-indigo-50 text-indigo-900 font-black' 
                                : 'text-slate-700 hover:text-slate-900'
                        }`}
                        onMouseEnter={(e) => {
                          setHoveredLiquorIndex(idx);
                          setHoveredLiquorItem(item);
                          showTooltip({
                            title: item.type,
                            badge: 'Cases Share',
                            items: [
                              { label: 'Cases Sold', value: item.casesFormatted + ' Cases', color: item.color },
                              { label: 'Exact Cases', value: Math.round(item.cases).toLocaleString('en-IN') },
                              { label: 'Share of Cases', value: item.percent }
                            ]
                          }, e);
                        }}
                        onMouseMove={moveTooltip}
                        onMouseLeave={() => {
                          setHoveredLiquorIndex(null);
                          setHoveredLiquorItem(null);
                          hideTooltip();
                        }}
                      >
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }}></div>
                        <span className="truncate">{item.type}</span>
                        <span className={`text-[9px] ml-auto shrink-0 ${isLinked ? 'font-black text-indigo-900' : 'text-slate-500'}`}>{item.percent}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom callout summary from real data */}
              <div className="grid grid-cols-4 gap-1 text-center border-t border-[#b8ddf8] pt-1.5 text-[9px] font-bold text-slate-600 min-w-0">
                {computed.liquorTypeCaseList.slice(0, 4).map((item, idx) => {
                  const isLinked = activeLiquorType === item.type;
                  return (
                    <div key={idx} className={`truncate transition-all ${isLinked ? 'bg-indigo-100/90 text-indigo-950 rounded py-0.5 ring-1 ring-indigo-300 font-black scale-105' : activeLiquorType ? 'opacity-40' : ''}`}>
                      <span className="block text-slate-900 font-black truncate">{item.casesFormatted}</span>
                      <span className="truncate">{item.percent}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Card 3: Store Wise Sale Amount (Real DB) */}
            <div className={`bg-[#f8fcff] rounded-2xl p-3.5 sm:p-4 border-2 transition-all flex flex-col min-w-0 overflow-hidden shadow-xs ${activeLiquorType ? 'border-indigo-400 ring-2 ring-indigo-200/50' : 'border-[#b8ddf8]'}`}>
              <div className="flex items-center justify-between mb-1 min-w-0">
                <h2 className="text-sm font-bold text-slate-800 truncate">
                  Store Wise Sale Amount
                </h2>
                {activeLiquorType && (
                  <span className="text-[9px] font-black text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-200 shrink-0">
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
                    const widthPercent = Math.min((item.amount / computed.maxStoreSale) * 100, 100);
                    const contribution = computed.totalSalesRaw > 0 ? ((item.amount / computed.totalSalesRaw) * 100).toFixed(1) : '0';
                    
                    const storeLiquorSale = activeLiquorType ? (computed.storeLiquorSalesMap[item.store]?.[activeLiquorType] || 0) : 0;
                    const liquorShare = item.amount > 0 && activeLiquorType ? ((storeLiquorSale / item.amount) * 100).toFixed(0) : '0';

                    return (
                      <div 
                        key={idx} 
                        className="flex items-center gap-1.5 min-w-0 group/store cursor-pointer rounded-lg px-1 py-0.5 transition-colors hover:bg-indigo-50/80"
                        onMouseEnter={(e) => showTooltip({
                          title: item.store,
                          badge: activeLiquorType ? `${activeLiquorType} Sales` : 'Store Sales',
                          items: [
                            ...(activeLiquorType ? [
                              { label: `${activeLiquorType} Sales`, value: formatCurrency(storeLiquorSale), color: '#4f46e5' },
                              { label: 'Exact Liquor (₹)', value: '₹ ' + Math.round(storeLiquorSale).toLocaleString('en-IN') },
                              { label: `Share of ${item.store}`, value: `${liquorShare}%` },
                              { label: 'Store Total Sales', value: item.formatted }
                            ] : [
                              { label: 'Sales Amount', value: item.formatted, color: '#818cf8' },
                              { label: 'Exact Sales (₹)', value: '₹ ' + Math.round(item.amount).toLocaleString('en-IN') },
                              { label: 'Contribution', value: `${contribution}% of Total` }
                            ])
                          ]
                        }, e)}
                        onMouseMove={moveTooltip}
                        onMouseLeave={hideTooltip}
                      >
                        <span className="w-22 text-[10px] font-bold text-slate-700 text-right truncate shrink-0 group-hover/store:text-indigo-900" title={item.store}>
                          {item.store}
                        </span>
                        
                        <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden">
                          {activeLiquorType ? (
                            // Cross-highlight dual bar
                            <div className="relative h-4 rounded-r-xs overflow-hidden shrink-0 bg-slate-200/90" style={{ width: `${Math.min(Math.max(widthPercent * 0.68, 5), 68)}%` }}>
                              <div 
                                className="h-full bg-indigo-600 rounded-r-xs transition-all duration-300 shadow-xs"
                                style={{ width: `${Math.min(Math.max((storeLiquorSale / (item.amount || 1)) * 100, storeLiquorSale > 0 ? 5 : 0), 100)}%` }}
                              ></div>
                            </div>
                          ) : (
                            <div 
                              className="h-4 bg-[#818cf8] rounded-r-xs transition-all duration-300 group-hover/store:bg-indigo-600 group-hover/store:scale-y-110 shrink-0 shadow-xs"
                              style={{ width: `${Math.min(Math.max(widthPercent * 0.68, 5), 68)}%` }}
                            ></div>
                          )}

                          <span className="text-[9px] sm:text-[10px] font-bold text-slate-700 whitespace-nowrap shrink-0 group-hover/store:text-indigo-900">
                            {activeLiquorType ? formatCurrency(storeLiquorSale) : item.formatted}
                            {activeLiquorType && storeLiquorSale > 0 && (
                              <span className="text-[8px] text-indigo-600 ml-1 font-black">({liquorShare}%)</span>
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
                  <span className="truncate px-1">{formatCurrency(computed.maxStoreSale * 0.5)}</span>
                  <span className="truncate">{formatCurrency(computed.maxStoreSale)}</span>
                </div>
                <p className="text-center text-[10px] font-bold text-slate-700 mt-0.5">
                  {activeLiquorType ? `${activeLiquorType} Sales Amount (₹)` : 'Sales Amount (₹)'}
                </p>
              </div>
            </div>

          </section>

          {/* ========================================================= */}
          {/* BOTTOM ROW: 3 MAJOR REAL VISUALIZATIONS */}
          {/* ========================================================= */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
            
            {/* Card 1: Monthly Liquor Type Case Sold (Real DB Stacked Columns) */}
            <div className={`bg-[#f8fcff] rounded-2xl p-3.5 sm:p-4 border-2 transition-all flex flex-col min-w-0 overflow-hidden shadow-xs ${activeLiquorType ? 'border-indigo-400 ring-2 ring-indigo-200/50' : 'border-[#b8ddf8]'}`}>
              <div className="flex items-center justify-between mb-1 min-w-0">
                <h2 className="text-sm font-bold text-slate-800 truncate">
                  Monthly Liquor Type Case Sold
                </h2>
                {activeLiquorType && (
                  <span className="text-[9px] font-black text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-200 shrink-0">
                    Linked: {activeLiquorType} Cases
                  </span>
                )}
              </div>

              {/* Top Legend */}
              <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] font-bold text-slate-700 mb-1.5">
                <span className="font-black text-slate-800">Liquor Type:</span>
                {[
                  { type: 'IMFL', color: '#160c5c' },
                  { type: 'BEER', color: '#3b82f6' },
                  { type: 'MML', color: '#f43f5e' },
                  { type: 'WINE', color: '#eab308' }
                ].map(lg => {
                  const isLinked = activeLiquorType === lg.type;
                  const isOther = activeLiquorType !== null && !isLinked;
                  return (
                    <span 
                      key={lg.type} 
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full transition-all cursor-pointer ${
                        isLinked 
                          ? 'bg-indigo-100 ring-1 ring-indigo-400 font-black text-indigo-950 scale-105' 
                          : isOther 
                            ? 'opacity-35 text-slate-400' 
                            : 'hover:bg-slate-100'
                      }`}
                      onClick={() => setPinnedLiquorType(prev => prev === lg.type ? null : lg.type)}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: lg.color }}></span>
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
                    const maxTotalCases = Math.max(...computed.monthlyStackedCases.map(i => i.totalCases), 1);
                    const maxStackH = 105; // fixed max stack height in px
                    const stackHeight = Math.max((m.totalCases / maxTotalCases) * maxStackH, 14);
                    const sumCases = m.imfl + m.beer + m.mml + m.wine || 1;

                    const imflH = (m.imfl / sumCases) * stackHeight;
                    const beerH = (m.beer / sumCases) * stackHeight;
                    const mmlH = (m.mml / sumCases) * stackHeight;
                    const wineH = (m.wine / sumCases) * stackHeight;

                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end max-w-20 min-w-0">
                        <span className={`text-[10px] font-black mb-1 truncate ${activeLiquorType ? 'text-indigo-700 bg-indigo-50 px-1 rounded border border-indigo-200' : 'text-slate-900'}`}>
                          {activeLiquorType ? formatShortNumber(m[activeLiquorType.toLowerCase()]) : m.totalFormatted}
                        </span>
                        
                        <div className="w-full max-w-11 rounded-t-xs overflow-hidden flex flex-col-reverse shadow-xs shrink-0">
                          {imflH > 0 && (
                            <div 
                              className={`bg-[#160c5c] text-white text-[8px] font-black flex items-center justify-center overflow-hidden shrink-0 cursor-pointer transition-all ${
                                activeLiquorType === 'IMFL' 
                                  ? 'brightness-125 z-10 ring-2 ring-white scale-x-105 shadow-md' 
                                  : activeLiquorType 
                                    ? 'opacity-25 grayscale-30' 
                                    : 'hover:brightness-125'
                              }`}
                              style={{ height: `${imflH}px` }}
                              onMouseEnter={(e) => showTooltip({
                                title: `${m.monthName} - IMFL`,
                                badge: 'Monthly Stack',
                                items: [
                                  { label: 'IMFL Cases', value: formatShortNumber(m.imfl) + ' Cases', color: '#160c5c' },
                                  { label: 'Exact Cases', value: Math.round(m.imfl).toLocaleString('en-IN') },
                                  { label: 'Month Total', value: m.totalFormatted + ' Cases' },
                                  { label: 'Month Share', value: `${((m.imfl / (sumCases || 1)) * 100).toFixed(1)}%` }
                                ]
                              }, e)}
                              onMouseMove={moveTooltip}
                              onMouseLeave={hideTooltip}
                            >
                              {activeLiquorType === 'IMFL' ? formatShortNumber(m.imfl) : imflH >= 16 ? formatShortNumber(m.imfl) : null}
                            </div>
                          )}
                          {beerH > 0 && (
                            <div 
                              className={`bg-[#3b82f6] text-white text-[8px] font-black flex items-center justify-center overflow-hidden shrink-0 cursor-pointer transition-all ${
                                activeLiquorType === 'BEER' 
                                  ? 'brightness-125 z-10 ring-2 ring-white scale-x-105 shadow-md' 
                                  : activeLiquorType 
                                    ? 'opacity-25 grayscale-30' 
                                    : 'hover:brightness-125'
                              }`}
                              style={{ height: `${beerH}px` }}
                              onMouseEnter={(e) => showTooltip({
                                title: `${m.monthName} - BEER`,
                                badge: 'Monthly Stack',
                                items: [
                                  { label: 'BEER Cases', value: formatShortNumber(m.beer) + ' Cases', color: '#3b82f6' },
                                  { label: 'Exact Cases', value: Math.round(m.beer).toLocaleString('en-IN') },
                                  { label: 'Month Total', value: m.totalFormatted + ' Cases' },
                                  { label: 'Month Share', value: `${((m.beer / (sumCases || 1)) * 100).toFixed(1)}%` }
                                ]
                              }, e)}
                              onMouseMove={moveTooltip}
                              onMouseLeave={hideTooltip}
                            >
                              {activeLiquorType === 'BEER' ? formatShortNumber(m.beer) : beerH >= 16 ? formatShortNumber(m.beer) : null}
                            </div>
                          )}
                          {mmlH > 0 && (
                            <div 
                              className={`bg-[#f43f5e] text-white text-[8px] font-black flex items-center justify-center overflow-hidden shrink-0 cursor-pointer transition-all ${
                                activeLiquorType === 'MML' 
                                  ? 'brightness-125 z-10 ring-2 ring-white scale-x-105 shadow-md' 
                                  : activeLiquorType 
                                    ? 'opacity-25 grayscale-30' 
                                    : 'hover:brightness-125'
                              }`}
                              style={{ height: `${mmlH}px` }}
                              onMouseEnter={(e) => showTooltip({
                                title: `${m.monthName} - MML`,
                                badge: 'Monthly Stack',
                                items: [
                                  { label: 'MML Cases', value: formatShortNumber(m.mml) + ' Cases', color: '#f43f5e' },
                                  { label: 'Exact Cases', value: Math.round(m.mml).toLocaleString('en-IN') },
                                  { label: 'Month Total', value: m.totalFormatted + ' Cases' },
                                  { label: 'Month Share', value: `${((m.mml / (sumCases || 1)) * 100).toFixed(1)}%` }
                                ]
                              }, e)}
                              onMouseMove={moveTooltip}
                              onMouseLeave={hideTooltip}
                            >
                              {activeLiquorType === 'MML' ? formatShortNumber(m.mml) : mmlH >= 16 ? formatShortNumber(m.mml) : null}
                            </div>
                          )}
                          {wineH > 0 && (
                            <div 
                              className={`bg-[#eab308] text-white text-[8px] font-black flex items-center justify-center overflow-hidden shrink-0 cursor-pointer transition-all ${
                                activeLiquorType === 'WINE' 
                                  ? 'brightness-125 z-10 ring-2 ring-white scale-x-105 shadow-md' 
                                  : activeLiquorType 
                                    ? 'opacity-25 grayscale-30' 
                                    : 'hover:brightness-125'
                              }`}
                              style={{ height: `${wineH}px` }}
                              onMouseEnter={(e) => showTooltip({
                                title: `${m.monthName} - WINE`,
                                badge: 'Monthly Stack',
                                items: [
                                  { label: 'WINE Cases', value: formatShortNumber(m.wine) + ' Cases', color: '#eab308' },
                                  { label: 'Exact Cases', value: Math.round(m.wine).toLocaleString('en-IN') },
                                  { label: 'Month Total', value: m.totalFormatted + ' Cases' },
                                  { label: 'Month Share', value: `${((m.wine / (sumCases || 1)) * 100).toFixed(1)}%` }
                                ]
                              }, e)}
                              onMouseMove={moveTooltip}
                              onMouseLeave={hideTooltip}
                            >
                              {activeLiquorType === 'WINE' ? formatShortNumber(m.wine) : wineH >= 16 ? formatShortNumber(m.wine) : null}
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

            {/* Card 2: Day Wise Case Sold (Real DB Spline Curve with Probe) */}
            <div className="bg-[#f8fcff] rounded-2xl p-3.5 sm:p-4 border-2 border-[#b8ddf8] shadow-xs flex flex-col min-w-0 overflow-hidden">
              <h2 className="text-center text-sm font-bold text-slate-800 mb-1 truncate">
                Day Wise Case Sold
              </h2>

              <div className="flex-1 flex items-center justify-center py-1 min-w-0 overflow-hidden">
                <DayWiseChart 
                  dayMap={computed.dayWiseCasesMap} 
                  hoveredDay={hoveredDayProbe}
                  onHoverDay={(item, e) => {
                    setHoveredDayProbe(item);
                    if (item && e) {
                      showTooltip({
                        title: `Day ${item.day}`,
                        badge: item.isPeak ? 'Peak Day 🌟' : item.isMin ? 'Lowest Day 🔻' : 'Daily Trend',
                        items: [
                          { label: 'Cases Sold', value: formatShortNumber(item.cases) + ' Cases', color: '#4338ca' },
                          { label: 'Exact Cases', value: Math.round(item.cases).toLocaleString('en-IN') },
                          { label: 'Contribution', value: `${((item.cases / (computed.totalCasesRaw || 1)) * 100).toFixed(2)}%` }
                        ]
                      }, e);
                    } else {
                      hideTooltip();
                    }
                  }}
                />
              </div>
            </div>

            {/* Card 3: Subhead Category Wise Sale Amount (Real DB Donut & Legend) */}
            <div className={`bg-[#f8fcff] rounded-2xl p-3.5 sm:p-4 border-2 transition-all flex flex-col min-w-0 overflow-hidden shadow-xs ${activeLiquorType ? 'border-indigo-400 ring-2 ring-indigo-200/50' : 'border-[#b8ddf8]'}`}>
              <div className="flex items-center justify-between mb-1 min-w-0">
                <h2 className="text-sm font-bold text-slate-800 truncate">
                  Subhead Category Wise Sale Amount
                </h2>
                {activeLiquorType && (
                  <span className="text-[9px] font-black text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-200 shrink-0">
                    {activeLiquorType} Subheads
                  </span>
                )}
              </div>

              {(() => {
                const displayedSubheads = (activeLiquorType && computed.subheadsByLiquorLists && computed.subheadsByLiquorLists[activeLiquorType]?.length > 0)
                  ? computed.subheadsByLiquorLists[activeLiquorType]
                  : computed.subheadCategoriesList;

                const activeLiquorTotal = activeLiquorType
                  ? (computed.liquorTypeSalesList.find(l => l.type === activeLiquorType)?.formatted || '₹ 0')
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
                            : (activeLiquorType ? `${activeLiquorType} Total` : "Total Sales")
                        }
                        size={135}
                        strokeWidth={20}
                        hoveredIndex={hoveredSubheadIndex}
                        onHoverSlice={(slice, idx, e) => {
                          setHoveredSubheadIndex(idx);
                          setHoveredSubheadItem(slice);
                          if (slice && e) {
                            showTooltip({
                              title: slice.name,
                              badge: activeLiquorType ? `${activeLiquorType} Subhead` : 'Category Share',
                              items: [
                                { label: 'Sales Amount', value: slice.amountFormatted, color: slice.color },
                                { label: 'Exact Amount (₹)', value: '₹ ' + Math.round(slice.amount).toLocaleString('en-IN') },
                                { label: 'Share of Sales', value: slice.percent }
                              ]
                            }, e);
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
                          className={`flex items-center justify-between gap-1 text-[10px] font-bold py-0.5 min-w-0 cursor-pointer rounded px-1 transition-colors ${hoveredSubheadIndex === idx ? 'bg-indigo-50 text-indigo-900 font-black' : 'text-slate-700 hover:text-slate-900'}`}
                          onMouseEnter={(e) => {
                            setHoveredSubheadIndex(idx);
                            setHoveredSubheadItem(cat);
                            showTooltip({
                              title: cat.name,
                              badge: activeLiquorType ? `${activeLiquorType} Subhead` : 'Category Share',
                              items: [
                                { label: 'Sales Amount', value: cat.amountFormatted, color: cat.color },
                                { label: 'Exact Amount (₹)', value: '₹ ' + Math.round(cat.amount).toLocaleString('en-IN') },
                                { label: 'Share of Sales', value: cat.percent }
                              ]
                            }, e);
                          }}
                          onMouseMove={moveTooltip}
                          onMouseLeave={() => {
                            setHoveredSubheadIndex(null);
                            setHoveredSubheadItem(null);
                            hideTooltip();
                          }}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 truncate">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }}></div>
                            <span className="truncate" title={cat.name}>{cat.name}</span>
                          </div>
                          <span className="text-slate-500 font-semibold text-[9px] shrink-0 ml-1">{cat.percent}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

          </section>

          {/* Power BI-style Floating Tooltip */}
          <ChartTooltip tooltip={tooltip} />

        </main>

      </div>
    </div>
  );
}
