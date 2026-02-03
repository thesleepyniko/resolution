import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { userPathway } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { redirect, error } from '@sveltejs/kit';

const pathwayCurators: Record<string, string> = {
	PYTHON: 'Niko Yu',
	WEB_DEV: 'Mahad Kalam',
	GAME_DEV: 'Safia Ezzahir',
	HARDWARE: 'Rudy Payaal',
	DESIGN: 'Hack Club',
	GENERAL_CODING: 'Hack Club'
};

const validPathways = ['PYTHON', 'WEB_DEV', 'GAME_DEV', 'HARDWARE', 'DESIGN', 'GENERAL_CODING'] as const;

export const load: PageServerLoad = async ({ params, parent }) => {
	const { user } = await parent();
	const pathwayId = params.pathway.toUpperCase();

	if (!validPathways.includes(pathwayId as typeof validPathways[number])) {
		throw error(404, 'Pathway not found');
	}

	const userPathwayRecord = await db
		.select()
		.from(userPathway)
		.where(and(eq(userPathway.userId, user.id), eq(userPathway.pathway, pathwayId as typeof validPathways[number])))
		.limit(1);

	if (userPathwayRecord.length === 0) {
		throw redirect(302, '/app');
	}

	return {
		pathwayId,
		curator: pathwayCurators[pathwayId] || 'Unknown'
	};
};
