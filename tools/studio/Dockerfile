FROM node:24-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm exec playwright install --with-deps chromium
COPY tsconfig.json ./
COPY src ./src
COPY tools/studio ./tools/studio
ENV NODE_ENV=production
CMD ["node","--import","tsx","tools/studio/launch.ts","worker"]
