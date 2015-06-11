module.exports = {
  mocha: ['mochaTest:test'],
  build: ['mocha', 'coffee'],
  'default': ['build']
};
