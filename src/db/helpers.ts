import { db } from './schema';
import type { WorkEntry, Pipeline, PipelineStage } from '@/entities';
import { DEFAULT_PIPELINE_STAGES } from '@/entities';

export async function getWorkEntriesForCandidate(candidateId: string): Promise<WorkEntry[]> {
  return db.workEntries
    .where('candidateId')
    .equals(candidateId)
    .sortBy('startDate');
}

export async function getOrCreatePipeline(vacancyId: string): Promise<Pipeline> {
  const existing = await db.pipelines.where('vacancyId').equals(vacancyId).first();
  if (existing) return existing;

  const pipelineId = crypto.randomUUID();
  const now = new Date();

  const pipeline: Pipeline = {
    id: pipelineId,
    vacancyId,
    stages: [],
    createdAt: now,
  };

  const stages: PipelineStage[] = DEFAULT_PIPELINE_STAGES.map((s) => ({
    ...s,
    id: crypto.randomUUID(),
    pipelineId,
  }));

  await db.pipelines.add(pipeline);
  await db.pipelineStages.bulkAdd(stages);

  return { ...pipeline, stages };
}
