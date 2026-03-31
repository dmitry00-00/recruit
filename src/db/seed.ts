import { db } from './schema';
import type { Position } from '@/entities';

export async function seedIfEmpty(): Promise<void> {
  const positionsCount = await db.positions.count();
  if (positionsCount > 0) return;

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
