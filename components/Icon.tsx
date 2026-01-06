import React from 'react';

interface IconProps {
  name: string;
  className?: string;
  size?: number;
  fill?: boolean;
}

export const Icon: React.FC<IconProps> = ({ name, className = "", size, fill = false }) => {
  const style = {
    fontSize: size ? `${size}px` : undefined,
    fontVariationSettings: fill ? "'FILL' 1" : "'FILL' 0"
  };
  
  return (
    <span 
      className={`material-symbols-outlined ${className}`} 
      style={style}
    >
      {name}
    </span>
  );
};