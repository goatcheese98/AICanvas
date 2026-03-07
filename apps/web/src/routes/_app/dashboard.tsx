import { createFileRoute } from '@tanstack/react-router';
import { Dashboard } from '@/components/dashboard/Dashboard';

export const Route = createFileRoute('/_app/dashboard')({
	component: DashboardPage,
});

function DashboardPage() {
	return <Dashboard />;
}
