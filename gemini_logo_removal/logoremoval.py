#!/usr/bin/env python3
"""
remove_logo.py  (v2) - Remove a static semi-transparent logo (e.g. the Gemini
sparkle / Veo mark) from a video, frame by frame.

Two removal modes
  unblend (default)  The Gemini logo is a white shape blended over the video with
                     partial transparency. The tool learns that transparency map
                     from the video itself, then mathematically reverses the blend.
                     This restores the real pixels underneath, so textures stay
                     sharp with no smudge. Any nearly-opaque pixels fall back to
                     inpainting.
  temporal           Fills the logo area with REAL pixels borrowed from neighbouring
                     frames (tracked with optical flow), revealed as things move
                     past. Where nothing is ever revealed, it clone-stamps matching
                     texture from right beside the logo. Use this on a video that
                     was already damaged by an earlier cleanup, or for fully
                     opaque logos. No blurry "mirror" patch.
  inpaint            Classic OpenCV inpainting (fast, but leaves a smooth patch).

Install
  pip install opencv-python numpy imageio-ffmpeg
  (imageio-ffmpeg bundles ffmpeg, which keeps the audio and writes H.264.
   A system-wide ffmpeg on PATH also works.)

Usage
  python remove_logo.py original.mp4 --preview        # check detection first
  python remove_logo.py damaged.mp4 -o fixed.mp4 --mode temporal
  python remove_logo.py original.mp4 -o clean.mp4     # process the video
  python remove_logo.py original.mp4 -o clean.mp4 --box 580,1138,48,44   # manual box
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile

import cv2
import numpy as np

CORNERS = ("br", "bl", "tr", "tl", "all")


def parse_args():
    p = argparse.ArgumentParser(description="Remove a static logo from a video.")
    p.add_argument("input")
    p.add_argument("-o", "--output", help="output file (default: <input>_clean.mp4)")
    p.add_argument("--mode", default="unblend", choices=("unblend", "temporal", "inpaint"))
    p.add_argument("--box", help="logo box x,y,w,h in pixels (skips auto-detect)")
    p.add_argument("--mask", help="mask image, white = logo (skips auto-detect)")
    p.add_argument("--corner", default="br", choices=CORNERS, help="where to look (default br)")
    p.add_argument("--search", type=float, default=0.3, help="corner size as fraction (default 0.3)")
    p.add_argument("--logo-color", default="255,255,255", help="logo colour R,G,B (default white)")
    p.add_argument("--dilate", type=int, default=None,
                   help="grow mask by N px (default 6, or 10 for temporal mode)")
    p.add_argument("--radius", type=int, default=4, help="inpainting radius (default 4)")
    p.add_argument("--max-alpha", type=float, default=0.85,
                   help="pixels more opaque than this are inpainted instead of unblended")
    p.add_argument("--samples", type=int, default=150, help="frames used to learn the logo")
    p.add_argument("--crf", type=int, default=17, help="H.264 quality, lower = better")
    p.add_argument("--preview", action="store_true", help="write preview PNGs and exit")
    return p.parse_args()


# ------------------------------------------------------------------ helpers

def find_ffmpeg():
    """Use ffmpeg from PATH, or the copy bundled with the imageio-ffmpeg package."""
    ff = shutil.which("ffmpeg")
    if ff:
        return ff
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def read_samples(path, n_total, n_samples):
    cap = cv2.VideoCapture(path)
    idxs = set(np.linspace(0, max(n_total - 1, 0), min(n_samples, max(n_total, 1))).astype(int))
    frames, i = [], 0
    while True:                       # sequential read: seeking is unreliable in some codecs
        ok, f = cap.read()
        if not ok:
            break
        if i in idxs:
            frames.append(f)
        i += 1
    cap.release()
    return frames


def corner_region(w, h, corner, frac):
    cw, ch = int(w * frac), int(h * frac)
    return {"br": (w - cw, h - ch, w, h), "bl": (0, h - ch, cw, h),
            "tr": (w - cw, 0, w, ch), "tl": (0, 0, cw, ch), "all": (0, 0, w, h)}[corner]


def fill_holes(m):
    cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    out = m.copy()
    cv2.drawContours(out, cnts, -1, 255, cv2.FILLED)
    return out


# ------------------------------------------------------------------ detection

def auto_detect(frames, w, h, args):
    """A logo is the thing that stays brighter (or darker) than its surroundings
    in the same place in every frame, while the real content moves around."""
    x0, y0, x1, y1 = corner_region(w, h, args.corner, args.search)
    k = max(3, int(min(w, h) * 0.06) | 1)       # odd kernel ~6% of frame size
    acc = np.zeros((y1 - y0, x1 - x0), np.float32)
    for f in frames:
        g = cv2.cvtColor(f[y0:y1, x0:x1], cv2.COLOR_BGR2GRAY)
        acc += g.astype(np.float32) - cv2.medianBlur(g, k).astype(np.float32)
    score = np.abs(acc / len(frames))
    score = cv2.GaussianBlur(score, (3, 3), 0)

    peak = score.max()
    if peak < 6:
        return None
    cand = (score > max(6, 0.4 * peak)).astype(np.uint8) * 255
    cand = cv2.morphologyEx(cand, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n, labels, stats, _ = cv2.connectedComponentsWithStats(cand)
    py, px = np.unravel_index(score.argmax(), score.shape)
    keep = labels[py, px]
    if keep == 0:
        return None
    # also keep other strong blobs right next to the main one (multi-part logos)
    bx, by, bw, bh = stats[keep, :4]
    region = np.zeros_like(cand)
    for i in range(1, n):
        x, y, ww, hh, area = stats[i]
        near = (x < bx + bw + bw and x + ww > bx - bw and y < by + bh + bh and y + hh > by - bh)
        if i == keep or (near and area > 20):
            region[labels == i] = 255
    mask = np.zeros((h, w), np.uint8)
    mask[y0:y1, x0:x1] = fill_holes(region)
    return mask


def build_mask(args, frames, w, h):
    if args.mask:
        m = cv2.imread(args.mask, cv2.IMREAD_GRAYSCALE)
        if m is None:
            sys.exit(f"Could not read {args.mask}")
        mask = (cv2.resize(m, (w, h), interpolation=cv2.INTER_NEAREST) > 127).astype(np.uint8) * 255
        src = "mask image"
    elif args.box:
        x, y, bw, bh = [int(v) for v in args.box.split(",")]
        mask = np.zeros((h, w), np.uint8)
        mask[max(y, 0):y + bh, max(x, 0):x + bw] = 255
        src = "box"
    else:
        mask = auto_detect(frames, w, h, args)
        if mask is None:
            sys.exit("No static logo found. Try --corner tl/tr/bl or pass --box x,y,w,h")
        src = "auto-detect"
    if args.dilate > 0:
        mask = cv2.dilate(mask, cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE, (2 * args.dilate + 1,) * 2))
    return mask, src


# ------------------------------------------------------------------ alpha learning

def estimate_alpha(frames, mask, roi, logo_bgr, radius):
    """Model: observed = a*logo + (1-a)*background.
    For each frame, guess the background by inpainting, then solve for the
    per-pixel transparency a by least squares over all frames. Inpainting
    guesses are wrong in different ways each frame (the camera moves), so the
    errors average out and the real logo shape remains."""
    x0, y0, x1, y1 = roi
    m = mask[y0:y1, x0:x1]
    L = np.array(logo_bgr, np.float32)
    num = np.zeros(m.shape, np.float32)
    den = np.zeros(m.shape, np.float32)
    for f in frames:
        crop = f[y0:y1, x0:x1]
        bg = cv2.inpaint(crop, m, radius, cv2.INPAINT_TELEA).astype(np.float32)
        I = crop.astype(np.float32)
        d = L - bg                                    # (logo - background)
        num += ((I - bg) * d).sum(axis=2)
        den += (d * d).sum(axis=2)
    a = num / np.maximum(den, 1e-3)
    a = np.clip(a, 0, 0.98)
    a[m == 0] = 0
    a = cv2.GaussianBlur(a, (3, 3), 0)
    a[m == 0] = 0
    return a


def unblend(crop, a, logo_bgr, hard_mask, radius):
    I = crop.astype(np.float32)
    A = a[..., None]
    out = (I - A * np.array(logo_bgr, np.float32)) / np.maximum(1 - A, 0.02)
    out = np.clip(out, 0, 255).astype(np.uint8)
    if hard_mask.any():
        out = cv2.inpaint(out, hard_mask, radius, cv2.INPAINT_TELEA)
    return out


# ------------------------------------------------------------------ temporal fill

INF = 10_000


def detect_cuts(small_frames):
    d = [0.0] + [float(np.abs(small_frames[i] - small_frames[i - 1]).mean())
                 for i in range(1, len(small_frames))]
    med = float(np.median(d[1:])) if len(d) > 1 else 0.0
    shot, ids = 0, []
    for v in d:
        if v > max(25.0, 5 * med):
            shot += 1
        ids.append(shot)
    return ids


def fill_flow_in_hole(flow, hole_u8):
    valid = (hole_u8 == 0).astype(np.float32)
    out = flow.copy()
    h = hole_u8 > 0
    for s in (8, 20, 50):
        num = cv2.GaussianBlur(flow * valid[..., None], (0, 0), s)
        den = cv2.GaussianBlur(valid, (0, 0), s)
        ok = h & (den > 1e-3)
        out[ok] = num[ok] / den[ok][:, None]
        if ok.sum() == h.sum():
            break
    return out


def _pass(crops, bases, grays, mask, shots, order, dis, log, label):
    """Propagate pixels through the hole along `order` (forward or backward).
    Returns per-frame values and 'age' = frames since the pixel was real content."""
    H, W = mask.shape
    hole = mask > 0
    # pixels in a thin band around the logo are not trusted as sources: in near-still
    # shots tiny tracking errors would otherwise drag border pixels inward as streaks
    band = (cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13))) > 0) & ~hole
    gx, gy = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
    vals, ages = [None] * len(crops), [None] * len(crops)
    prev = None
    for k, t in enumerate(order):
        age = np.full((H, W), INF, np.float32)
        age[~hole & ~band] = 0
        val = crops[t].astype(np.float32)
        val[hole] = bases[t][hole]          # never let raw logo pixels into propagation
        if prev is not None and shots[prev] == shots[t]:
            flow = fill_flow_in_hole(dis.calc(grays[t], grays[prev], None), mask)
            mx, my = gx + flow[..., 0], gy + flow[..., 1]
            inside = (mx >= 0) & (mx <= W - 1) & (my >= 0) & (my <= H - 1)
            p_val = cv2.remap(vals[prev], mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
            p_age = cv2.remap(ages[prev], mx, my, cv2.INTER_NEAREST, borderValue=INF)
            take = (hole | band) & inside & (p_age < INF)
            val[take] = p_val[take]
            age[take] = p_age[take] + 1
        vals[t], ages[t] = val, age
        prev = t
        if (k + 1) % 48 == 0 or k == len(order) - 1:
            log(f"\r  {label} pass {k + 1}/{len(order)}", end="", flush=True)
    log("")
    return vals, ages


def clone_fill(img, mask, prev_d=None):
    """Clone-stamp: copy the hole from a nearby offset whose surroundings match best."""
    H, W = mask.shape
    hole = mask > 0
    ys, xs = np.where(hole)
    size = max(xs.max() - xs.min(), ys.max() - ys.min()) + 1
    ring = (cv2.dilate(mask, np.ones((11, 11), np.uint8)) > 0) & ~hole
    f = img.astype(np.float32)
    cands = []
    for r in (1.0, 1.3, 1.7):
        for ang in np.linspace(0, 2 * np.pi, 16, endpoint=False):
            cands.append((int(round(r * size * np.cos(ang))), int(round(r * size * np.sin(ang)))))
    if prev_d is not None:
        cands.append(prev_d)
    best, best_s, prev_s = None, 1e9, 1e9
    for dx, dy in cands:
        if (xs.min() - 6 + dx < 0 or xs.max() + 6 + dx >= W or
                ys.min() - 6 + dy < 0 or ys.max() + 6 + dy >= H):
            continue
        M = np.float32([[1, 0, dx], [0, 1, dy]])
        sh = cv2.warpAffine(f, M, (W, H), flags=cv2.WARP_INVERSE_MAP | cv2.INTER_NEAREST)
        shm = cv2.warpAffine(mask, M, (W, H), flags=cv2.WARP_INVERSE_MAP | cv2.INTER_NEAREST)
        if (shm[hole | ring] > 0).any():
            continue
        sc = float(np.abs(sh[ring] - f[ring]).mean())
        if (dx, dy) == prev_d:
            prev_s = sc
        if sc < best_s:
            best, best_s, best_img = (dx, dy), sc, sh
    if best is None:
        return None, None
    if prev_d is not None and prev_s < 1.5 * best_s and prev_d != best:   # avoid flicker
        M = np.float32([[1, 0, prev_d[0]], [0, 1, prev_d[1]]])
        best = prev_d
        best_img = cv2.warpAffine(f, M, (W, H), flags=cv2.WARP_INVERSE_MAP | cv2.INTER_NEAREST)
    return best_img, best


def seamless(filled, tgt, mask):
    m = cv2.dilate(mask, np.ones((3, 3), np.uint8))
    ys, xs = np.where(m > 0)
    H, W = mask.shape
    if xs.min() < 2 or ys.min() < 2 or xs.max() > W - 3 or ys.max() > H - 3:
        return filled
    center = (int((xs.min() + xs.max()) // 2), int((ys.min() + ys.max()) // 2))
    br = cv2.boundingRect(m)
    center = (br[0] + br[2] // 2, br[1] + br[3] // 2)
    try:
        return cv2.seamlessClone(filled, tgt, m, center, cv2.NORMAL_CLONE)
    except cv2.error:
        return filled


def temporal_fill(crops, mask, shots, radius=4, log=print, max_age=12):
    """crops: ROI crops of every frame (BGR). mask: ROI mask (255 = logo).
    shots: shot id per frame (from detect_cuts on whole frames)."""
    n = len(crops)
    hole = mask > 0
    bases = [cv2.inpaint(c, mask, max(radius, 10), cv2.INPAINT_NS) for c in crops]
    grays = [cv2.cvtColor(b, cv2.COLOR_BGR2GRAY) for b in bases]
    bases = [b.astype(np.float32) for b in bases]
    dis = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    fv, fa = _pass(crops, bases, grays, mask, shots, list(range(n)), dis, log, "forward ")
    bv, ba = _pass(crops, bases, grays, mask, shots, list(range(n - 1, -1, -1)), dis, log, "backward")

    feather = cv2.GaussianBlur(cv2.dilate(mask, np.ones((5, 5), np.uint8)).astype(np.float32) / 255,
                               (0, 0), 1.5)[..., None]
    # Decide per shot: clone-stamp only where nearby texture genuinely matches
    # (rugs, grass, fabric); otherwise smooth seamless fill (skin, walls, floors).
    ring = (cv2.dilate(mask, np.ones((11, 11), np.uint8)) > 0) & ~hole
    ratios = {}
    for t in range(0, n, 4):
        cl, _ = clone_fill(crops[t], mask)
        if cl is None:
            continue
        f = crops[t].astype(np.float32)
        err = float(np.abs(cl[ring] - f[ring]).mean())
        g = cv2.cvtColor(crops[t], cv2.COLOR_BGR2GRAY).astype(np.float32)
        tex = float(np.abs(g - cv2.GaussianBlur(g, (0, 0), 3))[ring].mean())
        ratios.setdefault(shots[t], []).append(err / max(tex, 0.5))
    use_clone = {sh: float(np.median(v)) < 2.5 for sh, v in ratios.items()}

    out, real = [], []
    prev_d = None
    for t in range(n):
        if t > 0 and shots[t] != shots[t - 1]:
            prev_d = None
        a1 = np.where(fa[t] > max_age, INF, fa[t])
        a2 = np.where(ba[t] > max_age, INF, ba[t])
        w1 = np.where(a1 < INF, 1.0 / (a1 + 1) ** 2, 0)
        w2 = np.where(a2 < INF, 1.0 / (a2 + 1) ** 2, 0)
        ws = w1 + w2
        tgt = crops[t].astype(np.float32)
        filled = tgt.copy()
        got = hole & (ws > 0)
        filled[got] = ((fv[t] * w1[..., None] + bv[t] * w2[..., None])[got] / ws[got][:, None])
        filled = np.clip(filled, 0, 255).astype(np.uint8)
        left = hole & ~got
        cloned = False
        if left.any():
            cl = None
            if use_clone.get(shots[t], False):
                cl, prev_d = clone_fill(crops[t], mask, prev_d)
            if cl is not None:
                filled[left] = np.clip(cl[left], 0, 255).astype(np.uint8)
                cloned = True
            else:
                filled[left] = np.clip(bases[t][left], 0, 255).astype(np.uint8)
        if cloned:
            res = seamless(filled, crops[t], mask)
        else:
            res = np.clip(feather * filled.astype(np.float32) + (1 - feather) * tgt, 0, 255).astype(np.uint8)
        out.append(res)
        real.append(got.sum() / max(hole.sum(), 1))
    return out, float(np.mean(real))


# ------------------------------------------------------------------ main

def main():
    args = parse_args()
    if args.dilate is None:
        args.dilate = 10 if args.mode == "temporal" else 6
    cap = cv2.VideoCapture(args.input)
    if not cap.isOpened():
        sys.exit(f"Cannot open {args.input}")
    w, h = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.release()
    print(f"Video: {w}x{h} @ {fps:.2f} fps, {n} frames")

    print("Learning the logo from the video...")
    frames = read_samples(args.input, n, args.samples)
    mask, src = build_mask(args, frames, w, h)
    ys, xs = np.where(mask > 0)
    print(f"Logo area ({src}): x={xs.min()}-{xs.max()}, y={ys.min()}-{ys.max()}")

    pad = 110 if args.mode == "temporal" else args.radius * 3 + 8
    roi = (max(xs.min() - pad, 0), max(ys.min() - pad, 0),
           min(xs.max() + pad + 1, w), min(ys.max() + pad + 1, h))
    x0, y0, x1, y1 = roi
    m_roi = mask[y0:y1, x0:x1]
    r, g, b = [float(v) for v in args.logo_color.split(",")]
    logo_bgr = (b, g, r)

    if args.mode == "unblend":
        alpha = estimate_alpha(frames, mask, roi, logo_bgr, args.radius)
        hard = ((alpha > args.max_alpha) * 255).astype(np.uint8)
        if hard.any():
            hard = cv2.dilate(hard, np.ones((3, 3), np.uint8))
        print(f"Logo opacity: max {alpha.max():.2f}, "
              f"{int((hard > 0).sum())} px too opaque -> inpainted")
    del frames

    t_out = None
    if args.mode == "temporal":
        print("Reading all frames for temporal fill...")
        cap = cv2.VideoCapture(args.input)
        crops, small = [], []
        while True:
            ok, f = cap.read()
            if not ok:
                break
            crops.append(f[y0:y1, x0:x1].copy())
            small.append(cv2.resize(f, (64, 114)).astype(np.float32))
        cap.release()
        shots = detect_cuts(small)
        print(f"{len(set(shots))} shot(s) detected")
        t_out, cov = temporal_fill(crops, m_roi, shots, args.radius)
        print(f"{cov * 100:.0f}% of the logo area filled with real pixels from other frames, "
              f"rest filled from surrounding texture")
        del crops, small
    frame_idx = [0]

    def clean(frame):
        crop = frame[y0:y1, x0:x1]
        if args.mode == "unblend":
            frame[y0:y1, x0:x1] = unblend(crop, alpha, logo_bgr, hard, args.radius)
        elif args.mode == "temporal":
            k = min(frame_idx[0], len(t_out) - 1)
            frame[y0:y1, x0:x1] = t_out[k]
        else:
            frame[y0:y1, x0:x1] = cv2.inpaint(crop, m_roi, args.radius, cv2.INPAINT_TELEA)
        return frame

    base = os.path.splitext(args.input)[0]
    if args.preview:
        cap = cv2.VideoCapture(args.input)
        cap.set(cv2.CAP_PROP_POS_FRAMES, n // 2)
        ok, f = cap.read()
        cap.release()
        frame_idx[0] = n // 2
        before = f.copy()
        ov = f.copy(); ov[mask > 0] = (0, 0, 255)
        marked = cv2.addWeighted(f, 0.6, ov, 0.4, 0)
        after = clean(f)
        z = lambda im: cv2.resize(im[y0:y1, x0:x1], None, fx=4, fy=4,
                                  interpolation=cv2.INTER_NEAREST)
        cv2.imwrite(base + "_preview.png", np.hstack([z(before), z(marked), z(after)]))
        cv2.imwrite(base + "_mask.png", mask)
        if args.mode == "unblend":
            amap = np.zeros((h, w), np.uint8)
            amap[y0:y1, x0:x1] = (alpha * 255).astype(np.uint8)
            cv2.imwrite(base + "_alpha.png", amap)
        print(f"Preview: {base}_preview.png  (zoomed: original | detected area | cleaned)")
        return

    output = args.output or base + "_clean.mp4"
    ff = find_ffmpeg()
    tmp = tempfile.mkdtemp()
    silent = os.path.join(tmp, "v.mp4") if ff else output
    if not ff:
        print("WARNING: ffmpeg not found -> output will have NO AUDIO and lower quality.\n"
              "         Fix: pip install imageio-ffmpeg   (then run this again)")
    writer = cv2.VideoWriter(silent, cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))
    cap = cv2.VideoCapture(args.input)
    i = 0
    while True:
        ok, f = cap.read()
        if not ok:
            break
        frame_idx[0] = i
        writer.write(clean(f))
        i += 1
        if i % 24 == 0 or i == n:
            print(f"\rFrame {i}/{n}", end="", flush=True)
    cap.release(); writer.release(); print()

    if ff:
        print("Encoding H.264 + copying audio...")
        subprocess.run([ff, "-y", "-loglevel", "error", "-i", silent, "-i", args.input,
                        "-map", "0:v:0", "-map", "1:a?", "-c:v", "libx264", "-preset", "slow",
                        "-crf", str(args.crf), "-pix_fmt", "yuv420p", "-c:a", "copy",
                        "-shortest", "-movflags", "+faststart", output], check=True)
        shutil.rmtree(tmp, ignore_errors=True)
    print(f"Done -> {output}")


if __name__ == "__main__":
    main()