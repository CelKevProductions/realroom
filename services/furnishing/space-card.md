---
title: RealRoom Furnishing Backend
emoji: 🛋️
colorFrom: green
colorTo: gray
sdk: docker
app_port: 7860
base_path: /health
suggested_hardware: l4x1
startup_duration_timeout: 1h
models:
  - RedHatAI/Qwen3.5-9B-FP8-dynamic
---

# RealRoom — service d’ameublement

API privée pour l’interface RealRoom existante. Le plan est fourni en mètres après import DXF et validation de ses ouvertures.

Secret requis : `REALROOM_SERVICE_KEY`, au moins 32 caractères aléatoires. Matériel : NVIDIA L4 (`l4x1`). Le modèle est téléchargé au premier démarrage. `/health` passe de HTTP 503 à HTTP 200 lorsque l’inférence est prête.

`POST /v1/jobs` crée un calcul ; `GET /v1/jobs/:id` retourne progression et résultat ; `POST /v1/jobs/:id/cancel` l’annule. Authentification : en-tête `x-realroom-service-key`. Le Space privé nécessite aussi l’authentification Hugging Face.

Voir `docs/huggingface-backend.md` pour le branchement, les limites et les tests. Les propositions sont contrôlées géométriquement ; leur qualité esthétique doit être évaluée sur des pièces représentatives.
