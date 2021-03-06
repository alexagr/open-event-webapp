'use strict';

const fs = require('fs-extra');
const request = require('request');
const async = require('async');
const admZip = require('adm-zip');
const progressStream = require('progress-stream');
const streamBuffer = require('stream-buffers');
const path = require("path");
const recursive = require('recursive-readdir');
const sharp = require('sharp');

const distPath = __dirname + '/../../dist';
const uploadsPath = __dirname + '/../../uploads';
const mockPath = __dirname + '/../../mockjson';

let filePath, fileData, hashString;

const downloadFile = function(url, filePath) {
  const fileStream = fs.createWriteStream(filePath);

  fileStream.on('error', function(err) {
    console.log(err);
  });
  try {
    request(url).pipe(fileStream);
  } catch (err) {
    console.log(err);
  }
};

const downloadJson = function(appPath, endpoint, jsonFile, cb) {
  const fileStream = fs.createWriteStream(appPath + '/json/' + jsonFile);

  fileStream.on('error', function(err) {
    console.log(err);
  });
  fileStream.on('finish', function () {
    cb()
  });

  try {
    console.log('Downloading ' + endpoint + '/' + jsonFile);
    request
        .get(endpoint + '/' + jsonFile)
        .on('response', function(response) {
          if (response.statusCode != 200) {
            cb(new Error('Response = ' + response.statusCode + 'received'));
          }
        })
        .pipe(fileStream);
  } catch (err) {
    console.log(err);
  }
};

module.exports = {
  distPath,
  uploadsPath,
  moveZip: function(dlPath) {
    fs.move(dlPath, path.join(__dirname, "../../uploads/upload.zip"), () => {
      
    })
  },
  uploadWithProgress: function(fileBuffer, fileSize, emitter) {
    const progressor = progressStream({length: fileSize, speed: 1}, function(progress) {
      console.log('Zip upload: Status =' + parseInt(progress.percentage) + '%');
      emitter.emit('upload.progress', progress)
    });
    var fileBufferStream = new streamBuffer.ReadableStreamBuffer({
      // frequency: 100,   // in milliseconds. 
      chunkSize: 4096  // in bytes.
    });
    fileBufferStream.put(fileBuffer);
    fileBufferStream
      .pipe(progressor)
      .pipe(fs.createWriteStream(path.join(uploadsPath, 'upload.zip')))

  },
  cleanUploads: function() {
    fs.emptyDirSync(uploadsPath);
  },
  cleanDist: function(appFolder, err) {
    fs.emptyDir(distPath + '/' + appFolder, (emptyErr) => {
      if(emptyErr)
         err(emptyErr);
      fs.remove(distPath + '/' + appFolder, err);
    });
  },
  makeUploadsDir: function(err) {
    fs.mkdirpSync(uploadsPath)
  },
  makeDistDir: function(appFolder, err) {
    const appPath = distPath + '/' + appFolder;
    fs.mkdirpSync(distPath);
    fs.mkdirpSync(appPath);
    fs.mkdirpSync(appPath + '/audio');
    fs.mkdirpSync(appPath + '/images/speakers');
    fs.mkdirpSync(appPath + '/images/sponsors');
    fs.mkdirpSync(appPath + '/images/thumbnails');
  },
  copyAssets: function(appFolder, err) {
    const appPath = distPath + '/' + appFolder;
    fs.copy((__dirname + '/assets'), appPath, {clobber: true}, err);
  },
  copyServiceWorker: function (appFolder, folderHash, done) {
    const appPath = distPath + '/' + appFolder;
    const pathOfFile = __dirname + '/assets/js/sw.js';
    try {
      fileData = fs.readFileSync(pathOfFile).toString().split('\n');
      hashString = "'" + folderHash + "';";
      fileData.unshift('var CACHE_NAME = ' + hashString);
      fs.writeFileSync(appPath + '/sw.js', fileData.join('\n'));
      return done(null);
    } catch (err) {
      return done(err);
    }
  },
  copyManifestFile: function (appFolder, eventName, done) {
    const appPath = distPath + '/' + appFolder;
    filePath = __dirname + '/assets/dependencies/manifest.json';
    try {
      const dataOfFile = fs.readFileSync(filePath).toString().split('\n');
      // dataOfFile.unshift('{\n "name": "' + eventName + '",\n "short_name": "' + eventName + '",');
      fs.writeFileSync(appPath + '/manifest.json', dataOfFile.join('\n'));
      return done(null);
    } catch (err) {
      return done(err);
    }
  },
  copyUploads: function(appFolder) {
    const appPath = distPath + '/' + appFolder;
    fs.mkdirpSync(appPath + '/json');
    var zip = new admZip(path.join(uploadsPath, 'upload.zip'));
     var zipEntries = zip.getEntries(); 

     zipEntries.forEach(function(zipEntry) {
      console.log(' - ' + zipEntry.entryName)
      switch(zipEntry.entryName){
        case 'images/':
        zip.extractEntryTo("images/", appPath ); 
        break;
        case 'audio/':
        zip.extractEntryTo("audio/", appPath);
        break;
        case 'sessions':
        zip.extractEntryTo("sessions", appPath +'/json/');
        break;
        case 'speakers':
        zip.extractEntryTo("speakers", appPath +'/json/');
        break;
        case 'microlocations' :
        zip.extractEntryTo("microlocations", appPath+'/json/');
        break;
        case 'event' :
        zip.extractEntryTo("event", appPath +'/json/');
        break;
        case 'sponsors' :
        zip.extractEntryTo("sponsors", appPath +'/json/');
        break;
        case 'tracks':
        zip.extractEntryTo("tracks", appPath +'/json/');
        break;
        default:
      }
      
    });
    
  },
  fetchApiJsons: function(appFolder, apiEndpoint, done) {
    const endpoint = apiEndpoint.replace(/\/$/, '');
    const appPath = distPath + '/' + appFolder;

    const jsons = [
      'speakers',
      'sponsors',
      'sessions',
      'tracks',
      'microlocations',
      'event'
    ];

    fs.mkdirpSync(appPath + '/json');
    async.eachSeries(jsons, (json, callback) => {
      downloadJson(appPath, endpoint, json, callback);
    }, (err) => {
      if (err) {
        console.log(err);
      } else {
        console.log('Jsons downloaded');
        done();
      }
    });
  },
  copyMockJsons: function(appFolder) {
    const appPath = distPath + '/' + appFolder;
    fs.mkdirpSync(appPath + '/json');
    fs.copySync(mockPath + '/speakers', appPath + '/json/speakers');
    fs.copySync(mockPath + '/sessions', appPath + '/json/sessions');
    fs.copySync(mockPath + '/tracks', appPath + '/json/tracks');
    fs.copySync(mockPath + '/event', appPath + '/json/event');
    fs.copySync(mockPath + '/sponsors', appPath + '/json/sponsors');
    fs.copySync(mockPath + '/microlocations', appPath + '/json/microlocations');
  },
  downloadAudio: function(appFolder, audioUrl) {
    const appPath = distPath + '/' +appFolder;
    const audioFileName = audioUrl.split('/').pop();
    const audioFilePath = 'audio/' + audioFileName;

    console.log('Downloading audio : ' + audioFileName);

    downloadFile(audioUrl, appPath + '/' + audioFilePath);
    return audioFilePath;
  },
  downloadSpeakerPhoto: function(appFolder, photoUrl) {
    const appPath = distPath + '/' +appFolder;
    const photoFileName = photoUrl.split('/').pop();
    const photoFilePath = 'images/speakers/' + photoFileName;

    console.log('Downloading photo : ' + photoUrl + " to " + photoFilePath);
    downloadFile(photoUrl, appPath + '/' + photoFilePath);
    return photoFilePath;
  },
  downloadLogo: function(appFolder, logoUrl) {
    const appPath = distPath + '/' +appFolder;
    const photoFileName = logoUrl.split('/').pop();
    const photoFilePath = 'images/' + photoFileName;

    console.log('Downloading logo : ' + logoUrl + ' to ' + photoFileName);
    downloadFile(logoUrl, appPath + '/' + photoFilePath);
    return photoFilePath;
  },
   downloadSponsorPhoto: function(appFolder, photoUrl) {
    const appPath = distPath + '/' +appFolder;
    const photoFileName = photoUrl.split('/').pop();
    const photoFilePath = 'images/sponsors/' + photoFileName;

     console.log('Downloading photo : ' + photoUrl + " to " + photoFilePath);
    downloadFile(photoUrl, appPath + '/' + photoFilePath);
    return photoFilePath;
  },
  generateThumbnails: function(path, next){
    path = path.replace(/\\/g,"/");
    recursive(path + '/images/speakers/',function (err, files) {
      async.each(files, function(file,callback){
        file = file.replace(/\\/g,"/");
        const thumbFileName = file.split('/').pop();
        if (thumbFileName != 'avatar.png') {
          sharp(file)
          .resize(100, 100)
          .toFile(path + '/images/thumbnails/' + thumbFileName, function(err, info) {
            if (err) console.log(err);
            callback();
          });
        } else {
          fs.createReadStream(file).pipe(fs.createWriteStream(path + '/images/thumbnails/' + thumbFileName));
          callback();
        }
      },function(){
        next();
      })
    });
  }
};
