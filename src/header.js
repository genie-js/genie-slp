const Struct = require('awestruct')

const t = Struct.types

// SLP Header
module.exports = Struct({
  version: t.string(4),
  numFrames: t.int32,
  comment: t.string(24),

  frames: t.array('numFrames', Struct({
    cmdTableOffset: t.uint32,
    outlineTableOffset: t.uint32,
    paletteOffset: t.uint32,
    properties: t.uint32,

    width: t.int32,
    height: t.int32,
    hotspot: Struct({
      x: t.int32,
      y: t.int32
    })
  }))
})
