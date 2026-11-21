FROM node:22-alpine

RUN apk add --no-cache tzdata

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js ./
COPY src ./src
COPY public ./public

RUN mkdir -p /data && chown node:node /data

ENV DATA_DIR=/data
ENV PORT=3000
ENV TZ=Asia/Seoul

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1

CMD ["node", "server.js"]