import { useState } from 'react';
import {
  Plus, Mail, Phone, CalendarPlus, CheckCircle2, CalendarClock, ClipboardCheck,
  Send, FileDown, Briefcase, PartyPopper, XCircle, Ban, Flag, StickyNote,
} from 'lucide-react';
import { useResponseStore } from '@/stores';
import {
  RESPONSE_EVENT_LABELS,
  type ResponseEvent,
  type ResponseEventType,
} from '@/entities';
import styles from './ResponseTimeline.module.css';

type IconComp = typeof Mail;

const EVENT_ICONS: Record<ResponseEventType, IconComp> = {
  candidate_applied:   Mail,
  recruiter_contacted: Phone,
  screening_scheduled: CalendarPlus,
  screening_done:      CheckCircle2,
  interview_scheduled: CalendarClock,
  interview_done:      ClipboardCheck,
  test_task_sent:      Send,
  test_task_received:  FileDown,
  offer_sent:          Briefcase,
  offer_accepted:      PartyPopper,
  offer_declined:      XCircle,
  candidate_rejected:  Ban,
  candidate_withdrawn: Flag,
  note:                StickyNote,
};

const POSITIVE_EVENTS: ResponseEventType[] = [
  'screening_done', 'interview_done', 'test_task_received',
  'offer_accepted', 'candidate_applied',
];
const NEGATIVE_EVENTS: ResponseEventType[] = [
  'candidate_rejected', 'candidate_withdrawn', 'offer_declined',
];

function toneClass(type: ResponseEventType) {
  if (POSITIVE_EVENTS.includes(type)) return styles.positive;
  if (NEGATIVE_EVENTS.includes(type)) return styles.negative;
  return styles.neutral;
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
        <div className={styles.stack}>
          {sorted.map((ev) => {
            const Icon = EVENT_ICONS[ev.type];
            return (
              <div key={ev.id} className={`${styles.eventSpine} ${toneClass(ev.type)}`}>
                <div className={styles.eventIcon}>
                  <Icon size={14} />
                </div>
                <div className={styles.eventBody}>
                  <div className={styles.eventHead}>
                    <span className={styles.eventType}>{RESPONSE_EVENT_LABELS[ev.type]}</span>
                    <span className={styles.eventDate}>{formatDate(ev.createdAt)}</span>
                  </div>
                  {ev.scheduledAt && (
                    <div className={styles.eventScheduled}>
                      Запланировано: {formatDate(ev.scheduledAt)}
                    </div>
                  )}
                  {ev.comment && <div className={styles.eventComment}>{ev.comment}</div>}
                </div>
              </div>
            );
          })}
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
