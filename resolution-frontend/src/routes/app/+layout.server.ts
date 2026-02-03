import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { db } from '$lib/server/db';
import { programSeason, programEnrollment } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user || !locals.session) {
		throw redirect(302, '/api/auth/login');
	}

	const activeSeason = await db.query.programSeason.findFirst({
		where: eq(programSeason.isActive, true)
	});

	const enrollment = activeSeason
		? await db.query.programEnrollment.findFirst({
				where: and(
					eq(programEnrollment.userId, locals.user.id),
					eq(programEnrollment.seasonId, activeSeason.id),
					eq(programEnrollment.status, 'ACTIVE')
				)
			})
		: null;

	return {
		user: locals.user,
		season: activeSeason,
		enrollment
	};
};
