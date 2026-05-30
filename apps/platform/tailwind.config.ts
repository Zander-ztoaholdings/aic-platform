import tailwindAnimate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    // Add other paths if necessary, e.g., from shared packages
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}", // Assuming UI components are in packages/ui
  ],
  theme: {
    extend: {
      colors: {
        "aic-navy": "#0A1728",
        "aic-navy-mid": "#0A1728",
        "aic-gold": "#c36c32",
        "aic-gold-light": "#c36c32",
        "aic-paper": "#F9F8F4",
        // Add white explicitly for clarity, though it's a default Tailwind color
        "aic-white": "#F9F8F4", 
      },
      fontFamily: {
        sans: ["var(--font-space-grotesk)", "sans-serif"],
        serif: ["var(--font-crimson-pro)", "serif"],
        mono: ["var(--font-ibm-plex-mono)", "monospace"],
      },
      // Add other theme extensions as needed, mimicking existing styles
      borderRadius: {
        "lg": "0.625rem", // Tailwind's default 'lg' is 0.5rem, making it slightly larger if needed
      },
    },
  },
  plugins: [tailwindAnimate],
};
