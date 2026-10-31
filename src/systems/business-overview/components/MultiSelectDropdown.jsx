import React, { useState, useMemo, useEffect, useRef } from "react";
import { Search, ChevronDown } from "lucide-react";

// Tick-box multi-select dropdown (same look as the KPI Metric filter on Group Wise Store Wise Sale)
export default function MultiSelectDropdown({
  label,
  options = [],
  selected = new Set(),
  onChange,
  icon: Icon,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    return options.filter((o) =>
      String(o).toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [options, searchTerm]);

  const handleSelectAll = (e) => {
    e.stopPropagation();
    onChange(new Set(options));
  };

  const handleClearAll = (e) => {
    e.stopPropagation();
    onChange(new Set());
  };

  const handleToggle = (opt) => {
    const next = new Set(selected);
    if (next.has(opt)) {
      next.delete(opt);
    } else {
      next.add(opt);
    }
    onChange(next);
  };

  const isNoneSelected = selected.size === 0;

  let buttonText = "All";
  if (!isNoneSelected) {
    if (selected.size <= 2) {
      buttonText = Array.from(selected).join(", ");
    } else {
      buttonText = `${selected.size} selected`;
    }
  }

  return (
    <div className="flex flex-col gap-1 min-w-[140px] flex-1 relative" ref={dropdownRef}>
      <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3 text-indigo-600 shrink-0" />}
        <span>{label}</span>
      </label>

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full px-3 py-2 text-xs font-semibold rounded-xl border flex items-center justify-between gap-1.5 transition-all text-left shadow-2xs ${
          !isNoneSelected
            ? "bg-indigo-50/80 border-indigo-300 text-indigo-950 font-bold ring-2 ring-indigo-200/50"
            : "bg-white border-[#badbf4] text-slate-700 hover:border-indigo-400"
        }`}
      >
        <span className="truncate">{buttonText}</span>
        <div className="flex items-center gap-1 shrink-0">
          {!isNoneSelected && (
            <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-black flex items-center justify-center">
              {selected.size}
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="absolute top-[calc(100%+4px)] left-0 min-w-[210px] w-full max-w-[280px] bg-white rounded-xl shadow-xl border border-[#badbf4] z-50 p-2 flex flex-col gap-2">
          <div className="flex items-center justify-between px-1 pb-1.5 border-b border-slate-100 text-[11px]">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="text-slate-400 hover:text-slate-600 font-medium cursor-pointer"
            >
              Clear
            </button>
          </div>

          {options.length > 5 && (
            <div className="relative px-1">
              <Search className="w-3 h-3 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-full pl-7 pr-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-indigo-400"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5 pr-1">
            {filteredOptions.length === 0 ? (
              <div className="text-[11px] text-slate-400 py-3 text-center">No options available</div>
            ) : (
              filteredOptions.map((opt) => {
                const checked = selected.has(opt);
                return (
                  <label
                    key={opt}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors select-none ${
                      checked ? "bg-indigo-50/70 text-indigo-900 font-bold" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggle(opt)}
                      className="w-3.5 h-3.5 rounded-sm text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="truncate">{opt}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
