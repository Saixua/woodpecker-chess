const fs = require('fs');
const puzzles = require('./public/lichess_puzzles.json');
console.log('puzzles length:', puzzles.length);
const str = JSON.stringify(puzzles);
console.log('puzzles string length:', str.length);
