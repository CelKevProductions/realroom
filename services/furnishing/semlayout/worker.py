"""One request/process: official SLDN + APM, then exit to release GPU memory.

Input/output: bounded NDJSON over pipes. No HTTP, no subprocess commands from
requests, no invented fallback placements, and no loading weights from a client.
"""
import argparse
import contextlib
import json
import os
import pickle
import sys
from pathlib import Path

from assets import UPSTREAM, verify_assets
from geometry import architecture, instances, decode_instance, ROOM_TYPES

HERE = Path(__file__).resolve().parent
VENDOR = HERE / 'vendor'


class ArgumentsUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        if (module, name) == ('argparse', 'Namespace'):
            return argparse.Namespace
        raise pickle.UnpicklingError('Unsupported checkpoint argument type.')


def emit(event):
    print(json.dumps(event, allow_nan=False), flush=True)


def load_models(directory, device):
    import torch
    from omegaconf import OmegaConf
    sys.path.insert(0, str(VENDOR / 'src'))
    from semlayoutdiff.sldn.model import get_model
    from semlayoutdiff.apm.attr_module import FurnitureAttributesModel

    manifest = verify_assets(directory)
    with (directory / 'args.pickle').open('rb') as file:
        args = ArgumentsUnpickler(file).load()
    if getattr(args, 'data_size', None) != 120 or not getattr(args, 'w_arch', False):
        raise ValueError('The checkpoint is not the 120px architecture-conditioned model.')
    if not getattr(args, 'room_type_condition', False) or not getattr(args, 'mix_condition', False):
        raise ValueError('The checkpoint does not support the requested room/architecture conditions.')
    if getattr(args, 'num_categories', getattr(args, 'num_classes', None)) != 38:
        raise ValueError('Unexpected SLDN category vocabulary.')
    args.num_classes = 38  # get_data(args) normally sets this; no dataset needed at inference.
    sldn = get_model(args, data_shape=(1, 120, 120))
    checkpoint = torch.load(directory / 'sldn.pt', weights_only=True, map_location='cpu')
    state = checkpoint['model']
    if state and all(k.startswith('module.') for k in state):
        state = {k.removeprefix('module.'): v for k, v in state.items()}
    sldn.load_state_dict(state, strict=True)
    del state, checkpoint
    config = OmegaConf.load(VENDOR / 'configs/apm/unified_config.yaml')
    apm = FurnitureAttributesModel(config)
    checkpoint = torch.load(directory / 'apm.ckpt', weights_only=True, map_location='cpu')
    apm.load_state_dict(checkpoint['state_dict'], strict=True)
    del checkpoint
    return sldn.eval().to(device), apm.eval().to(device), manifest


def final_sample(model, floor, room_type, torch, progress):
    """Same reverse steps as upstream sample_chain, without retaining 4000 maps."""
    device = floor.device
    log_z = model.log_sample_categorical(torch.zeros((1, model.num_classes) + tuple(model.shape), device=device))
    room = torch.tensor([room_type], device=device, dtype=torch.long)
    arch = torch.tensor([2], device=device, dtype=torch.long)
    for step in reversed(range(model.num_timesteps)):
        t = torch.full((1,), step, device=device, dtype=torch.long)
        log_z = model.p_sample(log_z, t, floor, room, None, arch)
        if step % 200 == 0:
            progress(model.num_timesteps - step, model.num_timesteps)
    return log_z.argmax(dim=1)[0, 0].cpu().numpy()


def generate(request, directory, device):
    import numpy as np
    import torch
    if device == 'cuda' and not torch.cuda.is_available():
        raise ValueError('CUDA unavailable; no CPU or language-only fallback is automatic.')
    count = request.get('count', 6)
    seed = request.get('seed', 0)
    if type(count) is not int or not 1 <= count <= 12 or type(seed) is not int or not 0 <= seed < 2**31:
        raise ValueError('Invalid layout count or seed.')
    kind = request['brief']['roomType']
    if kind not in ROOM_TYPES:
        raise ValueError('This checkpoint supports salon, chambre and salle_a_manger only.')
    mask, transform = architecture(request['room'])
    emit({'type': 'progress', 'stage': 'Chargement des modèles de placement…'})
    with contextlib.redirect_stdout(sys.stderr):
        sldn, apm, manifest = load_models(directory, device)
    labels = json.loads((VENDOR / 'preprocess/metadata/unified_idx_to_generic_label.json').read_text())
    thresholds = json.loads((VENDOR / 'preprocess/metadata/unified_pix_ratio_threshold.json').read_text())
    floor = torch.from_numpy(mask).unsqueeze(0).unsqueeze(0).to(device)
    layouts = []
    with torch.inference_mode():
        for index in range(count):
            actual_seed = (seed + index) % 2**31
            torch.manual_seed(actual_seed)
            np.random.seed(actual_seed)
            emit({'type': 'progress', 'stage': f'Placement appris : proposition {index + 1}/{count}…'})
            semantic = final_sample(sldn, floor, ROOM_TYPES[kind], torch,
                lambda done, total: emit({'type': 'progress', 'stage': f'Placement {index + 1}/{count} · {done}/{total} étapes'}))
            # Keep original room authoritative. Never align or scale its geometry
            # to the generated semantic floor, unlike the upstream scene exporter.
            outside = int(np.count_nonzero((semantic >= 2) & (semantic < 36) & (mask == 0)))
            semantic[mask == 0] = 0
            semantic[mask == 2] = 36
            semantic[mask == 3] = 37
            high = np.repeat(np.repeat(semantic, 10, axis=0), 10, axis=1)
            semantic_tensor = torch.from_numpy(high.astype(np.float32)).unsqueeze(0).unsqueeze(0).to(device)
            objects, rejected = [], []
            for category_id, category, component in instances(semantic, labels, thresholds):
                if len(objects) >= 60:
                    rejected.append('instance-limit')
                    break
                high_mask = np.repeat(np.repeat(component, 10, axis=0), 10, axis=1)
                instance_tensor = torch.from_numpy(high_mask.astype(np.float32)).unsqueeze(0).unsqueeze(0).to(device)
                category_tensor = torch.nn.functional.one_hot(torch.tensor([category_id], device=device), num_classes=36).float()
                size, offset, orientation = apm(semantic_tensor, instance_tensor, category_tensor)
                try:
                    decoded = decode_instance(component, transform, int(orientation.argmax(dim=-1).item()), size.flatten().tolist(), float(offset.item()))
                    objects.append({'id': f'layout-{index}-{len(objects)}', 'category': category, **decoded})
                except ValueError:
                    rejected.append(category)
                del instance_tensor, category_tensor
            layouts.append({'id': f'semlayout-{actual_seed}', 'seed': actual_seed, 'objects': objects,
                            'diagnostics': {'outsidePixels': outside, 'rejectedAttributes': rejected}})
            del semantic_tensor
    if not any(layout['objects'] for layout in layouts):
        raise ValueError('SemLayoutDiff returned no usable furniture instances.')
    return {'engine': 'semlayoutdiff', 'upstreamCommit': UPSTREAM, 'checkpointRevision': manifest['revision'],
            'frame': transform, 'roomType': kind, 'layouts': layouts}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--weights', type=Path, required=True)
    parser.add_argument('--device', choices=['cuda', 'cpu'], default='cuda')
    args = parser.parse_args()
    try:
        raw = sys.stdin.buffer.readline(1_000_001)
        if len(raw) > 1_000_000:
            raise ValueError('Layout request too large.')
        result = generate(json.loads(raw), args.weights, args.device)
        emit({'type': 'result', 'result': result})
    except Exception as exc:
        # Backend logs can retain exception type; requests/keys are never printed.
        print(type(exc).__name__ + ': ' + str(exc), file=sys.stderr)
        emit({'type': 'error', 'error': 'Le moteur de placement n’a pas terminé. Consultez le diagnostic du service.'})
        sys.exit(1)
