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

            var playbackSuccess = function() {
                controller.updateTrack();
                $scope.track.status = 0;
                $scope.track.progress = 0;
            };
            var statusChange = function(status) {
                controller.updateTrack();
                $scope.track.status = status;
                console.log("ion-media-player: status changed: "+status);
            };
            var progressChange = function(progress, duration) {
                $scope.track.progress = progress;
                $scope.track.duration = duration;
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