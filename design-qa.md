# Design QA

source visual truth: `C:/Users/Vlad/AppData/Local/Temp/codex-clipboard-e71925f4-96c9-4f4d-89cd-343c2129babd.png`
implementation: `http://127.0.0.1:4173/` (browser-rendered CUA capture, current graphite-glass state)
viewport: 1864 × 884 CSS px, desktop
source pixels: 747 × 746; implementation capture: 1864 × 884; density normalization: focused qualitative comparison of the illuminated edge rather than full-frame composition
state: graphite glass selected, default demo SVG, light power 14, depth 0.18, light angle 0°

## Full-view comparison evidence

The source uses a black field with a restrained luminous edge around dark glass forms. The implementation keeps the existing editor composition and applies that lighting principle only to the graphite object, as requested. The object remains dark and reflective while a thin edge separates it from the black background.

## Focused region comparison evidence

The reference edge is not a uniform graphic stroke: it is faint along most of the silhouette, cold blue-white on the dominant lit side, locally white at peak reflection, and lightly warm on the opposing side. The implementation uses an expanded back-face Fresnel shell with directional cool and warm response, producing the same non-uniform behavior while the existing bloom provides the soft outer glow.

## Required fidelity surfaces

- Fonts and typography: unchanged; the reference is used only for the 3D lighting treatment.
- Spacing and layout rhythm: unchanged; no UI layout changes were requested.
- Colors and visual tokens: cool blue-white is dominant, with a restrained warm secondary reflection matching the reference principle.
- Image quality and asset fidelity: the effect is generated from the live SVG geometry, so it follows arbitrary imported contours without raster scaling artifacts.
- Copy and content: unchanged.

## Findings

- [P3] The existing main white studio reflection is stronger than the central reflection in the reference. This is intentional because the current graphite material and its light-power control remain unchanged; the requested rim treatment is independent from the main material lighting.

## Interaction checks

- The rim follows object rotation because it shares the object transform.
- The rim is enabled only for graphite glass; amber crystal and blue chrome keep their existing materials.
- SVG upload and 4K export remain wired to the existing workflows.
- Browser-rendered graphite state was captured and visually inspected.
- `npm.cmd run build` passed.
- `npm.cmd test -- --run` passed: 30 tests.

## Comparison history

1. First pass was too faint and visible only as a hairline at the top edge.
2. Increased the Fresnel response and shell scale while preserving directional variation. The revised capture shows a readable thin rim with cool-white highlights and subdued darker sections.

final result: passed
