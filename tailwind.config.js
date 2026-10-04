/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                avo: ["'UTM Avo'", "'UTM-Avo'", "sans-serif"],
            },
        },
    },
    plugins: [],
}