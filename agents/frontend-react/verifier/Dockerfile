# Imagem do verificador de testes (runner "docker:solvers-react-test").
# Build: docker build -t solvers-react-test agents/frontend-react/verifier
# Execução (feita pelo servidor):
#   docker run --rm --network none --cpus 1 --memory 768m --read-only \
#     --tmpfs /tmp:rw,size=64m --tmpfs /work/node_modules/.vite-temp:rw,size=16m \
#     --env HOME=/tmp --ulimit fsize=8000000:8000000 --user node \
#     -v <entrega>:/work/src:ro -v <relatorio>:/work/report solvers-react-test
# (rootfs somente leitura: só /tmp, o .vite-temp do vite e /work/report aceitam escrita)
FROM node:22-alpine

WORKDIR /work

COPY package.json ./
RUN npm install --no-audit --no-fund && npm cache clean --force

COPY vitest.config.ts setup.ts ./

# O servidor roda o container como o usuário "node" (sem root): ele precisa escrever o cache do vitest.
RUN mkdir -p /work/report && chown -R node:node /work

ENV CI=true NODE_ENV=test

# A entrega é montada em /work/src. Código de saída 0 = todos os testes passaram.
CMD ["npx", "--no-install", "vitest", "run", "--reporter=json"]
