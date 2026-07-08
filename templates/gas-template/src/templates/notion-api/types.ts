/**
 * Notion API の型定義
 *
 * GAS はファイル間のモジュール読み込みをサポートしないため、
 * このファイルの型は TypeScript コンパイル時のみ使用されます（実行時には消去）。
 */

// =========================================
// プロパティ値の型定義
// =========================================

interface NotionRichText {
  type: "text";
  text: {
    content: string;
    link?: { url: string } | null;
  };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
  };
}

interface NotionTitleProperty {
  title: NotionRichText[];
}

interface NotionRichTextProperty {
  rich_text: NotionRichText[];
}

interface NotionSelectProperty {
  select: { name: string };
}

interface NotionMultiSelectProperty {
  multi_select: { name: string }[];
}

interface NotionStatusProperty {
  status: { name: string };
}

interface NotionDateProperty {
  date: { start: string; end?: string | null };
}

interface NotionCheckboxProperty {
  checkbox: boolean;
}

interface NotionNumberProperty {
  number: number;
}

interface NotionUrlProperty {
  url: string;
}

interface NotionEmailProperty {
  email: string;
}

interface NotionPhoneProperty {
  phone_number: string;
}

// プロパティ値のユニオン型
type NotionPropertyValue =
  | NotionTitleProperty
  | NotionRichTextProperty
  | NotionSelectProperty
  | NotionMultiSelectProperty
  | NotionStatusProperty
  | NotionDateProperty
  | NotionCheckboxProperty
  | NotionNumberProperty
  | NotionUrlProperty
  | NotionEmailProperty
  | NotionPhoneProperty;

// ページプロパティのマップ型
type NotionPageProperties = Record<string, NotionPropertyValue>;

// =========================================
// ブロックの型定義
// =========================================

interface NotionParagraphBlock {
  object: "block";
  type: "paragraph";
  paragraph: {
    rich_text: NotionRichText[];
  };
}

interface NotionHeading1Block {
  object: "block";
  type: "heading_1";
  heading_1: {
    rich_text: NotionRichText[];
  };
}

interface NotionHeading2Block {
  object: "block";
  type: "heading_2";
  heading_2: {
    rich_text: NotionRichText[];
  };
}

interface NotionHeading3Block {
  object: "block";
  type: "heading_3";
  heading_3: {
    rich_text: NotionRichText[];
  };
}

interface NotionBulletedListBlock {
  object: "block";
  type: "bulleted_list_item";
  bulleted_list_item: {
    rich_text: NotionRichText[];
  };
}

interface NotionNumberedListBlock {
  object: "block";
  type: "numbered_list_item";
  numbered_list_item: {
    rich_text: NotionRichText[];
  };
}

type NotionBlock =
  | NotionParagraphBlock
  | NotionHeading1Block
  | NotionHeading2Block
  | NotionHeading3Block
  | NotionBulletedListBlock
  | NotionNumberedListBlock;

// =========================================
// API リクエスト・レスポンスの型定義
// =========================================

interface CreatePageRequest {
  parent: { database_id: string };
  properties: NotionPageProperties;
  children?: NotionBlock[];
}

interface UpdatePageRequest {
  properties: NotionPageProperties;
  archived?: boolean;
}

interface NotionPageResponse {
  object: "page";
  id: string;
  created_time: string;
  last_edited_time: string;
  url: string;
  properties: Record<string, unknown>;
}

