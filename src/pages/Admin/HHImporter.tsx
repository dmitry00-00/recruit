import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Download, Loader2, Save, Search, Globe, AlertCircle, CheckCircle2, X,
} from 'lucide-react';
import { Button } from '@/components/ui';
import { useVacancyStore } from '@/stores';
import {
  HH_CATEGORIES, HH_GROUP_LABELS, hhToNormalizedVacancy,
  type HHCategory, type HHGroupId, type NormalizedVacancy,
} from '@/utils';
import {
  searchVacanciesPaged, getVacancyDetail, sleep,
  type HHVacancyListItem, type HHVacancyDetail,
} from '@/services';
import type { Currency, Grade, WorkFormat, EmploymentType, VacancyStatus } from '@/entities';
import { VacancyPreviewCard } from './PreviewCards';
import styles from './HHImporter.module.css';

type ProgressMap = Record<string, { collected: number; total: number; status: 'idle' | 'running' | 'done' | 'error'; error?: string }>;

interface FetchedItem {
  /** Unique id = `<categoryId>:<hh-id>` so the same vacancy in two categories is not deduped accidentally. */
  key: string;
  hhId: string;
  category: HHCategory;
  raw: HHVacancyListItem | HHVacancyDetail;
  normalized: NormalizedVacancy;
}

const HH_AREAS: { id: number; label: string }[] = [
  { id: 113, label: 'Россия (вся)' },
  { id: 1,   label: 'Москва' },
  { id: 2,   label: 'Санкт-Петербург' },
  { id: 4,   label: 'Новосибирск' },
  { id: 88,  label: 'Казань' },
  { id: 66,  label: 'Нижний Новгород' },
  { id: 78,  label: 'Краснодар' },
  { id: 1438, label: 'Беларусь' },
  { id: 40,  label: 'Казахстан' },
];

const DATE_FROM_PRESETS: { value: number; label: string }[] = [
  { value: 1,  label: 'за сутки' },
  { value: 3,  label: 'за 3 дня' },
  { value: 7,  label: '7 дней' },
  { value: 14, label: '2 недели' },
  { value: 30, label: 'месяц' },
  { value: 0,  label: 'без ограничения' },
];

function isoDateDaysAgo(days: number): string | undefined {
  if (!days) return undefined;
  const d = new Date(Date.now() - days * 86400000);
  return d.toISOString().slice(0, 10);
}

export function HHImporter() {
  const navigate = useNavigate();
  const addVacancy = useVacancyStore((s) => s.add);

  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [perCategory, setPerCategory] = useState(20);
  const [areaId, setAreaId] = useState<number>(113);
  const [daysAgo, setDaysAgo] = useState<number>(7);
  const [searchOnlyTitle, setSearchOnlyTitle] = useState(true);
  const [fetchDetails, setFetchDetails] = useState(true);

  const [running, setRunning] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [progress, setProgress] = useState<ProgressMap>({});
  const [items, setItems] = useState<FetchedItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [savedCount, setSavedCount] = useState(0);

  const grouped = useMemo(() => {
    const g: Record<HHGroupId, HHCategory[]> = { developer: [], analyst: [], qa: [] };
    for (const c of HH_CATEGORIES) g[c.groupId].push(c);
    return g;
  }, []);

  const totalSelected = selectedCats.size;
  const expectedTotal = totalSelected * perCategory;

  // ── Selection ──────────────────────────────────────────────────────────────

  const toggleCat = (id: string) =>
    setSelectedCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleGroup = (groupId: HHGroupId) => {
    const groupIds = grouped[groupId].map((c) => c.id);
    const allOn = groupIds.every((id) => selectedCats.has(id));
    setSelectedCats((prev) => {
      const next = new Set(prev);
      if (allOn) groupIds.forEach((id) => next.delete(id));
      else groupIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const selectAll = () => setSelectedCats(new Set(HH_CATEGORIES.map((c) => c.id)));
  const clearAll = () => setSelectedCats(new Set());

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const handleFetch = async () => {
    setGlobalError('');
    setItems([]);
    setSelected(new Set());

    const cats = HH_CATEGORIES.filter((c) => selectedCats.has(c.id));
    if (!cats.length) return;

    setRunning(true);

    const initialProgress: ProgressMap = {};
    cats.forEach((c) => { initialProgress[c.id] = { collected: 0, total: perCategory, status: 'running' }; });
    setProgress(initialProgress);

    const dateFrom = isoDateDaysAgo(daysAgo);
    const collected: FetchedItem[] = [];

    for (const cat of cats) {
      try {
        const list = await searchVacanciesPaged(
          {
            text: cat.text,
            professionalRoles: cat.professionalRoles,
            area: areaId === 113 ? undefined : areaId,
            dateFrom,
            searchField: searchOnlyTitle ? 'name' : undefined,
            perPage: 50,
          },
          perCategory,
          (n) => setProgress((p) => ({ ...p, [cat.id]: { ...p[cat.id], collected: n } })),
        );

        let detailed: (HHVacancyListItem | HHVacancyDetail)[] = list;
        if (fetchDetails) {
          detailed = [];
          for (let i = 0; i < list.length; i++) {
            try {
              const d = await getVacancyDetail(list[i].id);
              detailed.push(d);
            } catch {
              detailed.push(list[i]);   // fall back to list-item
            }
            setProgress((p) => ({ ...p, [cat.id]: { ...p[cat.id], collected: i + 1 } }));
            if (i < list.length - 1) await sleep(250);
          }
        }

        for (const raw of detailed) {
          const normalized = hhToNormalizedVacancy(raw, { positionId: cat.positionId });
          collected.push({
            key: `${cat.id}:${raw.id}`,
            hhId: raw.id,
            category: cat,
            raw,
            normalized,
          });
        }

        setProgress((p) => ({ ...p, [cat.id]: { ...p[cat.id], status: 'done', collected: detailed.length } }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Ошибка запроса';
        setProgress((p) => ({ ...p, [cat.id]: { ...p[cat.id], status: 'error', error: msg } }));
      }
    }

    // Dedupe across categories by hhId — first occurrence wins.
    const seen = new Set<string>();
    const unique = collected.filter((it) => {
      if (seen.has(it.hhId)) return false;
      seen.add(it.hhId);
      return true;
    });

    setItems(unique);
    setSelected(new Set(unique.map((u) => u.key)));
    setRunning(false);
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const updateNormalized = (key: string, next: NormalizedVacancy) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, normalized: next } : it)));

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((it) => it.key !== key));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const toggleOne = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((it) => it.key)));
  };

  const handleSave = async () => {
    setGlobalError('');
    let saved = 0;
    try {
      for (const it of items.filter((x) => selected.has(x.key))) {
        const v = it.normalized;
        await addVacancy({
          positionId: v.positionId || it.category.positionId,
          companyName: v.companyName ?? 'Без названия',
          companyLogoUrl: v.companyLogoUrl,
          grade: (v.grade ?? 'middle') as Grade,
          salaryFrom: v.salaryFrom,
          salaryTo: v.salaryTo,
          currency: (v.currency ?? 'RUB') as Currency,
          publishedAt: v.publishedAt ? new Date(v.publishedAt) : new Date(),
          status: (v.status ?? 'open') as VacancyStatus,
          sourceUrl: v.sourceUrl,
          minRequirements: v.minRequirements.map((r) => ({ toolId: r.toolId, minYears: r.minYears })),
          maxRequirements: v.maxRequirements.map((r) => ({ toolId: r.toolId, minYears: r.minYears })),
          location: v.location,
          workFormat: (v.workFormat ?? 'remote') as WorkFormat,
          employmentType: (v.employmentType ?? 'full') as EmploymentType,
          notes: v.notes,
        });
        saved++;
      }
      setSavedCount(saved);
      setItems((prev) => prev.filter((it) => !selected.has(it.key)));
      setSelected(new Set());
      setTimeout(() => setSavedCount(0), 4000);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Ошибка сохранения');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          <Globe size={20} /> Импорт вакансий с HH.ru
        </h1>
        <p className={styles.subtitle}>
          Парсинг через открытое API hh.ru. Без ключа, ~5 запросов/сек. Структурированные
          данные, никакого LLM. Только IT-специальности.
        </p>
      </div>

      {/* Filters */}
      <div className={styles.filterBlock}>
        <div className={styles.filtersRow}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Регион</span>
            <select
              className={styles.input}
              value={areaId}
              onChange={(e) => setAreaId(Number(e.target.value))}
              disabled={running}
            >
              {HH_AREAS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Период</span>
            <select
              className={styles.input}
              value={daysAgo}
              onChange={(e) => setDaysAgo(Number(e.target.value))}
              disabled={running}
            >
              {DATE_FROM_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>На категорию</span>
            <input
              type="number"
              className={styles.input}
              min={1}
              max={200}
              value={perCategory}
              onChange={(e) => setPerCategory(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
              disabled={running}
            />
          </label>

          <label className={styles.checkField}>
            <input type="checkbox" checked={searchOnlyTitle} onChange={(e) => setSearchOnlyTitle(e.target.checked)} disabled={running} />
            <span>искать только по названию</span>
          </label>

          <label className={styles.checkField}>
            <input type="checkbox" checked={fetchDetails} onChange={(e) => setFetchDetails(e.target.checked)} disabled={running} />
            <span>детальная загрузка (медленнее, точнее)</span>
          </label>
        </div>
      </div>

      {/* Categories */}
      <div className={styles.categoriesBlock}>
        <div className={styles.categoriesHeader}>
          <span>Категории</span>
          <div className={styles.categoriesActions}>
            <button className={styles.linkBtn} onClick={selectAll} type="button" disabled={running}>выбрать все</button>
            <button className={styles.linkBtn} onClick={clearAll} type="button" disabled={running}>очистить</button>
          </div>
        </div>

        {(Object.keys(grouped) as HHGroupId[]).map((gid) => {
          const groupIds = grouped[gid].map((c) => c.id);
          const allOn = groupIds.every((id) => selectedCats.has(id));
          const someOn = groupIds.some((id) => selectedCats.has(id));
          return (
            <div key={gid} className={styles.group}>
              <button
                className={`${styles.groupTitle} ${someOn ? styles.groupTitleActive : ''}`}
                onClick={() => toggleGroup(gid)}
                type="button"
                disabled={running}
              >
                <span className={styles.groupCheck}>{allOn ? '☑' : someOn ? '⊟' : '☐'}</span>
                {HH_GROUP_LABELS[gid]}
                <span className={styles.groupCount}>
                  {groupIds.filter((id) => selectedCats.has(id)).length}/{groupIds.length}
                </span>
              </button>
              <div className={styles.chips}>
                {grouped[gid].map((cat) => {
                  const p = progress[cat.id];
                  const on = selectedCats.has(cat.id);
                  return (
                    <button
                      key={cat.id}
                      className={`${styles.chip} ${on ? styles.chipActive : ''}`}
                      onClick={() => toggleCat(cat.id)}
                      type="button"
                      disabled={running}
                      title={cat.text}
                    >
                      <span>{cat.label}</span>
                      {p && (
                        <span className={`${styles.chipProgress} ${styles[`progress_${p.status}`]}`}>
                          {p.status === 'running' && <Loader2 size={10} className={styles.spin} />}
                          {p.status === 'done'    && <CheckCircle2 size={10} />}
                          {p.status === 'error'   && <AlertCircle size={10} />}
                          {p.collected}/{p.total}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Run button */}
      <div className={styles.runBar}>
        <span className={styles.runMeta}>
          Выбрано категорий: <strong>{totalSelected}</strong>
          {totalSelected > 0 && <> · ожидается до <strong>{expectedTotal}</strong> вакансий</>}
        </span>
        <Button onClick={handleFetch} disabled={running || totalSelected === 0}>
          {running
            ? <><Loader2 size={14} className={styles.spin} /> Загрузка…</>
            : <><Download size={14} /> Запустить парсинг</>}
        </Button>
      </div>

      {globalError && <div className={styles.error}><AlertCircle size={14} /> {globalError}</div>}
      {savedCount > 0 && (
        <div className={styles.success}>
          <CheckCircle2 size={14} /> Сохранено вакансий: {savedCount}
        </div>
      )}

      {/* Results */}
      {items.length > 0 && (
        <div className={styles.results}>
          <div className={styles.resultsBar}>
            <button className={styles.linkBtn} onClick={toggleAll} type="button">
              {selected.size === items.length ? 'Снять выделение' : 'Выбрать все'}
            </button>
            <span className={styles.resultsMeta}>
              Выбрано: <strong>{selected.size}</strong> / {items.length}
            </span>
            <div className={styles.spacer} />
            <Button variant="secondary" size="sm" onClick={() => navigate('/')}>На главную</Button>
            <Button onClick={handleSave} disabled={selected.size === 0}>
              <Save size={14} /> Сохранить ({selected.size})
            </Button>
          </div>
          <div className={styles.cards}>
            {items.map((it) => (
              <div key={it.key} className={styles.cardWrap}>
                <div className={styles.categoryTag}>
                  <Search size={11} /> {it.category.label}
                  {it.normalized.sourceUrl && (
                    <a href={it.normalized.sourceUrl} target="_blank" rel="noreferrer" className={styles.sourceLink}>hh.ru ↗</a>
                  )}
                  <button className={styles.iconBtnSm} onClick={() => removeItem(it.key)} type="button" title="Удалить">
                    <X size={11} />
                  </button>
                </div>
                <VacancyPreviewCard
                  vacancy={it.normalized}
                  onChange={(next) => updateNormalized(it.key, next)}
                  onRemove={() => removeItem(it.key)}
                  selected={selected.has(it.key)}
                  onToggleSelect={() => toggleOne(it.key)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
