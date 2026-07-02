/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        chitchatTeal: "#008069",       // WhatsApp Green/Teal
        chitchatDarkTeal: "#075E54",   // Dark Teal
        chitchatLightGreen: "#D9FDD3",  // Sent bubble
        chitchatChatBg: "#EFEAE2",      // Chat backdrop
        chitchatActive: "#00A884",      // Active state highlight
        chitchatGray: "#F0F2F5",        // Light gray background
        chitchatTextDark: "#111B21",    // Near black text
        chitchatTextLight: "#667781",   // Secondary text
      },
    },
  },
  plugins: [],
}
