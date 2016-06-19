angular.module('ionic-audio').directive('ionAudioPlay', ['$ionicGesture', '$timeout',  '$rootScope','MediaManager', ionAudioPlay]);

function ionAudioPlay($ionicGesture, $timeout, $rootScope,MediaManager) {
    return {
        restrict: 'A',
        require: '^^ionAudioControls',
        link:  function (scope, element, attrs, controller) {
            console.log("printing controller");
            console.log(controller);
            var isLoading, debounce, currentStatus = 0;

            var setText = function() {
                if (!attrs.textPlay || !attrs.textPause) return;

                element.text((element.text() == attrs.textPlay ? attrs.textPause : attrs.textPlay));
            };

            var togglePlaying = function(showPlayButton) {
                if (typeof showPlayButton !== "undefined"){
                    if (showPlayButton){
                        element.removeClass('ion-pause');
                        element.addClass('ion-play');
                    } else {
                        element.removeClass('ion-play');
                        element.addClass('ion-pause');
                    }
                } else {
                    element.toggleClass('ion-play ion-pause');
                    
                }
                setText();
            };

            var init = function() {
                isLoading = false;
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
                if (debounce || isLoading) {
                    debounce = false;
                    return;
                }

                if (currentStatus == 0) isLoading = true;

                // controller.play();
                // togglePlaying();
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

// Media.MEDIA_NONE = 0;
// Media.MEDIA_STARTING = 1;
// Media.MEDIA_RUNNING = 2;
// Media.MEDIA_PAUSED = 3;
// Media.MEDIA_STOPPED = 4;
            
            var unbindStatusListener = $rootScope.$on('ionic-audio:status', function(event, status){
                if (status == 0 || status == 4) {
                    init();
                } else if (status == 2) {   // Media.MEDIA_RUNNING
                    isLoading = false;
                } else if (status == 1){
                    isLoading = true;
                }

                if (MediaManager.isPlaying()){
                    togglePlaying(false);
                } else {
                    togglePlaying(true);
                }   
            });

            // scope.$parent.$watch('watchProperties.status', function (status) {
            //     $rootScope.$emit('ionic-audio:statusChange', status);
            //     //  Media.MEDIA_NONE or Media.MEDIA_STOPPED
            //     if (status == 0 || status == 4) {
            //         init();
            //     } else if (status == 2) {   // Media.MEDIA_RUNNING
            //         isLoading = false;
            //     }

            //     currentStatus = status;
            // });

            // var unbindPlaybackListener = scope.$parent.$watch('togglePlayback', function (newPlayback, oldPlayback) {
            //     if (newPlayback == oldPlayback) return;
            //     $timeout(function() {
            //         togglePlaying();
            //         controller.play();
            //     },300)
            // });

            init();

            scope.$on('$destroy', function() {
                unbindStatusListener();
                // unbindPlaybackListener();
            });
        }
    }
}
