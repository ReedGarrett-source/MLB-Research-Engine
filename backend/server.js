const http = require("http");
const axios = require("axios");

const PORT = process.env.PORT || 3000;
const MLB_API = "https://statsapi.mlb.com/api/v1";

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
   * HELPERS
   * ==========================================
   */

  function sendJSON(status, data) {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    });

    res.end(JSON.stringify(data));
  }

  function getURL() {
    return new URL(req.url, `http://${req.headers.host}`);
  }

  function cleanQuestion(question) {
    return question
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/\bhomers?\b/g, "home runs")
      .replace(/\bhrs?\b/g, "home runs")
      .replace(/\bks?\b/g, "strikeouts")
      .replace(/\bavg\b/g, "batting average")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractYear(question) {
    const match = question.match(/\b(18|19|20)\d{2}\b/);
    return match ? parseInt(match[0]) : 2026;
  }

  function isHistoricalQuestion(q) {
    return /\b(last|most|record|history|historical|ever|all[- ]time|consecutive|straight|streak|first|second|third|fourth|since|before|after)\b/i.test(q);
  }

  function isTeamQuestion(q) {
    return /\b(team|teams|mets|yankees|dodgers|cubs|red sox|braves|astros|phillies|padres|guardians|orioles|rangers|twins|brewers|cardinals|mariners|rays|tigers|royals|pirates|reds|nationals|rockies|diamondbacks|angels|athletics|giants|marlins|blue jays|white sox)\b/i.test(q);
  }

  function isAwardQuestion(q) {
    return /\b(rookie of the year|mvp|cy young|manager of the year|gold glove|silver slugger|award|awards)\b/i.test(q);
  }

  function isLeaderQuestion(q) {
    return /\b(led|leader|leaders|leading|most|highest|lowest|best|worst|top|ranked|rank|who had the most|who has the most)\b/i.test(q);
  }

  function isRecordQuestion(q) {
    return /\b(record|records|all[- ]time|history|longest|shortest|most ever|fewest ever)\b/i.test(q);
  }

  /*
   * ==========================================
   * STAT ALIASES
   * ==========================================
   */

  const statPatterns = [
    { key: "homeRuns", names: ["home runs", "home run"] },
    { key: "hits", names: ["hits", "hit"] },
    { key: "runs", names: ["runs", "run"] },
    { key: "rbi", names: ["rbi", "rbis", "runs batted in"] },
    { key: "walks", names: ["walks", "walk", "bb"] },
    { key: "strikeOuts", names: ["strikeouts", "strikeout", "k"] },
    { key: "stolenBases", names: ["stolen bases", "stolen base", "sb", "steals"] },
    { key: "caughtStealing", names: ["caught stealing", "cs"] },
    { key: "atBats", names: ["at bats", "at-bats", "ab"] },
    { key: "doubles", names: ["doubles", "double", "2b"] },
    { key: "triples", names: ["triples", "triple", "3b"] },

    { key: "OPS", names: ["ops"] },
    { key: "AVG", names: ["batting average", "average", "avg"] },
    { key: "OBP", names: ["obp", "on base percentage", "on-base percentage"] },
    { key: "SLG", names: ["slg", "slugging percentage"] },

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

  function findRequestedStat(question) {
    for (const stat of statPatterns) {
      for (const name of stat.names) {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`\\b${escaped}\\b`, "i");

        if (regex.test(question)) {
          return stat.key;
        }
      }
    }

    return null;
  }

  /*
   * ==========================================
   * MLB PLAYER SEARCH
   * ==========================================
   */

  async function searchPlayer(name) {
    const response = await axios.get(
      `${MLB_API}/people/search?names=${encodeURIComponent(name)}`
    );

    return response.data.people?.[0] || null;
  }

  /*
   * ==========================================
   * SEASON HITTING STATS
   * ==========================================
   */

  async function getSeasonHitting(playerId, season) {

    const response = await axios.get(
      `${MLB_API}/people/${playerId}/stats?stats=season&group=hitting&season=${season}`
    );

    return response.data.stats?.[0]?.splits?.[0]?.stat || null;
  }

  /*
   * ==========================================
   * SEASON PITCHING STATS
   * ==========================================
   */

  async function getSeasonPitching(playerId, season) {

    const response = await axios.get(
      `${MLB_API}/people/${playerId}/stats?stats=season&group=pitching&season=${season}`
    );

    return response.data.stats?.[0]?.splits?.[0]?.stat || null;
  }

  /*
   * ==========================================
   * MLB SEASON HITTING LEADERBOARD
   * ==========================================
   */

  async function getHittingLeaders(season, stat) {

    const response = await axios.get(
      `${MLB_API}/stats?stats=season&group=hitting&season=${season}&sportIds=1&limit=1000`
    );

    const splits = response.data.stats?.[0]?.splits || [];

    return splits
      .filter(x => x.stat && x.player)
      .map(x => ({
        player: x.player.fullName,
        playerId: x.player.id,
        team: x.team?.name || "",
        stat: x.stat
      }))
      .sort((a, b) => {
        return Number(b.stat[stat] || 0) - Number(a.stat[stat] || 0);
      });
  }

  /*
   * ==========================================
   * MLB SEASON PITCHING LEADERBOARD
   * ==========================================
   */

  async function getPitchingLeaders(season, stat) {

    const response = await axios.get(
      `${MLB_API}/stats?stats=season&group=pitching&season=${season}&sportIds=1&limit=1000`
    );

    const splits = response.data.stats?.[0]?.splits || [];

    return splits
      .filter(x => x.stat && x.player)
      .map(x => ({
        player: x.player.fullName,
        playerId: x.player.id,
        team: x.team?.name || "",
        stat: x.stat
      }))
      .sort((a, b) => {
        return Number(b.stat[stat] || 0) - Number(a.stat[stat] || 0);
      });
  }

  /*
   * ==========================================
   * QUESTION: LEAGUE LEADER
   * ==========================================
   */

  async function answerLeagueLeader(question) {

    const season = extractYear(question);
    const requestedStat = findRequestedStat(question);

    let stat = requestedStat;

    if (!stat) {
      if (/home run/i.test(question)) stat = "homeRuns";
      else if (/strikeout/i.test(question)) stat = "strikeOuts";
      else if (/hit/i.test(question)) stat = "hits";
      else if (/rbi/i.test(question)) stat = "rbi";
      else if (/stolen base|steals/i.test(question)) stat = "stolenBases";
      else if (/walk/i.test(question)) stat = "baseOnBalls";
      else if (/run/i.test(question)) stat = "runs";
      else if (/ops/i.test(question)) stat = "ops";
      else if (/average/i.test(question)) stat = "avg";
    }

    if (!stat) {
      return {
        type: "general",
        answer:
          `I need a statistic to determine the ${season} MLB leader.`
      };
    }

    const pitchingStats = [
      "ERA",
      "WHIP",
      "inningsPitched",
      "earnedRuns",
      "hitsAllowed",
      "K9",
      "BB9",
      "HR9"
    ];

    let leaders;

    if (pitchingStats.includes(stat)) {
      leaders = await getPitchingLeaders(season, stat);
    } else {
      leaders = await getHittingLeaders(season, stat);
    }

    if (!leaders.length) {
      return {
        type: "general",
        answer: `I couldn't find leaderboard data for ${season}.`
      };
    }

    const leader = leaders[0];

    return {
      type: "leader",
      question,
      season,
      statistic: stat,
      leader: leader.player,
      team: leader.team,
      value: leader.stat[stat],
      answer:
        `${leader.player} led MLB in ${formatStatName(stat)} in ${season} with ${leader.stat[stat]}.`
    };
  }

  /*
   * ==========================================
   * FORMAT STAT NAME
   * ==========================================
   */

  function formatStatName(stat) {

    const names = {
      homeRuns: "home runs",
      hits: "hits",
      runs: "runs",
      rbi: "RBIs",
      strikeOuts: "strikeouts",
      stolenBases: "stolen bases",
      baseOnBalls: "walks",
      avg: "batting average",
      obp: "on-base percentage",
      slg: "slugging percentage",
      ops: "OPS",
      ERA: "ERA",
      WHIP: "WHIP",
      inningsPitched: "innings pitched"
    };

    return names[stat] || stat;
  }

  /*
   * ==========================================
   * PLAYER SEASON QUESTION
   * ==========================================
   */

  async function answerPlayerSeasonQuestion(question) {

    const season = extractYear(question);

    let playerName = question
      .replace(/\bwhat\b/gi, "")
      .replace(/\bwas\b/gi, "")
      .replace(/\bwere\b/gi, "")
      .replace(/\bthe\b/gi, "")
      .replace(/\bin\b/gi, "")
      .replace(/\bfor\b/gi, "")
      .replace(/\bduring\b/gi, "")
      .replace(/\bseason\b/gi, "")
      .replace(/\b\d{4}\b/g, "")
      .replace(/\bhome runs?\b/gi, "")
      .replace(/\bhits?\b/gi, "")
      .replace(/\brbis?\b/gi, "")
      .replace(/\bops\b/gi, "")
      .replace(/\bera\b/gi, "")
      .replace(/\bwhip\b/gi, "")
      .replace(/\baverage\b/gi, "")
      .replace(/\bstrikeouts?\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    const player = await searchPlayer(playerName);

    if (!player) {
      return null;
    }

    const stat = findRequestedStat(question);

    const pitching = /\bera\b|\bwhip\b|pitching|pitcher|innings pitched/i.test(question);

    const seasonStats = pitching
      ? await getSeasonPitching(player.id, season)
      : await getSeasonHitting(player.id, season);

    if (!seasonStats) {
      return {
        type: "general",
        answer: `I couldn't find ${season} statistics for ${player.fullName}.`
      };
    }

    let value = seasonStats[stat];

    if (value === undefined && stat === "AVG") value = seasonStats.avg;
    if (value === undefined && stat === "OPS") value = seasonStats.ops;
    if (value === undefined && stat === "OBP") value = seasonStats.obp;
    if (value === undefined && stat === "SLG") value = seasonStats.slg;
    if (value === undefined && stat === "homeRuns") value = seasonStats.homeRuns;

    return {
      type: "season",
      player: player.fullName,
      season,
      statistic: stat,
      value,
      stats: seasonStats,
      answer:
        `${player.fullName had ${value ?? "no recorded value"} ${formatStatName(stat)} in ${season}.`
    };
  }

  /*
   * ==========================================
   * EXISTING LAST X GAMES ENGINE
   * ==========================================
   */

  async function getGameLogs(playerId, group, season) {

    const response = await axios.get(
      `${MLB_API}/people/${playerId}/stats?stats=gameLog&group=${group}&season=${season}`
    );

    return response.data.stats?.[0]?.splits || [];
  }

  /*
   * ==========================================
   * LAST 15 ENDPOINT
   * ==========================================
   */

  if (req.url.startsWith("/api/mlb/last15/")) {

    try {

      const playerId =
        req.url.replace("/api/mlb/last15/", "");

      const splits =
        await getGameLogs(
          playerId,
          "hitting",
          2026
        );

      const last15 =
        splits
          .sort(
            (a, b) =>
              new Date(a.date) -
              new Date(b.date)
          )
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

      const singles =
        hits -
        doubles -
        triples -
        homeRuns;

      const avg =
        atBats > 0
          ? hits / atBats
          : 0;

      const obpDenominator =
        atBats +
        walks +
        hitByPitch +
        sacrificeFlies;

      const obp =
        obpDenominator > 0
          ? (hits + walks + hitByPitch) /
            obpDenominator
          : 0;

      const slg =
        atBats > 0
          ? totalBases / atBats
          : 0;

      sendJSON(200, {

        playerId,
        games: last15.length,

        atBats,
        hits,
        singles,
        doubles,
        triples,
        homeRuns,
        walks,

        battingAverage:
          avg.toFixed(3),

        onBasePercentage:
          obp.toFixed(3),

        sluggingPercentage:
          slg.toFixed(3),

        OPS:
          (obp + slg).toFixed(3)
      });

      return;

    } catch (error) {

      console.error(error);

      sendJSON(500, {
        error:
          "Unable to calculate last 15 games."
      });

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

      const url = getURL();

      const question =
        url.searchParams.get("question");

      if (!question) {

        sendJSON(400, {
          error:
            "Please provide an MLB question."
        });

        return;
      }

      const q =
        cleanQuestion(question);

      /*
       * ========================================
       * QUESTION ROUTER
       * ========================================
       */

      const isLeader =
        isLeaderQuestion(q) &&
        !/\blast \d+ games?\b/i.test(q);

      const isAward =
        isAwardQuestion(q);

      const isHistorical =
        isHistoricalQuestion(q);

      const isTeam =
        isTeamQuestion(q);

      /*
       * LEADER QUESTIONS
       *
       * Examples:
       * Who led MLB in home runs in 2025?
       * Who had the most hits in 2024?
       */

      if (isLeader && !isHistorical && !isAward && !isTeam) {

        const result =
          await answerLeagueLeader(q);

        sendJSON(200, result);
        return;
      }

      /*
       * SIMPLE SEASON PLAYER QUESTIONS
       */

      if (
        !isLeader &&
        !isHistorical &&
        !isAward &&
        !isTeam &&
        /\b(19|20)\d{2}\b/.test(q)
      ) {

        const result =
          await answerPlayerSeasonQuestion(q);

        if (result) {
          sendJSON(200, result);
          return;
        }
      }

      /*
       * ========================================
       * EXISTING PLAYER / LAST X GAMES ENGINE
       * ========================================
       */

      const lastGamesMatch =
        q.match(
          /\b(?:last|past)\s+(\d+)\s+games?\b/i
        );

      const lastStartsMatch =
        q.match(
          /\b(?:last|past)\s+(\d+)\s+starts?\b/i
        );

      const numberOfGames =
        lastGamesMatch
          ? parseInt(lastGamesMatch[1])
          : lastStartsMatch
          ? parseInt(lastStartsMatch[1])
          : null;

      const requestedStat =
        findRequestedStat(q);

      let playerName = q;

      const cleanupPatterns = [

        /\bstats?\b/gi,

        /\b(?:in|over|for)\s+(?:his|their|the)?\s*(?:last|past)\s+\d+\s+games?\b/gi,

        /\b(?:in|over|for)\s+(?:his|their|the)?\s*(?:last|past)\s+\d+\s+starts?\b/gi,

        /\b(?:last|past)\s+\d+\s+games?\b/gi,

        /\b(?:last|past)\s+\d+\s+starts?\b/gi,

        /\bsince\s+[a-z]+\s+\d{1,2},?\s+\d{4}/gi
      ];

      for (const pattern of cleanupPatterns) {
        playerName =
          playerName.replace(pattern, "");
      }

      /*
       * Remove stat words
       */

      for (const stat of statPatterns) {

        for (const name of stat.names) {

          const escaped =
            name.replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&"
            );

          playerName =
            playerName.replace(
              new RegExp(
                `\\b${escaped}\\b`,
                "gi"
              ),
              ""
            );
        }
      }

      playerName =
        playerName
          .replace(/\bin\b/gi, "")
          .replace(/\bover\b/gi, "")
          .replace(/\bfor\b/gi, "")
          .replace(/\bhis\b/gi, "")
          .replace(/\btheir\b/gi, "")
          .replace(/\bthe\b/gi, "")
          .replace(/\s+/g, " ")
          .trim();

      if (!playerName) {

        sendJSON(400, {
          error:
            "I couldn't determine the player."
        });

        return;
      }

      const player =
        await searchPlayer(playerName);

      if (!player) {

        /*
         * IMPORTANT:
         * Do NOT return fake undefined
         * player cards anymore.
         */

        sendJSON(200, {
          type: "general",
          answer:
            `I couldn't identify a player in that question. Try asking the question with a specific player, team, season, record, or statistic.`
        });

        return;
      }

      /*
       * ========================================
       * PITCHING LAST X GAMES
       * ========================================
       */

      const isPitchingQuestion =
        requestedStat === "inningsPitched" ||
        requestedStat === "earnedRuns" ||
        requestedStat === "hitsAllowed" ||
        requestedStat === "ERA" ||
        requestedStat === "WHIP" ||
        requestedStat === "K9" ||
        requestedStat === "BB9" ||
        requestedStat === "HR9" ||
        /\b(pitching|pitcher|era|whip)\b/i.test(q);

      if (isPitchingQuestion) {

        const seasons =
          [2024, 2025, 2026];

        let games = [];

        for (const season of seasons) {

          const seasonGames =
            await getGameLogs(
              player.id,
              "pitching",
              season
            );

          games.push(...seasonGames);
        }

        games =
          games.sort(
            (a, b) =>
              new Date(a.date) -
              new Date(b.date)
          );

        if (numberOfGames !== null) {
          games =
            games.slice(-numberOfGames);
        } else {
          games =
            games.filter(
              g =>
                g.date?.startsWith("2026")
            );
        }

        let ip = 0;
        let er = 0;
        let hits = 0;
        let bb = 0;
        let k = 0;
        let hr = 0;

        for (const game of games) {

          const stat = game.stat;

          const value =
            stat.inningsPitched || "0.0";

          const parts =
            value.split(".");

          ip +=
            parseInt(parts[0]) || 0;

          const outs =
            parseInt(parts[1]) || 0;

          if (outs === 1) {
            ip += 1 / 3;
          }

          if (outs === 2) {
            ip += 2 / 3;
          }

          er +=
            stat.earnedRuns || 0;

          hits +=
            stat.hits || 0;

          bb +=
            stat.baseOnBalls || 0;

          k +=
            stat.strikeOuts || 0;

          hr +=
            stat.homeRuns || 0;
        }

        const era =
          ip > 0
            ? er * 9 / ip
            : 0;

        const whip =
          ip > 0
            ? (bb + hits) / ip
            : 0;

        sendJSON(200, {

          type: "pitching",

          player:
            player.fullName,

          games:
            games.length,

          inningsPitched:
            ip.toFixed(1),

          earnedRuns:
            er,

          hitsAllowed:
            hits,

          walks:
            bb,

          strikeOuts:
            k,

          homeRuns:
            hr,

          ERA:
            era.toFixed(2),

          WHIP:
            whip.toFixed(2),

          K9:
            ip > 0
              ? (k * 9 / ip).toFixed(2)
              : "—",

          BB9:
            ip > 0
              ? (bb * 9 / ip).toFixed(2)
              : "—",

          HR9:
            ip > 0
              ? (hr * 9 / ip).toFixed(2)
              : "—"
        });

        return;
      }

      /*
       * ========================================
       * HITTING LAST X GAMES
       * ========================================
       */

      let games = [];

      for (const season of [2024, 2025, 2026]) {

        const seasonGames =
          await getGameLogs(
            player.id,
            "hitting",
            season
          );

        games.push(...seasonGames);
      }

      games =
        games.sort(
          (a, b) =>
            new Date(a.date) -
            new Date(b.date)
        );

      if (numberOfGames !== null) {

        games =
          games.slice(-numberOfGames);

      } else {

        games =
          games.filter(
            game =>
              game.date?.startsWith("2026")
          );
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
      let stolenBases = 0;
      let caughtStealing = 0;
      let hitByPitch = 0;
      let sacrificeFlies = 0;
      let totalBases = 0;

      for (const game of games) {

        const stat = game.stat;

        atBats +=
          stat.atBats || 0;

        hits +=
          stat.hits || 0;

        runs +=
          stat.runs || 0;

        doubles +=
          stat.doubles || 0;

        triples +=
          stat.triples || 0;

        homeRuns +=
          stat.homeRuns || 0;

        rbi +=
          stat.rbi || 0;

        walks +=
          stat.baseOnBalls || 0;

        strikeOuts +=
          stat.strikeOuts || 0;

        stolenBases +=
          stat.stolenBases || 0;

        caughtStealing +=
          stat.caughtStealing || 0;

        hitByPitch +=
          stat.hitByPitch || 0;

        sacrificeFlies +=
          stat.sacFlies || 0;

        totalBases +=
          stat.totalBases || 0;
      }

      const singles =
        hits -
        doubles -
        triples -
        homeRuns;

      const avg =
        atBats > 0
          ? hits / atBats
          : 0;

      const obpDenominator =
        atBats +
        walks +
        hitByPitch +
        sacrificeFlies;

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

      const PA =
        atBats +
        walks +
        hitByPitch +
        sacrificeFlies;

      const bbPercent =
        PA > 0
          ? walks / PA
          : 0;

      const kPercent =
        PA > 0
          ? strikeOuts / PA
          : 0;

      const iso =
        slg - avg;

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

      sendJSON(200, {

        type: "hitting",

        question,

        player:
          player.fullName,

        games:
          games.length,

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
          avg.toFixed(3),

        onBasePercentage:
          obp.toFixed(3),

        sluggingPercentage:
          slg.toFixed(3),

        OPS:
          ops.toFixed(3),

        BBPercent:
          (bbPercent * 100).toFixed(1),

        KPercent:
          (kPercent * 100).toFixed(1),

        ISO:
          iso.toFixed(3),

        BABIP:
          babip.toFixed(3)
      });

      return;

    } catch (error) {

      console.error(
        "MLB query error:",
        error.response?.data ||
        error.message
      );

      if (!res.headersSent) {

        sendJSON(500, {
          error:
            "Unable to process MLB question."
        });
      }

      return;
    }
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
          req.url.replace(
            "/api/mlb/player/",
            ""
          )
        );

      const response =
        await axios.get(
          `${MLB_API}/people/search?names=${encodeURIComponent(playerName)}`
        );

      sendJSON(200, response.data);

    } catch (error) {

      sendJSON(500, {
        error:
          "Unable to search for MLB player."
      });
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

      const response =
        await axios.get(
          `${MLB_API}/teams?sportId=1`
        );

      sendJSON(200, response.data);

    } catch (error) {

      sendJSON(500, {
        error:
          "Unable to retrieve MLB teams."
      });
    }

    return;
  }

  /*
   * ==========================================
   * GAME LOGS
   * ==========================================
   */

  if (req.url.startsWith("/api/mlb/games/")) {

    try {

      const playerId =
        req.url.replace(
          "/api/mlb/games/",
          ""
        );

      const response =
        await axios.get(
          `${MLB_API}/people/${playerId}/stats?stats=gameLog&group=hitting&season=2026`
        );

      sendJSON(200, response.data);

    } catch (error) {

      sendJSON(500, {
        error:
          "Unable to retrieve MLB game logs."
      });
    }

    return;
  }

  /*
   * ==========================================
   * DEFAULT
   * ==========================================
   */

  sendJSON(200, {
    message:
      "MLB Research Engine backend is working!"
  });
});

server.listen(PORT, () => {

  console.log(
    `MLB Research Engine running on port ${PORT}`
  );

});
