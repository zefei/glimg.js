module.exports = {
  isString: function(obj) {
    return Object.prototype.toString.call(obj) === '[object String]'
  },

  isNumber: function(obj) {
    return Object.prototype.toString.call(obj) === '[object Number]'
  },

  isArray: function(obj) {
    return Object.prototype.toString.call(obj) === '[object Array]'
  },

  isNothing: function(obj) {
    return obj === null || typeof obj === 'undefined'
  },

  isWebgl: function(node) {
    return node.getContext &&
           (node.getContext('webgl') || node.getContext('experimental-webgl'))
  },

  isWebkit: function() {
    return 'WebkitAppearance' in document.documentElement.style
  },

  getNode: function(node) {
    if (this.isString(node)) {
      return document.querySelector(node)
    } else if (node.isGlimg) {
      return node.canvas
    } else {
      return node
    }
  },

  clamp: function(value, min, max) {
    return value < min ? min : (value > max ? max : value)
  },

  transpose: function(matrix) {
    var m = this.flatten(matrix)
    if (m.length === 4) {
      return [
        m[0], m[2],
        m[1], m[3]
      ]
    } else if (m.length === 9) {
      return [
        m[0], m[3], m[6],
        m[1], m[4], m[7],
        m[2], m[5], m[8]
      ]
    } else {
      return [
        m[0], m[4], m[8], m[12],
        m[1], m[5], m[9], m[13],
        m[2], m[6], m[10], m[14],
        m[3], m[7], m[11], m[15]
      ]
    }
  },

  flatten: function(array) {
    return Array.prototype.concat.apply([], array)
  },

  camelCase: function(string) {
    return string.toLowerCase().replace(/-(.)/g, function(_, word) {
      return word.toUpperCase()
    })
  }
}
