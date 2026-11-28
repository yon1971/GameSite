# Game Night

Party board and card games for one shared screen plus everyone's phones.

- Open the site on a TV or laptop and press **Create a room**. The board shows a 4-letter code and a QR code.
- Players scan the QR (or go to the site and type the code) on their phones. Each phone shows that player's private hand and controls; the big screen shows the shared table.
- The board, or the first player to join (the captain 👑), picks a game and starts it.
- Phones that lose connection rejoin automatically when reopened.

Run locally: `npm install && npm start`, then open http://localhost:3000. `npm test` plays thousands of random moves in every game to catch crashes.

Version: every page shows a small badge in the bottom-left corner like `v1.2.0 · 7fe0e17` (the version from `package.json` plus the short commit that's deployed). To bump it, change `"version"` in `package.json` (or run `npm version minor --no-git-tag-version`). `/api/version` returns the same info as JSON.

## Games

| Game | Players | Type |
| --- | --- | --- |
| Crazy Eights | 2-7 | Traditional |
| Rummy | 2-6 | Traditional |
| Tide Pool | 2-4 | Original card game |
| Lantern Keepers | 2-5 | Original cooperative card game |
| Bluff Market | 3-6 | Original bluffing game |
| Rivers | 2 | Original hex tile game |
| Shifting Tower | 2 | Original four-in-a-row variant |
| Moth & Flame | 2 | Original grid game |
| The Killer | 4-16 | Social deduction with secret roles |
| Blend In | 3-12 | Original secret-word imposter game |

Full rules are shown in the app (Rules button). Rule choices made for the originals:

- **Tide Pool**: 40 cards (crab, octopus, fish, shrimp, 1-10). Draw 2 per turn. Sets are 2+ of a number or 3+ of one creature in a row (+3 bonus). Cards below the tide wash out at the end of your turn for -1 each. Tide rises by 1 each round; game ends after the tide-10 round.
- **Lantern Keepers**: four colours 1-10 (three 1s, two each of 2-9, one 10 per colour), 8 sparks for hints, 3 gusts lose. Hints name a colour or a number. Deck empty gives everyone one last turn.
- **Bluff Market**: 10 starting coins, 4-card hands, 5 rounds. Caught liars pay each caller the asking price; wrong callers pay the seller half. First buyer clockwise gets the card. Score = coins + true value of bought goods.
- **Rivers**: radius-4 hex map, 34 tiles (straight, gentle and sharp bends), hand of 3. A river reaching the edge scores 1 per tile; one that runs into another tile dries up for 0. New springs appear near the middle.
- **Shifting Tower**: 7×6. After each move the column under the arrow loses its bottom disc, and the arrow moves right. Mover is checked first; 80-move cap is a draw.
- **Moth & Flame**: 9×9, flame starts in the centre. Moths place 2 per turn and go first; flame spreads 1 square orthogonally. Flame wins at the edge, moths win by enclosing it. Roles swap each rematch.
- **The Killer**: settings before starting are number of killers (1-5, capped so killers start as a minority) and spy on/off. There is no timer: each round everyone talks and votes on their phone (killers vote too, to blend in), and votes can be changed until the round ends. After voting, each killer secretly picks a non-killer to kill; they see each other's picks, and the person picked by the most killers dies (an even split is broken at random). The spy investigates one player per round and learns if they are a killer. The round ends once every living player has voted, every killer has picked, and the spy has investigated. The big screen then shows who the village voted out (most votes; a tie means nobody) and who the killers killed, with roles revealed, and the next round begins. Villagers win when no killers remain; killers win when they equal or outnumber everyone else.
- **Blend In**: settings are number of imposters (1-3, capped so they're a minority), words to play (1-10), clues each per word (1-3), category (mixed or one of 12) and whether imposters see the category. Every phone shows the secret word except the imposters', who don't know each other. Players type one-word clues in a shuffled order (an imposter never goes first; clues containing the word are refused for players who know it). Then everyone votes, with no timer; the round ends when everyone has voted. Most votes is accused, a tie accuses nobody. A caught imposter types one guess at the word (case, accents and plurals ignored). Scoring: imposters who escape +2 each; caught but guessed right, imposters +1 each; otherwise everyone else +1; anyone who voted for an imposter +1 more. Any phone presses "Next word". Word lists are our own, in `games/word-lists.js`.
- **Crazy Eights**: draw one if you can't (or won't) play, and you may play that card. If the deck is empty and nobody can play, lowest penalty hand wins.
- **Rummy**: aces low, sets of 3-4, runs of 3+, lay-offs allowed, can't discard the card just taken from the discard pile. Winner scores the other hands' card values.

Stack: Node, Express, Socket.io. No build step. Server code for each game is in `games/`, its screens in `public/games/`.
