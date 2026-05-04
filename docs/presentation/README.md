# Capstone Presentation Materials

| File | Purpose |
|------|---------|
| [`slides.md`](slides.md) | 12-slide deck (Marp/Reveal compatible). Build with `npx @marp-team/marp-cli slides.md --pdf` or `--pptx`. |
| [`qa-prep.md`](qa-prep.md) | Likely jury questions paired with one-screen answers and the live artifacts that prove each one. |
| [`checklist.md`](checklist.md) | T-24h → T-15m → live demo → post-demo checklist. |

## Demo video (out of scope here)

The script and shot list for `demo.mp4` (3 min, 1080p, voice-over Türkçe)
live in `slides.md` slide notes. Record with OBS, edit in iMovie/DaVinci,
export to `docs/presentation/demo.mp4`. Keep it under 3 minutes — the
backup is meant to fit between slide 5 and slide 8 if live demo fails.

## Submission folder

After the run, copy the deliverables into `/submission/`:

```
submission/
├── README.md           ← repo readme
├── presentation/
│   ├── slides.pdf
│   ├── slides.pptx
│   └── demo.mp4
├── docs/
│   ├── architecture.md
│   └── runbook/
└── source/             ← `git archive HEAD | tar -x -C source`
```
