/* vim: set expandtab sw=4 ts=4 sts=4: */
/**
 ** @fileoverview JavaScript functions used on tbl_select.php
 **
 ** @requires    jQuery
 ** @requires    js/functions.js
 **/


/**
 **  Display Help/Info
 **/
function displayHelp() {
    var msgbox = PMA_ajaxShowMessage(PMA_messages['strDisplayHelp'],10000);
    msgbox.click(function() {
        PMA_ajaxRemoveMessage(msgbox);
    });
}

/**
 ** Extend the array object for max function
 ** @param array
 **/
Array.max = function (array) {
    return Math.max.apply( Math, array );
}

/**
 ** Extend the array object for min function
 ** @param array
 **/
Array.min = function (array) {
    return Math.min.apply( Math, array );
}

/**
 ** Checks if a string contains only numeric value
 ** @param n: String (to be checked)
 **/
function isNumeric(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}

/**
 ** Checks if an object is empty
 ** @param n: Object (to be checked)
 **/
function isEmpty(obj) {
    var name;
    for (name in obj) {
        return false;
    }
    return true;
}

/**
 ** Converts a timestamp into the format of its field type
 ** @param val  Integer Timestamp
 ** @param type String  Field type(datetime/timestamp/time/date)
 **/
function getDate(val,type) {
    if (type.toString().search(/datetime/i) != -1 || type.toString().search(/timestamp/i) != -1) {
        return Highcharts.dateFormat('%Y-%m-%e %H:%M:%S', val)
    }
    else if (type.toString().search(/time/i) != -1) {
        return Highcharts.dateFormat('%H:%M:%S', val + 19800000)
    }
    else if (type.toString().search(/date/i) != -1) {
        return Highcharts.dateFormat('%Y-%m-%e', val)
    }
}

/**
 ** Converts a date/time into timestamp
 ** @param val  String Date
 ** @param type Sring  Field type(datetime/timestamp/time/date)
 **/
function getTimeStamp(val,type) {
    if (type.toString().search(/datetime/i) != -1 || type.toString().search(/timestamp/i) != -1) {
        return getDateFromFormat(val,'yyyy-MM-dd HH:mm:ss', val)
    }
    else if (type.toString().search(/time/i) != -1) {
        return getDateFromFormat('1970-01-01 ' + val,'yyyy-MM-dd HH:mm:ss')
    }
    else if (type.toString().search(/date/i) != -1) {
        return getDateFromFormat(val,'yyyy-MM-dd')
    }
}

/**
 ** Classifies the field type into numeric,timeseries or text
 ** @param field: field type (as in database structure)
 **/
function getType(field) {
        if (field.toString().search(/int/i) != -1 || field.toString().search(/decimal/i) != -1 || field.toString().search(/year/i) != -1)
            return 'numeric';
        else if (field.toString().search(/time/i) != -1 || field.toString().search(/date/i) != -1)
            return 'time';
        else
            return 'text';
}
/**
 ** Converts a categorical array into numeric array
 ** @param array categorical values array
 **/
function getCord(arr) {
    var newCord = new Array();
    var original = $.extend(true,[],arr);
    var arr = jQuery.unique(arr).sort();
    $.each(original, function(index,value) {
        newCord.push(jQuery.inArray(value,arr));
    });
    return [newCord,arr,original];
}

/**
 ** Scrolls the view to the display section
 **/
function scrollToChart() {
   var x = $('#dataDisplay').offset().top - 100; // 100 provides buffer in viewport
   $('html,body').animate({scrollTop: x}, 500);
}

$(document).ready(function() {

   /**
    ** Set a parameter for all Ajax queries made on this page.  Don't let the
    ** web server serve cached pages
    **/
    $.ajaxSetup({
        cache: 'false'
    });

    var cursorMode = ($("input[name='mode']:checked").val() == 'edit') ? 'crosshair' : 'pointer';
    var currentChart = null;
    var currentData = null;
    var xLabel = $('#tableid_0').val();
    var yLabel = $('#tableid_1').val();
    var xType = $('#types_0').val();
    var yType = $('#types_1').val();
    var dataLabel = $('#dataLabel').val();

    // Get query result
    var data = jQuery.parseJSON($('#querydata').html());

    /**
     ** Input form submit on field change
     **/
    $('#tableid_0').change(function() {
          $('#zoom_search_form').submit();
    })

    $('#tableid_1').change(function() {
          $('#zoom_search_form').submit();
    })

    $('#tableid_2').change(function() {
          $('#zoom_search_form').submit();
    })

    $('#tableid_3').change(function() {
          $('#zoom_search_form').submit();
    })

    /**
     * Input form validation
     **/
    $('#inputFormSubmitId').click(function() {
        if ($('#tableid_0').get(0).selectedIndex == 0 || $('#tableid_1').get(0).selectedIndex == 0)
            PMA_ajaxShowMessage(PMA_messages['strInputNull']);
        else if (xLabel == yLabel)
            PMA_ajaxShowMessage(PMA_messages['strSameInputs']);
    });

    /**
      ** Prepare a div containing a link, otherwise it's incorrectly displayed
      ** after a couple of clicks
      **/
    $('<div id="togglesearchformdiv"><a id="togglesearchformlink"></a></div>')
    .insertAfter('#zoom_search_form')
    // don't show it until we have results on-screen
    .hide();

    $('#togglesearchformlink')
        .html(PMA_messages['strShowSearchCriteria'])
        .bind('click', function() {
            var $link = $(this);
            $('#zoom_search_form').slideToggle();
            if ($link.text() == PMA_messages['strHideSearchCriteria']) {
                $link.text(PMA_messages['strShowSearchCriteria']);
            } else {
                $link.text(PMA_messages['strHideSearchCriteria']);
            }
             // avoid default click action
            return false;
         });

    /**
     ** Set dialog properties for the data display form
     **/
    $("#dataDisplay").dialog({
        autoOpen: false,
        title: 'Data point content',
        modal: false, //false otherwise other dialogues like timepicker may not function properly
        height: $('#dataDisplay').height() + 80,
        width: $('#dataDisplay').width() + 80
    });

    /*
     * Handle submit of zoom_display_form
     */

    $("#submitForm").click(function(event) {

        //Prevent default submission of form
        event.preventDefault();

        //Find changed values by comparing form values with selectedRow Object
        var newValues = new Array();//Stores the values changed from original
        var it = 4;
        var xChange = false;
        var yChange = false;
        for (key in selectedRow) {
            if (key != 'where_clause'){
                var oldVal = selectedRow[key];
                var newVal = ($('#fields_null_id_' + it).attr('checked')) ? null : $('#fieldID_' + it).val();
                if (oldVal != newVal){
                    selectedRow[key] = newVal;
                    newValues[key] = newVal;
                    if (key == xLabel) {
                        xChange = true;
                           data[currentData][xLabel] = newVal;
                    }
                    else if (key == yLabel) {
                        yChange = true;
                           data[currentData][yLabel] = newVal;
                    }
                }
            }
            it++
        }//End data update

        //Update the chart series and replot
        if (xChange || yChange) {
            var newSeries = new Array();
            newSeries[0] = new Object();
            newSeries[0].marker = {
                symbol: 'circle'
            };
            //Logic similar to plot generation, replot only if xAxis changes or yAxis changes. Code includes a lot of checks so as to replot only when necessary
            if (xChange) {
                  xCord[currentData] = selectedRow[xLabel];
                if (xType == 'numeric') {
                    currentChart.series[0].data[currentData].update({ x : selectedRow[xLabel] });
                    currentChart.xAxis[0].setExtremes(Array.min(xCord) - 6,Array.max(xCord) + 6);
                }
                else if (xType == 'time') {
                    currentChart.series[0].data[currentData].update({ x : getTimeStamp(selectedRow[xLabel],$('#types_0').val())});
                }
                else {
                    var tempX = getCord(xCord);
                    var tempY = getCord(yCord);
                    var i = 0;
                        newSeries[0].data = new Array();
                    xCord = tempX[2];
                    yCord = tempY[2];

                        $.each(data,function(key,value) {
                        if (yType != 'text')
                             newSeries[0].data.push({ name: value[dataLabel], x: tempX[0][i], y: value[yLabel], marker: {fillColor: colorCodes[i % 8]} , id: i } );
                        else
                            newSeries[0].data.push({ name: value[dataLabel], x: tempX[0][i], y: tempY[0][i], marker: {fillColor: colorCodes[i % 8]} , id: i } );
                        i++;
                    });
                    currentSettings.xAxis.labels = { formatter : function() {
                        if (tempX[1][this.value] && tempX[1][this.value].length > 10)
                            return tempX[1][this.value].substring(0,10)
                        else
                            return tempX[1][this.value];
                        }
                    }
                     currentSettings.series = newSeries;
                    currentChart = PMA_createChart(currentSettings);
                }

            }
            if (yChange) {

                  yCord[currentData] = selectedRow[yLabel];
                if (yType == 'numeric') {
                    currentChart.series[0].data[currentData].update({ y : selectedRow[yLabel] });
                    currentChart.yAxis[0].setExtremes(Array.min(yCord) - 6,Array.max(yCord) + 6);
                }
                else if (yType =='time') {
                    currentChart.series[0].data[currentData].update({ y : getTimeStamp(selectedRow[yLabel],$('#types_1').val())});
                }
                else {
                    var tempX = getCord(xCord);
                    var tempY = getCord(yCord);
                    var i = 0;
                        newSeries[0].data = new Array();
                    xCord = tempX[2];
                    yCord = tempY[2];

                        $.each(data,function(key,value) {
                        if (xType != 'text' )
                            newSeries[0].data.push({ name: value[dataLabel], x: value[xLabel], y: tempY[0][i], marker: {fillColor: colorCodes[i % 8]} , id: i } );
                        else
                            newSeries[0].data.push({ name: value[dataLabel], x: tempX[0][i], y: tempY[0][i], marker: {fillColor: colorCodes[i % 8]} , id: i } );
                        i++;
                    });
                    currentSettings.yAxis.labels = { formatter : function() {
                        if (tempY[1][this.value] && tempY[1][this.value].length > 10)
                            return tempY[1][this.value].substring(0,10)
                        else
                            return tempY[1][this.value];
                        }
                    }
                     currentSettings.series = newSeries;
                    currentChart = PMA_createChart(currentSettings);
                }
            }
            currentChart.series[0].data[currentData].select();
        }
        //End plot update

        //Generate SQL query for update
        if (!isEmpty(newValues)) {
            var sql_query = 'UPDATE `' + window.parent.table + '` SET ';
            for (key in newValues) {
                if (key != 'where_clause') {
                    sql_query += '`' + key + '`=' ;
                    var value = newValues[key];
                    if (!isNumeric(value) && value != null)
                        sql_query += '\'' + value + '\' ,';
                    else
                        sql_query += value + ' ,';
                }
            }
            sql_query = sql_query.substring(0, sql_query.length - 1);
            sql_query += ' WHERE ' + PMA_urldecode(data[currentData]['where_clause']);

            //Post SQL query to sql.php
            $.post('sql.php', {
                'token' : window.parent.token,
                'db' : window.parent.db,
                'ajax_request' : true,
                'sql_query' : sql_query,
                'inline_edit' : false
                }, function(data) {
                    if (data.success == true) {
                        $('#sqlqueryresults').html(data.sql_query);
                        $("#sqlqueryresults").trigger('appendAnchor');
                    }
                    else
                        PMA_ajaxShowMessage(data.error);
            })//End $.post
        }//End database update
        $("#dataDisplay").dialog("close");
    });//End submit handler

    /*
     * Generate plot using Highcharts
     */

    if (data != null) {
        $('#zoom_search_form')
         .slideToggle()
         .hide();
        $('#togglesearchformlink')
         .text(PMA_messages['strShowSearchCriteria'])
        $('#togglesearchformdiv').show();
        var selectedRow;
            var columnNames = new Array();
            var colorCodes = ['#FF0000','#00FFFF','#0000FF','#0000A0','#FF0080','#800080','#FFFF00','#00FF00','#FF00FF'];
            var series = new Array();
            var xCord = new Array();
            var yCord = new Array();
            var xCat = new Array();
            var yCat = new Array();
        var tempX, tempY;
            var it = 0;

        // Set the basic plot settings
        var currentSettings = {
            chart: {
                    renderTo: 'querychart',
                    type: 'scatter',
                    zoomType: 'xy',
                    width:$('#resizer').width() -3,
                    height:$('#resizer').height()-20
            },
            credits: {
                enabled: false
            },
            exporting: { enabled: false },
            label: { text: $('#dataLabel').val() },
            plotOptions: {
                series: {
                    allowPointSelect: true,
                    cursor: 'pointer',
                    showInLegend: false,
                    dataLabels: {
                        enabled: false
                    },
                    point: {
                        events: {
                            click: function() {
                                var id = this.id;
                                var fid = 4;
                                currentData = id;
                                // Make AJAX request to tbl_zoom_select.php for getting the complete row info
                                var post_params = {
                                    'ajax_request' : true,
                                    'get_data_row' : true,
                                    'db' : window.parent.db,
                                    'table' : window.parent.table,
                                    'where_clause' : data[id]['where_clause'],
                                    'token' : window.parent.token
                                }
                                $.post('tbl_zoom_select.php', post_params, function(data) {
                                    // Row is contained in data.row_info, now fill the displayResultForm with row values
                                    for ( key in data.row_info) {
                                        if (data.row_info[key] == null)
                                            $('#fields_null_id_' + fid).attr('checked', true);
                                        else
                                            $('#fieldID_' + fid).val(data.row_info[key]);
                                        fid++;
                                     }
                                     selectedRow = new Object();
                                     selectedRow = data.row_info;
                                });

                                $("#dataDisplay").dialog("open");
                            }
                        }
                    }
                }
            },
            tooltip: {
                formatter: function() {
                    return this.point.name;
                }
            },
            title: { text: 'Query Results' },
            xAxis: {
                title: { text: $('#tableid_0').val() }
            },
            yAxis: {
                min: null,
                title: { text: $('#tableid_1').val() }
            }
        }

        $('#resizer').resizable({
            resize: function() {
                currentChart.setSize(
                    this.offsetWidth -3,
                    this.offsetHeight -20,
                    false
                );
            }
        });

        // Classify types as either numeric,time,text
        xType = getType(xType);
        yType = getType(yType);

        //Set the axis type based on the field
        currentSettings.xAxis.type = (xType == 'time') ? 'datetime' : 'linear';
        currentSettings.yAxis.type = (yType == 'time') ? 'datetime' : 'linear';

        // Formulate series data for plot
        series[0] = new Object();
        series[0].data = new Array();
        series[0].marker = {
            symbol: 'circle'
        };
        if (xType != 'text' && yType != 'text') {
            $.each(data,function(key,value) {
                var xVal = (xType == 'numeric') ? value[xLabel] : getTimeStamp(value[xLabel],$('#types_0').val());
                var yVal = (yType == 'numeric') ? value[yLabel] : getTimeStamp(value[yLabel],$('#types_1').val());
                series[0].data.push({ name: value[dataLabel], x: xVal, y: yVal, marker: {fillColor: colorCodes[it % 8]} , id: it } );
                xCord.push(value[xLabel]);
                yCord.push(value[yLabel]);
                it++;
            });
            if (xType == 'numeric') {
                currentSettings.xAxis.max = Array.max(xCord) + 6
                currentSettings.xAxis.min = Array.min(xCord) - 6
            }
            else {
                currentSettings.xAxis.labels = { formatter : function() {
                    return getDate(this.value, $('#types_0').val());
                }}
            }
            if (yType == 'numeric') {
                currentSettings.yAxis.max = Array.max(yCord) + 6
                currentSettings.yAxis.min = Array.min(yCord) - 6
            }
            else {
                currentSettings.yAxis.labels = { formatter : function() {
                    return getDate(this.value, $('#types_1').val());
                }}
            }

        }

        else if (xType =='text' && yType !='text') {
            $.each(data,function(key,value) {
                xCord.push(value[xLabel]);
                yCord.push(value[yLabel]);
            });

            tempX = getCord(xCord);
            $.each(data,function(key,value) {
                var yVal = (yType == 'numeric') ? value[yLabel] : getTimeStamp(value[yLabel],$('#types_1').val());
                series[0].data.push({ name: value[dataLabel], x: tempX[0][it], y: yVal, marker: {fillColor: colorCodes[it % 8]} , id: it } );
                it++;
            });

            currentSettings.xAxis.labels = { formatter : function() {
                    if (tempX[1][this.value] && tempX[1][this.value].length > 10)
                        return tempX[1][this.value].substring(0,10)
                    else
                        return tempX[1][this.value];
                }
            }
            if (yType == 'numeric') {
                currentSettings.yAxis.max = Array.max(yCord) + 6
                currentSettings.yAxis.min = Array.min(yCord) - 6
            }
            else {
                currentSettings.yAxis.labels = { formatter : function() {
                    return getDate(this.value, $('#types_1').val());
                }}
            }
            xCord = tempX[2];
        }

        else if (xType !='text' && yType =='text') {
            $.each(data,function(key,value) {
                xCord.push(value[xLabel]);
                yCord.push(value[yLabel]);
            });
            tempY = getCord(yCord);
            $.each(data,function(key,value) {
                var xVal = (xType == 'numeric') ? value[xLabel] : getTimeStamp(value[xLabel],$('#types_0').val());
                series[0].data.push({ name: value[dataLabel], y: tempY[0][it], x: xVal, marker: {fillColor: colorCodes[it % 8]} , id: it } );
                it++;
            });
            if (xType == 'numeric') {
                currentSettings.xAxis.max = Array.max(xCord) + 6
                currentSettings.xAxis.min = Array.min(xCord) - 6
            }
            else {
                currentSettings.xAxis.labels = { formatter : function() {
                    return getDate(this.value, $('#types_0').val());
                }}
            }
            currentSettings.yAxis.labels = { formatter : function() {
                    if (tempY[1][this.value] && tempY[1][this.value].length > 10)
                        return tempY[1][this.value].substring(0,10)
                    else
                        return tempY[1][this.value];
                }
            }
            yCord = tempY[2];
        }

        else if (xType =='text' && yType =='text') {
            $.each(data,function(key,value) {
                xCord.push(value[xLabel]);
                yCord.push(value[yLabel]);
            });
            tempX = getCord(xCord);
            tempY = getCord(yCord);
            $.each(data,function(key,value) {
                series[0].data.push({ name: value[dataLabel], x: tempX[0][it], y: tempY[0][it], marker: {fillColor: colorCodes[it % 8]} , id: it } );
                it++;
            });
            currentSettings.xAxis.labels = { formatter : function() {
                if (tempX[1][this.value] && tempX[1][this.value].length > 10) {
                    return tempX[1][this.value].substring(0,10)
                } else {
                    return tempX[1][this.value];
                }
            }};
            currentSettings.yAxis.labels = { formatter : function() {
                if (tempY[1][this.value] && tempY[1][this.value].length > 10) {
                    return tempY[1][this.value].substring(0,10);
                } else {
                    return tempY[1][this.value];
                }
            }};
            xCord = tempX[2];
            yCord = tempY[2];

        }

        currentSettings.series = series;
        currentChart = PMA_createChart(currentSettings);
        scrollToChart();
    }
});
