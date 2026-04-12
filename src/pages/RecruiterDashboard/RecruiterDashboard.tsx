import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, X, Check } from 'lucide-react';
import { useVacancyStore, useCandidateStore, useTaskStore, useAuthStore } from '@/stores';
import { MatchBadge } from '@/components/MatchBadge';
import { GradeBadge, Button } from '@/components/ui';
import { aggregateCandidate, computeMatchScore } from '@/utils';
import { db, getOrCreatePipeline } from '@/db';
import { MATCH_THRESHOLDS, VACANCY_STATUS_LABELS } from '@/config';
import type { MatchResult, CandidateAggregation, RecruitmentTask } from '@/entities';
import styles from './RecruiterDashboard.module.css';

interface MatchPair {
  vacancyId: string;
  candidateId: string;
  score: number;
  matchResult: MatchResult;
  companyName: string;
  vacancyGrade: string;
  candidateName: string;
}

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function isToday(d: Date) {
  return isSameDay(d, new Date());
}

function formatShortDate(d: Date) {
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
}

export function RecruiterDashboard() {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.currentUser);
  const { vacancies, load: loadVacancies } = useVacancyStore();
  const { candidates, load: loadCandidates, getWorkEntries } = useCandidateStore();
  const { tasks, loadAll: loadTasks, addTask, setStatus, removeTask } = useTaskStore();

  const [matches, setMatches] = useState<MatchPair[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [addedSet, setAddedSet] = useState<Set<string>>(new Set());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');

  useEffect(() => { loadVacancies(); loadCandidates(); loadTasks(); }, [loadVacancies, loadCandidates, loadTasks]);

  // Compute top matches across all open vacancies × all candidates
  useEffect(() => {
    (async () => {
      setMatchesLoading(true);
      const openVacs = vacancies.filter((v) => v.status === 'open');
      const pairs: MatchPair[] = [];

      for (const cand of candidates) {
        const entries = await getWorkEntries(cand.id);
        const agg = aggregateCandidate(cand, entries);

        for (const vac of openVacs) {
          const mr = computeMatchScore(vac, agg);
          if (mr.scoreMin >= MATCH_THRESHOLDS.MEDIUM) {
            pairs.push({
              vacancyId: vac.id,
              candidateId: cand.id,
              score: mr.scoreMin,
              matchResult: mr,
              companyName: vac.companyName,
              vacancyGrade: vac.grade,
              candidateName: `${cand.lastName} ${cand.firstName}`,
            });
          }
        }
      }

      pairs.sort((a, b) => b.score - a.score);
      setMatches(pairs.slice(0, 50));
      setMatchesLoading(false);
    })();
  }, [vacancies, candidates, getWorkEntries]);

  // Check pipeline membership for matched pairs
  useEffect(() => {
    (async () => {
      const cards = await db.pipelineCards.toArray();
      const set = new Set<string>();
      for (const c of cards) {
        set.add(`${c.candidateId}`);
      }
      // Store full pipelineCards for more precise check
      const pairSet = new Set<string>();
      for (const c of cards) {
        // Find which vacancy this pipeline belongs to
        const pipeline = await db.pipelines.get(c.pipelineId);
        if (pipeline) pairSet.add(`${pipeline.vacancyId}:${c.candidateId}`);
      }
      setAddedSet(pairSet);
    })();
  }, [matches]);

  const handleAddToPipeline = useCallback(async (vacancyId: string, candidateId: string, score: number) => {
    const pipeline = await getOrCreatePipeline(vacancyId);
    const stages = await db.pipelineStages.where('pipelineId').equals(pipeline.id).sortBy('order');
    if (!stages[0]) return;
    await db.pipelineCards.add({
      id: crypto.randomUUID(),
      pipelineId: pipeline.id,
      stageId: stages[0].id,
      candidateId,
      matchScore: score,
      addedAt: new Date(),
      movedAt: new Date(),
    });
    setAddedSet((prev) => new Set([...prev, `${vacancyId}:${candidateId}`]));
  }, []);

  const handleAddTask = useCallback(() => {
    if (!newTaskTitle.trim()) return;
    addTask({
      title: newTaskTitle.trim(),
      status: 'pending',
      dueDate: newTaskDate ? new Date(newTaskDate) : new Date(),
      assigneeId: currentUser?.id,
    });
    setNewTaskTitle('');
    setNewTaskDate('');
  }, [newTaskTitle, newTaskDate, addTask, currentUser]);

  // Today's tasks
  const todayTasks = useMemo(() => {
    const today = new Date();
    return tasks.filter((t) => {
      const due = new Date(t.dueDate);
      return isSameDay(due, today) && t.status !== 'cancelled';
    });
  }, [tasks]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(calYear, calMonth, 1);
    const lastDay = new Date(calYear, calMonth + 1, 0);
    let startDay = firstDay.getDay(); // 0=Sun
    startDay = startDay === 0 ? 6 : startDay - 1; // Convert to Mon=0

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Previous month days
    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(calYear, calMonth, -i);
      days.push({ date: d, isCurrentMonth: false });
    }
    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(calYear, calMonth, i), isCurrentMonth: true });
    }
    // Next month days to fill grid (6 rows)
    while (days.length < 42) {
      const d = new Date(calYear, calMonth + 1, days.length - lastDay.getDate() - startDay + 1);
      days.push({ date: d, isCurrentMonth: false });
    }

    return days;
  }, [calYear, calMonth]);

  // Map tasks to calendar days
  const tasksByDate = useMemo(() => {
    const map = new Map<string, RecruitmentTask[]>();
    for (const t of tasks) {
      if (t.status === 'cancelled') continue;
      const d = new Date(t.dueDate);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return map;
  }, [tasks]);

  const openVacancies = vacancies.filter((v) => v.status === 'open').length;
  const pendingTasks = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').length;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Дашборд подбора</h1>

      {/* ── Stats ──────────────────────────────────── */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{openVacancies}</div>
          <div className={styles.statLabel}>Открытых вакансий</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{candidates.length}</div>
          <div className={styles.statLabel}>Кандидатов</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{matches.length}</div>
          <div className={styles.statLabel}>Совпадений</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{pendingTasks}</div>
          <div className={styles.statLabel}>Активных задач</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{todayTasks.length}</div>
          <div className={styles.statLabel}>Задач на сегодня</div>
        </div>
      </div>

      <div className={styles.columns}>
        {/* ── Left column: Matches ──────────────────── */}
        <div>
          {/* ── Matches ────────────────────────────────── */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Найденные совпадения</h2>
            {matchesLoading ? (
              <div className={styles.emptyState}>Вычисление совпадений...</div>
            ) : matches.length === 0 ? (
              <div className={styles.emptyState}>Нет совпадений с порогом ≥{MATCH_THRESHOLDS.MEDIUM}%</div>
            ) : (
              <div className={styles.matchesList}>
                {matches.map((m) => {
                  const pairKey = `${m.vacancyId}:${m.candidateId}`;
                  const isAdded = addedSet.has(pairKey);
                  return (
                    <div key={pairKey} className={styles.matchRow}>
                      <div className={styles.matchVacancy}>
                        <div className={styles.matchVacancyName}>{m.companyName}</div>
                        <div className={styles.matchVacancyMeta}>{m.vacancyGrade}</div>
                      </div>
                      <MatchBadge score={m.score} size="sm" />
                      <div className={styles.matchCandidate}>
                        <div className={styles.matchCandidateName}>{m.candidateName}</div>
                      </div>
                      <div className={styles.matchActions}>
                        <button
                          className={styles.compareBtn}
                          onClick={() => navigate(`/compare/${m.vacancyId}/${m.candidateId}`)}
                        >
                          Сравнение
                        </button>
                        <button
                          className={`${styles.addPipelineBtn} ${isAdded ? styles.addPipelineBtnDone : ''}`}
                          onClick={() => !isAdded && handleAddToPipeline(m.vacancyId, m.candidateId, m.score)}
                          disabled={isAdded}
                          title={isAdded ? 'В воронке' : 'Добавить в воронку'}
                        >
                          {isAdded ? <Check size={12} /> : <Plus size={12} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right column: Tasks + Calendar ─────────── */}
        <div>
          {/* ── Today's tasks ──────────────────────────── */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Задачи на сегодня</h2>
            {todayTasks.length === 0 ? (
              <div className={styles.emptyState}>На сегодня задач нет</div>
            ) : (
              <div className={styles.tasksList}>
                {todayTasks.map((t) => (
                  <div key={t.id} className={styles.taskRow}>
                    <input
                      type="checkbox"
                      className={styles.taskCheckbox}
                      checked={t.status === 'done'}
                      onChange={() => setStatus(t.id, t.status === 'done' ? 'pending' : 'done')}
                    />
                    <div className={styles.taskInfo}>
                      <div className={`${styles.taskTitle} ${t.status === 'done' ? styles.taskTitleDone : ''}`}>
                        {t.title}
                      </div>
                      {t.description && (
                        <div className={styles.taskMeta}>{t.description}</div>
                      )}
                    </div>
                    <button className={styles.taskDelete} onClick={() => removeTask(t.id)} title="Удалить">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.addTaskRow}>
              <input
                className={styles.addTaskInput}
                placeholder="Новая задача..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
              />
              <input
                type="date"
                className={styles.addTaskDate}
                value={newTaskDate}
                onChange={(e) => setNewTaskDate(e.target.value)}
              />
              <button className={styles.addTaskBtn} onClick={handleAddTask}>
                <Plus size={12} /> Добавить
              </button>
            </div>
          </div>

          {/* ── Calendar ──────────────────────────────── */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Календарь задач</h2>
            <div className={styles.calendar}>
              <div className={styles.calendarHeader}>
                <span className={styles.calendarTitle}>
                  {MONTH_NAMES[calMonth]} {calYear}
                </span>
                <div className={styles.calendarNav}>
                  <button
                    className={styles.calendarNavBtn}
                    onClick={() => {
                      if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); }
                      else setCalMonth((m) => m - 1);
                    }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    className={styles.calendarNavBtn}
                    onClick={() => {
                      if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); }
                      else setCalMonth((m) => m + 1);
                    }}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              <div className={styles.calendarGrid}>
                {DAY_NAMES.map((d) => (
                  <div key={d} className={styles.calendarDayHeader}>{d}</div>
                ))}
                {calendarDays.map(({ date, isCurrentMonth }, idx) => {
                  const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
                  const dayTasks = tasksByDate.get(key) ?? [];
                  const today = isToday(date);

                  return (
                    <div
                      key={idx}
                      className={`${styles.calendarDay} ${!isCurrentMonth ? styles.calendarDayOther : ''}`}
                    >
                      <div className={styles.calendarDayNum}>
                        {today ? (
                          <span className={styles.calendarDayToday}>{date.getDate()}</span>
                        ) : (
                          date.getDate()
                        )}
                      </div>
                      {dayTasks.slice(0, 2).map((t) => (
                        <span
                          key={t.id}
                          className={`${styles.calendarDot} ${t.status === 'done' ? styles.calendarDotDone : ''}`}
                          title={t.title}
                        >
                          {t.title}
                        </span>
                      ))}
                      {dayTasks.length > 2 && (
                        <span className={styles.calendarDot} style={{ background: 'var(--text-tertiary)' }}>
                          +{dayTasks.length - 2}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
