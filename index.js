'use strict';

const fs = require('fs-extra');
const pfy = require('pfy');
const defaultsDeep = require('lodash.defaultsdeep');
let server;

module.exports = function() {
  server = this;
  server.config.update = defaultsDeep({}, server.config.update, {
    track: 'snapshot',
  });

  server.use(require('scriptserver-command'));
  server.use(require('scriptserver-util'));
  server.use(require('scriptserver-json'));

  server._start = server.start;

  server.start = async function() {
    try {
      await update();
    } catch (error) {
      console.error('There was an error updating:', error.message);
      console.error(error);
    } finally {
      server._start();
    }
  }

  server.command('restart', e => {
    server.util.isOp(e.player)
      .then(isOp => {
        if (isOp) {
          server.stop();

          return server.start();
        } else {
          return server.util.tellRaw('You need to be op to restart the server!', e.player, { color: 'red' });
        }
      });
  });
}

function update() {
  let currentV;

  return server.JSON.get('version', 'id')
    .then(current => currentV = current)
    .then(() => request('https://launchermeta.mojang.com/mc/game/version_manifest.json'))
    .then(body => JSON.parse(body))
    .then(body => request(body.versions.find(v => v.id === body.latest[server.config.update.track]).url))
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