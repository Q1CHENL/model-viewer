/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#736cc7',
        'primary-hover': '#667eea',
      },
      fontFamily: {
        mono: [
          'SF Mono',
          'Monaco',
          'Cascadia Code', 
          'Roboto Mono',
          'Consolas',
          'Courier New',
          'monospace'
        ]
      },
      backdropBlur: {
        '20': '20px',
      },
      keyframes: {
        slideDown: {
          'from': {
            opacity: '0',
            transform: 'translateX(-50%) translateY(-10px)',
          },
          'to': {
            opacity: '1',
            transform: 'translateX(-50%) translateY(0)',
          },
        },
      },
      animation: {
        slideDown: 'slideDown 0.3s ease',
      }
    },
  },
  plugins: [],
}