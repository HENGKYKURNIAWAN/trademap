/*jslint browser: true*/
/*jslint white: true */
/*jslint vars: true */
/*jslint nomen: true*/
/*global $, Modernizr, d3, dc, crossfilter, document, console, alert, define, DEBUG */


/*
 * THIS FILE SETS UP THE yearChart chart
 * */


define(['../data', '../controls'], function(data, controls) {
  'use strict';

  var localData = data,
      $chart = $('#yearChart'),

      // SVG main properties
      svg = d3.select('#yearChart').append('svg'),
      margin = {top: 25, right: 80, bottom: 30, left: 70},
      height = $chart.height(),
      width  = $chart.width(),
      innerHeight = height - margin.top - margin.bottom,
      innerWidth = width - margin.left - margin.right,

      // Chart main objects
      xScale = d3.scale.linear().range([0, innerWidth]),
      yScale = d3.scale.linear().range([innerHeight, 0]),
      xAxis  = d3.svg.axis()
        .scale(xScale)
        .orient('bottom')
        .tickFormat(d3.format(".0f")),
      yAxis  = d3.svg.axis()
        .scale(yScale)
        .orient('left')
        .ticks(6)
        .tickFormat(localData.numFormat),
      line   = d3.svg.line()
        .interpolate('linear'),
      colors = ['rgb(166,54,3)', 'rgb(0,109,44)'], // imports, exports




      chart = {




        setup: function () {
          // Bind the refresh function to the refreshFilters event
          $chart.on('refreshFilters', this.refresh);

          // Setup SVG and add axises, grids and groups
          svg.attr('width', width)
            .attr('height', height);
          svg.append('g')
            .attr('class', 'x axis')
            .attr('transform', 'translate('+margin.left+',' + (margin.top+innerHeight) + ')')
            .call(xAxis);
          svg.append('g')
            .attr('class', 'y axis')
            .attr('transform', 'translate('+margin.left+',' + margin.top + ')')
            .call(yAxis);
          svg.append('g')
            .attr('class', 'xGrid')
            .attr('transform', 'translate('+margin.left+',' + (margin.top+innerHeight) + ')');
          svg.append('g')
            .attr('class', 'yGrid')
            .attr('transform', 'translate('+margin.left+',' + margin.top + ')');
          svg.append('g')
            .attr('class', 'plots')
            .attr('transform', 'translate('+margin.left+',' + margin.top + ')');

          // Draw legend
          var legendItems = svg.append('g')
            .attr('class', 'legend')
            .attr('transform', 'translate('+margin.left+',0)')
            .selectAll('.legendItem')
            .data(colors)
            .enter()
            .append('g')
            .attr('class','legendItem');
          legendItems.append('circle')
            .attr('cx', function (d, i) { return innerWidth-(i+1)*120; })
            .attr('cy', '10')
            .attr('r', '5')
            .style('fill', function (d) { return d; });
          legendItems.append('text')
            .attr('transform', function (d, i) {
              return 'translate('+(innerWidth+10-(i+1)*120)+',15)';
            })
            .text(function(d,i) { return ['Imports','Exports'][i]; } );


          // Hide on load
          $chart.slideUp(0);
        },





        refresh: function (event, filters) {
          var title = '';

          // CASE 1: reporter = null
          if(!filters.reporter) {
            $chart.slideUp();
            return;
          }

          // We build a dataFilter object to make API queries more generic (see case 2 and 5 below)
          var dataFilter = {
            reporter: +filters.reporter,
            year:   'all'
          };

          // CASE 2: reporter = selected    commodity = null        partner = null
          if(filters.reporter && !filters.commodity && !filters.partner) {
            title = 'Total imports and Exports of '+localData.countryByUnNum.get(filters.reporter).name;
            dataFilter.partner =  0;
            dataFilter.commodity = 'TOTAL';
          }

          // CASE 3: reporter = selected    commodity = null        partner = selected
          if(filters.reporter && !filters.commodity && filters.partner) {
            title = 'Imports and Exports between '+localData.countryByUnNum.get(filters.reporter).name + ' and ' + localData.countryByUnNum.get(filters.partner).name;
            dataFilter.partner = +filters.partner;
            dataFilter.commodity = 'AG2';
          }

          // CASE 4: reporter = selected    commodity = selected    partner = null
          if(filters.reporter && filters.commodity && !filters.partner) {
            title = 'Imports and Exports of '+localData.commodityName(filters.commodity)+' to/from '+localData.countryByUnNum.get(filters.reporter).name;
            dataFilter.partner = 0;
            dataFilter.commodity = filters.commodity;
          }

          // CASE 5: reporter = selected    commodity = selected    partner = selected
          // NOTE This is already covered by the data in CASE 3 so we don't specify the commodity in the query to avoid duplicate data
          if(filters.reporter && filters.commodity && filters.partner) {
            title = 'Imports and Exports of '+localData.commodityName(filters.commodity)+' between '+localData.countryByUnNum.get(filters.reporter).name + ' and ' + localData.countryByUnNum.get(filters.partner).name;
            dataFilter.partner = +filters.partner;
            dataFilter.commodity = 'AG2';
          }

          // Run the query, display the panel and redraw the chart
          data.query(dataFilter, function queryCallback (err, ready) {
            if (err) { console.log(err); }
            if (err || !ready) { return; }
            $chart.slideDown(400, function () {
              // Update title and chart
              $chart.children('.chartTitle').html(title);
              chart._draw(dataFilter);
            });
          });

        },




        _draw: function (filters) {
          // Get the relevant data for imports and exports
          var newData = localData.getData(filters),
              nestedData = d3.nest()
                .key(function(d) { return d.flow; })
                .sortValues(function(a,b) { return a.year - b.year; } )
                .entries(newData),
              yearRange = d3.extent(newData, function (d) { return d.year; }),
              tip = d3.tip()
                .attr('class', 'd3-tip')
                .offset([-10, 0])
                .html(function(d) { return d.year+': '+localData.numFormat(d.value)+' '+['imports', 'exports'][d.flow-1]; });

          // Update scale domains with newData values and the line generation function
          xScale.domain(yearRange);
          yScale.domain(d3.extent(newData, function (d) { return d.value; }));
          line.x(function(d) { return xScale(d.year); })
            .y(function(d) { return yScale(d.value); });
          xAxis.scale(xScale)
            .tickValues(d3.range(yearRange[0], yearRange[1]))
            .tickSize(6, 0)
            .tickFormat(d3.format(".0f"));
          yAxis.scale(yScale)
            .tickSize(6, 0)
            .tickFormat(localData.numFormat);

          // Update yearSelect dropdown with new year range
          controls.updateYears(d3.range(yearRange[0], yearRange[1]));

          // Update axis and grids
          svg.select('.x.axis') // change the x axis
            .call(xAxis);
          svg.select('.y.axis') // change the y axis
            .call(yAxis);
          svg.select('.xGrid')
            .html('')
            .call(xAxis.tickSize(-innerHeight, 0, 0).tickFormat(''));
          svg.select('.yGrid')
            .html('')
            .call(yAxis.tickSize(-innerWidth, 0, 0).tickFormat(''));


          // Draw groups and then in each group lines and dots
          var plots = svg.select('.plots'),
              flow  = plots.selectAll('.flow')
                        .data(nestedData)
                        .enter()
                        .append('g')
                        .attr('class', function (d) {
                          return 'flow '+['imports', 'exports'][+d.key-1];
                        });

          plots.call(tip);
          flow.append('path')
            .attr('class','line')
            .attr('d', function (d) { return line(d.values); })
            .style("stroke", function(d) { return colors[d.key-1]; })
            .style("fill", 'none')
            .style("stroke-width", '1.5px');
          flow.selectAll('.dot')
            .data(function (d) { return d.values; })
            .enter()
            .append('circle')
            .attr('class', 'dot')
            .attr('cx', function (d) { return xScale(d.year); })
            .attr('cy', function (d) { return yScale(d.value); })
            .attr('r', '3')
            .style("fill", function(d) { return colors[d.flow-1]; })
            .style("stroke-width", '0')
            .on('mouseover', function (d) {
              tip.show(d);
              d3.select(this).interrupt().transition().attr('r', '6');
            })
            .on('mouseout', function (d) {
              tip.hide(d);
              d3.select(this).interrupt().transition().attr('r', '3');
            })
            .on('click', function (d) {
              console.log('select: '+d.year );
              controls.changeFilters({ year: d.year });
            });

        }

  };

  return chart;
});
