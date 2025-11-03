// Typography system for MURI Protocol

export const typography = {
	// Display (landing pages)
	display: {
		fontSize: '3.5rem', // 56px
		lineHeight: '1.1',
		fontWeight: 700,
		letterSpacing: '-0.02em',
	},

	// Headings
	h1: {
		fontSize: '2.25rem', // 36px
		lineHeight: '1.2',
		fontWeight: 700,
	},
	h2: {
		fontSize: '1.875rem', // 30px
		lineHeight: '1.3',
		fontWeight: 600,
	},
	h3: {
		fontSize: '1.5rem', // 24px
		lineHeight: '1.4',
		fontWeight: 600,
	},
	h4: {
		fontSize: '1.25rem', // 20px
		lineHeight: '1.4',
		fontWeight: 600,
	},

	// Body
	bodyLarge: {
		fontSize: '1.125rem', // 18px
		lineHeight: '1.6',
	},
	body: {
		fontSize: '1rem', // 16px
		lineHeight: '1.6',
	},
	bodySmall: {
		fontSize: '0.875rem', // 14px
		lineHeight: '1.5',
	},

	// UI
	label: {
		fontSize: '0.875rem', // 14px
		lineHeight: '1.4',
		fontWeight: 500,
	},
	caption: {
		fontSize: '0.75rem', // 12px
		lineHeight: '1.4',
	},

	// Mono
	mono: {
		fontFamily: "'Geist Mono', 'Menlo', monospace",
		fontSize: '0.875rem',
	},
} as const;

export type TypographyKey = keyof typeof typography;

