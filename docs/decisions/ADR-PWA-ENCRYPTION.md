# ADR — Chiffrement PWA Offline (AES-GCM + PBKDF2)

**Date :** 2026-03-21
**Statut :** Accepté
**Sprint :** 28

## Contexte

FarmFlow est utilisé en zone rurale au Cameroun sur des appareils partagés et à risque de vol.
Les données sensibles (relevés de production, prix, clients, ventes) doivent être protégées
même lorsqu'elles sont stockées localement dans IndexedDB pour le mode offline.

## Menaces en scope

| Menace | Probabilité | Impact |
|--------|------------|--------|
| Appareil partagé (famille) | Très haute | Fuite données inter-utilisateurs |
| Vol d'appareil | Haute | Accès à toutes les données locales |
| XSS lisant IndexedDB | Moyenne | Exfiltration de données sensibles |
| Fuite multi-tenant | Haute | Données d'un site visibles par un autre |

## Décision

### Algorithme : AES-GCM 256-bit (Web Crypto API natif)

**Pourquoi pas libsodium.js ?** 800KB de WASM, inacceptable sur connexion 2G rurale.
Web Crypto API est natif, accéléré matériellement sur ARM, et coût 0 en bundle size.

### Dérivation de clé : PBKDF2-SHA256, 600 000 itérations

- PIN à 6 chiffres → PBKDF2 → unlock_key
- 600 000 itérations = recommandation OWASP 2023
- Temps de brute-force PIN 6 chiffres : ~7 jours sur PC dédié
- Temps de dérivation sur appareil : ~2-4 secondes (afficher spinner)

### Architecture des clés

```
PIN (6 chiffres)
  → PBKDF2(salt par userId+siteId) → unlock_key (jamais stockée)
  → AES-GCM decrypt → data_key (en mémoire pendant la session)
  → Utilisée pour chiffrer/déchiffrer tous les records IndexedDB
```

- Chaque paire (userId, siteId) a son propre salt + data_key = **isolation cryptographique**
- data_key générée via crypto.getRandomValues() au premier setup
- data_key chiffrée avec unlock_key, stockée dans le store `auth-meta`

### Chiffrement au niveau record (pas field-level)

- Les stores chiffrés : `offline-queue`, `ref-vagues`, `ref-bacs`, `ref-produits`, `ref-clients`
- Métadonnées non chiffrées pour indexation : url, method, status, siteId, entityType
- Format record : `{ id, meta (clair), payload (AES-GCM ciphertext), iv (96-bit) }`

### Protection anti brute-force

| Tentatives | Action |
|-----------|--------|
| 3 erreurs | Délai exponentiel |
| 5 erreurs | Lockout 30 minutes |
| 10 erreurs | Wipe complet des données locales |

### Cycle de vie des clés

| Événement | Action |
|-----------|--------|
| Déconnexion douce | Effacer clé mémoire, garder IndexedDB chiffré |
| "Effacer l'appareil" | Supprimer tous les stores IndexedDB |
| Changement de site | Effacer clé site précédent, demander PIN nouveau site |
| PIN oublié | Irrécupérable — données locales effacées, reconnexion online |
| Purge Safari 7 jours | Détecter absence auth-meta → rediriger vers login online |

## Alternatives considérées

| Option | Rejetée car |
|--------|------------|
| libsodium.js | 800KB WASM, trop lourd pour 2G rural |
| Chiffrement field-level | Complexité x10, performance dégradée, pas de bénéfice réel |
| Pas de chiffrement | Inacceptable — données financières + clients sur appareils partagés |
| Biométrie seule | Pas fiable sur Android bas de gamme, pas de fallback |

## Conséquences

- Les données IndexedDB ne sont pas lisibles sans le PIN de l'utilisateur
- Un vol d'appareil ne compromet pas les données (sauf brute-force prolongé)
- Chaque utilisateur/site a une isolation cryptographique complète
- Performance : encrypt/decrypt < 5ms par record sur Android mid-range
- PIN oublié = perte des données locales (acceptable — données source sur serveur)
