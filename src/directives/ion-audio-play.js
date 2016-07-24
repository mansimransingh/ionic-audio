angular.module('ionic-audio').directive('ionAudioPlay', ['$ionicGesture', '$timeout',  '$rootScope','MediaManager', ionAudioPlay]);

function ionAudioPlay($ionicGesture, $timeout, $rootScope, MediaManager) {
    return {
        restrict: 'A',
        require: '^^ionAudioControls',
        link:  function (scope, element, attrs, controller) {
            var spinnerElem = angular.element(element.find('ion-spinner')[0]);

            var hideSpinner = function(state) {
              if (state){
                spinnerElem.addClass('ng-hide');
                element.attr('disabled', false);
              } else {
                spinnerElem.removeClass('ng-hide');
                element.attr('disabled', true);
              }
            };

            var debounce, currentStatus = 0;
            
            var togglePlaying = function(showPlayButton) {
                if (showPlayButton){
                    element.removeClass('ion-pause');
                    element.addClass('ion-play');
                } else {
                    element.removeClass('ion-play');
                    element.addClass('ion-pause');
                }
            };

            var init = function() {
                // scope.isLoading = true;
                hideSpinner(true);
                element.addClass('ion-play');
                element.removeClass('ion-pause');
                element.text(attrs.textPlay);

                if (MediaManager.isPlaying()){
                    togglePlaying(false);
                } else {
                    togglePlaying(true);
                }
            };

            $ionicGesture.on('tap', function() {
                // debounce while loading and multiple clicks
                if (debounce || scope.isLoading) {
                    debounce = false;
                    return;
                }

                if (currentStatus == 0) { scope.isLoading = true; }

                if (MediaManager.isPlaying()){
                    MediaManager.pause();
                    togglePlaying(true);
                } else {
                    MediaManager.resume();
                    togglePlaying(false);
                }
            }, element);

            $ionicGesture.on('doubletap', function() {
                debounce = true;
            }, element);
            
            var unbindStatusListener = $rootScope.$on('ionic-audio:status', function(event, status){
                currentStatus = status;
                if (status == 0 || status == 4) {
                    init();
                } else if (status == 2) {   // Media.MEDIA_RUNNING
                    scope.isLoading = false;
                    hideSpinner(true);
                    togglePlaying(false);
                } else if (status == 1){
                    scope.isLoading = true;
                    hideSpinner(false);
                    togglePlaying(true);
                } 
            });

            init();

            scope.$on('$destroy', function() {
                unbindStatusListener();
            });
        }
    }
}
