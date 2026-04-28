import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw } from 'lucide-react';
import { TreePicker } from '@/components/TreePicker';
import { Button } from '@/components/ui';
import { useToolTreeStore } from '@/stores';
import styles from '../Vacancies/VacancyForm.module.css';

export function ToolsEditor() {
  const navigate = useNavigate();
  const tree = useToolTreeStore((s) => s.tree);
  const reset = useToolTreeStore((s) => s.reset);

  const stats = useMemo(() => {
    let subs = 0;
    let tools = 0;
    for (const c of tree) {
      subs += c.subcategories.length;
      for (const s of c.subcategories) tools += s.tools.length;
    }
    return { categories: tree.length, subs, tools };
  }, [tree]);

  return (
    <div className={styles.page} style={{ maxWidth: 1280 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h1 className={styles.title} style={{ margin: 0 }}>Редактор реестра требований</h1>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          {stats.categories} категорий · {stats.subs} подкатегорий · {stats.tools} инструментов
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (confirm('Сбросить реестр к заводским значениям? Все пользовательские правки будут потеряны.')) {
                reset();
              }
            }}
          >
            <RotateCcw size={13} /> Сбросить
          </Button>
          <Button variant="secondary" size="sm" onClick={() => navigate(-1)}>Назад</Button>
        </div>
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 12px' }}>
        Редактируйте дерево требований: добавляйте и удаляйте инструменты внутри подкатегорий,
        добавляйте новые подкатегории в каждый домен (Dev / Design / Analysis / QA / InfoSec / DevOps / Разное).
        Изменения сохраняются локально в браузере.
      </p>

      <div style={{ height: 'calc(100vh - 200px)', minHeight: 500 }}>
        <TreePicker
          mode="edit"
          fullHeight
          onSubcategoryStats={(subId) => navigate(`/tools/sub/${subId}`)}
          onToolStats={(toolId) => navigate(`/tools/tool/${toolId}`)}
        />
      </div>
    </div>
  );
}
