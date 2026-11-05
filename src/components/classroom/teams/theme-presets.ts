import { ThemePresetId } from '@/lib/classroom/models';

export interface ThemePresetDefinition {
  id: ThemePresetId;
  name: string;
  description: string;
  cardBg: string;
  cardBorder: string;
  headerGradient: string;
  badgeBg: string;
  badgeText: string;
  accentColor: string;
  previewColors: [string, string, string];
}

export const THEME_PRESETS: Record<ThemePresetId, ThemePresetDefinition> = {
  cortex_signature: {
    id: 'cortex_signature',
    name: 'Cortex Signature',
    description: 'Obsidian black with industrial amber gold accents and metallic borders.',
    cardBg: 'bg-[#111216]',
    cardBorder: 'border-[#282A36]',
    headerGradient: 'from-[#FF9100]/20 via-[#FF9100]/5 to-transparent',
    badgeBg: 'bg-[#FF9100]/15 border-[#FF9100]/30',
    badgeText: 'text-[#FF9100]',
    accentColor: '#FF9100',
    previewColors: ['#111216', '#282A36', '#FF9100'],
  },
  aurora: {
    id: 'aurora',
    name: 'Aurora',
    description: 'Deep polar night with vibrant cyan and violet borealis luminescence.',
    cardBg: 'bg-[#0D1527]',
    cardBorder: 'border-[#1E293B]',
    headerGradient: 'from-[#06B6D4]/20 via-[#8B5CF6]/10 to-transparent',
    badgeBg: 'bg-[#06B6D4]/15 border-[#06B6D4]/30',
    badgeText: 'text-[#38BDF8]',
    accentColor: '#06B6D4',
    previewColors: ['#0D1527', '#1E293B', '#06B6D4'],
  },
  neural: {
    id: 'neural',
    name: 'Neural',
    description: 'Dark carbon base with electric synapse violet and synaptic network glow.',
    cardBg: 'bg-[#150F24]',
    cardBorder: 'border-[#2E1F4D]',
    headerGradient: 'from-[#A855F7]/20 via-[#EC4899]/10 to-transparent',
    badgeBg: 'bg-[#A855F7]/15 border-[#A855F7]/30',
    badgeText: 'text-[#C084FC]',
    accentColor: '#A855F7',
    previewColors: ['#150F24', '#2E1F4D', '#A855F7'],
  },
  circuit: {
    id: 'circuit',
    name: 'Circuit',
    description: 'Cybernetic substrate with phosphorus neon green traces and microchip accents.',
    cardBg: 'bg-[#0B1713]',
    cardBorder: 'border-[#133027]',
    headerGradient: 'from-[#10B981]/20 via-[#059669]/10 to-transparent',
    badgeBg: 'bg-[#10B981]/15 border-[#10B981]/30',
    badgeText: 'text-[#34D399]',
    accentColor: '#10B981',
    previewColors: ['#0B1713', '#133027', '#10B981'],
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    description: 'Ultra-deep true obsidian with cool polished platinum and ice sapphire sheen.',
    cardBg: 'bg-[#0A0D14]',
    cardBorder: 'border-[#1A2333]',
    headerGradient: 'from-[#3B82F6]/20 via-[#1D4ED8]/10 to-transparent',
    badgeBg: 'bg-[#3B82F6]/15 border-[#3B82F6]/30',
    badgeText: 'text-[#60A5FA]',
    accentColor: '#3B82F6',
    previewColors: ['#0A0D14', '#1A2333', '#3B82F6'],
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    description: 'Abyssal oceanic gradient with bioluminescent aquamarine and wave highlights.',
    cardBg: 'bg-[#0A1821]',
    cardBorder: 'border-[#153447]',
    headerGradient: 'from-[#14B8A6]/20 via-[#0EA5E9]/10 to-transparent',
    badgeBg: 'bg-[#14B8A6]/15 border-[#14B8A6]/30',
    badgeText: 'text-[#2DD4BF]',
    accentColor: '#14B8A6',
    previewColors: ['#0A1821', '#153447', '#14B8A6'],
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald',
    description: 'Sublime jade stone with royal forest depths and golden filigree highlights.',
    cardBg: 'bg-[#0E1A14]',
    cardBorder: 'border-[#1C3628]',
    headerGradient: 'from-[#059669]/20 via-[#10B981]/10 to-transparent',
    badgeBg: 'bg-[#059669]/15 border-[#059669]/30',
    badgeText: 'text-[#6EE7B7]',
    accentColor: '#059669',
    previewColors: ['#0E1A14', '#1C3628', '#059669'],
  },
  paper: {
    id: 'paper',
    name: 'Paper',
    description: 'Clean architectural warm slate with crisp high-contrast monochrome ink lines.',
    cardBg: 'bg-[#18181B]',
    cardBorder: 'border-[#3F3F46]',
    headerGradient: 'from-[#E4E4E7]/15 via-[#A1A1AA]/5 to-transparent',
    badgeBg: 'bg-[#E4E4E7]/15 border-[#E4E4E7]/30',
    badgeText: 'text-[#F4F4F5]',
    accentColor: '#E4E4E7',
    previewColors: ['#18181B', '#3F3F46', '#E4E4E7'],
  },
};

export const THEME_PRESET_LIST = Object.values(THEME_PRESETS);
