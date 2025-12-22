# Mise en veille des onglets & comportement hors-ligne (Dmon)

## Pourquoi les onglets sont mis en veille
- Les navigateurs (Chrome/Edge) gèrent la mémoire et l'énergie en suspendant ou en supprimant les onglets inactifs.
- `Freeze` : timers et animations sont fortement restreints.
- `Discard` : le processus est tué, le DOM est perdu et la page doit être rechargée.

## Pour l'utilisateur
- Chrome: `chrome://discards` et flags `#automatic-tab-discarding` (expérimental).
- Edge: Paramètres → Système → "Save resources with sleeping tabs" (désactivation ou exceptions).
- Épingler un onglet réduit la probabilité de suppression.

## Bonnes pratiques pour l'application
- Implémenter un Service Worker (App Shell) pour charger rapidement une UI minimaliste.
- Sauvegarder l'état essentiel (IndexedDB/localStorage) régulièrement.
- Gérer la reconnexion (WebSocket/SSE) et proposer une UI de reconnection.

## Dmon — changements récents
- Ajout de `public/sw.js` (App Shell caching)
- Sauvegarde locale des dernières données SSE et restauration rapide de l'UI au chargement
- Reconnexion SSE améliorée et message utilisateur lors d'erreur réseau

## Tab discarding (suppression d'onglet) — explication et gestion dans Dmon
- Qu'est-ce que c'est : le "tab discarding" (ou discard) est une optimisation du navigateur qui peut tuer le processus d'un onglet inactif pour libérer mémoire/énergie. Le DOM et l'état en mémoire sont perdus, et la page doit être rechargée quand l'utilisateur revient.

- Comment Dmon gère ce cas :
  - **Service Worker (`public/sw.js`)** 🔧
    - Sert l'App Shell depuis le cache (`CACHE_NAME`) pour permettre un chargement rapide après un rechargement de page.
    - Gère la navigation en **stale-while-revalidate** : la page mise en cache (`'/'`) est renvoyée immédiatement et une requête réseau la met à jour en arrière-plan—utile quand l'onglet a été rechargé après un discard.
    - Cache aussi les ressources CDN (cache-first) pour accélérer la restauration hors-ligne.

  - **Gestion d'état et reconnexion (`app/public/js/lifecycle.js`)** 🔁
    - Sauvegarde régulière des derniers événements SSE dans `localStorage` (`dmon:lastSSE`) et restaure l'UI au chargement via `restoreFromCache()` pour afficher rapidement des données même si la page a été rechargée.
    - Réétablit la connexion SSE (`connectSSE()`), avec reconnexion progressive (exponential backoff) et messages utilisateur en cas d'erreur.
    - Comportements liés à la visibilité : fermeture propre de la connexion quand la page est cachée, suspension après un délai (pour limiter l'activité de fond) et reprise à la visibilité.

- En pratique : si un onglet est discarded, l'utilisateur retrouve immédiatement une UI (servie par le Service Worker) qui présente les dernières données connues (restaurées depuis `localStorage`), puis la page rétablit automatiquement la connexion SSE pour obtenir les données fraîches.

## Notes opérationnelles
- Les service workers doivent être servis depuis la racine pour contrôler tout le site (`/sw.js`).
- Les flags navigateur sont expérimentaux et ne doivent pas être diffusés comme solution universelle.
