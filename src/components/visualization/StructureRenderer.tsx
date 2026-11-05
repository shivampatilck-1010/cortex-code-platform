'use client';

import React, { useState } from 'react';
import { StructureHint } from '@/lib/visualization/types';
import { 
  Layers, 
  ArrowRight, 
  CornerDownRight, 
  Database, 
  GitBranch, 
  Share2, 
  Box, 
  CheckCircle2, 
  ChevronRight, 
  ChevronDown,
  Info
} from 'lucide-react';

export interface SelectedElementInfo {
  category: string;
  label: string;
  value?: any;
  path?: string;
  details: Record<string, any>;
}

interface StructureRendererProps {
  structures: StructureHint[];
  changedVariables?: string[];
  selectedElementId?: string | null;
  onSelectElement?: (element: SelectedElementInfo | null) => void;
}

export const StructureRenderer: React.FC<StructureRendererProps> = ({
  structures,
  changedVariables = [],
  selectedElementId = null,
  onSelectElement,
}) => {
  const [expandedObjects, setExpandedObjects] = useState<Record<string, boolean>>({});

  const toggleObjectExpand = (key: string) => {
    setExpandedObjects((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!structures || structures.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center text-[#71717A]">
        <Database className="w-9 h-9 mb-2.5 opacity-30 text-[#06B6D4]" />
        <p className="text-xs font-mono font-semibold text-[#A1A1AA]">No Specialized Data Structures Detected</p>
        <p className="text-[11px] text-[#52525B] mt-1 max-w-sm">
          Binary trees, arrays, stacks, queues, graphs, and linked nodes are recognized and visualized automatically during runtime execution.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {structures.map((struct, sIdx) => {
        const isChanged = changedVariables.includes(struct.data?.name);

        return (
          <div
            key={`${struct.category}_${sIdx}`}
            className="rounded-lg border border-[#22242D] bg-[#121318] p-4 shadow-sm transition-colors"
          >
            {/* Structure Card Header */}
            <div className="flex items-center justify-between pb-2.5 mb-3.5 border-b border-[#1E2028]">
              <div className="flex items-center space-x-2">
                <span className="p-1 rounded bg-[#06B6D4]/10 text-[#06B6D4]">
                  {struct.category === 'array' && <Database className="w-3.5 h-3.5" />}
                  {struct.category === 'stack' && <Layers className="w-3.5 h-3.5 text-[#FF9100]" />}
                  {struct.category === 'queue' && <ArrowRight className="w-3.5 h-3.5 text-[#10B981]" />}
                  {struct.category === 'recursion' && <CornerDownRight className="w-3.5 h-3.5" />}
                  {struct.category === 'linked_list' && <ArrowRight className="w-3.5 h-3.5" />}
                  {struct.category === 'tree' && <GitBranch className="w-3.5 h-3.5 text-[#06B6D4]" />}
                  {struct.category === 'graph' && <Share2 className="w-3.5 h-3.5 text-[#A855F7]" />}
                  {struct.category === 'object' && <Box className="w-3.5 h-3.5 text-[#3B82F6]" />}
                </span>
                <span className="text-xs font-semibold text-white tracking-wide font-mono">
                  {struct.label}
                </span>
                {isChanged && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#06B6D4]/15 text-[#06B6D4] font-mono font-bold animate-pulse">
                    Active
                  </span>
                )}
              </div>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-[#181920] text-[#A1A1AA] border border-[#282A36]">
                {struct.category}
              </span>
            </div>

            {/* 1. BINARY TREE VISUALIZER */}
            {struct.category === 'tree' && struct.data?.nodes && (
              <div className="flex flex-col space-y-2">
                <div className="relative w-full overflow-x-auto bg-[#0A0B0E] rounded-lg border border-[#1E2028] p-4 min-h-[220px]">
                  <svg className="w-full h-[220px]" viewBox="0 0 100 240" preserveAspectRatio="xMidYMid meet">
                    {/* Render Edge Links */}
                    {struct.data.links?.map((link: any, lIdx: number) => {
                      const fromNode = struct.data.nodes.find((n: any) => n.id === link.from);
                      const toNode = struct.data.nodes.find((n: any) => n.id === link.to);
                      if (!fromNode || !toNode) return null;

                      const midX = (fromNode.x + toNode.x) / 2;
                      const midY = (fromNode.y + toNode.y) / 2;

                      return (
                        <g key={`link_${lIdx}`}>
                          <line
                            x1={fromNode.x}
                            y1={fromNode.y}
                            x2={toNode.x}
                            y2={toNode.y}
                            stroke="#3B4252"
                            strokeWidth="1.2"
                            strokeDasharray="2 1"
                          />
                          <text
                            x={midX + (link.label === 'L' ? -3 : 3)}
                            y={midY}
                            fill="#71717A"
                            fontSize="5"
                            fontFamily="monospace"
                            textAnchor="middle"
                            dominantBaseline="central"
                          >
                            {link.label}
                          </text>
                        </g>
                      );
                    })}

                    {/* Render Tree Nodes */}
                    {struct.data.nodes.map((node: any) => {
                      const isSelected = selectedElementId === node.id;
                      return (
                        <g
                          key={node.id}
                          className="cursor-pointer transition-transform hover:scale-110"
                          onClick={() => {
                            if (onSelectElement) {
                              onSelectElement(
                                isSelected
                                  ? null
                                  : {
                                      category: 'Binary Tree Node',
                                      label: `Node (${node.value})`,
                                      value: node.value,
                                      path: node.path,
                                      details: {
                                        Depth: node.depth,
                                        Path: node.path,
                                        'Left Child': node.leftId ? 'Present' : 'None',
                                        'Right Child': node.rightId ? 'Present' : 'None',
                                      },
                                    }
                              );
                            }
                          }}
                        >
                          <circle
                            cx={node.x}
                            cy={node.y}
                            r="9"
                            fill={isSelected ? '#06B6D4' : '#181920'}
                            stroke={isSelected ? '#FFFFFF' : '#06B6D4'}
                            strokeWidth={isSelected ? '2' : '1.2'}
                            className="transition-colors"
                          />
                          <text
                            x={node.x}
                            y={node.y}
                            fill={isSelected ? '#000000' : '#FFFFFF'}
                            fontSize="6"
                            fontWeight="bold"
                            fontFamily="monospace"
                            textAnchor="middle"
                            dominantBaseline="central"
                          >
                            {String(node.value).slice(0, 4)}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
                <span className="text-[10px] text-[#71717A] font-mono text-center block">
                  Click any node to inspect tree relations and child subtrees.
                </span>
              </div>
            )}

            {/* 2. ARRAY / LIST VISUALIZER */}
            {struct.category === 'array' && struct.data?.elements && (
              <div className="overflow-x-auto pb-1.5">
                <div className="inline-flex space-x-2 items-end pt-1">
                  {struct.data.elements.map((elem: any, elemIdx: number) => {
                    const elemKey = `${struct.data.name}_${elemIdx}`;
                    const isSelected = selectedElementId === elemKey;

                    return (
                      <div
                        key={elemIdx}
                        onClick={() => {
                          if (onSelectElement) {
                            onSelectElement(
                              isSelected
                                ? null
                                : {
                                    category: 'Array Element',
                                    label: `${struct.data.name}[${elemIdx}]`,
                                    value: elem,
                                    details: {
                                      Index: elemIdx,
                                      Type: typeof elem,
                                      Array: struct.data.name,
                                      Length: struct.data.elements.length,
                                    },
                                  }
                            );
                          }
                        }}
                        className="flex flex-col items-center cursor-pointer group"
                      >
                        <div className="text-[10px] text-[#71717A] mb-1 font-mono font-medium group-hover:text-[#06B6D4]">
                          [{elemIdx}]
                        </div>
                        <div
                          className={`min-w-[44px] px-3 py-2 rounded-lg border text-center font-mono text-xs font-semibold transition-all ${
                            isSelected
                              ? 'bg-[#06B6D4] text-black border-white shadow-md scale-105'
                              : isChanged
                              ? 'bg-[#06B6D4]/15 border-[#06B6D4] text-[#06B6D4]'
                              : 'bg-[#181920] border-[#2B2D38] text-[#E4E4E7] group-hover:border-[#06B6D4]/50'
                          }`}
                        >
                          {typeof elem === 'object' && elem !== null ? JSON.stringify(elem) : String(elem)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. STACK VISUALIZER (LIFO) */}
            {struct.category === 'stack' && struct.data?.elements && (
              <div className="flex flex-col items-center py-2 space-y-1.5 max-w-xs mx-auto">
                <div className="flex items-center space-x-1.5 text-[11px] font-mono text-[#FF9100] font-semibold mb-1">
                  <ArrowRight className="w-3.5 h-3.5 rotate-90" />
                  <span>TOP OF STACK (LIFO)</span>
                </div>
                <div className="w-full border-x-2 border-b-2 border-[#FF9100]/40 rounded-b-lg p-2 bg-[#0A0B0E] space-y-1.5">
                  {struct.data.elements.slice().reverse().map((elem: any, rIdx: number) => {
                    const actualIdx = struct.data.elements.length - 1 - rIdx;
                    const isTop = rIdx === 0;
                    return (
                      <div
                        key={actualIdx}
                        className={`w-full py-1.5 px-3 rounded font-mono text-xs font-semibold flex items-center justify-between border ${
                          isTop
                            ? 'bg-[#FF9100]/20 border-[#FF9100] text-white'
                            : 'bg-[#15161C] border-[#262832] text-[#A1A1AA]'
                        }`}
                      >
                        <span className="text-[10px] text-[#71717A]">[{actualIdx}]</span>
                        <span>{typeof elem === 'object' ? JSON.stringify(elem) : String(elem)}</span>
                        {isTop && (
                          <span className="text-[9px] uppercase px-1 py-0.5 rounded bg-[#FF9100] text-black font-bold">
                            TOP
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. QUEUE VISUALIZER (FIFO) */}
            {struct.category === 'queue' && struct.data?.elements && (
              <div className="flex items-center justify-between space-x-2 py-2 overflow-x-auto">
                <div className="flex items-center space-x-1 text-[10px] font-mono text-[#10B981] font-bold flex-shrink-0">
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>DEQUEUE (FRONT)</span>
                </div>
                <div className="flex space-x-1.5 border-y-2 border-[#10B981]/40 py-2 px-3 bg-[#0A0B0E] rounded-md">
                  {struct.data.elements.map((elem: any, qIdx: number) => (
                    <div
                      key={qIdx}
                      className="px-3 py-1.5 rounded bg-[#181920] border border-[#2B2D38] font-mono text-xs text-[#E4E4E7] text-center"
                    >
                      <div className="text-[9px] text-[#71717A]">#{qIdx}</div>
                      <div>{typeof elem === 'object' ? JSON.stringify(elem) : String(elem)}</div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center space-x-1 text-[10px] font-mono text-[#06B6D4] font-bold flex-shrink-0">
                  <span>ENQUEUE (BACK)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            )}

            {/* 5. GRAPH VISUALIZER */}
            {struct.category === 'graph' && struct.data?.vertices && (
              <div className="relative w-full overflow-x-auto bg-[#0A0B0E] rounded-lg border border-[#1E2028] p-4 min-h-[200px]">
                <svg className="w-full h-[200px]" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                  {/* Position vertices in a circle */}
                  {(() => {
                    const verts = struct.data.vertices;
                    const count = verts.length;
                    const cx = 50;
                    const cy = 50;
                    const r = 36;

                    const vertCoords = verts.map((v: string, i: number) => {
                      const angle = (2 * Math.PI * i) / count - Math.PI / 2;
                      return {
                        id: v,
                        x: cx + r * Math.cos(angle),
                        y: cy + r * Math.sin(angle),
                      };
                    });

                    return (
                      <>
                        {/* Render Edges */}
                        {struct.data.edges?.map((edge: any, eIdx: number) => {
                          const u = vertCoords.find((vc: any) => vc.id === edge.from);
                          const v = vertCoords.find((vc: any) => vc.id === edge.to);
                          if (!u || !v) return null;
                          return (
                            <line
                              key={`edge_${eIdx}`}
                              x1={u.x}
                              y1={u.y}
                              x2={v.x}
                              y2={v.y}
                              stroke="#3F3F46"
                              strokeWidth="1.2"
                            />
                          );
                        })}

                        {/* Render Vertices */}
                        {vertCoords.map((v: any) => {
                          const isVisited = struct.data.visited?.includes(v.id);
                          return (
                            <g
                              key={v.id}
                              className="cursor-pointer transition-transform hover:scale-110"
                              onClick={() => {
                                if (onSelectElement) {
                                  onSelectElement({
                                    category: 'Graph Vertex',
                                    label: `Vertex ${v.id}`,
                                    value: v.id,
                                    details: {
                                      'Vertex ID': v.id,
                                      'Visited Status': isVisited ? 'Visited' : 'Unvisited',
                                      'Connected Edges': struct.data.edges?.filter((e: any) => e.from === v.id || e.to === v.id).length || 0,
                                    },
                                  });
                                }
                              }}
                            >
                              <circle
                                cx={v.x}
                                cy={v.y}
                                r="6.5"
                                fill={isVisited ? '#10B981' : '#181920'}
                                stroke={isVisited ? '#34D399' : '#A855F7'}
                                strokeWidth="1.5"
                              />
                              <text
                                x={v.x}
                                y={v.y}
                                fill="#FFFFFF"
                                fontSize="4.5"
                                fontWeight="bold"
                                fontFamily="monospace"
                                textAnchor="middle"
                                dominantBaseline="central"
                              >
                                {v.id.slice(0, 3)}
                              </text>
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              </div>
            )}

            {/* 6. GENERIC OBJECT / RECORD VISUALIZER */}
            {struct.category === 'object' && struct.data?.fields && (
              <div className="space-y-1.5 font-mono text-xs">
                {struct.data.fields.map(([fKey, fVal]: [string, any]) => {
                  const isObject = typeof fVal === 'object' && fVal !== null;
                  const isExp = Boolean(expandedObjects[`${struct.data.name}_${fKey}`]);

                  return (
                    <div
                      key={fKey}
                      className="rounded border border-[#22242D] bg-[#15161C] p-2 flex flex-col space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {isObject && (
                            <button
                              onClick={() => toggleObjectExpand(`${struct.data.name}_${fKey}`)}
                              className="p-0.5 text-[#71717A] hover:text-white"
                            >
                              {isExp ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          <span className="text-[#06B6D4] font-semibold">{fKey}:</span>
                        </div>
                        <span className="text-[#E4E4E7] font-semibold">
                          {!isObject ? String(fVal) : isExp ? '' : `Object (${Object.keys(fVal).length} keys)`}
                        </span>
                      </div>
                      {isObject && isExp && (
                        <div className="pl-4 pt-1 border-l border-[#282A36] space-y-1 text-[11px] text-[#A1A1AA]">
                          {Object.entries(fVal).map(([subK, subV]) => (
                            <div key={subK} className="flex justify-between">
                              <span className="text-[#71717A]">{subK}:</span>
                              <span>{String(subV)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 7. LINKED LIST VISUALIZER */}
            {struct.category === 'linked_list' && struct.data?.nodes && (
              <div className="overflow-x-auto pb-1.5">
                <div className="inline-flex items-center space-x-2 pt-1">
                  {struct.data.nodes.map((node: any, nIdx: number) => (
                    <React.Fragment key={nIdx}>
                      <div className="flex items-center rounded-lg border border-[#2B2D38] bg-[#181920] font-mono text-xs overflow-hidden shadow-sm">
                        <div className="px-3 py-1.5 bg-[#1F212B] font-bold text-[#06B6D4] border-r border-[#2B2D38]">
                          val: {String(node.value)}
                        </div>
                        <div className="px-2 py-1.5 text-[10px] text-[#71717A]">
                          next
                        </div>
                      </div>
                      {nIdx < struct.data.nodes.length - 1 ? (
                        <ArrowRight className="w-4 h-4 text-[#FF9100] flex-shrink-0" />
                      ) : (
                        <div className="flex items-center space-x-1 text-[10px] font-mono text-[#EF4444] font-bold px-2 py-1 bg-[#EF4444]/10 rounded border border-[#EF4444]/30">
                          <ArrowRight className="w-3.5 h-3.5" />
                          <span>NULL</span>
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            {/* 8. RECURSION CALL STACK VISUALIZER */}
            {struct.category === 'recursion' && struct.data?.frames && (
              <div className="space-y-1.5">
                {struct.data.frames.map((frame: any, fIdx: number) => (
                  <div
                    key={fIdx}
                    className="flex items-center space-x-2 px-3 py-1.5 rounded border border-[#2B2D38] bg-[#181920] text-xs font-mono"
                    style={{ marginLeft: `${fIdx * 12}px` }}
                  >
                    <CornerDownRight className="w-3.5 h-3.5 text-[#06B6D4]" />
                    <span className="font-semibold text-white">{frame.name}()</span>
                    <span className="text-[10px] text-[#71717A]">depth {fIdx + 1}</span>
                    <span className="text-[10px] text-[#52525B]">line {frame.line}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
