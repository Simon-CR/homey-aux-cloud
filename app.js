'use strict';

const Homey = require('homey');

class AuxCloudApp extends Homey.App {

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('AUX Cloud app has been initialized');
  }

}

module.exports = AuxCloudApp;
