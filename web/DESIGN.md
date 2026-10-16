---
name: Aura v2
description: Personal wellbeing records in a charcoal sky with warm light and frosted controls.
colors:
  bg: "#17191d"
  sky: "#101215"
  surface: "#22252b"
  surface-raised: "#292d35"
  ink: "#f2f2f0"
  muted: "#b5b9c3"
  line: "#3a3e47"
  action: "#eeb28b"
  action-ink: "#211c19"
  focus: "#ffcf9e"
  sample: "#c9b8ff"
  ok: "#b6d5c5"
  card: "#2b2630"
  card2: "#241f29"
  cardtext: "#f1ebe5"
  cardsoft: "#b8aea6"
typography:
  headline:
    fontFamily: "DM Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  body:
    fontFamily: "DM Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "16px"
    lineHeight: 1.5
  conversation:
    fontFamily: "DM Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "16px"
    lineHeight: 1.45
  label:
    fontFamily: "DM Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "13px"
rounded:
  field: "12px"
  card: "20px"
  soft: "22px"
  sheet: "26px"
  composer: "28px"
  primary: "30px"
  circle: "50%"
spacing:
  tight: "6px"
  small: "8px"
  related: "10px"
  medium: "14px"
  inset: "16px"
  roomy: "18px"
  gutter: "22px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.action-ink}"
    rounded: "{rounded.primary}"
    padding: "14px 22px"
    width: "100%"
  button-quiet:
    textColor: "{colors.muted}"
  button-glass-round:
    textColor: "#f2efea"
    rounded: "{rounded.circle}"
    size: "44px"
  conversation-aura:
    textColor: "#eeeae6"
    rounded: "20px 20px 20px 6px"
    padding: "13px 16px"
    typography: "{typography.conversation}"
  composer:
    rounded: "{rounded.composer}"
    padding: "6px 6px 6px 8px"
---

# Design System: Aura v2

## Overview

**Creative North Star: "Charcoal atmosphere, warm Aura light"**

The supplied v2 prototype establishes the visual authority: a dark charcoal sky, peach and lilac illumination, abstract circular Aura and animated wellbeing illustrations. The implemented app keeps a calm, narrow portrait composition even in a desktop browser. Frosted controls sit above the atmosphere; records and conversations remain readable on dark surfaces.

This document records the frontend in `src/ui/` and the effective cascade in `src/styles/flow.css`, `aura.css`, `app.css` and `web.css`. It describes appearance, not Agent reasoning or generation. Integration scope and pending backend behavior remain in `docs/aura-v2-integration.md`.

**Key Characteristics:**
- Charcoal surfaces with peach actions and cool atmospheric light.
- Portrait phone column and shared horizontal gutters.
- Frosted round controls, pill navigation and soft cards.
- Supplied abstract Aura and expressive recording art.

## Colors

Warm action light sits against charcoal neutrals; lilac and blue give atmosphere and distinguish data rather than coloring every control.

### Primary
- **Peach action:** primary actions, selected answers and progress accents; dark labels preserve legibility.
- **Warm focus:** visible keyboard outlines and the input caret.

### Secondary
- **Lilac sample:** sample labels; violet sky haze belongs to the supplied artwork and atmospheric gradients.
- **Soft green:** completion and recorded-state accents.

### Neutral
- **Charcoal background / sky:** app surface and surrounding night atmosphere.
- **Surface / raised surface:** record, form and supporting containers.
- **Warm card / deeper card:** recurring plan card gradient.
- **Ink / muted:** main reading text and supporting text.
- **Line:** restrained strokes and dividers.

**The Warm Action Rule.** Preserve the peach action with a dark label; use quiet neutral controls for supporting actions, as Today does.

## Typography

**Display and Body Font:** DM Sans, with Apple system and sans-serif fallbacks.
**Brand Font:** the splash uses the supplied prototype’s text wordmark: Aura in locally hosted Aura Syne at weight 700, with .ai in DM Sans at weight 400.

The app uses compact sans typography and medium-weight headings. Brand lettering is separate from functional reading text.

### Hierarchy
- **Headline:** Today heading uses the headline token; Aura's welcome heading is larger (30px, weight 600, line-height 1.15).
- **Title:** card and sheet titles use medium-weight compact headings; sheet titles are 22px.
- **Body:** everyday records and forms use the body token; chat uses its tighter conversation line-height.
- **Label:** supporting labels and navigation are compact; badges and chart ticks use smaller contextual sizes.

**The Reading Voice Rule.** Use DM Sans for interface and conversation text; reserve the prototype’s text wordmark lettering for branding.

## Layout

The app is a centered portrait column with maximum width 430px and minimum height 100dvh. Wide browsers retain phone proportions; the surrounding body stays dark. Today, Explore and Aura share 22px side gutters. Safe-area insets contribute to top controls and bottom padding.

The floating three-tab navigation spans up to 398px, with content bottom padding reserving room for it. It hides while a field is being edited. Aura occupies the phone viewport without the tab bar, uses a close control aligned to the shared gutter, and keeps its dock at the bottom. Aura replies and offered cards share a column capped at min(80%, 300px); user replies align right and cap at min(75%, 280px).

Bottom sheets remain inside the same 430px column on desktop. Full-screen sheets fill the viewport height within that column. Narrow-screen comparison layouts collapse to one column at 480px; small record cards adapt below 380px.

## Elevation & Depth

Depth combines tonal charcoal layering, thin translucent strokes, soft ambient shadows and backdrop blur. Atmospheric gradients and supplied art remain background layers. Interactive glass has brighter inset edges; it must remain visually distinct from ambient sky light.

### Shadow Vocabulary
- **Warm card:** `0 10px 30px #0006` beneath plan cards.
- **Glass control:** `inset 0 1px 0 #ffffff40, inset 0 -1px 0 #00000026, 0 8px 24px #00000047` on round controls.
- **Aura reply:** `0 6px 18px #0004` with translucent charcoal and 14px blur.

**The Glass Control Rule.** Use the same frosted circular treatment for Today settings and full-screen close controls.

## Shapes

Cards use soft rounded silhouettes; pill controls and circular icons recur throughout the app. Field corners are modest, while the composer has a broad pill silhouette. Bottom sheets round only their top corners. Chat replies soften one lower corner toward their speaker alignment. Supplied SVG faces and circular Aura are identity assets rather than generic icon substitutes.

## Components

### Buttons
Peach primary buttons span their container, use a minimum height of 54px and weight 600. Quiet actions retain muted text. Small pill actions vary by surface: Today is neutral; Aura's inline actions are light against glass. Round settings and close controls are 44px, with hover brightening and active scale 0.94. Keyboard focus uses a visible warm outline.

### Chips
Topic and signal chips remain compact, wrap or scroll where implemented, and expose selection with a changed surface/stroke. Sample and demo provenance remains visibly labeled. Selected chart series keep their own signal color.

### Cards / Containers
Record and plan containers use dark surfaces, subtle borders and generous internal padding. Plan cards use the warm dark gradient; conversation cards use translucent glass. Today maintains one headline followed by a check-in, step and records hierarchy.

### Inputs / Fields
Dark fields use light text and a warm caret. The chat composer uses a translucent light gradient, 16px backdrop blur and a focus-within ring. Its textarea grows within the pill; the send control appears when text is present. Dynamic replies, selectable choices, clarification and insight containers retain the chat's typography and soft forms.

### Navigation
Today, Explore and Aura sit in a floating frosted pill. The selected tab uses a warm pool of light, brighter text and a distinct inset pill. Aura replaces this navigation with a close/return control. Sheets make underlying app content inert.

### About sheet
The supplied compact topology is retained: three labeled facts, two settings rows and a centered footer action. Replies, Data and Saved describe the current runtime state. The destructive footer label distinguishes personal records from demo reset.

### Aura and recording art
The welcome splash uses the prototype’s text wordmark over its supplied video, with no additional orb or image logo. Use the supplied abstract Aura in the Aura conversation, alongside the illustrated topic art and animated recording faces elsewhere. First-open Aura presents a large orb hero; conversation moves the light into a smaller background presence. Today activates the supplied light-current entrance once per first load: its headline emphasis clears after 2600ms and the entrance class clears after 3200ms, allowing the 8s idle breathing cycle. Each Explore overlay reveals once per visit when at least 35% of the chart enters the viewport. Aura clears its entrance class after 600ms, its first-open sequence after 2600ms and its hero-to-conversation handover after 800ms; fresh messages use the existing bubble entrance, and close returns after 240ms. These are activation windows, not replacements for the supplied CSS animation durations. Reduced motion skips these activation sequences and removes video playback, animated SVG elements and typing-dot movement in the web adapter.

## Do's and Don'ts

### Do:
- **Do** keep new app screens within the portrait column and shared gutter.
- **Do** retain the supplied art and charcoal, peach and lilac visual authority.
- **Do** provide visible keyboard focus and reduced-motion alternatives.
- **Do** keep real, synthetic and demo provenance visually explicit.

### Don't:
- **Don't** promote brand lettering into the interface reading font.
- **Don't** expand desktop app screens into an unrelated dashboard composition.
- **Don't** use visual polish to imply generated reviews or Agent capabilities that remain unavailable.

Feeling-face body shapes use 72% fill opacity on the user’s request. Eyes, mouths and accent symbols remain fully opaque for readability.

### Health data and rating controls (user approved update)

Health data combines source status, live saved usage preferences, PoC link and XML import in one sheet. It does not grant iOS permissions. Personal mode offers a separate Demo entry.

The 1–5 score uses a fixed center marker above a native horizontally scrolling ruler, with integer snap positions and five direct choice buttons. Touch uses native scrolling; mouse drag and keyboard arrows/Home/End are supported. No fractional score is stored. Review sheets use the ZIP clean header, check mark, day circles and footer while retaining real review integration states.

The latest user override removes expressive face art from all shared score controls. A fixed translucent capsule overlays the ruler, with continuously aligned magnified/blurred tick marks and glass highlights. It is decorative and ignores pointer events, preserving the accessible slider and integer scoring.

Latest ruler refinement: capsule width36px, a subtle tinted glow, no numeric tick labels. Tick and lens colours continuously interpolate from scroll position. Labels and 1–5 quick choices remain available; colour does not convey a health judgement.

User revision: the lens now moves directly with pointer input across stationary equal-height ticks. Unanswered controls start at the left edge without recording an answer. Only traversed ticks receive muted Aura peach; lens enlargement is vertical, and hue cycling was removed. Existing records reopen at their score. Release snaps to an integer score.

Latest approved refinement removes round score presets. The rail keeps keyboard arrows/Home/End and accessible score descriptions. Lens refraction varies smoothly with each tick’s distance from its center, and pointer release eases to the integer position over260ms; reduced-motion snaps immediately. Animation cancels on new drag and unmount. Fine vertical edge highlights and restrained interior shadows replace the earlier stronger glow.

Lens clarity refinement: a denser neutral glass backing masks original tick edges; refracted marks use1.1px blur and maximum1.35 vertical enlargement, reducing double edges and excess height.

Optical implementation revision: no duplicate ruler is rendered inside the lens. Existing tick geometry changes continuously near the moving lens, with local vertical enlargement and horizontal displacement. The masked colour overlay follows the same geometry. Transparent glass softly blurs these marks, and reflection angle responds subtly to drag direction.

Aura presence in the score lens: retain refraction and add a restrained warm peach atmospheric glow inside the glass, with a faint lavender edge and low-opacity outer spill. The glow follows the lens rather than flashing or cycling hue.

Explore no longer includes the redundant Week by week block. Aura entry glow replays on each visit, then settles into a12-second subtle breathing background; reduced-motion keeps a static light.
