angular.module('ionic-audio').factory('MediaManager', ['$interval', '$timeout', '$window', '$rootScope', function ($interval, $timeout, $window, $rootScope) {
    var tracks = [], currentTrack, currentMedia, playerTimer, currentTrackIndex=0, isPlaying;

    if (!$window.cordova && !$window.Media) {
        console.log("ionic-audio: missing Cordova Media plugin. Have you installed the plugin? \nRun 'ionic plugin add cordova-plugin-media'");
        return null;
    }

    return {
        setTracks: setTracks,
        add: add, // this is required because we may want to have individual "players" - but nobody cares
        play: play,
        pause: pause,
        stop: stop,
        seekTo: seekTo,
        destroy: destroy,

        getPlaylistSize: getPlaylistSize,
        getPlaylistPosition: playlistPosition,
        getPlaylist: getPlaylist,

        insertTrackAtIndex: insertTrackAtIndex
    };

    function getPlaylistSize(){
        return tracks.length;
    }

    function getPlaylistPosition(){
        return currentTrackIndex;
    }

    function getPlaylist(){
        return tracks;
    }

     /*
        this is the most important function of all
        we will add the whole list
        if its a single track, it should still arrive in a list
        if new tracks are set stop everything else and broadcast 
     */
    function setTracks(tracklist, playbackSuccess, playbackError, statusChange, progressChange){
        stop(); // stop current playing track
        destroy();
        tracks = [];
        currentTrackIndex = 0;g
        for (var i=0, l=tracklist.length; i < l; i++){
            add(tracklist[i], playbackSuccess, playbackError, statusChange, progressChange);
        }

        $rootScope.$broadcast('ionic-audio:setTracks', getPlaylist());
     }

    /*
    Creates a new Media from a track object

     var track = {
         url: 'https://s3.amazonaws.com/ionic-audio/Message+in+a+bottle.mp3',
         artist: 'The Police',
         title: 'Message in a bottle',
         art: 'img/The_Police_Greatest_Hits.jpg'
     }
     */
    function add(track, playbackSuccess, playbackError, statusChange, progressChange) {
        if (!track.url) {
            console.log('ionic-audio: missing track url');
            return;
        }

        angular.extend(track, {
            onSuccess: playbackSuccess,
            onError: playbackError,
            onStatusChange: statusChange,
            onProgress: progressChange,
            status: 0,
            duration: -1,
            progress: 0
        });

        // if (find(track)) {
        //     return track.id;
        // }

        track.id  = tracks.push(track) - 1; // a playlist can have same track multiple times
        return track.id;
    }

    function play(index) {
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
    }

    function pause() {
        console.log('ionic-audio: pausing track '  + currentTrack.title);
        currentMedia.pause();
        stopTimer();
        isPlaying = false;
    }

    function seekTo(pos) {
        if (!currentMedia) return;

        currentMedia.seekTo(pos * 1000);
    }

    function destroy() {
        stopTimer();
        releaseMedia();
    }

    function playTrack() {
        console.log('ionic-audio: playing track ' + currentTrack.title);

        currentMedia = createMedia(currentTrack);
        currentMedia.play();

        startTimer();
    }

    function resume() {
        console.log('ionic-audio: resuming track ' + currentTrack.title);
        currentMedia.play();
        startTimer();
        isPlaying = true;
    }

    function stop() {
        if (currentMedia){
            console.log('ionic-audio: stopping track ' + currentTrack.title);
            currentMedia.stop();    // will call onSuccess...
            isPlaying = false;
        }
    }

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

    function onSuccess() {
        stopTimer();
        releaseMedia();

        if (angular.isFunction(this.onSuccess))
            this.onSuccess();
    }

    function onError() {
        if (angular.isFunction(this.onError))
            this.onError();
    }

    function onStatusChange(status) {
        this.status = status;
        $rootScope.$broadcast('ionic-sudio:status', status);
        // Media.MEDIA_NONE = 0;
        // Media.MEDIA_STARTING = 1;
        // Media.MEDIA_RUNNING = 2;
        // Media.MEDIA_PAUSED = 3;
        // Media.MEDIA_STOPPED = 4;

        if (angular.isFunction(this.onStatusChange))
            this.onStatusChange(status);
    }

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

    function insertTrackAtIndex(index, track){
        tracks.splide(index, 0, track);
        return tracks;
    }
}]);