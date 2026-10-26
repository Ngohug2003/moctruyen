import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotionPressable as Pressable } from './motion';
import { s } from './styles';
type IconName = React.ComponentProps<typeof Ionicons>['name'];
export function IconButton({
  name,
  onPress,
  label,
  color = '#315B46',
  disabled = false,
}: {
  name: IconName;
  onPress: () => void;
  label: string;
  color?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={(e) => {
        e.stopPropagation();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [s.iconButton, { opacity: pressed ? 0.5 : 1 }]}
    >
      <Ionicons name={name} size={23} color={color} />
    </Pressable>
  );
}
export function Cover({ title, large = false }: { title: string; large?: boolean }) {
  return (
    <View style={[s.cover, large && s.coverLarge]}>
      <View style={s.coverFrame}>
        <Ionicons name="leaf-outline" size={large ? 24 : 16} color="#C8D3A7" />
        <View style={s.coverTitleSlot}>
          <Text
            numberOfLines={large ? 3 : 2}
            ellipsizeMode="tail"
            maxFontSizeMultiplier={1.2}
            style={[s.coverTitle, large && { fontSize: 17, lineHeight: 22 }]}
          >
            {title}
          </Text>
        </View>
        <View style={s.coverFooter}>
          <View style={s.coverRule} />
          <Text numberOfLines={1} allowFontScaling={false} style={s.coverSmall}>
            MỘC · THƯ VIỆN
          </Text>
        </View>
      </View>
    </View>
  );
}
export function Loading({ message = 'Đang mở thư viện…' }: { message?: string }) {
  return (
    <View style={s.loading}>
      <Image
        source={require('../../assets/brand/logo.png')}
        style={{ width: 150, height: 150, marginBottom: 12 }}
        accessibilityLabel="Logo Mộc"
      />
      <ActivityIndicator color="#315B46" size="large" />
      <Text style={s.loadingLabel}>{message}</Text>
    </View>
  );
}
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string | null }
> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    if (this.state.error)
      return (
        <SafeAreaView style={s.loading}>
          <Ionicons name="book-outline" size={42} color="#315B46" />
          <Text style={s.errorTitle}>Chưa mở được thư viện</Text>
          <Text style={s.loadingLabel}>{this.state.error}</Text>
          <Text style={s.loadingLabel}>
            Đóng và mở lại app. Nếu vẫn lỗi, kiểm tra file JSON rồi build lại.
          </Text>
        </SafeAreaView>
      );
    return this.props.children;
  }
}
