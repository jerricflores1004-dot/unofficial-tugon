import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#1E3A5F', blue: '#2563EB', 'blue-soft': '#DBEAFE',
        emergency: '#DC2626', critical: '#B91C1C', high: '#EA580C', medium: '#D97706', low: '#16A34A',
        ink: '#1E293B', muted: '#64748B', canvas: '#E8EDF3', surface: '#F1F5F9', elevated: '#F8FAFC'
      },
      boxShadow: {
        neumorphic: '8px 8px 18px rgba(163,177,198,.35), -8px -8px 18px rgba(255,255,255,.85)',
        'neumorphic-dark': '7px 7px 16px rgba(0,0,0,.24), -5px -5px 14px rgba(53,65,85,.20)',
        inset: 'inset 4px 4px 10px rgba(163,177,198,.25), inset -4px -4px 10px rgba(255,255,255,.70)'
      },
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'] },
      borderRadius: { xl: '16px', '2xl': '20px' }
    }
  },
  plugins: []
};
export default config;
