import { isExecutive } from '@shared/rbac';
import { ExecutiveDashboard } from '../../components/dashboard/ExecutiveDashboard';
import { EmployeeDashboard } from '../../components/dashboard/EmployeeDashboard';
import { Placeholder } from '../../components/ui/Placeholder';
import { useAuth } from '../../lib/auth';

export default function Dashboard() {
  const { session, employee } = useAuth();

  if (isExecutive(employee?.role ?? 'employee')) return <ExecutiveDashboard />;
  // The employee variant is keyed entirely on the signed-in user id; without a
  // session there is nothing to query. SessionGate makes this unreachable in
  // practice, so it just needs to not crash.
  if (!session?.user.id) return <Placeholder title="Dashboard" />;
  return <EmployeeDashboard userId={session.user.id} />;
}
