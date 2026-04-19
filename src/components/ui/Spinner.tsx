import styles from './Spinner.module.css';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  center?: boolean;
}

export function Spinner({ size = 'md', center }: SpinnerProps) {
  const el = <div className={`${styles.spinner} ${styles[size]}`} />;
  if (center) return <div className={styles.center}>{el}</div>;
  return el;
}
