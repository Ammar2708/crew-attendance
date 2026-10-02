import '@/global.css';

/** Shared Site Ledger tokens for web, iOS, and Android. */
export const Palette = {
  ink: '#1A2029',
  paper: '#EDEAE2',
  steel: '#4A5568',
  line: '#C9C2B4',
  safety: '#F5A623',
  onSite: '#3F7D58',
  alert: '#B4472A',
  surface: '#F5F3ED',
} as const;

const ledgerColors = {
  text: Palette.ink,
  background: Palette.paper,
  backgroundElement: Palette.surface,
  backgroundSelected: Palette.safety,
  textSecondary: Palette.steel,
} as const;

// Compatibility aliases for the starter components that still use useTheme.
export const Colors = { light: ledgerColors, dark: ledgerColors } as const;
export type ThemeColor = keyof typeof ledgerColors;

export const Fonts = {
  sans: 'IBMPlexSans_400Regular',
  sansMedium: 'IBMPlexSans_500Medium',
  sansSemiBold: 'IBMPlexSans_600SemiBold',
  sansBold: 'IBMPlexSans_700Bold',
  mono: 'IBMPlexMono_400Regular',
  monoSemiBold: 'IBMPlexMono_600SemiBold',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 48,
  seven: 64,
} as const;

export const Radius = { control: 3, stamp: 2 } as const;

export const Layout = {
  pagePadding: 20,
  desktopPagePadding: 32,
  narrow: 560,
  content: 920,
  wide: 1180,
} as const;

export const Motion = {
  pressIn: 80,
  pressOut: 120,
  toggle: 180,
  stamp: 220,
  screen: 200,
} as const;

export const BottomTabInset = 0;
export const MaxContentWidth = Layout.content;
