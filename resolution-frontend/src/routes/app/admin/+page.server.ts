import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { user, programEnrollment, workshopCompletion, weeklyShip, programSeason } from '$lib/server/db/schema';
import { eq, count, sql, desc } from 'drizzle-orm';
import { error, fail } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ parent }) => {
	const { user: currentUser } = await parent();

	if (!currentUser.isAdmin) {
		throw error(403, 'Access denied');
	}

	const [users, analytics] = await Promise.all([
		db
			.select({
				id: user.id,
				email: user.email,
				firstName: user.firstName,
				lastName: user.lastName,
				slackId: user.slackId,
				isAdmin: user.isAdmin,
				yswsEligible: user.yswsEligible,
				createdAt: user.createdAt
			})
			.from(user)
			.orderBy(desc(user.createdAt)),

		Promise.all([
			db.select({ count: count() }).from(user),
			db.select({ count: count() }).from(programEnrollment).where(eq(programEnrollment.status, 'ACTIVE')),
			db.select({ count: count() }).from(workshopCompletion).where(sql`${workshopCompletion.completedAt} IS NOT NULL`),
			db.select({ count: count() }).from(weeklyShip).where(eq(weeklyShip.status, 'SHIPPED'))
		])
	]);

	return {
		users,
		analytics: {
			totalUsers: analytics[0][0].count,
			activeEnrollments: analytics[1][0].count,
			completedWorkshops: analytics[2][0].count,
			shippedProjects: analytics[3][0].count
		}
	};
};

export const actions: Actions = {
	toggleAdmin: async ({ request, locals }) => {
		if (!locals.user?.isAdmin) {
			return fail(403, { error: 'Access denied' });
		}

		const formData = await request.formData();
		const userId = formData.get('userId') as string;

		if (!userId) {
			return fail(400, { error: 'User ID required' });
		}

		if (userId === locals.user.id) {
			return fail(400, { error: 'Cannot modify your own admin status' });
		}

		const targetUser = await db.query.user.findFirst({
			where: eq(user.id, userId)
		});

		if (!targetUser) {
			return fail(404, { error: 'User not found' });
		}

		await db
			.update(user)
			.set({ isAdmin: !targetUser.isAdmin })
			.where(eq(user.id, userId));

		return { success: true };
	},

	deleteUser: async ({ request, locals }) => {
		if (!locals.user?.isAdmin) {
			return fail(403, { error: 'Access denied' });
		}

		const formData = await request.formData();
		const userId = formData.get('userId') as string;

		if (!userId) {
			return fail(400, { error: 'User ID required' });
		}

		if (userId === locals.user.id) {
			return fail(400, { error: 'Cannot delete yourself' });
		}

		await db.delete(user).where(eq(user.id, userId));

		return { success: true };
	}
};
