// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // This tells Tailwind to scan all JS/JSX/TS/TSX files in the src folder
    "./public/index.html",       // And also your main HTML file
  ],
  theme: {
    extend: {
      fontFamily: {
        inter: ['Inter', 'sans-serif'], // Ensure 'Inter' font is recognized
      },
      colors: {
        // Your custom colors from the App.js styling
        'purple-600': '#8A2BE2',
        'pink-500': '#FF69B4',
        'purple-700': '#6A0DAD',
        'pink-600': '#E91E63',
        'purple-500': '#9C27B0',
        'purple-100': '#F3E5F5',
        'pink-50': '#FCE4EC',
        'purple-50': '#EDE7F6',
        'pink-200': '#F8BBD0',
        'purple-200': '#D1C4E9',
        'yellow-50': '#FFFDE7',
        'yellow-200': '#FFF9C4',
        'yellow-800': '#F57F17',
        'blue-100': '#BBDEFB',
        'blue-600': '#2196F3',
        'red-100': '#FFCDD2',
        'red-600': '#E53935',
      }
    },
  },
  plugins: [],
}