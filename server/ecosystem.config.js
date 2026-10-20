module.exports = {
  apps: [
    {
      name: 'flakesecure',
      script: './server.js',
      watch: false,
      ignore_watch: [
        'node_modules',
        'data',
        'backups',
        'cache',
        'logs',
        '*.log',
        'public/*.zip',
        'public/*.apk'
      ]
    }
  ]
};
