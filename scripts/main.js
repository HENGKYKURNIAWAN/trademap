/*jslint browser: true*/
/*jslint white: true */
/*jslint vars: true */
/*global $, Modernizr, d3, dc, crossfilter, document, console, alert, require, window, DEBUG */

/*
 * THIS RUNS THE MAIN LOGIC OF THE VIZ
 * It wraps everything in the requirejs callback function.
 * */

// Add a timestamp to the query to avoid caching
require.config({
    urlArgs: "build=" + (new Date()).getTime()
});

require(['helpers/data', 'helpers/gui', 'helpers/controls', 'helpers/charts'], function(data, gui, controls, charts) {
  'use strict';

  // NOTE: We declare a global boolean DEBUG variable which we'll use to switch on or off console.log messages
  if (typeof DEBUG === 'undefined') {
    window.DEBUG = true;
  }

  // This jQuery callback makes sure that all code is run after the document and scripts have all loaded properly
  $(document).ready(function () {

    // Use Modernizr to check for SVG support and if not present display an error and don't even start loading CSV and setting up charts
    if (!Modernizr.svg) {
      $('#userAlert').removeClass('hidden');
      $('#userAlert .message').html('Error: it looks like your browser does not support SVG which is required for this visualization. Please consider updating to a more recent browser.');
      $('#loadingDiv').hide();
      return;
    }

    // Use Modernizr to check for CORS support and need and if not present display an error and don't even start loading CSV and setting up charts
    if (location.host !== 'comtrade.un.org' && !Modernizr.cors) {
      $('#userAlert').removeClass('hidden');
      $('#userAlert .message').html('Warning: Your browser does not support querying APIs which is necessary for this application to work. This application may not work correctly on your borwser. (Missing <a href="https://en.wikipedia.org/wiki/Cross-origin_resource_sharing">CORS</a>).<br /> Please try using a recent version of Firefox or Chrome.');
      $('#loadingDiv').hide();
    }

    // Setup data by calling the initial JSON files
    data.setup(function (err) {
      // If the setup fails display an error and stop.
      if (err) {
        if (DEBUG) { console.log(err); }
        $('#userAlert').removeClass('hidden');
        $('#userAlert .message').html('Error: Failed to load required files for startup.');
        return;
      }

      // TODO check if we have an embed parameter like "embed=yearChart"

      // Setup the gui
      gui.setup();

      // Setup the controls
      controls.setup();

      // Setup charts
      charts.setup(function () {
        controls.initializeFilters();
      });


    }); // Close data.setup()
  });     // Close $(document).ready
});       // Close require
