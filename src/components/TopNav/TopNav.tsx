import { useState, useRef, useEffect } from 'react';
import { Menu, Moon, Sun, Plus, User, LogOut, LayoutDashboard, Briefcase, Users, ChevronDown, Wrench, Sparkles, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFilterStore, useUiStore, useAuthStore } from '@/stores';
import { useScrollDirection } from '@/hooks';
import { POSITION_CATEGORY_LABELS } from '@/entities';
import type { PositionCategory, AppSection, RecordType } from '@/entities';
import { SUBCATEGORY_BY_CATEGORY } from '@/config';
import { NavDropdown } from './NavDropdown';
import { NavToggleGroup } from './NavToggleGroup';
import styles from './TopNav.module.css';

const categoryOptions = (Object.entries(POSITION_CATEGORY_LABELS) as [PositionCategory, string][]).map(
  ([value, label]) => ({ value, label })
);

export function TopNav() {
  const navigate = useNavigate();
  const scrollDir = useScrollDirection();
  const { theme, toggleTheme } = useUiStore();
  const currentUser = useAuthStore((s) => s.currentUser);
  const logout = useAuthStore((s) => s.logout);
  const isCandidateRole = currentUser?.role === 'candidate';

  const [addOpen, setAddOpen] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (addRef.current && !addRef.current.contains(e.target as Node)) setAddOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const {
    positionCategory,
    positionSubcategory,
    section,
    recordType,
    setPositionCategory,
    setPositionSubcategory,
    setSection,
    setRecordType,
  } = useFilterStore();

  const subcategoryOptions = positionCategory
    ? (SUBCATEGORY_BY_CATEGORY[positionCategory] ?? []).map((s) => ({ value: s, label: s }))
    : [];

  return (
    <nav className={`${styles.nav} ${scrollDir === 'down' ? styles.hidden : ''}`}>
      <button className={styles.iconBtn} onClick={() => navigate('/')} title="Меню">
        <Menu size={18} />
      </button>

      <NavDropdown
        label="Категория"
        options={categoryOptions}
        value={positionCategory}
        onChange={(v) => setPositionCategory(v as PositionCategory | null)}
      />

      {positionCategory && subcategoryOptions.length > 0 && (
        <NavDropdown
          label="Направление"
          options={subcategoryOptions}
          value={positionSubcategory}
          onChange={setPositionSubcategory}
        />
      )}

      <div className={styles.separator} />

      <NavToggleGroup
        options={[
          { value: 'list', label: 'Список' },
          { value: 'analytics', label: 'Аналитика' },
        ]}
        value={section}
        onChange={(v) => setSection(v as AppSection)}
      />

      {section === 'list' && !isCandidateRole && (
        <>
          <div className={styles.separator} />
          <NavToggleGroup
            options={[
              { value: 'vacancies', label: 'Вакансии' },
              { value: 'candidates', label: 'Кандидаты' },
            ]}
            value={recordType}
            onChange={(v) => setRecordType(v as RecordType)}
          />
        </>
      )}

      <div className={styles.spacer} />

      {!isCandidateRole && (
        <button
          className={styles.iconBtn}
          onClick={() => navigate('/recruiter')}
          title="Дашборд подбора"
        >
          <LayoutDashboard size={18} />
        </button>
      )}

      {!isCandidateRole && (
        <div className={styles.dropdownWrapper} ref={addRef}>
          <button
            className={`${styles.addBtn} ${addOpen ? styles.addBtnOpen : ''}`}
            onClick={() => setAddOpen((v) => !v)}
            title="Добавить"
          >
            <Plus size={14} />
            <span>Добавить</span>
            <ChevronDown size={11} />
          </button>
          {addOpen && (
            <div className={styles.dropdownMenu}>
              <button className={styles.dropdownItem} onClick={() => { navigate('/vacancies/new'); setAddOpen(false); }}>
                <Briefcase size={13} />
                Новая вакансия
              </button>
              <button className={styles.dropdownItem} onClick={() => { navigate('/positions/new'); setAddOpen(false); }}>
                <LayoutDashboard size={13} />
                Новая должность
              </button>
              <button className={styles.dropdownItem} onClick={() => { navigate('/candidates/new'); setAddOpen(false); }}>
                <Users size={13} />
                Новый кандидат
              </button>
              <button className={styles.dropdownItem} onClick={() => { navigate('/tools'); setAddOpen(false); }}>
                <Wrench size={13} />
                Редактор требований
              </button>
              <button className={styles.dropdownItem} onClick={() => { navigate('/admin/import'); setAddOpen(false); }}>
                <Sparkles size={13} />
                Импорт через LLM
              </button>
              <button className={styles.dropdownItem} onClick={() => { navigate('/admin/hh'); setAddOpen(false); }}>
                <Globe size={13} />
                Импорт с HH.ru
              </button>
            </div>
          )}
        </div>
      )}

      <button className={styles.iconBtn} onClick={toggleTheme} title="Тема">
        {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
      </button>

      {currentUser && (
        <>
          <div className={styles.separator} />
          <button
            className={styles.userBtn}
            onClick={() => navigate('/profile')}
            title="Личный кабинет"
          >
            <User size={14} />
            <span className={styles.userName}>{currentUser.firstName}</span>
          </button>
          <button
            className={styles.iconBtn}
            onClick={() => { logout(); navigate('/login'); }}
            title="Выйти"
          >
            <LogOut size={16} />
          </button>
        </>
      )}
    </nav>
  );
}
