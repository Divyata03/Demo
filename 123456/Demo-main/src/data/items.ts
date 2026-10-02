export type ItemStatus = "lost" | "found";

export const CATEGORIES = [
  "Keys",
  "Bottles",
  "Phones",
  "Bags",
  "Cards",
  "Books",
  "Clothing",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Item = {
  id: string;
  status: ItemStatus;
  category: Category;
  title: string;
  location: string;
  time: string;
  description?: string | undefined;
  photoUrl?: string | undefined;
  /** First name + campus role only — never contact details. */
  reporter?: string | undefined;
  occurredAt?: string | undefined;
  createdAt?: string | undefined;
  itemStatus?: "open" | "claimed" | "returned" | undefined;
  isHidden?: boolean | undefined;
};

export const CATEGORY_ICON: Record<Category, string> = {
  Keys: "🔑",
  Bottles: "🧴",
  Phones: "📱",
  Bags: "🎒",
  Cards: "💳",
  Books: "📚",
  Clothing: "🧥",
  Other: "📦",
};

/*
 * Placeholder board entries — generic descriptions only.
 * No personal names, phone numbers or ID numbers anywhere.
 */
export const ITEMS: Item[] = [
  {
    id: "r1",
    status: "lost",
    category: "Keys",
    title: "Bundle of keys with a blue keyring",
    location: "Library, ground floor",
    time: "2 days ago",
  },
  {
    id: "r2",
    status: "found",
    category: "Bottles",
    title: "Black water bottle, no markings",
    location: "Sports hall",
    time: "5 days ago",
  },
  {
    id: "r3",
    status: "found",
    category: "Cards",
    title: "Student ID card, kept unopened",
    location: "Cafeteria",
    time: "1 week ago",
  },
  {
    id: "r4",
    status: "lost",
    category: "Bags",
    title: "Grey backpack with a red zipper",
    location: "Lecture hall B",
    time: "1 week ago",
  },
  {
    id: "r5",
    status: "lost",
    category: "Books",
    title: "Blue lecture notebook, torn corner",
    location: "Study lounge",
    time: "2 weeks ago",
  },
  {
    id: "r6",
    status: "found",
    category: "Phones",
    title: "Phone in a clear case, locked",
    location: "Main quad",
    time: "2 weeks ago",
  },
  {
    id: "r7",
    status: "found",
    category: "Clothing",
    title: "Navy hooded jacket, medium size",
    location: "Student union lounge",
    time: "3 days ago",
  },
  {
    id: "r8",
    status: "lost",
    category: "Bottles",
    title: "Steel flask with a black cap",
    location: "Sports field",
    time: "4 days ago",
  },
  {
    id: "r9",
    status: "found",
    category: "Books",
    title: "Maths textbook, name page removed",
    location: "Lecture hall A",
    time: "5 days ago",
  },
  {
    id: "r10",
    status: "lost",
    category: "Phones",
    title: "Phone with a blue silicone case",
    location: "Cafeteria",
    time: "6 days ago",
  },
  {
    id: "r11",
    status: "found",
    category: "Keys",
    title: "Single hostel room key on a tag",
    location: "Main gate",
    time: "1 week ago",
  },
  {
    id: "r12",
    status: "lost",
    category: "Cards",
    title: "Canteen meal card in a yellow holder",
    location: "Food court",
    time: "1 week ago",
  },
  {
    id: "r13",
    status: "found",
    category: "Bags",
    title: "Small drawstring sports bag",
    location: "Gym changing room",
    time: "2 weeks ago",
  },
  {
    id: "r14",
    status: "lost",
    category: "Clothing",
    title: "Black scarf with grey stripes",
    location: "Auditorium",
    time: "2 weeks ago",
  },
  {
    id: "r15",
    status: "found",
    category: "Other",
    title: "Umbrella with a wooden handle",
    location: "Library entrance",
    time: "3 weeks ago",
  },
  {
    id: "r16",
    status: "lost",
    category: "Other",
    title: "Safety goggles in a green case",
    location: "Science block",
    time: "3 weeks ago",
  },
];

export const COMMON_PLACES = [
  "Library",
  "Cafeteria",
  "Lecture halls",
  "Sports field",
  "Main gate",
  "Hostel",
];
