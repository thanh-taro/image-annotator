#!/usr/bin/env python3
"""Insert a minimal EXIF APP1 segment (Orientation tag 0x0112, plus an
ImageDescription and Artist tag used as "metadata canaries") right after the
JPEG SOI marker. Any existing APP1/EXIF segments are removed first.
Usage: exif_orient.py <in.jpg> <out.jpg> <orientation 1-8>"""
import struct, sys

def build_exif(orientation: int) -> bytes:
    desc = b"SPIKE-CANARY-DESCRIPTION\x00"
    artist = b"SPIKE-CANARY-ARTIST\x00"
    n = 3
    ifd_off = 8
    data_off = ifd_off + 2 + n * 12 + 4
    entries = b""
    entries += struct.pack(">HHIHH", 0x010E, 2, len(desc), 0, 0)[:8] + struct.pack(">I", data_off)
    entries += struct.pack(">HHIHH", 0x0112, 3, 1, orientation, 0)
    entries += struct.pack(">HHI", 0x013B, 2, len(artist)) + struct.pack(">I", data_off + len(desc))
    tiff = b"MM\x00\x2a" + struct.pack(">I", ifd_off) + struct.pack(">H", n) + entries + b"\x00\x00\x00\x00" + desc + artist
    payload = b"Exif\x00\x00" + tiff
    return b"\xff\xe1" + struct.pack(">H", len(payload) + 2) + payload

def strip_app1(jpg: bytes) -> bytes:
    assert jpg[:2] == b"\xff\xd8"
    out, i = [jpg[:2]], 2
    while i < len(jpg):
        marker = jpg[i:i+2]
        if marker[1] == 0xDA:  # SOS: rest is entropy data
            out.append(jpg[i:]); break
        seglen = struct.unpack(">H", jpg[i+2:i+4])[0]
        if marker != b"\xff\xe1":
            out.append(jpg[i:i+2+seglen])
        i += 2 + seglen
    return b"".join(out)

if __name__ == "__main__":
    src, dst, o = sys.argv[1], sys.argv[2], int(sys.argv[3])
    jpg = strip_app1(open(src, "rb").read())
    open(dst, "wb").write(jpg[:2] + build_exif(o) + jpg[2:])
