import styles from './TopNav.module.css';

interface NavToggleOption {
  value: string;
  label: string;
}

interface NavToggleGroupProps {
  options: NavToggleOption[];
  value: string;
  onChange: (value: string) => void;
}

export function NavToggleGroup({ options, value, onChange }: NavToggleGroupProps) {
  return (
    <div className={styles.toggleGroup}>
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`${styles.toggleBtn} ${value === opt.value ? styles.toggleBtnActive : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
