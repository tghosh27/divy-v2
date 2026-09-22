import groupSki from "@/assets/group-ski.jpg";
import groupVegas from "@/assets/group-vegas.jpg";
import groupNyc from "@/assets/group-nyc.jpg";
import groupLunch from "@/assets/group-lunch.jpg";
import groupClub from "@/assets/group-club.jpg";
import avatarMaya from "@/assets/avatar-maya.png";
import avatar1 from "@/assets/avatar-1.png";
import avatar2 from "@/assets/avatar-2.png";
import avatar3 from "@/assets/avatar-3.png";

export const me = { name: "Alex Rivera", handle: "@alex.rivera", avatar: avatarMaya, score: 94 };

export const memberAvatars = [avatar1, avatar2, avatar3];

export type CycleState = "overdue" | "settling" | "open" | "settled";

export type GroupKind = "split" | "wallet";

export type Group = {
  id: string;
  kind: GroupKind;
  name: string;
  cover: string;
  members: number;
  lastActivity: string;
  balance: number;
  cycle: CycleState;
  cycleLabel: string;
  progress: number;
};

export const groups: Group[] = [
  {
    id: "adphi",
    kind: "wallet",
    name: "ADPhi Yale Lax",
    cover: groupClub,
    members: 31,
    lastActivity: "Last expense 20d ago",
    balance: -290,
    cycle: "settling",
    cycleLabel: "Fall dues close Sep 14",
    progress: 68,
  },
  {
    id: "ski",
    kind: "split",
    name: "Alpine Ski Club",
    cover: groupSki,
    members: 3,
    lastActivity: "Last expense 7d ago",
    balance: -201,
    cycle: "overdue",
    cycleLabel: "Overdue by 4 days",
    progress: 100,
  },
  {
    id: "vegas",
    kind: "split",
    name: "Vegas Trip 2026",
    cover: groupVegas,
    members: 3,
    lastActivity: "Last expense yesterday",
    balance: 38,
    cycle: "settling",
    cycleLabel: "Settle window closes in 2 days",
    progress: 82,
  },
  {
    id: "nyc",
    kind: "split",
    name: "NYC Roommates",
    cover: groupNyc,
    members: 4,
    lastActivity: "Last expense 3d ago",
    balance: -84.5,
    cycle: "open",
    cycleLabel: "Cycle closes in 15 days",
    progress: 44,
  },
  {
    id: "lunch",
    kind: "split",
    name: "Office Lunch Club",
    cover: groupLunch,
    members: 3,
    lastActivity: "No expenses yet",
    balance: 0,
    cycle: "settled",
    cycleLabel: "All even",
    progress: 8,
  },
];

export type ActionItem = {
  id: string;
  groupId: string;
  group: string;
  cover: string;
  amount: number;
  note: string;
  cta: "Pay" | "Remind";
  tone: "urgent" | "warn" | "calm";
};

export const actionItems: ActionItem[] = [
  {
    id: "a0",
    groupId: "adphi",
    group: "ADPhi Yale Lax",
    cover: groupClub,
    amount: -290,
    note: "Fall dues · due Sep 14",
    cta: "Pay",
    tone: "warn",
  },
  {
    id: "a1",
    groupId: "ski",
    group: "Alpine Ski Club",
    cover: groupSki,
    amount: -45,
    note: "Overdue · 4 days late",
    cta: "Pay",
    tone: "urgent",
  },
  {
    id: "a2",
    groupId: "nyc",
    group: "NYC Roommates",
    cover: groupNyc,
    amount: -84.5,
    note: "Settle window open · confirm split",
    cta: "Pay",
    tone: "warn",
  },
  {
    id: "a3",
    groupId: "vegas",
    group: "Vegas Trip 2026",
    cover: groupVegas,
    amount: 38,
    note: "Marcus hasn't paid you yet",
    cta: "Remind",
    tone: "calm",
  },
];

export const recentExpenses = [
  { id: "v1", title: "Dinner at Nobu", group: "Vegas Trip 2026", date: "Jul 19", total: 342, each: 114, cover: groupVegas },
  { id: "v2", title: "Aria Hotel (3 nights)", group: "Vegas Trip 2026", date: "Jul 18", total: 1080, each: 360, cover: groupVegas },
  { id: "n2", title: "Netflix + Hulu Bundle", group: "NYC Roommates", date: "Jul 15", total: 32, each: 8, cover: groupNyc },
  { id: "n3", title: "Whole Foods Grocery Run", group: "NYC Roommates", date: "Jul 12", total: 94.62, each: 23.66, cover: groupNyc },
];

export const peopleBalances = [
  { name: "Aisha D.", amount: 114 },
  { name: "Jordan T.", amount: 112 },
  { name: "Priya K.", amount: 42 },
  { name: "Sam W.", amount: -70 },
  { name: "Marcus R.", amount: -38 },
];

export const spendingMix = [
  { label: "Housing", value: 540, color: "#7c3aed" },
  { label: "Food", value: 386, color: "#a855f7" },
  { label: "Travel", value: 204, color: "#c084fc" },
  { label: "Fun", value: 99, color: "#ddd6fe" },
];

export const activityFeed = [
  {
    id: "f1",
    kind: "expense" as const,
    who: "Aisha D.",
    text: "added an expense in Vegas Trip 2026",
    amount: -360,
    when: "2h ago",
    unread: true,
  },
  {
    id: "f2",
    kind: "payment" as const,
    who: "Priya K.",
    text: "paid you back for the ConEd split",
    amount: 42.25,
    when: "5h ago",
    unread: true,
  },
  {
    id: "f3",
    kind: "cycle" as const,
    who: "NYC Roommates",
    text: "settlement cycle closes in 3 days",
    amount: null,
    when: "8h ago",
    unread: true,
  },
  {
    id: "f4",
    kind: "expense" as const,
    who: "You",
    text: "added an expense in Vegas Trip 2026",
    amount: -342,
    when: "Yesterday",
    unread: false,
  },
  {
    id: "f5",
    kind: "reminder" as const,
    who: "Jordan T.",
    text: "sent you a payment reminder in NYC Roommates",
    amount: -84.5,
    when: "Yesterday",
    unread: false,
  },
];

export const walletTransactions = [
  { id: "w1", name: "Priya K.", note: "ConEd split", date: "Jul 12", amount: 42.25 },
  { id: "w2", name: "Jordan T.", note: "July rent share", date: "Jul 10", amount: -84.5 },
  { id: "w3", name: "Aisha D.", note: "Nobu dinner", date: "Jul 9", amount: 114 },
  { id: "w4", name: "Marcus R.", note: "Vegas settlement", date: "Jul 5", amount: -38 },
  { id: "w5", name: "Bank transfer", note: "Added money", date: "Jul 1", amount: 150 },
];

// ---------- group detail ----------

export type Member = { id: string; name: string; avatar: string; balance: number; paid: boolean };
export type GroupExpense = {
  id: string;
  title: string;
  payer: string;
  date: string;
  total: number;
  each: number;
  category: string;
};

export type GroupDetail = {
  members: Member[];
  expenses: GroupExpense[];
  totalSpent: number;
  cycleStart: string;
  cycleEnd: string;
  youPaid: number;
  yourShare: number;
};

export const groupDetails: Record<string, GroupDetail> = {
  ski: {
    members: [
      { id: "you", name: "You", avatar: avatarMaya, balance: -201, paid: false },
      { id: "m1", name: "Aisha D.", avatar: avatar1, balance: 156, paid: true },
      { id: "m2", name: "Sam W.", avatar: avatar2, balance: 45, paid: true },
    ],
    expenses: [
      { id: "s1", title: "Lift tickets (3 days)", payer: "Aisha D.", date: "Jul 6", total: 468, each: 156, category: "Fun" },
      { id: "s2", title: "Cabin rental", payer: "Sam W.", date: "Jul 5", total: 135, each: 45, category: "Stay" },
      { id: "s3", title: "Gear rental", payer: "You", date: "Jul 5", total: 120, each: 40, category: "Fun" },
    ],
    totalSpent: 723,
    cycleStart: "Jul 1",
    cycleEnd: "Jul 15",
    youPaid: 120,
    yourShare: 321,
  },
  vegas: {
    members: [
      { id: "you", name: "You", avatar: avatarMaya, balance: 38, paid: true },
      { id: "m1", name: "Marcus R.", avatar: avatar2, balance: -38, paid: false },
      { id: "m2", name: "Aisha D.", avatar: avatar1, balance: 0, paid: true },
    ],
    expenses: [
      { id: "v1", title: "Dinner at Nobu", payer: "You", date: "Jul 19", total: 342, each: 114, category: "Food" },
      { id: "v2", title: "Aria Hotel (3 nights)", payer: "Aisha D.", date: "Jul 18", total: 1080, each: 360, category: "Stay" },
      { id: "v3", title: "Airport rides", payer: "Marcus R.", date: "Jul 17", total: 96, each: 32, category: "Rides" },
    ],
    totalSpent: 1518,
    cycleStart: "Jul 15",
    cycleEnd: "Jul 31",
    youPaid: 544,
    yourShare: 506,
  },
  nyc: {
    members: [
      { id: "you", name: "You", avatar: avatarMaya, balance: -84.5, paid: false },
      { id: "m1", name: "Jordan T.", avatar: avatar2, balance: 76.5, paid: true },
      { id: "m2", name: "Priya K.", avatar: avatar1, balance: 8, paid: true },
      { id: "m3", name: "Sam W.", avatar: avatar3, balance: 0, paid: true },
    ],
    expenses: [
      { id: "n1", title: "July rent share", payer: "Jordan T.", date: "Jul 16", total: 306, each: 76.5, category: "Stay" },
      { id: "n2", title: "Netflix + Hulu Bundle", payer: "Priya K.", date: "Jul 15", total: 32, each: 8, category: "Fun" },
      { id: "n3", title: "Whole Foods grocery run", payer: "You", date: "Jul 12", total: 94.62, each: 23.66, category: "Grocery" },
      { id: "n4", title: "ConEd electricity", payer: "Priya K.", date: "Jul 8", total: 169, each: 42.25, category: "Bills" },
    ],
    totalSpent: 601.62,
    cycleStart: "Jul 1",
    cycleEnd: "Jul 31",
    youPaid: 94.62,
    yourShare: 179.12,
  },
  lunch: {
    members: [
      { id: "you", name: "You", avatar: avatarMaya, balance: 0, paid: true },
      { id: "m1", name: "Priya K.", avatar: avatar1, balance: 0, paid: true },
      { id: "m2", name: "Marcus R.", avatar: avatar3, balance: 0, paid: true },
    ],
    expenses: [],
    totalSpent: 0,
    cycleStart: "Jul 1",
    cycleEnd: "Jul 31",
    youPaid: 0,
    yourShare: 0,
  },
};

// ---------- wallet ----------

export const linkedAccounts = [
  { id: "ac1", name: "Chase Total Checking", detail: "•••• 4821", kind: "bank" as const, primary: true },
  { id: "ac2", name: "Apple Pay", detail: "Visa •••• 3092", kind: "card" as const, primary: false },
  { id: "ac3", name: "Ally Savings", detail: "•••• 7714", kind: "bank" as const, primary: false },
];

export const sendPeople = [
  { id: "p1", name: "Priya K.", handle: "@priyak", avatar: avatar1 },
  { id: "p2", name: "Jordan T.", handle: "@jordant", avatar: avatar2 },
  { id: "p3", name: "Aisha D.", handle: "@aishad", avatar: avatar3 },
  { id: "p4", name: "Marcus R.", handle: "@marcusr", avatar: avatar2 },
  { id: "p5", name: "Sam W.", handle: "@samw", avatar: avatar1 },
];

export const walletBalance = { available: 74.54, pending: 0 };

// ---------- notifications ----------

export const notifications = [
  { id: "n1", title: "Alpine Ski Club is overdue", body: "Your $45.00 settle-up was due 4 days ago.", when: "1h ago", tone: "urgent" as const, unread: true },
  { id: "n2", title: "Confirm your NYC Roommates split", body: "Jordan closed the cycle — review $84.50.", when: "5h ago", tone: "warn" as const, unread: true },
  { id: "n3", title: "Priya K. paid you $42.25", body: "Landed in your Divy wallet.", when: "Yesterday", tone: "good" as const, unread: true },
  { id: "n4", title: "Vegas Trip 2026 closes in 2 days", body: "Add any missing expenses before then.", when: "2d ago", tone: "calm" as const, unread: false },
];

// ---------- shared wallet (organization) groups ----------

export type Deposit = { id: string; name: string; avatar: string; amount: number; date: string };
export type FundingRequest = {
  id: string;
  title: string;
  due: string;
  amount: number;
  audience: string;
  collected: number;
  goal: number;
};
export type WalletExpense = GroupExpense & { paid: boolean };

export type WalletGroupDetail = {
  purpose: string;
  available: number;
  pending: number;
  unpaidExpenses: number;
  unfundedContributions: number;
  totalContribution: number;
  totalReimbursement: number;
  yourDues: number;
  members: (Member & { admin: boolean })[];
  deposits: Deposit[];
  fundingRequests: FundingRequest[];
  expenses: WalletExpense[];
};

export const walletGroupDetails: Record<string, WalletGroupDetail> = {
  adphi: {
    purpose: "Yale Lax · ADPhi dues",
    available: 290,
    pending: 0,
    unpaidExpenses: 272.5,
    unfundedContributions: 7250,
    totalContribution: 290,
    totalReimbursement: 0,
    yourDues: 290,
    members: [
      { id: "you", name: "You", avatar: avatarMaya, balance: -290, paid: false, admin: false },
      { id: "m1", name: "Luke Michalik", avatar: avatar2, balance: 0, paid: true, admin: true },
      { id: "m2", name: "Cole Connors", avatar: avatar3, balance: 0, paid: true, admin: false },
      { id: "m3", name: "Anthony Annunziata", avatar: avatar1, balance: 0, paid: true, admin: false },
      { id: "m4", name: "Priya K.", avatar: avatar1, balance: -290, paid: false, admin: false },
      { id: "m5", name: "Marcus R.", avatar: avatar2, balance: -290, paid: false, admin: false },
    ],
    deposits: [
      { id: "d1", name: "Luke Michalik", avatar: avatar2, amount: 290, date: "Sep 12" },
      { id: "d2", name: "Cole Connors", avatar: avatar3, amount: 0, date: "Pending" },
    ],
    fundingRequests: [
      {
        id: "fr1",
        title: "Social Dues Fall 2026",
        due: "Sep 14, 2026",
        amount: 290,
        audience: "All members",
        collected: 290,
        goal: 7540,
      },
      {
        id: "fr2",
        title: "Spring formal deposit",
        due: "Oct 30, 2026",
        amount: 65,
        audience: "All members",
        collected: 0,
        goal: 2015,
      },
    ],
    expenses: [
      { id: "ad1", title: "Tailgate catering", payer: "Luke Michalik", date: "Aug 27", total: 272.5, each: 8.79, category: "Food", paid: false },
      { id: "ad2", title: "Team banners", payer: "Cole Connors", date: "Aug 21", total: 148, each: 4.77, category: "Fun", paid: true },
    ],
  },
};
