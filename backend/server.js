const http = require("http");
const axios = require("axios");

const server = http.createServer(async (req, res) => {
if (req.url.startsWith("/api/mlb/last15/")) {
  try {
    const playerId = req.url.replace("/api/mlb/last15/", "");

    const response = await axios.get(
      `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=gameLog&group=hitting&season=${season}`
    );

    const splits = response.data.stats?.[0]?.splits || [];

const last15 = splits
  .sort((a, b) => new Date(a.date) - new Date(b.date))
  .slice(-15);

    let atBats = 0;
    let hits = 0;
    let doubles = 0;
    let triples = 0;
    let homeRuns = 0;
    let walks = 0;
    let hitByPitch = 0;
    let sacrificeFlies = 0;
    let totalBases = 0;

    for (const game of last15) {
      const stat = game.stat;

      atBats += stat.atBats || 0;
      hits += stat.hits || 0;
      doubles += stat.doubles || 0;
      triples += stat.triples || 0;
      homeRuns += stat.homeRuns || 0;
      walks += stat.baseOnBalls || 0;
      hitByPitch += stat.hitByPitch || 0;
      sacrificeFlies += stat.sacFlies || 0;
      totalBases += stat.totalBases || 0;
    }

    const singles = hits - doubles - triples - homeRuns;

    const battingAverage =
      atBats > 0 ? hits / atBats : 0;

    const onBaseDenominator =
      atBats + walks + hitByPitch + sacrificeFlies;

    const onBasePercentage =
      onBaseDenominator > 0
        ? (hits + walks + hitByPitch) / onBaseDenominator
        : 0;

    const sluggingPercentage =
      atBats > 0 ? totalBases / atBats : 0;

    const ops = onBasePercentage + sluggingPercentage;

    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    });

    res.end(
      JSON.stringify({
        playerId,
        games: last15.length,
        atBats,
        hits,
        singles,
        doubles,
        triples,
        homeRuns,
        walks,
        hitByPitch,
        battingAverage: battingAverage.toFixed(3),
        onBasePercentage: onBasePercentage.toFixed(3),
        sluggingPercentage: sluggingPercentage.toFixed(3),
        OPS: ops.toFixed(3)
      })
    );

    return;
  } catch (error) {
    res.writeHead(500, {
      "Content-Type": "application/json"
    });

    res.end(
      JSON.stringify({
        error: "Unable to calculate last 15 games."
      })
    );

    return;
  }
}
 if (req.url.startsWith("/api/mlb/query")) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const question = url.searchParams.get("question");



 

    if (!question) {
      res.writeHead(400, {
        "Content-Type": "application/json"
      });

      res.end(
        JSON.stringify({
          error: "Please provide an MLB question."
        })
      );

      return;
    }
   const sinceMatch = question.match(
  /\bsince\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i
);

let startDate = null;

if (sinceMatch) {
  startDate = new Date(sinceMatch[1]);

  if (isNaN(startDate.getTime())) {
    res.writeHead(400, {
      "Content-Type": "application/json"
    });

    res.end(
      JSON.stringify({
        error: "I couldn't understand that date."
      })
    );

    return;
  }
} 

    const match = question.match(
  /(.+?)\s+(?:ops|avg|obp|slg)\s+(?:in|over|for)\s+(?:his|their|the)?\s*(?:last\s+)?(\d+)\s+games?/i
);

const sincePlayerMatch = question.match(
  /(.+?)\s+(?:ops|avg|obp|slg)\s+since\s+/i
);

    if (!match && !sincePlayerMatch) {
      res.writeHead(400, {
        "Content-Type": "application/json"
      });

      res.end(
        JSON.stringify({
          error: "I don't understand that question yet."
        })
      );

      return;
    }

    const playerName = match
  ? match[1].trim()
  : sincePlayerMatch[1].trim();

const numberOfGames = match
  ? parseInt(match[2])
  : null;
    const seasonMatch = question.match(/\b(19\d{2}|20\d{2})\b/);
const season = seasonMatch ? parseInt(seasonMatch[1]) : 2026;

    const playerResponse = await axios.get(
      `https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(playerName)}`
    );

    const player = playerResponse.data.people?.[0];

    if (!player) {
      res.writeHead(404, {
        "Content-Type": "application/json"
      });

      res.end(
        JSON.stringify({
          error: `Could not find MLB player: ${playerName}`
        })
      );

      return;
    }

    const seasonsToFetch = [2024, 2025, 2026];

let splits = [];

for (const seasonYear of seasonsToFetch) {
  const statsResponse = await axios.get(
    `https://statsapi.mlb.com/api/v1/people/${player.id}/stats?stats=gameLog&group=hitting&season=${seasonYear}`
  );

  const seasonSplits =
    statsResponse.data.stats?.[0]?.splits || [];

  splits.push(...seasonSplits);
}

    let games;

if (startDate) {
  games = splits
    .filter(game => new Date(game.date) >= startDate)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
} else {
  games = splits
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-numberOfGames);
}

    let atBats = 0;
let hits = 0;
let runs = 0;
let doubles = 0;
let triples = 0;
let homeRuns = 0;
let rbi = 0;
let walks = 0;
let strikeOuts = 0;
let hitByPitch = 0;
let sacrificeFlies = 0;
let stolenBases = 0;
let caughtStealing = 0;
let totalBases = 0;

    for (const game of games) {
  const stat = game.stat;

  atBats += stat.atBats || 0;
  hits += stat.hits || 0;
  runs += stat.runs || 0;
  doubles += stat.doubles || 0;
  triples += stat.triples || 0;
  homeRuns += stat.homeRuns || 0;
  rbi += stat.rbi || 0;
  walks += stat.baseOnBalls || 0;
  strikeOuts += stat.strikeOuts || 0;
  hitByPitch += stat.hitByPitch || 0;
  sacrificeFlies += stat.sacFlies || 0;
  stolenBases += stat.stolenBases || 0;
  caughtStealing += stat.caughtStealing || 0;
  totalBases += stat.totalBases || 0;
}

    const obpDenominator =
      atBats + walks + hitByPitch + sacrificeFlies;
    const battingAverage =
  atBats > 0
    ? hits / atBats
    : 0;

    const obp =
      obpDenominator > 0
        ? (hits + walks + hitByPitch) / obpDenominator
        : 0;

    const slg =
      atBats > 0
        ? totalBases / atBats
        : 0;

    const ops = obp + slg;

    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    });

    res.end(
      JSON.stringify({
        question,
player: player.fullName,
games: games.length,
season,
atBats,
hits,
runs,
doubles,
triples,
homeRuns,
rbi,
walks,
strikeOuts,
stolenBases,
caughtStealing,
battingAverage: battingAverage.toFixed(3),
onBasePercentage: obp.toFixed(3),
sluggingPercentage: slg.toFixed(3),
OPS: ops.toFixed(3)
      })
    );

    return;

  } catch (error) {
    res.writeHead(500, {
      "Content-Type": "application/json"
    });

    res.end(
      JSON.stringify({
        error: "Unable to process MLB question."
      })
    );
  }

  return;
}
  if (req.url.startsWith("/api/mlb/games/")) {
  try {
    const playerId = req.url.replace("/api/mlb/games/", "");

    const response = await axios.get(
      `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=gameLog&group=hitting&season=${season}`
    );

    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    });

    res.end(JSON.stringify(response.data));
  } catch (error) {
    res.writeHead(500, {
      "Content-Type": "application/json"
    });

    res.end(
      JSON.stringify({
        error: "Unable to retrieve MLB game logs."
      })
    );
  }

  return;
}
 if (req.url.startsWith("/api/mlb/player/")) {
  try {
    const playerName = decodeURIComponent(
      req.url.replace("/api/mlb/player/", "")
    );

    const response = await axios.get(
      `https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(playerName)}`
    );

    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    });

    res.end(JSON.stringify(response.data));
  } catch (error) {
    res.writeHead(500, {
      "Content-Type": "application/json"
    });

    res.end(
      JSON.stringify({
        error: "Unable to search for MLB player."
      })
    );
  }

  return;
}
  if (req.url === "/api/mlb/teams") {
    try {
      const response = await axios.get(
        "https://statsapi.mlb.com/api/v1/teams?sportId=1"
      );

      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      });

      res.end(JSON.stringify(response.data));
    } catch (error) {
      res.writeHead(500, {
        "Content-Type": "application/json"
      });

      res.end(
        JSON.stringify({
          error: "Unable to retrieve MLB data."
        })
      );
    }

    return;
  }

  res.writeHead(200, {
    "Content-Type": "application/json"
  });

  res.end(
    JSON.stringify({
      message: "MLB Research Engine backend is working!"
    })
  );
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
