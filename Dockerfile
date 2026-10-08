FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS reader
WORKDIR /app
COPY package.json ./
COPY server ./server
COPY src/api/studioTypes.ts ./src/api/studioTypes.ts
ENV TAMPER_STUDIO_HOST=0.0.0.0 TAMPER_STUDIO_PORT=7502
EXPOSE 7502
CMD ["node", "--experimental-strip-types", "server/start.ts"]

FROM nginx:1.27-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
