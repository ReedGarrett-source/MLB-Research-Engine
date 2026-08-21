const http = require("http");
const axios = require("axios");

const server = http.createServer(async (req, res) => {

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  /*
   * ==========================================
   * LAST 15 HITTING GAMES
   * ==========================================
   */

  if (req.url.startsWith("/api/mlb/last15/")) {
    try {
      const playerId = req.url.replace("/api/mlb/last15/", "");

      const response = await axios.get(
        `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=gameLog&group=hitting&season=2026`
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


  /*
   * ==========================================
   * MLB QUERY ENGINE
   * ==========================================
   */

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

      const originalQuestion = question;
      const normalizedQuestion = question
        .toLowerCase()
        .replace(/[’']/g, "")
        .replace(/\bk's\b/g, "strikeouts")
        .replace(/\bks\b/g, "strikeouts")
        .replace(/\bhomers\b/g, "home runs")
        .replace(/\bhomer\b/g, "home run")
        .replace(/\bhr\b/g, "home runs");


      /*
       * ==========================================
       * STAT ALIASES
       * ==========================================
       */

      const statPatterns = [
        { key: "OPS", names: ["ops"] },
        { key: "AVG", names: ["avg", "average", "batting average"] },
        { key: "OBP", names: ["obp", "on base percentage", "on-base percentage"] },
        { key: "SLG", names: ["slg", "slugging percentage"] },

        { key: "homeRuns", names: ["home runs", "home run"] },
        { key: "hits", names: ["hits", "hit"] },
        { key: "runs", names: ["runs", "run"] },
        { key: "rbi", names: ["rbi", "rbis"] },
        { key: "walks", names: ["walks", "walk", "bb"] },
        { key: "strikeOuts", names: ["strikeouts", "strikeout", "k"] },
        { key: "stolenBases", names: ["stolen bases", "stolen base", "sb"] },
        { key: "caughtStealing", names: ["caught stealing", "cs"] },
        { key: "atBats", names: ["at bats", "at-bats", "ab"] },
        { key: "doubles", names: ["doubles", "double", "2b"] },
        { key: "triples", names: ["triples", "triple", "3b"] },

        { key: "inningsPitched", names: ["innings pitched", "innings", "ip"] },
        { key: "earnedRuns", names: ["earned runs", "earned run", "er"] },
        { key: "hitsAllowed", names: ["hits allowed"] },

        { key: "ERA", names: ["era"] },
        { key: "WHIP", names: ["whip"] },

        { key: "BBPercent", names: ["bb%", "bb percent", "walk rate", "walk percentage"] },
        { key: "KPercent", names: ["k%", "k percent", "strikeout rate", "strikeout percentage"] },
        { key: "ISO", names: ["iso", "isolated power"] },
        { key: "BABIP", names: ["babip"] },

        { key: "K9", names: ["k/9", "k per 9", "strikeouts per 9"] },
        { key: "BB9", names: ["bb/9", "bb per 9", "walks per 9"] },
        { key: "HR9", names: ["hr/9", "hr per 9", "home runs per 9"] }
      ];


      /*
       * Find which stat the user is asking for
       */

      let requestedStat = null;
      let matchedStatText = null;

      for (const stat of statPatterns) {

        for (const name of stat.names) {

          const escapedName = name
            .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

          const regex = new RegExp(
            `\\b${escapedName}\\b`,
            "i"
          );

          if (regex.test(normalizedQuestion)) {
            requestedStat = stat.key;
            matchedStatText = name;
            break;
          }
        }

        if (requestedStat) break;
      }


      /*
       * ==========================================
       * DATE / GAME RANGE DETECTION
       * ==========================================
       */

      const sinceMatch = normalizedQuestion.match(
        /\bsince\s+([a-z]+\s+\d{1,2},?\s+\d{4})/i
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


      const lastGamesMatch = normalizedQuestion.match(
        /\b(?:last|past)\s+(\d+)\s+games?\b/i
      );

      const lastStartsMatch = normalizedQuestion.match(
        /\b(?:last|past)\s+(\d+)\s+starts?\b/i
      );

      const numberOfGames =
        lastGamesMatch
          ? parseInt(lastGamesMatch[1])
          : lastStartsMatch
          ? parseInt(lastStartsMatch[1])
          : null;


      /*
       * ==========================================
       * "STATS IN LAST X GAMES"
       * ==========================================
       */

      const asksForFullStats =
        /\bstats?\b/i.test(normalizedQuestion) &&
        numberOfGames !== null;


      /*
       * ==========================================
       * PLAYER NAME EXTRACTION
       * ==========================================
       */

      let playerName = normalizedQuestion;

      const cleanupPatterns = [
        /\bstats?\b/i,
        /\b(?:in|over|for)\s+(?:his|their|the)?\s*(?:last|past)\s+\d+\s+games?\b/i,
        /\b(?:in|over|for)\s+(?:his|their|the)?\s*(?:last|past)\s+\d+\s+starts?\b/i,
        /\bsince\s+[a-z]+\s+\d{1,2},?\s+\d{4}/i,
        /\b(?:last|past)\s+\d+\s+games?\b/i,
        /\b(?:last|past)\s+\d+\s+starts?\b/i
      ];

      for (const pattern of cleanupPatterns) {
        playerName = playerName.replace(pattern, "");
      }


      /*
       * Remove the requested stat from the player name
       */

      if (matchedStatText) {

        const statRegex = new RegExp(
          `\\b${matchedStatText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
          "i"
        );

        playerName = playerName.replace(statRegex, "");
      }


      playerName = playerName
        .replace(/\bin\b/gi, "")
        .replace(/\bover\b/gi, "")
        .replace(/\bfor\b/gi, "")
        .replace(/\bhis\b/gi, "")
        .replace(/\btheir\b/gi, "")
        .replace(/\bthe\b/gi, "")
        .replace(/\bsince\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();


      if (!playerName) {

        res.writeHead(400, {
          "Content-Type": "application/json"
        });

        res.end(
          JSON.stringify({
            error: "I couldn't determine the player."
          })
        );

        return;
      }


      /*
       * ==========================================
       * PLAYER SEARCH
       * ==========================================
       */

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


      /*
       * ==========================================
       * DETERMINE PITCHER VS HITTER
       * ==========================================
       */

      const pitchingStatsRequested = [
        "inningsPitched",
        "earnedRuns",
        "hitsAllowed",
        "ERA",
        "WHIP",
        "K9",
        "BB9",
        "HR9"
      ];

      const isPitchingQuestion =
        pitchingStatsRequested.includes(requestedStat) ||
        /\b(pitching|pitcher|era|whip|innings pitched|strikeouts per 9|walks per 9|hr\/9)\b/i.test(
          normalizedQuestion
        );


      /*
       * ==========================================
       * PITCHING
       * ==========================================
       */

      if (isPitchingQuestion) {

        const seasonsToFetch = [2024, 2025, 2026];

        let pitchingSplits = [];

        for (const seasonYear of seasonsToFetch) {

          const statsResponse = await axios.get(
            `https://statsapi.mlb.com/api/v1/people/${player.id}/stats?stats=gameLog&group=pitching&season=${seasonYear}`
          );

          const seasonSplits =
            statsResponse.data.stats?.[0]?.splits || [];

          pitchingSplits.push(...seasonSplits);
        }


        let games;

        if (startDate) {

          games = pitchingSplits
            .filter(game => new Date(game.date) >= startDate)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        } else if (numberOfGames !== null) {

          games = pitchingSplits
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .slice(-numberOfGames);

        } else {

          /*
           * If user asks something like:
           * "Kodai Senga innings pitched"
           * use the current 2026 season.
           */

          games = pitchingSplits
            .filter(game => game.date?.startsWith("2026"))
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        }


        let inningsPitched = 0;
        let earnedRuns = 0;
        let hitsAllowed = 0;
        let walks = 0;
        let strikeOuts = 0;
        let homeRuns = 0;


        for (const game of games) {

          const stat = game.stat;

          const ip = stat.inningsPitched || "0.0";
          const parts = ip.split(".");

          const wholeInnings =
            parseInt(parts[0]) || 0;

          const outs =
            parseInt(parts[1]) || 0;

          inningsPitched += wholeInnings;

          if (outs === 1) {
            inningsPitched += 1 / 3;
          } else if (outs === 2) {
            inningsPitched += 2 / 3;
          }

          earnedRuns += stat.earnedRuns || 0;
          hitsAllowed += stat.hits || 0;
          walks += stat.baseOnBalls || 0;
          strikeOuts += stat.strikeOuts || 0;
          homeRuns += stat.homeRuns || 0;
        }


        const era =
          inningsPitched > 0
            ? (earnedRuns * 9) / inningsPitched
            : 0;

        const whip =
          inningsPitched > 0
            ? (walks + hitsAllowed) / inningsPitched
            : 0;

        const battersFaced =
          games.reduce(
            (total, game) =>
              total + (game.stat.battersFaced || 0),
            0
          );

        const kPercent =
          battersFaced > 0
            ? strikeOuts / battersFaced
            : 0;

        const bbPercent =
          battersFaced > 0
            ? walks / battersFaced
            : 0;

        const k9 =
          inningsPitched > 0
            ? strikeOuts * 9 / inningsPitched
            : 0;

        const bb9 =
          inningsPitched > 0
            ? walks * 9 / inningsPitched
            : 0;

        const hr9 =
          inningsPitched > 0
            ? homeRuns * 9 / inningsPitched
            : 0;


        res.writeHead(200, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        });


        res.end(
          JSON.stringify({

            question: originalQuestion,

            player: player.fullName,

            requestedStat,

            games: games.length,

            inningsPitched: inningsPitched.toFixed(1),
            earnedRuns,
            hitsAllowed,
            walks,
            strikeOuts,
            homeRuns,

            ERA: era.toFixed(2),
            WHIP: whip.toFixed(2),

            KPercent: (kPercent * 100).toFixed(1),
            BBPercent: (bbPercent * 100).toFixed(1),

            K9: k9.toFixed(2),
            BB9: bb9.toFixed(2),
            HR9: hr9.toFixed(2)

          })
        );

        return;
      }


      /*
       * ==========================================
       * HITTING
       * ==========================================
       */

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

      } else if (numberOfGames !== null) {

        games = splits
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .slice(-numberOfGames);

      } else {

        games = splits
          .filter(game => game.date?.startsWith("2026"))
          .sort((a, b) => new Date(a.date) - new Date(b.date));
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


      const singles =
        hits - doubles - triples - homeRuns;


      const obpDenominator =
        atBats +
        walks +
        hitByPitch +
        sacrificeFlies;


      const battingAverage =
        atBats > 0
          ? hits / atBats
          : 0;


      const obp =
        obpDenominator > 0
          ? (hits + walks + hitByPitch) /
            obpDenominator
          : 0;


      const slg =
        atBats > 0
          ? totalBases / atBats
          : 0;


      const ops =
        obp + slg;


      /*
       * ADVANCED HITTING STATS
       */

      const plateAppearances =
        atBats +
        walks +
        hitByPitch +
        sacrificeFlies;


      const bbPercent =
        plateAppearances > 0
          ? walks / plateAppearances
          : 0;


      const kPercent =
        plateAppearances > 0
          ? strikeOuts / plateAppearances
          : 0;


      const iso =
        atBats > 0
          ? slg - battingAverage
          : 0;


      const babipDenominator =
        atBats -
        strikeOuts -
        homeRuns +
        sacrificeFlies;


      const babip =
        babipDenominator > 0
          ? (hits - homeRuns) /
            babipDenominator
          : 0;


      /*
       * ==========================================
       * RESPONSE
       * ==========================================
       */

      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      });


      res.end(
        JSON.stringify({

          question: originalQuestion,

          player: player.fullName,

          requestedStat,

          games: games.length,

          /*
           * BASIC STATS
           */

          atBats,
          hits,
          singles,
          runs,
          doubles,
          triples,
          homeRuns,
          rbi,
          walks,
          strikeOuts,
          stolenBases,
          caughtStealing,

          battingAverage:
            battingAverage.toFixed(3),

          onBasePercentage:
            obp.toFixed(3),

          sluggingPercentage:
            slg.toFixed(3),

          OPS:
            ops.toFixed(3),


          /*
           * ADVANCED STATS
           */

          BBPercent:
            (bbPercent * 100).toFixed(1),

          KPercent:
            (kPercent * 100).toFixed(1),

          ISO:
            iso.toFixed(3),

          BABIP:
            babip.toFixed(3)

        })
      );

      return;


    } catch (error) {

      console.error("MLB query error:", error);

      if (!res.headersSent) {

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
  }


  /*
   * ==========================================
   * MLB GAME LOGS
   * ==========================================
   */

  if (req.url.startsWith("/api/mlb/games/")) {

    try {

      const playerId =
        req.url.replace("/api/mlb/games/", "");

      const response = await axios.get(
        `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=gameLog&group=hitting&season=2026`
      );

      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      });

      res.end(
        JSON.stringify(response.data)
      );

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


  /*
   * ==========================================
   * PLAYER SEARCH
   * ==========================================
   */

  if (req.url.startsWith("/api/mlb/player/")) {

    try {

      const playerName =
        decodeURIComponent(
          req.url.replace("/api/mlb/player/", "")
        );

      const response = await axios.get(
        `https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(playerName)}`
      );

      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      });

      res.end(
        JSON.stringify(response.data)
      );

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


  /*
   * ==========================================
   * MLB TEAMS
   * ==========================================
   */

  if (req.url === "/api/mlb/teams") {

    try {

      const response = await axios.get(
        "https://statsapi.mlb.com/api/v1/teams?sportId=1"
      );

      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      });

      res.end(
        JSON.stringify(response.data)
      );

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


  /*
   * ==========================================
   * DEFAULT RESPONSE
   * ==========================================
   */

  res.writeHead(200, {
    "Content-Type": "application/json"
  });

  res.end(
    JSON.stringify({
      message:
        "MLB Research Engine backend is working!"
    })
  );

});


const PORT =
  process.env.PORT || 3000;


server.listen(PORT, () => {

  console.log(
    `Server running on port ${PORT}`
  );

});
