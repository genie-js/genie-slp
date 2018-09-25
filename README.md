genie-slp
=========

Genie Engine .SLP graphic file reader in Node.js

[![NPM](https://nodei.co/npm/genie-slp.png?compact=true)](https://nodei.co/npm/genie-slp)

## Usage Example

```javascript
let fs = require('fs')

// Load a Palette file using the `jascpal` module
let Palette = require('jascpal')
let mainPalette = Palette(fs.readFileSync('palette.pal'))

// Load an SLP file and render a frame
let SLP = require('genie-slp')
let slp = SLP(fs.readFileSync('my-file.slp'))
let frame = slp.renderFrame(0, mainPalette, { player: 7 })

// Render the returned ImageData object to a PNG file
let { PNG } = require('pngjs')
let png = new PNG({
  width: frame.width,
  height: frame.height
})
png.data = Buffer.from(frame.data.buffer)
png.pack().pipe(fs.createWriteStream('my-file.png'))
```

## API

### `SLP(buffer: Buffer)`

Creates an SLP graphic from a buffer.

### `SLP#renderFrame(frameIndex: number, palette: Palette, { player: number, drawOutline: boolean }): ImageData`

Renders a frame to an `[ r, g, b, a ]` ImageData object.

**Parameters**

  - `frameIndex` - The SLP frame ID to render.
  - `palette` - A colour palette: an array of `[ r, g, b ]` colour arrays, probably from the [jascpal](https://github.com/goto-bus-stop/jascpal) module.
  - `options` - Optionally, an object with properties:
    - `player` - Player colour (1-8) to use for player-specific parts. Defaults to 1 (blue).
    - `drawOutline` - Whether to draw an outline (used when units are behind buildings, etc). Defaults to false.

In the browser, returns an ImageData object that can be drawn to a Canvas.
In node, returns a plain object with the `data` as a Uint8ClampedArray, the `width` of the frame, and the `height` of the frame (like the ImageData API).

## Related

 - [jascpal](https://github.com/goto-bus-stop/jascpal) - JASC Paint Shop Pro palette file parser--these are the palette files used by the Genie engine
 - [genie-drs](https://github.com/goto-bus-stop/genie-drs) - Read and manipulate Genie Engine .DRS file archives

## License

[GPL-3.0](./LICENSE.md)

Copyright (C) 2018  Renée Kooi <renee@kooi.me>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
