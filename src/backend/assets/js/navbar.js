/**
 * Created by championswimmer on 27/08/16.
 */
$(function() {
    $('.nav.navbar-nav > li a').removeClass('active');
    var linkUrl=window.location.href.split("/");
    if(findMatch(linkUrl, "rooms.html")){
        $("#roomslink").addClass('active');
    }
    else if(findMatch(linkUrl, "schedule.html")){
        $("#schedulelink").addClass('active');
    }
    else if(findMatch(linkUrl, "speakers.html")){
        $("#speakerslink").addClass('active');
    }
    else if(findMatch(linkUrl, "sessions.html")){
        $("#sessionslink").addClass('active');
    }
    else if(findMatch(linkUrl, "map.html")){
        $("#maplink").addClass('active');
    }
    else if(findMatch(linkUrl, "favorite.html")){
        $("#favoritelink").addClass('active');
    }
    else if(findMatch(linkUrl, "rooms_he.html")){
        $("#roomshelink").addClass('active');
    }
    else if(findMatch(linkUrl, "schedule_he.html")){
        $("#schedulehelink").addClass('active');
    }
    else if(findMatch(linkUrl, "speakers_he.html")){
        $("#speakershelink").addClass('active');
    }
    else if(findMatch(linkUrl, "map_he.html")){
        $("#maphelink").addClass('active');
    }
    else if(findMatch(linkUrl, "favorite_he.html")){
        $("#favoritehelink").addClass('active');
    }
    else {
        $("#homelink").addClass('active');
    }
});

function findMatch(arr, pattern){
    // len stores the no. of elements checked so far and flag tells whether we found any
    // pattern or not.
    var len = 0, flag = 0;
    arr.forEach(function(val){
        len += 1;
        if(val.indexOf(pattern) !== -1){
            flag = 1;
        }
    });

    // the check below makes sure that the function doesn't return any value before all
    // of the entries of the array are checked against the pattern.
    if(len === arr.length){
        return flag;
    }
}

$(document).ready(function() {    
  var sideslider = $('[data-toggle=collapse-side]'); 
  var sel = sideslider.attr('data-target'); 
  var top = $('header[role=banner]').outerHeight(); 
  sideslider.click(function(event){ 
    $(sel).css('top', top); 
    $(sel).toggleClass('in'); 
  }); 
}); 
