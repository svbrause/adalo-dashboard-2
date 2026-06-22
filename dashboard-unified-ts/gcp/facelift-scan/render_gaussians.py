#!/usr/bin/env python3
"""
Simple CPU 3D Gaussian Splatting renderer.
Renders a gaussians.ply from an arbitrary viewpoint.
Uses vectorized NumPy - slow but works without CUDA.
"""
from __future__ import annotations
import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image

# Spherical harmonic constants (match FaceLift / Inria 3DGS)
C0 = 0.28209479177387814
C1 = 0.4886025119029199
C2 = np.array(
    [
        1.0925484305920792,
        -1.0925484305920792,
        0.31539156525252005,
        -1.0925484305920792,
        0.5462742152960396,
    ],
    dtype=np.float32,
)
C3 = np.array(
    [
        -0.5900435899266435,
        2.890611442640554,
        -0.4570457994644658,
        0.3731763325901154,
        -0.4570457994644658,
        1.445305721320277,
        -0.5900435899266435,
    ],
    dtype=np.float32,
)


def sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


def eval_sh_deg3(sh: np.ndarray, dirs: np.ndarray) -> np.ndarray:
    """
    Evaluate degree-3 SH at unit directions (FaceLift ``eval_sh`` port).

    Args:
        sh: (N, 3, 16) coefficients per RGB channel (DC + 15 rest).
        dirs: (N, 3) unit vectors from Gaussian **toward** camera (world space).

    Returns:
        (N, 3) linear color **before** +0.5 / sigmoid (same convention as FaceLift internals).
    """
    # dirs (N,3) -> (N,1) components
    x, y, z = dirs[:, 0:1], dirs[:, 1:2], dirs[:, 2:3]
    result = C0 * sh[:, :, 0]
    result = (
        result
        - C1 * y * sh[:, :, 1]
        + C1 * z * sh[:, :, 2]
        - C1 * x * sh[:, :, 3]
    )
    xx, yy, zz = x * x, y * y, z * z
    xy, yz, xz = x * y, y * z, x * z
    result = (
        result
        + C2[0] * xy * sh[:, :, 4]
        + C2[1] * yz * sh[:, :, 5]
        + C2[2] * (2.0 * zz - xx - yy) * sh[:, :, 6]
        + C2[3] * xz * sh[:, :, 7]
        + C2[4] * (xx - yy) * sh[:, :, 8]
    )
    result = (
        result
        + C3[0] * y * (3 * xx - yy) * sh[:, :, 9]
        + C3[1] * xy * z * sh[:, :, 10]
        + C3[2] * y * (4 * zz - xx - yy) * sh[:, :, 11]
        + C3[3] * z * (2 * zz - 3 * xx - 3 * yy) * sh[:, :, 12]
        + C3[4] * x * (4 * zz - xx - yy) * sh[:, :, 13]
        + C3[5] * z * (xx - yy) * sh[:, :, 14]
        + C3[6] * x * (xx - 3 * yy) * sh[:, :, 15]
    )
    return result.astype(np.float32)


def load_gaussians(ply_path: Path) -> dict:
    """Load 3DGS PLY into arrays (FaceLift-compatible: DC + f_rest SH when present)."""
    from plyfile import PlyData
    ply = PlyData.read(str(ply_path))
    el = ply.elements[0]
    d = el.data
    props = set(p.name for p in el.properties)

    xyz = np.stack([d["x"], d["y"], d["z"]], axis=1).astype(np.float32)  # (N,3)
    f_dc = np.stack([d["f_dc_0"], d["f_dc_1"], d["f_dc_2"]], axis=1).astype(np.float32)  # (N,3)

    rest_names = sorted(
        (p for p in props if p.startswith("f_rest_")),
        key=lambda s: int(s.split("_")[-1]),
    )
    # FaceLift degree-3 → 45 f_rest scalars → (N, 3, 15)
    sh: np.ndarray | None = None
    if len(rest_names) == 45:
        rest = np.stack([d[n] for n in rest_names], axis=1).astype(np.float32)  # (N,45)
        rest = rest.reshape(rest.shape[0], 3, 15)
        sh = np.concatenate([f_dc[:, :, np.newaxis], rest], axis=2)  # (N,3,16)

    # Fallback RGB (view-independent) for legacy PLY or if rest missing
    rgb = np.clip(f_dc * C0 + 0.5, 0, 1).astype(np.float32)

    opacity = sigmoid(d["opacity"].astype(np.float32))  # (N,)
    scales = np.exp(np.stack([d["scale_0"], d["scale_1"], d["scale_2"]], axis=1).astype(np.float32))
    quats = np.stack([d["rot_0"], d["rot_1"], d["rot_2"], d["rot_3"]], axis=1).astype(np.float32)
    norms = np.linalg.norm(quats, axis=1, keepdims=True)
    quats /= np.where(norms > 0, norms, 1)

    out = {"xyz": xyz, "rgb": rgb, "opacity": opacity, "scales": scales, "quats": quats}
    if sh is not None:
        out["sh"] = sh
    return out


def quat_to_rotmat(q: np.ndarray) -> np.ndarray:
    """(N,4) w,x,y,z → (N,3,3) rotation matrices."""
    w, x, y, z = q[:, 0], q[:, 1], q[:, 2], q[:, 3]
    R = np.zeros((len(q), 3, 3), dtype=np.float32)
    R[:, 0, 0] = 1 - 2*(y*y + z*z)
    R[:, 0, 1] = 2*(x*y - w*z)
    R[:, 0, 2] = 2*(x*z + w*y)
    R[:, 1, 0] = 2*(x*y + w*z)
    R[:, 1, 1] = 1 - 2*(x*x + z*z)
    R[:, 1, 2] = 2*(y*z - w*x)
    R[:, 2, 0] = 2*(x*z - w*y)
    R[:, 2, 1] = 2*(y*z + w*x)
    R[:, 2, 2] = 1 - 2*(x*x + y*y)
    return R


def look_at(eye: np.ndarray, target: np.ndarray = None, up: np.ndarray = None):
    """Camera extrinsics: returns (R_world_to_cam, t) such that x_cam = R @ x_world + t."""
    if target is None:
        target = np.zeros(3, dtype=np.float32)
    if up is None:
        up = np.array([0., 1., 0.], dtype=np.float32)
    eye = np.asarray(eye, dtype=np.float32)
    z = target - eye
    z /= np.linalg.norm(z)
    # Avoid degenerate up vector
    if abs(np.dot(z, up)) > 0.99:
        up = np.array([0., 0., 1.], dtype=np.float32) if abs(z[2]) < 0.99 else np.array([1., 0., 0.], dtype=np.float32)
    x = np.cross(z, up)
    x /= np.linalg.norm(x)
    y = np.cross(x, z)
    # OpenCV convention: z points forward (toward target), x right, y down
    # But we keep y up for now — depth = z_cam > 0 means in front of camera
    R = np.stack([x, y, z], axis=0)   # (3,3), rows are basis vectors in world space
    t = -R @ eye
    return R.astype(np.float32), t.astype(np.float32)


def perspective(fov_y_deg: float, W: int, H: int):
    """Returns (fx, fy, cx, cy)."""
    fov_y = np.deg2rad(fov_y_deg)
    fy = H / (2 * np.tan(fov_y / 2))
    fx = fy
    cx = W / 2.0
    cy = H / 2.0
    return fx, fy, cx, cy


def compute_2d_cov(R_cam: np.ndarray, scales: np.ndarray, quats: np.ndarray,
                   xyz_cam: np.ndarray, fx: float, fy: float):
    """
    Project 3D Gaussian covariances to 2D screen covariances.
    Returns (N, 2, 2) sigma2d.
    """
    N = len(scales)
    # 3D covariance Σ = R_gs @ S @ S^T @ R_gs^T
    R_gs = quat_to_rotmat(quats)   # (N,3,3)
    S = np.zeros((N, 3, 3), dtype=np.float32)
    S[:, 0, 0] = scales[:, 0]
    S[:, 1, 1] = scales[:, 1]
    S[:, 2, 2] = scales[:, 2]
    # RS = R_gs @ S
    RS = np.einsum("nij,njk->nik", R_gs, S)  # (N,3,3)
    Sigma3d = np.einsum("nij,nkj->nik", RS, RS)  # (N,3,3), symmetric

    # Transform to camera space: Sigma_cam = R_cam @ Sigma3d @ R_cam^T
    Sigma_cam = np.einsum("ij,njk,lk->nil", R_cam, Sigma3d, R_cam)  # (N,3,3)

    # Jacobian of perspective projection at each point
    z = xyz_cam[:, 2].clip(0.01)
    J = np.zeros((N, 2, 3), dtype=np.float32)
    J[:, 0, 0] = fx / z
    J[:, 0, 2] = -fx * xyz_cam[:, 0] / (z * z)
    J[:, 1, 1] = fy / z
    J[:, 1, 2] = -fy * xyz_cam[:, 1] / (z * z)

    # Sigma2d = J @ Sigma_cam @ J^T
    JSigma = np.einsum("nij,njk->nik", J, Sigma_cam)  # (N,2,3)
    Sigma2d = np.einsum("nij,nkj->nik", JSigma, J)    # (N,2,2)

    # Add small regularization for stability
    Sigma2d[:, 0, 0] += 0.3
    Sigma2d[:, 1, 1] += 0.3
    return Sigma2d


def render_gaussians(
    gaussians: dict,
    eye: np.ndarray,
    W: int = 512, H: int = 512,
    fov_y: float = 30.0,
    near: float = 0.1,
    far: float = 10.0,
    max_gaussians: int = 60000,
    up: np.ndarray | None = None,
) -> np.ndarray:
    """
    Render Gaussians to an (H, W, 3) uint8 image.

    When the PLY contains ``f_rest_*`` (FaceLift degree-3 SH), evaluates **full SH**
    toward the camera; otherwise DC-only RGB. Subsampling keeps splats **closest to the
    camera** (not highest opacity) to reduce floater speckle on frontal views.
    """
    eye = np.asarray(eye, dtype=np.float32)
    xyz = gaussians["xyz"]
    rgb = gaussians["rgb"]
    opacity = gaussians["opacity"]
    scales = gaussians["scales"]
    quats = gaussians["quats"]
    sh = gaussians.get("sh")

    # Keep nearest splats (floaters are often high-opacity but off-surface)
    if len(xyz) > max_gaussians:
        dist = np.linalg.norm(xyz - eye[None, :], axis=1)
        keep = np.argpartition(dist, max_gaussians - 1)[:max_gaussians]
        xyz, rgb, opacity, scales, quats = (
            xyz[keep], rgb[keep], opacity[keep], scales[keep], quats[keep]
        )
        if sh is not None:
            sh = sh[keep]

    # View-dependent color (matches GPU path much better than DC-only)
    if sh is not None:
        vdir = eye[None, :] - xyz
        vlen = np.linalg.norm(vdir, axis=1, keepdims=True).clip(1e-8, None)
        dirs = (vdir / vlen).astype(np.float32)
        rgb = np.clip(eval_sh_deg3(sh, dirs) + 0.5, 0.0, 1.0)

    R_cam, t_cam = look_at(eye, up=up)
    fx, fy, cx, cy = perspective(fov_y, W, H)

    # Transform to camera space
    xyz_cam = (R_cam @ xyz.T).T + t_cam   # (N,3)
    depth = xyz_cam[:, 2]

    # Filter: only points in front of camera and within [near, far]
    valid = (depth > near) & (depth < far)
    xyz_cam, rgb, opacity, scales, quats, depth = (
        a[valid] for a in (xyz_cam, rgb, opacity, scales, quats, depth)
    )
    N = len(xyz_cam)
    print(f"  Rendering {N} valid Gaussians ...")

    if N == 0:
        return np.ones((H, W, 3), dtype=np.uint8) * 255

    # Project to screen (y-axis flipped: y_cam+ is "up", screen y+ is "down")
    u = fx * xyz_cam[:, 0] / xyz_cam[:, 2] + cx   # (N,)
    v = -fy * xyz_cam[:, 1] / xyz_cam[:, 2] + cy  # (N,) negate y for screen coords

    # Compute 2D covariances
    Sigma2d = compute_2d_cov(R_cam, scales, quats, xyz_cam, fx, fy)  # (N,2,2)

    # Invert 2D covariance
    det = Sigma2d[:, 0, 0] * Sigma2d[:, 1, 1] - Sigma2d[:, 0, 1] ** 2
    det = det.clip(1e-6)
    inv_Sigma = np.zeros_like(Sigma2d)
    inv_Sigma[:, 0, 0] =  Sigma2d[:, 1, 1] / det
    inv_Sigma[:, 0, 1] = -Sigma2d[:, 0, 1] / det
    inv_Sigma[:, 1, 0] = -Sigma2d[:, 1, 0] / det
    inv_Sigma[:, 1, 1] =  Sigma2d[:, 0, 0] / det

    # Compute bounding boxes: 3-sigma radius in screen pixels
    sigma_px = np.sqrt(np.maximum(Sigma2d[:, 0, 0], Sigma2d[:, 1, 1]))
    radius = (3 * sigma_px).clip(1, 64).astype(int)

    # Sort by depth (back to front)
    order = np.argsort(-depth)
    u, v, rgb, opacity, inv_Sigma, radius = (
        a[order] for a in (u, v, rgb, opacity, inv_Sigma, radius))

    # Rasterize
    canvas = np.ones((H, W, 3), dtype=np.float32)   # white background

    for i in range(N):
        cx_i, cy_i = u[i], v[i]
        r = int(radius[i])
        x0 = max(0, int(cx_i) - r)
        x1 = min(W, int(cx_i) + r + 1)
        y0 = max(0, int(cy_i) - r)
        y1 = min(H, int(cy_i) + r + 1)
        if x0 >= x1 or y0 >= y1:
            continue

        # Grid of pixel coords
        ys, xs = np.mgrid[y0:y1, x0:x1]   # (h, w)
        dx = xs - cx_i   # (h, w)
        dy = ys - cy_i

        # Gaussian falloff: exp(-0.5 * [dx, dy] @ inv_Sigma @ [dx, dy]^T)
        iS = inv_Sigma[i]
        power = 0.5 * (iS[0, 0] * dx**2 + 2 * iS[0, 1] * dx * dy + iS[1, 1] * dy**2)
        gauss = np.exp(-power.clip(0, 12))   # (h, w)

        alpha = (opacity[i] * gauss).clip(0, 1)   # (h, w)
        color_i = rgb[i]   # (3,)

        # Alpha compositing (over operator): C = alpha * c + (1-alpha) * C_prev
        canvas[y0:y1, x0:x1] = (
            alpha[:, :, None] * color_i[None, None, :]
            + (1 - alpha[:, :, None]) * canvas[y0:y1, x0:x1]
        )

    return (canvas * 255).clip(0, 255).astype(np.uint8)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ply", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--eye", nargs=3, type=float, default=[0, 0, 3],
                    help="Camera eye position x y z")
    ap.add_argument("--up", nargs=3, type=float, default=None,
                    help="Camera up vector (default: Y-up, auto-switches to Z-up if degenerate)")
    ap.add_argument("--size", type=int, default=512)
    ap.add_argument("--fov", type=float, default=30.0)
    ap.add_argument("--max-gs", type=int, default=60000)
    args = ap.parse_args()

    print(f"Loading {args.ply} ...")
    gs = load_gaussians(args.ply)
    print(f"  {len(gs['xyz'])} Gaussians loaded")

    eye = np.array(args.eye, dtype=np.float32)
    up = np.array(args.up, dtype=np.float32) if args.up else None
    print(f"Rendering from eye={eye} ...")
    img = render_gaussians(gs, eye=eye, W=args.size, H=args.size,
                           fov_y=args.fov, max_gaussians=args.max_gs, up=up)
    Image.fromarray(img).save(args.out)
    print(f"Saved to {args.out}")


if __name__ == "__main__":
    main()
