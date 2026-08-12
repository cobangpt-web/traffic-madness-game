# Gameplay Screen v1 — Generation Record

- Mode: built-in image generation
- Use case: `ui-mockup`
- References:
  - local Kenney Racing Pack sample map
  - local red car sprite
  - local road/curb texture
  - local tree sprite

## Final prompt

Create a shippable-looking 16:9 Korean browser-game screen for `교통지옥 60초`. Show a single compact top-down four-way intersection with a top HUD and two large bottom phase controls. Use only the world-object vocabulary visible in the supplied Kenney Racing Pack references: light blue-gray asphalt, orange-and-white curbs, red/orange, blue, green, yellow and gray cars, green trees, cones, barriers and road arrows. Use simple CSS-buildable panels and red/yellow/green circles for signals and HUD. Include the labels `교통지옥 60초`, `점수 12,480`, `00:42`, `콤보 ×6`, `최고 18,920`, `남북`, and `동서`. Do not add buildings, pedestrians, emergency vehicles, characters, brands, watermarks or new illustrated world objects. Keep the camera orthographic top-down and the style crisp, flat and consistent with the provided Kenney references.

The generated PNG is a layout and art-direction reference. Production gameplay must reconstruct the world from the licensed source sprites and CSS UI rather than sampling the PNG as a texture.
