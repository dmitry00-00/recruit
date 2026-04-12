import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, Briefcase, Check, GitCompare, TrendingUp, ArrowUpRight, AlertTriangle } from 'lucide-react';
import { useCandidateStore, usePositionStore, useVacancyStore, usePipelineStore, useFilterStore } from '@/stores';
import { TreePicker } from '@/components/TreePicker';
import { GradeBadge, Modal, Button } from '@/components/ui';
import {
  aggregateCandidate,
  computeMatchScore,
  computeRoadmap,
  getToolSubcategoryMap,
  computeCareerRecommendations,
  getToolById,
  getSubcategoryById,
} from '@/utils';
import type { CareerRecommendation } from '@/utils';
import { GRADE_ORDER, GRADE_LABELS } from '@/entities';
import { db, getOrCreatePipeline } from '@/db';
import type { WorkEntry, Grade, Currency, CandidateAggregation } from '@/entities';
import styles from './CandidateDetail.module.css';

interface MatchRow {
  vacancyId: string;
  companyName: string;
  companyLogoUrl?: string;
  grade: Grade;
  scoreMin: number;
  scoreMax: number;
}

function formatDateRange(entry: WorkEntry): string {
  const start = new Date(entry.startDate).toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' });
  const end = entry.isCurrent ? 'н.в.' : entry.endDate
    ? new Date(entry.endDate).toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' })
    : '—';
  return `${start} — ${end}`;
}

export function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { candidates, load, getWorkEntries, addWorkEntry, updateWorkEntry } = useCandidateStore();
  const { positions, load: loadPositions } = usePositionStore();
  const { vacancies, load: loadVacancies } = useVacancyStore();
  const { addCard } = usePipelineStore();

  useEffect(() => { load(); loadPositions(); loadVacancies(); }, [load, loadPositions, loadVacancies]);

  const candidate = candidates.find((c) => c.id === id);

  const [workEntries, setWorkEntries]     = useState<WorkEntry[]>([]);
  const [aggregation, setAggregation]     = useState<CandidateAggregation | null>(null);
  const [selectedIdx, setSelectedIdx]     = useState<number | null>(null);

  const refreshEntries = useCallback(async () => {
    if (!candidate) return;
    const entries = await getWorkEntries(candidate.id);
    setWorkEntries(entries);
    setAggregation(aggregateCandidate(candidate, entries));
  }, [candidate, getWorkEntries]);

  useEffect(() => { refreshEntries(); }, [refreshEntries]);

  // ── Active entry (for TreePicker edit mode) ───────────────
  const activeEntry = selectedIdx !== null ? workEntries[selectedIdx] : null;

  // Build TreePicker props
  const candidateToolIds = activeEntry
    ? activeEntry.tools.map((t) => t.toolId)
    : [];

  const candidateYearsMap: Record<string, number> = activeEntry
    ? Object.fromEntries(activeEntry.tools.map((t) => [t.toolId, t.years]))
    : (aggregation
        ? Object.fromEntries(aggregation.toolsExperience.map((t) => [t.toolId, t.years]))
        : {});

  // ── Tool toggle (auto-save for active entry) ──────────────
  const handleToggle = async (toolId: string) => {
    if (!activeEntry) return;
    const exists = activeEntry.tools.some((t) => t.toolId === toolId);
    const newTools = exists
      ? activeEntry.tools.filter((t) => t.toolId !== toolId)
      : [...activeEntry.tools, { toolId, years: 0 }];
    await updateWorkEntry(activeEntry.id, { tools: newTools });
    await refreshEntries();
  };

  const handleYearsChange = async (toolId: string, years: number) => {
    if (!activeEntry) return;
    const newTools = activeEntry.tools.map((t) =>
      t.toolId === toolId ? { ...t, years } : t,
    );
    await updateWorkEntry(activeEntry.id, { tools: newTools });
    await refreshEntries();
  };

  // ── Add new work entry ────────────────────────────────────
  const handleAddEntry = async () => {
    if (!candidate) return;
    const newId = await addWorkEntry({
      candidateId: candidate.id,
      companyName: 'Новое место работы',
      positionId: 'custom',
      grade: 'middle',
      startDate: new Date(),
      isCurrent: true,
      tools: [],
      currency: 'RUB',
    });
    await refreshEntries();
    const updated = await getWorkEntries(candidate.id);
    const newIdx = updated.findIndex((e) => e.id === newId);
    if (newIdx >= 0) {
      setSelectedIdx(newIdx);
      openEntryModal(updated[newIdx]);
    }
  };

  // ── Work entry meta modal ─────────────────────────────────
  const [entryModalOpen,  setEntryModalOpen]  = useState(false);
  const [editingEntry,    setEditingEntry]    = useState<WorkEntry | null>(null);
  const [eCompanyName,    setECompanyName]    = useState('');
  const [eCompanyLogo,    setECompanyLogo]    = useState('');
  const [ePositionId,     setEPositionId]     = useState('');
  const [eGrade,          setEGrade]          = useState<Grade>('middle');
  const [eStartDate,      setEStartDate]      = useState('');
  const [eEndDate,        setEEndDate]        = useState('');
  const [eIsCurrent,      setEIsCurrent]      = useState(false);
  const [eSalary,         setESalary]         = useState('');
  const [eCurrency,       setECurrency]       = useState<Currency>('RUB');
  const [eResponsib,      setEResponsib]      = useState('');

  const openEntryModal = (entry: WorkEntry) => {
    setEditingEntry(entry);
    setECompanyName(entry.companyName);
    setECompanyLogo(entry.companyLogoUrl ?? '');
    setEPositionId(entry.positionId);
    setEGrade(entry.grade);
    setEStartDate(entry.startDate ? new Date(entry.startDate).toISOString().slice(0, 10) : '');
    setEEndDate(entry.endDate ? new Date(entry.endDate).toISOString().slice(0, 10) : '');
    setEIsCurrent(entry.isCurrent);
    setESalary(entry.salary ? String(entry.salary) : '');
    setECurrency(entry.currency);
    setEResponsib(entry.responsibilities ?? '');
    setEntryModalOpen(true);
  };

  const saveEntryMeta = async () => {
    if (!editingEntry) return;
    await updateWorkEntry(editingEntry.id, {
      companyName: eCompanyName,
      companyLogoUrl: eCompanyLogo || undefined,
      positionId: ePositionId || 'custom',
      grade: eGrade,
      startDate: eStartDate ? new Date(eStartDate) : editingEntry.startDate,
      endDate: !eIsCurrent && eEndDate ? new Date(eEndDate) : undefined,
      isCurrent: eIsCurrent,
      salary: eSalary ? parseInt(eSalary) : undefined,
      currency: eCurrency,
      responsibilities: eResponsib || undefined,
    });
    await refreshEntries();
    setEntryModalOpen(false);
  };

  // ── Compute filtered sub IDs from active entry's position ─
  const filteredSubIds = useMemo(() => {
    const posId = activeEntry?.positionId ?? workEntries[0]?.positionId;
    if (!posId) return [];
    const pos = positions.find((p) => p.id === posId);
    if (!pos?.requiredCategories?.length) return [];
    return pos.requiredCategories.flatMap((rc) => rc.subcategoryIds);
  }, [activeEntry, workEntries, positions]);

  // ── Auto-matching vacancies ───────────────────────────────
  const [matchOpen,    setMatchOpen]    = useState(false);
  const [matchRows,    setMatchRows]    = useState<MatchRow[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [addedSet,     setAddedSet]     = useState<Set<string>>(new Set());

  const computeMatches = useCallback(() => {
    if (!aggregation || !candidate) return;
    setMatchLoading(true);
    const rows: MatchRow[] = [];
    for (const v of vacancies) {
      const match = computeMatchScore(v, aggregation);
      if (match.scoreMin <= 0) continue;
      rows.push({
        vacancyId: v.id,
        companyName: v.companyName,
        companyLogoUrl: v.companyLogoUrl,
        grade: v.grade,
        scoreMin: match.scoreMin,
        scoreMax: match.scoreMax,
      });
    }
    rows.sort((a, b) => b.scoreMin - a.scoreMin);
    setMatchRows(rows);
    setMatchLoading(false);
  }, [vacancies, aggregation, candidate]);

  useEffect(() => {
    if (matchOpen) computeMatches();
  }, [matchOpen, computeMatches]);

  const addToPipeline = async (vacancyId: string, scoreMin: number) => {
    if (!candidate) return;
    const pipeline = await getOrCreatePipeline(vacancyId);
    const pipelineStages = await db.pipelineStages
      .where('pipelineId').equals(pipeline.id).sortBy('order');
    if (pipelineStages.length > 0) {
      await addCard({
        pipelineId: pipeline.id,
        stageId: pipelineStages[0].id,
        candidateId: candidate.id,
        matchScore: scoreMin,
      });
      setAddedSet((s) => new Set([...s, vacancyId]));
    }
  };

  const scoreColor = (s: number) =>
    s >= 80 ? '#22c55e' : s >= 50 ? '#f0a030' : '#ef4444';

  // ── Analytics: career recommendations ─────────────────────
  const { section } = useFilterStore();

  const careerRec = useMemo<CareerRecommendation | null>(() => {
    if (section !== 'analytics' || !aggregation || !candidate) return null;
    // Find position from work entries to determine category
    const posId = workEntries[0]?.positionId;
    const pos = posId ? positions.find((p) => p.id === posId) : positions[0];
    if (!pos) return null;

    // Build roadmap from vacancies matching this position's category
    const posIds = positions
      .filter((p) => p.category === pos.category)
      .map((p) => p.id);
    const posVacancies = vacancies.filter((v) => posIds.includes(v.positionId));
    if (posVacancies.length === 0) return null;

    const subMap = getToolSubcategoryMap();
    const roadmapData = computeRoadmap(pos.id, posVacancies, subMap);
    return computeCareerRecommendations(aggregation, roadmapData);
  }, [section, aggregation, candidate, workEntries, positions, vacancies]);

  if (!candidate) return <div style={{ padding: 24 }}>Кандидат не найден</div>;

  // ── Work entries sidebar panel ────────────────────────────
  const workPanel = (
    <div className={styles.workPanel}>
      <div className={styles.entryTabs}>
        {workEntries.map((_, i) => (
          <button
            key={i}
            className={`${styles.entryTab} ${selectedIdx === i ? styles.entryTabActive : ''}`}
            onClick={() => setSelectedIdx(selectedIdx === i ? null : i)}
            title={`Место работы ${i + 1}`}
          >
            {i + 1}
          </button>
        ))}
        <button
          className={`${styles.entryTab} ${styles.entryTabAdd}`}
          onClick={handleAddEntry}
          title="Добавить место работы"
        >
          <Plus size={12} />
        </button>
      </div>

      {(activeEntry ?? workEntries[0]) && (
        <div className={styles.entryCard}>
          <button
            className={styles.entryCardBtn}
            onClick={() => openEntryModal(activeEntry ?? workEntries[0])}
            title="Редактировать информацию о месте работы"
          >
            {(activeEntry ?? workEntries[0]).companyLogoUrl ? (
              <img
                src={(activeEntry ?? workEntries[0]).companyLogoUrl}
                alt=""
                className={styles.entryLogoImg}
              />
            ) : (
              <span className={styles.entryLogoPlaceholder}>
                {(activeEntry ?? workEntries[0]).companyName.slice(0, 2).toUpperCase()}
              </span>
            )}
            <div>
              <div className={styles.entryCompanyName}>
                {(activeEntry ?? workEntries[0]).companyName}
              </div>
              <div className={styles.entryDateRange}>
                {formatDateRange(activeEntry ?? workEntries[0])}
              </div>
            </div>
          </button>

          {selectedIdx !== null && (
            <button
              className={styles.entryDeselectBtn}
              onClick={() => setSelectedIdx(null)}
              title="Показать суммарный опыт"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className={styles.page}>
      {/* ── Header ───────────────────────────────────────── */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeft size={14} /> Назад
        </button>

        <div className={styles.headerSep} />

        <span className={styles.candidateName}>
          {candidate.lastName} {candidate.firstName}
        </span>

        {aggregation?.topGrade && <GradeBadge grade={aggregation.topGrade} />}

        {aggregation && (
          <span className={styles.totalExp}>{aggregation.totalYears} лет</span>
        )}

        <div className={styles.headerSpacer} />

        <Button
          size="sm"
          variant={matchOpen ? 'primary' : 'secondary'}
          onClick={() => setMatchOpen((v) => !v)}
        >
          <Briefcase size={13} /> Подобрать
        </Button>

        <Button
          size="sm"
          variant="secondary"
          onClick={() => navigate(`/candidates/${candidate.id}/edit`)}
        >
          Профиль
        </Button>

        <Button size="sm" variant="secondary" onClick={() => navigate(`/candidates/${candidate.id}/history`)}>
          Хроника
        </Button>
      </div>

      {/* ── Body ──────────────────────────────────────── */}
      {section === 'analytics' ? (
        /* ── Analytics: career growth recommendations ── */
        <div className={styles.analyticsBody}>
          {!aggregation && (
            <div className={styles.analyticsEmpty}>
              <AlertTriangle size={20} />
              <span>Нет данных об опыте кандидата</span>
            </div>
          )}

          {aggregation && !careerRec && (
            <div className={styles.analyticsEmpty}>
              <AlertTriangle size={20} />
              <span>Нет данных для рекомендаций. Возможно, кандидат уже на максимальном грейде или нет вакансий для следующего уровня.</span>
            </div>
          )}

          {careerRec && aggregation && (
            <div className={styles.analyticsContent}>
              <h2 className={styles.analyticsTitle}>Рекомендации по карьерному росту</h2>
              <p className={styles.analyticsDesc}>
                GAP-анализ между текущими навыками и требованиями следующего грейда
              </p>

              {/* Grade transition */}
              <div className={styles.gradeTransition}>
                <div className={styles.gradeBox}>
                  <span className={styles.gradeBoxLabel}>Текущий грейд</span>
                  <span className={styles.gradeBoxValue}>{careerRec.currentGradeLabel}</span>
                </div>
                <ArrowUpRight size={24} className={styles.gradeArrow} />
                <div className={`${styles.gradeBox} ${styles.gradeBoxTarget}`}>
                  <span className={styles.gradeBoxLabel}>Целевой грейд</span>
                  <span className={styles.gradeBoxValue}>{careerRec.targetGradeLabel}</span>
                </div>
              </div>

              {/* Progress */}
              <div className={styles.recCard}>
                <div className={styles.recProgressHeader}>
                  <span>Готовность к переходу</span>
                  <span className={styles.recProgressPct}>
                    {careerRec.totalSkillsNeeded > 0
                      ? Math.round((careerRec.alreadyHas / careerRec.totalSkillsNeeded) * 100)
                      : 0}%
                  </span>
                </div>
                <div className={styles.recProgressTrack}>
                  <div
                    className={styles.recProgressFill}
                    style={{ width: `${careerRec.totalSkillsNeeded > 0 ? (careerRec.alreadyHas / careerRec.totalSkillsNeeded) * 100 : 0}%` }}
                  />
                </div>
                <div className={styles.recProgressMeta}>
                  <span>{careerRec.alreadyHas} из {careerRec.totalSkillsNeeded} навыков</span>
                  <span>{careerRec.skills.length} к развитию</span>
                </div>
              </div>

              {/* Salary perspective */}
              {(careerRec.salaryNow.count > 0 || careerRec.salaryTarget.count > 0) && (
                <div className={styles.recCard}>
                  <h3 className={styles.recSectionTitle}>
                    <TrendingUp size={14} /> Зарплатная перспектива
                  </h3>
                  <div className={styles.salaryComparison}>
                    <div className={styles.salaryCompItem}>
                      <span className={styles.salaryCompLabel}>{careerRec.currentGradeLabel}</span>
                      <span className={styles.salaryCompValue}>
                        {careerRec.salaryNow.count > 0 ? `${(careerRec.salaryNow.median / 1000).toFixed(0)}k ₽` : '—'}
                      </span>
                    </div>
                    <ArrowUpRight size={16} style={{ color: 'var(--text-tertiary)' }} />
                    <div className={styles.salaryCompItem}>
                      <span className={styles.salaryCompLabel}>{careerRec.targetGradeLabel}</span>
                      <span className={`${styles.salaryCompValue} ${styles.salaryCompTarget}`}>
                        {careerRec.salaryTarget.count > 0 ? `${(careerRec.salaryTarget.median / 1000).toFixed(0)}k ₽` : '—'}
                      </span>
                    </div>
                    {careerRec.salaryIncrease > 0 && (
                      <div className={styles.salaryDelta}>
                        +{(careerRec.salaryIncrease / 1000).toFixed(0)}k ₽ ({careerRec.salaryIncreasePercent}%)
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Skills to develop */}
              {careerRec.skills.length > 0 && (
                <div className={styles.recCard}>
                  <h3 className={styles.recSectionTitle}>Навыки к развитию</h3>
                  <div className={styles.recSkillsList}>
                    {careerRec.skills.map((skill) => {
                      const tool = getToolById(skill.toolId);
                      const sub = getSubcategoryById(skill.subcategoryId);
                      return (
                        <div key={skill.toolId} className={styles.recSkillRow}>
                          <div className={styles.recSkillIcon}>
                            {tool?.logoUrl ? (
                              <img src={tool.logoUrl} alt="" className={styles.recSkillLogo} />
                            ) : (
                              <div className={styles.recSkillDot} />
                            )}
                          </div>
                          <div className={styles.recSkillInfo}>
                            <span className={styles.recSkillName}>{tool?.name ?? skill.toolId}</span>
                            <span className={styles.recSkillMeta}>
                              {sub?.name ?? ''} · Востребованность: {skill.demandCount}
                            </span>
                          </div>
                          <span className={`${styles.recBadge} ${skill.type === 'missing' ? styles.recBadgeMissing : styles.recBadgeDeepen}`}>
                            {skill.type === 'missing' ? 'Изучить' : 'Углубить'}
                          </span>
                          {skill.currentYears > 0 && (
                            <span className={styles.recSkillYears}>{skill.currentYears} г.</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {careerRec.skills.length === 0 && (
                <div className={styles.analyticsEmpty}>
                  <span>Все необходимые навыки освоены! Кандидат готов к переходу на {careerRec.targetGradeLabel}.</span>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ── Normal: TreePicker + Match Panel ── */
        <div className={styles.body}>
          <div className={styles.pickerContainer}>
            <TreePicker
              mode={activeEntry ? 'candidate' : 'candidate-agg'}
              fullHeight
              filteredSubIds={filteredSubIds}
              selected={candidateToolIds}
              yearsMap={candidateYearsMap}
              onChange={activeEntry
                ? (ids) => {
                    const cur = new Set(candidateToolIds);
                    const nxt = new Set(ids);
                    for (const tid of nxt) { if (!cur.has(tid)) { handleToggle(tid); return; } }
                    for (const tid of cur) { if (!nxt.has(tid)) { handleToggle(tid); return; } }
                  }
                : undefined}
              onYearsChange={activeEntry ? handleYearsChange : undefined}
              sidebarFooter={workPanel}
            />
          </div>

          {/* ── Match panel ── */}
          {matchOpen && (
            <div className={styles.matchPanel}>
              <div className={styles.matchPanelHeader}>
                <span className={styles.matchPanelTitle}>Автоподбор вакансий</span>
                <button className={styles.matchPanelClose} onClick={() => setMatchOpen(false)}>
                  <X size={14} />
                </button>
              </div>

              {matchLoading ? (
                <div className={styles.matchLoading}>Вычисляем...</div>
              ) : matchRows.length === 0 ? (
                <div className={styles.matchLoading}>Нет вакансий</div>
              ) : (
                <div className={styles.matchList}>
                  {matchRows.map((row) => (
                    <div key={row.vacancyId} className={styles.matchRow}>
                      <div className={styles.matchAvatar}>
                        {row.companyLogoUrl
                          ? <img src={row.companyLogoUrl} alt="" className={styles.matchAvatarImg} />
                          : <span className={styles.matchAvatarInitials}>{row.companyName.slice(0, 1)}</span>
                        }
                      </div>
                      <div className={styles.matchInfo}>
                        <button
                          className={styles.matchName}
                          onClick={() => navigate(`/vacancies/${row.vacancyId}`)}
                        >
                          {row.companyName}
                        </button>
                        <div className={styles.matchScores}>
                          <GradeBadge grade={row.grade} size="sm" />
                          <span
                            className={styles.matchScore}
                            style={{ color: scoreColor(row.scoreMin) }}
                          >
                            {row.scoreMin}%
                          </span>
                        </div>
                      </div>
                      <button
                        className={styles.matchCompareBtn}
                        onClick={() => navigate(`/compare/${row.vacancyId}/${candidate!.id}`)}
                        title="Сравнение"
                      >
                        <GitCompare size={12} />
                      </button>
                      <button
                        className={`${styles.matchAddBtn} ${addedSet.has(row.vacancyId) ? styles.matchAddBtnDone : ''}`}
                        onClick={() => addToPipeline(row.vacancyId, row.scoreMin)}
                        disabled={addedSet.has(row.vacancyId)}
                        title="Добавить в воронку"
                      >
                        {addedSet.has(row.vacancyId) ? <Check size={12} /> : '+'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Work Entry Meta Modal ────────────────────────── */}
      <Modal
        open={entryModalOpen}
        onClose={() => setEntryModalOpen(false)}
        title="Место работы"
        size="md"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setEntryModalOpen(false)}>Отмена</Button>
            <Button onClick={saveEntryMeta}>Сохранить</Button>
          </div>
        }
      >
        <div className={styles.modalForm}>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Компания</label>
              <input className={styles.input} value={eCompanyName} onChange={(e) => setECompanyName(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Логотип (URL)</label>
              <input className={styles.input} value={eCompanyLogo} onChange={(e) => setECompanyLogo(e.target.value)} placeholder="https://..." />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Должность</label>
              <select className={styles.select} value={ePositionId} onChange={(e) => setEPositionId(e.target.value)}>
                <option value="">—</option>
                {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Грейд</label>
              <select className={styles.select} value={eGrade} onChange={(e) => setEGrade(e.target.value as Grade)}>
                {GRADE_ORDER.map((g) => <option key={g} value={g}>{GRADE_LABELS[g]}</option>)}
              </select>
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Начало</label>
              <input className={styles.input} type="date" value={eStartDate} onChange={(e) => setEStartDate(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Окончание</label>
              <input className={styles.input} type="date" value={eEndDate} onChange={(e) => setEEndDate(e.target.value)} disabled={eIsCurrent} />
            </div>
          </div>

          <div className={styles.field}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={eIsCurrent}
                onChange={(e) => {
                  setEIsCurrent(e.target.checked);
                  if (e.target.checked) setEEndDate('');
                }}
              />
              По настоящее время
            </label>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Оклад</label>
              <input className={styles.input} type="number" value={eSalary} onChange={(e) => setESalary(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Валюта</label>
              <select className={styles.select} value={eCurrency} onChange={(e) => setECurrency(e.target.value as Currency)}>
                <option value="RUB">RUB</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="KZT">KZT</option>
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Обязанности</label>
            <textarea className={styles.textarea} value={eResponsib} onChange={(e) => setEResponsib(e.target.value)} rows={3} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
