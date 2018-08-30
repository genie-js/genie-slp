const struct = require('awestruct')
const t = struct.types

// SLP Header
module.exports = struct([
  ['version', t.string(4)],
  ['numFrames', t.int32],
  ['comment', t.string(24)],

  ['frames', t.array('numFrames', struct([
    ['cmdTableOffset', t.uint32],
    ['outlineTableOffset', t.uint32],
    ['paletteOffset', t.uint32],
    ['properties', t.uint32],

    ['width', t.int32],
    ['height', t.int32],
    ['hotspot', struct([
      ['x', t.int32],
      ['y', t.int32]
    ])]
  ]))]
])
