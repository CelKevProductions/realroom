"""Upload an explicitly prepared backend. Tokens are read from environment, never CLI arguments."""
import argparse, os, re
from pathlib import Path
from huggingface_hub import HfApi

parser = argparse.ArgumentParser()
parser.add_argument('repo', help='Hugging Face OWNER/SPACE')
parser.add_argument('folder', type=Path)
parser.add_argument('--start-l4', action='store_true', help='Assign paid L4 hardware and start the Space')
parser.add_argument('--pause', action='store_true', help='Pause an existing Space without uploading')
args = parser.parse_args()
if not re.fullmatch(r'[\w-]+/[\w.-]+', args.repo):
    parser.error('Expected OWNER/SPACE')
api = HfApi(token=os.environ.get('HF_TOKEN'))
if args.pause:
    api.pause_space(args.repo)
    print('Space paused:', args.repo)
    raise SystemExit(0)
if not (args.folder / 'Dockerfile').is_file() or not (args.folder / 'services/furnishing/model.json').is_file():
    parser.error('Run scripts/prepare-hf-space.mjs first')
secret = os.environ.get('REALROOM_SERVICE_KEY', '')
if len(secret) < 32 or any(ord(c) < 33 or ord(c) > 126 for c in secret):
    parser.error('Set REALROOM_SERVICE_KEY to at least 32 random ASCII characters without whitespace')
for path in args.folder.rglob('*'):
    if path.name.startswith('.env') or path.name in {'.git', 'node_modules'} or path.suffix == '.pem':
        parser.error('Unexpected sensitive or generated file in prepared folder')
if api.repo_exists(args.repo, repo_type='space'):
    if not api.space_info(args.repo).private:
        parser.error('The destination exists and is public. Choose a private Space for this backend.')
else:
    api.create_repo(repo_id=args.repo, repo_type='space', space_sdk='docker', private=True,
                    **({'space_hardware':'l4x1', 'space_sleep_time':3600} if args.start_l4 else {}))
api.add_space_secret(repo_id=args.repo, key='REALROOM_SERVICE_KEY', value=secret)
api.upload_folder(repo_id=args.repo, repo_type='space', folder_path=str(args.folder), commit_message='Deploy RealRoom furnishing backend')
if args.start_l4:
    api.request_space_hardware(repo_id=args.repo, hardware='l4x1', sleep_time=3600)
    api.restart_space(repo_id=args.repo)
else:
    api.pause_space(repo_id=args.repo)
print('Space:', 'https://huggingface.co/spaces/' + args.repo)
print('State:', 'L4 requested; check /health before generation' if args.start_l4 else 'paused, ready for L4 activation')
