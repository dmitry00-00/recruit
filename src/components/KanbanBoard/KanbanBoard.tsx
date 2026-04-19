import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import type { PipelineStage, PipelineCard } from '@/entities';
import { useCandidateStore } from '@/stores';
import { MatchBadge } from '@/components/MatchBadge';
import styles from './KanbanBoard.module.css';

interface KanbanBoardProps {
  stages: PipelineStage[];
  cards: PipelineCard[];
  onMoveCard: (cardId: string, newStageId: string) => void;
  onAddCard?: (stageId: string) => void;
}

function KanbanCardItem({ card }: { card: PipelineCard }) {
  const getById = useCandidateStore((s) => s.getById);
  const candidate = getById(card.candidateId);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id });

  return (
    <div
      ref={setNodeRef}
      className={`${styles.kanbanCard} ${isDragging ? styles.dragging : ''}`}
      {...attributes}
      {...listeners}
    >
      <div className={styles.cardName}>
        {candidate ? `${candidate.lastName} ${candidate.firstName}` : card.candidateId}
      </div>
      <div className={styles.cardMeta}>
        {card.matchScore != null && <MatchBadge score={card.matchScore} size="sm" />}
      </div>
    </div>
  );
}

function Column({
  stage,
  cards,
  onAddCard,
}: {
  stage: PipelineStage;
  cards: PipelineCard[];
  onAddCard?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div className={styles.column}>
      <div className={styles.columnHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className={styles.colorDot} style={{ background: stage.color }} />
          <span className={styles.columnTitle}>{stage.name}</span>
        </div>
        <span className={styles.columnCount}>{cards.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`${styles.columnBody} ${isOver ? styles.columnOver : ''}`}
      >
        {cards.map((card) => (
          <KanbanCardItem key={card.id} card={card} />
        ))}
        {onAddCard && (
          <button className={styles.addBtn} onClick={onAddCard}>
            <Plus size={14} /> Кандидат
          </button>
        )}
      </div>
    </div>
  );
}

export function KanbanBoard({ stages, cards, onMoveCard, onAddCard }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const cardId = active.id as string;
    const newStageId = over.id as string;
    const card = cards.find((c) => c.id === cardId);
    if (card && card.stageId !== newStageId) {
      onMoveCard(cardId, newStageId);
    }
  };

  const activeCard = activeId ? cards.find((c) => c.id === activeId) : null;

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className={styles.board}>
        {stages.map((stage) => (
          <Column
            key={stage.id}
            stage={stage}
            cards={cards.filter((c) => c.stageId === stage.id)}
            onAddCard={stage.order === 0 && onAddCard ? () => onAddCard(stage.id) : undefined}
          />
        ))}
      </div>
      <DragOverlay>
        {activeCard ? <KanbanCardItem card={activeCard} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
