angular.module('ionic-audio').directive('ionMediaPlayer', ['MediaManager', '$rootScope', ionMediaPlayer]);

function ionMediaPlayer(MediaManager, $rootScope) {
    return {
        transclude: true,
        template: '<ng-transclude></ng-transclude>',
        restrict: 'E',
        scope: {
            togglePlayback: '='
        },
        require: 'ionMediaPlayer',
        link: function(scope, element, attr, controller){
             controller.hasOwnProgressBar = element.find('ion-audio-progress-bar').length > 0;
             controller.updateTrack();
             controller.setCallbacks();
        },
        controller: ['$scope', '$element', function($scope, $element){
            var controller = this;
            $scope.watchProperties = {};
                $scope.watchProperties.state = 0;
                $scope.watchProperties.duration = -1;
                $scope.watchProperties.progress = -1;

            var playbackSuccess = function() {
                controller.updateTrack();
                $scope.track.status = 0;
                $scope.track.progress = 0;
            };
            var statusChange = function(status) {
                controller.updateTrack();
                $scope.track.status = status;
                $scope.watchProperties.status = status;
                console.log("ion-media-player: status changed: "+status);
            };
            var progressChange = function(progress, duration) {
                $scope.track.progress = progress;
                $scope.track.duration = duration;
                $scope.watchProperties.duration = duration;
                $scope.watchProperties.progress = progress;
                console.log("ion-media-player: preogress changed: "+progress +" : "+duration);
            };
            var notifyProgressBar = function() {
                $rootScope.$broadcast('ionic-audio:trackChange', $scope.track);
            };

            var trackChanged = function(){
                controller.updateTrack();
            };

            this.setCallbacks = function(){
                MediaManager.setCallbacks(playbackSuccess, null, statusChange, progressChange, trackChanged);
            };
            
            this.updateTrack = function(){
                $scope.track = MediaManager.getTrack();
                notifyProgressBar();
                console.log("updating track again");
                console.log($scope.track);
             };
            this.updateTrack();
            // var init = function(newTrack, oldTrack) {
            //     if (!newTrack || !newTrack.url) return;

            //     newTrack.progress = 0;
            //     newTrack.status = 0;
            //     newTrack.duration = -1;
            //     if (oldTrack && oldTrack.id !== undefined) newTrack.id = oldTrack.id; 

            //     if (MediaManager) {
            //         MediaManager.add(newTrack, playbackSuccess, null, statusChange, progressChange);
            //     }
            // };



            this.seekTo = function(pos) {
                MediaManager.seekTo(pos);
            };

            this.getTrack = function() {
                return $scope.track;
            };

            this.start = function() {
                if (!$scope.track || !$scope.track.url) return;

                MediaManager.play();

                // notify global progress bar if detached from track
                if (!controller.hasOwnProgressBar) notifyProgressBar();

                return $scope.track.id;
            };
        }]
    };
}