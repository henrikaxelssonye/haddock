/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Qlik-style selection colors
        'selection': {
          'selected': '#52BE80',      // Green - user selected
          'possible': '#FFFFFF',       // White - associated values
          'alternative': '#D5D8DC',    // Light gray - other values in same field
          'excluded': '#909497',       // Dark gray - not associated
        }
      }
    },
  },
  plugins: [],
}
