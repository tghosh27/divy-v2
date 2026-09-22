export type CycleState = "overdue" | "settling" | "open" | "settled";
export type GroupKind = "split" | "wallet";

export type GroupCard = {
  id: string;
  kind: GroupKind;
  name: string;
  coverKey: string;
  members: number;
  memberAvatars: string[];
  lastActivity: string;
  balance: number;
  available: number;
  cycle: CycleState;
  cycleLabel: string;
  progress: number;
  youAdmin: boolean;
  archived: boolean;
};

export type ActionItem = {
  id: string;
  groupId: string;
  group: string;
  coverKey: string;
  amount: number;
  note: string;
  badge?: { text: string; tone: "urgent" | "warn" } | undefined;
  cta: "Pay" | "Remind" | "View";
  tone: "urgent" | "warn" | "open" | "calm";
  kind: GroupKind;
};

export type ExpenseCard = {
  id: string;
  title: string;
  group: string;
  groupId: string;
  date: string;
  total: number;
  each: number;
  coverKey: string;
};

export type Member = {
  id: string;
  name: string;
  avatarKey: string;
  balance: number;
  paid: boolean;
  admin: boolean;
  isYou: boolean;
  handle: string | null;
};

/** One line off a receipt, and which members shared it. */
export type ExpenseItem = { name: string; amount: number; memberIds: string[] };

/** Split a receipt: each item goes to whoever shared it, tax and tip split evenly. */
export function itemizedShares(
  items: ExpenseItem[],
  memberIds: string[],
  tax: number,
  tip: number,
): Record<string, number> {
  const out: Record<string, number> = {};
  memberIds.forEach((id) => (out[id] = 0));
  for (const item of items) {
    const sharers = item.memberIds.filter((id) => memberIds.includes(id));
    if (!sharers.length) continue;
    const per = item.amount / sharers.length;
    sharers.forEach((id) => (out[id] = (out[id] ?? 0) + per));
  }
  const extras = Math.max(0, tax) + Math.max(0, tip);
  if (extras > 0 && memberIds.length) {
    const per = extras / memberIds.length;
    memberIds.forEach((id) => (out[id] = (out[id] ?? 0) + per));
  }
  memberIds.forEach((id) => (out[id] = Math.round((out[id] ?? 0) * 100) / 100));
  return out;
}

export type GroupExpense = {
  id: string;
  title: string;
  payer: string;
  payerMemberId: string | null;
  addedBy: string | null;
  addedByName: string | null;
  canEdit: boolean;
  date: string;
  isoDate: string;
  total: number;
  each: number;
  category: string;
  paid: boolean;
  claimStatus: "pending" | "approved" | "declined" | null;
  receiptKey: string | null;
  /** Receipt line items with who shared each one (itemized splits only). */
  items: ExpenseItem[] | null;
  /** Exact amount each member owes, keyed by member id (custom splits only). */
  shares: Record<string, number> | null;
  recur: RecurFreq | null;
  disputeStatus: DisputeStatus | null;
};

export type RecurFreq = "weekly" | "biweekly" | "monthly";

export const RECUR_LABEL: Record<RecurFreq, string> = {
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  monthly: "Every month",
};

export type DisputeStatus = "open" | "resolved" | "rejected";

export type Dispute = {
  id: string;
  groupId: string;
  group: string;
  expenseId: string | null;
  expenseTitle: string;
  amount: number;
  by: string;
  byYou: boolean;
  reason: string;
  status: DisputeStatus;
  resolution: string | null;
  when: string;
};

export type PaymentRow = {
  id: string;
  date: string;
  isoDate: string;
  label: string;
  group: string;
  amount: number;
  method: string;
};

export type GroupDetail = {
  id: string;
  name: string;
  kind: GroupKind;
  coverKey: string;
  joinCode: string;
  purpose: string | null;
  cycle: CycleState;
  cycleLabel: string;
  progress: number;
  balance: number;
  members: Member[];
  expenses: GroupExpense[];
  totalSpent: number;
  cycleStart: string;
  cycleEnd: string;
  youPaid: number;
  yourShare: number;
  yourMemberId: string | null;
  youAdmin: boolean;
  settleMode: SettleMode;
  settleFrequency: SettleFrequency | null;
  settleAnchor: string | null;
  confirmDays: number;
  multicurrency: boolean;
  wallet: WalletGroupExtras | null;
};

export type Deposit = {
  id: string;
  name: string;
  avatarKey: string;
  amount: number;
  date: string;
  isoDate: string;
  pending: boolean;
};

export type FundingRequest = {
  id: string;
  title: string;
  due: string;
  dueIso: string | null;
  amount: number;
  audience: string;
  collected: number;
  goal: number;
  contributors: FundingContributor[];
};

export type FundingContributor = {
  memberId: string;
  name: string;
  avatarKey: string;
  isYou: boolean;
  expected: number;
  paid: number;
  settled: boolean;
};

export type WalletGroupExtras = {
  available: number;
  pending: number;
  unpaidExpenses: number;
  unfundedContributions: number;
  totalContribution: number;
  totalReimbursement: number;
  yourDues: number;
  deposits: Deposit[];
  fundingRequests: FundingRequest[];
};

export type ActivityEvent = {
  id: string;
  kind: "expense" | "payment" | "cycle" | "reminder";
  who: string;
  text: string;
  amount: number | null;
  when: string;
  unread: boolean;
};

export type WalletTx = { id: string; name: string; note: string; date: string; amount: number };

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  when: string;
  tone: "urgent" | "warn" | "good" | "calm";
  unread: boolean;
};

export type LinkedAccount = {
  id: string;
  name: string;
  detail: string;
  kind: "bank" | "card";
  primary: boolean;
};

export type Person = { id: string; name: string; handle: string; avatarKey: string };

export type ScoreFactor = {
  key: string;
  label: string;
  detail: string;
  points: number;
  max: number;
};

export type ScoreBreakdown = {
  score: number;
  rating: string;
  factors: ScoreFactor[];
  tips: string[];
};

export type FriendTie = {
  groupId: string;
  group: string;
  amount: number;
  paid: boolean;
};

export type Friend = {
  id: string;
  name: string;
  handle: string;
  avatarKey: string;
  score: number;
  net: number;
  shared: number;
  ties: FriendTie[];
};

export function scoreRating(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Strong";
  if (score >= 60) return "Fair";
  return "Building";
}

export type Snapshot = {
  me: { name: string; handle: string; avatarKey: string; score: number; onboarded: boolean };
  wallet: { available: number; pending: number };
  totals: { owedToYou: number; youOwe: number; net: number; activeGroups: number };
  groups: GroupCard[];
  actionItems: ActionItem[];
  recentExpenses: ExpenseCard[];
  groupDetails: Record<string, GroupDetail>;
  activityFeed: ActivityEvent[];
  walletTransactions: WalletTx[];
  notifications: NotificationItem[];
  linkedAccounts: LinkedAccount[];
  people: Person[];
  peopleBalances: { name: string; amount: number }[];
  spendingMix: { label: string; value: number; color: string }[];
  monthlyRecap: { month: string; total: number; topCategory: string; topCategoryTotal: number; expenseCount: number };
  disputes: Dispute[];
  paymentHistory: PaymentRow[];
  scoreBreakdown: ScoreBreakdown;
  friends: Friend[];
}

/* ---------------- payment timing ---------------- */

export type PayPhase = "upcoming" | "open" | "duesoon" | "overdue";

const DAY_MS = 86_400_000;

function dateAtNoon(value: string | null | undefined): number | null {
  if (!value) return null;
  const t = new Date(`${value.slice(0, 10)}T12:00:00Z`).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Where a group's payment window stands right now, computed from two dates.
 * Returns null when it's more than 3 days before the window opens (not surfaced yet).
 *  - "upcoming": window opens within 3 days — can't pay yet
 *  - "open":     payable now
 *  - "duesoon":  payable, but the due date is within 3 days
 *  - "overdue":  the due day has fully passed
 */
export function payPhase(
  opens: string | null | undefined,
  due: string | null | undefined,
  now: number = Date.now(),
): PayPhase | null {
  const openT = dateAtNoon(opens);
  const dueT = dateAtNoon(due);
  if (openT === null && dueT === null) return null;
  if (dueT !== null && now > dueT + DAY_MS / 2) return "overdue";
  if (openT === null || now >= openT) {
    if (dueT !== null && dueT - now <= 3 * DAY_MS) return "duesoon";
    return "open";
  }
  if (openT - now <= 3 * DAY_MS) return "upcoming";
  return null;
}

/* ---------------- settle-up schedule ---------------- */

export type SettleMode = "anytime" | "scheduled";
export type SettleFrequency = "weekly" | "biweekly" | "monthly";

export const SETTLE_FREQUENCY_LABEL: Record<SettleFrequency, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
};

export function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function addDays(day: string, count: number) {
  const d = new Date(`${day.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + count);
  return isoDay(d);
}

export function advance(day: string, frequency: SettleFrequency, steps: number) {
  if (frequency === "weekly") return addDays(day, 7 * steps);
  if (frequency === "biweekly") return addDays(day, 14 * steps);
  const d = new Date(`${day.slice(0, 10)}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + steps);
  return isoDay(d);
}

/** The upcoming settle-up dates for a schedule, starting at the anchor. */
export function nextSettleDates(anchor: string, frequency: SettleFrequency, count = 4) {
  return Array.from({ length: count }, (_, i) => advance(anchor, frequency, i));
}

/**
 * A scheduled group splits expenses up to the settle-up date, then has a
 * confirmation window before payments are due.
 *  opens = settle-up date (confirm + pay from here)
 *  due   = opens + confirmation days
 */
export function settleWindow(anchor: string, confirmDays: number) {
  return { opens: anchor, due: addDays(anchor, Math.max(0, confirmDays)) };
}

export function fmtDay(day: string | null | undefined) {
  if (!day) return "";
  return new Date(`${day.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
