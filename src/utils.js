module.exports = {
  isString: function(obj) {
    return toString.call(obj) === '[object String]'
  },

  isNumber: function(obj) {
    return toString.call(obj) === '[object Number]'
  },

  isArray: function(obj) {
    return toString.call(obj) === '[object Array]'
  },

  isNothing: function(obj) {
    return obj === null || typeof obj === 'undefined'
  },

  getNode: function(node) {
    if (this.isString(node)) {
      return document.querySelector(node)
    } else if (node.isGlimg) {
      return node.canvas
    } else {
      return node
    }
  }
}
