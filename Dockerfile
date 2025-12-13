# Dockerfile (HTTPS with self-signed certificates)
FROM node:24-alpine

WORKDIR /app

# Install openssl to generate certificates
RUN apk add --no-cache openssl

# Copy dependencies and install
COPY package*.json ./
RUN npm install --only=production

# Copy the rest of the code
COPY app/ .

# Automatically generate a self-signed certificate
RUN mkdir certs && \
  openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout certs/key.pem \
  -out certs/cert.pem \
  -days 365 \
  -subj "/CN=localhost"

# Expose HTTPS port
EXPOSE 443

CMD ["npm", "start"]

