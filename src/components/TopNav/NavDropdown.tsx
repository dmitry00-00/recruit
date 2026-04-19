import { useState, useRef, useEffect, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './TopNav.module.css';

interface NavDropdownOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

interface NavDropdownProps {
  label: string;
  options: NavDropdownOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
}

export function NavDropdown({
  label,
  options,
  value,
  onChange,
  placeholder,
}: NavDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectedLabel = options.find((o) => o.value === value)?.label;

  return (
    <div className={styles.dropdownWrapper} ref={ref}>
      <button
        className={`${styles.dropdownTrigger} ${open ? styles.dropdownTriggerActive : ''}`}
        onClick={() => setOpen(!open)}
        title={label}
      >
        {selectedLabel ?? placeholder ?? label}
        <ChevronDown size={12} />
      </button>

      {open && (
        <div className={styles.dropdownMenu}>
          {value && (
            <button
              className={styles.dropdownItem}
              onClick={() => { onChange(null); setOpen(false); }}
            >
              Все
            </button>
          )}
          {options.map((opt) => (
            <button
              key={opt.value}
              className={`${styles.dropdownItem} ${value === opt.value ? styles.dropdownItemActive : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
