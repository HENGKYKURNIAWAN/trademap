/*jslint browser: true*/
/*jslint white: true */
/*jslint vars: true */
/*jslint nomen: true*/
/*global $, Modernizr, d3, dc, crossfilter, document, console, alert, define, DEBUG, Date, Math */

/*
 * THIS FILE MANAGES API QUERIES AND CROSSFILTER SETUP
 * */


define(function(require) {
  'use strict';

  // Using require above we are making data a singleton which is created only once.
  // Each module requiring data will be using the same object.
  var dataSingleton = function () {
    var data = {

      /*
       * PROPERTIES
       * Some basic properties that we store and persist throughout the application
       */

      // queryHistory, queryQueue and timestamp are used to throttle and debounce queries
      queryHistory: [],
      queryQueue: [],
      queryRunning: [],
      timestamp: 0,

      // Reporter, partner and classification arrays for select2 widgets and lookup objects
      // These are populated during controls setup with data from
      // reporterAreas.json, partnerAreas.json and clasificationsHS_AG2.json
      reporterAreasSelect: [],
      partnerAreasSelect: [],
      commodityCodesSelect: [],
      reporterAreas: {},
      partnerAreas: {},
      flowByCode: {},
      commodityCodes: {},
      countryByUnNum: {},
      countryByISONum: {},

      // Crossfilter data
      xFilter: {},
      xFilterByReporter:  {},
      xFilterByPartner:   {},
      xFilterByYear:      {},
      xFilterByCommodity: {},
      xFilterByFlow:      {},
      xFilterByAmount:    {},

      // Formatting functions
      commodityName: function (commodity) {
        try {
          var text = this.commodityCodes.get(commodity).text;
          return text.slice(text.indexOf(' - ')+3);
        } catch (err) {
          if (DEBUG) { console.warn('There was a problem getting a commodity name: ' + err); }
          return 'unknown';
        }
      },
      numFormat: function (num, item, prec) {
        if (prec) {
          prec = '.'+prec;
        } else {
          prec = '';
        }
        var f = d3.format('$,'+prec+'f');
        if (num === 0) {
          return '0';
        }
        if (typeof num !== 'number' || isNaN(num)) {
          return 'No data';
        }
        // If over one billion, display in billions
        if (Math.abs(num) >= 1000000000) {
          return f((Math.round(num/100000000))/10)+' bn';
        }
        // If over one million, display in millions
        if (Math.abs(num) >= 1000000) {
          return f((Math.round(num/100000))/10)+' m';
        }
        // If over one thousand, display in thousands
        if (Math.abs(num) >= 1000) {
          return f((Math.round(num/100))/10)+' th';
        }
        f = d3.format('$,f');
        // Else display without unit
        return f(num);
      },
      numFormatFull: function (num) {
        var f = d3.format('$,');
        return f(num);
      },
      numOrdinal: function (num) {
        if(isNaN(num) || num%1) { return num; }
        if(num < 20 && num > 10) { return num+'th'; }
        var last = num.toString().slice(-1),
            text = '';
        switch (last) {
          case '1':
            text = num+'st';
            break;
          case '2':
            text = num+'nd';
            break;
          case '3':
            text = num+'rd';
            break;
          default:
            text = num+'th';
            break;
        }
        return text;
      },






      /*
       * PUBLIC METHODS
       * */


      /*
       * Initial setup function.
       * Query static JSON files and populate variables. This is an asynchronous function that makes AJAX request and therefore uses a callback
       */
      setup : function (callback) {
        // Decide base query URL and use of CORS based on domain and cors support
        if (location.host !== 'comtrade.un.org' && !Modernizr.cors) {
          // Not same domain and no CORS (basically IE9 locked on dev server) then use proxy.php
          data.baseQueryUrl = 'proxy.php?fmt=csv&max=50000&type=C&freq=A&px=HS&rg=1%2C2';
          data.useCors = false;
        }
        if (location.host !== 'comtrade.un.org' && Modernizr.cors) {
          data.baseQueryUrl = 'http://comtrade.un.org/api/get?fmt=csv&max=50000&type=C&freq=A&px=HS&rg=1%2C2'
          data.useCors = true;
        }
        if (location.host === 'comtrade.un.org') {
          data.baseQueryUrl = '/api/get?fmt=csv&max=50000&type=C&freq=A&px=HS&rg=1%2C2'
          data.useCors = false;
        }

        var ajaxSettings = {
          dataType: 'json'
        }
        $.when(
          $.ajax('data/reporterAreas.min.json', ajaxSettings),
          $.ajax('data/partnerAreas.min.json', ajaxSettings),
          $.ajax('data/classificationHS_AG2.min.json', ajaxSettings),
          $.ajax('data/isoCodes.csv'),
          $.ajax('data/world-110m.json', ajaxSettings)
        ).then(function success (reporterAreas, partnerAreas, commodityCodes, isoCodes, worldJson) {
          // Add results to the data object for use in the app.
          data.reporterAreasSelect  = reporterAreas[0].results;
          data.partnerAreasSelect   = partnerAreas[0].results;
          data.commodityCodesSelect = commodityCodes[0].results;
          data.worldJson = worldJson[0];

          // Parse isoCodes csv
          var codes = d3.csv.parse(isoCodes[0]);

          // Create d3 maps (these are basically used as lookup tables thoughout the app)
          data.countryByUnNum  = d3.map(codes,                     function (d) { return d.unCode; });
          data.reporterAreas   = d3.map(reporterAreas[0].results,  function (d) { return d.id; });
          data.flowByCode      = d3.map([{ id: '1', text: 'imports'}, { id: '2', text: 'exports'}, { id: '0', text: 'balance'}], function (d) { return d.id; });
          data.partnerAreas    = d3.map(partnerAreas[0].results,   function (d) { return d.id; });
          data.commodityCodes  = d3.map(commodityCodes[0].results, function (d) { return d.id; });

          // countryByISONum will return a single result (the last match in isoCodes.csv)
          data.countryByISONum = d3.map(codes,                     function (d) { return d.isoNumerical; });
          // areasByISONum will return an array of matching areas in the UN system
          data.areasByISONum = function (isoNum) {
            return codes.filter(function (el) {
              return +el.isoNumerical === +isoNum;
            });
          }

          // Create a lookup function which does error handling so we don't have to do it elsewhere in the app
          data.lookup = function (lookupVal, mapName, propertyName) {
            try {
              return data[mapName].get(lookupVal)[propertyName];
            } catch (err) {
              if (DEBUG) { console.warn('There was a problem looking up ' + lookupVal + ' in ' + mapName + '.' + propertyName + ': ' + err); }
              return 'unknown';
            }
          };

          // Remove unwanted values
          data.reporterAreasSelect  = data.reporterAreasSelect.filter( function (d) { return d.id !== 'all'; });
          data.partnerAreasSelect   = data.partnerAreasSelect.filter(  function (d) { return (d.id !== 'all'); });
          data.commodityCodesSelect = data.commodityCodesSelect.filter(function (d) { return (d.id !== 'ALL' && d.id !== 'AG2'); });

          // Call the callback
          callback();
        }, function failure (err1, err2, err3, err4) {
          callback('There was an error with one of the initial requests.');
        }); // Close when-then blocks

        // Setup crossfilter and dimensions
        this.xFilter            = crossfilter();
        this.xFilterByReporter  = this.xFilter.dimension(function(d){ return +d.reporter;  });
        this.xFilterByPartner   = this.xFilter.dimension(function(d){ return +d.partner;   });
        this.xFilterByYear      = this.xFilter.dimension(function(d){ return +d.year;      });
        this.xFilterByCommodity = this.xFilter.dimension(function(d){ return d.commodity;  });
        this.xFilterByFlow      = this.xFilter.dimension(function(d){ return +d.flow;      });
        this.xFilterByAmount    = this.xFilter.dimension(function(d){ return +d.value;     });

        // FUTURE Kick off queries right away to optimize load time?
      },


      /*
       * Run an API query
       * filters argument should be an object in the following form:
       * {
       *   reporter: 826,     // Reporter code in UN format
       *   partner:  862,     // Partner code in UN format
       *   year:     'all',   // Year can be 'all' or apecific year: 2012 (FUTURE: Multi-year queries are allowed for up to 5 years)
       *   commodity:72       // Can be a specific 2-digit HS code or 'TOTAL' or 'AG2'
       * }
       * Callback is called with callback(error, ready)
       * ready will be true if new data was received and added to crossfilter or false otherwise.
       */
      query: function (filters, callback) {
        // Get current time and build URL
        var requestUrl = this._buildUrl(filters),
            time = new Date();

        // Check history to see if query was already run and skip the call if it was already run
        if(data.queryHistory.indexOf(requestUrl) > -1) {
          callback(null, true);
          return;
        }

        // If the API was called less than a second ago, or if the query is in the queue then we need to
        // postpone the call
        var timeAgo = time.getTime() - data.timestamp;
        if (timeAgo < 1100 || data.queryRunning.indexOf(requestUrl) > -1) {
          window.setTimeout(function () { data.query(filters, callback); }, timeAgo+100);
          if (this.queryQueue.indexOf(requestUrl) < 0) {
            this.queryQueue.push(requestUrl);
          }
          callback(null, false);
          return;
        }

        // Make call
        $.ajax({
          url: requestUrl,
          timeout: 75000,
          crossDomain: data.useCors,
          // NOTE: context setting is imporant as it binds the callback to the data object we are creating.
          // Otherwise we cannot access any of the properties in the callback.
          context: this,
          beforeSend: function (xhr, settings) {
            // Set the timestamp so that other queries will queue and add the current query to the list of running queries.
            this.timestamp = time.getTime();
            this.queryRunning.push(requestUrl);
            $('#loadingDiv #cancelRequest').on('click', function (e) {
              xhr.abort();
              $('#loadingDiv').fadeOut();
            });
            $('#loadingDiv').fadeIn();
          },
          success: function success (data, status, xhr) {
            // Add data to crossfilter
            this._addData(data, filters);
            // Add query to history
            this.queryHistory.push(requestUrl);
            //Remove it from queryQueue and queryRunning if it was there
            var runningItem = this.queryRunning.indexOf(requestUrl);
            if (runningItem > -1) { this.queryRunning.splice(runningItem, 1); }
            var queueItem = this.queryQueue.indexOf(requestUrl);
            if (queueItem > -1) { this.queryQueue.splice(queueItem, 1); }
            // Callback
            callback(null, true);
          },
          error: function error (xhr, status, err) {
            //Remove it from queryQueue and queryRunning if it was there
            var runningItem = this.queryRunning.indexOf(requestUrl);
            if (runningItem > -1) { this.queryRunning.splice(runningItem, 1); }
            var queueItem = this.queryQueue.indexOf(requestUrl);
            if (queueItem > -1) { this.queryQueue.splice(queueItem, 1); }
            // If error is 409 then requeue the request
            if(xhr.status === 409) {
              if (DEBUG) { console.log('API 409 Error: Requeueing the request.'); }
              data.query(requestUrl, callback);
              callback(null, false);
            } else {
              callback(status+' '+err, null);
            }
          },
          complete: function () {
            if (this.queryQueue.length === 0 && this.queryRunning.length === 0) {
              $('#loadingDiv').fadeOut();
              $('#loadingDiv #cancelRequest').off('click');
            }
          }
        });
      },


      /*
       * Get a dataset for display
       * filters argument should be an object in the following form:
       * {
       *   reporter: 826,     // Reporter code
       *   partner:  862,     // Partner code
       *   year:     'all',   // Year
       *   commodity:72       // Can be a specific 2-digit HS code or 'TOTAL' or 'AG2'
       * }
       * limit will be used to return the top x number of records
       */
      getData: function (filters, limit) {
        // Clear all filters on the xFilter
        this.xFilterByReporter.filterAll();
        this.xFilterByPartner.filterAll();
        this.xFilterByYear.filterAll();
        this.xFilterByCommodity.filterAll();
        this.xFilterByFlow.filterAll();
        this.xFilterByAmount.filterAll();

        // Add filters by each dimension
        if (typeof filters.reporter !== 'undefined')                                 { this.xFilterByReporter.filter(+filters.reporter); }
        // NOTE: when partner=all we return all but the world
        //       when partner=num we  return that
        //       when partner=undefined we return all including world
        if (typeof filters.partner !== 'undefined' && filters.partner === 'all')     { this.xFilterByPartner.filter(function (d) { return (+d !== 0); }); }
        if (typeof filters.partner !== 'undefined' && filters.partner !== 'all')     { this.xFilterByPartner.filter(+filters.partner); }
        if (typeof filters.year !== 'undefined' && filters.year !== 'all')           { this.xFilterByYear.filter(+filters.year); }
        if (typeof filters.commodity !== 'undefined' && filters.commodity !== 'AG2') { this.xFilterByCommodity.filter(filters.commodity); }
        if (typeof filters.commodity !== 'undefined' && filters.commodity === 'AG2') { this.xFilterByCommodity.filter(function (d) { return d !== 'TOTAL'; } ); }
        if (typeof filters.commodity === 'undefined')                                { this.xFilterByCommodity.filter(function (d) { return d === 'TOTAL'; } ); }
        if (typeof filters.flow !== 'undefined' && +filters.flow !== 0 )             { this.xFilterByFlow.filter(filters.flow); }

        // Get the data from xFilter
        if (!limit) { limit = Infinity; }
        var newData = this.xFilterByAmount.top(limit);

        // Return resulting records
        return newData;
      },


      /*
       * Takes a dataset where imports and exports are in different records
       * and combines them into a single dataset with one record per partner
       * and different properties for import, export, balance and ranking.
       * This should be called after getting data which includes "world" as a
       * partner so that percentages of imports and exports will be calculated.
       */
      combineData: function (impExpData) {
        var combinedData = [],
            imports = d3.map(),
            exports = [],
            totImports = 0,
            totExports = 0,
            worldDetails = {};
        // Filter out values of partner = world while setting totImports and totExports
        // We save these values to re-add later manually after we calculate rankings
        impExpData = impExpData.filter(function (v) {
          if (+v.partner !== 0) { return true; }
          else {
            if (v.flow === 1) {
              totImports = v.value;
              worldDetails.reporter = v.reporter;
              worldDetails.partner = v.partner;
              worldDetails.commodity = v.commodity;
              worldDetails.year = v.year;
              worldDetails.importVal = v.value;
            }
            if (v.flow === 2) {
              totExports = v.value;
              worldDetails.reporter = v.reporter;
              worldDetails.partner = v.partner;
              worldDetails.commodity = v.commodity;
              worldDetails.year = v.year;
              worldDetails.exportVal = v.value;
            }
            return false;
          }
        });
        worldDetails.bilateralVal = worldDetails.importVal + worldDetails.exportVal;
        worldDetails.balanceVal = worldDetails.exportVal - worldDetails.importVal;

        // Split the data into an imports map and exports array
        impExpData.forEach(function (d) {
          if (+d.flow === 1) { imports.set(d.partner, d); }
          if (+d.flow === 2) { exports.push(d); }
        });
        // Iterate over the exports array, search for matching import and construct new object to return
        exports.forEach(function (Export) {
          var Import = imports.get(Export.partner);
          if (Import) {
            var combined = {};
            combined.reporter     = Export.reporter;
            combined.partner      = Export.partner;
            combined.commodity    = Export.commodity;
            combined.year         = Export.year;
            combined.importVal    = Import.value;
            combined.exportVal    = Export.value;
            combined.bilateralVal = Import.value + Export.value;
            combined.balanceVal   = Export.value - Import.value;
            if (totImports !== 0 && totExports !== 0) {
              combined.importPc = (combined.importVal / totImports)*100;
              combined.exportPc = (combined.exportVal / totExports)*100;
            }
            combinedData.push(combined);
          }
        });

        // Sort by importVal & assign importRank
        combinedData.sort(function (a,b) {
          return +(b.importVal > a.importVal) || +(b.importVal === a.importVal) - 1;
        });
        combinedData.forEach(function (v, i) {
          combinedData[i].importRank = i+1;
        });

        // Sort by exportVal & assign exportRank
        combinedData.sort(function (a,b) {
          return +(b.exportVal > a.exportVal) || +(b.exportVal === a.exportVal) - 1;
        });
        combinedData.forEach(function (v, i) {
          combinedData[i].exportRank = i+1;
        });

        // Add world value back
        combinedData.push(worldDetails);

        return combinedData;
      },





      /*
       * PRIVATE METHODS
       * (methods that are only used internally in the data module)
       */
      _buildUrl: function (filters) {
        var requestUrl = data.baseQueryUrl;
        if (typeof filters.reporter !== 'undefined')    { requestUrl += '&r=' +filters.reporter; } else { requestUrl += '&r=0'; }
        if (typeof filters.partner !== 'undefined')     { requestUrl += '&p=' +filters.partner;  } else { requestUrl += '&p=all'; }
        if (typeof filters.year !== 'undefined' && filters.year !== null)
                                                        { requestUrl += '&ps='+filters.year;     } else { requestUrl += '&ps=now'; }
        if (typeof filters.commodity !== 'undefined')   { requestUrl += '&cc='+filters.commodity;} else { requestUrl += '&cc=AG2'; }
        return requestUrl;
      },

      _addData: function (csvData, filters) {
        // Parse and select the fields from the response we want to store
        var newData = d3.csv.parse(csvData, function (d) {
          return {
            reporter:   +d['Reporter Code'],
            partner:    +d['Partner Code'],
            year:       +d.Year,
            commodity:   d['Commodity Code'],
            flow:       +d['Trade Flow Code'],
            value:      +d['Trade Value (US$)']
          };
        });

        // Run the filters on xFilter and extract the data we already may have (unset the partner filter to include world)
        var dataFilter = $.extend({},filters);
        if (dataFilter.partner == 'all') { delete dataFilter.partner; }
        var xFdata = this.getData(dataFilter);

        // Filter out duplicate records in newData that are already in xFilter before adding newData
        var duplicates = [];
        var insertData = newData.filter(function (nd) {
          // Iterate over xFdata and check for duplicates
          var dup = false;
          xFdata.forEach(function (xd) {
            if (
              nd.reporter  === xd.reporter  &&
              nd.partner   === xd.partner   &&
              nd.commodity === xd.commodity &&
              nd.flow      === xd.flow      &&
              nd.year      === xd.year      &&
              nd.value     === xd.value
            ) {
              dup = true;
              duplicates.push(nd);
            }
          });
          return !dup;
        });

        // Add the new data to xFilter
        this.xFilter.add(insertData);

        if(DEBUG) {
          console.groupCollapsed('%s query: r=%s p=%s c=%s y=%s', filters.initiator, filters.reporter, filters.partner, filters.commodity, filters.year);
          console.log('filters: %o', filters);
          console.log('Added %d new records. Retrieved %d records. Checked %d possible matches and discarded %d duplicates. New xFilter size: %d', insertData.length, newData.length, xFdata.length, duplicates.length, this.xFilter.size());
          console.log('duplicates discarded: %o', duplicates);
          console.groupEnd();
        }
      }

    };
    return data;
  };

  return dataSingleton();
});
