import Dexie, { type Table } from 'dexie';
import type {
  Position,
  Vacancy,
  Candidate,
  WorkEntry,
  Pipeline,
  PipelineStage,
  PipelineCard,
} from '../entities';

// ── Schema ───────────────────────────────────────────────────

export class RecruitingDB extends Dexie {
  positions!:      Table<Position>;
  vacancies!:      Table<Vacancy>;
  candidates!:     Table<Candidate>;
  workEntries!:    Table<WorkEntry>;
  pipelines!:      Table<Pipeline>;
  pipelineStages!: Table<PipelineStage>;
  pipelineCards!:  Table<PipelineCard>;

  constructor() {
    super('RecruitingDB');

    this.version(1).stores({
      positions:      '++id, category, subcategory, createdAt',
      vacancies:      '++id, positionId, status, grade, publishedAt, companyName',
      candidates:     '++id, lastName, createdAt',
      workEntries:    '++id, candidateId, positionId, startDate, isCurrent',
      pipelines:      '++id, vacancyId, createdAt',
      pipelineStages: '++id, pipelineId, order',
      pipelineCards:  '++id, pipelineId, stageId, candidateId, addedAt',
    });
  }
}

export const db = new RecruitingDB();

// ── Seed data loader ─────────────────────────────────────────

export async function seedIfEmpty(): Promise<void> {
  const positionsCount = await db.positions.count();
  if (positionsCount > 0) return;

  // Загружаем seed данные
  const [positionsModule] = await Promise.all([
    import('../../data/defaultPositions.json'),
  ]);

  const now = new Date();
  const positions: Position[] = positionsModule.default.positions.map(
    (p: Omit<Position, 'createdAt' | 'updatedAt'>) => ({
      ...p,
      createdAt: now,
      updatedAt: now,
    })
  );

  await db.positions.bulkAdd(positions);
  console.log(`[DB] Seeded ${positions.length} default positions`);
}

// ── Helper: get work entries for candidate ────────────────────

export async function getWorkEntriesForCandidate(candidateId: string): Promise<WorkEntry[]> {
  return db.workEntries
    .where('candidateId')
    .equals(candidateId)
    .sortBy('startDate');
}

// ── Helper: get or create pipeline for vacancy ───────────────

export async function getOrCreatePipeline(vacancyId: string): Promise<Pipeline> {
  const existing = await db.pipelines.where('vacancyId').equals(vacancyId).first();
  if (existing) return existing;

  const { DEFAULT_PIPELINE_STAGES } = await import('../entities');

  const pipelineId = crypto.randomUUID();
  const now = new Date();

  const pipeline: Pipeline = {
    id: pipelineId,
    vacancyId,
    stages: [],
    createdAt: now,
  };

  const stages: PipelineStage[] = DEFAULT_PIPELINE_STAGES.map((s, i) => ({
    ...s,
    id: crypto.randomUUID(),
    pipelineId,
  }));

  await db.pipelines.add(pipeline);
  await db.pipelineStages.bulkAdd(stages);

  return { ...pipeline, stages };
}
