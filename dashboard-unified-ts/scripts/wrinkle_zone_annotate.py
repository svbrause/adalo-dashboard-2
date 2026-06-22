#!/usr/bin/env python3
"""
Zone-based wrinkle annotation using MediaPipe face mesh.

Uses landmark-defined zones (forehead, glabella, crow's feet, under-eye,
nasolabial) with precise exclusion masks for eyebrows, eyes, nostrils, and
lips. Detection is tuned per-zone so hair/nostril shadows/lip dryness never
enter the pipeline.

Usage:
    python scripts/wrinkle_zone_annotate.py <image> [--out-dir <dir>]

First run downloads face_landmarker.task (~4 MB) to ~/.cache/mediapipe/.
Requires: opencv-python scipy scikit-image numpy Pillow mediapipe
"""

from __future__ import annotations
import argparse, importlib.util, json, math, sys, urllib.request
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from skimage.morphology import skeletonize, remove_small_objects

# Load _crease_response from the sibling script (CLAHE + black-hat + bilateral).
# Same function used to produce the reference crease-response diagnostic images.
_wcd_spec = importlib.util.spec_from_file_location(
    '_wrinkle_crease_detect', Path(__file__).resolve().parent / 'wrinkle_crease_detect.py')
_wcd = importlib.util.module_from_spec(_wcd_spec)
_wcd_spec.loader.exec_module(_wcd)
_crease_response = _wcd._crease_response

# ── Model ─────────────────────────────────────────────────────────────────────
_MODEL_URL  = ('https://storage.googleapis.com/mediapipe-models/'
               'face_landmarker/face_landmarker/float16/1/face_landmarker.task')
_MODEL_PATH = Path.home() / '.cache' / 'mediapipe' / 'face_landmarker.task'

def _ensure_model() -> str:
    _MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not _MODEL_PATH.exists():
        print('Downloading face_landmarker.task (~4 MB)…', flush=True)
        urllib.request.urlretrieve(_MODEL_URL, _MODEL_PATH)
        print(f'  → {_MODEL_PATH}')
    return str(_MODEL_PATH)


# ── Landmark index groups (MediaPipe 468-point face mesh) ─────────────────────
# Convention: "L" = person's left = RIGHT side of image (viewer's right)
#             "R" = person's right = LEFT side of image (viewer's left)

OVAL   = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,
          400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109]

# Eye aperture contours
L_EYE  = [33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246]
R_EYE  = [362,382,381,380,374,373,390,249,263,466,388,387,386,385,384,398]

# Eyebrow arcs (upper + lower rows for full convex hull)
L_BROW = [46,53,52,65,55,70,63,105,66,107]
R_BROW = [276,283,282,295,285,300,293,334,296,336]

# Outer lip contour
LIPS   = [61,185,40,39,37,0,267,269,270,409,291,375,321,405,314,17,84,181,91,146]

# Key single-point indices
L_CANTHUS  = 33    # outer canthus – person's left eye → LEFT side of image
R_CANTHUS  = 263   # outer canthus – person's right eye → RIGHT side of image
L_BROW_IN  = 55    # inner end of person's left brow
R_BROW_IN  = 285   # inner end of person's right brow
GLABELLA   = 168   # nasion / nose bridge between brows
NOSE_TIP   = 4
L_ALAR     = 49    # left alar base (person's left = image right)
R_ALAR     = 279   # right alar base
L_CORNER   = 61    # left mouth corner
R_CORNER   = 291   # right mouth corner
CHIN       = 152
FOREHEAD   = 10    # face oval top centre


# ── Per-zone detection parameters ─────────────────────────────────────────────
# (blackhat_kernels, threshold_percentile, min_aspect_ratio, min_diagonal_px)
# Kernels oriented toward expected wrinkle direction per zone.
ZONE_CFG: dict[str, tuple] = {
    # (blackhat_kernels, threshold_pct, min_aspect, min_diag, pre_close_kernel_or_None)
    # pre_close: morphological close applied before skeletonize to bridge
    # gaps along the dominant wrinkle direction per zone.
    'forehead': ([(33,5),(5,9),(25,3)],       81, 1.8, 12, (29,  1)),  # horizontal
    'glabella': ([(5,25),(3,15),(7,31)],       82, 1.5,  9, ( 1, 27)),  # vertical
    'crows_L':  ([(13,3),(3,13),(9,7),(7,9)],  80, 1.3,  7, None),
    'crows_R':  ([(13,3),(3,13),(9,7),(7,9)],  80, 1.3,  7, None),
    'under_L':  ([(21,3),(9,3),(15,5)],        81, 1.4,  8, (23,  1)),  # horizontal
    'under_R':  ([(21,3),(9,3),(15,5)],        81, 1.4,  8, (23,  1)),  # horizontal
    'naso_L':   ([(5,31),(3,21),(7,41)],       80, 1.4, 10, ( 5, 25)),  # vertical
    'naso_R':   ([(5,31),(3,21),(7,41)],       80, 1.4, 10, ( 5, 25)),  # vertical
}

SEV_PAL = {'Mild':(255,205,77), 'Moderate':(247,139,46), 'High':(220,53,69)}

ZONE_DISPLAY_COLORS = {
    'forehead':(255,200,50),  'glabella':(247,139,46),
    'crows_L': (50,200,255),  'crows_R': (50,200,255),
    'under_L': (100,255,100), 'under_R': (100,255,100),
    'naso_L':  (255,100,200), 'naso_R':  (255,100,200),
}


# ── Face geometry helper ───────────────────────────────────────────────────────
class Face:
    def __init__(self, lm, h: int, w: int):
        self.lm, self.h, self.w = lm, h, w
        self.fh     = max(self.py(CHIN) - self.py(FOREHEAD), 1)
        # Estimate face width from inter-canthus distance
        self.fw     = max(abs(self.px(R_CANTHUS) - self.px(L_CANTHUS)) * 2.5, 1)
        self.nose_x = self.px(NOSE_TIP)

    def px(self, i: int) -> int:   return int(self.lm[i].x * self.w)
    def py(self, i: int) -> int:   return int(self.lm[i].y * self.h)
    def pt(self, i: int) -> np.ndarray:
        return np.array([self.px(i), self.py(i)])
    def pts(self, ii) -> np.ndarray:
        return np.array([self.pt(i) for i in ii], np.int32)

    def lateral(self, x: int) -> int:
        """Return +1 if x is to the right of the nose, -1 if left.
        Used to fan crow's feet outward from each canthus."""
        return +1 if x > self.nose_x else -1


# ── Exclusion and zone mask builders ──────────────────────────────────────────
def _filled(h, w, pts_list) -> np.ndarray:
    m = np.zeros((h, w), np.uint8)
    for pts in pts_list:
        cv2.fillPoly(m, [np.asarray(pts, np.int32)], 255)
    return m

def _dilate(m: np.ndarray, r: int) -> np.ndarray:
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (r*2+1, r*2+1))
    return cv2.dilate(m, k)


def build_exclusions(face: Face):
    """
    Returns:
        oval  – face outline mask (255 = inside face, hair excluded)
        excl  – union of eyes / brows / nostrils / lips (255 = hard exclude)
    """
    h, w, fh = face.h, face.w, face.fh

    # Face oval – erode ~2.8% face height to pull away from hairline / temples
    oval = _filled(h, w, [face.pts(OVAL)])
    oval = cv2.erode(oval, cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE, (max(int(fh*0.028), 1)*2+1,)*2))

    # Eyes – dilate ~1.6% face height around the eye aperture landmarks.
    r_eye = int(fh*0.016) + 2
    eyes  = _dilate(_filled(h, w, [face.pts(L_EYE)]), r_eye)
    eyes  = cv2.max(eyes, _dilate(_filled(h, w, [face.pts(R_EYE)]), r_eye))

    # Eyebrows – convex hull + generous 2.8% face-height dilation
    # This eliminates brow hairs which have similar ridge response to wrinkles
    r_brow = int(fh*0.028) + 3
    brows  = _dilate(_filled(h, w, [cv2.convexHull(face.pts(L_BROW))]), r_brow)
    brows  = cv2.max(brows, _dilate(_filled(h, w, [cv2.convexHull(face.pts(R_BROW))]), r_brow))

    # Lips – outer contour + 2.2% face-height dilation (removes lip dryness lines)
    r_lip = int(fh*0.022) + 3
    lips  = _dilate(_filled(h, w, [face.pts(LIPS)]), r_lip)

    # Nostrils – triangle from alar bases to nose tip, padded 2.5%
    # Prevents nostril shadow (a very strong dark ridge) from being detected
    pad  = int(fh*0.025)
    nt   = face.pt(NOSE_TIP)
    la   = face.pt(L_ALAR)
    ra   = face.pt(R_ALAR)
    nose_poly = np.array([
        la + [-pad, -pad//2],
        ra + [ pad, -pad//2],
        ra + [ pad,  pad*2  ],
        nt + [   0,  pad*2  ],
        la + [-pad,  pad*2  ],
    ], np.int32)
    nostrils = _dilate(_filled(h, w, [nose_poly]), int(fh*0.025)+2)

    excl = cv2.max(cv2.max(cv2.max(eyes, brows), lips), nostrils)
    return oval, excl


def _zone(pts, h, w, oval, excl) -> np.ndarray:
    """Fill polygon, clip to face oval, subtract exclusions, return bool mask."""
    m = _filled(h, w, [pts])
    m = cv2.bitwise_and(m, oval)
    m[excl > 0] = 0
    return m.astype(bool)


def build_zones(face: Face, oval: np.ndarray, excl: np.ndarray) -> dict[str, np.ndarray]:
    h, w, fh, fw = face.h, face.w, face.fh, face.fw

    def z(pts): return _zone(pts, h, w, oval, excl)

    # Brow extremes – used for forehead bottom boundary and glabella top boundary
    all_brow_pts = [face.pt(i) for i in L_BROW + R_BROW]
    brow_top_y   = min(p[1] for p in all_brow_pts) - int(fh*0.01)
    brow_l_x     = min(p[0] for p in all_brow_pts) - int(fw*0.06)
    brow_r_x     = max(p[0] for p in all_brow_pts) + int(fw*0.06)

    # ── Forehead ──────────────────────────────────────────────────────────────
    # Strip from 3% below face oval top down to just above brow tops.
    # Excludes brows via the excl mask.
    ftop_y = face.py(FOREHEAD) + int(fh*0.03)
    forehead = z([
        [brow_l_x, ftop_y],
        [brow_r_x, ftop_y],
        [brow_r_x, brow_top_y],
        [brow_l_x, brow_top_y],
    ])

    # ── Glabella ──────────────────────────────────────────────────────────────
    # Vertical strip between inner brow ends, from brow top down to nose bridge.
    gx_l = face.px(L_BROW_IN) - int(fw*0.04)
    gx_r = face.px(R_BROW_IN) + int(fw*0.04)
    glab_bot = face.py(GLABELLA) + int(fh*0.04)
    glabella = z([
        [gx_l, brow_top_y],
        [gx_r, brow_top_y],
        [gx_r, glab_bot],
        [gx_l, glab_bot],
    ])

    # ── Crow's feet ───────────────────────────────────────────────────────────
    # Rectangle extending laterally (away from nose) from each outer canthus.
    def crows(canthus_idx: int) -> np.ndarray:
        cx, cy = face.pt(canthus_idx)
        d = face.lateral(cx)            # -1 fans left, +1 fans right
        return z([
            [cx + d*int(fw*0.01), cy - int(fh*0.09)],
            [cx + d*int(fw*0.30), cy - int(fh*0.09)],
            [cx + d*int(fw*0.30), cy + int(fh*0.14)],
            [cx + d*int(fw*0.01), cy + int(fh*0.14)],
        ])

    # ── Under-eye ─────────────────────────────────────────────────────────────
    # Strip immediately below the lower eyelid, ~9% face height tall.
    def under_eye(eye_idx) -> np.ndarray:
        eye_pts = [face.pt(i) for i in eye_idx]
        top  = max(p[1] for p in eye_pts) + int(fh*0.005)
        bot  = top + int(fh*0.085)
        x_l  = min(p[0] for p in eye_pts) - int(fw*0.02)
        x_r  = max(p[0] for p in eye_pts) + int(fw*0.02)
        return z([[x_l,top],[x_r,top],[x_r,bot],[x_l,bot]])

    # ── Nasolabial folds ──────────────────────────────────────────────────────
    # Strip centred on the line from alar base to mouth corner.
    def nasolabial(alar_idx: int, corner_idx: int) -> np.ndarray:
        al = face.pt(alar_idx)
        co = face.pt(corner_idx)
        xm = (al[0] + co[0]) // 2
        wp = int(fw*0.09)
        return z([
            [xm - wp, al[1] - int(fh*0.03)],
            [xm + wp, al[1] - int(fh*0.03)],
            [xm + wp, co[1] + int(fh*0.05)],
            [xm - wp, co[1] + int(fh*0.05)],
        ])

    return {
        'forehead': forehead,
        'glabella': glabella,
        'crows_L':  crows(L_CANTHUS),
        'crows_R':  crows(R_CANTHUS),
        'under_L':  under_eye(L_EYE),
        'under_R':  under_eye(R_EYE),
        'naso_L':   nasolabial(L_ALAR, L_CORNER),
        'naso_R':   nasolabial(R_ALAR, R_CORNER),
    }


# ── Ridge detection ────────────────────────────────────────────────────────────
def compute_crease_map(gray: np.ndarray):
    """
    Crease response: CLAHE + oriented black-hat morphology + bilateral denoise.
    Identical signal to the reference crease-response diagnostic images.
    Returns (crease_response [0,1], clahe_enhanced_gray).
    """
    resp  = _crease_response(gray, 'any').astype(np.float32)
    resp /= (resp.max() + 1e-6)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8)).apply(gray)
    return resp, clahe


def compute_hair_mask(rgb: np.ndarray, oval: np.ndarray, face: Face) -> np.ndarray:
    """
    Mask hair / non-skin pixels inside the face oval using cheek-referenced Lab
    color distance plus a narrow inner-boundary strip at the hairline.
    """
    h, w = rgb.shape[:2]
    fh = face.fh
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)

    cheek_refs = [205, 425, 118, 347]
    samples: list[np.ndarray] = []
    r = max(int(fh * 0.035), 8)
    for idx in cheek_refs:
        cx, cy = face.px(idx), face.py(idx)
        patch = lab[max(0, cy - r):min(h, cy + r), max(0, cx - r):min(w, cx + r)]
        if patch.size:
            samples.append(patch.reshape(-1, 3))
    if not samples:
        return np.zeros((h, w), np.uint8)

    skin = np.vstack(samples)
    mean = skin.mean(axis=0)
    std = np.maximum(skin.std(axis=0), [8.0, 6.0, 6.0])
    z_dist = np.linalg.norm((lab - mean) / std, axis=2)
    non_skin = ((z_dist > 2.5) & (oval > 0)).astype(np.uint8) * 255

    # Temple / hairline band: outer ring just inside the oval (where hair halo lives)
    ring_r = max(int(fh * 0.045), 4)
    inner = cv2.erode(
        oval,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (ring_r * 2 + 1, ring_r * 2 + 1)),
    )
    hairline_ring = ((oval > 0) & (inner == 0)).astype(np.uint8) * 255

    hair = cv2.max(non_skin, hairline_ring)
    k = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE,
        (max(int(fh * 0.012), 3) * 2 + 1, max(int(fh * 0.012), 3) * 2 + 1),
    )
    return cv2.dilate(hair, k)


def build_analysis_mask(
    oval: np.ndarray,
    excl: np.ndarray,
    hair: np.ndarray | None = None,
) -> np.ndarray:
    """Skin wrinkle analysis mask: inner face oval minus eyes/brows/lips/nostrils/hair."""
    ring_r = max(int(oval.shape[0] * 0.012), 3)
    inner = cv2.erode(
        oval,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (ring_r * 2 + 1, ring_r * 2 + 1)),
    )
    mask = (inner > 0) & (excl == 0)
    if hair is not None:
        mask &= (hair == 0)
    return mask


def render_masked_crease_diagnostic(
    crease: np.ndarray,
    analysis_mask: np.ndarray,
    *,
    upscale: int = 1,
) -> np.ndarray:
    """
    MAGMA crease response on the wrinkle-analysis mask only.
    Matches the reference diagnostic style but zeros brows, lips, eyes, etc.
    """
    mask = analysis_mask.astype(bool)
    if not mask.any():
        return np.zeros((*crease.shape, 3), np.uint8)

    resp = crease.copy()
    resp[~mask] = 0.0

    lo = float(np.percentile(resp[mask], 32))
    hi = float(np.percentile(resp[mask], 98))
    heat = np.clip((resp - lo) / max(hi - lo, 1e-6), 0.0, 1.0)
    heat[~mask] = 0.0

    vis8 = np.clip(heat * 255, 0, 255).astype(np.uint8)
    magma_bgr = cv2.applyColorMap(vis8, cv2.COLORMAP_MAGMA)
    magma = cv2.cvtColor(magma_bgr, cv2.COLOR_BGR2RGB)
    magma[~mask] = 0

    if upscale > 1:
        h, w = magma.shape[:2]
        magma = cv2.resize(
            magma,
            (w * upscale, h * upscale),
            interpolation=cv2.INTER_LANCZOS4,
        )
    return magma


def save_crease_heatmap(
    crease: np.ndarray,
    analysis_mask: np.ndarray,
    out_path: Path,
    *,
    upscale: int = 2,
) -> np.ndarray:
    """Write masked crease diagnostic PNG; return native-resolution RGB array."""
    native = render_masked_crease_diagnostic(crease, analysis_mask, upscale=1)
    hi_res = render_masked_crease_diagnostic(crease, analysis_mask, upscale=upscale)
    cv2.imwrite(str(out_path), cv2.cvtColor(hi_res, cv2.COLOR_RGB2BGR))
    return native


# ── Path-tracing helpers ───────────────────────────────────────────────────────
def _order_path(pts_xy: np.ndarray) -> np.ndarray:
    """
    Order skeleton pixels into a spatially-connected sequence using greedy NN.
    Start from the pixel with the fewest close neighbors (most endpoint-like).
    Returns (N, 2) array of (x, y) coords.
    """
    from scipy.spatial import KDTree
    if len(pts_xy) <= 3:
        return pts_xy
    tree     = KDTree(pts_xy)
    neighbor_counts = np.array([len(tree.query_ball_point(p, r=2.5))
                                 for p in pts_xy])
    cur      = int(np.argmin(neighbor_counts))
    visited  = np.zeros(len(pts_xy), bool)
    visited[cur] = True
    ordered  = [pts_xy[cur]]
    for _ in range(len(pts_xy) - 1):
        dists, idxs = tree.query(pts_xy[cur], k=min(10, len(pts_xy)))
        found = False
        for d, idx in zip(dists[1:], idxs[1:]):
            if not visited[idx]:
                visited[idx] = True
                ordered.append(pts_xy[idx])
                cur   = idx
                found = True
                break
        if not found:
            break
    return np.array(ordered)


def _fit_spline(pts_xy: np.ndarray) -> np.ndarray:
    """
    Fit a smooth cubic B-spline through an ordered set of path points.
    Returns a denser (M, 2) float array suitable for cv2.polylines.
    Falls back to the raw points if fitting fails.
    """
    from scipy.interpolate import splprep, splev
    n = len(pts_xy)
    if n < 4:
        return pts_xy
    x, y = pts_xy[:, 0].astype(float), pts_xy[:, 1].astype(float)
    try:
        s       = max(n * 3.0, 50.0)   # generous smoothing — eliminates end-hooks
        n_out   = max(24, n // 2)
        tck, _  = splprep([x, y], s=s, k=3)
        xs, ys  = splev(np.linspace(0, 1, n_out), tck)
        return np.column_stack([xs, ys])
    except Exception:
        return pts_xy


def _path_efficiency(path_xy: np.ndarray) -> float:
    """
    Ratio of endpoint straight-line distance to total arc length.
    1.0 = perfectly straight; near 0 = U-shape or loop.
    """
    if len(path_xy) < 2:
        return 1.0
    straight = float(np.linalg.norm(path_xy[-1].astype(float)
                                     - path_xy[0].astype(float)))
    arc      = float(np.sum(np.linalg.norm(
                    np.diff(path_xy.astype(float), axis=0), axis=1)))
    return straight / (arc + 1e-6)


def _chain_ordered_paths(paths: list) -> np.ndarray:
    """
    Greedily stitch a list of path arrays into one continuous chain by
    connecting nearest endpoints and flipping path orientation as needed.
    """
    if not paths:
        return np.zeros((0, 2), float)
    remaining = [p.astype(float) for p in paths]
    chain = remaining.pop(0)
    while remaining:
        best = {'i': 0, 'dist': float('inf'), 'flip_c': False, 'flip_n': False}
        for i, p in enumerate(remaining):
            for fc in (False, True):
                c_ep = chain[0] if fc else chain[-1]
                for fn in (False, True):
                    n_ep = p[-1] if fn else p[0]
                    d = float(np.linalg.norm(c_ep - n_ep))
                    if d < best['dist']:
                        best = {'i': i, 'dist': d, 'flip_c': fc, 'flip_n': fn}
        nxt = remaining.pop(best['i'])
        if best['flip_c']:
            chain = chain[::-1]
        if best['flip_n']:
            nxt = nxt[::-1]
        chain = np.vstack([chain, nxt])
    return chain


def _bridge_and_merge(comps, gap_px: int = 26, angle_tol_deg: float = 42) -> list:
    """
    Merge skeleton-path components that are close AND roughly co-linear into
    longer strokes.  Uses greedy pair-matching (each component merges with at
    most one other) so transitive A→B→C chains — which produce looping splines
    — can never form.
    """
    if len(comps) <= 1:
        return comps

    n       = len(comps)
    paths   = [c[2] for c in comps]
    cos_tol = math.cos(math.radians(angle_tol_deg))

    def _ep_tan(path: np.ndarray, at_end: bool, k: int = 5) -> np.ndarray:
        seg = path[-min(k, len(path)):] if at_end else path[:min(k, len(path))]
        if len(seg) < 2:
            return np.array([1.0, 0.0])
        d = (seg[-1] - seg[0]).astype(float)
        nrm = float(np.linalg.norm(d))
        return d / nrm if nrm > 1e-6 else np.array([1.0, 0.0])

    tans = [(_ep_tan(p, False), _ep_tan(p, True)) for p in paths]

    def best_link(i, j):
        """Return (dist, flip_i, flip_j) for best endpoint pair, or None."""
        pi, pj  = paths[i], paths[j]
        th_i, tt_i = tans[i]
        th_j, tt_j = tans[j]
        configs = [
            (pi[-1], pj[0],  tt_i, th_j, False, False),
            (pi[-1], pj[-1], tt_i, tt_j, False, True),
            (pi[0],  pj[0],  th_i, th_j, True,  False),
            (pi[0],  pj[-1], th_i, tt_j, True,  True),
        ]
        best_d = float('inf')
        best_fi = best_fj = False
        best_ti = best_tj = np.array([1.0, 0.0])
        best_ei = best_ej = np.zeros(2, float)
        for ep_i, ep_j, ti, tj, fi, fj in configs:
            d = float(np.linalg.norm(ep_i.astype(float) - ep_j.astype(float)))
            if d < best_d:
                best_d, best_fi, best_fj = d, fi, fj
                best_ti, best_tj = ti, tj
                best_ei, best_ej = ep_i.astype(float), ep_j.astype(float)
        if best_d > gap_px:
            return None
        # Tangents must be mutually aligned (parallel paths)
        if abs(float(np.dot(best_ti, best_tj))) < cos_tol:
            return None
        # For non-trivial gaps the connection vector must align with BOTH
        # tangents — prevents merging parallel lines offset perpendicularly
        # (e.g. two adjacent horizontal forehead wrinkles at different heights).
        if best_d > 8.0:
            conn_u = (best_ej - best_ei) / best_d
            if abs(float(np.dot(best_ti, conn_u))) < cos_tol:
                return None
            if abs(float(np.dot(best_tj, conn_u))) < cos_tol:
                return None
        return (best_d, best_fi, best_fj)

    # Rank all valid pairs by distance; greedily assign each component to one pair
    all_links = []
    for i in range(n):
        for j in range(i + 1, n):
            info = best_link(i, j)
            if info is not None:
                all_links.append((info[0], i, j, info[1], info[2]))
    all_links.sort(key=lambda x: x[0])

    used  = [False] * n
    pairs = []
    for dist, i, j, fi, fj in all_links:
        if not used[i] and not used[j]:
            pairs.append((i, j, fi, fj))
            used[i] = used[j] = True

    merged_idx: set[int] = set()
    result = []
    for i, j, fi, fj in pairs:
        merged_idx.add(i)
        merged_idx.add(j)
        pi_m    = paths[i][::-1] if fi else paths[i]
        pj_m    = paths[j][::-1] if fj else paths[j]
        chained = np.vstack([pi_m, pj_m])
        smooth  = _fit_spline(chained)
        score   = max(comps[i][0], comps[j][0])
        area    = comps[i][1] + comps[j][1]
        bi, bj  = comps[i][3], comps[j][3]
        x0 = min(bi[0], bj[0])
        y0 = min(bi[1], bj[1])
        x1 = max(bi[0] + bi[2], bj[0] + bj[2])
        y1 = max(bi[1] + bi[3], bj[1] + bj[3])
        if len(comps[i]) > 4 and len(comps[j]) > 4:
            merged_fill = comps[i][4] | comps[j][4]
            result.append((score, area, smooth, (x0, y0, x1 - x0, y1 - y0), merged_fill))
        else:
            result.append((score, area, smooth, (x0, y0, x1 - x0, y1 - y0)))

    for i in range(n):
        if i not in merged_idx:
            result.append(comps[i])

    return result


# ── Per-zone detection ─────────────────────────────────────────────────────────
def detect_zone(zone_mask: np.ndarray, crease: np.ndarray,
                clahe: np.ndarray, gray: np.ndarray,
                bh_kernels, pct: float, min_aspect: float, min_diag: float,
                pre_close=None, direction_anchor=None,
                direction_tol_deg: float = 52):
    """
    Detect wrinkle components inside a single zone mask.
    Returns list of (score, pixel_area, smooth_path_xy, bbox_tuple).
    """
    # Zone-specific black-hat with tuned kernels (orientation + scale per zone)
    bh = np.zeros_like(clahe, np.uint8)
    for kw, kh in bh_kernels:
        k  = cv2.getStructuringElement(cv2.MORPH_RECT, (kw, kh))
        bh = cv2.max(bh, cv2.morphologyEx(clahe, cv2.MORPH_BLACKHAT, k))

    # Global crease response provides bilateral-smoothed signal; zone BH provides
    # orientation-specific sharpening tuned to each zone's dominant wrinkle direction.
    combined = np.clip(crease * 0.45 + bh.astype(np.float32) / 255 * 0.65, 0, 1)
    combined[~zone_mask] = 0

    vals = combined[zone_mask]
    if not vals.size:
        return []
    thr  = max(0.06, float(np.percentile(vals, pct)))

    mask = (combined >= thr) & zone_mask
    mask = remove_small_objects(mask, min_size=7, connectivity=2)
    mask = cv2.morphologyEx(
        mask.astype(np.uint8)*255, cv2.MORPH_CLOSE,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2,2))) > 0

    # Bridge gaps along the dominant wrinkle direction before skeletonizing
    if pre_close is not None:
        kw, kh = pre_close
        k_pc = cv2.getStructuringElement(cv2.MORPH_RECT, (kw, kh))
        mask = cv2.morphologyEx(mask.astype(np.uint8)*255, cv2.MORPH_CLOSE, k_pc) > 0

    skel = skeletonize(mask)
    skel = remove_small_objects(skel, min_size=6, connectivity=2)

    num, labels, stats, _ = cv2.connectedComponentsWithStats(skel.astype(np.uint8), 8)
    out = []
    for lab in range(1, num):
        area = stats[lab, cv2.CC_STAT_AREA]
        bx   = stats[lab, cv2.CC_STAT_LEFT]
        by_  = stats[lab, cv2.CC_STAT_TOP]
        bw   = stats[lab, cv2.CC_STAT_WIDTH]
        bh_  = stats[lab, cv2.CC_STAT_HEIGHT]
        if area < 6 or max(bw, bh_) < 6:                       continue
        if max(bw,bh_) / max(min(bw,bh_),1) < min_aspect:      continue
        if math.sqrt(bw**2 + bh_**2) < min_diag:               continue
        comp = (labels == lab)
        if float(np.median(gray[comp])) < 48:                  continue  # dark = hair

        # Radial direction filter (crow's feet): discard components whose
        # principal axis doesn't radiate outward from the anchor point (canthus).
        if direction_anchor is not None:
            rows_c, cols_c = np.where(comp)
            cx = float(cols_c.mean());  cy = float(rows_c.mean())
            radial = np.array([cx - direction_anchor[0],
                                cy - direction_anchor[1]], float)
            rn = float(np.linalg.norm(radial))
            if rn > 0.1:
                radial /= rn
                pts2 = np.column_stack([cols_c, rows_c]).astype(float)
                if len(pts2) >= 3:
                    cov = np.cov(pts2.T)
                    _, evecs = np.linalg.eigh(cov)
                    principal = evecs[:, -1]
                    if abs(float(np.dot(radial, principal))) \
                            < math.cos(math.radians(direction_tol_deg)):
                        continue

        rows, cols = np.where(comp)
        pts_xy  = np.column_stack([cols, rows])   # (x, y) = (col, row)
        path    = _order_path(pts_xy)
        smooth  = _fit_spline(path)
        # Score mirrors the reference pipeline: mean response × √arc_length.
        # This rewards long paths with consistently high crease signal over short
        # bright spikes, matching how actual wrinkle lines behave.
        arc_len = float(np.sum(np.linalg.norm(
            np.diff(path.astype(float), axis=0), axis=1))) if len(path) > 1 else 1.0
        score   = float(np.mean(combined[comp])) * math.sqrt(arc_len)
        fill = cv2.dilate(
            comp.astype(np.uint8),
            cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)),
            iterations=1,
        ).astype(bool)
        out.append((score, int(area), smooth, (bx, by_, bw, bh_), fill))
    return out


def detect_zone_naso_ridge(
    zone_mask: np.ndarray,
    crease: np.ndarray,
    clahe: np.ndarray,
    gray: np.ndarray,
    bh_kernels,
    pct: float = 76.0,
    min_diag: float = 18.0,
    pre_close=(5, 25),
):
    """
    Nasolabial-specific: threshold vertical crease blobs, skeletonize, and trace
    the dominant vertical ridge — handles large NL folds that contour mode rejects.
    """
    bh = np.zeros_like(clahe, np.uint8)
    for kw, kh in bh_kernels:
        k = cv2.getStructuringElement(cv2.MORPH_RECT, (kw, kh))
        bh = cv2.max(bh, cv2.morphologyEx(clahe, cv2.MORPH_BLACKHAT, k))

    combined = np.clip(crease * 0.40 + bh.astype(np.float32) / 255 * 0.70, 0, 1)
    combined[~zone_mask] = 0

    vals = combined[zone_mask]
    if not vals.size:
        return []

    thr = max(0.05, float(np.percentile(vals, pct)))
    mask = (combined >= thr) & zone_mask
    mask = remove_small_objects(mask, min_size=12, connectivity=2)
    if pre_close is not None:
        kw, kh = pre_close
        k_pc = cv2.getStructuringElement(cv2.MORPH_RECT, (kw, kh))
        mask = cv2.morphologyEx(mask.astype(np.uint8) * 255, cv2.MORPH_CLOSE, k_pc) > 0

    skel = skeletonize(mask)
    skel = remove_small_objects(skel, min_size=8, connectivity=2)

    num, labels, stats, _ = cv2.connectedComponentsWithStats(skel.astype(np.uint8), 8)
    out = []
    for lab in range(1, num):
        area = stats[lab, cv2.CC_STAT_AREA]
        bx = stats[lab, cv2.CC_STAT_LEFT]
        by_ = stats[lab, cv2.CC_STAT_TOP]
        bw = stats[lab, cv2.CC_STAT_WIDTH]
        bh_ = stats[lab, cv2.CC_STAT_HEIGHT]
        if area < 10 or math.sqrt(bw ** 2 + bh_ ** 2) < min_diag:
            continue
        if bh_ < bw * 0.85:
            continue
        comp = labels == lab
        blob = mask & comp
        if float(np.median(gray[blob])) < 48:
            continue

        rows, cols = np.where(comp)
        pts_xy = np.column_stack([cols, rows])
        path = _order_path(pts_xy)
        smooth = _fit_spline(path)
        arc_len = float(np.sum(np.linalg.norm(
            np.diff(path.astype(float), axis=0), axis=1))) if len(path) > 1 else 1.0
        score = float(np.mean(combined[blob])) * math.sqrt(arc_len)
        fill = cv2.dilate(
            blob.astype(np.uint8),
            cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)),
            iterations=1,
        ).astype(bool)
        out.append((score, int(blob.sum()), smooth, (bx, by_, bw, bh_), fill))

    out.sort(key=lambda t: t[0], reverse=True)
    return out[:3]


def detect_zone_contours(
    zone_mask: np.ndarray,
    crease: np.ndarray,
    clahe: np.ndarray,
    gray: np.ndarray,
    bh_kernels,
    pct: float,
    min_aspect: float,
    min_diag: float,
    *,
    pre_close=None,
    direction_anchor=None,
    direction_tol_deg: float = 52,
    max_zone_area_frac: float = 0.22,
):
    """
    Direct heatmap-to-annotation: threshold crease response inside a zone,
    extract elongated contour components, score by mean response × √perimeter.
    """
    bh = np.zeros_like(clahe, np.uint8)
    for kw, kh in bh_kernels:
        k = cv2.getStructuringElement(cv2.MORPH_RECT, (kw, kh))
        bh = cv2.max(bh, cv2.morphologyEx(clahe, cv2.MORPH_BLACKHAT, k))

    combined = np.clip(crease * 0.45 + bh.astype(np.float32) / 255 * 0.65, 0, 1)
    combined[~zone_mask] = 0

    vals = combined[zone_mask]
    if not vals.size:
        return []

    zone_area = max(int(zone_mask.sum()), 1)
    thr = max(0.06, float(np.percentile(vals, pct)))
    mask = (combined >= thr) & zone_mask
    mask = remove_small_objects(mask, min_size=8, connectivity=2)
    mask = cv2.morphologyEx(
        mask.astype(np.uint8) * 255,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2)),
    ) > 0
    if pre_close is not None:
        kw, kh = pre_close
        k_pc = cv2.getStructuringElement(cv2.MORPH_RECT, (kw, kh))
        mask = cv2.morphologyEx(mask.astype(np.uint8) * 255, cv2.MORPH_CLOSE, k_pc) > 0

    contours, _ = cv2.findContours(
        mask.astype(np.uint8) * 255,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_NONE,
    )
    out = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if area < 18 or area > zone_area * max_zone_area_frac:
            continue
        bx, by_, bw, bh_ = cv2.boundingRect(contour)
        if max(bw, bh_) < 6:
            continue
        if max(bw, bh_) / max(min(bw, bh_), 1) < min_aspect:
            continue
        if math.sqrt(bw ** 2 + bh_ ** 2) < min_diag:
            continue

        comp = np.zeros(mask.shape, np.uint8)
        cv2.drawContours(comp, [contour], -1, 255, -1)
        if float(np.median(gray[comp > 0])) < 48:
            continue

        if direction_anchor is not None:
            m = cv2.moments(contour)
            if m["m00"] <= 0:
                continue
            cx = float(m["m10"] / m["m00"])
            cy = float(m["m01"] / m["m00"])
            radial = np.array([cx - direction_anchor[0], cy - direction_anchor[1]], float)
            rn = float(np.linalg.norm(radial))
            if rn > 0.1:
                radial /= rn
                if len(contour) >= 5:
                    line = cv2.fitLine(contour, cv2.DIST_L2, 0, 0.01, 0.01)
                    principal = np.array([line[0].item(), line[1].item()], float)
                    pn = float(np.linalg.norm(principal))
                    if pn > 1e-6:
                        principal /= pn
                        if abs(float(np.dot(radial, principal))) < math.cos(
                            math.radians(direction_tol_deg)
                        ):
                            continue

        line_mask = np.zeros(mask.shape, np.uint8)
        cv2.drawContours(line_mask, [contour], -1, 255, 1)
        perimeter = max(float(cv2.arcLength(contour, False)), 1.0)
        score = float(np.mean(combined[line_mask > 0])) * math.sqrt(perimeter)

        epsilon = max(1.2, 0.012 * perimeter)
        approx = cv2.approxPolyDP(contour, epsilon, False).reshape(-1, 2)
        if len(approx) < 2:
            continue
        if len(approx) > 28:
            keep = np.linspace(0, len(approx) - 1, 28).round().astype(int)
            approx = approx[keep]
        path = approx.astype(float)
        smooth = _fit_spline(path)
        fill = comp.astype(bool)
        out.append((score, int(area), smooth, (bx, by_, bw, bh_), fill))
    return out


# ── Rendering ──────────────────────────────────────────────────────────────────
def alpha_comp(base: np.ndarray, layer: np.ndarray) -> np.ndarray:
    a = layer[:,:,3:4].astype(np.float32) / 255
    return np.clip(base.astype(np.float32)*(1-a) + layer[:,:,:3].astype(np.float32)*a,
                   0, 255).astype(np.uint8)


def render_annotation(rgb: np.ndarray, components) -> np.ndarray:
    """
    components: list of (score, area, smooth_path_xy, bbox, fill_mask, zone_name)
    Stroke outlines with white halo.
    """
    h, w = rgb.shape[:2]
    if not components:
        return rgb.copy()

    scores  = np.array([c[0] for c in components], np.float32)
    mod_thr = float(np.percentile(scores, 62))
    hi_thr  = float(np.percentile(scores, 90))

    shadow = np.zeros((h,w,4), np.uint8)
    halo   = np.zeros((h,w,4), np.uint8)
    stroke = np.zeros((h,w,4), np.uint8)

    for score, area, path_xy, box, _fill, zone_name in components:
        tier = 'High' if score>=hi_thr else 'Moderate' if score>=mod_thr else 'Mild'
        col  = SEV_PAL[tier]
        lw   = 3 if tier == 'High' else 2
        pts  = path_xy.astype(np.int32).reshape(-1, 1, 2)
        cv2.polylines(shadow, [pts], False, (0, 0, 0, 38),            lw+4, cv2.LINE_AA)
        cv2.polylines(halo,   [pts], False, (255,255,255,115),         lw+2, cv2.LINE_AA)
        cv2.polylines(stroke, [pts], False, (*col, 220 if tier=='High' else 198),
                      lw, cv2.LINE_AA)

    result = alpha_comp(rgb,    shadow)
    result = alpha_comp(result, halo)
    result = alpha_comp(result, stroke)
    return result


def render_filled_blobs(rgb: np.ndarray, components) -> np.ndarray:
    """Semi-transparent severity-colored fills traced directly from heatmap blobs."""
    h, w = rgb.shape[:2]
    if not components:
        return rgb.copy()

    scores = np.array([c[0] for c in components], np.float32)
    mod_thr = float(np.percentile(scores, 62))
    hi_thr = float(np.percentile(scores, 90))

    out = rgb.astype(np.float32)
    stroke_layer = np.zeros((h, w, 4), np.uint8)

    for score, _area, path_xy, _box, fill_mask, _zone in components:
        tier = 'High' if score >= hi_thr else 'Moderate' if score >= mod_thr else 'Mild'
        col = np.array(SEV_PAL[tier], np.float32)
        alpha = 0.42 if tier == 'High' else 0.32 if tier == 'Moderate' else 0.24
        m = fill_mask.astype(bool)
        for c in range(3):
            out[:, :, c] = np.where(m, out[:, :, c] * (1 - alpha) + col[c] * alpha, out[:, :, c])
        pts = path_xy.astype(np.int32).reshape(-1, 1, 2)
        lw = 2 if tier == 'High' else 1
        cv2.polylines(
            stroke_layer,
            [pts],
            False,
            (int(col[0]), int(col[1]), int(col[2]), 180),
            lw,
            cv2.LINE_AA,
        )

    result = alpha_comp(np.clip(out, 0, 255).astype(np.uint8), stroke_layer)
    return result


def render_zones_debug(rgb: np.ndarray, zones: dict,
                        oval: np.ndarray, excl: np.ndarray) -> np.ndarray:
    """Visualise zone outlines + exclusion regions for debugging."""
    h, w  = rgb.shape[:2]
    debug = rgb.copy()
    # Dim area outside face oval
    outside = (oval == 0)
    debug[outside] = np.clip(debug[outside].astype(np.float32)*0.35, 0, 255).astype(np.uint8)
    # Tint exclusion areas red
    excl_vis = np.zeros((h,w,3), np.uint8)
    excl_vis[excl > 0] = (200, 50, 50)
    debug = cv2.addWeighted(debug, 0.75, excl_vis, 0.25, 0)
    # Tint + outline each zone
    for zname, zmask in zones.items():
        col = ZONE_DISPLAY_COLORS.get(zname, (200,200,200))
        ov  = np.zeros((h,w,3), np.uint8)
        ov[zmask] = col
        debug = cv2.addWeighted(debug, 0.80, ov, 0.20, 0)
        ctrs, _ = cv2.findContours(zmask.astype(np.uint8),
                                    cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(debug, ctrs, -1, col, 2)
    return debug


def add_legend(img: np.ndarray, counts: dict, title: str):
    total = max(sum(counts.values()), 1)
    sev   = (counts.get('Mild',0)*.35 + counts.get('Moderate',0)*.65
             + counts.get('High',0)) / total
    summ  = 'High' if sev >= .72 else 'Moderate' if sev >= .48 else 'Mild'
    h, w  = img.shape[:2]
    pil   = Image.fromarray(img)
    d     = ImageDraw.Draw(pil, 'RGBA')
    try:
        fnt  = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 15)
        fntb = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 17)
    except Exception:
        fnt = fntb = ImageFont.load_default()
    x0, y0 = 24, h - 122
    d.rounded_rectangle([x0,y0,x0+230,y0+98], radius=8,
                         fill=(255,255,255,226), outline=(45,55,72,82), width=1)
    d.text((x0+12, y0+10), f'{title}: {summ}', fill=(25,32,42,245), font=fntb)
    for i, label in enumerate(['Mild', 'Moderate', 'High']):
        yy = y0 + 43 + i*17
        d.line([x0+14, yy+7, x0+45, yy+7], fill=(*SEV_PAL[label], 250), width=4)
        d.text((x0+56, yy), f'{label} ({counts.get(label,0)})',
               fill=(42,50,62,240), font=fnt)
    return np.array(pil), summ, round(sev, 3)


# ── Redness exclusion ─────────────────────────────────────────────────────────
def compute_redness_mask(rgb: np.ndarray, oval: np.ndarray) -> np.ndarray:
    """
    Mask pixels with anomalously HIGH red chrominance relative to the subject's
    own skin average — catches capillaries / rosacea without over-excluding
    warm skin tones.  Threshold = face_mean_Cr + max(2*std, 10).
    """
    ycrcb = cv2.cvtColor(rgb, cv2.COLOR_RGB2YCrCb)
    y  = ycrcb[:, :, 0].astype(float)
    cr = ycrcb[:, :, 1].astype(float)
    # Compute Cr stats on mid-brightness skin pixels inside the face oval
    skin = oval.astype(bool) & (y > 70) & (y < 230)
    if skin.sum() < 200:
        return np.zeros(oval.shape, np.uint8)
    mean_cr = float(np.mean(cr[skin]))
    std_cr  = float(np.std(cr[skin]))
    thr     = mean_cr + max(2.0 * std_cr, 10.0)
    red     = ((cr > thr) & skin).astype(np.uint8) * 255
    k       = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    return cv2.dilate(red, k)


def build_istock_comparison(
    rgb: np.ndarray,
    diagnostic: np.ndarray,
    annotated: np.ndarray,
) -> np.ndarray:
    h, w = rgb.shape[:2]
    gap = 8
    try:
        fnt = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 22)
    except Exception:
        fnt = ImageFont.load_default()
    labels = ['Original', 'Crease response (masked)', 'Severity annotation']
    panels = [rgb, diagnostic, annotated]
    canvas = Image.new('RGB', (w * 3 + gap * 2, h + 52), (246, 246, 246))
    draw = ImageDraw.Draw(canvas)
    for i, (label, arr) in enumerate(zip(labels, panels, strict=True)):
        x = i * (w + gap)
        draw.text((x + 16, 13), label, fill=(30, 38, 50), font=fnt)
        canvas.paste(Image.fromarray(arr), (x, 52))
    return np.array(canvas)


def _detect_all_zones(
    zones: dict[str, np.ndarray],
    crease_resp: np.ndarray,
    clahe_gray: np.ndarray,
    gray: np.ndarray,
    dir_anchors: dict[str, tuple[int, int]],
    *,
    mode: str,
) -> list:
    detect_fn = detect_zone_contours if mode == 'contour' else detect_zone
    all_components = []
    zone_counts: dict[str, int] = {}
    for zone_name, zone_mask in zones.items():
        cfg_key = 'forehead' if zone_name.startswith('forehead_') else zone_name
        display_name = 'forehead' if zone_name.startswith('forehead_') else zone_name
        bh_k, pct, asp, diag, pre_close = ZONE_CFG[cfg_key]

        if cfg_key in ('naso_L', 'naso_R'):
            comps = detect_zone_naso_ridge(
                zone_mask, crease_resp, clahe_gray, gray, bh_k, pct=pct - 2,
            )
        else:
            comps = detect_fn(
                zone_mask,
                crease_resp,
                clahe_gray,
                gray,
                bh_k,
                pct,
                asp,
                diag,
                pre_close=pre_close,
                direction_anchor=dir_anchors.get(zone_name),
            )
        if mode != 'contour' and cfg_key not in ('naso_L', 'naso_R'):
            comps = _bridge_and_merge(comps)
            comps = [c for c in comps if _path_efficiency(c[2]) >= 0.15]
        zone_counts[display_name] = zone_counts.get(display_name, 0) + len(comps)
        print(f'  {zone_name:12s}: {len(comps)} components ({mode})')
        for c in comps:
            all_components.append((*c, display_name))
    all_components.sort(key=lambda c: c[0], reverse=True)
    kept = all_components[:20]
    zone_counts = {}
    for _, _, _, _, _, zn in kept:
        zone_counts[zn] = zone_counts.get(zn, 0) + 1
    return kept, zone_counts


# ── Main pipeline ──────────────────────────────────────────────────────────────
def run(image_path: Path, out_dir: Path, *, mode: str = 'contour'):
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = image_path.stem

    rgb  = np.array(Image.open(image_path).convert('RGB'))
    h, w = rgb.shape[:2]
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    print(f'Image: {w}×{h}')

    # Landmarks
    model = _ensure_model()
    print('Running MediaPipe face mesh…')
    import mediapipe as mp
    from mediapipe.tasks import python as mpp
    from mediapipe.tasks.python.vision import FaceLandmarker, FaceLandmarkerOptions
    opts = FaceLandmarkerOptions(
        base_options=mpp.BaseOptions(model_asset_path=model),
        num_faces=1, min_face_detection_confidence=0.3,
        min_face_presence_confidence=0.3)
    with FaceLandmarker.create_from_options(opts) as det:
        res = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
    if not res.face_landmarks:
        sys.exit('ERROR: no face detected')
    face = Face(res.face_landmarks[0], h, w)
    print(f'  face_h={face.fh}px  face_w={int(face.fw)}px  nose_x={face.nose_x}')

    # Masks
    print('Building exclusion masks…')
    oval, excl = build_exclusions(face)
    excl = cv2.max(excl, compute_redness_mask(rgb, oval))
    hair = compute_hair_mask(rgb, oval, face)
    analysis_mask = build_analysis_mask(oval, excl, hair)

    # Zones
    print('Building zone ROIs…')
    zones = build_zones(face, oval, excl)
    nose_x_split = face.nose_x
    fh_full = zones.pop('forehead')
    fh_l = fh_full.copy(); fh_l[:, nose_x_split:] = False
    fh_r = fh_full.copy(); fh_r[:, :nose_x_split] = False
    zones = {'forehead_L': fh_l, 'forehead_R': fh_r, **zones}
    for zn, zm in zones.items():
        print(f'  {zn:12s}: {int(zm.sum()):6d} px')

    # Crease response (same signal as reference diagnostic images)
    print('Computing crease response…')
    crease_resp, clahe_gray = compute_crease_map(gray)
    masked_diagnostic = save_crease_heatmap(
        crease_resp,
        analysis_mask,
        out_dir / f'{stem}-crease-heatmap-masked.png',
    )
    Image.fromarray(masked_diagnostic).save(out_dir / f'{stem}-crease-response-masked.png')

    dir_anchors = {
        'crows_L': (face.px(L_CANTHUS), face.py(L_CANTHUS)),
        'crows_R': (face.px(R_CANTHUS), face.py(R_CANTHUS)),
    }

    print(f'Detecting per zone ({mode})…')
    all_components, zone_counts = _detect_all_zones(
        zones, crease_resp, clahe_gray, gray, dir_anchors, mode=mode,
    )
    print(f'Total (after global top-20 cut): {len(all_components)} wrinkle components')

    # Render severity annotation (strokes + filled blobs)
    annotated_strokes = render_annotation(rgb, all_components)
    annotated_filled = render_filled_blobs(rgb, all_components)

    # Severity counts for legend
    if all_components:
        scores  = np.array([c[0] for c in all_components], np.float32)
        mod_thr = float(np.percentile(scores, 62))
        hi_thr  = float(np.percentile(scores, 90))
        counts: dict[str, int] = {'Mild':0, 'Moderate':0, 'High':0}
        for score, *_ in all_components:
            tier = 'High' if score>=hi_thr else 'Moderate' if score>=mod_thr else 'Mild'
            counts[tier] += 1
    else:
        counts = {'Mild':0, 'Moderate':0, 'High':0}

    annotated_l, summ, sev_idx = add_legend(annotated_filled, counts, 'Wrinkle severity')
    annotated_strokes_l, _, _ = add_legend(annotated_strokes, counts, 'Wrinkle severity')

    # Zone debug (show hair mask in debug)
    zones_debug = render_zones_debug(rgb, zones, oval, cv2.max(excl, hair))

    # Save outputs
    Image.fromarray(annotated_strokes_l).save(out_dir / f'{stem}-zone-annotated-strokes.png')
    Image.fromarray(annotated_l).save(out_dir / f'{stem}-zone-annotated-filled.png')
    Image.fromarray(annotated_l).save(out_dir / f'{stem}-zone-annotated.png')
    Image.fromarray(annotated_l).resize((w*2, h*2), Image.Resampling.LANCZOS).save(
        out_dir / f'{stem}-zone-annotated-2x.png')
    Image.fromarray(zones_debug).save(out_dir / f'{stem}-zones-debug.png')
    Image.fromarray((hair > 0).astype(np.uint8) * 255).save(out_dir / f'{stem}-hair-mask.png')

    istock_comparison = build_istock_comparison(rgb, masked_diagnostic, annotated_l)
    Image.fromarray(istock_comparison).save(
        out_dir / f'{stem}-annotation-comparison.jpg', quality=95,
    )

    # Comparison panel: original | zones | annotated
    try:
        hfnt = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 24)
    except Exception:
        hfnt = ImageFont.load_default()
    panels = [('Original', rgb), ('Zones', zones_debug), ('Annotated', annotated_l)]
    full = Image.new('RGB', (w*3, h+52), (246,246,246))
    for i, (label, arr) in enumerate(panels):
        top = Image.new('RGB', (w,52), (250,250,250))
        ImageDraw.Draw(top).text((16,13), label, fill=(30,38,50), font=hfnt)
        panel = Image.new('RGB', (w, h+52), (250,250,250))
        panel.paste(top, (0,0))
        panel.paste(Image.fromarray(arr), (0,52))
        full.paste(panel, (i*w, 0))
    full.save(out_dir / f'{stem}-comparison.jpg', quality=95)
    full.resize((1800, round((h+52)*1800/(w*3))), Image.Resampling.LANCZOS).save(
        out_dir / f'{stem}-comparison-preview.jpg', quality=95)

    # JSON
    payload = []
    for score, area, _path, box, _fill, zone_name in all_components:
        payload.append({'zone': zone_name, 'score': round(score,4),
                        'pixels': area, 'bbox': [int(v) for v in box]})
    meta = {
        'imageSize': [w, h],
        'annotationMode': mode,
        'totalComponents': len(all_components),
        'counts': counts,
        'perZone': zone_counts,
        'overallSeverity': summ,
        'severityIndex': sev_idx,
        'components': payload,
    }
    (out_dir / f'{stem}-zone-summary.json').write_text(
        json.dumps(meta, indent=2), encoding='utf-8')

    print(f'\nSaved → {out_dir}')
    print(f'Severity: {counts} | {summ} (idx {sev_idx})')
    print(f'Per-zone: {zone_counts}')


def main():
    ap = argparse.ArgumentParser(description='Zone-based wrinkle annotation')
    ap.add_argument('image', help='Input image path')
    ap.add_argument('--out-dir', default=None,
                    help='Output directory (default: <image_dir>/<stem>-zone-annotations)')
    ap.add_argument(
        '--mode',
        choices=('contour', 'skeleton'),
        default='contour',
        help='contour = threshold heatmap blobs directly; skeleton = centerline paths',
    )
    args = ap.parse_args()
    img  = Path(args.image)
    odir = Path(args.out_dir) if args.out_dir else img.parent / f'{img.stem}-zone-annotations'
    run(img, odir, mode=args.mode)


if __name__ == '__main__':
    main()
