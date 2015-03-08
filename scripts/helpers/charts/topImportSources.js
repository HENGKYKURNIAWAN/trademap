/*jslint browser: true*/
/*jslint white: true */
/*jslint vars: true */
/*jslint nomen: true*/
/*global $, Modernizr, d3, dc, crossfilter, document, console, alert, define, DEBUG */


/*
 * THIS FILE SETS UP THE topImportSources chart
 * */


define(['../data', '../barchart'], function(data, barchart) {
  'use strict';

  var localData = data,
      $chart = $('#topImportSources'),

      height = $chart.height(),
      width  = $chart.width(),
      svg = d3.select('#topImportSources')
        .append('svg')
        .attr('height', height)
        .attr('width', width),
      numEntries = 20,

      chart = {

        setup: function () {
          // Bind the refresh function to the refreshFilters event
          $chart.on('refreshFilters', this.refresh);
          // Setup the svg
          barchart.setup(svg);
          // Hide on load
          $chart.slideUp(0);
        },

        refresh: function (event, filters) {
          // CASE 1: reporter = null
          if(!filters.reporter) {
            $chart.slideUp();
            return;
          }

          // We build a queryFilter and a dataFilter object to make API queries more generic than data queries
          var queryFilter = {
                reporter: +filters.reporter,
                partner:  'all',
                year:   filters.year,
                commodity:   'AG2'
              },
              dataFilter = queryFilter,
              title = '';

          // Define flow
          dataFilter.flow = 1;

          // CASE 2: reporter = selected    commodity = null        partner = null
          if(filters.reporter && !filters.commodity && !filters.partner) {
            dataFilter.commodity = 'TOTAL';
            title = 'Top import sources for '+localData.reporterAreas.get(filters.reporter).text+' in '+filters.year;
          }

          // CASE 3: reporter = selected    commodity = null        partner = selected
          if(filters.reporter && !filters.commodity && filters.partner) {
            $chart.slideUp();
            return;
          }

          // CASE 4: reporter = selected    commodity = selected    partner = null
          // This is already covered by the data in CASE 2 so we don't specify the commodity in the query to avoid duplicate data
          if(filters.reporter && filters.commodity && !filters.partner) {
            dataFilter.commodity = filters.commodity;
            title = 'Top import sources of '+localData.commodityCodes.get(filters.commodity).text+' for '+localData.reporterAreas.get(filters.reporter).text+' in '+filters.year;
          }

          // CASE 5: reporter = selected    commodity = selected    partner = selected
          if(filters.reporter && filters.commodity && filters.partner) {
            $chart.slideUp();
            return;
          }

          // Run API query
          data.query(dataFilter, function queryCallback (err, ready) {
            if (err) { console.log(err); }
            if (err || !ready) { return; }
            // Get the data, update title, display panel and update chart
            var newData = localData.getData(dataFilter, numEntries);
            $chart.children('.chartTitle').html(title);
            $chart.slideDown(400, function () {
              barchart.draw(svg, newData);
            });
          });
        }

  };

  return chart;
});
