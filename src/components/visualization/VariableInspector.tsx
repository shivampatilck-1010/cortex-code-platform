'use client';

import React, { useState } from 'react';
import { VariableRecord } from '@/lib/visualization/types';
import { Variable, ArrowRight, ChevronRight, ChevronDown, CheckCircle2 } from 'lucide-react';

interface VariableInspectorProps {
  variables: Record<string, VariableRecord>;
  changedVariables: string[];
  selectedVarName?: string | null;
  onSelectVariable?: (name: string, record: VariableRecord) => void;
}

export const VariableInspector: React.FC<VariableInspectorProps> = ({
  variables,
  changedVariables,
  selectedVarName = null,
  onSelectVariable,
}) => {
  const [expandedVars, setExpandedVars] = useState<Record<string, boolean>>({});

  const toggleExpand = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedVars((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const varEntries = Object.entries(variables);

  if (varEntries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center text-[#71717A]">
        <Variable className="w-7 h-7 mb-1.5 opacity-30 text-[#06B6D4]" />
        <p className="text-xs font-mono">No variables in active scope.</p>
      </div>
    );
  }

  const renderValuePreview = (val: any) => {
    if (val === null) return <span className="text-[#EF4444] font-bold">null</span>;
    if (val === undefined) return <span className="text-[#71717A]">undefined</span>;
    if (typeof val === 'boolean') return <span className="text-[#A855F7] font-bold">{String(val)}</span>;
    if (typeof val === 'number') return <span className="text-[#FF9100] font-bold">{val}</span>;
    if (typeof val === 'string') return <span className="text-[#10B981]">"{val}"</span>;
    if (Array.isArray(val)) return <span className="text-[#06B6D4] font-semibold">[{val.length} items]</span>;
    if (typeof val === 'object') {
      const className = val._class || 'Object';
      const keys = Object.keys(val).filter((k) => !k.startsWith('_'));
      return <span className="text-[#3B82F6] font-semibold">{className} ({keys.length} fields)</span>;
    }
    return <span>{String(val)}</span>;
  };

  return (
    <div className="space-y-2">
      {varEntries.map(([name, record]) => {
        const isChanged = changedVariables.includes(name);
        const isSelected = selectedVarName === name;
        const isExpanded = Boolean(expandedVars[name]);
        const isComplex = typeof record.value === 'object' && record.value !== null;

        return (
          <div
            key={name}
            onClick={() => onSelectVariable && onSelectVariable(name, record)}
            className={`rounded-lg font-mono text-xs border transition-all cursor-pointer ${
              isSelected
                ? 'bg-[#181920] border-[#06B6D4] shadow-md ring-1 ring-[#06B6D4]'
                : isChanged
                ? 'bg-[#06B6D4]/10 border-[#06B6D4]/50 text-[#E6EDF3] shadow-sm'
                : 'bg-[#14151B] hover:bg-[#181922] border-[#22242D] text-[#A1A1AA]'
            }`}
          >
            {/* Header / Summary Row */}
            <div className="flex items-center justify-between p-2.5">
              <div className="flex items-center space-x-2 min-w-0">
                {isComplex ? (
                  <button
                    type="button"
                    onClick={(e) => toggleExpand(name, e)}
                    className="p-0.5 text-[#71717A] hover:text-white"
                  >
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                ) : (
                  <span className="w-3.5" />
                )}
                <span className={`font-semibold truncate ${isChanged ? 'text-[#06B6D4]' : 'text-white'}`}>
                  {name}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1C1E26] text-[#71717A] border border-[#282A36]">
                  {record.type}
                </span>
                {isChanged && (
                  <span className="text-[9px] uppercase px-1 py-0.5 rounded bg-[#06B6D4]/20 text-[#06B6D4] font-bold">
                    Changed
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2 pl-2 text-right truncate">
                {isChanged && record.previousValue !== undefined && (
                  <div className="flex items-center space-x-1 text-[#71717A] text-[11px] line-through truncate max-w-[100px]">
                    <span>{typeof record.previousValue === 'object' ? 'prev' : String(record.previousValue)}</span>
                    <ArrowRight className="w-3 h-3 text-[#71717A] inline-block flex-shrink-0" />
                  </div>
                )}
                <div className="truncate max-w-[180px] font-semibold">
                  {renderValuePreview(record.value)}
                </div>
              </div>
            </div>

            {/* Expandable Details for Complex Objects or Collections */}
            {isComplex && isExpanded && (
              <div className="border-t border-[#1F212B] bg-[#0E0F14] p-3 text-[11px] space-y-1.5">
                {Array.isArray(record.value) ? (
                  <div className="space-y-1">
                    <div className="text-[10px] text-[#71717A] uppercase font-bold tracking-wider">
                      Array Elements ({record.value.length})
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                      {record.value.map((item, idx) => (
                        <div key={idx} className="flex justify-between p-1.5 rounded bg-[#15161C] border border-[#22242D]">
                          <span className="text-[#71717A]">[{idx}]:</span>
                          <span className="text-white font-semibold truncate ml-1">{String(item)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="text-[10px] text-[#71717A] uppercase font-bold tracking-wider">
                      Object Fields
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {Object.entries(record.value)
                        .filter(([k]) => !k.startsWith('_'))
                        .map(([k, v]) => (
                          <div key={k} className="flex justify-between p-1.5 rounded bg-[#15161C] border border-[#22242D]">
                            <span className="text-[#06B6D4]">{k}:</span>
                            <span className="text-white font-semibold truncate ml-2">
                              {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
