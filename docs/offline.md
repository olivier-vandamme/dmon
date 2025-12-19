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

## Notes opérationnelles
- Les service workers doivent être servis depuis la racine pour contrôler tout le site (`/sw.js`).
- Les flags navigateur sont expérimentaux et ne doivent pas être diffusés comme solution universelle.
