const http = require("http");
const axios = require("axios");

const server = http.createServer(async (req, res) => {
if (req.url.startsWith("/api/mlb/last15/")) {
  try {
    const playerId = req.url.replace("/api/mlb/last15/", "");

    const response = await axios.get(
      `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=gameLog&group=hitting&season=2026`
    );

    const splits = response.data.stats?.[0]?.splits || [];

    const last15 = splits.slice(-15);

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
  if (req.url.startsWith("/api/mlb/games/")) {
  try {
    const playerId = req.url.replace("/api/mlb/games/", "");

    const response = await axios.get(
      `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=gameLog&group=hitting&season=2026`
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
