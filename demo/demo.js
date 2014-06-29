'use strict'

angular.module('demo', ['colorpicker.module'])

.factory('testFactory', [function() {
  'pass'
}])

.run(['$rootScope', function($rootScope) {
  'pass'
}])

.controller('DemoCtrl', ['$scope', function($scope) {
  window.ss = $scope
  window.tt = $scope.image = glimg('#canvas').loadFromUrl('demo.jpg').setZoom(0.3)
  $scope.test = glimg('#test').setZoom(0.3)

  $scope.input = {
    blur: 0,
    rotate: 0,
    gray: 0.5,
    contrast: 0.75,
    color1: 'rgb(127,127,127)',
    color2: 'rgb(127,127,127)'
  }

  $scope.clone = function() {
    $scope.test.load($scope.image)
  }

  $scope.convolve = function() {
    $scope.image.convolve([
      -2,-1,0,
      -1,1,1,
      0,1,2
    ])
  }

  function parseColor(string) {
    var c = string.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i)
    var r = parseInt(c[1]) / 255
    var g = parseInt(c[2]) / 255
    var b = parseInt(c[3]) / 255
    return [r, g, b]
  }

  $scope.onColorChange = function() {
    var highlight = parseColor($scope.input.color1)
    var shadow = parseColor($scope.input.color2)
    //$scope.image.splitTone(highlight, shadow)
    $scope.image.whiteBalance(highlight[0], highlight[1], highlight[2])
  }

  $scope.demo3 = new Image()
  $scope.demo3.src = 'demo3.jpg'

  $scope.text = new Image()
  $scope.text.src = 'demot.png'

  $scope.apply = function() {
    $scope.image.apply()
  }

  $scope.crop = function() {
    $scope.image.crop(0.2, 0.2, 0.5, 0.7)
  }

  $scope.wb = function() {
    $scope.image.whiteBalance()
  }

  $scope.copy = function() {
    $scope.image
    .blend($scope.demo3, {mode: 'normal', opacity: 1.0, mask: $scope.text})
  }

  $scope.onBlurChange = function() {
    $scope.image.blur($scope.input.blur)
  }

  $scope.onRotateChange = function() {
    $scope.image.rotate($scope.input.rotate)
    /*
    $scope.image.curves([
      [0, 0],
      [0.25, $scope.input.rotate],
      [0.5, $scope.input.gray],
      [0.75, $scope.input.contrast],
      [1, 1]
    ])
    */
  }

  $scope.onGrayChange = function() {
    /*
    $scope.image.brightnessContrast($scope.input.gray, $scope.input.contrast)
    */
    $scope.image.curves([
      [0, 0],
      [0.25, $scope.input.rotate],
      [0.5, $scope.input.gray],
      [0.75, $scope.input.contrast],
      [1, 1]
    ])
  }

  $scope.onContrastChange = function() {
    $scope.image.curves([
      [0, 0],
      [0.25, $scope.input.rotate],
      [0.5, $scope.input.gray],
      [0.75, $scope.input.contrast],
      [1, 1]
    ])
  }

  var download = document.getElementById('download')
  download.addEventListener('click', function() {
    this.href = $scope.image.toDataURL('png')
  })
}])

.directive('slider', ['$parse', '$timeout', function($parse, $timeout) {
  return {
    restrict: 'AE',
    replace: true,
    template: '<input type="number"></input>',
    link: function(scope, element, attrs) {
      var model = $parse(attrs.ngModel)

      var params = ['decimal', 'disable', 'disableOpacity', 'hideRange', 'klass',
        'min', 'max', 'start', 'step', 'vertical']
      var options = {}
      angular.forEach(params, function(param) {
        if (attrs[param]) options[param]= $parse(attrs[param])(scope)
      })

      var slider = new Powerange(element[0], options)

      scope.$watch(attrs.ngModel, function(value) {
        slider.setStart(value)
      })
    }
  }
}])
