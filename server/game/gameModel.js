var mongoose = require('mongoose');

// Inside our DB, a game consists of two users, and a flag indicating that
// the game is currently going on

var GameSchema = new mongoose.Schema({
  player1: Object,
  player2: Object,
  active: Boolean
});

module.exports = mongoose.model('game', GameSchema);
