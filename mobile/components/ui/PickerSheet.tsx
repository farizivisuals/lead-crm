import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import { BlurView } from 'expo-blur';
import { theme } from '../../lib/theme';

export type PickerOption = {
  value: string;
  label: string;
  sublabel?: string;
  color?: string;
};

export function PickerSheet({
  visible,
  title,
  options,
  selected,
  searchable = false,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: PickerOption[];
  selected?: string | null;
  searchable?: boolean;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? options.filter((o) => o.label.toLowerCase().includes(needle))
    : options;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.sheetInner}>
          <Text style={styles.title}>{title}</Text>
          {searchable && (
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor={theme.text.dimmer}
              autoCapitalize="none"
              style={styles.search}
            />
          )}
          <FlatList
            data={shown}
            keyExtractor={(o) => o.value}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.empty}>No matches</Text>}
            renderItem={({ item }) => (
              <Pressable
                style={styles.row}
                onPress={() => {
                  setQuery('');
                  onSelect(item.value);
                }}
              >
                {item.color ? (
                  <View style={[styles.dot, { backgroundColor: item.color }]} />
                ) : null}
                <View style={styles.rowText}>
                  <Text style={styles.label}>{item.label}</Text>
                  {item.sublabel ? (
                    <Text style={styles.sublabel}>{item.sublabel}</Text>
                  ) : null}
                </View>
                {selected === item.value && (
                  <SymbolView name="checkmark" tintColor="#fff" size={16} />
                )}
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    maxHeight: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: theme.colors.borderMd,
    overflow: 'hidden',
    backgroundColor: theme.colors.background,
  },
  sheetInner: { padding: 20, paddingBottom: 36, gap: 12 },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },
  search: {
    height: 40,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    color: '#fff',
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  rowText: { flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { color: theme.colors.foreground, fontSize: 15 },
  sublabel: { color: theme.text.dim, fontSize: 12, marginTop: 2 },
  empty: { color: theme.text.dimmer, fontSize: 13, paddingVertical: 16 },
});
