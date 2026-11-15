import { isExecutive } from '@shared/rbac';
import { ExecutiveDashboard } from '../../components/dashboard/ExecutiveDashboard';
import { EmployeeDashboard } from '../../components/dashboard/EmployeeDashboard';
import { Placeholder } from '../../components/ui/Placeholder';
import { useAuth } from '../../lib/auth';

export default function Dashboard() {
  const { session, employee } = useAuth();

  // Both variants are keyed on the signed-in user id; without a session there
  // is nothing to query. SessionGate makes this unreachable in practice, so it
  // just needs to not crash.
  if (!session?.user.id) return <Placeholder title="Dashboard" />;
  if (isExecutive(employee?.role ?? 'employee')) return <ExecutiveDashboard userId={session.user.id} />;
  return <EmployeeDashboard userId={session.user.id} />;
}
