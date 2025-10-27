// Spacing system for Wayfinder

export const spacing = {
	xs: '0.5rem', // 8px
	sm: '0.75rem', // 12px
	md: '1rem', // 16px
	lg: '1.5rem', // 24px
	xl: '2rem', // 32px
	'2xl': '3rem', // 48px
	'3xl': '4rem', // 64px
} as const;

export const borderRadius = {
	sm: '0.375rem', // 6px - inputs
	md: '0.5rem', // 8px - cards
	lg: '0.75rem', // 12px - modals
	xl: '1rem', // 16px - special elements
	full: '9999px', // Pills/badges
} as const;

export type SpacingKey = keyof typeof spacing;
export type BorderRadiusKey = keyof typeof borderRadius;

