"use strict";
var fs = require('fs');
var io = require('socket.io-client');
const config = require('./config.json');
var request = require('request').defaults({'proxy': config.proxy});

var client = io.connect('http://127.0.0.1:5000');
var i = 1;
client.on('connect', function () {

    if (i == 1) {
        i = 0;
        var data = {
            name: 'limmud2017',
            theme: 'light',
            datasource: 'jsonupload',
            assetmode: 'download',
            apiendpoint: ''
        }
        client.emit('live', data);
    }
    client.close();
});

