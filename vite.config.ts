import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    build: {
        // three.js alone is ~600 kB minified; it is split into its own long-cached chunk below
        chunkSizeWarningLimit: 700,
        rollupOptions: {
            output: {
                // three.js is most of the bundle and changes rarely: give it its own cacheable chunk
                manualChunks: id => (id.includes("node_modules/three") ? "three" : undefined),
            },
        },
    },
});
