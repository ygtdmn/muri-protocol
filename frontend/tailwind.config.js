export default {
	content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
	darkMode: "class",
	theme: {
		extend: {
			fontFamily: {
				sans: ['-apple-system', 'BlinkMacSystemFont', 'Inter', '"Segoe UI"', 'sans-serif'],
				mono: ['"Geist Mono"', 'Menlo', 'Monaco', 'monospace'],
			},
			colors: {
				// Light mode base colors - clean and minimal
				'bg-light': '#FEFEFE',           // Almost white, very clean
				'surface-light': '#FFFFFF',
				'surface-hover-light': '#F8F8F8', // Subtle grey hover
				'text-primary-light': '#1A1A1A',
				'text-secondary-light': '#525252',
				'text-tertiary-light': '#A3A3A3',
				'border-light': '#E8E8E8',       // Clean grey border
				'border-hover-light': '#D0D0D0', // Slightly darker
				
				// Dark mode base colors - rich and deep
				'bg-dark': '#0F0F0F',            // Rich black
				'surface-dark': '#1A1A1A',       // Dark charcoal
				'surface-hover-dark': '#252525', // Lighter charcoal
				'text-primary-dark': '#FAFAFA',
				'text-secondary-dark': '#A3A3A3',
				'text-tertiary-dark': '#737373',
				'border-dark': '#2A2A2A',        // Subtle dark border
				'border-hover-dark': '#404040',  // Lighter dark border
				
				// Primary accent (Orange) - Energetic, warm, creative
				primary: {
					DEFAULT: '#FF6B35',        // Vibrant orange
					hover: '#E85A28',          // Darker orange
					subtle: '#FFF4F0',         // Very light orange tint
					dark: '#FF5722',           // Rich, saturated orange for dark mode
					'dark-hover': '#F4511E',   // Deeper orange hover
					'dark-subtle': '#4D2010',  // Deep orange shadow
				},
				
				// Secondary accent (Purple) - Sophisticated, creative balance
				secondary: {
					DEFAULT: '#7B2CBF',        // Rich purple
					hover: '#6A24A3',          // Darker purple
					subtle: '#F7F0FF',         // Very light purple tint
					dark: '#9D4EDD',           // Lighter purple for dark mode
					'dark-hover': '#7B2CBF',   // Standard purple
					'dark-subtle': '#2D0F47',  // Deep purple shadow
				},
				
				// Status colors
				success: {
					DEFAULT: '#10B981',
					subtle: '#ECFDF5',
					dark: '#34D399',
					'dark-subtle': '#064E3B',
				},
				warning: {
					DEFAULT: '#F59E0B',
					subtle: '#FFFBEB',
					dark: '#FBBF24',
					'dark-subtle': '#78350F',
				},
				danger: {
					DEFAULT: '#EF4444',
					subtle: '#FEF2F2',
					dark: '#F87171',
					'dark-subtle': '#7F1D1D',
				},
				info: {
					DEFAULT: '#06B6D4',
					subtle: '#ECFEFF',
					dark: '#22D3EE',
					'dark-subtle': '#164E63',
				},
			},
			borderRadius: {
				'sm': '0.375rem',
				'md': '0.5rem',
				'lg': '0.75rem',
				'xl': '1rem',
			},
			boxShadow: {
				'soft': '0 2px 8px rgba(0, 0, 0, 0.04)',
				'medium': '0 4px 16px rgba(0, 0, 0, 0.08)',
				'strong': '0 8px 32px rgba(0, 0, 0, 0.12)',
			},
			animation: {
				'fade-in': 'fadeIn 0.3s ease-in-out',
				'slide-up': 'slideUp 0.3s ease-out',
				'scale-in': 'scaleIn 0.2s ease-out',
			},
			keyframes: {
				fadeIn: {
					'0%': { opacity: '0' },
					'100%': { opacity: '1' },
				},
				slideUp: {
					'0%': { transform: 'translateY(10px)', opacity: '0' },
					'100%': { transform: 'translateY(0)', opacity: '1' },
				},
				scaleIn: {
					'0%': { transform: 'scale(0.95)', opacity: '0' },
					'100%': { transform: 'scale(1)', opacity: '1' },
				},
			},
		},
	},
	plugins: [],
};
