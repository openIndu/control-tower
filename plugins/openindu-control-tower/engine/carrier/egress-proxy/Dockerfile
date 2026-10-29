FROM node:22-slim
WORKDIR /app
COPY proxy.mjs ./
USER node
ENTRYPOINT ["node", "proxy.mjs"]
