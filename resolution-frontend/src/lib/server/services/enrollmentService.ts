import { db } from '../db';
import { programEnrollment, programSeason, user } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export type ProgramRole = 'PARTICIPANT' | 'AMBASSADOR';
export type EnrollmentStatus = 'ACTIVE' | 'DROPPED' | 'COMPLETED';

export type ProgramEnrollment = typeof programEnrollment.$inferSelect;

function computeStartingWeek(
	startsAt: Date,
	totalWeeks: number,
	refDate: Date = new Date()
): number {
	const msPerWeek = 7 * 24 * 60 * 60 * 1000;
	const diffMs = refDate.getTime() - startsAt.getTime();
	const rawWeek = Math.floor(diffMs / msPerWeek) + 1;
	return Math.min(totalWeeks, Math.max(1, rawWeek));
}

function getCurrentWeek(startsAt: Date, totalWeeks: number): number {
	return computeStartingWeek(startsAt, totalWeeks, new Date());
}

export const EnrollmentService = {
	/**
	 * Self-enroll a user as a PARTICIPANT in a season.
	 * Computes startingWeek based on when they join.
	 */
	async enrollParticipant(userId: string, seasonSlug: string): Promise<ProgramEnrollment> {
		const season = await db.query.programSeason.findFirst({
			where: eq(programSeason.slug, seasonSlug)
		});

		if (!season) {
			throw new Error(`Season not found: ${seasonSlug}`);
		}

		const startingWeek = computeStartingWeek(season.startsAt, season.totalWeeks);

		const existing = await db.query.programEnrollment.findFirst({
			where: and(
				eq(programEnrollment.userId, userId),
				eq(programEnrollment.seasonId, season.id),
				eq(programEnrollment.role, 'PARTICIPANT')
			)
		});

		if (existing) {
			const [updated] = await db.update(programEnrollment)
				.set({ status: 'ACTIVE' })
				.where(eq(programEnrollment.id, existing.id))
				.returning();
			return updated;
		}

		const [created] = await db.insert(programEnrollment)
			.values({
				userId,
				seasonId: season.id,
				role: 'PARTICIPANT',
				startingWeek
			})
			.returning();
		return created;
	},

	/**
	 * Add or reactivate an AMBASSADOR for a season.
	 * Called by admin script after application is accepted.
	 */
	async upsertAmbassador(
		email: string,
		seasonSlug: string,
		acceptedAt: Date = new Date()
	): Promise<ProgramEnrollment> {
		const [foundUser, season] = await Promise.all([
			db.query.user.findFirst({ where: eq(user.email, email) }),
			db.query.programSeason.findFirst({ where: eq(programSeason.slug, seasonSlug) })
		]);

		if (!foundUser) throw new Error(`User not found: ${email}`);
		if (!season) throw new Error(`Season not found: ${seasonSlug}`);

		const startingWeek = computeStartingWeek(season.startsAt, season.totalWeeks, acceptedAt);

		const existing = await db.query.programEnrollment.findFirst({
			where: and(
				eq(programEnrollment.userId, foundUser.id),
				eq(programEnrollment.seasonId, season.id),
				eq(programEnrollment.role, 'AMBASSADOR')
			)
		});

		if (existing) {
			const [updated] = await db.update(programEnrollment)
				.set({ status: 'ACTIVE' })
				.where(eq(programEnrollment.id, existing.id))
				.returning();
			return updated;
		}

		const [created] = await db.insert(programEnrollment)
			.values({
				userId: foundUser.id,
				seasonId: season.id,
				role: 'AMBASSADOR',
				startingWeek
			})
			.returning();
		return created;
	},

	/**
	 * Get all enrollments for a user in a specific season.
	 */
	async getUserSeasonEnrollments(userId: string, seasonSlug: string): Promise<ProgramEnrollment[]> {
		const season = await db.query.programSeason.findFirst({
			where: eq(programSeason.slug, seasonSlug)
		});

		if (!season) throw new Error(`Season not found: ${seasonSlug}`);

		return db.query.programEnrollment.findMany({
			where: and(
				eq(programEnrollment.userId, userId),
				eq(programEnrollment.seasonId, season.id)
			)
		});
	},

	/**
	 * Check if user has a specific role in a season.
	 * Single indexed lookup - very fast.
	 */
	async hasRole(userId: string, seasonId: string, role: ProgramRole): Promise<boolean> {
		const enrollment = await db.query.programEnrollment.findFirst({
			where: and(
				eq(programEnrollment.userId, userId),
				eq(programEnrollment.seasonId, seasonId),
				eq(programEnrollment.role, role)
			),
			columns: { status: true }
		});

		return !!enrollment && enrollment.status === 'ACTIVE';
	},

	/**
	 * Convenience: check if user is an active ambassador.
	 */
	async isAmbassador(userId: string, seasonId: string): Promise<boolean> {
		return this.hasRole(userId, seasonId, 'AMBASSADOR');
	},

	/**
	 * Convenience: check if user is an active participant.
	 */
	async isParticipant(userId: string, seasonId: string): Promise<boolean> {
		return this.hasRole(userId, seasonId, 'PARTICIPANT');
	},

	/**
	 * Get current week number for a season.
	 */
	async getCurrentSeasonWeek(seasonSlug: string): Promise<number> {
		const season = await db.query.programSeason.findFirst({
			where: eq(programSeason.slug, seasonSlug)
		});

		if (!season) throw new Error(`Season not found: ${seasonSlug}`);

		return getCurrentWeek(season.startsAt, season.totalWeeks);
	},

	/**
	 * Drop a user from a season (set status to DROPPED).
	 */
	async dropEnrollment(
		userId: string,
		seasonId: string,
		role: ProgramRole
	): Promise<ProgramEnrollment | null> {
		const existing = await db.query.programEnrollment.findFirst({
			where: and(
				eq(programEnrollment.userId, userId),
				eq(programEnrollment.seasonId, seasonId),
				eq(programEnrollment.role, role)
			)
		});

		if (!existing) return null;

		const [updated] = await db.update(programEnrollment)
			.set({ status: 'DROPPED' })
			.where(eq(programEnrollment.id, existing.id))
			.returning();
		return updated;
	}
};
