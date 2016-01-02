module.exports = Frame

function Frame (buf) {
  if (!(this instanceof Frame)) return new Frame(buf)

  this.buf = buf
}
