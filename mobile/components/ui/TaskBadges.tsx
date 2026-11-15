import { View } from 'react-native';
import type { TaskPriority } from '@shared/types';
import { DEPT_COLORS, PRIORITY_LABELS } from '@shared/rbac';
import { tierLabel } from '@shared/graphics';
import { PRIORITY_COLORS } from '../../lib/theme';
import { Badge } from './Badge';

/** Priority, plus Basic / Premium for Graphic Design tasks. */
export function TaskBadges({ priority, tier }: { priority: TaskPriority; tier?: string | null }) {
  const t = tierLabel(tier);
  return (
    <View style={{ flexDirection: 'row', gap: 6, flexShrink: 0 }}>
      {t && <Badge label={t} color={DEPT_COLORS.graphics} />}
      <Badge label={PRIORITY_LABELS[priority]} color={PRIORITY_COLORS[priority]} />
    </View>
  );
}
