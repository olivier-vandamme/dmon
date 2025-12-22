# Sécurité — Dockerfile & docker-compose.yaml 🔒

Ce document décrit et explique en français les mesures de sécurité présentes dans :
- `Dockerfile`
- `docker-compose.yaml`

---

## Résumé (TL;DR) ✅
- Le build est multi‑étapes et n'installe pas OpenSSL dans l'image finale (réduit la surface d'attaque).
- L'application s'exécute sous un utilisateur non‑root (`appuser`).
- Le conteneur Dmon utilise un proxy sur le socket Docker (`docker-socket-proxy`) monté en lecture seule et configuré pour limiter fortement les actions permises.
- Le service est exécuté en lecture seule (`read_only: true`) avec `/tmp` en `tmpfs`, et toutes les capacités Linux sont retirées (`cap_drop: ALL`).
- Restrictions supplémentaires : `no-new-privileges:true`, réseau interne dédié, possibilité de monter des certificats en lecture seule.

---

## Détails et justification des mesures

### Dockerfile
- **Multi‑stage build** : OpenSSL et outils nécessaires sont installés uniquement dans l'étape de build et ne sont pas présents dans l'image finale -> moins d'outils pour un attaquant.
- **Génération de certificats dans le builder** : pratique pratique pour dev/self‑signed; **attention** : les certificats auto‑signés ne sont pas recommandés en production.
- **Non‑root user (`appuser`)** : évite d'exécuter le processus principal en tant que root, limitant l'impact d'une compromission.
- **Chown + permissions** : restreint l'accès aux fichiers d'application au compte non‑root.
- **Installation des dépendances en mode production** (`npm install --only=production`) : évite d'inclure des dépendances de développement inutiles et potentiellement dangereuses.
- **Image légère (Alpine)** : réduit la surface d'attaque.
- **EXPOSE 443 & CMD npm start** : exposition stricte du port HTTPS.

### docker‑compose.yaml
- **docker‑socket‑proxy** : interpose un proxy entre Dmon et le socket Docker, monté en lecture seule. Le proxy est configuré pour n'autoriser que des opérations de lecture (CONTAINERS: 1, IMAGES: 0, CONTAINERS_CREATE=0, etc.) — cela empêche la création/suppression/modification de containers depuis l'application.
- **Socket monté en lecture seule** (`/var/run/docker.sock:ro`) : empêche l'écriture directe sur le socket depuis le container.
- **Réseau interne isolé** : communication entre Dmon et le proxy sur un réseau interne dédié (réduit exposition réseau interne).
- **read_only: true** : système de fichiers en lecture seule pour le conteneur.
- **tmpfs /tmp** : empêche les écritures persistantes sur disque depuis `/tmp`.
- **cap_drop: ALL** : suppression de toutes les capacités Linux par défaut.
- **security_opt: no-new-privileges:true** : empêche l'escalade de privilèges via setuid/exec.
- **Option de montage des certificats en lecture seule** : permet d'utiliser des certificats signés par une CA en production (recommandé).

