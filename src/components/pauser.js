/**
 * Tell app to pause game if playing.
 */
AFRAME.registerComponent('pauser', {
  schema: {
    enabled: {default: true}
  },

  init: function () {
    this.pauseGame = this.pauseGame.bind(this);
    this.resumeGame = this.resumeGame.bind(this);

    document.addEventListener('keydown', evt => {
      if (evt.keyCode === 27) { this.pauseGame(); }
    });

    this.el.sceneEl.addEventListener('controllerconnected', evt => {
      if (evt.detail.name === 'vive-controls') {
        this.el.addEventListener('menudown', this.pauseGame);
      } else {
        this.el.addEventListener('thumbstickdown', this.pauseGame);
        this.el.addEventListener('trackpaddown', this.pauseGame);
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.pauseGame();
      } else if (document.visibilityState === 'visible') {
        // Auto-resume when returning to game in VR
        this.resumeGame();
      }
    });

    // Also handle XR session visibility
    this.el.sceneEl.addEventListener('enter-vr', () => {
      const session = this.el.sceneEl.xrSession;
      if (session) {
        session.addEventListener('visibilitychange', (evt) => {
          if (evt.session.visibilityState === 'visible') {
            this.resumeGame();
          } else if (evt.session.visibilityState === 'hidden') {
            this.pauseGame();
          }
        });
      }
    });
  },

  pauseGame: function () {
    if (!this.data.enabled) { return; }
    this.el.sceneEl.emit('pausegame', null, false);
  },

  resumeGame: function () {
    if (!this.data.enabled) { return; }
    // Only auto-resume if we're in a paused state during gameplay
    var state = this.el.sceneEl.systems.state;
    if (state && state.state && state.state.isPaused && state.state.challenge.id) {
      this.el.sceneEl.emit('gamemenuresume', null, false);
    }
  }
});
