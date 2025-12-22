# Changelog

All notable changes are listed below. Minimal, bilingual entries (English / Français).

## [1.3.0] - 2025-12-21

EN:
- Docs: Add standardized file headers to server and frontend files; add/expand JSDoc comments for functions and constants across frontend JS for better clarity and maintainability.
- Intl: Translate internal comments from French to English across frontend and server files (e.g., `charts.js`, `core.js`, `renderer.js`, `lifecycle.js`, `sw.js`, `server.js`, `views/index.ejs`).
- Code: Add JSDoc for top-level constants and state, clarify resize handler and history utilities, and document chart option helpers.
- Misc: Clarify Service Worker comments and add header metadata.

FR:
- Docs : Ajout d'en‑têtes standardisés dans les fichiers serveur et frontend ; ajout/extension des commentaires JSDoc pour les fonctions et constantes dans les fichiers JS frontend pour une meilleure lisibilité et maintenabilité.
- Intl : Traduction des commentaires internes du français vers l'anglais dans les fichiers frontend et serveur (ex. `charts.js`, `core.js`, `renderer.js`, `lifecycle.js`, `sw.js`, `server.js`, `views/index.ejs`).
- Code : Ajout de JSDoc pour les constantes et l'état global, clarification du gestionnaire de redimensionnement et des utilitaires d'historique, documentation des options de chart.
- Divers : Clarification des commentaires du Service Worker et ajout des métadonnées d'en‑tête.

## [1.2.0] - 2025-12-18

EN:
- Fix: minor bug fixes and documentation clarifications (note about 80 → 443 redirect).
- Security: pin base images by digest.

FR:
- Correction : petites corrections et clarifications de la documentation (note sur la redirection 80 → 443).
- Sécurité : verrouillage des images par digest.

## [1.1.0] - 2025-12-17

EN:
- Security: Hardened Docker image and compose (non-root user, read-only filesystem, dropped capabilities, no-new-privileges, tmpfs, docker-socket-proxy).
- Build: Multi-stage build, generate certs during build, npm install --only=production, expose only port 443.
- Recommendations: Use CA-signed certs, pin images by digest, run vulnerability scans, add resource limits and healthcheck.

FR:
- Sécurité : Durcissement de l'image et de docker-compose (utilisateur non-root, filesystem lecture-seule, suppression de capacités, no-new-privileges, tmpfs, proxy socket Docker).
- Build : Multi-stage build, génération des certificats en build, `npm install --only=production`, exposition uniquement du port 443.
- Recommandations : Certificats signés par une CA, verrouiller les images par digest, scans de vulnérabilités, ajouter limites de ressources et `healthcheck`.

