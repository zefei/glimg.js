module.exports = {
  getWhiteColor: function(pixels) {
    var size = pixels.length
    var clipping = size / 4 * 0.001
    var luma = []

    var i, luma = []
    for (i = 0; i < 256; i++) luma[i] = 0

    for (i = 0; i < size; i += 4) {
      pixels[i + 3] = Math.round(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2])
      luma[pixels[i + 3]] += 1
    }

    var t = 0, lWhite = 0
    for (i = 255; i >= 0; i--) {
      if (t + luma[i] > clipping) {
        lWhite = i
        break
      } else {
        t += luma[i]
      }
    }

    var count = 0, rWhite = 0, gWhite = 0, bWhite = 0
    for (i = 0; i < size; i += 4) {
      if (pixels[i + 3] == lWhite) {
        count++
        rWhite += pixels[i]
        gWhite += pixels[i + 1]
        bWhite += pixels[i + 2]
      }
    }

    rWhite /= count
    gWhite /= count
    bWhite /= count
    return [rWhite, gWhite, bWhite]
  },

  t2rgb: function(temperature, green) {
    var t = temperature > 12000 ? 12000 : temperature
    var t2 = t * t, t3 = t2 * t

    var xD, yD
    if (t <= 4000) {
      xD = 0.27475e9 / t3 - 0.98598e6 / t2 + 1.17444e3 / t + 0.145986
    } else if (t <= 7000) {
      xD = -4.6070e9 / t3 + 2.9678e6 / t2 + 0.09911e3 / t + 0.244063
    } else {
      xD = -2.0064e9 / t3 + 1.9018e6 / t2 + 0.24748e3/ t + 0.237040
    }
    yD = -3 * xD * xD + 2.87 * xD - 0.275

    var x = xD / yD
    var y = 1
    var z = (1 - xD - yD) / yD
    var r = 3.24071 * x - 1.53726 * y - 0.498571 * z
    var g = -0.969258 * x + 1.87599 * y + 0.0415557 * z
    var b = 0.0556352 * x - 0.203996 * y + 1.05707 * z

    g = g / (green + 0.000001)
    var l = 0.299 * r + 0.587 * g + 0.114 * b
    r = r / l * 0.5
    g = g / l * 0.5
    b = b / l * 0.5

    return [r, g, b]
  },

  rgb2t: function(r, g, b) {
    var t, rgb
    var green = 1
    var tmin = 2000
    var tmax = 12000
    var br = b / r

    for (t = (tmin + tmax) / 2; tmax - tmin > 10; t = (tmin + tmax) / 2) {
      rgb = this.t2rgb(t, green)
      if (rgb[2] / rgb[0] > br) {
        tmax = t
      } else {
        tmin = t
      }
    }

    green = (rgb[1] / rgb[0]) / (g / r)
    return [t, green]
  }
}
