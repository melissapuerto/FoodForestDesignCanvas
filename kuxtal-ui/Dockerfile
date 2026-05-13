# ─── Build stage ────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# Vite bakes env vars at build time — pass via `docker build --build-arg VITE_API_URL=...`
# or via docker-compose build.args (see docker-compose.yml).
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ─── Serve stage ────────────────────────────────────────────
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
RUN { \
  echo 'server {'; \
  echo '  listen 80;'; \
  echo '  server_name _;'; \
  echo '  root /usr/share/nginx/html;'; \
  echo '  index index.html;'; \
  echo '  gzip on;'; \
  echo '  gzip_types text/plain text/css application/javascript application/json image/svg+xml;'; \
  echo '  add_header Cross-Origin-Opener-Policy "same-origin" always;'; \
  echo '  add_header Cross-Origin-Embedder-Policy "require-corp" always;'; \
  echo '  location / { try_files $uri $uri/ /index.html; }'; \
  echo '  location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; add_header Cross-Origin-Opener-Policy "same-origin" always; add_header Cross-Origin-Embedder-Policy "require-corp" always; }'; \
  echo '}'; \
} > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
