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

Secret requis : `REALROOM_SERVICE_KEY`, au moins 32 caractères aléatoires. Cible : une NVIDIA L4 (`l4x1`), sans allocation automatique. Le runtime alterne SemLayoutDiff (placements) puis Qwen (programme, personnalisation, critique et chat), en terminant le premier processus avant de charger le suivant.

Les poids SLDN/APM officiels sont préparés au build, avec révision commune et empreintes SHA-256. Qwen est téléchargé au premier appel qui en a besoin. `/health` vérifie les fichiers et interpréteurs préparés ; HTTP 200 ne prouve ni le chargement des réseaux ni la qualité d’une inférence. Les chargements se font dans la file de calcul.

Cette version est expérimentale : code et protocole testés sur CPU. Un essai L4 rapporte une inférence SemLayoutDiff et le chargement de Qwen, mais aucun résultat complet récupéré ne valide le parcours, le chat ou la qualité. Le job de validation a été arrêté. Ne démarrer du matériel payant qu’après autorisation explicite. Le modèle spatial couvre salon, chambre et salle à manger, dans une emprise maximale de 11,80 m par axe. Les autres pièces sont refusées explicitement.

`POST /v1/jobs` crée un calcul ; `GET /v1/jobs/:id` retourne progression et résultat ; `POST /v1/jobs/:id/cancel` l’annule. Authentification : en-tête `x-realroom-service-key`. Le Space privé nécessite aussi l’authentification Hugging Face.

Voir `docs/huggingface-backend.md` pour le branchement, les limites et les tests. Les propositions sont contrôlées géométriquement ; leur qualité esthétique doit être évaluée sur des pièces représentatives.
