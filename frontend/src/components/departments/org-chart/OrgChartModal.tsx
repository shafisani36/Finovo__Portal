import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Download,
  Network,
  Layers,
} from 'lucide-react';
import { Department } from '../types';
import { OrgChartLayoutEngine } from './layoutEngine';
import { OrgChartNode } from './OrgChartNode';
import { LayoutEngineResult } from './types';

interface OrgChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  departments: Department[];
  onEditDepartment: (dept: Department) => void;
  onViewDetails: (dept: Department) => void;
}

export const OrgChartModal: React.FC<OrgChartModalProps> = ({
  isOpen,
  onClose,
  departments,
  onEditDepartment,
  onViewDetails,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan and Zoom State
  const [scale, setScale] = useState(0.85);
  const [translate, setTranslate] = useState({ x: 60, y: 60 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Interactive Tree State
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<number>>(new Set());
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);

  // Compute Layout via Algorithmic Engine
  const layoutResult: LayoutEngineResult = useMemo(() => {
    return OrgChartLayoutEngine.computeLayout(departments, collapsedNodeIds);
  }, [departments, collapsedNodeIds]);

  // Selected Department Object
  const selectedDepartment = useMemo(() => {
    if (!selectedDeptId) return null;
    return departments.find((d) => d.id === selectedDeptId) || null;
  }, [departments, selectedDeptId]);

  // Fit to screen helper
  const handleFitToScreen = useCallback(() => {
    if (!containerRef.current || layoutResult.nodes.length === 0) return;
    const { width: containerWidth, height: containerHeight } =
      containerRef.current.getBoundingClientRect();
    const { bounds } = layoutResult;

    const scaleX = (containerWidth - 100) / bounds.width;
    const scaleY = (containerHeight - 120) / bounds.height;
    const newScale = Math.max(0.35, Math.min(1.05, Math.min(scaleX, scaleY)));

    const centerX = (containerWidth - bounds.width * newScale) / 2 - bounds.minX * newScale;
    const centerY = Math.max(40, (containerHeight - bounds.height * newScale) / 2 - bounds.minY * newScale);

    setScale(newScale);
    setTranslate({ x: centerX, y: centerY });
  }, [layoutResult]);

  // Auto fit to screen when modal first opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        handleFitToScreen();
      }, 50);
    }
  }, [isOpen, handleFitToScreen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Pan dragging events
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - translate.x, y: e.clientY - translate.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setTranslate({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    setScale((prev) => Math.max(0.25, Math.min(2.2, prev * zoomFactor)));
  };

  // Toggle Collapse of a node
  const handleToggleCollapse = (deptId: number) => {
    setCollapsedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(deptId)) next.delete(deptId);
      else next.add(deptId);
      return next;
    });
  };

  // Expand / Collapse All
  const handleToggleExpandAll = () => {
    if (collapsedNodeIds.size > 0) {
      setCollapsedNodeIds(new Set());
    } else {
      const allParentIds = new Set<number>();
      for (const node of layoutResult.nodes) {
        if (node.children.length > 0) allParentIds.add(node.id);
      }
      setCollapsedNodeIds(allParentIds);
    }
  };

  // Export SVG of Diagram
  const handleExportSVG = () => {
    const svgEl = document.getElementById('org-chart-svg');
    if (!svgEl) return;

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgEl);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `organization-chart-${new Date().toISOString().split('T')[0]}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const totalHeadcount = departments.reduce(
    (acc, d) => acc + (d.employee_profiles_count || d.members_count || 0),
    0
  );

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex flex-col bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200 select-none">
      {/* Top Header HUD Bar (Theme-aligned: White, slate-200 borders, crisp text) */}
      <div className="h-16 px-4 sm:px-7 border-b border-slate-200/90 bg-white/95 backdrop-blur-md flex items-center justify-between text-slate-900 shrink-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FF5511] to-[#F95716] flex items-center justify-center font-bold text-white shadow-md shadow-orange-500/20">
            <Network className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold font-['Plus_Jakarta_Sans',sans-serif] tracking-tight text-slate-900">
                Organizational Hierarchy Diagram
              </h2>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-orange-50 text-[#F95716] text-[10px] font-bold border border-orange-200">
                LIVE ENGINE
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              Interactive 2D vector geometry with dynamic parent-child branch routing
            </p>
          </div>
        </div>

        {/* Global Stats Counter */}
        <div className="hidden lg:flex items-center gap-6 text-xs text-slate-700 bg-slate-100/70 px-4 py-1.5 rounded-2xl border border-slate-200/80 font-mono">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Divisions</span>
            <span className="text-slate-900 font-bold">{layoutResult.rootNodes.length} Roots</span>
          </div>
          <div className="w-px h-6 bg-slate-200" />
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Units</span>
            <span className="text-slate-900 font-bold">{departments.length} Units</span>
          </div>
          <div className="w-px h-6 bg-slate-200" />
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Workforce</span>
            <span className="text-[#F95716] font-bold">{totalHeadcount} Members</span>
          </div>
        </div>

        {/* Close Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
            title="Close Diagram (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Interactive Diagram Canvas Area (Clean Web Theme Background & Architectural Dot Grid) */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        className={`flex-1 relative overflow-hidden bg-[#F8FAFC] cursor-${
          isDragging ? 'grabbing' : 'grab'
        }`}
      >
        {/* Subtle Architectural Blueprint Dot Grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-60"
          style={{
            backgroundImage: `radial-gradient(circle, #CBD5E1 1.25px, transparent 1.25px)`,
            backgroundSize: `28px 28px`,
            transform: `translate(${translate.x % 28}px, ${translate.y % 28}px)`,
          }}
        />

        {/* Floating Canvas Controls HUD (Bottom Left: Clean White Glassmorphism) */}
        <div className="absolute bottom-6 left-6 z-20 flex items-center gap-1.5 bg-white/95 border border-slate-200/90 p-1.5 rounded-2xl backdrop-blur-md shadow-[0_12px_36px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.04)] text-slate-700">
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(2.2, s + 0.15))}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.25, s - 0.15))}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-slate-200" />
          <button
            type="button"
            onClick={handleFitToScreen}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Fit to Screen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setScale(1);
              setTranslate({ x: 80, y: 80 });
            }}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Reset Zoom (100%)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-slate-200" />
          <button
            type="button"
            onClick={handleToggleExpandAll}
            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1.5"
            title="Toggle Expand / Collapse All"
          >
            <Layers className="w-3.5 h-3.5 text-[#F95716]" />
            <span className="hidden sm:inline">
              {collapsedNodeIds.size > 0 ? 'Expand All' : 'Collapse All'}
            </span>
          </button>
          <div className="w-px h-5 bg-slate-200" />
          <button
            type="button"
            onClick={handleExportSVG}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Export Diagram (SVG)"
          >
            <Download className="w-4 h-4" />
          </button>
          <span className="text-[11px] font-mono text-slate-500 px-2 select-none">
            {Math.round(scale * 100)}%
          </span>
        </div>

        {/* Selected Department Quick Panel (Bottom Right: White Glassmorphism) */}
        {selectedDepartment && (
          <div className="absolute bottom-6 right-6 z-20 w-80 bg-white/95 border border-slate-200/90 p-4 rounded-3xl backdrop-blur-md shadow-[0_18px_44px_rgba(0,0,0,0.1),0_2px_8px_rgba(0,0,0,0.04)] text-slate-900 space-y-3 animate-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-mono text-[#F95716] font-bold uppercase tracking-wider block">
                  {selectedDepartment.code || 'ORGANIZATIONAL UNIT'}
                </span>
                <h4 className="font-bold text-sm text-slate-900 leading-tight">
                  {selectedDepartment.name}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDeptId(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="text-xs space-y-1.5 text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-400">Department Lead:</span>
                <span className="font-semibold text-slate-900">
                  {selectedDepartment.manager?.user.name || 'Unassigned'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Workforce Members:</span>
                <span className="font-semibold text-slate-900">
                  {selectedDepartment.employee_profiles_count ||
                    selectedDepartment.members_count ||
                    0}{' '}
                  staff
                </span>
              </div>
              {selectedDepartment.parent_department && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Reports Under:</span>
                  <span className="font-semibold text-[#F95716] truncate max-w-[150px]">
                    {selectedDepartment.parent_department.name}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onViewDetails(selectedDepartment);
                }}
                className="flex-1 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-colors cursor-pointer text-center"
              >
                Inspect
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditDepartment(selectedDepartment);
                }}
                className="flex-1 py-1.5 rounded-xl bg-gradient-to-r from-[#FF5511] to-[#F95716] hover:opacity-95 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer text-center"
              >
                Edit Unit
              </button>
            </div>
          </div>
        )}

        {/* Transformed Hierarchy Canvas */}
        <div
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
            width: `${layoutResult.bounds.width + 200}px`,
            height: `${layoutResult.bounds.height + 200}px`,
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        >
          {/* SVG Vector Connector Lines (Web Theme: Smooth Orange-Amber Gradients) */}
          <svg
            id="org-chart-svg"
            className="absolute inset-0 pointer-events-none"
            style={{
              width: '100%',
              height: '100%',
              overflow: 'visible',
            }}
          >
            <defs>
              <linearGradient id="orgConnectorGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#F95716" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#FB923C" stopOpacity="0.65" />
              </linearGradient>
            </defs>

            {layoutResult.connectors.map((conn) => {
              const isSourceSelected = selectedDeptId === conn.sourceId;
              const isTargetSelected = selectedDeptId === conn.targetId;
              const isHighlighted = isSourceSelected || isTargetSelected;

              return (
                <g key={conn.id}>
                  {/* Subtle Underlay Glow */}
                  <path
                    d={conn.pathData}
                    fill="none"
                    stroke={isHighlighted ? '#F95716' : '#EA580C'}
                    strokeWidth={isHighlighted ? 4 : 2}
                    strokeOpacity={isHighlighted ? 0.45 : 0.15}
                    strokeLinecap="round"
                  />
                  {/* Core Vector Path */}
                  <path
                    d={conn.pathData}
                    fill="none"
                    stroke={isHighlighted ? '#F95716' : 'url(#orgConnectorGradient)'}
                    strokeWidth={isHighlighted ? 2.5 : 1.75}
                    strokeLinecap="round"
                  />
                  {/* Port Junction Dots */}
                  <circle
                    cx={conn.startX}
                    cy={conn.startY}
                    r={3}
                    fill="#F95716"
                  />
                  <circle
                    cx={conn.endX}
                    cy={conn.endY}
                    r={3}
                    fill="#F95716"
                  />
                </g>
              );
            })}
          </svg>

          {/* Department Nodes */}
          {layoutResult.nodes.map((node) => (
            <OrgChartNode
              key={node.id}
              node={node}
              isSelected={selectedDeptId === node.id}
              onSelect={(dept) => setSelectedDeptId(dept.id)}
              onToggleCollapse={handleToggleCollapse}
              onEdit={(dept) => {
                onClose();
                onEditDepartment(dept);
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
