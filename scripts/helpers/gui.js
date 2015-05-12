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

      // Display footer
      $('#footer').show();

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
        window.open('https://twitter.com/share?text=Check%20out%20the%20International%20Trade%20in%20Goods%20DataViz&url='+window.location.href, 'sharer', 'top=' + winTop + ',left=' + winLeft + ',toolbar=0,status=0,width=' + 520 + ',height=' + 350);
      });

      // ADD DOWNLOAD GRAPHS FUNCTIONS
      // If blob constructor is not supported then we hide the download button
      // Note: IE<10 could be supported in the future using this: https://github.com/koffsyrup/FileSaver.js#examples
      if (!Modernizr.blobconstructor) {
        $('a.downloadChart').hide();
      } else {
        $('a.downloadChart').on('click', function (e) {
          // We are copying the SVG element into a virtual DOM (documentFragement)
          var svgId = $(this).attr('data-target'),
              format = $(this).attr('data-format'),
              title = $('#'+svgId+' .chartTitle').text(),
              $svg = $('#'+svgId+' .svgChart'),
              width = $svg.width(),
              height = $svg.height(),
              footerPos = height,
              range = document.createRange(),
              div = document.createElement('div');

          // We then manipulate the documentFragment outside of the DOM
          range.selectNode($svg[0]);
          var fragment = range.cloneContents();

          // If this is the choropleth inject the legend and remove viewBox
          if (svgId === 'choropleth') {
            if (format === 'svg') {
              width = 1280;
              height = 720;
              $(fragment)
                .children('svg')
                .removeAttr('viewBox')
                .removeAttr('preserveAspectRatio')
                .attr('width', width)
                .attr('height', height);
            }
            footerPos = 720-75;
            $(fragment)
              .children('svg')
              .append('<g class="legend" transform="translate(25,25) scale(1.5)">' + $('#mapLegendSvg g.legend')[0].innerHTML + '</g>');
          }

          // Add text title, reference and link
          $(fragment)
            .children('svg')
            .attr('height', height+75)
            .append('<text y="' + footerPos + '">'
                      +'<tspan x="10" class="creditTitle">' + title + '</tspan>'
                      +'<tspan x="10" dy="15" class="creditSource">International Trade in Goods based on UN Comtrade data</tspan>'
                      +'<tspan x="10" dy="15" class="creditSource">Developed by the Department for Business Innovation and Skills (UK)</tspan>'
                      +'<tspan x="10" dy="15" class="creditLink">' + document.location.href + '</tspan>'
                    +'</text>');

          // We need to push the documentFragment into a throwaway (hidden) DOM element to get the innerHTML code
          div.appendChild(fragment.cloneNode(true));
          var svgText = div.innerHTML;

          if (format == 'svg') {
            // Finally, for SVG,  we convert the SVG to a blob and save it
            var blob = new Blob([svgText], {type: "image/svg+xml;charset=utf8"});
            saveAs(blob, svgId+'.svg');
            return;
          }

          if (format == 'png') {
            // For PNG we draw the SVG code to an image, render the image to a canvas and then get it as a download.
            var image = new Image();

            image.onload = function() {
              var canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height+75;
              var ctx = canvas.getContext('2d');
              ctx.drawImage(image, 0, 0);

              var a = document.createElement('a');
              a.download = svgId+'.png';
              var dataUrl = canvas.toDataURL('image/png');
              a.href = dataUrl;
              document.body.appendChild(a);
              a.click();
            }
            image.src = 'data:image/svg+xml;base64,' + window.btoa(unescape(encodeURIComponent(svgText)));
          }
        });
      }

      // ADD EMBED GRAPH BUTTON BEHAVIOURS
      $('a.embedSvg').on('click', function (e) {
        e.preventDefault();
        $('#myModal #myModalLabel').html('Embed this chart');
        $('#myModal .modal-body').html(
            '<p>Copy and paste the following code:</p>'
          + '<pre>'
          + '&lt;iframe src=&quot;'
          + window.location.href
          + '&amp;embed='
          + $(this).attr('data-target')
          + '&quot; height=&quot;500&quot; width=&quot;100%&quot;&gt;&lt;/iframe&gt;'
          + '</pre>'
          + '<p>Preview:</p>'
          + '<iframe src="'
          + window.location.href
          + '&embed='
          + $(this).attr('data-target')
          + '" height="500" width="100%"></iframe>'
        );
        $('#myModal').modal('show');
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
