import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Screen } from '../../../components/ui/Screen';
import { GlassCard } from '../../../components/ui/GlassCard';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { Placeholder } from '../../../components/ui/Placeholder';
import { useAuth } from '../../../lib/auth';
import { relativeTime } from '../../../lib/data';
import { qk } from '../../../lib/queries/keys';
import {
  useNotifications,
  unreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationRow,
} from '../../../lib/queries/settings';
import { theme } from '../../../lib/theme';

export default function NotificationsScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;

  // SessionGate makes this unreachable in practice; it just needs to not crash.
  // The list lives in its own component so its hooks are never conditional.
  if (!userId) return <Placeholder title="Notifications" />;

  return <NotificationsList userId={userId} onBack={() => router.back()} />;
}

function NotificationsList({ userId, onBack }: { userId: string; onBack: () => void }) {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useNotifications(userId);
  const rows = data ?? [];
  const unread = unreadCount(rows);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: qk.notifications(userId) });
  }

  const readOne = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: invalidate,
    onError: (e: Error) => Alert.alert('Could not mark as read', e.message),
  });

  const readAll = useMutation({
    mutationFn: () => markAllNotificationsRead(userId),
    onSuccess: invalidate,
    onError: (e: Error) => Alert.alert('Could not mark all as read', e.message),
  });

  return (
    <Screen>
      <FlatList
        contentContainerStyle={styles.list}
        data={rows}
        keyExtractor={(n) => n.id}
        ListHeaderComponent={
          <ScreenHeader
            title="Notifications"
            subtitle={unread > 0 ? `${unread} unread` : undefined}
            onBack={onBack}
            right={
              unread > 0 ? (
                <Pressable
                  onPress={() => {
                    if (!readAll.isPending) readAll.mutate();
                  }}
                  hitSlop={10}
                >
                  <Text style={styles.action}>Mark all read</Text>
                </Pressable>
              ) : undefined
            }
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <Text style={styles.muted}>Loading…</Text>
          ) : error ? (
            <Text style={styles.error}>{error.message}</Text>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>You're all caught up</Text>
              <Text style={styles.muted}>Notifications appear here as work moves.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <NotificationCard
            notification={item}
            onPress={() => {
              if (!item.is_read && !readOne.isPending) readOne.mutate(item.id);
            }}
          />
        )}
      />
    </Screen>
  );
}

function NotificationCard({
  notification,
  onPress,
}: {
  notification: NotificationRow;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <GlassCard>
        <View style={styles.rowTop}>
          {!notification.is_read ? <View style={styles.dot} /> : null}
          <Text
            style={[styles.title, notification.is_read && styles.titleRead]}
            numberOfLines={2}
          >
            {notification.title}
          </Text>
        </View>
        <Text style={styles.body}>{notification.body}</Text>
        <Text style={styles.meta}>{relativeTime(notification.created_at)}</Text>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { padding: 20, gap: 12, paddingBottom: 140 },
  action: { color: '#fff', fontSize: 14, fontWeight: '600' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.accent },
  title: { color: '#fff', fontSize: 15, fontWeight: '600', flex: 1 },
  titleRead: { color: theme.colors.foreground, fontWeight: '500' },
  body: { color: theme.text.dim, fontSize: 13, marginTop: 6 },
  meta: { color: theme.text.dimmer, fontSize: 11, marginTop: 8 },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 4 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  muted: { color: theme.text.dim, fontSize: 13, textAlign: 'center' },
  error: { color: theme.colors.danger, fontSize: 13, textAlign: 'center', paddingVertical: 40 },
});
