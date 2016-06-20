angular.module('ionic-audio').directive('ionAudioProgressBar', ['MediaManager', '$rootScope', ionAudioProgressBar]);

function ionAudioProgressBar(MediaManager, $rootScope) {
    return {
        restrict: 'E',
        scope: {
            track: '='
        },
        template:
            '<h2 class="ion-audio-track-info" ng-style="displayTrackInfo()">{{track.title}} - {{track.artist}}</h2>' +
            '<div class="range">' +
            '<ion-audio-progress track="track"></ion-audio-progress>' +
            '<input type="range" name="volume" min="0" max="{{track.duration}}" ng-model="track.progress" on-release="sliderRelease()" disabled>' +
            '<ion-audio-duration track="track"></ion-audio-duration>' +
            '</div>',
        link: link
    };

    function link(scope, element, attrs) {
        var slider =  element.find('input'), unbindTrackListener;

        function init() {
            scope.track.progress = 0;
            scope.track.status = 0;
            scope.track.duration = -1;

            var unbindProgressWatcher = $rootScope.$on('ionic-audio:progress', function(event, data){
                scope.track.progress = data.progress;
                scope.track.duration = data.duration;
            });
        }

        if (!angular.isDefined(attrs.displayTime)) {
            element.find('ion-audio-progress').remove();
            element.find('ion-audio-duration').remove();
        }
        
        if (!angular.isDefined(attrs.displayInfo)) {
            element.find('h2').remove();
        }

        // disable slider if track is not playing
        // var unbindStatusListener = scope.$watch('watchProperties.status', function(status) {
        //     // disable if track hasn't loaded
        //     slider.prop('disabled', status == 0);   //   Media.MEDIA_NONE
            
        // });

        // hide/show track info if available
        scope.displayTrackInfo = function() {
            return { visibility: angular.isDefined(attrs.displayInfo) && (scope.track.title || scope.track.artist) ? 'visible' : 'hidden'}
        };

        // handle track seek-to
        scope.sliderRelease = function() {
            MediaManager.seekTo(scope.track.progress);
        };

        scope.$on('$destroy', function() {
            // unbindStatusListener();
            if (angular.isDefined(unbindProgressWatcher)) {
                unbindProgressWatcher();
            }
        });

        init();
    }
}