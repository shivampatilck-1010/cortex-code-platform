import React, { useState, useEffect, useRef } from 'react';
import { Eye, Download, Link as LinkIcon, Trash2, ShieldAlert } from 'lucide-react';
import type { ClassroomResource } from '@/lib/classroom/models';

interface ActionNode {
  id: string;
  label: string;
  icon: React.ElementType;
  isDanger?: boolean;
  onClick: (e: React.MouseEvent) => void;
}

interface Props {
  resource: ClassroomResource;
  role: 'teacher' | 'student' | 'viewer' | 'admin';
  onDelete: (id: string) => void;
}

export function ResourceBranchingCard({ resource, role, onDelete }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Define available actions
  const actions: ActionNode[] = [
    {
      id: 'view',
      label: 'View',
      icon: Eye,
      onClick: (e) => { e.stopPropagation(); window.open(resource.url, '_blank'); setIsOpen(false); }
    },
    {
      id: 'download',
      label: 'Download',
      icon: Download,
      onClick: (e) => { e.stopPropagation(); window.open(resource.url, '_blank'); setIsOpen(false); }
    }
  ];

  // In the future, we can add logic to restrict 'download' based on resource confidentiality flags
  // But for now, students get view/download. Teachers also get Delete.
  if (role === 'teacher') {
    actions.push({
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      isDanger: true,
      onClick: (e) => { e.stopPropagation(); onDelete(resource.id); setIsOpen(false); }
    });
  }

  // Calculate dynamic vertical positions (Y offsets) based on number of actions
  // Center is at Y=200 in our SVG coordinate system
  const centerY = 200;
  const spread = Math.min(240, actions.length * 70); // Total vertical spread
  
  const getY = (index: number, total: number) => {
    if (total === 1) return centerY;
    const step = spread / (total - 1);
    const startY = centerY - (spread / 2);
    return startY + (index * step);
  };

  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

  return (
    <div className={`relative w-full ${isOpen ? 'z-30' : 'z-10'}`} ref={containerRef}>
      {/* Base Card */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`p-4 rounded-xl bg-[#0A0A0A] border transition-all duration-300 cursor-pointer relative z-20 ${isOpen ? 'border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.15)] scale-[0.98]' : 'border-[#525252] hover:border-[#525252]'}`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#0A0A0A] border border-[#333] text-white">
            {resource.type || 'FILE'}
          </span>
          <span className="text-[10px] text-[#FFFFFF]">{resource.unit}</span>
        </div>
        <h4 className="text-sm font-semibold text-white">{resource.name}</h4>
        <p className="text-xs text-[#FFFFFF] mt-1">{resource.description || 'Click to view action branches'}</p>
      </div>

      {/* Overlay for SVG branches and Action Nodes */}
      <div 
        className={`absolute top-1/2 left-full w-0 h-0 z-30 transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      >
        {/* SVG Connecting Lines */}
        <svg 
          className="absolute pointer-events-none" 
          style={{ top: '-200px', left: '-10px', width: '300px', height: '400px' }} 
          viewBox="0 0 300 400"
        >
          {actions.map((action, i) => {
            const y = getY(i, actions.length);
            // S-Curve path: starts at X=10, Y=200 -> ends at X=80, Y=y
            const pathD = `M 10,200 C 50,200 40,${y} 80,${y}`;
            const isHovered = hoveredPath === action.id;
            
            return (
              <g key={`path-${action.id}`}>
                {/* Base idle line */}
                <path 
                  d={pathD} 
                  fill="none" 
                  stroke={isHovered ? (action.isDanger ? '#F43F5E' : '#22D3EE') : '#525252'} 
                  strokeWidth={isHovered ? 2 : 1.5}
                  className="transition-all duration-300"
                  style={{ filter: isHovered ? `drop-shadow(0 0 4px ${action.isDanger ? 'rgba(244,63,94,0.8)' : 'rgba(34,211,238,0.8)'})` : 'none' }}
                />
                {/* Animated data flow */}
                <path 
                  d={pathD} 
                  fill="none" 
                  stroke={action.isDanger ? '#F43F5E' : '#22D3EE'} 
                  strokeWidth="2"
                  strokeDasharray="4 12"
                  className="opacity-40"
                  style={{ animation: 'branchFlow 15s linear infinite' }}
                />
              </g>
            );
          })}
        </svg>

        {/* Action Nodes */}
        {actions.map((action, i) => {
          const yOffset = getY(i, actions.length) - 200; // Offset relative to center (0)
          const isDanger = action.isDanger;
          
          return (
            <div
              key={action.id}
              onClick={action.onClick}
              onMouseEnter={() => setHoveredPath(action.id)}
              onMouseLeave={() => setHoveredPath(null)}
              className={`absolute left-[70px] cursor-pointer transition-all duration-300 ease-out flex items-center ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-75 -translate-x-4 pointer-events-none'}`}
              style={{
                top: `${yOffset - 16}px`, // Center the 32px tall button
                transitionDelay: `${isOpen ? i * 50 : 0}ms`,
                clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)',
                padding: '1px',
                backgroundColor: isDanger ? 'rgba(244, 63, 94, 0.4)' : '#525252'
              }}
            >
              {/* Internal hover overlay for css (handled via tailwind group) */}
              <div 
                className={`group flex items-center gap-2 px-4 py-2 bg-[#0A0A0A] text-[10px] font-bold uppercase tracking-wider text-white transition-colors hover:${isDanger ? 'bg-[#0A0A0A] text-[#FFFFFF]' : 'bg-[#0A0A0A] text-[#FFFFFF]'}`}
                style={{
                  clipPath: 'polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px)',
                  backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)',
                  backgroundSize: '15px 15px'
                }}
              >
                <action.icon className={`w-3.5 h-3.5 group-hover:${isDanger ? 'text-[#FFFFFF]' : 'text-[#FFFFFF]'}`} />
                <span>{action.label}</span>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Required keyframes for the SVG animation */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes branchFlow {
          to { stroke-dashoffset: -1000; }
        }
      `}} />
    </div>
  );
}
