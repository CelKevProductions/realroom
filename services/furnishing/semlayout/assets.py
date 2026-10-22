"""Prepare official weights on CPU. This script never starts hardware or inference."""
import argparse
import hashlib
import json
import os
import shutil
import tarfile
import tempfile
from pathlib import Path

REPOSITORY = '3dlg-hcvc/semlayoutdiff'
UPSTREAM = '6b12bc4c42aa8377445af108093539073f0495c1'
FILES = ('weights/sldn_checkpoints.tar.gz', 'weights/apm_checkpoint.ckpt')


def sha256(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def extract_checkpoint(archive, directory):
    # Do not extract arbitrary paths, symlinks, or training data from the archive.
    with tarfile.open(archive, 'r:gz') as tar:
        members = tar.getmembers()
        selected = {}
        for suffix, target in [('args.pickle', 'args.pickle'), ('check/checkpoint.pt', 'sldn.pt')]:
            found = [m for m in members if m.isfile() and (m.name == suffix or m.name.endswith('/' + suffix))]
            if len(found) != 1 or found[0].size > 2_000_000_000:
                raise ValueError('Unexpected checkpoint archive structure: ' + suffix)
            with tar.extractfile(found[0]) as src, (directory / target).open('wb') as dst:
                shutil.copyfileobj(src, dst)
            selected[target] = sha256(directory / target)
        return selected


def verify_assets(directory):
    directory = Path(directory)
    manifest = json.loads((directory / 'manifest.json').read_text())
    if manifest.get('repository') != REPOSITORY or manifest.get('upstreamCommit') != UPSTREAM:
        raise ValueError('The prepared weights do not match this SemLayoutDiff adapter.')
    if set(manifest.get('files', {})) != {'args.pickle', 'sldn.pt', 'apm.ckpt'}:
        raise ValueError('Incomplete checkpoint manifest.')
    for name, digest in manifest['files'].items():
        if sha256(directory / name) != digest:
            raise ValueError('Checkpoint integrity check failed: ' + name)
    return manifest


def prepare(output, revision=None):
    from huggingface_hub import HfApi, hf_hub_download
    output = Path(output).resolve()
    if output.exists():
        return verify_assets(output)
    # Resolve ONCE and download both files from the same immutable Hub revision.
    info = HfApi().dataset_info(REPOSITORY, revision=revision or 'main', files_metadata=True)
    pinned = info.sha
    downloaded = {}
    for name in FILES:
        path = hf_hub_download(REPOSITORY, name, repo_type='dataset', revision=pinned)
        meta = next(s for s in info.siblings if s.rfilename == name)
        lfs = meta.lfs
        expected = lfs.get('sha256') if isinstance(lfs, dict) else getattr(lfs, 'sha256', None)
        if not expected or sha256(path) != expected:
            raise ValueError('The downloaded file does not match its Hub LFS SHA-256.')
        downloaded[name] = path
    output.parent.mkdir(parents=True, exist_ok=True)
    temp = Path(tempfile.mkdtemp(prefix='semlayout-', dir=output.parent))
    try:
        hashes = extract_checkpoint(downloaded[FILES[0]], temp)
        shutil.copyfile(downloaded[FILES[1]], temp / 'apm.ckpt')
        hashes['apm.ckpt'] = sha256(temp / 'apm.ckpt')
        manifest = {'repository': REPOSITORY, 'revision': pinned, 'upstreamCommit': UPSTREAM, 'files': hashes}
        (temp / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
        os.rename(temp, output)
    finally:
        if temp.exists():
            shutil.rmtree(temp)
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--revision')
    parser.add_argument('--verify', action='store_true')
    args = parser.parse_args()
    result = verify_assets(args.output) if args.verify else prepare(args.output, args.revision)
    print(json.dumps(result))
