import { type CSSProperties, type ReactNode } from 'react';
import styles from './Badge.module.css';

interface BadgeProps {
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  bg?: string;
  color?: string;
  border?: string;
  className?: string;
  style?: CSSProperties;
}

export function Badge({
  children,
  size = 'md',
  bg,
  color,
  border,
  className,
  style,
}: BadgeProps) {
  const cls = [styles.badge, styles[size], className].filter(Boolean).join(' ');
  const dynamicStyle: CSSProperties = {
    background: bg,
    color,
    border: border ? `1px solid ${border}` : undefined,
    ...style,
  };

  return (
    <span className={cls} style={dynamicStyle}>
      {children}
    </span>
  );
}
