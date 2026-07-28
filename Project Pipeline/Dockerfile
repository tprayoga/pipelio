# --- Tahap build ---
FROM node:22-alpine AS build

WORKDIR /app

# package*.json disalin lebih dulu agar layer npm ci ter-cache dan build ulang
# setelah perubahan kode tidak mengunduh dependency lagi.
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Tahap serve ---
FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html
# nginx-https.conf mendefinisikan $hsts_header dan harus dimuat pada konteks
# http, sebelum blok server di default.conf.
COPY nginx-https.conf /etc/nginx/conf.d/00-https.conf
COPY nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
