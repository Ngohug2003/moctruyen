import Ionicons from '@expo/vector-icons/Ionicons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, AppState, Platform, ScrollView, Text, View } from 'react-native';
import * as db from '../../data/library';
import { Entrance, MotionPressable as Pressable } from '../../ui/motion';
import { IconButton } from '../../ui/primitives';
import { s } from '../../ui/styles';
import type { Palette } from '../../ui/theme';
export function Reader({
  sessionRef,
  book,
  chapter,
  settings,
  palette: p,
  initialOffset,
  onBack,
  onToc,
  onSettings,
  onCultivation,
  onBookmark,
  onPrevious,
  onNext,
}: {
  sessionRef: React.Ref<ReadingSession>;
  book: db.Book;
  chapter: db.Chapter;
  settings: db.ReaderSettings;
  palette: Palette;
  initialOffset: number;
  onBack: () => void;
  onToc: () => void;
  onSettings: () => void;
  onCultivation?: () => void;
  onBookmark: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null),
    offset = useRef(initialOffset),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    restored = useRef(false),
    height = useRef(0),
    contentHeight = useRef(0),
    errorShown = useRef(false);
  const [percent, setPercent] = useState(0);
  const save = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    return db.saveProgress(book.id, chapter.id, offset.current).catch(() => {
      if (!errorShown.current) {
        errorShown.current = true;
        Alert.alert(
          'Chưa lưu được vị trí đọc',
          'Bộ nhớ điện thoại có thể đã đầy. Hãy kiểm tra rồi thử lại.',
        );
      }
    });
  }, [book.id, chapter.id]);
  useImperativeHandle(sessionRef, () => ({ save }), [save]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') save();
    });
    return () => {
      sub.remove();
      if (timer.current) clearTimeout(timer.current);
      save();
    };
  }, [save]);
  useEffect(() => {
    if (settings.keepAwake) void activateKeepAwakeAsync('moc-reader').catch(() => {});
    return () => {
      void deactivateKeepAwake('moc-reader');
    };
  }, [settings.keepAwake]);
  const restorePosition = () => {
    if (restored.current || !contentHeight.current || !height.current) return;
    restored.current = true;
    const maxScroll = Math.max(0, contentHeight.current - height.current);
    const y =
      initialOffset > 0 && initialOffset <= 1
        ? Math.round(initialOffset * maxScroll)
        : Math.min(initialOffset, maxScroll);
    offset.current = y;
    requestAnimationFrame(() => scroll.current?.scrollTo({ y, animated: false }));
    save();
  };
  const paragraphs = useMemo(
    () => chapter.content.split(/\n\s*\n/).filter(Boolean),
    [chapter.content],
  );
  const progress = ((chapter.position + 1) / book.total) * 100;
  return (
    <Entrance style={{ flex: 1 }}>
      <View style={[s.readerHeader, { borderColor: p.line }]}>
        <IconButton name="arrow-back" label="Về thư viện" color={p.accent} onPress={onBack} />
        <View style={s.readerHeaderTitle}>
          <Text numberOfLines={1} style={[s.readerBookTitle, { color: p.text }]}>
            {book.title}
          </Text>
          <Text style={[s.readerHeaderCaption, { color: p.muted }]}>
            MỤC {chapter.position + 1} / {book.total.toLocaleString('vi-VN')}
          </Text>
        </View>
        {onCultivation && (
          <IconButton
            name="sparkles-outline"
            label="Cảnh giới Đế Bá"
            color={p.accent}
            onPress={onCultivation}
          />
        )}
        <IconButton
          name={chapter.marked ? 'bookmark' : 'bookmark-outline'}
          label={chapter.marked ? 'Bỏ đánh dấu chương' : 'Đánh dấu chương'}
          color={p.accent}
          onPress={onBookmark}
        />
      </View>
      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={s.readingPage}
        onLayout={(e) => {
          height.current = e.nativeEvent.layout.height;
          restorePosition();
        }}
        onContentSizeChange={(_, h) => {
          contentHeight.current = h;
          restorePosition();
        }}
        onScroll={(e) => {
          if (!restored.current) return;
          offset.current = e.nativeEvent.contentOffset.y;
          setPercent(
            Math.min(
              100,
              Math.round(
                (offset.current / Math.max(1, contentHeight.current - height.current)) * 100,
              ),
            ),
          );
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(save, 700);
        }}
        scrollEventThrottle={150}
      >
        <Text style={[s.readerEyebrow, { color: p.accent }]}>
          MỤC {chapter.position + 1} / {book.total}
        </Text>
        <Text
          style={[
            s.chapterHeading,
            {
              color: p.text,
              fontFamily:
                settings.font === 'serif'
                  ? Platform.OS === 'ios'
                    ? 'Georgia'
                    : 'serif'
                  : undefined,
            },
          ]}
        >
          {chapter.title}
        </Text>
        <View style={[s.chapterRule, { backgroundColor: p.accent }]} />
        {paragraphs.map((paragraph, i) => (
          <Text
            key={i}
            selectable
            style={{
              color: p.text,
              fontSize: settings.fontSize,
              lineHeight: Math.round(settings.fontSize * settings.lineHeight),
              fontFamily:
                settings.font === 'serif'
                  ? Platform.OS === 'ios'
                    ? 'Georgia'
                    : 'serif'
                  : undefined,
              marginBottom: Math.round(settings.fontSize * 0.85),
              textAlign: 'left',
            }}
          >
            {paragraph}
          </Text>
        ))}
        <View style={[s.chapterEnd, { borderColor: p.line }]}>
          <Ionicons name="leaf-outline" size={22} color={p.accent} />
          <Text style={{ color: p.muted, fontSize: 13, marginVertical: 12 }}>
            Bạn đã đọc hết mục này
          </Text>
          {onNext ? (
            <Pressable onPress={onNext} style={[s.nextButton, { backgroundColor: p.accent }]}>
              <Text style={{ color: p.bg, fontWeight: '700' }}>Chương tiếp theo</Text>
              <Ionicons name="arrow-forward" size={18} color={p.bg} />
            </Pressable>
          ) : (
            <Text style={{ color: p.text }}>Bạn đã đến cuối bản truyện trong thư viện.</Text>
          )}
        </View>
      </ScrollView>
      <View style={[s.readProgressTrack, { backgroundColor: p.line }]}>
        <View style={{ height: 2, backgroundColor: p.accent, width: `${progress}%` }} />
      </View>
      <View style={[s.readerBottom, { backgroundColor: p.card }]}>
        <IconButton
          name="chevron-back"
          label="Chương trước"
          disabled={!onPrevious}
          color={onPrevious ? p.accent : p.line}
          onPress={() => onPrevious?.()}
        />
        <Pressable onPress={onToc} style={s.readerToolbarItem}>
          <Ionicons name="list-outline" size={22} color={p.accent} />
          <Text style={{ fontSize: 11, color: p.muted, marginTop: 3 }}>Mục lục</Text>
        </Pressable>
        <View style={[s.percentBadge, { backgroundColor: p.soft }]}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: p.accent }}>{percent}%</Text>
          <Text style={{ fontSize: 9, color: p.muted, marginTop: 2 }}>MỤC NÀY</Text>
        </View>
        <Pressable onPress={onSettings} style={s.readerToolbarItem}>
          <Text style={{ fontSize: 22, color: p.accent, fontFamily: 'serif' }}>Aa</Text>
          <Text style={{ fontSize: 11, color: p.muted, marginTop: 1 }}>Giao diện</Text>
        </Pressable>
        <IconButton
          name="chevron-forward"
          label="Chương tiếp theo"
          disabled={!onNext}
          color={onNext ? p.accent : p.line}
          onPress={() => onNext?.()}
        />
      </View>
    </Entrance>
  );
}

export type ReadingSession = { save: () => Promise<void> };
