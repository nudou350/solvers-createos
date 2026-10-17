import { defineConfig } from "vitest/config";

export default defineConfig({
  // O servidor roda o container com rootfs somente leitura (--read-only): o cache do vite/vitest vai para o tmpfs /tmp.
  cacheDir: "/tmp/vite-cache",
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    testTimeout: 10_000,
    // Relatório JSON sempre no mesmo caminho: /work/report/vitest.json dentro do container.
    outputFile: { json: "./report/vitest.json" },
    // Sandbox sem rede e com CPU limitada: um único worker evita estourar memória.
    pool: "forks",
    maxWorkers: 1,
  },
});
