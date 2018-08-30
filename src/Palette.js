const JascPal = require('jascpal')

module.exports = Palette

function Palette (input) {
  return new JascPal(input)
}
Palette.prototype = JascPal.prototype

Palette.detect = function (data, options = {}) {
  const mainColors = Object.create(null)
  for (let i = 0; i < data.length; i += 4) {
    const idx = String((data[i] << 16) + (data[i + 1] << 8) + data[i + 2])
    if (!mainColors[idx]) mainColors[idx] = data.slice(0, 3)
  }

  const palette = Object.keys(mainColors).map((x) => mainColors[x])

  // Pad.
  while (palette.length < 256) {
    palette.push([ 0, 0, 0 ])
  }

  return Palette(palette)
}
