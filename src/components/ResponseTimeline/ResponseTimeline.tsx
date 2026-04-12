import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useResponseStore } from '@/stores';
import {
  RESPONSE_EVENT_LABELS,
  RESPONSE_EVENT_ICONS,
  type ResponseEvent,
  type ResponseEventType,
} from '@/entities';
import styles from './ResponseTimeline.module.css';

const POSITIVE_EVENTS: ResponseEventType[] = [
  'screening_done', 'interview_done', 'test_task_received',
  'offer_accepted', 'candidate_applied',
];
const NEGATIVE_EVENTS: ResponseEventType[] = [
  'candidate_rejected', 'candidate_withdrawn', 'offer_declined',
];

function dotClass(type: ResponseEventType) {
  if (POSITIVE_EVENTS.includes(type)) return styles.eventDotPositive;
  if (NEGATIVE_EVENTS.includes(type)) return styles.eventDotNegative;
  return styles.eventDotNeutral;
}

function formatDate(d: Date) {
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

interface Props {
  vacancyId: string;
  candidateId: string;
  events: ResponseEvent[];
  readOnly?: boolean;
}

export function ResponseTimeline({ vacancyId, candidateId, events, readOnly = false }: Props) {
  const addEvent = useResponseStore((s) => s.addEvent);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<ResponseEventType>('note');
  const [formComment, setFormComment] = useState('');
  const [formScheduled, setFormScheduled] = useState('');

  const handleSubmit = async () => {
    await addEvent({
      vacancyId,
      candidateId,
      type: formType,
      comment: formComment || undefined,
      scheduledAt: formScheduled ? new Date(formScheduled) : undefined,
    });
    setFormComment('');
    setFormScheduled('');
    setShowForm(false);
  };

  const sorted = [...events].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.title}>Хроника откликов</span>
        {!readOnly && (
          <button className={styles.addBtn} onClick={() => setShowForm((v) => !v)}>
            <Plus size={12} /> Событие
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className={styles.emptyState}>Нет истории взаимодействий</div>
      ) : (
        <div className={styles.timeline}>
          {sorted.map((ev) => (
            <div key={ev.id} className={styles.eventRow}>
              <div className={`${styles.eventDot} ${dotClass(ev.type)}`}>
                {RESPONSE_EVENT_ICONS[ev.type]}
              </div>
              <div className={styles.eventContent}>
                <div className={styles.eventType}>{RESPONSE_EVENT_LABELS[ev.type]}</div>
                <div className={styles.eventDate}>{formatDate(ev.createdAt)}</div>
                {ev.scheduledAt && (
                  <div className={styles.eventScheduled}>
                    Запланировано: {formatDate(ev.scheduledAt)}
                  </div>
                )}
                {ev.comment && <div className={styles.eventComment}>{ev.comment}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && !readOnly && (
        <div className={styles.form}>
          <div className={styles.formRow}>
            <select
              className={styles.formSelect}
              value={formType}
              onChange={(e) => setFormType(e.target.value as ResponseEventType)}
            >
              {Object.entries(RESPONSE_EVENT_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            <input
              type="datetime-local"
              className={styles.formSelect}
              value={formScheduled}
              onChange={(e) => setFormScheduled(e.target.value)}
              title="Дата (опционально)"
            />
          </div>
          <textarea
            className={styles.formInput}
            placeholder="Комментарий..."
            value={formComment}
            onChange={(e) => setFormComment(e.target.value)}
          />
          <div className={styles.formActions}>
            <button className={styles.formBtn} onClick={() => setShowForm(false)}>Отмена</button>
            <button className={`${styles.formBtn} ${styles.formBtnPrimary}`} onClick={handleSubmit}>
              Добавить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
