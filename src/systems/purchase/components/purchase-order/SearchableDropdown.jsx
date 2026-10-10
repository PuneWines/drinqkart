import { useState, useEffect, useRef } from "react";
import { Search, ChevronDown, Check, Trash2 } from "lucide-react";

const getOptionLabel = (option) => {
  if (option == null) return "";
  if (typeof option === "string") return option;
  if (typeof option === "object") {
    if (option.companyName) {
      return `${option.partyName || option.label || option.key} (${option.companyName})`;
    }
    return option.partyName || option.label || option.key || option.name || "";
  }
  return String(option);
};

const getOptionValue = (option) => {
  if (option == null) return "";
  if (typeof option === "string") return option;
  if (typeof option === "object") {
    return option.key || option.value || option.partyName || option.label || "";
  }
  return String(option);
};

const SearchableDropdown = ({ options = [], value, onChange, placeholder = "Select an option", onDeleteOption }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const safeOptions = Array.isArray(options) ? options : [];

  const filteredOptions = safeOptions.filter(option => {
    const label = getOptionLabel(option);
    return label.toLowerCase().includes((searchTerm || "").toLowerCase());
  });

  const displayValue = (() => {
    if (!value) return placeholder;
    if (typeof value === "string" && value.includes("::")) {
      const [party, comp] = value.split("::");
      return comp ? `${party} (${comp})` : party;
    }
    const matched = safeOptions.find(o => getOptionValue(o) === value);
    if (matched) return getOptionLabel(matched);
    return typeof value === "object" ? getOptionLabel(value) : value;
  })();

  return (
    <div className="searchable-dropdown" ref={dropdownRef} style={{ position: 'relative', display: 'inline-block', width: '100%', maxWidth: '300px' }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px',
          backgroundColor: '#f8fafc', cursor: 'pointer', fontSize: '0.875rem',
          color: '#334155', transition: 'border-color 0.2s',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#94a3b8'}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
          {displayValue}
        </span>
        <ChevronDown size={16} color="#64748b" style={{ marginLeft: '8px', minWidth: '16px' }} />
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
          zIndex: 100, maxHeight: '250px', display: 'flex', flexDirection: 'column'
        }}>
          <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center' }}>
            <Search size={14} color="#94a3b8" style={{ marginRight: '8px' }} />
            <input
              autoFocus
              type="text"
              placeholder="Search party..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                border: 'none', outline: 'none', width: '100%', fontSize: '0.875rem', color: '#334155'
              }}
            />
          </div>
          <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
            {filteredOptions.length > 0 ? filteredOptions.map((option, idx) => {
              const optVal = getOptionValue(option);
              const optLabel = getOptionLabel(option);
              const isSelected = value === optVal || value === option || value === optLabel;

              return (
                <div 
                  key={idx}
                  onClick={() => {
                    onChange(optVal);
                    setIsOpen(false);
                    setSearchTerm("");
                  }}
                  style={{
                    padding: '8px 12px', cursor: 'pointer', fontSize: '0.875rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    backgroundColor: isSelected ? '#f0f9ff' : 'transparent',
                    color: isSelected ? '#0284c7' : '#475569',
                    fontWeight: isSelected ? 600 : 400
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}>
                    {optLabel}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isSelected && <Check size={14} color="#0284c7" style={{ minWidth: '14px' }} />}
                    {onDeleteOption && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteOption(option);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        title="Remove vendor from selection"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            }) : (
              <div style={{ padding: '12px', fontSize: '0.875rem', color: '#94a3b8', textAlign: 'center' }}>
                No parties found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableDropdown;
