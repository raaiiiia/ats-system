/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        feishu: "#3370FF",
        page: "#F5F8FF",
        ink: "#17233D"
      },
      boxShadow: {
        soft: "0 10px 28px rgba(31, 66, 135, 0.08)"
      },
      borderRadius: {
        app: "12px"
      }
    }
  },
  plugins: []
};

