"""One GPU process and one Node API, supervised together; no keys on the command line."""
import os, sys, signal, subprocess, time, secrets, json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def main():
    import torch
    from huggingface_hub import HfApi
    key = os.environ.get('REALROOM_SERVICE_KEY', '')
    if len(key) < 32 or any(ord(c) < 33 or ord(c) > 126 for c in key):
        raise SystemExit('Configure REALROOM_SERVICE_KEY: at least 32 ASCII characters, no whitespace.')
    if not torch.cuda.is_available():
        raise SystemExit('A CUDA GPU is required. Assign l4x1 hardware to this Space.')
    config = json.loads((ROOT / 'services/furnishing/model.json').read_text())
    model = os.environ.get('REALROOM_MODEL', config['model'])
    revision = os.environ.get('REALROOM_MODEL_REVISION') or config.get('revision')
    if not revision:
        revision = HfApi().model_info(model).sha
    os.environ['REALROOM_MODEL'] = model
    os.environ['REALROOM_MODEL_REVISION'] = revision
    os.environ['VLLM_API_KEY'] = secrets.token_urlsafe(48)
    os.environ['REALROOM_LLM_URL'] = 'http://127.0.0.1:8000/v1'
    args = [sys.executable, '-m', 'vllm.entrypoints.openai.api_server',
            '--model', model, '--revision', revision, '--host', '127.0.0.1', '--port', '8000',
            '--max-model-len', '32768', '--max-num-seqs', '1', '--max-num-batched-tokens', '4096',
            '--gpu-memory-utilization', '0.90', '--enforce-eager', '--reasoning-parser', 'qwen3',
            '--limit-mm-per-prompt', '{"image":10,"video":0}',
            '--mm-processor-kwargs', '{"max_pixels":262144}', '--disable-log-requests']
    processes = []
    stopping = False
    def stop(*_):
        nonlocal stopping
        stopping = True
        for process in processes:
            if process.poll() is None:
                process.terminate()
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    try:
        print(json.dumps({'service':'realroom', 'model':model, 'revision':revision,
                         'gpu':torch.cuda.get_device_name(0)}), flush=True)
        processes.append(subprocess.Popen(['node', str(ROOT / 'services/furnishing/server.mjs')], cwd=ROOT))
        processes.append(subprocess.Popen(args, cwd=ROOT))
        while not stopping:
            if any(p.poll() is not None for p in processes):
                raise RuntimeError('A service process stopped unexpectedly.')
            time.sleep(1)
    finally:
        stop()
        for p in processes:
            try:
                p.wait(timeout=15)
            except subprocess.TimeoutExpired:
                p.kill()
                p.wait()

if __name__ == '__main__':
    main()
