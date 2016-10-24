'use strict';

const fs = require('fs-extra');
const pfy = require('pfy');
let server;

module.exports = function() {
  server = this;
  let usedJar;
  let usedArgs;

  server.use(require('scriptserver-command'));
  server.use(require('scriptserver-util'));
  server.use(require('scriptserver-json'));

  server._start = server.start;

  server.start = function(jar, args) {
    usedJar = jar;
    usedArgs = args;
    if (jar === 'snapshot' || jar === 'release') {

      update(jar)
        .then(() => server._start('server.jar', args));

    } else server._start(jar, args);
  }

  server.command('restart', e => {
    server.util.isOp(e.player)
      .then(isOp => {
        if (isOp) {
          server.stop();

          return server.start(usedJar, usedArgs);
        } else {
          return server.util.tellRaw('You need to be op to restart the server!', e.player, { color: 'red' });
        }
      });
  });
}

function update(channel) {
  let currentV;

  return server.JSON.get('version', 'id')
    .then(current => currentV = current)
    .then(() => request('https://launchermeta.mojang.com/mc/game/version_manifest.json'))
    .then(body => JSON.parse(body))
    .then(body => request(body.versions.find(v => v.id === body.latest[channel]).url))
    .then(body => JSON.parse(body))
    .then(body => {
      if (currentV !== body.id) {
        console.log(`Out of date! Downloading ${body.id}`);
        return pfy(fs.remove)('./server.jar')
          .then(() => download(body.downloads.server.url, 'server.jar'))
          .then(() => server.JSON.set('version', 'id', body.id));
      } else console.log('Up to date!');
    })
    .catch(e => console.log(e));
}

function request(url) {
  return new Promise((resolve, reject) => {
    require('request')(url, (err, res, body) => {
      if (err) reject(err);
      else resolve(body);
    });
  });
}

function download(url, file) {
  return new Promise((resolve, reject) => {
    let fileStream = fs.createWriteStream(file);
    require('request')(url).pipe(fileStream);

    fileStream.on('close', () => resolve());
  });
}