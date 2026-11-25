# Game Night

Party board and card games for one shared screen plus everyone's phones.

- Open the site on a TV or laptop and press **Create a room**. The board shows a 4-letter code and a QR code.
- Players scan the QR (or go to the site and type the code) on their phones. Each phone shows that player's private hand and controls; the big screen shows the shared table.
- The board, or the first player to join (the captain 👑), picks a game and starts it.
- Phones that lose connection rejoin automatically when reopened.

Run locally: `npm install && npm start`, then open http://localhost:3000. `npm test` plays thousands of random moves in every game to catch crashes.

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

Full rules are shown in the app (Rules button). Rule choices made for the originals:

- **Tide Pool**: 40 cards (crab, octopus, fish, shrimp, 1-10). Draw 2 per turn. Sets are 2+ of a number or 3+ of one creature in a row (+3 bonus). Cards below the tide wash out at the end of your turn for -1 each. Tide rises by 1 each round; game ends after the tide-10 round.
- **Lantern Keepers**: four colours 1-10 (three 1s, two each of 2-9, one 10 per colour), 8 sparks for hints, 3 gusts lose. Hints name a colour or a number. Deck empty gives everyone one last turn.
- **Bluff Market**: 10 starting coins, 4-card hands, 5 rounds. Caught liars pay each caller the asking price; wrong callers pay the seller half. First buyer clockwise gets the card. Score = coins + true value of bought goods.
- **Rivers**: radius-4 hex map, 34 tiles (straight, gentle and sharp bends), hand of 3. A river reaching the edge scores 1 per tile; one that runs into another tile dries up for 0. New springs appear near the middle.
- **Shifting Tower**: 7×6. After each move the column under the arrow loses its bottom disc, and the arrow moves right. Mover is checked first; 80-move cap is a draw.
- **Moth & Flame**: 9×9, flame starts in the centre. Moths place 2 per turn and go first; flame spreads 1 square orthogonally. Flame wins at the edge, moths win by enclosing it. Roles swap each rematch.
- **The Killer**: settings before starting are number of killers (1-5, capped so killers start as a minority), spy on/off, and talking minutes per round (1-15). Talking ends when the timer runs out or every living player taps Ready. Voting then lasts up to 90 seconds: everyone (killers too, to blend in) votes to eliminate; the most votes is out and their role is revealed, a tie means nobody is out. Killers secretly pick a non-killer and all living killers must agree or nobody dies; they see each other's picks. The spy investigates one player per round and learns if they are a killer. The next round's screen shows who was voted out and who was killed. Villagers win when no killers remain; killers win when they equal or outnumber everyone else.
- **Crazy Eights**: draw one if you can't (or won't) play, and you may play that card. If the deck is empty and nobody can play, lowest penalty hand wins.
- **Rummy**: aces low, sets of 3-4, runs of 3+, lay-offs allowed, can't discard the card just taken from the discard pile. Winner scores the other hands' card values.

Stack: Node, Express, Socket.io. No build step. Server code for each game is in `games/`, its screens in `public/games/`.
