/*jslint browser: true*/
/*jslint white: true */
/*jslint vars: true */
/*global $, Modernizr, d3, dc, crossfilter, document, console, alert, define, DEBUG, queryObject, btoa */


/*
 * THIS FILE SETS UP GENERAL GUI FUNCTIONS THAT DO NOT BELONG TO CONTROLS SPECIFICALLY
 * */


define([], function() {
  'use strict';

  var gui = {

    setup: function () {

      // ADD CHEVRON BUTTON BEHAVIOURS (As well as go to footer)
      $("#goToCharts a, #goToMap a").tooltip();
      $("#goToCharts a, #goToMap a, #goToFooter").on('click', function(e) {
        e.preventDefault();
        var hash = this.hash;
        $('html, body').animate({
          scrollTop: $(hash).offset().top
        }, 1000, function(){
          // do something when done like adding hash to location
          // window.location.hash = hash;
        });
      });

      // ADD SPECIFIC MENU BEHAVIOURS
      // Build links with http://www.sharelinkgenerator.com if needed
      $('#facebookShareLink').on('click', function (e) {
        e.preventDefault();
        var winTop = (screen.height / 2) - (520 / 2);
        var winLeft = (screen.width / 2) - (350 / 2);
        window.open('https://www.facebook.com/sharer/sharer.php?u='+window.location.href, 'sharer', 'top=' + winTop + ',left=' + winLeft + ',toolbar=0,status=0,width=' + 520 + ',height=' + 350);
      });
      $('#tweetLink').on('click', function (e) {
        e.preventDefault();
        var winTop = (screen.height / 2) - (520 / 2);
        var winLeft = (screen.width / 2) - (350 / 2);
        window.open('https://twitter.com/share?text=Check%20out%20the%20International%20Trade%20in%20Goods%20by%20Country%20and%20Commodity%20DataViz&url='+window.location.href, 'sharer', 'top=' + winTop + ',left=' + winLeft + ',toolbar=0,status=0,width=' + 520 + ',height=' + 350);
      });

      // ADD DOWNLOAD GRAPHS FUNCTIONS
      // If blob constructor is not supported then we hide the download button
      // Note: IE<10 could be supported using this: https://github.com/koffsyrup/FileSaver.js#examples
      if (!Modernizr.blobconstructor) {
        $('a.downloadSvg').hide();
      } else {
        $('a.downloadSvg').on('click', function (e) {
          // We are copying the
          var svgId = $(this).attr('data-target'),
              title = $('#'+svgId+' .chartTitle').text(),
              $svg = $('#'+svgId+' .svgChart'),
              height = $svg.height(),
              range = document.createRange(),
              div = document.createElement('div');

          // Create a documentFragment to manipulate outside of the DOM
          range.selectNode($svg[0]);
          var fragment = range.cloneContents();

          // If this is the choropleth inject the legend and remove viewBox
          if (svgId == 'choropleth') {
            $(fragment)
              .removeAttr('viewBox')
              .removeAttr('preserveAspectRatio')
              .attr('width', 1920)
              .attr('height', 1080);
            height = 1080;
            $(fragment)
              .children('svg')
              .append('<g class="legend" transform="translate(25,25) scale(1.5)">' + $('#mapLegendSvg g.legend')[0].innerHTML + '</g>');
          }

          // Add text title, reference and link
          $(fragment)
            .children('svg')
            .attr('height', height+75)
            .append('<text y="' + height + '">'
                      +'<tspan x="10" class="creditTitle">' + title + '</tspan>'
                      +'<tspan x="10" dy="15" class="creditSource">International Trade in Goods based on UN Comtrade data</tspan>'
                      +'<tspan x="10" dy="15" class="creditSource">Developed by the Department for Business Innovation and Skills (UK)</tspan>'
                      +'<tspan x="10" dy="15" class="creditLink">' + document.location.href + '</tspan>'
                    +'</text>');


          // Append the documentFragment and extract the text
          div.appendChild(fragment.cloneNode(true));
          var blob = new Blob([div.innerHTML], {type: "image/svg+xml;charset=utf8"});
          saveAs(blob, svgId+'.svg');
        });
      }

      // ADD EMBED GRAPH BUTTON BEHAVIOURS
      $('a.embedSvg').on('click', function (e) {
        e.preventDefault();
      });


      // BEHAVIOUR TO CLEAN MODAL CONTENTS ON HIDE
      $('body').on('hidden.bs.modal', '.modal', function () {
        $(this).removeData('bs.modal');
      });
    },




    showError: function (err) {
      $('#myModalLabel').html('<span class="glyphicon glyphicon-warning-sign"></span> There was an error in querying the COMTRADE API.');
      $('#myModal .modal-body').html('Charts may not display correctly, please try reloading the page or trying again later.<br /><small>Error details: '+err+'</small>');
      $('#myModal').modal({ show: true });
    }




  };

  return gui;
});
