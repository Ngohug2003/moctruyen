import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  Image,
  Modal,
  Platform,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cloud } from '../../api/cloud';
import * as db from '../../data/library';
import { parseBookText } from '../../domain/book-format';
import { hasCultivationGuide } from '../../domain/cultivation';
import { Entrance, MotionPressable as Pressable, useReducedMotion } from '../../ui/motion';
import { AccountPanel } from '../account/AccountPanel';
import { CultivationModal } from '../cultivation/CultivationModal';
import { TocModal } from '../reader/TocModal';
import { Cover, IconButton, Loading } from '../../ui/primitives';
import { s } from '../../ui/styles';
import { palettes } from '../../ui/theme';
import { Reader, type ReadingSession } from '../reader/Reader';
export function LibraryScreen() {
  const reducedMotion = useReducedMotion();
  const [cultivationBook, setCultivationBook] = useState<string | null>(null);
  const [books, setBooks] = useState<db.Book[]>([]),
    [saved, setSaved] = useState<db.SavedChapter[]>([]);
  const [settings, setSettings] = useState<db.ReaderSettings>(db.DEFAULT_SETTINGS);
  const [book, setBook] = useState<db.Book | null>(null),
    [chapter, setChapter] = useState<db.Chapter | null>(null);
  const [restore, setRestore] = useState(0);
  const [toc, setToc] = useState(false),
    [prefs, setPrefs] = useState(false);
  const [tab, setTab] = useState<'library' | 'saved'>('library');
  const [busy, setBusy] = useState(''),
    [starting, setStarting] = useState(true);
  const sequence = useRef(0),
    scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const readerSession = useRef<ReadingSession | null>(null);
  const p = palettes[settings.theme];
  const refresh = useCallback(async () => {
    try {
      await Promise.allSettled([cloud.sync(), db.syncRemoteCatalog()]);
    } catch {}
    setBooks(await db.listBooks());
  }, []);
  useEffect(
    () =>
      cloud.subscribe(() => {
        void db.listBooks().then(setBooks);
      }),
    [],
  );
  const closeReader = useCallback(async () => {
    const request = ++sequence.current;
    await readerSession.current?.save();
    if (request !== sequence.current) return;
    setChapter(null);
    setBook(null);
    setBusy('');
    await refresh();
  }, [refresh]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void cloud.sync().then(refresh);
    });
    return () => sub.remove();
  }, [refresh]);
  useEffect(() => {
    if (tab === 'saved')
      void db
        .listBookmarks()
        .then(setSaved)
        .catch((e) => Alert.alert('Chưa mở được dấu trang', errorMessage(e)));
  }, [tab, books]);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [items, readerSettings] = await Promise.all([db.listBooks(), db.loadSettings()]);
        if (!active) return;
        setBooks(items);
        setSettings(readerSettings);
        setStarting(false);

        // Prioritize API: sync catalog and user progress from API
        await Promise.allSettled([cloud.sync(), db.syncRemoteCatalog()]);
        const updated = await db.listBooks();
        if (active) setBooks(updated);
      } catch (e) {
        if (active) {
          setStarting(false);
          Alert.alert('Không mở được thư viện', errorMessage(e));
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!chapter) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      void closeReader();
      return true;
    });
    return () => sub.remove();
  }, [chapter, closeReader]);
  async function openChapter(b: db.Book, id: string, offset = 0) {
    const request = ++sequence.current;
    setBusy('Đang mở chương…');
    try {
      await readerSession.current?.save();
      const row = await db.getChapter(b.id, id);
      if (request !== sequence.current) return;
      if (!row) throw new Error('Không tìm thấy chương trong thư viện.');
      setBook(b);
      setRestore(offset);
      setChapter(row);
      setToc(false);
    } catch (e) {
      Alert.alert('Chưa mở được chương', errorMessage(e));
    } finally {
      if (request === sequence.current) setBusy('');
    }
  }
  async function openBook(b: db.Book, showList = false) {
    setBusy('Đang mở truyện…');
    try {
      if (cloud.user) {
        try {
          await cloud.sync();
        } catch {}
      }
      const latest = (await db.listBooks()).find((x) => x.id === b.id);
      if (latest) b = latest;
      setBook(b);
      if (showList) {
        setToc(true);
        setBusy('');
        return;
      }
      if (b.chapter_id) {
        const target = await db.getChapter(b.id, b.chapter_id);
        if (target) {
          await openChapter(b, target.id, b.offset || 0);
          return;
        }
      }
      if (b.position != null) {
        const atPos = await db.getChapterAt(b.id, b.position);
        if (atPos) {
          await openChapter(b, atPos.id, b.offset || 0);
          return;
        }
      }
      const first = await db.getChapterAt(b.id, 0);
      if (!first) throw new Error('Truyện chưa có chương.');
      await openChapter(b, first.id);
    } catch (e) {
      setBusy('');
      Alert.alert('Không mở được truyện', errorMessage(e));
    }
  }
  async function navigateChapter(direction: -1 | 1) {
    if (!book || !chapter) return;
    try {
      const next = await db.getNeighbor(book.id, chapter.position, direction);
      if (next) await openChapter(book, next.id);
    } catch (e) {
      Alert.alert('Chưa mở được chương', errorMessage(e));
    }
  }
  async function mark() {
    if (!book || !chapter) return;
    try {
      const marked = await db.toggleBookmark(book.id, chapter.id);
      setChapter({ ...chapter, marked: marked ? 1 : 0 });
      await refresh();
    } catch (e) {
      Alert.alert('Chưa lưu được dấu trang', errorMessage(e));
    }
  }
  function updateSettings(next: db.ReaderSettings) {
    setSettings(next);
    void db.saveSettings(next).catch((e) => Alert.alert('Chưa lưu được cài đặt', errorMessage(e)));
  }
  async function importJson() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', 'application/octet-stream'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const file = new File(asset.uri);
      if ((asset.size || file.size || 0) > 64 * 1024 * 1024) {
        Alert.alert(
          'File lớn hơn 64 MB',
          'Hãy chép file này vào C:\\TruyenReader\\input\\truyen.json rồi build APK. Cách đó không cần phân tích JSON lớn trên điện thoại.',
        );
        return;
      }
      setBusy('Đang kiểm tra file JSON…');
      await new Promise((r) => setTimeout(r, 50));
      const normalized = parseBookText(await file.text());
      setBusy(`Đang nhập 0/${normalized.chapters.length} mục…`);
      await db.importBook(normalized, (n) =>
        setBusy(`Đang nhập ${n}/${normalized.chapters.length} mục…`),
      );
      await refresh();
      setTab('library');
      Alert.alert(
        'Đã thêm vào thư viện',
        `${normalized.title}\n${normalized.chapters.length.toLocaleString('vi-VN')} mục, có thể đọc ngoại tuyến.`,
      );
    } catch (e) {
      Alert.alert('Không nhập được file', errorMessage(e));
    } finally {
      setBusy('');
    }
  }
  const continued = books.find((b) => b.chapter_id) || books[0];
  if (starting) return <Loading />;
  return (
    <SafeAreaView
      edges={['top', 'left', 'right', 'bottom']}
      style={{ flex: 1, backgroundColor: p.bg }}
    >
      <StatusBar style={settings.theme === 'night' ? 'light' : 'dark'} />
      {chapter && book ? (
        <Reader
          key={`${book.id}:${chapter.id}`}
          sessionRef={readerSession}
          book={book}
          chapter={chapter}
          settings={settings}
          palette={p}
          initialOffset={restore}
          onBack={() => {
            void closeReader();
          }}
          onToc={() => setToc(true)}
          onSettings={() => setPrefs(true)}
          onCultivation={
            hasCultivationGuide(book.id) ? () => setCultivationBook(book.id) : undefined
          }
          onBookmark={() => void mark()}
          onPrevious={chapter.position > 0 ? () => void navigateChapter(-1) : undefined}
          onNext={chapter.position < book.total - 1 ? () => void navigateChapter(1) : undefined}
        />
      ) : (
        <>
          <View style={[s.header, { borderColor: p.line }]}>
            <View style={s.brand}>
              <Image
                source={require('../../../assets/brand/logo-header.png')}
                style={s.logo}
                accessibilityLabel="Logo Mộc – sách và lá"
              />
              <View>
                <Text style={[s.brandName, { color: p.text }]}>
                  mộc<Text style={{ color: p.accent }}>.</Text>
                </Text>
                <Text style={[s.brandCaption, { color: p.muted }]}>KHÔNG GIAN ĐỌC</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row' }}>
              <AccountPanel onChange={refresh} textColor={p.accent} />
              <IconButton
                name="add-outline"
                label="Nhập truyện JSON"
                color={p.accent}
                onPress={() => void importJson()}
              />
              <IconButton
                name="options-outline"
                label="Cài đặt"
                color={p.accent}
                onPress={() => setPrefs(true)}
              />
            </View>
          </View>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={s.homeScroll}
            showsVerticalScrollIndicator={false}
          >
            <Entrance key={tab} style={s.homeContent}>
              <View style={s.pageIntro}>
                <Text style={[s.eyebrow, { color: p.accent }]}>
                  MỘT KHOẢNG RIÊNG CHO TRANG SÁCH
                </Text>
                <Text style={[s.greeting, { color: p.text }]}>
                  {tab === 'library' ? 'Thư viện của bạn' : 'Những trang đã lưu'}
                </Text>
                <Text style={[s.introText, { color: p.muted }]}>
                  {tab === 'library'
                    ? 'Đọc chậm, đi thật xa.'
                    : 'Giữ lại một chương, trở về một thế giới.'}
                </Text>
              </View>
              {tab === 'library' ? (
                <>
                  <View style={[s.libraryStats, { borderColor: p.line }]}>
                    <View style={s.statCell}>
                      <Text style={[s.statNumber, { color: p.text }]}>
                        {books.length.toLocaleString('vi-VN')}
                      </Text>
                      <Text style={[s.statLabel, { color: p.muted }]}>CUỐN SÁCH</Text>
                    </View>
                    <View style={[s.statCell, s.statDivider, { borderColor: p.line }]}>
                      <Text style={[s.statNumber, { color: p.text }]}>
                        {books.reduce((sum, item) => sum + item.total, 0).toLocaleString('vi-VN')}
                      </Text>
                      <Text style={[s.statLabel, { color: p.muted }]}>CHƯƠNG & PHẦN</Text>
                    </View>
                    <View style={[s.offlineBadge, { backgroundColor: p.soft }]}>
                      <Ionicons name="cloud-offline-outline" size={16} color={p.accent} />
                      <Text style={[s.offlineText, { color: p.accent }]}>Ngoại tuyến</Text>
                    </View>
                  </View>
                  {continued && (
                    <LinearGradient
                      colors={['#254E3C', '#153B2C']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={s.hero}
                    >
                      <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                        <View style={s.heroLabelRow}>
                          <View style={s.heroDot} />
                          <Text style={s.heroLabel}>
                            {continued.chapter_id ? 'ĐANG ĐỌC' : 'CUỐN SÁCH CỦA BẠN'}
                          </Text>
                        </View>
                        <Text style={s.heroTitle} numberOfLines={3}>
                          {continued.title}
                        </Text>
                        <Text style={s.heroSubtitle} numberOfLines={2}>
                          {continued.chapter_title ||
                            `${continued.total.toLocaleString('vi-VN')} chương & phần · Ngoại tuyến`}
                        </Text>
                        {continued.position != null && (
                          <Text style={s.heroProgress}>
                            {Math.round(((continued.position + 1) / continued.total) * 100)}% hành
                            trình
                          </Text>
                        )}
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => void openBook(continued)}
                          style={s.heroButton}
                        >
                          <Text style={s.heroButtonText}>
                            {continued.chapter_id ? 'Đọc tiếp' : 'Bắt đầu đọc'}
                          </Text>
                          <Ionicons name="arrow-forward" size={18} color="#294B37" />
                        </Pressable>
                      </View>
                      <Cover title={continued.title} />
                    </LinearGradient>
                  )}
                  <View style={s.sectionHeading}>
                    <Text style={[s.sectionTitle, { color: p.text }]}>Tất cả sách</Text>
                    <Text style={[s.sectionMeta, { color: p.muted }]}>
                      {books.length.toLocaleString('vi-VN')} CUỐN
                    </Text>
                  </View>
                  {books.map((b) => (
                    <Pressable
                      key={b.id}
                      accessibilityLabel={`Đọc ${b.title}`}
                      onPress={() => void openBook(b)}
                      style={[s.bookCard, { backgroundColor: p.card, borderColor: p.line }]}
                    >
                      <Cover title={b.title} />
                      <View style={s.bookInfo}>
                        <Text style={[s.bookTag, { color: p.accent }]}>
                          {b.source === 'cloud' ? 'MỤC LỤC CLOUD' : 'TRUYỆN CHỮ'}
                        </Text>
                        <Text style={[s.bookName, { color: p.text }]} numberOfLines={3}>
                          {b.title}
                        </Text>
                        <Text style={[s.bookCount, { color: p.muted }]}>
                          {b.total.toLocaleString('vi-VN')} chương & phần
                        </Text>
                        <View style={[s.progressTrack, { backgroundColor: p.line }]}>
                          <View
                            style={[
                              s.progressFill,
                              {
                                backgroundColor: p.accent,
                                width: `${b.position == null ? 0 : Math.min(100, ((b.position + 1) / b.total) * 100)}%`,
                              },
                            ]}
                          />
                        </View>
                        <Text style={[s.bookStatus, { color: p.muted }]}>
                          {b.position == null
                            ? 'Chưa bắt đầu'
                            : `Đang ở mục ${b.position + 1} / ${b.total}`}
                        </Text>
                      </View>
                      {hasCultivationGuide(b.id) && (
                        <IconButton
                          name="sparkles-outline"
                          label={`Cảnh giới ${b.title}`}
                          color={p.accent}
                          onPress={() => setCultivationBook(b.id)}
                        />
                      )}
                      <IconButton
                        name="list-outline"
                        label={`Mục lục ${b.title}`}
                        color={p.accent}
                        onPress={() => void openBook(b, true)}
                      />
                    </Pressable>
                  ))}
                  <Pressable
                    onPress={() => void importJson()}
                    style={[s.importCard, { borderColor: p.line, backgroundColor: p.card }]}
                  >
                    <View style={[s.importIcon, { backgroundColor: p.soft }]}>
                      <Ionicons name="add" size={25} color={p.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.importTitle, { color: p.text }]}>Thêm một cuốn sách</Text>
                      <Text style={[s.importSubtitle, { color: p.muted }]}>
                        Nhập từ tệp JSON trên thiết bị
                      </Text>
                    </View>
                    <Ionicons name="arrow-forward" size={20} color={p.accent} />
                  </Pressable>
                  <View style={s.footerQuote}>
                    <View style={[s.quoteRule, { backgroundColor: p.line }]} />
                    <Text style={[s.quoteText, { color: p.muted }]}>
                      Một trang nữa thôi, một thế giới nữa mở ra.
                    </Text>
                    <Ionicons name="leaf-outline" size={18} color={p.muted} />
                  </View>
                </>
              ) : (
                <>
                  {saved.length === 0 ? (
                    <View style={s.empty}>
                      <Ionicons name="bookmark-outline" size={44} color={p.accent} />
                      <Text style={[s.emptyTitle, { color: p.text }]}>Chưa có chương được lưu</Text>
                      <Text style={[s.emptyText, { color: p.muted }]}>
                        Chạm biểu tượng đánh dấu khi đọc để giữ lại chương yêu thích.
                      </Text>
                    </View>
                  ) : (
                    saved.map((c) => (
                      <Pressable
                        key={`${c.book_id}:${c.id}`}
                        style={[s.savedRow, { backgroundColor: p.card, borderColor: p.line }]}
                        onPress={() => {
                          const b = books.find((b) => b.id === c.book_id);
                          if (b) void openChapter(b, c.id);
                        }}
                      >
                        <Ionicons name="bookmark" size={22} color={p.accent} />
                        <View style={{ flex: 1 }}>
                          <Text style={[s.savedBook, { color: p.muted }]}>{c.book_title}</Text>
                          <Text style={[s.savedTitle, { color: p.text }]}>{c.title}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={p.muted} />
                      </Pressable>
                    ))
                  )}
                </>
              )}
            </Entrance>
          </ScrollView>
          <View style={[s.bottomNav, { backgroundColor: p.card, borderColor: p.line }]}>
            {(
              [
                { key: 'library', name: 'book-outline', label: 'Thư viện' },
                { key: 'saved', name: 'bookmark-outline', label: 'Đã lưu' },
              ] as const
            ).map((t) => (
              <Pressable
                key={t.key}
                onPress={() => {
                  setTab(t.key);
                  scrollRef.current?.scrollTo({ y: 0 });
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === t.key }}
                style={[s.tab, { backgroundColor: tab === t.key ? p.soft : 'transparent' }]}
              >
                <Ionicons name={t.name} size={21} color={tab === t.key ? p.accent : p.muted} />
                <Text
                  style={{
                    color: tab === t.key ? p.accent : p.muted,
                    fontSize: 12,
                    fontWeight: tab === t.key ? '700' : '400',
                  }}
                >
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
      {toc && book && (
        <TocModal
          visible={toc}
          book={book}
          currentId={chapter?.id ?? book.chapter_id ?? undefined}
          initialPosition={chapter?.position ?? book?.position ?? 0}
          palette={p}
          onClose={() => setToc(false)}
          onSelect={(id) => {
            void openChapter(book, id);
          }}
        />
      )}
      <Modal
        visible={prefs}
        transparent
        animationType={reducedMotion ? 'none' : 'slide'}
        onRequestClose={() => setPrefs(false)}
      >
        <View style={s.scrim}>
          <Pressable
            feedback={false}
            style={{ flex: 1 }}
            onPress={() => setPrefs(false)}
            accessibilityLabel="Đóng cài đặt"
          />
          <SafeAreaView edges={['bottom']} style={[s.settings, { backgroundColor: p.card }]}>
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              <View style={s.settingsHandle} />
              <View style={s.settingsHeading}>
                <View>
                  <Text style={[s.sectionTitle, { color: p.text }]}>Góc đọc của bạn</Text>
                  <Text style={[s.settingsCaption, { color: p.muted }]}>
                    Một trang sách, theo cách của bạn.
                  </Text>
                </View>
                <IconButton
                  name="close"
                  label="Đóng cài đặt"
                  color={p.accent}
                  onPress={() => setPrefs(false)}
                />
              </View>
              <Text style={[s.settingLabel, { color: p.muted }]}>MÀU TRANG</Text>
              <View style={s.settingChoices}>
                {(['paper', 'sepia', 'night'] as const).map((theme, i) => (
                  <Pressable
                    key={theme}
                    onPress={() => updateSettings({ ...settings, theme })}
                    style={[
                      s.themeChoice,
                      {
                        backgroundColor: palettes[theme].bg,
                        borderColor: settings.theme === theme ? p.accent : p.line,
                        borderWidth: 2,
                      },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: settings.theme === theme }}
                  >
                    <Text
                      style={{
                        color: palettes[theme].text,
                        fontSize: 20,
                        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
                      }}
                    >
                      Aa
                    </Text>
                    <Text style={{ color: palettes[theme].text, fontSize: 12, marginTop: 5 }}>
                      {['Sáng', 'Giấy ngà', 'Ban đêm'][i]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={[s.settingRow, { borderColor: p.line }]}>
                <Text style={{ color: p.text, fontSize: 16 }}>Cỡ chữ</Text>
                <View style={[s.stepper, { backgroundColor: p.soft }]}>
                  <IconButton
                    name="remove"
                    label="Giảm cỡ chữ"
                    color={p.accent}
                    onPress={() =>
                      updateSettings({ ...settings, fontSize: Math.max(15, settings.fontSize - 1) })
                    }
                  />
                  <Text style={{ color: p.text, minWidth: 26, textAlign: 'center' }}>
                    {settings.fontSize}
                  </Text>
                  <IconButton
                    name="add"
                    label="Tăng cỡ chữ"
                    color={p.accent}
                    onPress={() =>
                      updateSettings({ ...settings, fontSize: Math.min(32, settings.fontSize + 1) })
                    }
                  />
                </View>
              </View>
              <View style={[s.settingRow, { borderColor: p.line }]}>
                <Text style={{ color: p.text, fontSize: 16 }}>Giãn dòng</Text>
                <View style={[s.stepper, { backgroundColor: p.soft }]}>
                  <IconButton
                    name="remove"
                    label="Giảm giãn dòng"
                    color={p.accent}
                    onPress={() =>
                      updateSettings({
                        ...settings,
                        lineHeight: Math.max(1.4, Number((settings.lineHeight - 0.1).toFixed(1))),
                      })
                    }
                  />
                  <Text style={{ color: p.text, minWidth: 26, textAlign: 'center' }}>
                    {settings.lineHeight.toFixed(1)}
                  </Text>
                  <IconButton
                    name="add"
                    label="Tăng giãn dòng"
                    color={p.accent}
                    onPress={() =>
                      updateSettings({
                        ...settings,
                        lineHeight: Math.min(2.2, Number((settings.lineHeight + 0.1).toFixed(1))),
                      })
                    }
                  />
                </View>
              </View>
              <View style={[s.settingRow, { borderColor: p.line }]}>
                <Text style={{ color: p.text, fontSize: 16 }}>Phông chữ có chân</Text>
                <Switch
                  value={settings.font === 'serif'}
                  onValueChange={(v) => updateSettings({ ...settings, font: v ? 'serif' : 'sans' })}
                  trackColor={{ true: '#74946C' }}
                />
              </View>
              <View style={[s.settingRow, { borderColor: p.line }]}>
                <Text style={{ color: p.text, fontSize: 16, flex: 1, paddingRight: 12 }}>
                  Giữ màn hình sáng khi đọc
                </Text>
                <Switch
                  value={settings.keepAwake}
                  onValueChange={(v) => updateSettings({ ...settings, keepAwake: v })}
                  trackColor={{ true: '#74946C' }}
                />
              </View>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
      {cultivationBook && (
        <CultivationModal
          bookId={cultivationBook}
          palette={p}
          onClose={() => setCultivationBook(null)}
        />
      )}
      {!!busy && (
        <Modal transparent animationType={reducedMotion ? 'none' : 'fade'} visible>
          <View style={s.busyScrim}>
            <View style={[s.busyCard, { backgroundColor: p.card }]}>
              <ActivityIndicator color={p.accent} size="large" />
              <Text style={{ color: p.text, marginTop: 18, textAlign: 'center' }}>{busy}</Text>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}
function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}
