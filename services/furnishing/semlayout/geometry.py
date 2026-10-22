"""Metric architecture adapter. No torch, GPU, network, or learned fallback here.

The upstream SceneState exporter uses columns for X and rows for its horizontal
Y, with Z up. RealRoom uses XZ, Y up: x = column, z = -row. Its Rx(90) then
Rz(theta) furniture transform becomes RealRoom's yaw theta (front = +Z at 0).
Canvas is always 12 metres; a small room is padded, NEVER stretched to fit it.
"""
import math
import numpy as np
from scipy.ndimage import label, find_objects

EXTENT = 12.0
RESOLUTION = 120
APM_RESOLUTION = 1200
ROOM_TYPES = {'chambre': 0, 'salon': 1, 'salle_a_manger': 2}


def frame(room):
    polygon = np.asarray(room['polygon'], dtype=float)
    if polygon.ndim != 2 or polygon.shape[1] != 2 or not np.isfinite(polygon).all():
        raise ValueError('Invalid room polygon.')
    low, high = polygon.min(axis=0), polygon.max(axis=0)
    # 10 cm padding per side for the architectural raster, not a size normalisation.
    if np.any(high - low > EXTENT - .2 + 1e-8):
        raise ValueError('SemLayoutDiff supports rooms up to 11.8 m per axis; room rescaling is forbidden.')
    return {'center': ((low + high) / 2).tolist(), 'extent': EXTENT, 'resolution': RESOLUTION}


def world_to_pixel(x, z, transform, resolution=RESOLUTION):
    cx, cz = transform['center']
    return ((x - cx) / EXTENT + .5) * resolution, (.5 - (z - cz) / EXTENT) * resolution


def pixel_to_world(column, row, transform, resolution=RESOLUTION):
    cx, cz = transform['center']
    return cx + (column / resolution - .5) * EXTENT, cz - (row / resolution - .5) * EXTENT


def architecture(room):
    transform = frame(room)
    rows, cols = np.indices((RESOLUTION, RESOLUTION), dtype=float)
    cx, cz = transform['center']
    xx = cx + (cols + .5 - RESOLUTION / 2) * EXTENT / RESOLUTION
    zz = cz - (rows + .5 - RESOLUTION / 2) * EXTENT / RESOLUTION
    polygon = room['polygon']
    inside = np.zeros(xx.shape, dtype=bool)
    for i, (ax, az) in enumerate(polygon):
        bx, bz = polygon[(i + 1) % len(polygon)]
        if abs(bz - az) > 1e-12:
            inside ^= ((az > zz) != (bz > zz)) & (xx < (bx - ax) * (zz - az) / (bz - az) + ax)
    mask = inside.astype(np.int64)
    # Narrow wall strips encode opening spans, not door swing volumes. Exact
    # swing/sill/height constraints remain in RealRoom's metric validator.
    for opening in room['openings']:
        a = np.asarray(polygon[opening['wall']], dtype=float)
        b = np.asarray(polygon[(opening['wall'] + 1) % len(polygon)], dtype=float)
        direction = (b - a) / np.linalg.norm(b - a)
        along = (xx - a[0]) * direction[0] + (zz - a[1]) * direction[1]
        across = np.abs((xx - a[0]) * direction[1] - (zz - a[1]) * direction[0])
        span = (np.abs(along - opening['offset']) <= opening['width'] / 2 + 1e-8) & (across <= .1 + 1e-8)
        if not span.any():
            raise ValueError('An opening disappeared in the architecture raster.')
        mask[span] = 2 if opening['type'] == 'door' else 3
    return mask, transform


def instances(semantic, labels, thresholds):
    """Official class vocabulary and area thresholds; preserve separate lamps.

    Analyse components at 120px before allocating one 1200px mask at a time.
    The APM receives the same nearest-neighbour label values, not RGB colours.
    """
    valid = max(1, int(np.count_nonzero(semantic)))
    for category_id in sorted(int(n) for n in np.unique(semantic)):
        if category_id < 2 or category_id >= 36:
            continue
        category = labels[str(category_id)]
        components, _ = label(semantic == category_id)
        for number, area in enumerate(find_objects(components), 1):
            if area is None:
                continue
            mask = components == number
            if int(mask.sum()) / valid <= thresholds[category]:
                continue
            yield category_id, category, mask


def decode_instance(mask, transform, orientation, predicted_size, offset):
    if orientation not in range(4):
        raise ValueError('Invalid APM orientation class.')
    if len(predicted_size) != 3 or not all(math.isfinite(n) and n > 0 for n in predicted_size):
        raise ValueError('APM returned non-positive or non-finite dimensions.')
    if not math.isfinite(offset):
        raise ValueError('APM returned an invalid offset.')
    rr, cc = np.nonzero(mask)
    x, z = pixel_to_world((cc.min() + cc.max() + 1) / 2, (rr.min() + rr.max() + 1) / 2, transform)
    w, d = (cc.max() - cc.min() + 1) * .1, (rr.max() - rr.min() + 1) * .1
    if orientation % 2:
        w, d = d, w
    return {'x': float(x), 'z': float(z), 'rotation': orientation * 90,
            'size': [float(w), float(d), float(predicted_size[2])],
            'predictedSize': [float(n) for n in predicted_size], 'predictedOffset': float(offset)}
