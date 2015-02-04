genie-slp
=========

Genie Engine .SLP graphic file reader in Node.js

[![NPM](https://nodei.co/npm/genie-slp.png?compact=true)](https://nodei.co/npm/genie-slp)

## Usage Example

```javascript
let fs = require('fs')
let SLP = require('slp')
let { Png } = require('png')

let slp = SLP(fs.readFileSync('my-file.slp'))
let frame = slp.renderFrame(0, { player: 7, palette: mainPalette })

let png = new Png(frame.buffer, frame.width, frame.height, 'rgba')
require('fs').writeFile('my-file.png', png.encode())
```

## API

### SLP(buf)

Creates an SLP graphic from a buffer.

### SLP#renderFrame(frameIndex, { palette, player }) → { buffer, width, height }

Renders a frame to an `[ r, g, b, a ]` pixel Buffer. Takes a `frameIndex`, and an options object with
a `palette` (an array of `[ r, g, b ]` colour arrays) and a `player` (ID of the player colour to use, 1-8).
Returns an object with the `buffer`, the `width` of the frame, and the `height` of the frame.