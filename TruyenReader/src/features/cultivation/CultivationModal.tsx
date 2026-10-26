import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loadCultivation } from '../../data/cultivation';
import { fold } from '../../domain/book-format';
import type { CultivationGuide } from '../../domain/cultivation';
import { MotionPressable as Pressable } from '../../ui/motion';
import { IconButton } from '../../ui/primitives';
import type { Palette } from '../../ui/theme';

export function CultivationModal({
  bookId,
  palette: p,
  onClose,
}: {
  bookId: string;
  palette: Palette;
  onClose: () => void;
}) {
  const [result, setResult] = useState<{ guide: CultivationGuide; offline: boolean }>();
  const [selected, setSelected] = useState(''),
    [query, setQuery] = useState(''),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    loadCultivation(bookId)
      .then((value) => {
        if (active) {
          setResult(value);
          setSelected(value.guide.systems[0]?.id || '');
        }
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
    };
  }, [bookId]);
  const system = result?.guide.systems.find((s) => s.id === selected);
  const needle = fold(query.trim());
  const entries =
    system?.realms.filter((realm) =>
      fold([realm.name, ...realm.aliases, realm.branch, realm.detail].join(' ')).includes(needle),
    ) || [];
  async function openSource(url: string) {
    if (!url.startsWith('https://')) return;
    try {
      await Linking.openURL(url);
    } catch {
      setError('Không mở được trình duyệt.');
    }
  }
  return (
    <Modal animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[s.page, { backgroundColor: p.bg }]}>
        <View style={[s.header, { borderColor: p.line }]}>
          <Text accessibilityRole="header" style={[s.title, { color: p.text }]}>
            Cảnh giới Đế Bá
          </Text>
          <IconButton name="close" label="Đóng cảnh giới" color={p.accent} onPress={onClose} />
        </View>
        {!result && !error && <ActivityIndicator color={p.accent} />}
        {error ? (
          <Text accessibilityRole="alert" style={{ color: p.text, padding: 16 }}>
            {error}
          </Text>
        ) : null}
        {result && (
          <FlatList
            data={entries}
            keyExtractor={(realm) => realm.id}
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <>
                <Text style={[s.paragraph, { color: p.muted }]}>{result.guide.intro}</Text>
                <Text style={{ color: p.accent }}>
                  {result.offline ? 'Bản lưu ngoại tuyến' : 'Đã tải từ thư viện'} ·{' '}
                  {result.guide.updated_at}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabs}>
                  {result.guide.systems.map((group) => (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: group.id === selected }}
                      key={group.id}
                      onPress={() => {
                        setSelected(group.id);
                        setQuery('');
                      }}
                      style={[
                        s.tab,
                        {
                          backgroundColor: group.id === selected ? p.accent : p.card,
                          borderColor: p.line,
                        },
                      ]}
                    >
                      <Text style={{ color: group.id === selected ? p.bg : p.text }}>
                        {group.title}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <TextInput
                  accessibilityLabel="Tìm cảnh giới"
                  placeholder="Tìm cảnh giới hoặc tên khác…"
                  placeholderTextColor={p.muted}
                  value={query}
                  onChangeText={setQuery}
                  style={[
                    s.search,
                    { color: p.text, borderColor: p.line, backgroundColor: p.card },
                  ]}
                />
                <Text accessibilityRole="header" style={[s.title, { color: p.text }]}>
                  {system?.title}
                </Text>
                <Text style={{ color: p.accent, marginVertical: 8 }}>{system?.verification}</Text>
                <Text style={[s.paragraph, { color: p.muted }]}>{system?.summary}</Text>
              </>
            }
            renderItem={({ item }) => (
              <View style={[s.card, { backgroundColor: p.card, borderColor: p.line }]}>
                <Text style={{ color: p.accent, fontSize: 11 }}>
                  {item.branch.toLocaleUpperCase('vi-VN')}
                </Text>
                <Text style={[s.realm, { color: p.text }]}>{item.name}</Text>
                {item.aliases.length ? (
                  <Text style={{ color: p.muted }}>Tên khác: {item.aliases.join(' · ')}</Text>
                ) : null}
                {item.detail ? (
                  <Text style={[s.paragraph, { color: p.text }]}>{item.detail}</Text>
                ) : null}
                {result.guide.sources
                  .filter((source) => item.source_ids.includes(source.id))
                  .map((source) => (
                    <Pressable
                      key={source.id}
                      accessibilityRole="link"
                      onPress={() => void openSource(source.url)}
                    >
                      <Text style={[s.link, { color: p.accent }]}>
                        {source.kind === 'novel' ? source.title : 'Bài tham khảo'}
                      </Text>
                    </Pressable>
                  ))}
              </View>
            )}
            ListEmptyComponent={
              <Text style={{ color: p.muted }}>Không tìm thấy cảnh giới phù hợp.</Text>
            }
            ListFooterComponent={
              <View style={s.footer}>
                <Text style={[s.paragraph, { color: p.muted }]}>{result.guide.source_note}</Text>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => void openSource('https://thuvienanime.net/de-ba/')}
                >
                  <Text style={[s.link, { color: p.accent }]}>
                    Nguồn tham khảo · Thư Viện Anime
                  </Text>
                </Pressable>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
const s = StyleSheet.create({
  page: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  title: { flex: 1, fontSize: 22, fontWeight: '600' },
  content: { padding: 20, paddingBottom: 40 },
  paragraph: { fontSize: 14, lineHeight: 23, marginVertical: 10 },
  tabs: { marginVertical: 16 },
  tab: { padding: 12, borderWidth: 1, borderRadius: 10, marginRight: 8 },
  search: { padding: 12, borderWidth: 1, borderRadius: 10, marginBottom: 20 },
  card: { padding: 18, borderWidth: 1, borderRadius: 14, marginVertical: 6 },
  realm: { fontSize: 18, fontWeight: '600', marginVertical: 8 },
  link: { fontSize: 12, textDecorationLine: 'underline', paddingVertical: 6 },
  footer: { marginTop: 18 },
});
