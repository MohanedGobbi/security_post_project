# The desk and webcam simulation shared by the card makers: places a card picture on a desk as a webcam would see it.
import numpy as np
import cv2


def on_desk(card, scale, angle, persp, blur, noise, contrast, frame=(1920, 1080), glare=False):
    """Place the card on a desk background as a webcam would see it."""
    fh, fw = frame[1], frame[0]
    desk = np.full((fh, fw, 3), (96, 110, 124), np.uint8)
    desk = cv2.GaussianBlur(desk + np.random.randint(0, 22, desk.shape, dtype=np.uint8), (0, 0), 3)
    ch, cw = card.shape[:2]
    s = (fw * scale) / cw
    card = cv2.resize(card, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    ch, cw = card.shape[:2]
    pad = 200
    big = np.full((fh + 2 * pad, fw + 2 * pad, 3), 0, np.uint8)
    mask = np.zeros(big.shape[:2], np.uint8)
    x0, y0 = pad + (fw - cw) // 2, pad + (fh - ch) // 2
    big[y0:y0 + ch, x0:x0 + cw] = card
    mask[y0:y0 + ch, x0:x0 + cw] = 255
    M = cv2.getRotationMatrix2D((pad + fw / 2, pad + fh / 2), angle, 1.0)
    big = cv2.warpAffine(big, M, (big.shape[1], big.shape[0]))
    mask = cv2.warpAffine(mask, M, (big.shape[1], big.shape[0]))
    if persp:
        H, W = big.shape[:2]
        src = np.float32([[0, 0], [W, 0], [W, H], [0, H]])
        dst = src + np.float32([[persp * W, persp * H], [-persp * W, 0], [-persp * W * 0.4, -persp * H], [persp * W * 0.5, persp * H * 0.3]])
        P = cv2.getPerspectiveTransform(src, dst)
        big = cv2.warpPerspective(big, P, (W, H))
        mask = cv2.warpPerspective(mask, P, (W, H))
    big = big[pad:pad + fh, pad:pad + fw]
    mask = mask[pad:pad + fh, pad:pad + fw]
    out = np.where(mask[:, :, None] > 0, big, desk)
    out = out.astype(np.float32)
    out = (out - 128) * contrast + 128
    if glare:
        gy, gx = np.ogrid[:fh, :fw]
        g = np.exp(-(((gx - fw * 0.55) / 220) ** 2 + ((gy - fh * 0.6) / 70) ** 2)) * 120
        out += g[:, :, None]
    if blur:
        out = cv2.GaussianBlur(out, (0, 0), blur)
    out += np.random.normal(0, noise, out.shape)
    return np.clip(out, 0, 255).astype(np.uint8)
