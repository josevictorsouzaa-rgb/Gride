
import React, { useRef, useEffect } from 'react';
import { LayoutObject, WarehouseLayout } from '../types';
import { Icon } from './Icon';

interface LayoutViewerProps {
  layout: WarehouseLayout | null;
  highlightObjectId?: string; // ID of shelf to pulse
  onObjectClick?: (obj: LayoutObject) => void;
}

export const LayoutViewer: React.FC<LayoutViewerProps> = ({ layout, highlightObjectId, onObjectClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  if (!layout) {
      return (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <Icon name="map" size={48} className="mb-2 opacity-50" />
              <p>Nenhum layout disponível.</p>
          </div>
      );
  }

  // Calculate scaling to fit screen
  const scaleX = containerRef.current ? containerRef.current.clientWidth / layout.width : 1;
  // Use a responsive approach in CSS, but here we render SVG based on layout dims
  
  return (
    <div className="w-full overflow-auto bg-gray-100 dark:bg-black/40 rounded-xl border border-gray-200 dark:border-white/10 relative" ref={containerRef}>
      <div className="min-w-full p-4">
        <svg 
            viewBox={`0 0 ${layout.width} ${layout.height}`} 
            className="w-full h-auto drop-shadow-sm select-none"
            style={{ maxHeight: '60vh' }}
        >
            {/* Grid Background (Optional) */}
            <defs>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-gray-200 dark:text-gray-700/30" />
                </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            {layout.objects.map((obj) => {
                const isHighlighted = obj.id === highlightObjectId || obj.qrCode === highlightObjectId;
                
                let fill = '#cbd5e1'; // gray-300
                let stroke = '#94a3b8'; // gray-400

                switch(obj.type) {
                    case 'shelf': fill = '#bfdbfe'; stroke = '#3b82f6'; break; // blue
                    case 'door': fill = 'none'; stroke = '#22c55e'; break; // green
                    case 'desk': fill = '#fde047'; stroke = '#eab308'; break; // yellow
                    case 'wall': fill = '#475569'; stroke = '#1e293b'; break; // slate
                    case 'area': fill = 'rgba(236, 72, 153, 0.2)'; stroke = '#ec4899'; break; // pink
                }

                if (isHighlighted) {
                    fill = '#137fec';
                    stroke = '#ffffff';
                }

                return (
                    <g 
                      key={obj.id} 
                      onClick={() => onObjectClick && onObjectClick(obj)}
                      className="cursor-pointer transition-all duration-300"
                    >
                        <rect
                            x={obj.x}
                            y={obj.y}
                            width={obj.width}
                            height={obj.height}
                            fill={fill}
                            stroke={stroke}
                            strokeWidth="2"
                            rx="4"
                            className={isHighlighted ? "animate-pulse" : ""}
                        />
                        {/* Label */}
                        {obj.width > 30 && obj.height > 20 && (
                            <text
                                x={obj.x + obj.width / 2}
                                y={obj.y + obj.height / 2}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize="12"
                                fontWeight="bold"
                                fill={isHighlighted ? 'white' : '#1e293b'}
                                className="pointer-events-none"
                            >
                                {obj.label}
                            </text>
                        )}
                        {/* Highlight Marker */}
                        {isHighlighted && (
                            <circle 
                                cx={obj.x + obj.width / 2} 
                                cy={obj.y + obj.height / 2} 
                                r={Math.min(obj.width, obj.height) / 1.5}
                                fill="none"
                                stroke="#ef4444"
                                strokeWidth="3"
                            >
                                <animate attributeName="r" from={Math.min(obj.width, obj.height) / 2} to={Math.min(obj.width, obj.height)} dur="1.5s" repeatCount="indefinite" />
                                <animate attributeName="opacity" from="1" to="0" dur="1.5s" repeatCount="indefinite" />
                            </circle>
                        )}
                    </g>
                );
            })}
        </svg>
      </div>
    </div>
  );
};
