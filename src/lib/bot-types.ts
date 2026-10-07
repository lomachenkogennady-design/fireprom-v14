// ═══════════════════════════════════════════════════════════
// Bot Studio — типы для UI
// ═══════════════════════════════════════════════════════════

export type LeadDTO = {
  id: number;
  source: string;
  botUsername: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  tgUserId: string | null;
  tgUsername: string | null;
  product: string | null;
  message: string | null;
  status: string;
  priority: string;
  amount: number | null;
  manager: string | null;
  notifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LeadEventDTO = {
  id: number;
  leadId: number;
  type: string;
  text: string;
  author: string;
  createdAt: string;
};

export type NotificationDTO = {
  id: number;
  leadId: number | null;
  channel: string;
  target: string;
  text: string;
  status: string;
  error: string | null;
  createdAt: string;
};

export type ProductDTO = {
  id: number;
  slug: string;
  category: string;
  title: string;
  description: string;
  priceFrom: number;
  unit: string;
  specs: string[];
  active: boolean;
  sortOrder: number;
};

export type BotCommandDTO = {
  id: number;
  command: string;
  button: string | null;
  title: string;
  reply: string;
  showPrices: boolean;
  category: string | null;
  collectLead: boolean;
  active: boolean;
  sortOrder: number;
  hits: number;
};
