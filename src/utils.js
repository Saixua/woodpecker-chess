const themeNames = {
  "bodenMate": "Boden's Mate",
  "anastasiaMate": "Anastasia's Mate",
  "arabianMate": "Arabian Mate",
  "hookMate": "Hook Mate",
  "smotheredMate": "Smothered Mate",
  "backRankMate": "Back Rank Mate"
};

export const formatTheme = (theme) => {
  if (!theme || theme === 'All Themes') return theme || '';
  if (themeNames[theme]) return themeNames[theme];
  
  const spaced = theme.replace(/([a-z])([A-Z])/g, '$1 $2');
  const formatted = spaced.charAt(0).toUpperCase() + spaced.slice(1);
  return formatted.replace(/In(\d)/g, 'in $1').replace(/In (\d)/g, 'in $1');
};

export const calculateRatingChange = (userRating, puzzleRating, timeSpent, failed) => {
  const expectedScore = 1 / (1 + Math.pow(10, (puzzleRating - userRating) / 400));
  let actualScore = 0;
  if (!failed) {
     if (timeSpent <= 5) actualScore = 1.0;
     else if (timeSpent >= 30) actualScore = 0.5;
     else actualScore = 1.0 - 0.5 * ((timeSpent - 5) / 25);
  }
  return Math.round(32 * (actualScore - expectedScore));
};
