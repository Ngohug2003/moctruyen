export type CultivationSource = {
  id: string;
  title: string;
  url: string;
  kind: 'novel' | 'reference';
  chapter_position: number | null;
};
export type Realm = {
  id: string;
  position: number;
  name: string;
  detail: string;
  branch: string;
  aliases: string[];
  source_ids: string[];
};
export type RealmSystem = {
  id: string;
  position: number;
  title: string;
  summary: string;
  verification: string;
  source_ids: string[];
  realms: Realm[];
};
export type CultivationGuide = {
  book_id: string;
  title: string;
  version: string;
  updated_at: string;
  intro: string;
  source_note: string;
  sources: CultivationSource[];
  systems: RealmSystem[];
};
export const hasCultivationGuide = (bookId: string) => bookId === 'faec571705be16f3';
