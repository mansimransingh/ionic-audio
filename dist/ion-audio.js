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
        return currentTrack;
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
        for (var i=0, l=tracklist.length; i < l; i++){
            vm.add(tracklist[i]);
        }
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
    vm.setCallbacks = function(playbackSuccess, playbackError, statusChange, progressChange){
        callbacks.onSuccess = playbackSuccess;
        callbacks.onError = playbackError;
        callbacks.onStatusChange = statusChange;
        callbacks.onProgress = progressChange;
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
                vm.playTrack();
            }
        } else {
            if (currentTrack){
                if (!isPlaying){
                    vm.resume();
                }
            } else {
                currentTrack = tracks[currentTrackIndex];
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
        }
    };

    var onSuccess = function() {
        stopTimer();
        vm.releaseMedia();

        if (angular.isFunction(callbacks.onSuccess))
            callbacks.onSuccess();
    };

    var onError = function() {
        if (angular.isFunction(callbacks.onError))
            callbacks.onError();
    };

    var onStatusChange = function(status) {
        this.status = status;
        $rootScope.$broadcast('ionic-sudio:status', status);
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

    function onProgress(progress, duration){
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
        },
        controller: ['$scope', '$element', function($scope, $element){
            var controller = this;

            MediaManager.setCallbacks(playbackSuccess, null, statusChange, progressChange);

            var updateTrack = function(){
                $scope.track = MediaManager.getTrack();
            };            
            updateTrack();
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

            var playbackSuccess = function() {
                $scope.track.status = 0;
                $scope.track.progress = 0;
            };
            var statusChange = function(status) {
                $scope.track.status = status;
                updateTrack();
            };
            var progressChange = function(progress, duration) {
                $scope.track.progress = progress;
                $scope.track.duration = duration;
            };
            var notifyProgressBar = function() {
                $rootScope.$broadcast('ionic-audio:trackChange', $scope.track);
            };

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

            // var unbindWatcher = $scope.$watch('options.tracks', function(newTracks, oldTracks) {  
                // if (newTrack === undefined) return;         
                // MediaManager.stop();
                // init(newTrack, oldTracks);
            // });

            $scope.$on('$destroy', function() {
                // unbindWatcher();
                // MediaManager.destroy();
            });
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

angular.module('ionic-audio').directive('ionAudioProgressBar', ['MediaManager', ionAudioProgressBar]);

function ionAudioProgressBar(MediaManager) {
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
        }

        if (!angular.isDefined(attrs.displayTime)) {
            element.find('ion-audio-progress').remove();
            element.find('ion-audio-duration').remove();
        }
        if (!angular.isDefined(attrs.displayInfo)) {
            element.find('h2').remove();
        }

        if (angular.isUndefined(scope.track)) {
            scope.track = {};

            // listens for track changes elsewhere in the DOM
            unbindTrackListener = scope.$on('ionic-audio:trackChange', function (e, track) {
                scope.track = track;
            });
        }

        // disable slider if track is not playing
        var unbindStatusListener = scope.$watch('track.status', function(status) {
            // disable if track hasn't loaded
            slider.prop('disabled', status == 0);   //   Media.MEDIA_NONE
            
        });

        // hide/show track info if available
        scope.displayTrackInfo = function() {
            return { visibility: angular.isDefined(attrs.displayInfo) && (scope.track.title || scope.track.artist) ? 'visible' : 'hidden'}
        };

        // handle track seek-to
        scope.sliderRelease = function() {
            var pos = scope.track.progress;
            MediaManager.seekTo(pos);
        };

        scope.$on('$destroy', function() {
            unbindStatusListener();
            if (angular.isDefined(unbindTrackListener)) {
                unbindTrackListener();
            }
        });

        init();
    }
}
angular.module('ionic-audio').directive('ionAudioPlay', ['$ionicGesture', '$timeout',  '$rootScope', ionAudioPlay]);

function ionAudioPlay($ionicGesture, $timeout, $rootScope) {
    return {
        restrict: 'A',
        require: '^^ionAudioControls',
        link:  function (scope, element, attrs, controller) {
            console.log("printing controller");
            console.log(controller);
            var isLoading, debounce, currentStatus = 0;

            var init = function() {
                isLoading = false;
                element.addClass('ion-play');
                element.removeClass('ion-pause');
                element.text(attrs.textPlay);
            };

            var setText = function() {
                if (!attrs.textPlay || !attrs.textPause) return;

                element.text((element.text() == attrs.textPlay ? attrs.textPause : attrs.textPlay));
            };

            var togglePlaying = function(play) {
                if (typeof play !== "undefined"){
                    if (play){
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

            $ionicGesture.on('tap', function() {
                // debounce while loading and multiple clicks
                if (debounce || isLoading) {
                    debounce = false;
                    return;
                }

                if (currentStatus == 0) isLoading = true;

                controller.play();
                togglePlaying();
            }, element);

            $ionicGesture.on('doubletap', function() {
                debounce = true;
            }, element);

            var unbindStatusListener = scope.$parent.$watch('track.status', function (status) {
                $rootScope.$emit('ionic-audio:statusChange', status);
                //  Media.MEDIA_NONE or Media.MEDIA_STOPPED
                if (status == 0 || status == 4) {
                    init();
                } else if (status == 2) {   // Media.MEDIA_RUNNING
                    isLoading = false;
                }

                currentStatus = status;
            });

            var unbindPlaybackListener = scope.$parent.$watch('togglePlayback', function (newPlayback, oldPlayback) {
                if (newPlayback == oldPlayback) return;
                $timeout(function() {
                    togglePlaying();
                    controller.play();
                },300)
            });

            init();

            scope.$on('$destroy', function() {
                unbindStatusListener();
                unbindPlaybackListener();
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
        var spinnerElem = $element.find('ion-spinner'), hasLoaded, self = this;

        this.toggleSpinner = function(state) {
          if (state){
            spinnerElem.addClass('ng-hide');
          } else {
            spinnerElem.removeClass('ng-hide');
          }
        };

        this.toggleSpinner(true);

        this.play = function() {
          if (!hasLoaded) {
              self.toggleSpinner(false);
          }
          this.start();
        };

        var unbindStatusListener = $scope.$parent.$watch('track.status', function (status) {
            switch (status) {
              case 1: // Media.MEDIA_STARTING
                  hasLoaded = false;
                  break;
              case 2: // Media.MEDIA_RUNNING
                  if (!hasLoaded) {
                      self.toggleSpinner(false);
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
