import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CHAPTER_PAGE_SIZE, getChapterPage, type Book, type ChapterMeta } from '../../data/library';
import { Entrance, MotionPressable as Pressable, useReducedMotion } from '../../ui/motion';
type Palette = {
  bg: string;
  card: string;
  text: string;
  muted: string;
  line: string;
  accent: string;
  soft: string;
};
export function TocModal({
  visible,
  book,
  currentId,
  initialPosition,
  palette: p,
  onClose,
  onSelect,
}: {
  visible: boolean;
  book: Book;
  currentId?: string;
  initialPosition: number;
  palette: Palette;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const reducedMotion = useReducedMotion();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [marked, setMarked] = useState(false);
  const [page, setPage] = useState(() => Math.floor(initialPosition / CHAPTER_PAGE_SIZE));
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    rows: ChapterMeta[];
    total: number;
    error: string;
  }>({ key: '', rows: [], total: 0, error: '' });
  const list = useRef<FlatList<ChapterMeta>>(null);
  const bookId = book.id;
  const requestKey = JSON.stringify([bookId, debounced, marked, page, retry]);
  const busy = visible && result.key !== requestKey;
  const { rows, total, error } = result;
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    if (!visible) return;
    let active = true;
    getChapterPage(bookId, debounced, marked, page)
      .then((data) => {
        if (!active) return;
        if (data.total && page >= Math.ceil(data.total / CHAPTER_PAGE_SIZE)) {
          setPage(0);
          return;
        }
        setResult({ key: requestKey, rows: data.rows, total: data.total, error: '' });
      })
      .catch((e) => {
        if (active)
          setResult({
            key: requestKey,
            rows: [],
            total: 0,
            error: e instanceof Error ? e.message : String(e),
          });
      });
    return () => {
      active = false;
    };
  }, [visible, bookId, debounced, marked, page, requestKey]);
  const pages = Math.max(1, Math.ceil(total / CHAPTER_PAGE_SIZE));
  return (
    <Modal
      visible={visible}
      animationType={reducedMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }}>
        <View style={[s.header, { borderColor: p.line }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.eyebrow, { color: p.accent }]}>KHÁM PHÁ CÂU CHUYỆN</Text>
            <Text style={{ color: p.text, fontSize: 26, fontWeight: '600', marginTop: 7 }}>
              Mục lục
            </Text>
            <Text numberOfLines={1} style={{ color: p.muted, fontSize: 13, marginTop: 5 }}>
              {book?.title}
            </Text>
          </View>
          <Pressable accessibilityLabel="Đóng mục lục" onPress={onClose} style={s.button}>
            <Ionicons name="close" size={25} color={p.accent} />
          </Pressable>
        </View>
        <View style={[s.search, { backgroundColor: p.card, borderColor: p.line }]}>
          <Ionicons name="search" size={20} color={p.muted} />
          <TextInput
            value={query}
            onChangeText={(text) => {
              setQuery(text);
              setPage(0);
            }}
            placeholder="Tên hoặc số chương…"
            placeholderTextColor={p.muted}
            autoCorrect={false}
            style={{ flex: 1, color: p.text, fontSize: 16, paddingVertical: 13 }}
          />
          {query !== '' && (
            <Pressable
              accessibilityLabel="Xóa tìm kiếm"
              onPress={() => {
                setQuery('');
                setPage(0);
              }}
            >
              <Ionicons name="close-circle" size={20} color={p.muted} />
            </Pressable>
          )}
        </View>
        <View style={s.filter}>
          <Text style={{ color: p.muted, fontSize: 13 }}>
            {total.toLocaleString('vi-VN')} mục · {CHAPTER_PAGE_SIZE} mục/trang
          </Text>
          <Pressable
            accessibilityRole="togglebutton"
            accessibilityState={{ checked: marked }}
            accessibilityLabel="Chỉ hiện chương đã lưu"
            onPress={() => {
              setMarked((v) => !v);
              setPage(0);
            }}
            style={[s.chip, { backgroundColor: marked ? p.accent : p.soft }]}
          >
            <Ionicons name="bookmark-outline" size={14} color={marked ? p.bg : p.accent} />
            <Text style={{ color: marked ? p.bg : p.accent, fontSize: 12 }}>Đã lưu</Text>
          </Pressable>
        </View>
        {busy ? (
          <View style={s.center}>
            <ActivityIndicator color={p.accent} />
            <Text style={{ color: p.muted, marginTop: 12 }}>Đang mở trang {page + 1}…</Text>
          </View>
        ) : error ? (
          <View style={s.center}>
            <Text style={{ color: p.text, textAlign: 'center' }}>{error}</Text>
            <Pressable
              onPress={() => {
                setPage(0);
                setRetry((n) => n + 1);
              }}
              style={s.button}
            >
              <Text style={{ color: p.accent }}>Về trang đầu</Text>
            </Pressable>
          </View>
        ) : (
          <Entrance key={requestKey} style={{ flex: 1 }}>
            <FlatList
              ref={list}
              data={rows}
              keyExtractor={(c) => c.id}
              keyboardShouldPersistTaps="handled"
              initialNumToRender={12}
              maxToRenderPerBatch={12}
              windowSize={5}
              ListEmptyComponent={
                <Text style={{ color: p.muted, textAlign: 'center', padding: 32 }}>
                  Không tìm thấy chương phù hợp.
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onSelect(item.id)}
                  accessibilityLabel={`${item.title}${currentId === item.id ? ', đang đọc' : ''}`}
                  accessibilityState={{ selected: currentId === item.id }}
                  style={[
                    s.row,
                    {
                      borderColor: p.line,
                      borderLeftColor: currentId === item.id ? p.accent : 'transparent',
                      backgroundColor: currentId === item.id ? p.soft : 'transparent',
                    },
                  ]}
                >
                  <View
                    style={[
                      s.position,
                      {
                        backgroundColor: currentId === item.id ? p.accent : p.card,
                        borderColor: p.line,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: currentId === item.id ? p.bg : p.muted,
                        fontSize: 11,
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {item.position + 1}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    {currentId === item.id && (
                      <Text style={[s.currentLabel, { color: p.accent }]}>ĐANG ĐỌC</Text>
                    )}
                    <Text
                      style={{
                        color: p.text,
                        fontSize: 15,
                        lineHeight: 23,
                        fontWeight: currentId === item.id ? '600' : '400',
                      }}
                    >
                      {item.title}
                    </Text>
                  </View>
                  <Ionicons
                    name={item.marked ? 'bookmark' : 'chevron-forward'}
                    size={16}
                    color={p.accent}
                  />
                </Pressable>
              )}
            />
          </Entrance>
        )}
        <View style={[s.pagination, { backgroundColor: p.card, borderColor: p.line }]}>
          <Pressable
            disabled={page === 0 || busy}
            onPress={() => setPage((n) => n - 1)}
            accessibilityLabel="Trang mục lục trước"
            style={[
              s.pageButton,
              { backgroundColor: p.soft, opacity: page === 0 || busy ? 0.35 : 1 },
            ]}
          >
            <Ionicons name="chevron-back" color={p.accent} size={19} />
            <Text style={{ color: p.accent, fontSize: 12, fontWeight: '600' }}>Trước</Text>
          </Pressable>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={[s.eyebrow, { color: p.muted }]}>TRANG</Text>
            <Text
              style={{
                color: p.text,
                fontSize: 14,
                fontWeight: '600',
                fontVariant: ['tabular-nums'],
              }}
            >
              {page + 1} / {pages}
            </Text>
          </View>
          <Pressable
            disabled={page + 1 >= pages || busy}
            onPress={() => setPage((n) => n + 1)}
            accessibilityLabel="Trang mục lục tiếp theo"
            style={[
              s.pageButton,
              { backgroundColor: p.soft, opacity: page + 1 >= pages || busy ? 0.35 : 1 },
            ]}
          >
            <Text style={{ color: p.accent, fontSize: 12, fontWeight: '600' }}>Sau</Text>
            <Ionicons name="chevron-forward" color={p.accent} size={19} />
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
const s = StyleSheet.create({
  header: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 20,
  },
  eyebrow: { fontSize: 8, fontWeight: '700', letterSpacing: 1.4 },
  button: {
    minWidth: 44,
    minHeight: 44,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
  },
  search: {
    marginHorizontal: 20,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  filter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    minHeight: 44,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  row: {
    paddingHorizontal: 17,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  position: {
    width: 42,
    minHeight: 36,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentLabel: { fontSize: 8, letterSpacing: 1.1, fontWeight: '700', marginBottom: 4 },
  pagination: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 84,
    minHeight: 44,
    gap: 5,
    padding: 10,
    borderRadius: 5,
  },
});
