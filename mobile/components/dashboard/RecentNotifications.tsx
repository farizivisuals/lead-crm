import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { GlassCard } from '../ui/GlassCard';
import { relativeTime } from '../../lib/data';
import { routeForNotification } from '../../lib/push';
import { markNotificationRead, unreadCount, useNotifications } from '../../lib/queries/settings';
import { theme } from '../../lib/theme';

/** Dashboard card: the latest few notifications; "See all" opens the full list. */
export function RecentNotifications({ userId, limit = 4 }: { userId: string; limit?: number }) {
  const router = useRouter();
  const { data, refetch } = useNotifications(userId);
  const rows = data ?? [];

  // A push that lands while the app is open should show up here straight away.
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(() => void refetch());
    return () => sub.remove();
  }, [refetch]);

  const unread = unreadCount(rows);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.title}>Notifications{unread > 0 ? ` · ${unread} new` : ''}</Text>
        <Pressable onPress={() => router.push('/settings/notifications')} hitSlop={10}>
          <Text style={styles.link}>See all</Text>
        </Pressable>
      </View>
      <GlassCard>
        {rows.length === 0 ? (
          <Text style={styles.muted}>Nothing yet. Changes to your tasks show up here.</Text>
        ) : (
          rows.slice(0, limit).map((n, i) => (
            <Pressable
              key={n.id}
              onPress={() => {
                if (!n.is_read) void markNotificationRead(n.id).then(() => refetch());
                const route = routeForNotification(n.entity_type, n.entity_id, 'employee');
                if (route) router.push(route as never);
              }}
              style={[styles.row, i > 0 && styles.rowBorder]}
            >
              <View style={[styles.dot, n.is_read && styles.dotRead]} />
              <View style={styles.flex}>
                <Text style={[styles.rowTitle, n.is_read && styles.read]} numberOfLines={1}>
                  {n.title}
                </Text>
                <Text style={styles.body} numberOfLines={2}>
                  {n.body}
                </Text>
              </View>
              <Text style={styles.time}>{relativeTime(n.created_at)}</Text>
            </Pressable>
          ))
        )}
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginTop: 12 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#fff', fontSize: 15, fontWeight: '600' },
  link: { color: theme.colors.accent, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 10, paddingVertical: 8 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.accent, marginTop: 6 },
  dotRead: { backgroundColor: 'transparent' },
  flex: { flex: 1 },
  rowTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  read: { color: theme.text.dim, fontWeight: '400' },
  body: { color: theme.text.dim, fontSize: 12, marginTop: 2 },
  time: { color: theme.text.dimmer, fontSize: 11, marginTop: 2 },
  muted: { color: theme.text.dim, fontSize: 13 },
});
