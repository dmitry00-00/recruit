import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Users, X, Check, GitCompare, TrendingUp, Minus } from 'lucide-react';
import { useVacancyStore, usePositionStore, useCandidateStore, usePipelineStore, useFilterStore } from '@/stores';
import { TreePicker, type VacancyToolState } from '@/components/TreePicker';
import { GradeBadge, Modal, Button } from '@/components/ui';
import {
  VACANCY_STATUS_LABELS,
  WORK_FORMAT_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  CURRENCY_SYMBOLS,
} from '@/config';
import { GRADE_ORDER, GRADE_LABELS } from '@/entities';
import {
  aggregateCandidate,
  computeMatchScore,
  computeVacancyOptimization,
  getToolById,
} from '@/utils';
import type { VacancyOptimization } from '@/utils';
import { db, getOrCreatePipeline } from '@/db';
import type {
  Grade,
  Currency,
  WorkFormat,
  EmploymentType,
  VacancyStatus,
  VacancyRequirement,
  Candidate,
  CandidateAggregation,
} from '@/entities';
import styles from './VacancyDetail.module.css';

interface MatchRow {
  candidateId: string;
  name: string;
  scoreMin: number;
  scoreMax: number;
  photoUrl?: string;
}

export function VacancyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { vacancies, load, update } = useVacancyStore();
  const { positions, load: loadPositions } = usePositionStore();
  const { candidates, load: loadCandidates, getWorkEntries } = useCandidateStore();
  const { addCard } = usePipelineStore();

  useEffect(() => { load(); loadPositions(); loadCandidates(); }, [load, loadPositions, loadCandidates]);

  const vacancy = vacancies.find((v) => v.id === id);

  // ── Local requirements state ─────────────────────────────
  const [minIds, setMinIds]           = useState<string[]>([]);
  const [maxIds, setMaxIds]           = useState<string[]>([]);
  const [minYearsMap, setMinYearsMap] = useState<Record<string, number>>({});
  const [maxYearsMap, setMaxYearsMap] = useState<Record<string, number>>({});

  // Sync local state from vacancy when it changes (React 19 prev-state pattern).
  const [prevVacancyId, setPrevVacancyId] = useState<string | undefined>(vacancy?.id);
  if (vacancy && prevVacancyId !== vacancy.id) {
    setPrevVacancyId(vacancy.id);
    setMinIds(vacancy.minRequirements.map((r) => r.toolId));
    setMaxIds(vacancy.maxRequirements.map((r) => r.toolId));
    const minY: Record<string, number> = {};
    for (const r of vacancy.minRequirements) if (r.minYears) minY[r.toolId] = r.minYears;
    setMinYearsMap(minY);
    const maxY: Record<string, number> = {};
    for (const r of vacancy.maxRequirements) if (r.minYears) maxY[r.toolId] = r.minYears;
    setMaxYearsMap(maxY);
  }

  // ── Info modal state ─────────────────────────────────────
  const [infoOpen, setInfoOpen]             = useState(false);
  const [companyName,    setCompanyName]    = useState('');
  const [companyLogoUrl, setCompanyLogoUrl] = useState('');
  const [grade,          setGrade]          = useState<Grade>('middle');
  const [salaryFrom,     setSalaryFrom]     = useState('');
  const [salaryTo,       setSalaryTo]       = useState('');
  const [currency,       setCurrency]       = useState<Currency>('RUB');
  const [workFormat,     setWorkFormat]     = useState<WorkFormat>('remote');
  const [employmentType, setEmploymentType] = useState<EmploymentType>('full');
  const [vacancyStatus,  setVacancyStatus]  = useState<VacancyStatus>('open');
  const [location,       setLocation]       = useState('');
  const [sourceUrl,      setSourceUrl]      = useState('');
  const [notes,          setNotes]          = useState('');

  const openInfoModal = () => {
    if (!vacancy) return;
    setCompanyName(vacancy.companyName);
    setCompanyLogoUrl(vacancy.companyLogoUrl ?? '');
    setGrade(vacancy.grade);
    setSalaryFrom(vacancy.salaryFrom ? String(vacancy.salaryFrom) : '');
    setSalaryTo(vacancy.salaryTo ? String(vacancy.salaryTo) : '');
    setCurrency(vacancy.currency);
    setWorkFormat(vacancy.workFormat);
    setEmploymentType(vacancy.employmentType);
    setVacancyStatus(vacancy.status);
    setLocation(vacancy.location ?? '');
    setSourceUrl(vacancy.sourceUrl ?? '');
    setNotes(vacancy.notes ?? '');
    setInfoOpen(true);
  };

  const saveInfo = async () => {
    if (!vacancy) return;
    await update(vacancy.id, {
      companyName,
      companyLogoUrl: companyLogoUrl || undefined,
      grade,
      salaryFrom: salaryFrom ? parseInt(salaryFrom) : undefined,
      salaryTo: salaryTo ? parseInt(salaryTo) : undefined,
      currency,
      workFormat,
      employmentType,
      status: vacancyStatus,
      location: location || undefined,
      sourceUrl: sourceUrl || undefined,
      notes: notes || undefined,
    });
    setInfoOpen(false);
  };

  // ── TreePicker handlers (auto-save) ──────────────────────
  const saveRequirements = (
    nextMinIds: string[],
    nextMaxIds: string[],
    nextMinYears: Record<string, number>,
    nextMaxYears: Record<string, number>,
  ) => {
    if (!vacancy) return;
    const minReqs: VacancyRequirement[] = nextMinIds.map((toolId) => ({
      toolId,
      minYears: nextMinYears[toolId] || undefined,
    }));
    const maxReqs: VacancyRequirement[] = nextMaxIds.map((toolId) => ({
      toolId,
      minYears: nextMaxYears[toolId] || undefined,
      isLocked: nextMinIds.includes(toolId),
    }));
    update(vacancy.id, { minRequirements: minReqs, maxRequirements: maxReqs });
  };

  const handleVacancyClick = (toolId: string, state: VacancyToolState) => {
    let nextMin = [...minIds];
    let nextMax = [...maxIds];

    if (state === 'none') {
      nextMin = [...nextMin, toolId];
      if (!nextMax.includes(toolId)) nextMax = [...nextMax, toolId];
    } else if (state === 'min') {
      nextMin = nextMin.filter((id) => id !== toolId);
    } else {
      nextMin = nextMin.filter((id) => id !== toolId);
      nextMax = nextMax.filter((id) => id !== toolId);
    }

    setMinIds(nextMin);
    setMaxIds(nextMax);
    saveRequirements(nextMin, nextMax, minYearsMap, maxYearsMap);
  };

  const handleVacancyYears = (toolId: string, level: 'min' | 'max', years: number) => {
    if (level === 'min') {
      const next = { ...minYearsMap, [toolId]: years };
      setMinYearsMap(next);
      saveRequirements(minIds, maxIds, next, maxYearsMap);
    } else {
      const next = { ...maxYearsMap, [toolId]: years };
      setMaxYearsMap(next);
      saveRequirements(minIds, maxIds, minYearsMap, next);
    }
  };

  // ── Filtered subcategories from position ─────────────────
  const filteredSubIds = useMemo(() => {
    if (!vacancy) return [];
    const position = positions.find((p) => p.id === vacancy.positionId);
    if (!position?.requiredCategories?.length) return [];
    return position.requiredCategories.flatMap((rc) => rc.subcategoryIds);
  }, [vacancy, positions]);

  // ── Auto-matching ─────────────────────────────────────────
  const [matchOpen,   setMatchOpen]   = useState(false);
  const [matchRows,   setMatchRows]   = useState<MatchRow[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [addedSet,    setAddedSet]    = useState<Set<string>>(new Set());

  const computeMatches = useCallback(async () => {
    if (!vacancy) return;
    setMatchLoading(true);
    const rows: MatchRow[] = [];
    for (const c of candidates) {
      const entries = await getWorkEntries(c.id);
      const agg = aggregateCandidate(c, entries);
      const match = computeMatchScore(vacancy, agg);
      if (match.scoreMin > 0) {
        rows.push({
          candidateId: c.id,
          name: `${c.lastName} ${c.firstName}`,
          scoreMin: match.scoreMin,
          scoreMax: match.scoreMax,
          photoUrl: (c as Candidate & { photoUrl?: string }).photoUrl,
        });
      }
    }
    rows.sort((a, b) => b.scoreMin - a.scoreMin);
    setMatchRows(rows);
    setMatchLoading(false);
  }, [vacancy, candidates, getWorkEntries]);

  const toggleMatch = () => {
    setMatchOpen((v) => {
      const next = !v;
      if (next) void computeMatches();
      return next;
    });
  };

  const addToPipeline = async (candidateId: string, scoreMin: number) => {
    if (!vacancy) return;
    const pipeline = await getOrCreatePipeline(vacancy.id);
    const pipelineStages = await db.pipelineStages
      .where('pipelineId').equals(pipeline.id).sortBy('order');
    if (pipelineStages.length > 0) {
      await addCard({
        pipelineId: pipeline.id,
        stageId: pipelineStages[0].id,
        candidateId,
        matchScore: scoreMin,
      });
      setAddedSet((s) => new Set([...s, candidateId]));
    }
  };

  // ── Score color helper ────────────────────────────────────
  const scoreColor = (s: number) =>
    s >= 80 ? '#22c55e' : s >= 50 ? '#f0a030' : '#ef4444';

  // ── Analytics: vacancy optimization ───────────────────────
  const { section } = useFilterStore();
  const [vacancyOpt, setVacancyOpt] = useState<VacancyOptimization | null>(null);

  const analyticsActive = section === 'analytics' && !!vacancy && candidates.length > 0;

  // Drop stale result during render when prerequisites change (React 19 prev-state pattern).
  const [prevAnalyticsKey, setPrevAnalyticsKey] = useState<string | null>(null);
  const analyticsKey = analyticsActive ? `${vacancy?.id}:${candidates.length}` : null;
  if (prevAnalyticsKey !== analyticsKey) {
    setPrevAnalyticsKey(analyticsKey);
    if (!analyticsActive) setVacancyOpt(null);
  }

  useEffect(() => {
    if (!analyticsActive || !vacancy) return;
    let cancelled = false;
    (async () => {
      const aggs: CandidateAggregation[] = [];
      for (const c of candidates) {
        const entries = await getWorkEntries(c.id);
        aggs.push(aggregateCandidate(c, entries));
      }
      if (cancelled) return;
      const opt = computeVacancyOptimization(vacancy, aggs);
      if (!cancelled) setVacancyOpt(opt);
    })();
    return () => { cancelled = true; };
  }, [analyticsActive, vacancy, candidates, getWorkEntries]);

  if (!vacancy) return <div style={{ padding: 24 }}>Вакансия не найдена</div>;

  const symbol = CURRENCY_SYMBOLS[vacancy.currency] ?? '₽';
  const initials = vacancy.companyName.slice(0, 2).toUpperCase();

  return (
    <div className={styles.page}>
      {/* ── Header ─────────────────────────────────────── */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> Назад
        </button>

        <div className={styles.headerSep} />

        <button className={styles.companyBtn} onClick={openInfoModal} title="Редактировать информацию">
          {vacancy.companyLogoUrl ? (
            <img src={vacancy.companyLogoUrl} alt="" className={styles.companyLogo} />
          ) : (
            <span className={styles.companyLogoPlaceholder}>{initials}</span>
          )}
          {vacancy.companyName}
        </button>

        <GradeBadge grade={vacancy.grade} />

        <span className={styles.statusBadge}>
          {VACANCY_STATUS_LABELS[vacancy.status]}
        </span>

        {vacancy.sourceUrl && (
          <a
            href={vacancy.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className={styles.sourceLink}
            title="Источник"
          >
            <ExternalLink size={14} />
          </a>
        )}

        <div className={styles.headerSpacer} />

        <Button
          size="sm"
          variant={matchOpen ? 'primary' : 'secondary'}
          onClick={toggleMatch}
        >
          <Users size={13} /> Подобрать
        </Button>

        <Button size="sm" variant="secondary" onClick={() => navigate(`/pipeline/${vacancy.id}`)}>
          Воронка
        </Button>

        <Button size="sm" variant="secondary" onClick={() => navigate(`/vacancies/${vacancy.id}/history`)}>
          Хроника
        </Button>
      </div>

      {/* ── Body ──────────────────────────────────────── */}
      {section === 'analytics' ? (
        /* ── Analytics: vacancy optimization ── */
        <div className={styles.analyticsBody}>
          <div className={styles.analyticsContent}>
            <h2 className={styles.analyticsTitle}>Оптимизация вакансии</h2>
            <p className={styles.analyticsDesc}>
              Анализ влияния ослабления требований и повышения оклада на пул кандидатов
            </p>

            {!vacancyOpt ? (
              <div className={styles.analyticsEmpty}>Загрузка аналитики...</div>
            ) : (
              <>
                {/* Stats */}
                <div className={styles.optStats}>
                  <div className={styles.optStat}>
                    <span className={styles.optStatValue}>{vacancyOpt.totalCandidates}</span>
                    <span className={styles.optStatLabel}>Всего кандидатов</span>
                  </div>
                  <div className={styles.optStat}>
                    <span className={styles.optStatValue}>{vacancyOpt.currentMatchCount}</span>
                    <span className={styles.optStatLabel}>Подходящих ({'\u2265'}{vacancyOpt.threshold}%)</span>
                  </div>
                  <div className={styles.optStat}>
                    <span className={styles.optStatValue}>
                      {vacancyOpt.totalCandidates > 0
                        ? Math.round((vacancyOpt.currentMatchCount / vacancyOpt.totalCandidates) * 100)
                        : 0}%
                    </span>
                    <span className={styles.optStatLabel}>Конверсия</span>
                  </div>
                </div>

                {/* Requirement impact */}
                {vacancyOpt.requirementImpacts.length > 0 && (
                  <div className={styles.recCard}>
                    <h3 className={styles.recSectionTitle}>Влияние ослабления требований</h3>
                    <p className={styles.optHint}>
                      Убрав каждое из следующих требований, можно расширить пул кандидатов:
                    </p>
                    <div className={styles.recSkillsList}>
                      {vacancyOpt.requirementImpacts.map((impact) => {
                        const tool = getToolById(impact.toolId);
                        return (
                          <div key={impact.toolId} className={styles.recSkillRow}>
                            <div className={styles.recSkillIcon}>
                              {tool?.logoUrl ? (
                                <img src={tool.logoUrl} alt="" className={styles.recSkillLogo} />
                              ) : (
                                <div className={styles.recSkillDot} />
                              )}
                            </div>
                            <div className={styles.recSkillInfo}>
                              <span className={styles.recSkillName}>{tool?.name ?? impact.toolId}</span>
                              <span className={styles.recSkillMeta}>
                                Сейчас: {impact.currentMatches} → После: {impact.afterMatches}
                              </span>
                            </div>
                            <span className={styles.optDeltaBadge}>
                              +{impact.delta} кандидат{impact.delta === 1 ? '' : impact.delta < 5 ? 'а' : 'ов'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {vacancyOpt.requirementImpacts.length === 0 && (
                  <div className={styles.analyticsEmpty}>
                    <Minus size={16} />
                    <span>Ослабление отдельных требований не увеличит пул кандидатов</span>
                  </div>
                )}

                {/* Grade relaxation */}
                {vacancyOpt.gradeImpact && (
                  <div className={styles.recCard}>
                    <h3 className={styles.recSectionTitle}>Снижение грейда</h3>
                    <div className={styles.gradeRelaxation}>
                      <span>
                        Снизив грейд с <strong>{GRADE_LABELS[vacancyOpt.gradeImpact.originalGrade]}</strong> до{' '}
                        <strong>{GRADE_LABELS[vacancyOpt.gradeImpact.relaxedGrade]}</strong>:
                      </span>
                      <span className={styles.optDeltaBadge}>
                        +{vacancyOpt.gradeImpact.delta} кандидат{vacancyOpt.gradeImpact.delta === 1 ? '' : vacancyOpt.gradeImpact.delta < 5 ? 'а' : 'ов'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Salary impact */}
                {vacancyOpt.salaryImpacts.length > 0 && (
                  <div className={styles.recCard}>
                    <h3 className={styles.recSectionTitle}>
                      <TrendingUp size={14} /> Влияние повышения оклада
                    </h3>
                    <div className={styles.salaryImpactGrid}>
                      {vacancyOpt.salaryImpacts.map((si) => {
                        const baseSalary = vacancy.salaryTo ?? vacancy.salaryFrom ?? 0;
                        return (
                          <div key={si.salaryIncrease} className={styles.salaryImpactCard}>
                            <span className={styles.salaryImpactPct}>+{si.salaryIncrease}%</span>
                            <span className={styles.salaryImpactAmount}>
                              {baseSalary > 0
                                ? `${(Math.round(baseSalary * (1 + si.salaryIncrease / 100)) / 1000).toFixed(0)}k ${symbol}`
                                : '—'}
                            </span>
                            <span className={styles.salaryImpactCandidates}>
                              {si.candidatesInRange} из {si.totalCandidates}
                            </span>
                            <span className={styles.salaryImpactLabel}>в зарплатном диапазоне</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        /* ── Normal: TreePicker + Match Panel ── */
        <div className={styles.body}>
          <div className={styles.pickerContainer}>
            <TreePicker
              mode="vacancy"
              fullHeight
              filteredSubIds={filteredSubIds}
              minIds={minIds}
              maxIds={maxIds}
              minYearsMap={minYearsMap}
              maxYearsMap={maxYearsMap}
              onVacancyClick={handleVacancyClick}
              onVacancyYears={handleVacancyYears}
            />
          </div>

          {/* ── Match panel ── */}
          {matchOpen && (
            <div className={styles.matchPanel}>
              <div className={styles.matchPanelHeader}>
                <span className={styles.matchPanelTitle}>Автоподбор кандидатов</span>
                <button className={styles.matchPanelClose} onClick={() => setMatchOpen(false)}>
                  <X size={14} />
                </button>
              </div>

              {matchLoading ? (
                <div className={styles.matchLoading}>Вычисляем...</div>
              ) : matchRows.length === 0 ? (
                <div className={styles.matchLoading}>Нет кандидатов</div>
              ) : (
                <div className={styles.matchList}>
                  {matchRows.map((row) => (
                    <div key={row.candidateId} className={styles.matchRow}>
                      <div className={styles.matchAvatar}>
                        {row.photoUrl
                          ? <img src={row.photoUrl} alt="" className={styles.matchAvatarImg} />
                          : <span className={styles.matchAvatarInitials}>{row.name.slice(0, 1)}</span>
                        }
                      </div>
                      <div className={styles.matchInfo}>
                        <button
                          className={styles.matchName}
                          onClick={() => navigate(`/candidates/${row.candidateId}`)}
                        >
                          {row.name}
                        </button>
                        <div className={styles.matchScores}>
                          <span
                            className={styles.matchScore}
                            style={{ color: scoreColor(row.scoreMin) }}
                          >
                            MIN {row.scoreMin}%
                          </span>
                          <span
                            className={styles.matchScore}
                            style={{ color: scoreColor(row.scoreMax) }}
                          >
                            MAX {row.scoreMax}%
                          </span>
                        </div>
                      </div>
                      <button
                        className={styles.matchCompareBtn}
                        onClick={() => navigate(`/compare/${vacancy!.id}/${row.candidateId}`)}
                        title="Сравнение"
                      >
                        <GitCompare size={12} />
                      </button>
                      <button
                        className={`${styles.matchAddBtn} ${addedSet.has(row.candidateId) ? styles.matchAddBtnDone : ''}`}
                        onClick={() => addToPipeline(row.candidateId, row.scoreMin)}
                        disabled={addedSet.has(row.candidateId)}
                        title="Добавить в воронку"
                      >
                        {addedSet.has(row.candidateId) ? <Check size={12} /> : '+'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Vacancy Info Modal ──────────────────────────── */}
      <Modal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        title="Информация о вакансии"
        size="md"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setInfoOpen(false)}>Отмена</Button>
            <Button onClick={saveInfo}>Сохранить</Button>
          </div>
        }
      >
        <div className={styles.modalForm}>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Компания</label>
              <input className={styles.input} value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Логотип (URL)</label>
              <input className={styles.input} value={companyLogoUrl} onChange={(e) => setCompanyLogoUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Грейд</label>
              <select className={styles.select} value={grade} onChange={(e) => setGrade(e.target.value as Grade)}>
                {GRADE_ORDER.map((g) => <option key={g} value={g}>{GRADE_LABELS[g]}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Статус</label>
              <select className={styles.select} value={vacancyStatus} onChange={(e) => setVacancyStatus(e.target.value as VacancyStatus)}>
                {(Object.entries(VACANCY_STATUS_LABELS) as [VacancyStatus, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Зарплата от ({symbol})</label>
              <input className={styles.input} type="number" value={salaryFrom} onChange={(e) => setSalaryFrom(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Зарплата до ({symbol})</label>
              <input className={styles.input} type="number" value={salaryTo} onChange={(e) => setSalaryTo(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Валюта</label>
              <select className={styles.select} value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
                <option value="RUB">RUB</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="KZT">KZT</option>
              </select>
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Формат</label>
              <select className={styles.select} value={workFormat} onChange={(e) => setWorkFormat(e.target.value as WorkFormat)}>
                {(Object.entries(WORK_FORMAT_LABELS) as [string, string][])
                  .filter(([k]) => k !== 'any')
                  .map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Занятость</label>
              <select className={styles.select} value={employmentType} onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}>
                {(Object.entries(EMPLOYMENT_TYPE_LABELS) as [EmploymentType, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Город</label>
              <input className={styles.input} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Москва" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Ссылка (источник)</label>
              <input className={styles.input} value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://hh.ru/..." />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Заметки</label>
            <textarea className={styles.textarea} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
