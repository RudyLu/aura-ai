# Aura heart identity

The approved heart concept replaces the visual orb in the shared Aura mark, navigation, splash wordmark, Apple Health connection tile, and browser icon. Chat behavior and backend logic are unchanged.

## Assets

- `public/assets/brand/aura-heart-companion-v1.png`: dimensional companion used for large Aura marks.
- `public/assets/brand/aura-heart-mark-v1.png`: simplified mark used at small sizes and for the browser icon.

Both PNGs have transparent backgrounds and are the 1254px masters; the app does not load them. It serves resized exports instead (made with `sips -Z`):

- `aura-heart-companion-v1-320.png` (about 130 KB): hero mark, drawn at up to 150px.
- `aura-heart-mark-v1-160.png` (about 21 KB): small marks, the navigation icon and the Apple Health tile, drawn at up to 78px.
- `aura-heart-mark-v1-64.png` (about 5 KB): browser icon.

Existing wrapper sizes and Aura animation states are retained. In the transition from the hero to the small conversation mark, the top mark starts with the companion artwork over it and cross-fades to the mark as it moves, so the artwork does not swap suddenly. Original orb assets remain available for rollback.

## Provenance

Created using the built-in image generation tool from Ellie's supplied `Aura.png` and the approved comparison preview.

Companion prompt: Extract a single hollow heart companion from the approved reference, with satin pearlescent mist-blue, lavender, peach, and champagne shading. Keep the asymmetric rounded heart shape, restrained glow, and transparent background and center. No text or surrounding layout.

Small-mark prompt: Extract the simplified hollow heart from the approved reference. Preserve the soft blue-to-peach gradient and recognizable silhouette, with minimal surface detail, no outer glow or shadow, no text, and a transparent background and center.

## Validation

Type checking, the existing 83 tests, and production build pass. A local Chromium mobile visual check confirms that assets load, the hero changes to the small chat mark, and the page has no horizontal overflow or JavaScript errors. API requests in the visual check use in-memory fixtures; no persisted personal data is changed.

This change has not been deployed to the hosted prototype.
