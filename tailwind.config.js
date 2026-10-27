/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ["'Roboto'", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "sans-serif"],
                roboto: ["'Roboto'", "sans-serif"],
                avo: ["'UTM Avo'", "'UTM-Avo'", "sans-serif"],
            },
        },
    },
    plugins: [],
}