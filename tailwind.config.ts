import type { Config } from "tailwindcss";

export default {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                lightCell: "var(--light-cell)",
                darkCell: "var(--dark-cell)",
                lightText: "var(--light-text)",
                darkText: "var(--dark-text)",
                highlight: "var(--highlight-color)",
                primary: "var(--primary)",
            },
            fontFamily: {
                roboto: ["var(--font-roboto)"],
            },
        },
    },
    plugins: [],
} satisfies Config;
