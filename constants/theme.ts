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
  hero: { fontSize: 22, fontWeight: '900' as const },
  sectionTitle: { fontSize: 16, fontWeight: '900' as const },
  cardTitle: { fontSize: 12, fontWeight: '800' as const },
  cardSub: { fontSize: 9, fontWeight: '400' as const, color: 'rgba(255,255,255,0.3)' },
  sectionLabel: { fontSize: 8, fontWeight: '700' as const, letterSpacing: 1.8, textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.25)' },
  metricValue: { fontSize: 20, fontWeight: '900' as const },
  metricLabel: { fontSize: 7, fontWeight: '500' as const, color: 'rgba(255,255,255,0.3)' },
  navLabel: { fontSize: 8, fontWeight: '500' as const },
  alertText: { fontSize: 10, fontWeight: '400' as const, color: 'rgba(255,255,255,0.5)' },
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
