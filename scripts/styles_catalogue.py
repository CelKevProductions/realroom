#!/usr/bin/env python3
"""Index visuel OpenCLIP hors requête client ; aucun entraînement, aucune photo de client.

python scripts/styles_catalogue.py --limit 8 --weights /path/open_clip_pytorch_model.bin
python scripts/styles_catalogue.py --weights /path/open_clip_pytorch_model.bin
Reprend les images déjà indexées ; --force recalcule les scores après changement de prompts.
"""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import tempfile
import urllib.request
from datetime import datetime, timezone
from importlib.metadata import version
from concurrent.futures import ThreadPoolExecutor
from collections import deque

RACINE = Path(__file__).resolve().parents[1]
MODELE = "ViT-B-32"
PREENTRAINE = "laion2b_s34b_b79k"
VERSION = 1
SHA256_POIDS = '1bd3c7172de5b207ceac554f5ab5266166f3b9baccc9af5989bc801016d080ad'


def enregistrer(dest, index):
    dest.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=dest.parent, delete=False) as f:
        json.dump(index, f, ensure_ascii=False, indent=2, allow_nan=False)
        f.write("\n")
        temp = f.name
    os.replace(temp, dest)


def charger_image(tache):
    id, url = tache
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "RealRoom-style-index/1"})
        with urllib.request.urlopen(req, timeout=25) as r:
            if not r.headers.get("Content-Type", "").startswith("image/"):
                raise ValueError("réponse non image")
            data = r.read(16 * 1024 * 1024 + 1)
        if len(data) > 16 * 1024 * 1024:
            raise ValueError("image trop volumineuse")
        return id, url, data, None
    except Exception as e:
        return id, url, None, e


def images_en_parallele(taches, workers):
    # Préchargement borné : huit images au plus avec le réglage par défaut.
    it = iter(taches)
    with ThreadPoolExecutor(max_workers=workers) as pool:
        file = deque()
        for _ in range(workers * 2):
            tache = next(it, None)
            if tache:
                file.append(pool.submit(charger_image, tache))
        while file:
            yield file.popleft().result()
            tache = next(it, None)
            if tache:
                file.append(pool.submit(charger_image, tache))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalogue", type=Path, default=RACINE / "data/catalogue.json")
    parser.add_argument("--output", type=Path, default=RACINE / "data/styles-visuels.json")
    parser.add_argument("--weights", type=Path, help="poids OpenCLIP locaux du modèle indiqué")
    parser.add_argument("--limit", type=int, default=0, help="nombre d'images à traiter (0 : toutes)")
    parser.add_argument("--workers", type=int, default=4, choices=range(1, 9), help="téléchargements parallèles, mémoire bornée")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--dry-run", action="store_true", help="liste le travail sans télécharger ni inférer")
    args = parser.parse_args()
    catalogue = json.loads(args.catalogue.read_text(encoding="utf-8"))["produits"]
    descriptions = json.loads((RACINE / "data/style-prompts.json").read_text(encoding="utf-8"))
    empreinte = hashlib.sha256(json.dumps(descriptions, sort_keys=True).encode()).hexdigest()
    prompts_id = descriptions["version"] + ":" + empreinte[:12]
    modele_id = MODELE + "/" + PREENTRAINE
    index = json.loads(args.output.read_text(encoding="utf-8")) if args.output.exists() else {"version": VERSION, "produits": {}}
    if index.get("version") != VERSION or not isinstance(index.get("produits"), dict):
        parser.error("Version d'index incompatible ; choisir un nouveau fichier --output.")
    taches = []
    for id, p in catalogue.items():
        image = p.get("img") or p.get("vign")
        ancien = index["produits"].get(id, {})
        if not image or not image.startswith("https://"):
            continue
        if not args.force and ancien.get("image") == image and ancien.get("modele") == modele_id and ancien.get("prompts") == prompts_id:
            continue
        taches.append((id, image))
    if args.limit > 0:
        taches = taches[:args.limit]
    print(f"OpenCLIP : {len(taches)} images à indexer, modèle {modele_id}, prompts {prompts_id}.", flush=True)
    if args.dry_run or not taches:
        return
    if args.weights:
        with args.weights.open('rb') as f:
            empreinte_poids = hashlib.file_digest(f, 'sha256').hexdigest()
        if empreinte_poids != SHA256_POIDS:
            parser.error('Les poids locaux ne correspondent pas au modèle LAION indiqué (SHA-256 différent).')
    try:
        import torch
        import open_clip
        from PIL import Image
    except ImportError as e:
        parser.error(f"Installer les dépendances de scripts/requirements-styles.txt : {e}")
    torch.set_num_threads(2)
    model, _, preprocess = open_clip.create_model_and_transforms(MODELE, pretrained=str(args.weights) if args.weights else PREENTRAINE, device="cpu")
    model.eval()
    tokenizer = open_clip.get_tokenizer(MODELE)
    styles = list(descriptions["styles"])
    with torch.inference_mode():
        features = []
        for style in styles:
            texts = tokenizer(["A photo of " + p + "." for p in descriptions["styles"][style]])
            f = model.encode_text(texts)
            f = torch.nn.functional.normalize(f, dim=-1).mean(dim=0)
            features.append(torch.nn.functional.normalize(f, dim=-1))
        textes = torch.stack(features)
    erreurs = []
    for numero, (id, url, data, erreur) in enumerate(images_en_parallele(taches, args.workers), 1):
        try:
            if erreur:
                raise erreur
            with Image.open(io.BytesIO(data)) as im:
                image = preprocess(im.convert("RGB")).unsqueeze(0)
            with torch.inference_mode():
                f = torch.nn.functional.normalize(model.encode_image(image), dim=-1)
                cos = (f @ textes.T)[0].tolist()
            # Similarités cosinus, pas des probabilités ni une expertise esthétique.
            scores = {style: round(max(0, min(1, v)), 5) for style, v in zip(styles, cos)}
            index["produits"][id] = {"source": "openclip", "image": url, "modele": modele_id,
                "prompts": prompts_id, "sha256Image": hashlib.sha256(data).hexdigest(), "scores": scores,
                "aVerifier": True, "date": datetime.now(timezone.utc).isoformat()}
            if numero % 10 == 0 or numero == len(taches):
                enregistrer(args.output, index)
                print(f"{numero}/{len(taches)} images traitées ; {len(erreurs)} erreurs.", flush=True)
        except Exception as e:
            erreurs.append(id)
            print(f"Image {id} non indexée : {str(e)[:150]}", flush=True)
    # Une image en erreur n'est jamais remplacée par un score inventé ; son ancienne entrée
    # reste inutilisée si son URL a changé. Enregistrer aussi après une erreur sur la dernière image.
    index["generation"] = {"modele": modele_id, "prompts": prompts_id, "openclip": version('open_clip_torch'),
        "date": datetime.now(timezone.utc).isoformat(), "erreurs": erreurs}
    enregistrer(args.output, index)
    if erreurs:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
