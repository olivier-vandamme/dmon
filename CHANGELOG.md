# Changelog

All notable changes are listed below. Minimal, bilingual entries (English / Français).

## [1.1.0] - 2025-12-17

EN:
- Security: Hardened Docker image and compose (non-root user, read-only filesystem, dropped capabilities, no-new-privileges, tmpfs, docker-socket-proxy).
- Build: Multi-stage build, generate certs during build, npm install --only=production, expose only port 443.
- Recommendations: Use CA-signed certs, pin images by digest, run vulnerability scans, add resource limits and healthcheck.

FR:
- Sécurité : Durcissement de l'image et de docker-compose (utilisateur non-root, filesystem lecture-seule, suppression de capacités, no-new-privileges, tmpfs, proxy socket Docker).
- Build : Multi-stage build, génération des certificats en build, `npm install --only=production`, exposition uniquement du port 443.
- Recommandations : Certificats signés par une CA, verrouiller les images par digest, scans de vulnérabilités, ajouter limites de ressources et `healthcheck`.

