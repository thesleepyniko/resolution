<script lang="ts">
	import type { PageData } from './$types';
	import PlatformBackground from '$lib/components/PlatformBackground.svelte';
	import { enhance } from '$app/forms';

	let { data }: { data: PageData } = $props();

	let searchQuery = $state('');
	let confirmDelete = $state<string | null>(null);

	const filteredUsers = $derived(
		data.users.filter(
			(u) =>
				u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
				(u.firstName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
				(u.lastName?.toLowerCase() || '').includes(searchQuery.toLowerCase())
		)
	);
</script>

<svelte:head>
	<title>Admin - Resolution</title>
</svelte:head>

<PlatformBackground>
	<div class="admin-container">
		<header>
			<div>
				<h1>Admin Dashboard</h1>
				<a href="/app" class="back-link">← Back to App</a>
			</div>
		</header>

		<section class="analytics">
			<div class="stat-card">
				<span class="stat-value">{data.analytics.totalUsers}</span>
				<span class="stat-label">Total Users</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{data.analytics.activeEnrollments}</span>
				<span class="stat-label">Active Enrollments</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{data.analytics.completedWorkshops}</span>
				<span class="stat-label">Completed Workshops</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{data.analytics.shippedProjects}</span>
				<span class="stat-label">Shipped Projects</span>
			</div>
		</section>

		<section class="users-section">
			<div class="users-header">
				<h2>Users ({filteredUsers.length})</h2>
				<input type="text" placeholder="Search users..." bind:value={searchQuery} class="search-input" />
			</div>

			<div class="users-table-wrapper">
				<table class="users-table">
					<thead>
						<tr>
							<th>Name</th>
							<th>Email</th>
							<th>Slack ID</th>
							<th>Admin</th>
							<th>YSWS</th>
							<th>Joined</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each filteredUsers as u (u.id)}
							<tr>
								<td>{u.firstName || ''} {u.lastName || ''}</td>
								<td>{u.email}</td>
								<td>{u.slackId || '-'}</td>
								<td>
									<span class="badge" class:admin={u.isAdmin}>{u.isAdmin ? 'Yes' : 'No'}</span>
								</td>
								<td>
									<span class="badge" class:eligible={u.yswsEligible}>{u.yswsEligible ? 'Yes' : 'No'}</span>
								</td>
								<td>{new Date(u.createdAt).toLocaleDateString()}</td>
								<td class="actions">
									<form method="POST" action="?/toggleAdmin" use:enhance>
										<input type="hidden" name="userId" value={u.id} />
										<button type="submit" class="action-btn">
											{u.isAdmin ? 'Remove Admin' : 'Make Admin'}
										</button>
									</form>
									{#if confirmDelete === u.id}
										<form method="POST" action="?/deleteUser" use:enhance={() => {
											return async ({ update }) => {
												await update();
												confirmDelete = null;
											};
										}}>
											<input type="hidden" name="userId" value={u.id} />
											<button type="submit" class="action-btn danger">Confirm</button>
											<button type="button" class="action-btn" onclick={() => (confirmDelete = null)}>Cancel</button>
										</form>
									{:else}
										<button type="button" class="action-btn danger" onclick={() => (confirmDelete = u.id)}>Delete</button>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	</div>
</PlatformBackground>

<style>
	.admin-container {
		min-height: 100vh;
		padding: 2rem;
		color: #1a1a2e;
	}

	header {
		margin-bottom: 2rem;
	}

	h1 {
		font-size: 1.5rem;
		margin: 0 0 0.5rem;
	}

	h2 {
		font-size: 1.25rem;
		margin: 0;
	}

	.back-link {
		color: #8492a6;
		text-decoration: none;
		font-size: 0.875rem;
	}

	.back-link:hover {
		text-decoration: underline;
	}

	.analytics {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.stat-card {
		background: rgba(255, 255, 255, 0.85);
		border: 1px solid #af98ff;
		border-radius: 12px;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.stat-value {
		font-size: 2rem;
		font-weight: 700;
		color: #338eda;
	}

	.stat-label {
		font-size: 0.875rem;
		color: #8492a6;
		margin-top: 0.5rem;
	}

	.users-section {
		background: rgba(255, 255, 255, 0.85);
		border: 1px solid #af98ff;
		border-radius: 12px;
		padding: 1.5rem;
	}

	.users-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.search-input {
		padding: 0.5rem 1rem;
		border: 1px solid #af98ff;
		border-radius: 8px;
		font-family: inherit;
		min-width: 200px;
	}

	.users-table-wrapper {
		overflow-x: auto;
	}

	.users-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	.users-table th,
	.users-table td {
		text-align: left;
		padding: 0.75rem;
		border-bottom: 1px solid #e0e0e0;
	}

	.users-table th {
		font-weight: 600;
		color: #8492a6;
		white-space: nowrap;
	}

	.badge {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
		background: #f0f0f0;
		color: #8492a6;
	}

	.badge.admin {
		background: #ec3750;
		color: white;
	}

	.badge.eligible {
		background: #33d6a6;
		color: white;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.action-btn {
		padding: 0.375rem 0.75rem;
		font-size: 0.75rem;
		background: rgba(255, 255, 255, 0.8);
		border: 1px solid #af98ff;
		color: #af98ff;
		cursor: pointer;
		border-radius: 6px;
		font-family: inherit;
		white-space: nowrap;
	}

	.action-btn:hover {
		background: rgba(255, 255, 255, 1);
	}

	.action-btn.danger {
		border-color: #ec3750;
		color: #ec3750;
	}

	.action-btn.danger:hover {
		background: #ec3750;
		color: white;
	}
</style>
