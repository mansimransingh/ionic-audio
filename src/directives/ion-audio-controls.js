angular.module('ionic-audio').directive('ionAudioControls', function() {
    return {
      restrict: 'EA',
      require: ['ionAudioControls', '^^ionMediaPlayer'],
      controller: ['$scope', '$element', ionAudioControlsCtrl],
      link: link
    };

function ionAudioControlsCtrl($scope, $element) {
        var hasLoaded;
        // // var spinnerElem = $element.find('ion-spinner'), hasLoaded, self = this;

        // this.toggleSpinner = function(state) {
        //   if (state){
        //     spinnerElem.addClass('ng-hide');
        //   } else {
        //     spinnerElem.removeClass('ng-hide');
        //   }
        // };

        // this.toggleSpinner(true);

        // this.play = function() {
        //   if (!hasLoaded) {
        //       self.toggleSpinner(false);
        //   }
        //   this.start();
        // };

        var unbindStatusListener = $scope.$parent.$watch('watchProperties.status', function (status) {
            switch (status) {
              case 1: // Media.MEDIA_STARTING
                  hasLoaded = false;
                  break;
              case 2: // Media.MEDIA_RUNNING
                  if (!hasLoaded) {
                      // self.toggleSpinner(false);
                      hasLoaded = true;
                  }
                  break;
              //case 3: // Media.MEDIA_PAUSED
              //    break;
              case 0: // Media.MEDIA_NONE
              case 4: // Media.MEDIA_STOPPED
                  hasLoaded = false;
                  break;
            }
        });

        $scope.$on('$destroy', function() {
          unbindStatusListener();
        });
    }

    function link(scope, element, attrs, controllers) {
        controllers[0].start = controllers[1].start;
    }
});
