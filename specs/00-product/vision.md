# Vision

**A private screenshot annotator that works in any browser: paste an image, mark it up with
shapes, highlights, text and steps, redact what matters, and copy it back. Nothing leaves your
browser.**

## Problem
People writing bug reports, docs and design feedback, or sharing screenshots in chat, need to
mark up an image fast: point at the problem, label it, and hide anything sensitive. The tools
they have today are different on every machine and often can't be installed on managed
laptops, or they are web editors that upload the image, ask for an account or add a watermark.
Most only offer blur or pixelate to hide secrets, and both can be reversed.

## Who
PER-01 and PER-02 (see personas.md).

## Differentiators
1. **Verifiably local**: no request leaves the device once the tool has loaded, it works
   offline, and it says so plainly (PRN-01, NFR-01).
2. **Redaction you can trust**: a solid redaction is the safe default; blur and pixelate are
   labelled as not secure; exports never contain the hidden pixels (PRN-02, INV-02).
3. **Clean exports**: exported images carry no metadata from the original (INV-03).
4. **Fast everywhere**: the same tool on every desktop OS, quick from the keyboard (PRN-03),
   at home in the portal (PRN-05).

## Non-goals
Servers, uploads, share links, accounts, saved projects or history, analytics, screen capture,
automatic text recognition or redaction, a layers panel, several images per session, PDF or
video, vector export, collaboration.

## Success
The owner uses it as their default annotator for two weeks; five people on Windows or Linux
paste a screenshot, add two arrows, one redaction and one label, and copy it in under 20
seconds; at least three of the five would bookmark it.
