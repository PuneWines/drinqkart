import { useState, useEffect, useRef } from "react";
import { Search, ChevronDown, Check, Trash2 } from "lucide-react";

const parseStringParts = (str) => {
  if (!str) return { vendorName: "", companyName: "" };
  const match = str.match(/^(.*?)\s*\((.*?)\)$/);
  if (match) {
    return { vendorName: match[1].trim(), companyName: match[2].trim() };
  }
  return { vendorName: str.trim(), companyName: "" };
};

const getOptionParts = (option) => {
  if (option == null) return { vendorName: "", companyName: "" };

  if (typeof option === "object") {
    let vendor = (option.partyName || option.name || "").trim();
    let comp = (option.companyScope || option.companyName || "").trim();

    if (vendor) {
      if (!comp) {
        const match = vendor.match(/^(.*?)\s*\((.*?)\)$/);
        if (match) {
          vendor = match[1].trim();
          comp = match[2].trim();
        }
      }
      return { vendorName: vendor, companyName: comp };
    }

    const keyOrLabel = option.label || option.key || "";
    return parseStringParts(keyOrLabel);
  }

  return parseStringParts(String(option));
};

const getOptionLabel = (option) => {
  if (option == null) return "";
  const { vendorName, companyName } = getOptionParts(option);
  if (vendorName && companyName) {
    return `${vendorName} (${companyName})`;
  }
  if (vendorName) return vendorName;
  if (typeof option === "object") {
    return option.label || option.key || option.partyName || "";
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
    const { vendorName, companyName } = getOptionParts(option);
    const label = getOptionLabel(option);
    const search = (searchTerm || "").toLowerCase().trim();
    if (!search) return true;
    return (
      (vendorName && vendorName.toLowerCase().includes(search)) ||
      (companyName && companyName.toLowerCase().includes(search)) ||
      (label && label.toLowerCase().includes(search))
    );
  });

  const selectedParts = (() => {
    if (!value) return null;
    const matched = safeOptions.find(o => getOptionValue(o) === value);
    if (matched) return getOptionParts(matched);
    return getOptionParts(value);
  })();

  return (
    <div className="searchable-dropdown" ref={dropdownRef} style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '7px 12px', border: '1px solid #cbd5e1', borderRadius: '6px',
          backgroundColor: '#f8fafc', cursor: 'pointer', fontSize: '0.875rem',
          color: '#334155', transition: 'border-color 0.2s',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)',
          minHeight: '38px'
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#94a3b8'}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
      >
        {!selectedParts || !selectedParts.vendorName ? (
          <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>{placeholder}</span>
        ) : (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', overflow: 'hidden', minWidth: 0 }}>
            <span style={{ 
              fontWeight: 700, 
              color: '#0f172a', 
              fontSize: '0.875rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {selectedParts.vendorName}
            </span>
            {selectedParts.companyName && (
              <span style={{ 
                fontSize: '0.75rem', 
                color: '#64748b', 
                fontWeight: 400,
                flexShrink: 0 
              }}>
                ({selectedParts.companyName})
              </span>
            )}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px', flexShrink: 0 }}>
          {selectedParts && selectedParts.vendorName && onDeleteOption && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const matched = safeOptions.find(o => getOptionValue(o) === value) || value;
                onDeleteOption(matched);
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
              <Trash2 size={14} />
            </button>
          )}
          <ChevronDown size={16} color="#64748b" style={{ minWidth: '16px' }} />
        </div>
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
          zIndex: 100, maxHeight: '250px', display: 'flex', flexDirection: 'column'
        }}>
          <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center' }}>
            <Search size={14} color="#94a3b8" style={{ marginRight: '8px', flexShrink: 0 }} />
            <input
              autoFocus
              type="text"
              placeholder="Search vendor or company..."
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
              const parts = getOptionParts(option);
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
                    padding: '8px 12px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    backgroundColor: isSelected ? '#f0f9ff' : 'transparent',
                    borderBottom: idx < filteredOptions.length - 1 ? '1px solid #f8fafc' : 'none',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', marginRight: '8px', minWidth: 0, flex: 1 }}>
                    <span style={{ 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis', 
                      whiteSpace: 'nowrap',
                      fontSize: '0.9rem',
                      fontWeight: 650,
                      color: isSelected ? '#0284c7' : '#0f172a',
                      lineHeight: 1.25
                    }}>
                      {parts.vendorName || optLabel}
                    </span>
                    {parts.companyName ? (
                      <span style={{ 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap',
                        fontSize: '0.75rem',
                        fontWeight: 400,
                        color: isSelected ? '#0284c7' : '#64748b',
                        lineHeight: 1.2
                      }}>
                        {parts.companyName}
                      </span>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
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
