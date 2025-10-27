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
				// Light mode base colors - WARMER
				'bg-light': '#FDF8F4',        // Warm cream instead of grey
				'surface-light': '#FFFCF9',   // Slightly warm white
				'surface-hover-light': '#FEF6EE', // Peachy hover
				'text-primary-light': '#2B1810', // Warm dark brown
				'text-secondary-light': '#78614D', // Warm medium brown
				'text-tertiary-light': '#A08B78',  // Warm light brown
				'border-light': '#E8DDD1',     // Warm beige border
				'border-hover-light': '#D9C6B3', // Darker warm border
				
				// Dark mode base colors - WARMER
				'bg-dark': '#1A1410',          // Warm black (not blue-black)
				'surface-dark': '#2B231D',     // Warm charcoal
				'surface-hover-dark': '#3D332A', // Lighter warm charcoal
				'text-primary-dark': '#FFF9F2', // Warm white
				'text-secondary-dark': '#BFB4A8', // Warm grey
				'text-tertiary-dark': '#8A7D6F',  // Darker warm grey
				'border-dark': '#3D332A',      // Warm border
				'border-hover-dark': '#4D4239', // Lighter warm border
				
				// Primary accent (Blue)
				primary: {
					DEFAULT: '#3B82F6',
					hover: '#2563EB',
					subtle: '#EFF6FF',
					dark: '#60A5FA',
					'dark-hover': '#3B82F6',
					'dark-subtle': '#1E3A8A',
				},
				
				// Secondary accent (Coral/Orange)
				secondary: {
					DEFAULT: '#F97316',
					hover: '#EA580C',
					subtle: '#FFF7ED',
					dark: '#FB923C',
					'dark-hover': '#F97316',
					'dark-subtle': '#7C2D12',
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
				
				// Legacy aliases for backward compatibility
				error: '#EF4444',
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
