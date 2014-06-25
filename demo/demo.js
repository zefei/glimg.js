'use strict'

angular.module('demo', [])

.factory('testFactory', [function() {
  'pass'
}])

.run(['$rootScope', function($rootScope) {
  'pass'
}])

.controller('DemoCtrl', ['$scope', function($scope) {
  window.tt = $scope.image = glimg('#canvas').loadFromUrl('demo.jpg').setZoom(0.3)
  $scope.test = glimg('#test').setZoom(0.3)

  $scope.input = {blur: 0, rotate: 0, gray: 0, contrast: 50}

  $scope.clone = function() {
    $scope.test.load($scope.image)
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

  $scope.copy = function() {
    $scope.image
    .blend($scope.demo3, {mode: 'hue'})
  }

  $scope.onRotateChange = function() {
    $scope.image.rotate($scope.input.rotate)
  }

  $scope.onBlurChange = function() {
    $scope.image.blur($scope.input.blur)
  }

  $scope.onGrayChange = function() {
    $scope.image.chain()
    .blur($scope.input.blur)
    .monotone($scope.input.gray / 100)
    .blend($scope.demo3, {mode: 'normal', mask: $scope.text, coord: {left: 0.3, top: 0.4, right: 0.7, bottom: 0.7}})
    .contrast($scope.input.contrast / 50)
    .done()
  }

  $scope.onContrastChange = function() {
    $scope.image.chain()
    .blur($scope.input.blur)
    .monotone($scope.input.gray / 100)
    .blend($scope.demo3, {mode: 'normal', mask: $scope.text, coord: {left: 0.3, top: 0.4, right: 0.7, bottom: 0.7}})
    .contrast($scope.input.contrast / 50)
    .done()
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
