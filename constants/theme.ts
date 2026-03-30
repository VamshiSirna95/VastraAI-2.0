export const colors = {
  background: '#000000',
  surface: 'rgba(255,255,255,0.04)',
  surfaceBorder: 'rgba(255,255,255,0.06)',
  surfaceElevated: 'rgba(255,255,255,0.08)',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.45)',
  textTertiary: 'rgba(255,255,255,0.25)',
  divider: 'rgba(255,255,255,0.04)',
  teal: '#5DCAA5',
  amber: '#EF9F27',
  blue: '#378ADD',
  purple: '#7F77DD',
  red: '#E24B4A',
  pink: '#ED93B1',
  purpleLight: '#AFA9EC',
} as const;

export const typography = {
  hero: { fontSize: 32, fontWeight: '900' as const, lineHeight: 36 },
  sectionTitle: { fontSize: 22, fontWeight: '900' as const },
  cardTitle: { fontSize: 16, fontWeight: '800' as const },
  cardSub: { fontSize: 12, fontWeight: '400' as const, color: 'rgba(255,255,255,0.3)' },
  sectionLabel: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 2.5, textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.25)' },
  metricValue: { fontSize: 28, fontWeight: '900' as const },
  metricLabel: { fontSize: 11, fontWeight: '500' as const, color: 'rgba(255,255,255,0.3)' },
  navLabel: { fontSize: 10, fontWeight: '500' as const },
  alertText: { fontSize: 14, fontWeight: '400' as const, color: 'rgba(255,255,255,0.5)' },
} as const;

export const spacing = {
  screenPadding: 20,
  cardPadding: 16,
  sectionGap: 20,
  cardGap: 12,
} as const;

export const glass = {
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
  },
  navbar: {
    backgroundColor: 'rgba(0,0,0,0.88)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
} as const;
