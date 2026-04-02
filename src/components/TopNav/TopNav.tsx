import { Menu, Moon, Sun, PlusCircle, User, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useFilterStore, useUiStore, useAuthStore } from '@/stores';
import { useScrollDirection } from '@/hooks';
import { POSITION_CATEGORY_LABELS } from '@/entities';
import type { PositionCategory, AppSection, RecordType, RequirementLevel } from '@/entities';
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

  const {
    positionCategory,
    positionSubcategory,
    section,
    recordType,
    requirementLevel,
    showDiff,
    setPositionCategory,
    setPositionSubcategory,
    setSection,
    setRecordType,
    setRequirementLevel,
    toggleShowDiff,
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

      {!isCandidateRole && (
        <>
          <div className={styles.separator} />

          <NavToggleGroup
            options={[
              { value: 'min', label: 'MIN' },
              { value: 'max', label: 'MAX' },
            ]}
            value={requirementLevel}
            onChange={(v) => setRequirementLevel(v as RequirementLevel)}
          />

          <button
            className={`${styles.iconBtn} ${showDiff ? styles.iconBtnActive : ''}`}
            onClick={toggleShowDiff}
            title="Показать расхождения"
          >
            ±
          </button>
        </>
      )}

      <div className={styles.spacer} />

      {!isCandidateRole && (
        <button
          className={styles.iconBtn}
          onClick={() => {
            const path = recordType === 'vacancies' ? '/vacancies/new' : '/candidates/new';
            navigate(path);
          }}
          title="Добавить"
        >
          <PlusCircle size={18} />
        </button>
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
