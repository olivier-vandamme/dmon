# Stage 1: Builder with openssl
FROM node:24-alpine AS builder
WORKDIR /app

# Install openssl only in this stage
RUN apk add --no-cache openssl

# Generate self-signed certificates
RUN mkdir certs && \
    openssl req -x509 -newkey rsa:2048 -nodes \
      -keyout certs/key.pem \
      -out certs/cert.pem \
      -days 365 \
      -subj "/CN=localhost"

# Stage 2: Final image without openssl
FROM node:24-alpine
WORKDIR /app

# Créer un utilisateur et un groupe non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copier les dépendances et installer
COPY package*.json ./
RUN npm install --only=production

# Copier le code applicatif
COPY app/ .

# Copier les certificats générés depuis le builder
COPY --from=builder /app/certs ./certs

# Changer les permissions pour l'utilisateur dédié
RUN chown -R appuser:appgroup /app

# Exécuter en tant qu'utilisateur non-root
USER appuser

# Exposer le port HTTPS
EXPOSE 443

CMD ["npm", "start"]
