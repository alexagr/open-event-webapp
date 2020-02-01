'use strict';

const moment = require('moment');
const distHelper = require('./dist');
const urljoin = require('url-join');

const timeToPixel = 50; // 15 mins = 50 pixels
const columnWidth = 160;
const calendarWidth = 1060;

function byProperty(key) {

  return (a, b) => {
    if (a[key] > b[key]) {
      return 1;
    }
    if (a[key] < b[key]) {
      return -1;
    }

    return 0;
  };
}

function slugify(str) {
  if (typeof str === 'undefined') {
    return '';
  }
  return str.replace(/[^\w]/g, '-').replace(/-+/g, '-').toLowerCase();
}

function replaceSpaceWithUnderscore(str) {
  return str.replace(/ /g, '_');
}

function removeSpace(str) {
  return str.replace(/ /g, '');
}

function returnTrackColor(trackInfo, id) {
  if ((trackInfo == null) || (id == null)) {
    return '#f8f8fa'
  }
  return trackInfo[id];
}

function getHoursFromTime(time) {
  return time.split(':')[0];
}

function getMinutessFromTime(time) {
  return time.split(':')[1];
}

function getTimeDifferenceOfDates(startTime, sessionTime) {
  const firstDate = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), parseInt(getHoursFromTime(startTime), 10), parseInt(getMinutessFromTime(startTime), 10), 0);
  const secondDate = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), parseInt(getHoursFromTime(sessionTime), 10), parseInt(getMinutessFromTime(sessionTime), 10), 0);

  return secondDate - firstDate;
}

function convertTimeToPixel(startTime, sessionTime) {
  let timeDiff = getTimeDifferenceOfDates(startTime, sessionTime);

  if (timeDiff < 0) {
    timeDiff += 24 * 60 * 60 * 1000; 
  }
  let top = timeDiff * timeToPixel / (1000 * 60 * 15) + timeToPixel; // distance of session from top of the table

  return top;
}

function createTimeLine(startTime, endTime) {
  const timeLine = [];
  let startHour = parseInt(getHoursFromTime(startTime), 10);
  const startMinute = parseInt(getMinutessFromTime(startTime), 10);
  const endHour = parseInt(getHoursFromTime(endTime), 10);
  let i = startMinute;
  let time = '';
  let height = timeToPixel;

  if (i % 15 !== 0) {
    i = 0;
  }

  while (startHour <= endHour) {
    time = startHour < 10 ? '0' + startHour : startHour;
    time = time + ':' + (i === 0 ? '0' + i : i);
    if (i % 30 != 0) {
        time = '';
    }
    time = time.replace('24:', '00:');
    time = time.replace('25:', '01:');
    timeLine.push({
      time: time
    });

    i = (i + 15) % 60;
    height += timeToPixel;
    if (i === 0) {
      startHour++;
    }
  }
  return {
    timeline: timeLine,
    height: height
  };
}

function checkWidth(columns) {
  if (columns * columnWidth > calendarWidth) {
    return columnWidth + 'px';
  }
  const percentageWidth = 100 / columns;

  return percentageWidth + '%';
}

function foldByTrack(sessions, speakers, trackInfo, reqOpts) {

  const trackData = new Map();
  const speakersMap = new Map(speakers.map((s) => [s.id, s]));
  const trackDetails = new Object();

  trackInfo.forEach((track) => {
    trackDetails[track.id] = track.color;
  });

  sessions.forEach((session) => {
    if (!session.start_time) {
      return;
    }

    // generate slug/key for session
    const date = moment.utc(session.start_time).local().format('YYYY-MM-DD');
    const trackName = (session.track == null) ? 'deftrack' : session.track.name;
    const roomName = (session.microlocation == null) ? ' ' : session.microlocation.name;
    const session_type = (session.session_type == null) ? ' ' : session.session_type.name ;
    const slug = date + '-' + trackName;
    let track = null;

    // set up track if it does not exist
    if (!trackData.has(slug) && (session.track != null)) {
      track = {
        title: session.track.name,
        color: returnTrackColor(trackDetails, (session.track == null) ? null : session.track.id),
        date: moment.utc(session.start_time).local().format('dddd, Do MMM'),
        date_ru: moment.utc(session.start_time).local().locale('ru').format('dddd, D MMM'),
        date_he: moment.utc(session.start_time).local().locale('he').format('dddd, D MMM'),
        sortKey: moment.utc(session.start_time).local().format('YY-MM-DD'),
        slug: slug,
        sessions: []
      };
      trackData.set(slug, track);
    } else {
      track = trackData.get(slug);
    }

    if (reqOpts.assetmode === 'download') {
      const appFolder = reqOpts.email + '/' + slugify(reqOpts.name);
      if ((session.audio !== null) && (session.audio.substring(0, 4) === 'http')) {
        session.audio = distHelper.downloadAudio(appFolder, session.audio);
      }
    }

    if (track == undefined) {
      return;
    }

      const is_cancelled = (roomName == 'Отмена') ? true : false;
      track.sessions.push({
      start: moment.utc(session.start_time).local().format('HH:mm'),
      end : moment.utc(session.end_time).local().format('HH:mm'),
      title: session.title,
      type: session_type,
      location: roomName,
      speakers_list: session.speakers.map((speaker) => {
        let spkr = speakersMap.get(speaker.id);
        if(spkr.photo){
           spkr.thumb = 'images/thumbnails/' + (spkr.photo).split('/').pop();
        }
        spkr.nameIdSlug = slugify(spkr.name + spkr.id);
        return spkr;
      }),
      description: session.long_abstract,
      language: session.language,
      session_id: session.id,
      sign_up: session.signup_url,
      video: session.video,
      slides: session.slides,
      audio: session.audio,
      is_cancelled: is_cancelled
    });



  });

  let tracks = Array.from(trackData.values());

  tracks.sort(byProperty('sortKey'));

  return tracks;
}

function foldByTime(sessions, speakers, trackInfo) {
  let dateMap = new Map();
  const speakersMap = new Map(speakers.map((s) => [s.id, s]));
  const trackDetails = {};

  trackInfo.forEach((track) => {
    trackDetails[track.id] = track.color;
  });

  sessions.forEach((session) => {
    const roomName = (session.microlocation == null) ? ' ' : session.microlocation.name;
    const roomName_he = (session.microlocation == null) ? ' ' : session.microlocation.name_he;
    const roomColor = (session.microlocation == null) ? ' ' : session.microlocation.color;
    const session_type = (session.session_type == null) ? ' ' : session.session_type.name ;
    const session_type_he = (session.session_type_he == null) ? ' ' : session.session_type.name_he ;
    let date = moment.utc(session.start_time).local().format('YYYY-MM-DD');
    let time = moment.utc(session.start_time).local().format('HH:mm');
    let speakersNum = session.speakers.length;
    const tracktitle = (session.track == null) ? " " : session.track.name;
    const tracktitle_he = (session.track == null) ? " " : session.track.name_he;

    let sortKey = '0' + time;
    if (moment.utc(session.start_time).local().hours() == 0) {
        sortKey = '1' + time;
    }

    console.log(date);
    if (!dateMap.has(date)) {
      dateMap.set(date, {
        slug: date,
        date: moment.utc(session.start_time).local().format('dddd, D MMM'),
        date_ru: moment.utc(session.start_time).local().locale("ru").format('dddd, D MMMM'),
        date_he: moment.utc(session.start_time).local().locale("he").format('dddd, D MMMM'),
        date_short_ru: moment.utc(session.start_time).local().locale("ru").format('dddd'),
        date_short_he: moment.utc(session.start_time).local().locale("he").format('dddd'),
        times: new Map()
      })
    }
    let timeMap = dateMap.get(date).times;
    if (!timeMap.has(time)) {
      timeMap.set(time, {
        caption: time,
        sortKey: sortKey,
        sessions: []
      })
    }
    const is_cancelled = (roomName == 'Отмена') ? true : false;
    timeMap.get(time).sessions.push({
      start: moment.utc(session.start_time).local().format('HH:mm'),
      end : moment.utc(session.end_time).local().format('HH:mm'),
      color: returnTrackColor(trackDetails, (session.track == null) ? null : session.track.id),
      title: session.title,
      title_he: session.title_he,
      type: session_type,
      type_he: session_type_he,
      location: roomName,
      location_he: roomName_he,
      location_color: roomColor,
      is_cancelled: is_cancelled,
      speakers_list: session.speakers.map((speaker) =>  {
        let spkr = speakersMap.get(speaker.id);
        if(spkr.photo){
           spkr.thumb = 'images/thumbnails/' + (spkr.photo).split('/').pop();
        }
        spkr.nameIdSlug = slugify(spkr.name + spkr.id);
        return spkr;
      }),
      description: session.long_abstract,
      description_he: session.long_abstract_he,
      shabbat: session.shabbat,
      recommend: session.recommend,
      language: session.language,
      language_he: session.language_he,
      session_id: session.id,
      sign_up: session.signup_url,
      video: session.video,
      slides: session.slides,
      audio: session.audio,
      sessiondate: moment.utc(session.start_time).local().format('dddd, Do MMM'),
      sessiondate_ru: moment.utc(session.start_time).local().locale('ru').format('dddd, D MMM'),
      sessiondate_he: moment.utc(session.start_time).local().locale('he').format('dddd, D MMM'),
      tracktitle: tracktitle,
      tracktitle_he: tracktitle_he,
      speakers: speakersNum
    });
  });
  const dates = Array.from(dateMap.values());
  dates.sort(byProperty('caption'));
  dates.forEach((date) => {
    const times = Array.from(date.times.values());
    times.sort(byProperty('sortKey'));
    date.times = times;
  });

  return dates;
}

function foldByDate(tracks) {
  let dateMap = new Map();

  tracks.forEach((track) => {
    if (!dateMap.has(track.date)) {
      dateMap.set(track.date, {
        caption: track.date,
        firstSlug: track.slug,
        tracks: []
      });
    }
    dateMap.get(track.date).tracks.push(track);
  });

  const dates = Array.from(dateMap.values());
  dates.forEach((date) => date.tracks.sort(byProperty('sortKey')));
  return dates;
}

function returnTracknames(sessions, trackInfo) {

  const trackData = new Map();
  const trackDetails = new Object();

  trackInfo.forEach((track) => {
    trackDetails[track.id] = track.color;
  });

  sessions.forEach((session) => {
    if (!session.start_time) {
      return;
    }

    const trackName = (session.track == null) ? 'deftrack' : session.track.name;
    // generate slug/key for session
    const slug = trackName;
    let track = null;

    // set up track if it does not exist
    if (!trackData.has(slug) && (session.track != null)) {
      track = {
        title: session.track.name,
        title_he: session.track.name_he,
        color: returnTrackColor(trackDetails, (session.track == null) ? null : session.track.id),
        sortKey: moment.utc(session.start_time).local().format('YY-MM-DD'),
        slug: slug
      };
      trackData.set(slug, track);
    } else {
      track = trackData.get(slug);
    }
  });

  let tracks = Array.from(trackData.values());

  tracks.sort(byProperty('sortKey'));

  return tracks;
}

function createSocialLinks(event) {

  const sociallinks = Array.from(event.social_links);

  sociallinks.forEach((link) => {
    link.show = true;
    switch(link.name.toLowerCase()) {
      case 'event main page':
        link.icon = 'chrome';
        break;
      case 'twitter':
        link.icon = 'twitter';
        break;
      case 'github':
        link.icon = 'github';
        break;
      case 'facebook':
        link.icon = 'facebook';
        break;
      case 'youtube':
        link.icon = 'youtube-play';
        break;
      case 'linkedin':
        link.icon = 'linkedin';
        break;
      case 'vimeo':
        link.icon = 'vimeo';
        break;
      case 'flickr':
        link.icon = 'flickr';
        break;
      case 'google plus':
        link.icon = 'google-plus';
        break;
      default:
        link.show = false;
        break;
    }

    if (link.link === '') {
      link.show = false;
    }
  });
  return sociallinks;
}

function extractEventUrls(event, speakers, sponsors, reqOpts) {
  const sociallinks = Array.from(event.social_links);
  var sociallink ="";
  var featuresection = 0;
  var sponsorsection = 0;
  sociallinks.forEach((link) => {
    if(link.name.toLowerCase() === "twitter") {
      sociallink = link.link;
    }
  })

  sponsors.forEach((sponsor) => {
    if( sponsor.id !==undefined && typeof(sponsor.id)==='number') {
      sponsorsection ++;
    }
  })
  speakers.forEach((speaker) => {
    if(speaker.featured !== undefined && speaker.featured !==false && speaker.featured===true ) {
         featuresection++;
    }
  })

  const arrayTwitterLink = sociallink.split('/');
  const twitterLink = arrayTwitterLink[arrayTwitterLink.length - 1];

  const urls= {
    main_page_url: event.event_url,
    logo_url: event.logo,
    background_url: event.background_image,
    date: event.date,
    date_he: event.date_he,
    name: event.name,
    name_he: event.name_he,
    description: event.description,
    description_he: event.description_he,
    location: event.location_name,
    location_he: event.location_name_he,
    latitude: event.latitude,
    longitude: event.longitude,
    register: event.ticket_url,
    twitterLink: twitterLink,
    tweetUrl: sociallink,
    email: event.email,
    orgname: event.organizer_name,
    location_name: event.location_name,
    featuresection: featuresection,
    sponsorsection: sponsorsection
  };

  if (reqOpts.assetmode === 'download') {
    const appFolder = reqOpts.email + '/' + slugify(reqOpts.name);

    if (event.logo != null && event.logo != '') {
      if (event.logo.substring(0, 4) === 'http') {
        urls.logo_url = distHelper.downloadLogo(appFolder, event.logo);
      } else if (reqOpts.datasource === 'eventapi') {
        if (event.logo.charAt(0) == '/') event.logo = event.logo.substr(1);
        urls.logo_url = encodeURI(distHelper.downloadLogo(appFolder, urljoin(reqOpts.apiendpoint, event.logo)));
      }
      else {
        let reg = event.logo.split('');
        if(reg[0] =='/'){
          urls.logo_url = encodeURI(event.logo.substring(1,event.logo.length));
        }

      }
    }

    if ((event.background_image != null) && (event.background_image != '')) {
      if (event.background_image.substring(0, 4) === 'http') {
        urls.background_url = distHelper.downloadLogo(appFolder, event.background_image);
      } else if (reqOpts.datasource === 'eventapi') {
        if (event.background_image.charAt(0) == '/') event.background_image = event.background_image.substr(1);
        urls.background_url = encodeURI(distHelper.downloadLogo(appFolder, urljoin(reqOpts.apiendpoint, event.background_image)));
      }
      else {
        let reg = event.background_image.split('');
        if(reg[0] =='/'){
          urls.background_url = encodeURI(event.background_image.substring(1,event.background_image.length));
        }
      }
    }
  }

  return urls;
}

function getCopyrightData(event) {
  const copyright = event.copyright;
  return copyright;
}

function foldByLevel(sponsors ,reqOpts) {
  let levelData = {};
  let level1=0,level2=0,level3=0;
  const appFolder = reqOpts.email + '/' + slugify(reqOpts.name);
  sponsors.forEach( (sponsor) => {
    if(sponsor.level==="1" && (sponsor.logo !== null||" ")){
      level1++;
    }
    if (sponsor.level==="2" && (sponsor.logo !== null||" ")) {
       level2++;
    }
     if (sponsor.level==="3" && (sponsor.logo !== null||" ")) {
       level3++;
    }

  });

  sponsors.forEach((sponsor) => {

    if (levelData[sponsor.level] === undefined) {
      levelData[sponsor.level] = [];
    }
    if (sponsor.logo !== null && sponsor.logo != "") {
      if (sponsor.logo.substring(0, 4) === 'http') {
        sponsor.logo = encodeURI(distHelper.downloadSponsorPhoto(appFolder, sponsor.logo));
      } else if (reqOpts.datasource === 'eventapi' ) {
        sponsor.logo = encodeURI(distHelper.downloadSponsorPhoto(appFolder, urljoin(reqOpts.apiendpoint, sponsor.logo)));

      }
      else {
      let reg = sponsor.logo.split('');
      if(reg[0] =='/'){
          sponsor.logo = encodeURI(sponsor.logo.substring(1,sponsor.logo.length));
        }

      }
    }
    const sponsorItem = {
      divclass: '',
      imgsize: '',
      sponsorimg:'',
      name: sponsor.name,
      logo: sponsor.logo,
      url:  sponsor.url,
      level: sponsor.level,
      description: sponsor.description,
      type: sponsor.sponsor_type
    };

    switch (sponsorItem.level) {
      case '1':
      sponsorItem.divclass = 'vcenter col-md-4 col-sm-6';
      sponsorItem.sponsorimg = 'vcenter sponsorimg';
      sponsorItem.imgsize = 'large';
        break;
      case '2':
        sponsorItem.divclass = 'vcenter col-md-4 col-sm-6';
        sponsorItem.sponsorimg = 'vcenter sponsorimg';
        sponsorItem.imgsize = 'medium';
        break;
      case '3':
      sponsorItem.divclass = 'vcenter col-md-4 col-sm-6';
      sponsorItem.sponsorimg = 'vcenter sponsorimg';
        sponsorItem.imgsize = 'small';
        break;
      default:
      sponsorItem.divclass = 'vcenter col-md-4 col-sm-6';
      sponsorItem.sponsorimg = 'vcenter sponsorimg';

    }
    levelData[sponsor.level].push(sponsorItem);
  });

  return levelData;
}

function sessionsByRooms(id, sessions, trackInfo) {
  var sessionInRooms = [];
  const DateData = new Map();
  const trackDetails = new Object();
   trackInfo.forEach((track) => {
    trackDetails[track.id] = track.color;
  });

  sessions.forEach((session) => {

   const date = moment.utc(session.start_time).local().format('YYYY-MM-DD');
   const slug = date + '-' + session.microlocation.name;
    //if (sessionInRooms.indexOf(Object.values(slug))==-1) {
   if (!DateData.has(slug)) {
     var dated = moment.utc(session.start_time).local().format('YYYY-MM-DD');
    }
   else {
     dated = "";
   }
    if(typeof session.microlocation !== 'undefined') {
      if(id === session.microlocation.id) {
        sessionInRooms.push({
          date: dated ,
          name: session.title,
          time: moment.utc(session.start_time).local().format('HH:mm'),
          color: returnTrackColor(trackDetails, (session.track == null) ? null : session.track.id)
        });
        DateData.set(slug,moment.utc(session.start_time).local().format('YYYY-MM-DD'));
      }
  }

});

 sessionInRooms.sort(byProperty('date'));
 return sessionInRooms;
}

function foldByRooms(rooms, sessions, speakers, trackInfo) {
  const roomData = new Map();
  const trackDetails = new Object();
  const speakersMap = new Map(speakers.map((s) => [s.id, s]));
  const roomIds = new Map(rooms.map((s) => [s.name, s.id]));
  const microlocationArray = [];
  trackInfo.forEach((track) => {
    trackDetails[track.id] = track.color;
  });

  sessions.forEach((session) => {
    if (!session.start_time) {
      return;
    }

    // generate slug/key for session
    const date = moment.utc(session.start_time).local().format('YYYY-MM-DD');
    const roomName = (session.microlocation == null) ? ' ' : session.microlocation.name;
    const roomName_he = (session.microlocation == null) ? ' ' : session.microlocation.name_he;
    const roomColor = (session.microlocation == null) ? ' ' : session.microlocation.color;
    const slug = date ;
    const tracktitle = (session.track == null) ? " " : session.track.name;
    const tracktitle_he = (session.track == null) ? " " : session.track.name_he;
    let start = moment.utc(session.start_time).local().format('HH:mm');
    start = start.replace('00:', '24:');
    start = start.replace('01:', '25:');
    let end = moment.utc(session.end_time).local().format('HH:mm');
    end = end.replace('00:', '24:');
    end = end.replace('01:', '25:');
    let room = null;

    if ((roomName == 'Отмена') /*|| (roomName == 'Столовая') || (roomName == 'Экскурсия')*/) {
      return;
    }

    // set up room if it does not exist
    if (!roomData.has(slug) && (session.microlocation != null)) {
      room = {
        date: moment.utc(session.start_time).local().format('dddd, Do MMM'),
        date_ru: moment.utc(session.start_time).local().locale('ru').format('dddd, D MMMM'),
        date_he: moment.utc(session.start_time).local().locale('he').format('dddd, D MMMM'),
        sortKey: moment.utc(session.start_time).local().format('YY-MM-DD'),
        slug: slug,
        start_time: start,
        end_time: end,
        timeLine: [],
        sessions: []
      };
      roomData.set(slug,room);
    } else {
      room = roomData.get(slug);
    }

    if (room == undefined) {
      return;
    }

    let venue = '';
    let venue_he = '';
    let venue_id = 99;
    if(session.microlocation !== null ) {
      const slug2 = date + '-' + session.microlocation.name ;
      if(microlocationArray.indexOf(slug2) == -1 ) {
        microlocationArray.push(slug2);
      }
      venue = session.microlocation.name;
      venue_he = session.microlocation.name_he;
      venue_id = roomIds.get(venue);
    }
    let venue_sort = venue_id.toString();
    if (venue_id < 10) {
        venue_sort = '0' + venue_sort;
    }

    let time = moment.utc(session.start_time).local().format('HH:mm');
    let sortKey = venue_sort + '0' + time;
    if (moment.utc(session.start_time).local().hours() < 3) {
        sortKey = venue_sort + '1' + time;
    }

    if (room.start_time === slug || room.start_time > start) {
      room.start_time = start;
    }
    if (room.end_time === slug || room.end_time < end) {
      room.end_time = end;
    }

    room.sessions.push({
      start: moment.utc(session.start_time).local().format('HH:mm'),
      color: returnTrackColor(trackDetails, (session.track == null) ? null : session.track.id),
      venue: venue,
      venue_he: venue_he,
      end : moment.utc(session.end_time).local().format('HH:mm'),
      title: session.title,
      title_he: session.title_he,
      description: session.long_abstract,
      description_he: session.long_abstract_he,
      shabbat: session.shabbat,
      recommend: session.recommend,
      language: session.language,
      language_he: session.language_he,
      session_id: session.id,
      speakers_list: session.speakers.map((speaker) => {
        let spkr = speakersMap.get(speaker.id);
        if(spkr.photo){
           spkr.thumb = 'images/thumbnails/' + (spkr.photo).split('/').pop();
        }
        spkr.nameIdSlug = slugify(spkr.name + spkr.id);
        return spkr;
      }),
      tracktitle: tracktitle,
      tracktitle_he: tracktitle_he,
      sessiondate: moment.utc(session.start_time).local().format('dddd, Do MMM'),
      sessiondate_ru: moment.utc(session.start_time).local().locale('ru').format('dddd, D MMM'),
      sessiondate_he: moment.utc(session.start_time).local().locale('he').format('dddd, D MMM'),
      roomname: roomName,
      roomname_he: roomName_he,
      roomcolor: roomColor,
      sortKey: sortKey
    });
  });

  let roomsDetail = Array.from(roomData.values());
  roomsDetail.sort(byProperty('sortKey'));

  let roomsDetailLength = roomsDetail.length;
  for (let i = 0; i < roomsDetailLength; i++) {
    // sort all sessions in each day by 'venue + date'
    roomsDetail[i].sessions.sort(byProperty('sortKey'));
    roomsDetail[i].venue = [];
    const startTime = roomsDetail[i].start_time;
    const endTime = roomsDetail[i].end_time;
    const timeinfo = createTimeLine(startTime, endTime);       
    
    roomsDetail[i].timeline = timeinfo.timeline;
    roomsDetail[i].height = timeinfo.height;
    roomsDetail[i].timeToPixel = timeToPixel;

    // remove venue names from all but the 1st session in each venue
    let sessionsLength = roomsDetail[i].sessions.length;
    let prevVenue = '';
    let tempVenue = {};
    
    tempVenue.sessions = [];
    for (let j = 0; j < sessionsLength; j++) {
      roomsDetail[i].sessions[j].top = convertTimeToPixel(startTime, roomsDetail[i].sessions[j].start);
      roomsDetail[i].sessions[j].bottom = convertTimeToPixel(startTime, roomsDetail[i].sessions[j].end);
      roomsDetail[i].sessions[j].height = roomsDetail[i].sessions[j].bottom - roomsDetail[i].sessions[j].top;

      if (roomsDetail[i].sessions[j].venue === prevVenue) {
        roomsDetail[i].sessions[j].venue = '';
        tempVenue.sessions.push(roomsDetail[i].sessions[j]);
      } else {
        if (JSON.stringify(tempVenue) !== JSON.stringify({}) && prevVenue !== '') {
          roomsDetail[i].venue.push(tempVenue);
          tempVenue = {};
          tempVenue.sessions = [];
        }
        tempVenue.venue = roomsDetail[i].sessions[j].venue;
        tempVenue.venue_he = roomsDetail[i].sessions[j].venue_he;
        tempVenue.slug = replaceSpaceWithUnderscore(tempVenue.venue);
        tempVenue.sessions.push(roomsDetail[i].sessions[j]);
        prevVenue = roomsDetail[i].sessions[j].venue;
      }
    }
    roomsDetail[i].venue.push(tempVenue);
    roomsDetail[i].sessions = {};
    roomsDetail[i].width = checkWidth(roomsDetail[i].venue.length);      
  }

  return roomsDetail;
}

function getAppName(event) {
    const name = event.name;
    return name;
}

function getAppNameHe(event) {
    const name = event.name_he;
    return name;
}

function getOrganizerName(event) {
    const name = event.organizer_name;
    return name;
}

function foldBySpeakers(speakers ,sessions, tracksData, reqOpts) {
  if (reqOpts.assetmode === 'download') {
    const appFolder = reqOpts.email + '/' + slugify(reqOpts.name);
    speakers.forEach((speaker) => {

      if (speaker.photo !== null && speaker.photo != '') {
        if (speaker.photo.substring(0, 4) === 'http') {
          speaker.photo = encodeURI(distHelper.downloadSpeakerPhoto(appFolder, speaker.photo));
        }
        else  if (reqOpts.datasource === 'eventapi' ) {
          speaker.photo = encodeURI(distHelper.downloadSpeakerPhoto(appFolder, urljoin(reqOpts.apiendpoint, speaker.photo)))
        } else {
          var reg = speaker.photo.split('');
          if(reg[0] =='/'){
            speaker.photo = encodeURI(speaker.photo.substring(1,speaker.photo.length));
          }
        }
      }
    });
  }

  let speakerslist = [];
  speakers.forEach((speaker) => {
    var thumb = '';
    if (speaker.photo) {
      thumb = 'images/speakers/thumbnails/' + (speaker.photo).split('/').pop();
    }
    speakerslist.push({
      country: speaker.country,
      featured: speaker.featured,
      email: speaker.email,
      facebook: speaker.facebook ,
      github: speaker.github ,
      linkedin: speaker.linkedin ,
      twitter: speaker.twitter ,
      website: speaker.website ,
      long_biography: speaker.long_biography ,
      long_biography_he: speaker.long_biography_he ,
      short_biography: speaker.short_biography ,
      short_biography_he: speaker.short_biography_he ,
      mobile: speaker.mobile,
      name: speaker.name,
      name2: speaker.name2,
      name_he: speaker.name_he,
      name2_he: speaker.name2_he,
      photo : speaker.photo,
      thumb : thumb,
      organisation: speaker.organisation,
      sessions : getAllSessions(speaker.sessions, sessions, tracksData),
      speaker_id: speaker.id,
      nameIdSlug: slugify(speaker.name + speaker.id)
    });

  speakerslist.sort(byProperty('name'));

 });

  return speakerslist;
}

function foldBySpeakersHe(speakers ,sessions, tracksData, reqOpts) {
  let speakerslist = foldBySpeakers(speakers ,sessions, tracksData, reqOpts);
  speakerslist.sort(byProperty('name_he'));
  return speakerslist;
}


function getAllSessions(speakerid , session, trackInfo){
  let speakersession =[];
  let sessiondetail = [];
  let trackDetails = new Object();

  trackInfo.forEach((track) => {
    trackDetails[track.id] = track.color;
  });

  const sessionsMap = new Map(session.map((s) => [s.id, s]));
  speakerid.forEach((speaker) => {
    if(speaker !== undefined ) {
       sessiondetail.push({
        detail :sessionsMap.get(speaker.id)
      })
      }
  })
sessiondetail.forEach((session) => {
  const roomname = (session.detail == null) ?' ': session.detail.microlocation.name;
  const roomname_he = (session.detail == null) ?' ': session.detail.microlocation.name_he;
  const roomcolor = (session.detail == null) ?' ': session.detail.microlocation.color;
  const is_cancelled = (roomname == 'Отмена') ? true : false;
  speakersession.push({
      start: moment.utc(session.detail.start_time).local().format('HH:mm'),
      end:   moment.utc(session.detail.end_time).local().format('HH:mm'),
      title: session.detail.title,
      title_he: session.detail.title_he,
      date: moment.utc(session.detail.start_time).local().format('ddd, Do MMM'),
      date_ru: moment.utc(session.detail.start_time).local().locale('ru').format('dddd, D MMM'),
      date_he: moment.utc(session.detail.start_time).local().locale('he').format('dddd, D MMM'),
      color: returnTrackColor(trackDetails, (session.detail.track == null) ? null : session.detail.track.id),
      location: roomname,
      location_he: roomname_he,
      location_color: roomcolor,
      session_id: session.detail.id,
      is_cancelled: is_cancelled
   });
})

return speakersession;

}
module.exports.foldByTrack = foldByTrack;
module.exports.foldByDate = foldByDate;
module.exports.createSocialLinks = createSocialLinks;
module.exports.extractEventUrls = extractEventUrls;
module.exports.getCopyrightData = getCopyrightData;
module.exports.foldByLevel = foldByLevel;
module.exports.foldByRooms = foldByRooms;
module.exports.slugify = slugify;
module.exports.getAppName = getAppName;
module.exports.getAppNameHe = getAppNameHe;
module.exports.getOrganizerName = getOrganizerName;
module.exports.foldBySpeakers = foldBySpeakers;
module.exports.foldBySpeakersHe = foldBySpeakersHe;
module.exports.foldByTime = foldByTime;
module.exports.returnTracknames = returnTracknames;
