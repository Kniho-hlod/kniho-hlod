# The API image. The build context is the repository root:
#   docker build -f apps/api/Dockerfile --build-arg NODE_AUTH_TOKEN .
# Railway hands service variables declared with ARG (here NODE_AUTH_TOKEN) to the build.

FROM node:24-bookworm-slim AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo
COPY . .

ARG NODE_AUTH_TOKEN
# pnpm takes registry tokens only from the user-level config. It never leaves this stage.
RUN printf '//npm.pkg.github.com/:_authToken=%s\n' "$NODE_AUTH_TOKEN" > /root/.npmrc \
  && pnpm install --frozen-lockfile --filter @kniho-hlod/api... \
  && pnpm --filter @kniho-hlod/api build \
  && pnpm --filter @kniho-hlod/api deploy --prod --legacy /app \
  && rm /root/.npmrc

FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app ./
USER node
CMD ["node", "dist/index.cjs"]
