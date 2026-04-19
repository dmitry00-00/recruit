import Dexie, { type Table } from 'dexie';
import type {
  Position,
  Vacancy,
  Candidate,
  WorkEntry,
  Pipeline,
  PipelineStage,
  PipelineCard,
  User,
  ResponseEvent,
  RecruitmentTask,
} from '@/entities';

export class RecruitingDB extends Dexie {
  positions!:        Table<Position>;
  vacancies!:        Table<Vacancy>;
  candidates!:       Table<Candidate>;
  workEntries!:      Table<WorkEntry>;
  pipelines!:        Table<Pipeline>;
  pipelineStages!:   Table<PipelineStage>;
  pipelineCards!:    Table<PipelineCard>;
  users!:            Table<User>;
  responseEvents!:   Table<ResponseEvent>;
  recruitmentTasks!: Table<RecruitmentTask>;

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

    this.version(2).stores({
      positions:      '++id, category, subcategory, createdAt',
      vacancies:      '++id, positionId, status, grade, publishedAt, companyName',
      candidates:     '++id, lastName, createdAt',
      workEntries:    '++id, candidateId, positionId, startDate, isCurrent',
      pipelines:      '++id, vacancyId, createdAt',
      pipelineStages: '++id, pipelineId, order',
      pipelineCards:  '++id, pipelineId, stageId, candidateId, addedAt',
      users:          '++id, &email, role, createdAt',
    });

    this.version(3).stores({
      positions:        '++id, category, subcategory, createdAt',
      vacancies:        '++id, positionId, status, grade, publishedAt, companyName',
      candidates:       '++id, lastName, createdAt',
      workEntries:      '++id, candidateId, positionId, startDate, isCurrent',
      pipelines:        '++id, vacancyId, createdAt',
      pipelineStages:   '++id, pipelineId, order',
      pipelineCards:    '++id, pipelineId, stageId, candidateId, addedAt',
      users:            '++id, &email, role, createdAt',
      responseEvents:   '++id, vacancyId, candidateId, [vacancyId+candidateId], type, createdAt',
      recruitmentTasks: '++id, vacancyId, candidateId, assigneeId, status, dueDate, createdAt',
    });
  }
}

export const db = new RecruitingDB();
