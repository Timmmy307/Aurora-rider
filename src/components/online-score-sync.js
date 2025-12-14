/**
 * Syncs player score to multiplayer server during online games.
 */
AFRAME.registerComponent('online-score-sync', {
  init: function () {
    var el = this.el;
    var self = this;
    this.lastSentScore = 0;
    this.syncInterval = null;

    // Listen for game state changes
    el.addEventListener('stateadded', function (evt) {
      if (evt.detail === 'isPlaying' && el.is('isOnline')) {
        self.startSync();
      }
    });

    el.addEventListener('stateremoved', function (evt) {
      if (evt.detail === 'isPlaying') {
        self.stopSync();
      }
    });
  },

  startSync: function () {
    var self = this;
    var state = this.el.sceneEl.systems.state.state;

    // Send score updates every 2 seconds during gameplay
    this.syncInterval = setInterval(function () {
      var currentScore = state.score;
      if (currentScore !== self.lastSentScore && window.multiplayerClient) {
        window.multiplayerClient.updateScore(currentScore);
        self.lastSentScore = currentScore;
      }
    }, 2000);
  },

  stopSync: function () {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  },

  remove: function () {
    this.stopSync();
  }
});
