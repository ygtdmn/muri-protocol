// Central theme exports for Wayfinder design system

export * from './colors';
export * from './spacing';
export * from './typography';

import { colors } from './colors';
import { spacing, borderRadius } from './spacing';
import { typography } from './typography';

export const theme = {
	colors,
	spacing,
	borderRadius,
	typography,
} as const;

export default theme;

