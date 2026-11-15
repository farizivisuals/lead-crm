import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ROLE_LABELS } from '@shared/rbac';
import { kuwaitToday, loadLevel, loadWorkload, rowsForTeam, WORKLOAD_TEAMS, type WorkloadRow } from '@shared/workload';
import { Screen } from '../../../components/ui/Screen';
import { GlassCard } from '../../../components/ui/GlassCard';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { qk } from '../../../lib/queries/keys';
import { supabase } from '../../../lib/supabase';
import { theme } from '../../../lib/theme';

const LEVEL_COLOR = { low: theme.colors.success, mid: theme.colors.warning, high: theme.colors.danger };

/** Executives: how booked everyone is this month (web parity: /admin/workload). */
export default function WorkloadScreen() {
  const router = useRouter();
  const [y0, m0] = kuwaitToday().split('-').map(Number);
  const [{ year, month }, setYm] = useState({ year: y0!, month: m0! - 1 });
  const [team, setTeam] = useState<(typeof WORKLOAD_TEAMS)[number]>(WORKLOAD_TEAMS[0]);
  const { data, isLoading, error } = useQuery({
    queryKey: qk.workload(year, month),
    queryFn: () => loadWorkload(supabase, year, month),
  });
  const shift = (by: number) => {
    const d = new Date(Date.UTC(year, month + by, 1));
    setYm({ year: d.getUTCFullYear(), month: d.getUTCMonth() });
  };
  const title = new Date(Date.UTC(year, month, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const total = data?.days.length ?? 0;

  return (
    <Screen>
      <FlatList
        contentContainerStyle={styles.list}
        data={data ? rowsForTeam(data.rows, team) : []}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <ScreenHeader title="Workload" subtitle={`Days booked out of ${total} working days`} onBack={() => router.back()} />
            <View style={styles.monthRow}>
              <Pressable onPress={() => shift(-1)} hitSlop={12}>
                <Text style={styles.arrow}>‹</Text>
              </Pressable>
              <Text style={styles.month}>{title}</Text>
              <Pressable onPress={() => shift(1)} hitSlop={12}>
                <Text style={styles.arrow}>›</Text>
              </Pressable>
            </View>
            <View style={styles.tabs}>
              {WORKLOAD_TEAMS.map((t) => (
                <Pressable
                  key={t.key}
                  onPress={() => setTeam(t)}
                  style={[styles.tab, t.key === team.key && styles.tabOn]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: t.key === team.key }}
                >
                  <Text
                    style={[styles.tabText, t.key === team.key && styles.tabTextOn]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.75}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          <Text style={error ? styles.error : styles.muted}>
            {isLoading ? 'Loading…' : error ? error.message : `No one is in ${team.label} yet. Add people to it from the web app.`}
          </Text>
        }
        renderItem={({ item }) => <WorkloadCard row={item} days={data!.days} />}
        ListFooterComponent={
          data ? <Text style={styles.footer}>Darker squares are days with 2+ tasks. Tasks, videos and clients are what's open right now.</Text> : null
        }
      />
    </Screen>
  );
}

function WorkloadCard({ row, days }: { row: WorkloadRow; days: string[] }) {
  const color = LEVEL_COLOR[loadLevel(row.bookedCount, days.length)];
  const pct = days.length ? (row.bookedCount / days.length) * 100 : 0;
  const today = kuwaitToday();
  return (
    <GlassCard>
      <View style={styles.top}>
        <View style={styles.flex}>
          <Text style={styles.name} numberOfLines={1}>{row.name}</Text>
          <Text style={styles.role}>{ROLE_LABELS[row.role]}</Text>
        </View>
        <Text style={[styles.booked, { color }]}>
          {`${row.bookedCount}/${days.length} days`}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <View style={styles.strip}>
        {days.map((d, i) => (
          <View
            key={d}
            style={[
              styles.day,
              { backgroundColor: row.perDay[i] ? color : 'rgba(255,255,255,0.08)' },
              row.perDay[i] === 1 && styles.light,
              d === today && styles.today,
            ]}
          />
        ))}
      </View>
      <View style={styles.stats}>
        <Stat value={row.tasks} label="Tasks" note={row.creativeTasks ? `${row.creativeTasks} as creative` : undefined} />
        <Stat value={row.videos} label="Videos" />
        <Stat value={row.clients} label="Clients" />
        <Stat value={row.overdue} label="Overdue" alert={row.overdue > 0} />
      </View>
    </GlassCard>
  );
}

function Stat({ value, label, note, alert }: { value: number; label: string; note?: string; alert?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, alert && { color: theme.colors.danger }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {note && <Text style={styles.note}>{note}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 20, gap: 12, paddingBottom: 140 },
  headerWrap: { gap: 12 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 4 },
  arrow: { color: '#fff', fontSize: 26, fontWeight: '300', paddingHorizontal: 8 },
  month: { color: '#fff', fontSize: 15, fontWeight: '600', minWidth: 130, textAlign: 'center' },
  tabs: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 4 },
  tab: { flex: 1, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 9, alignItems: 'center' },
  tabOn: { backgroundColor: theme.colors.accentSolid },
  tabText: { color: theme.text.dim, fontSize: 13, fontWeight: '600' },
  tabTextOn: { color: theme.colors.accentInk },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  name: { color: '#fff', fontSize: 15, fontWeight: '600' },
  role: { color: theme.text.dim, fontSize: 12, marginTop: 2 },
  booked: { fontSize: 15, fontWeight: '700' },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 12, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  strip: { flexDirection: 'row', gap: 2, marginTop: 8 },
  day: { flex: 1, height: 8, borderRadius: 2 },
  today: { borderWidth: 1, borderColor: '#fff' },
  light: { opacity: 0.5 },
  stats: { flexDirection: 'row', marginTop: 14 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: '#fff', fontSize: 18, fontWeight: '700' },
  statLabel: { color: theme.text.dimmer, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 2 },
  note: { color: '#C4B5FD', fontSize: 10, marginTop: 2 },
  footer: { color: theme.text.dimmer, fontSize: 12, textAlign: 'center', marginTop: 8 },
  muted: { color: theme.text.dim, fontSize: 13, textAlign: 'center', paddingVertical: 24 },
  error: { color: theme.colors.danger, fontSize: 13, textAlign: 'center', paddingVertical: 40 },
});
