import { db } from './schema';
import type { Position, Vacancy, Candidate, WorkEntry } from '@/entities';

export async function seedIfEmpty(): Promise<void> {
  // Seed positions
  const positionsCount = await db.positions.count();
  if (positionsCount === 0) {
    const positionsModule = await import('@/data/defaultPositions.json');
    const now = new Date();
    const positions: Position[] = (positionsModule.default.positions as Record<string, unknown>[]).map(
      (p) => ({
        ...p,
        createdAt: now,
        updatedAt: now,
      } as Position)
    );
    await db.positions.bulkAdd(positions);
    console.log(`[DB] Seeded ${positions.length} default positions`);
  }

  // Seed vacancies
  const vacanciesCount = await db.vacancies.count();
  if (vacanciesCount === 0) {
    const vacModule = await import('@/data/seedVacancies.json');
    const now = new Date();
    const vacancies: Vacancy[] = (vacModule.default.vacancies as Record<string, unknown>[]).map(
      (v) => ({
        ...v,
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      } as Vacancy)
    );
    await db.vacancies.bulkAdd(vacancies);
    console.log(`[DB] Seeded ${vacancies.length} vacancies`);
  }

  // Seed candidates and work entries
  const candidatesCount = await db.candidates.count();
  if (candidatesCount === 0) {
    const candModule = await import('@/data/seedCandidates.json');
    const now = new Date();
    const rawCandidates = candModule.default.candidates as Record<string, unknown>[];

    for (const raw of rawCandidates) {
      const workEntriesRaw = (raw.workEntries as Record<string, unknown>[]) || [];

      const candidate: Candidate = {
        id: raw.id as string,
        firstName: raw.firstName as string,
        lastName: raw.lastName as string,
        email: raw.email as string,
        phone: raw.phone as string,
        telegramHandle: raw.telegramHandle as string,
        city: raw.city as string,
        country: raw.country as string,
        workFormat: raw.workFormat as Candidate['workFormat'],
        relocate: raw.relocate as boolean,
        salaryExpected: raw.salaryExpected as number,
        currency: raw.currency as Candidate['currency'],
        notes: raw.notes as string,
        createdAt: now,
        updatedAt: now,
      };

      await db.candidates.add(candidate);

      const workEntries: WorkEntry[] = workEntriesRaw.map((we) => ({
        id: we.id as string,
        candidateId: raw.id as string,
        companyName: we.companyName as string,
        positionId: we.positionId as string,
        grade: we.grade as WorkEntry['grade'],
        startDate: new Date(we.startDate as string),
        endDate: we.endDate ? new Date(we.endDate as string) : undefined,
        isCurrent: we.isCurrent as boolean,
        tools: we.tools as WorkEntry['tools'],
        salary: we.salary as number,
        currency: (we.currency || 'RUB') as WorkEntry['currency'],
      }));

      if (workEntries.length > 0) {
        await db.workEntries.bulkAdd(workEntries);
      }
    }

    console.log(`[DB] Seeded ${rawCandidates.length} candidates with work entries`);
  }
}
