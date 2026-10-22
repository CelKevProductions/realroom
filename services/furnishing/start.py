"""Start the API only. Its runtime alternates the spatial and language processes."""
import json, os, secrets, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def main():
    import torch
    from huggingface_hub import HfApi
    key = os.environ.get('REALROOM_SERVICE_KEY', '')
    if len(key) < 32 or any(ord(c) < 33 or ord(c) > 126 for c in key):
        raise SystemExit('Configure REALROOM_SERVICE_KEY: at least 32 ASCII characters, no whitespace.')
    if not torch.cuda.is_available():
        raise SystemExit('This runtime requires a CUDA GPU. It never requests hardware automatically.')
    config = json.loads((ROOT / 'services/furnishing/model.json').read_text())
    model = os.environ.get('REALROOM_MODEL', config['model'])
    revision = os.environ.get('REALROOM_MODEL_REVISION') or (config.get('revision') if model == config['model'] else None)
    api = HfApi()
    if not revision:
        revision = api.model_info(model).sha
    tokenizer = os.environ.get('REALROOM_TOKENIZER') or (config.get('tokenizer', model) if model == config['model'] else model)
    tokenizer_revision = os.environ.get('REALROOM_TOKENIZER_REVISION') or (config.get('tokenizerRevision') if tokenizer == config.get('tokenizer') else None)
    if not tokenizer_revision:
        tokenizer_revision = revision if tokenizer == model else api.model_info(tokenizer).sha
    os.environ['REALROOM_MODEL'] = model
    os.environ['REALROOM_MODEL_REVISION'] = revision
    os.environ['REALROOM_TOKENIZER'] = tokenizer
    os.environ['REALROOM_TOKENIZER_REVISION'] = tokenizer_revision
    os.environ['VLLM_API_KEY'] = secrets.token_urlsafe(48)
    os.environ['REALROOM_LLM_URL'] = 'http://127.0.0.1:8000/v1'
    os.environ['REALROOM_LANGUAGE_PYTHON'] = sys.executable
    print(json.dumps({'service': 'realroom', 'spatial': 'semlayoutdiff', 'language': model,
                      'revision': revision, 'tokenizer': tokenizer, 'tokenizerRevision': tokenizer_revision,
                      'runtime': 'sequential-single-gpu'}), flush=True)
    os.execvp('node', ['node', str(ROOT / 'services/furnishing/server.mjs')])

if __name__ == '__main__':
    main()
