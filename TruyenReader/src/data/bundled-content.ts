import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import meta from '../../assets/book-meta.json';
import { contentAssets } from '../../assets/content-assets';
import { createContentCache } from '../domain/content-cache';

const cache = createContentCache(async (index) => {
  const module = contentAssets[index];
  if (module === undefined)
    throw new Error('Thiếu cụm nội dung truyện. Chạy npm start để chuẩn bị lại.');
  const asset = Asset.fromModule(module);
  if (Platform.OS === 'web') {
    const res = await fetch(asset.uri);
    return await res.json();
  }
  await asset.downloadAsync();
  if (!asset.localUri)
    throw new Error(
      'Chưa tải được cụm chương. Nếu dùng Expo Go, kiểm tra điện thoại và máy tính cùng mạng.',
    );
  return JSON.parse(await new File(asset.localUri).text());
}, 2);

export async function getBundledContent(
  bookId: string,
  position: number,
  id: string,
): Promise<string> {
  if (bookId !== meta.bookId)
    throw new Error('Nội dung chương trống. Hãy nhập lại file JSON của truyện này.');
  return cache.get(Math.floor(position / meta.chunkSize), id);
}
