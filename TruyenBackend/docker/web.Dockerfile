FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY src ./src
COPY public ./public
COPY tsconfig*.json index.html vite.config.ts ./
ENV VITE_API_URL=""
RUN node node_modules/typescript/bin/tsc -b && node node_modules/vite/bin/vite.js build
FROM nginx:stable-alpine
COPY --from=dockerconfig nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
