function supportsImageData () {
  try {
    const img = new window.ImageData(1, 1)
    return img.width === 1 && img.height === 1
  } catch (err) {
    return false
  }
}

function createImageDataSimple (width, height) {
  return new window.ImageData(width, height)
}

function createImageDataCanvas (canvas, width, height) {
  return canvas.getContext('2d')
    .createImageData(width, height)
}

function createImageDataObject (width, height) {
  return {
    data: new Uint8ClampedArray(width * height * 4).fill(0),
    width,
    height
  }
}

const hasWindow = typeof window !== 'undefined'
if (hasWindow && supportsImageData()) {
  module.exports = createImageDataSimple
} else if (hasWindow && typeof document !== 'undefined' && document.createElement) {
  const canvas = document.createElement('canvas')
  module.exports = (width, height) =>
    createImageDataCanvas(canvas, width, height)
} else {
  module.exports = createImageDataObject
}
