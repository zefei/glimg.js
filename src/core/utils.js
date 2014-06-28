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

  flatten: function(array) {
    return Array.prototype.concat.apply([], array)
  },

  camelCase: function(string) {
    return string.toLowerCase().replace(/-(.)/g, function(_, word) {
      return word.toUpperCase()
    })
  }
}
