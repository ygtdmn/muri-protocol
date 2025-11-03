// Color palette for MURI Protocol
// Based on "Friendly Workshop" design direction

export const colors = {
	light: {
		// Base - WARMER
		background: '#FDF8F4',      // Warm cream
		surface: '#FFFCF9',         // Slightly warm white
		surfaceHover: '#FEF6EE',    // Peachy hover

		// Text - WARMER
		textPrimary: '#2B1810',     // Warm dark brown
		textSecondary: '#78614D',   // Warm medium brown
		textTertiary: '#A08B78',    // Warm light brown

		// Borders - WARMER
		border: '#E8DDD1',          // Warm beige
		borderHover: '#D9C6B3',     // Darker warm beige

		// Accents
		primary: '#3B82F6',
		primaryHover: '#2563EB',
		primarySubtle: '#EFF6FF',

		secondary: '#F97316',
		secondaryHover: '#EA580C',
		secondarySubtle: '#FFF7ED',

		// Status
		success: '#10B981',
		successSubtle: '#ECFDF5',
		warning: '#F59E0B',
		warningSubtle: '#FFFBEB',
		danger: '#EF4444',
		dangerSubtle: '#FEF2F2',
		info: '#06B6D4',
		infoSubtle: '#ECFEFF',
	},

	dark: {
		// Base - WARMER
		background: '#1A1410',      // Warm black
		surface: '#2B231D',         // Warm charcoal
		surfaceHover: '#3D332A',    // Lighter warm charcoal

		// Text - WARMER
		textPrimary: '#FFF9F2',     // Warm white
		textSecondary: '#BFB4A8',   // Warm grey
		textTertiary: '#8A7D6F',    // Darker warm grey

		// Borders - WARMER
		border: '#3D332A',          // Warm border
		borderHover: '#4D4239',     // Lighter warm border

		// Accents
		primary: '#60A5FA',
		primaryHover: '#3B82F6',
		primarySubtle: '#1E3A8A',

		secondary: '#FB923C',
		secondaryHover: '#F97316',
		secondarySubtle: '#7C2D12',

		// Status
		success: '#34D399',
		successSubtle: '#064E3B',
		warning: '#FBBF24',
		warningSubtle: '#78350F',
		danger: '#F87171',
		dangerSubtle: '#7F1D1D',
		info: '#22D3EE',
		infoSubtle: '#164E63',
	},
} as const;

export type ColorMode = keyof typeof colors;
export type ColorKey = keyof typeof colors.light;

