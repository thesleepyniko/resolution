import { db } from '../db';
import { weeklyShip, workshop, user } from '../db/schema';
import { eq, and, asc, desc, sql } from 'drizzle-orm';

export type WeeklyShipStatus = 'PLANNED' | 'IN_PROGRESS' | 'SHIPPED' | 'MISSED';

export type WeeklyShip = typeof weeklyShip.$inferSelect;

export const WeeklyShipService = {
	/**
	 * Create a new ship for a user in a specific week.
	 * Can optionally be tied to a workshop.
	 */
	async createShip(data: {
		userId: string;
		seasonId: string;
		weekNumber: number;
		goalText: string;
		workshopId?: string;
	}): Promise<WeeklyShip> {
		const [created] = await db.insert(weeklyShip)
			.values({
				userId: data.userId,
				seasonId: data.seasonId,
				weekNumber: data.weekNumber,
				goalText: data.goalText,
				workshopId: data.workshopId,
				status: 'PLANNED'
			})
			.returning();
		return created;
	},

	/**
	 * Mark a ship as shipped with proof.
	 * Requires userId to verify ownership.
	 */
	async markShipped(
		shipId: string,
		userId: string,
		proofUrl: string,
		notes?: string
	): Promise<WeeklyShip> {
		const ship = await db.query.weeklyShip.findFirst({
			where: eq(weeklyShip.id, shipId)
		});

		if (!ship || ship.userId !== userId) {
			throw new Error('Ship not found or access denied');
		}

		const [updated] = await db.update(weeklyShip)
			.set({
				status: 'SHIPPED',
				proofUrl,
				notes,
				shippedAt: new Date(),
				updatedAt: new Date()
			})
			.where(eq(weeklyShip.id, shipId))
			.returning();
		return updated;
	},

	/**
	 * Update ship status.
	 * Requires userId to verify ownership.
	 */
	async updateStatus(
		shipId: string,
		userId: string,
		status: WeeklyShipStatus
	): Promise<WeeklyShip> {
		const ship = await db.query.weeklyShip.findFirst({
			where: eq(weeklyShip.id, shipId)
		});

		if (!ship || ship.userId !== userId) {
			throw new Error('Ship not found or access denied');
		}

		const [updated] = await db.update(weeklyShip)
			.set({
				status,
				shippedAt: status === 'SHIPPED' ? new Date() : undefined,
				updatedAt: new Date()
			})
			.where(eq(weeklyShip.id, shipId))
			.returning();
		return updated;
	},

	/**
	 * Get all ships for a user in a specific week.
	 */
	async getUserShipsForWeek(
		userId: string,
		seasonId: string,
		weekNumber: number
	): Promise<(WeeklyShip & { workshop: typeof workshop.$inferSelect | null })[]> {
		return db.query.weeklyShip.findMany({
			where: and(
				eq(weeklyShip.userId, userId),
				eq(weeklyShip.seasonId, seasonId),
				eq(weeklyShip.weekNumber, weekNumber)
			),
			with: { workshop: true },
			orderBy: [asc(weeklyShip.createdAt)]
		});
	},

	/**
	 * Count shipped items for a user in a specific week.
	 */
	async countShippedForWeek(
		userId: string,
		seasonId: string,
		weekNumber: number
	): Promise<number> {
		const result = await db.select({ count: sql<number>`count(*)::int` })
			.from(weeklyShip)
			.where(and(
				eq(weeklyShip.userId, userId),
				eq(weeklyShip.seasonId, seasonId),
				eq(weeklyShip.weekNumber, weekNumber),
				eq(weeklyShip.status, 'SHIPPED')
			));
		return result[0]?.count ?? 0;
	},

	/**
	 * Get all ships for a user across the entire season.
	 */
	async getUserSeasonShips(userId: string, seasonId: string): Promise<(WeeklyShip & { workshop: typeof workshop.$inferSelect | null })[]> {
		return db.query.weeklyShip.findMany({
			where: and(
				eq(weeklyShip.userId, userId),
				eq(weeklyShip.seasonId, seasonId)
			),
			with: { workshop: true },
			orderBy: [asc(weeklyShip.weekNumber), asc(weeklyShip.createdAt)]
		});
	},

	/**
	 * Get ship stats for a user in a season.
	 */
	async getUserShipStats(userId: string, seasonId: string) {
		const ships = await db.select({
			status: weeklyShip.status,
			count: sql<number>`count(*)::int`
		})
			.from(weeklyShip)
			.where(and(
				eq(weeklyShip.userId, userId),
				eq(weeklyShip.seasonId, seasonId)
			))
			.groupBy(weeklyShip.status);

		const stats = {
			planned: 0,
			inProgress: 0,
			shipped: 0,
			missed: 0,
			total: 0
		};

		for (const s of ships) {
			const count = s.count;
			stats.total += count;
			switch (s.status) {
				case 'PLANNED':
					stats.planned = count;
					break;
				case 'IN_PROGRESS':
					stats.inProgress = count;
					break;
				case 'SHIPPED':
					stats.shipped = count;
					break;
				case 'MISSED':
					stats.missed = count;
					break;
			}
		}

		return stats;
	},

	/**
	 * Get ships tied to a specific workshop.
	 */
	async getWorkshopShips(workshopId: string): Promise<(WeeklyShip & { user: typeof user.$inferSelect })[]> {
		return db.query.weeklyShip.findMany({
			where: eq(weeklyShip.workshopId, workshopId),
			with: { user: true },
			orderBy: [desc(weeklyShip.createdAt)]
		});
	}
};
