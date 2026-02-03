import { env } from '$env/dynamic/private';
import { db } from './db';
import { programSeason } from './db/schema';
import { eq } from 'drizzle-orm';

/**
 * Season configuration from environment variables.
 *
 * SIMPLE CONFIG - just set this in your .env file:
 *   SEASON_STARTS="2026-01-01"
 *
 * OPTIONAL overrides:
 *   SEASON_NAME="Resolution S1"       (default: "Resolution")
 *   SEASON_SLUG="s1"                  (default: "s1")
 *   SEASON_TOTAL_WEEKS="8"            (default: 8)
 *   SEASON_SIGNUP_BUFFER_DAYS="20"    (default: 20 days before start)
 *
 * All other dates are calculated automatically:
 *   - signupOpensAt = 20 days before startsAt
 *   - signupClosesAt = startsAt
 *   - endsAt = startsAt + (totalWeeks * 7 days)
 */

function getEnvDate(key: string): Date | null {
	const value = env[key];
	if (!value) return null;
	const date = new Date(value);
	return isNaN(date.getTime()) ? null : date;
}

function getEnvNumber(key: string, fallback: number): number {
	const value = env[key];
	if (!value) return fallback;
	const num = parseInt(value, 10);
	return isNaN(num) ? fallback : num;
}

function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
}

export interface SeasonConfig {
	name: string;
	slug: string;
	signupOpensAt: Date;
	signupClosesAt: Date;
	startsAt: Date;
	endsAt: Date;
	totalWeeks: number;
}

/**
 * Get season config from environment variables.
 * Only SEASON_STARTS is required - everything else is derived or has defaults.
 */
export function getSeasonConfigFromEnv(): SeasonConfig | null {
	const startsAt = getEnvDate('SEASON_STARTS');

	if (!startsAt) {
		return null;
	}

	const name = env.SEASON_NAME || 'Resolution';
	const slug = env.SEASON_SLUG || 's1';
	const totalWeeks = getEnvNumber('SEASON_TOTAL_WEEKS', 8);
	const signupBufferDays = getEnvNumber('SEASON_SIGNUP_BUFFER_DAYS', 20);

	const signupOpensAt = addDays(startsAt, -signupBufferDays);
	const signupClosesAt = startsAt;
	const endsAt = addDays(startsAt, totalWeeks * 7);

	return {
		name,
		slug,
		signupOpensAt,
		signupClosesAt,
		startsAt,
		endsAt,
		totalWeeks
	};
}

/**
 * Ensure the season from env exists in the database.
 * Creates or updates the season record.
 * Call this on app startup or in a hook.
 */
export async function ensureSeasonFromEnv() {
	const config = getSeasonConfigFromEnv();
	if (!config) {
		console.warn('Season not configured. Set SEASON_STARTS in .env');
		return null;
	}

	const existing = await db.query.programSeason.findFirst({
		where: eq(programSeason.slug, config.slug)
	});

	let season;
	if (existing) {
		const [updated] = await db.update(programSeason)
			.set({
				name: config.name,
				signupOpensAt: config.signupOpensAt,
				signupClosesAt: config.signupClosesAt,
				startsAt: config.startsAt,
				endsAt: config.endsAt,
				totalWeeks: config.totalWeeks,
				isActive: true
			})
			.where(eq(programSeason.slug, config.slug))
			.returning();
		season = updated;
	} else {
		const [created] = await db.insert(programSeason)
			.values({
				name: config.name,
				slug: config.slug,
				signupOpensAt: config.signupOpensAt,
				signupClosesAt: config.signupClosesAt,
				startsAt: config.startsAt,
				endsAt: config.endsAt,
				totalWeeks: config.totalWeeks,
				isActive: true
			})
			.returning();
		season = created;
	}

	console.log(`Season "${season.name}" synced (starts: ${config.startsAt.toDateString()}, ends: ${config.endsAt.toDateString()})`);
	return season;
}

/**
 * Get the active season (from DB, synced from env).
 */
export async function getActiveSeason() {
	return db.query.programSeason.findFirst({
		where: eq(programSeason.isActive, true)
	});
}
