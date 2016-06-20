/*
ionic-audio v1.3.0
 
Copyright 2016 Ariel Faur (https://github.com/arielfaur)

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
angular.module('ionic-audio', ['ionic']);

angular.module('ionic-audio').filter('time', function () {
	var addLeadingZero = function(n) {
        return (new Array(2).join('0')+n).slice(-2)
    };

    return function(input) {
        input = input || 0;
        var t = parseInt(input);
        return addLeadingZero(Math.floor(t / 60)) + ':' + addLeadingZero(t % 60);
    };
});


angular.module('ionic-audio').filter('duration', ['$filter', function ($filter) {
    return function (input) {
        return (input > 0) ? $filter('time')(input) : '';
    };
}]);


angular.module('ionic-audio').service('MediaManager', ['$interval', '$timeout', '$window', '$rootScope', function ($interval, $timeout, $window, $rootScope) {
    var tracks = [], currentTrack, currentMedia, playerTimer, currentTrackIndex=0, isPlaying;
    var callbacks = {};
        callbacks.onSuccess = function(){};
        callbacks.onError = function(){};
        callbacks.onStatusChange = function(){};
        callbacks.onProgress = function(){};
        callbacks.trackChanged = function(){};
    var vm = this;

    if (!$window.cordova && !$window.Media) {
        console.log("ionic-audio: missing Cordova Media plugin. Have you installed the plugin? \nRun 'ionic plugin add cordova-plugin-media'");
        // return null;
    }

    // return {
    //     setTracks: setTracks,
    //     add: add, // this is required because we may want to have individual "players" - but nobody cares
    //     play: play,
    //     pause: pause,
    //     stop: stop,
    //     seekTo: seekTo,
    //     destroy: destroy,

    //     getPlaylistSize: getPlaylistSize,
    //     getPlaylistPosition: getPlaylistPosition,
    //     getPlaylist: getPlaylist,

    //     insertTrackAtIndex: insertTrackAtIndex,
    //     setCallbacks: setCallbacks
    // };

    vm.getPlaylistSize = function(){
        return tracks.length;
    };

    vm.getPlaylistPosition = function(){
        return currentTrackIndex;
    };

    vm.getPlaylist = function(){
        return tracks;
    };

    vm.getTrack = function(){
        return tracks[currentTrackIndex];
    };

    vm.isPlaying = function(){
        return isPlaying;
    };

     /*
        this is the most important function of all
        we will add the whole list
        if its a single track, it should still arrive in a list
        if new tracks are set stop everything else and broadcast 
     */
    vm.setTracks = function(tracklist, play){
        vm.stop(); // stop current playing track
        vm.destroy();
        tracks = [];
        currentTrackIndex = 0;
        for (var i=0, l= tracklist.length; i < l; i++){
            vm.add(tracklist[i]);
        }
        currentTrack = undefined;
        trackChanged();
        if (play === true){
            vm.play(0);
        }
        $rootScope.$broadcast('ionic-audio:setTracks', vm.getPlaylist());
     };

    /*
    Creates a new Media from a track object

     var track = {
         url: 'https://s3.amazonaws.com/ionic-audio/Message+in+a+bottle.mp3',
         artist: 'The Police',
         title: 'Message in a bottle',
         art: 'img/The_Police_Greatest_Hits.jpg'
     }
     */
    vm.setCallbacks = function(playbackSuccess, playbackError, statusChange, progressChange, trackChanged){
        console.log("set new callbacks");
        callbacks.onSuccess = playbackSuccess;
        callbacks.onError = playbackError;
        callbacks.onStatusChange = statusChange;
        callbacks.onProgress = progressChange;
        callbacks.trackChanged = trackChanged;
    };


    vm.add = function(track) {
        if (!track.url) {
            console.log('ionic-audio: missing track url');
            return;
        }

        angular.extend(track, {
            onSuccess: onSuccess,
            onError: onError,
            onStatusChange: onStatusChange,
            onProgress: onProgress,
            status: 0,
            duration: -1,
            progress: 0
        });

        // if (find(track)) {
        //     return track.id;
        // }

        track.id  = tracks.push(track) - 1; // a playlist can have same track multiple times
        return track.id;
    };

    vm.play = function(index) {
        if (typeof index !== "undefined"){
            if (index > vm.getPlaylistSize() - 1) { return; }

            if (currentTrack && currentTrackIndex == index){
                if (!isPlaying){
                    vm.resume();
                }
            } else {
                vm.stop();
                currentTrack = tracks[index];
                currentTrackIndex = index;
                trackChanged();
                vm.playTrack();
            }
        } else {
            if (currentTrack){
                if (!isPlaying){
                    vm.resume();
                }
            } else {
                currentTrack = tracks[currentTrackIndex];
                trackChanged();
                vm.playTrack();
            }
        }
    };

    vm.pause = function() {
        console.log('ionic-audio: pausing track '  + currentTrack.title);
        currentMedia.pause();
        stopTimer();
        isPlaying = false;
    };

    vm.seekTo = function(pos) {
        if (!currentMedia) return;

        currentMedia.seekTo(pos * 1000);
    };

    vm.destroy = function() {
        stopTimer();
        vm.releaseMedia();
    };

    vm.playTrack = function() {
        console.log('ionic-audio: playing track ' + currentTrack.title);

        currentMedia = vm.createMedia(currentTrack);
        currentMedia.play();

        startTimer();
    }

    vm.resume = function() {
        if (typeof currentTrack === "undefined"){
            return;
        }
        console.log('ionic-audio: resuming track ' + currentTrack.title);
        currentMedia.play();
        startTimer();
        isPlaying = true;
    };

    vm.stop = function() {
        if (currentMedia){
            console.log('ionic-audio: stopping track ' + currentTrack.title);
            currentMedia.stop();    // will call onSuccess...
            isPlaying = false;
        }
    };

    vm.createMedia = function(track) {
        if (!track.url) {
            console.log('ionic-audio: missing track url');
            return undefined;
        }

        return new Media(track.url,
            angular.bind(track, onSuccess),
            angular.bind(track, onError),
            angular.bind(track, onStatusChange));
    };

    vm.releaseMedia = function() {
        if (angular.isDefined(currentMedia)) {
            currentMedia.release();
            currentMedia = undefined;
            currentTrack = undefined;
            trackChanged();
        }
    };

    var onSuccess = function() {
        // media has finished
        stopTimer();
        vm.releaseMedia();

        if (angular.isFunction(callbacks.onSuccess))
            callbacks.onSuccess();

        if (typeof tracks[currentTrackIndex + 1] !== "undefined"){
            vm.play(currentTrackIndex+1); // play next track;
        }
    };

    var onError = function(err) {
        if (angular.isFunction(callbacks.onError))
            callbacks.onError(err);
    };

    var onStatusChange = function(status) {
        this.status = status;
        $rootScope.$broadcast('ionic-audio:status', status);
        // Media.MEDIA_NONE = 0;
        // Media.MEDIA_STARTING = 1;
        // Media.MEDIA_RUNNING = 2;
        // Media.MEDIA_PAUSED = 3;
        // Media.MEDIA_STOPPED = 4;

        if (angular.isFunction(callbacks.onStatusChange))
            callbacks.onStatusChange(status);
    };

    var stopTimer = function() {
        $rootScope.$broadcast('ionic-audio:startStopToggle', "stopped");
        if (angular.isDefined(playerTimer)) {
            $interval.cancel(playerTimer);
            playerTimer = undefined;
        }
    };

    var trackChanged = function(){
        console.log("calling track changed");
        if (angular.isFunction(callbacks.trackChanged)){
            callbacks.trackChanged();
        }
    };

    function onProgress(progress, duration){
        $rootScope.$broadcast('ionic-audio:progress', { progress:progress, duration:duration });
        if (angular.isFunction(callbacks.onProgress)){
            callbacks.onProgress(progress, duration);
        }
    }

    function startTimer() {
        $rootScope.$broadcast('ionic-audio:startStopToggle', "started");
        if ( angular.isDefined(playerTimer) ) return;

        if (!currentTrack) return;

        playerTimer = $interval(function() {
            if ( currentTrack.duration < 0){
                currentTrack.duration = currentMedia.getDuration();
            }

            currentMedia.getCurrentPosition(
                // success callback
                function(position) {
                    if (position > -1) {
                        currentTrack.progress = position;
                    }
                },
                // error callback
                function(e) {
                    console.log("Error getting pos=" + e);
                });

            if (angular.isFunction(currentTrack.onProgress))
                currentTrack.onProgress(currentTrack.progress, currentTrack.duration);

        }, 1000);
    }

    vm.insertTrackAtIndex = function(index, track){
        tracks.splide(index, 0, track);
        return tracks;
    }

    vm.removeTrack = function(index){
        if (index === currentTrackIndex){
            // if its the same index - stop music
            // remove current track
            // dont change index and play music
            stop();
            tracks.splice(index, 1);
            play(index);
        } else if (index < currentTrackIndex){
            // if index is less than current index
            currentTrackIndex -= currentTrackIndex;
            tracks.splice(index, 1);
        } else {
            // index > currentTrackInde
            tracks.splice(index, 1);
        }
    }
}]);
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
angular.module('ionic-audio').directive('ionAudioProgress', ionAudioProgress);

function ionAudioProgress() {
    return {
        restrict: 'E',
        scope: {
            track: '='
        },
        template: '{{track.progress | time}}'
    }
}

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

            console.log("logging audio-play controller");
            console.log(controller);

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

angular.module('ionic-audio').directive('ionAudioDuration', ionAudioDuration);

function ionAudioDuration() {
    return {
        restrict: 'E',
        scope: {
            track: '='
        },
        template: '{{track.duration | duration}}'
    }
}

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
