# ThreeJS Volumetric Clouds

A simplified, browser-ready fork of [FarazzShaikh/three-volumetric-clouds](https://github.com/FarazzShaikh/three-volumetric-clouds) that uses CDN Three.js with no build step required.

Demo Video: https://www.youtube.com/watch?v=UeMAJZeI_Q4 
## Features

- **Zero build step** - Runs directly in the browser using CDN imports
- **Interactive controls** - Adjust cloud speed, scale, light brightness, and hue in real-time
- **Camera view management** - Save and switch between multiple camera positions with smooth transitions
- **Smooth parameter interpolation** - Prevents visual glitches when adjusting settings

## Usage

Simply open `index.html` in a modern browser. No installation or build process required.

### Controls

- **Speed** - Adjust cloud movement speed (0-0.5)
- **Size** - Control cloud scale (0.5-5.0)
- **Light** - Adjust scene brightness (0-2.0)
- **Hue** - Shift background color hue (0-360°)
- **Camera** - Select from saved camera views

## Implementation

Based on the "Nubis, Evolved" presentation by Guerrilla Games, implementing:
- Envelope generation
- 3D Perlin-Worley noise textures
- Ray marching with adaptive sampling
- Multi-scattering lighting with anisotropic phase function

## Original Work

Forked from [FarazzShaikh/three-volumetric-clouds](https://github.com/FarazzShaikh/three-volumetric-clouds) - an experimental volumetric cloud implementation in Three.js.
