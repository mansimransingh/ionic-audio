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

     /*
        this is the most important function of all
        we will add the whole list
        if its a single track, it should still arrive in a list
        if new tracks are set stop everything else and broadcast 
     */
    vm.setTracks = function(tracklist){
        stop(); // stop current playing track
        destroy();
        tracks = [];
        currentTrackIndex = 0;
        for (var i=0, l=tracklist.length; i < l; i++){
            add(tracklist[i]);
        }

        $rootScope.$broadcast('ionic-audio:setTracks', getPlaylist());
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
            if (index > getPlaylistSize() - 1) { return; }

            if (currentTrack && currentTrackIndex == index){
                if (!isPlaying){
                    resume();
                }
            } else {
                stop();
                currentTrack = tracks[index];
                currentTrackIndex = index;
                playTrack();
            }
        } else {
            if (currentTrack){
                if (!isPlaying){
                    resume();
                }
            } else {
                currentTrack = tracks[currentTrackIndex];
                playTrack();
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
        releaseMedia();
    };

    function playTrack() {
        console.log('ionic-audio: playing track ' + currentTrack.title);

        currentMedia = createMedia(currentTrack);
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

    function createMedia(track) {
        if (!track.url) {
            console.log('ionic-audio: missing track url');
            return undefined;
        }

        return new Media(track.url,
            angular.bind(track, onSuccess),
            angular.bind(track, onError),
            angular.bind(track, onStatusChange));
    }

    function releaseMedia() {
        if (angular.isDefined(currentMedia)) {
            currentMedia.release();
            currentMedia = undefined;
            currentTrack = undefined;
        }
    }

    var onSuccess = function() {
        stopTimer();
        releaseMedia();

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

    function stopTimer() {
        $rootScope.$broadcast('ionic-audio:startStopToggle', "stopped");
        if (angular.isDefined(playerTimer)) {
            $interval.cancel(playerTimer);
            playerTimer = undefined;
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