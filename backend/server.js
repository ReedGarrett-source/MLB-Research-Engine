const http = require("http");
const axios = require("axios");

const MLB_API = "https://statsapi.mlb.com/api/v1";
const SAVANT_CSV = "https://baseballsavant.mlb.com/leaderboard/custom";

const CURRENT_SEASON = 2026;
const CACHE = new Map();
const CACHE_TIME = 5 * 60 * 1000;

/* =========================================================
   BASIC HELPERS
========================================================= */

function send(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  });

  res.end(JSON.stringify(data));
}

async function get(url, options = {}) {
  const cacheKey = url;

  if (!options.noCache && CACHE.has(cacheKey)) {
    const cached = CACHE.get(cacheKey);

    if (Date.now() - cached.time < CACHE_TIME) {
      return cached.data;
    }

    CACHE.delete(cacheKey);
  }

  const response = await axios.get(url, {
    timeout: 30000
  });

  if (!options.noCache) {
    CACHE.set(cacheKey, {
      time: Date.now(),
      data: response.data
    });
  }

  return response.data;
}

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function cleanQuestion(question) {
  return question
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[?!.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatRate(value, decimals = 3) {
  return Number(value || 0).toFixed(decimals);
}

/* =========================================================
   PLAYER SEARCH
========================================================= */

async function findPlayer(name) {
  const response = await get(
    `${MLB_API}/people/search?names=${encodeURIComponent(name)}`
  );

  return response.people?.[0] || null;
}

async function getPlayerStats(playerId, season, group, stats = "season") {
  const response = await get(
    `${MLB_API}/people/${playerId}/stats?stats=${stats}&group=${group}&season=${season}`
  );

  return response.stats?.[0]?.splits || [];
}

async function getCareerStats(playerId, group) {
  const response = await get(
    `${MLB_API}/people/${playerId}/stats?stats=career&group=${group}`
  );

  return response.stats?.[0]?.splits || [];
}

/* =========================================================
   STAT ALIASES
========================================================= */

const STAT_ALIASES = [
  ["OPS", ["ops"]],
  ["AVG", ["avg", "average", "batting average"]],
  ["OBP", ["obp", "on base percentage", "on-base percentage"]],
  ["SLG", ["slg", "slugging percentage"]],

  ["homeRuns", ["home runs", "home run", "hr", "hrs", "homer", "homers"]],
  ["hits", ["hits", "hit"]],
  ["runs", ["runs", "run"]],
  ["rbi", ["rbi", "rbis", "runs batted in"]],
  ["walks", ["walks", "walk", "bb"]],
  ["strikeOuts", ["strikeouts", "strikeout", "ks", "k"]],
  ["stolenBases", ["stolen bases", "stolen base", "steals", "steal", "sb"]],
  ["caughtStealing", ["caught stealing", "cs"]],
  ["atBats", ["at bats", "at-bats", "ab"]],
  ["doubles", ["doubles", "double", "2b"]],
  ["triples", ["triples", "triple", "3b"]],

  ["inningsPitched", ["innings pitched", "innings", "ip"]],
  ["earnedRuns", ["earned runs", "earned run", "er"]],
  ["hitsAllowed", ["hits allowed"]],
  ["ERA", ["era"]],
  ["WHIP", ["whip"]],

  ["BBPercent", ["bb%", "bb percent", "walk rate", "walk percentage"]],
  ["KPercent", ["k%", "k percent", "strikeout rate", "strikeout percentage"]],
  ["ISO", ["iso", "isolated power"]],
  ["BABIP", ["babip"]],

  ["K9", ["k/9", "k per 9", "strikeouts per 9"]],
  ["BB9", ["bb/9", "bb per 9", "walks per 9"]],
  ["HR9", ["hr/9", "hr per 9", "home runs per 9"]],

  ["exitVelocity", [
    "exit velocity",
    "exit velo",
    "average exit velocity",
    "avg exit velocity",
    "ev"
  ]],

  ["hardHitPercent", [
    "hard hit",
    "hard hit percentage",
    "hard hit rate"
  ]],

  ["barrelPercent", [
    "barrel percentage",
    "barrel rate",
    "barrels"
  ]],

  ["launchAngle", [
    "launch angle"
  ]],

  ["xBA", ["xba", "expected batting average"]],
  ["xSLG", ["xslg", "expected slugging"]],
  ["xwOBA", ["xwoba", "expected woba"]],

  ["pitchVelocity", [
    "pitch velocity",
    "velocity",
    "fastball velocity",
    "fastball speed"
  ]],

  ["spinRate", [
    "spin rate",
    "spin"
  ]],

  ["whiffPercent", [
    "whiff rate",
    "whiff percentage"
  ]],

  ["chasePercent", [
    "chase rate",
    "chase percentage"
  ]]
];

function detectStat(question) {
  for (const [key, aliases] of STAT_ALIASES) {
    for (const alias of aliases) {
      const escaped = alias.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      if (
        new RegExp(`\\b${escaped}\\b`, "i").test(question)
      ) {
        return {
          key,
          text: alias
        };
      }
    }
  }

  return null;
}

/* =========================================================
   DATE / SEASON DETECTION
========================================================= */

function detectSeason(question) {
  const yearMatch = question.match(
    /\b(18|19|20)\d{2}\b/
  );

  if (yearMatch) {
    return Number(yearMatch[0]);
  }

  if (/\blast season\b/i.test(question)) {
    return CURRENT_SEASON - 1;
  }

  if (/\bthis season\b/i.test(question)) {
    return CURRENT_SEASON;
  }

  return null;
}

function detectLastGames(question) {
  const match = question.match(
    /\b(?:last|past)\s+(\d+)\s+games?\b/i
  );

  return match ? Number(match[1]) : null;
}

function detectLastStarts(question) {
  const match = question.match(
    /\b(?:last|past)\s+(\d+)\s+starts?\b/i
  );

  return match ? Number(match[1]) : null;
}

function detectSinceDate(question) {
  const match = question.match(
    /\bsince\s+([a-z]+\s+\d{1,2},?\s+\d{4})/i
  );

  if (!match) {
    return null;
  }

  const date = new Date(match[1]);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

/* =========================================================
   GAME LOG AGGREGATION
========================================================= */

function aggregateHittingGames(games) {
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
    const s = game.stat || {};

    atBats += number(s.atBats);
    hits += number(s.hits);
    runs += number(s.runs);
    doubles += number(s.doubles);
    triples += number(s.triples);
    homeRuns += number(s.homeRuns);
    rbi += number(s.rbi);
    walks += number(s.baseOnBalls);
    strikeOuts += number(s.strikeOuts);
    hitByPitch += number(s.hitByPitch);
    sacrificeFlies += number(s.sacFlies);
    stolenBases += number(s.stolenBases);
    caughtStealing += number(s.caughtStealing);
    totalBases += number(s.totalBases);
  }

  const singles =
    hits -
    doubles -
    triples -
    homeRuns;

  const PA =
    atBats +
    walks +
    hitByPitch +
    sacrificeFlies;

  const AVG =
    atBats > 0
      ? hits / atBats
      : 0;

  const OBP =
    PA > 0
      ? (hits + walks + hitByPitch) / PA
      : 0;

  const SLG =
    atBats > 0
      ? totalBases / atBats
      : 0;

  const OPS = OBP + SLG;

  const ISO = SLG - AVG;

  const BABIPDenominator =
    atBats -
    strikeOuts -
    homeRuns +
    sacrificeFlies;

  const BABIP =
    BABIPDenominator > 0
      ? (hits - homeRuns) /
        BABIPDenominator
      : 0;

  return {
    games: games.length,
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
    hitByPitch,
    sacrificeFlies,
    stolenBases,
    caughtStealing,

    battingAverage: formatRate(AVG),
    onBasePercentage: formatRate(OBP),
    sluggingPercentage: formatRate(SLG),
    OPS: formatRate(OPS),

    PA,
    BBPercent: PA > 0
      ? ((walks / PA) * 100).toFixed(1)
      : "0.0",

    KPercent: PA > 0
      ? ((strikeOuts / PA) * 100).toFixed(1)
      : "0.0",

    ISO: formatRate(ISO),
    BABIP: formatRate(BABIP)
  };
}

function aggregatePitchingGames(games) {
  let inningsPitched = 0;
  let earnedRuns = 0;
  let hitsAllowed = 0;
  let walks = 0;
  let strikeOuts = 0;
  let homeRuns = 0;
  let battersFaced = 0;

  for (const game of games) {
    const s = game.stat || {};

    const ip = String(s.inningsPitched || "0.0");
    const parts = ip.split(".");

    inningsPitched +=
      Number(parts[0]) || 0;

    const outs =
      Number(parts[1]) || 0;

    if (outs === 1) {
      inningsPitched += 1 / 3;
    }

    if (outs === 2) {
      inningsPitched += 2 / 3;
    }

    earnedRuns += number(s.earnedRuns);
    hitsAllowed += number(s.hits);
    walks += number(s.baseOnBalls);
    strikeOuts += number(s.strikeOuts);
    homeRuns += number(s.homeRuns);
    battersFaced += number(s.battersFaced);
  }

  const ERA =
    inningsPitched > 0
      ? earnedRuns * 9 / inningsPitched
      : 0;

  const WHIP =
    inningsPitched > 0
      ? (walks + hitsAllowed) / inningsPitched
      : 0;

  const K9 =
    inningsPitched > 0
      ? strikeOuts * 9 / inningsPitched
      : 0;

  const BB9 =
    inningsPitched > 0
      ? walks * 9 / inningsPitched
      : 0;

  const HR9 =
    inningsPitched > 0
      ? homeRuns * 9 / inningsPitched
      : 0;

  return {
    games: games.length,
    inningsPitched: inningsPitched.toFixed(1),
    earnedRuns,
    hitsAllowed,
    walks,
    strikeOuts,
    homeRuns,

    ERA: ERA.toFixed(2),
    WHIP: WHIP.toFixed(2),

    K9: K9.toFixed(2),
    BB9: BB9.toFixed(2),
    HR9: HR9.toFixed(2),

    KPercent:
      battersFaced > 0
        ? ((strikeOuts / battersFaced) * 100).toFixed(1)
        : "0.0",

    BBPercent:
      battersFaced > 0
        ? ((walks / battersFaced) * 100).toFixed(1)
        : "0.0"
  };
}

/* =========================================================
   PLAYER GAME LOG QUERY
========================================================= */

async function playerGameLogQuery(
  player,
  question,
  pitching = false
) {
  const lastGames = detectLastGames(question);
  const lastStarts = detectLastStarts(question);
  const sinceDate = detectSinceDate(question);

  const seasons = [];

  /*
   * Fetch enough seasons for historical-looking
   * player questions.
   */
  const requestedSeason = detectSeason(question);

  if (requestedSeason) {
    seasons.push(requestedSeason);
  } else {
    seasons.push(2024, 2025, 2026);
  }

  let games = [];

  for (const season of seasons) {
    const group =
      pitching
        ? "pitching"
        : "hitting";

    const splits = await getPlayerStats(
      player.id,
      season,
      group,
      "gameLog"
    );

    games.push(...splits);
  }

  games.sort(
    (a, b) =>
      new Date(a.date) -
      new Date(b.date)
  );

  if (sinceDate) {
    games = games.filter(
      game =>
        new Date(game.date) >= sinceDate
    );
  }

  if (lastGames !== null) {
    games = games.slice(-lastGames);
  }

  if (lastStarts !== null) {
    games = games.slice(-lastStarts);
  }

  const result =
    pitching
      ? aggregatePitchingGames(games)
      : aggregateHittingGames(games);

  return {
    player: player.fullName,
    playerId: player.id,
    question,
    ...result
  };
}

/* =========================================================
   SEASON STATS
========================================================= */

async function getSeasonHitting(playerId, season) {
  const splits = await getPlayerStats(
    playerId,
    season,
    "hitting",
    "season"
  );

  return splits[0]?.stat || null;
}

async function getSeasonPitching(playerId, season) {
  const splits = await getPlayerStats(
    playerId,
    season,
    "pitching",
    "season"
  );

  return splits[0]?.stat || null;
}

async function playerSeasonQuery(player, season) {
  const hitting = await getSeasonHitting(
    player.id,
    season
  );

  const pitching = await getSeasonPitching(
    player.id,
    season
  );

  return {
    player: player.fullName,
    playerId: player.id,
    season,
    hitting,
    pitching
  };
}

/* =========================================================
   CAREER STATS
========================================================= */

async function playerCareerQuery(player) {
  const hitting = await getCareerStats(
    player.id,
    "hitting"
  );

  const pitching = await getCareerStats(
    player.id,
    "pitching"
  );

  return {
    player: player.fullName,
    playerId: player.id,
    hitting: hitting[0]?.stat || null,
    pitching: pitching[0]?.stat || null
  };
}

/* =========================================================
   LEAGUE LEADERS
========================================================= */

async function leagueLeaders(season, stat, group = "hitting") {
  const response = await get(
    `${MLB_API}/stats?stats=season&group=${group}&season=${season}&sportIds=1&limit=1000`
  );

  const splits = response.stats?.[0]?.splits || [];

  const mapped = splits.map(split => ({
    player: split.player?.fullName,
    playerId: split.player?.id,
    team: split.team?.name,
    stat: split.stat
  }));

  return mapped;
}

/* =========================================================
   TEAM DATA
========================================================= */

async function getTeams() {
  const response = await get(
    `${MLB_API}/teams?sportId=1`
  );

  return response.teams || [];
}

async function findTeam(name) {
  const teams = await getTeams();

  const normalized =
    name.toLowerCase().trim();

  return teams.find(team =>
    team.name.toLowerCase() === normalized ||
    team.teamName?.toLowerCase() === normalized ||
    team.abbreviation?.toLowerCase() === normalized ||
    team.clubName?.toLowerCase() === normalized
  ) || teams.find(team =>
    team.name
      .toLowerCase()
      .includes(normalized)
  );
}

async function teamSeasonStats(teamId, season) {
  const response = await get(
    `${MLB_API}/teams/${teamId}/stats?stats=season&season=${season}`
  );

  return response.stats?.[0]?.splits || [];
}

/* =========================================================
   STANDINGS
========================================================= */

async function getStandings(season) {
  const response = await get(
    `${MLB_API}/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason`
  );

  const records = response.records || [];

  return records.flatMap(record =>
    (record.teamRecords || []).map(team => ({
      team: team.team?.name,
      teamId: team.team?.id,
      wins: team.wins,
      losses: team.losses,
      winningPercentage: team.winningPercentage,
      gamesBack: team.gamesBack
    }))
  );
}

/* =========================================================
   SCHEDULE / GAMES
========================================================= */

async function getSchedule(season, teamId = null) {
  let url =
    `${MLB_API}/schedule?sportId=1&season=${season}&gameTypes=R`;

  if (teamId) {
    url += `&teamId=${teamId}`;
  }

  const response = await get(url);

  return response.dates || [];
}

/* =========================================================
   AWARDS
========================================================= */

async function getAwards(playerId = null) {
  let url =
    `${MLB_API}/awards`;

  if (playerId) {
    url += `?playerId=${playerId}`;
  }

  return await get(url);
}

/* =========================================================
   HISTORICAL / RECORD ENGINE
========================================================= */

function looksHistorical(question) {
  return (
    /\b(last|first|most|fewest|highest|lowest|ever|history|historical|consecutive|straight|streak|record|records|since|before|after)\b/i.test(question) ||
    /\b(rookie|mvp|cy young|rookie of the year|gold glove|silver slugger)\b/i.test(question)
  );
}

function looksLeagueQuestion(question) {
  return (
    /\b(mlb|league|american league|national league)\b/i.test(question) &&
    !/\b(my|his|her|their)\b/i.test(question)
  );
}

function looksTeamQuestion(question) {
  return /\b(team|teams|mets|yankees|dodgers|braves|phillies|red sox|cubs|cardinals)\b/i.test(
    question
  );
}

/*
 * Handles season leader style questions.
 */
async function answerLeaderQuestion(question) {
  const season =
    detectSeason(question) ||
    CURRENT_SEASON;

  let group = "hitting";
  let statKey = "homeRuns";

  if (/\b(era|whip|pitcher|pitching|strikeouts per 9)\b/i.test(question)) {
    group = "pitching";
  }

  if (/\bops\b/i.test(question)) {
    statKey = "ops";
  } else if (/\b(avg|average|batting average)\b/i.test(question)) {
    statKey = "avg";
  } else if (/\bobp\b/i.test(question)) {
    statKey = "obp";
  } else if (/\bslg\b/i.test(question)) {
    statKey = "slg";
  } else if (/\bhits?\b/i.test(question)) {
    statKey = "hits";
  } else if (/\brbi\b/i.test(question)) {
    statKey = "rbi";
  } else if (/\bruns?\b/i.test(question)) {
    statKey = "runs";
  } else if (/\bstolen bases?\b/i.test(question)) {
    statKey = "stolenBases";
  } else if (/\bstrikeouts?\b/i.test(question)) {
    statKey = "strikeOuts";
  } else if (/\bera\b/i.test(question)) {
    statKey = "era";
  } else if (/\bwhip\b/i.test(question)) {
    statKey = "whip";
  }

  const rows =
    await leagueLeaders(
      season,
      statKey,
      group
    );

  const values = rows
    .map(row => ({
      ...row,
      value: number(row.stat?.[statKey])
    }))
    .filter(row =>
      Number.isFinite(row.value)
    )
    .sort((a, b) =>
      b.value - a.value
    );

  return {
    type: "leaderboard",
    season,
    stat: statKey,
    group,
    leaders: values.slice(0, 25)
  };
}

/* =========================================================
   STATCAST
========================================================= */

/*
 * Baseball Savant provides Statcast Search and CSV data.
 *
 * This function is intentionally isolated because Statcast
 * queries use different parameters from the MLB Stats API.
 *
 * We can expand this list without touching the rest of
 * the MLB engine.
 */

const STATCAST_METRICS = {
  "exit velocity": "exit_velocity_avg",
  "exit velo": "exit_velocity_avg",
  "hard hit": "hard_hit_percent",
  "barrel rate": "barrel_batted_rate",
  "barrel percentage": "barrel_batted_rate",
  "launch angle": "launch_angle",
  "xba": "xba",
  "xslg": "xslg",
  "xwoba": "xwoba",
  "whiff rate": "whiff_percent",
  "pitch velocity": "velocity",
  "spin rate": "spin_rate"
};

function detectStatcastMetric(question) {
  for (const phrase of Object.keys(STATCAST_METRICS)) {
    if (
      question.includes(phrase)
    ) {
      return {
        phrase,
        metric: STATCAST_METRICS[phrase]
      };
    }
  }

  return null;
}

/*
 * Statcast queries are kept separate from the normal
 * MLB Stats API because Savant exposes these metrics
 * through its Statcast Search/CSV system.
 */
async function statcastQuery(question) {
  const metric =
    detectStatcastMetric(question);

  const season =
    detectSeason(question) ||
    CURRENT_SEASON;

  return {
    type: "statcast",
    season,
    metric: metric?.metric || null,
    metricName: metric?.phrase || null,
    message:
      "Statcast query recognized. Baseball Savant Statcast data is available for this metric; the next expansion can map this question directly to the appropriate Savant CSV query."
  };
}

/* =========================================================
   COMPARISON ENGINE
========================================================= */

function detectTwoPlayers(question) {
  /*
   * Supports:
   *
   * "Judge vs Soto"
   * "Judge compared to Soto"
   * "Judge or Soto"
   */

  const patterns = [
    /\b(.+?)\s+vs\.?\s+(.+?)\b/i,
    /\b(.+?)\s+versus\s+(.+?)\b/i,
    /\b(.+?)\s+compared\s+to\s+(.+?)\b/i,
    /\b(.+?)\s+or\s+(.+?)\b/i
  ];

  for (const pattern of patterns) {
    const match =
      question.match(pattern);

    if (match) {
      return [
        match[1].trim(),
        match[2].trim()
      ];
    }
  }

  return null;
}

async function comparisonQuery(question) {
  const players =
    detectTwoPlayers(question);

  if (!players) {
    return null;
  }

  const playerA =
    await findPlayer(players[0]);

  const playerB =
    await findPlayer(players[1]);

  if (!playerA || !playerB) {
    return null;
  }

  const season =
    detectSeason(question) ||
    CURRENT_SEASON;

  const [a, b] =
    await Promise.all([
      playerSeasonQuery(
        playerA,
        season
      ),
      playerSeasonQuery(
        playerB,
        season
      )
    ]);

  return {
    type: "comparison",
    season,
    players: [a, b]
  };
}

/* =========================================================
   PLAYER QUESTION ENGINE
========================================================= */

async function answerPlayerQuestion(
  question
) {
  const stat =
    detectStat(question);

  /*
   * Find likely player name by removing
   * obvious question language.
   */

  let playerName =
    question;

  const removePatterns = [
    /\bwhat\b/gi,
    /\bwas\b/gi,
    /\bis\b/gi,
    /\bwere\b/gi,
    /\bthe\b/gi,
    /\bhis\b/gi,
    /\bher\b/gi,
    /\btheir\b/gi,
    /\bseason\b/gi,
    /\bcareer\b/gi,
    /\bstats?\b/gi,
    /\bstatistics?\b/gi,
    /\bin\b/gi,
    /\bover\b/gi,
    /\bfor\b/gi,
    /\blast\b/gi,
    /\bpast\b/gi,
    /\bgames?\b/gi,
    /\bstarts?\b/gi,
    /\bsince\b/gi
  ];

  for (const pattern of removePatterns) {
    playerName =
      playerName.replace(
        pattern,
        " "
      );
  }

  if (stat?.text) {
    playerName =
      playerName.replace(
        new RegExp(
          stat.text.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          ),
          "ig"
        ),
        " "
      );
  }

  playerName =
    playerName
      .replace(/\b\d+\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  /*
   * Don't attempt player lookup if this clearly
   * isn't a player question.
   */

  if (!playerName) {
    return null;
  }

  const player =
    await findPlayer(playerName);

  if (!player) {
    return null;
  }

  const season =
    detectSeason(question);

  const lastGames =
    detectLastGames(question);

  const lastStarts =
    detectLastStarts(question);

  const pitching =
    /\b(pitcher|pitching|era|whip|innings pitched|k\/9|bb\/9|hr\/9)\b/i.test(
      question
    );

  /*
   * Game-log questions.
   */

  if (
    lastGames !== null ||
    lastStarts !== null ||
    detectSinceDate(question)
  ) {
    return await playerGameLogQuery(
      player,
      question,
      pitching
    );
  }

  /*
   * Explicit season question.
   */

  if (
    season ||
    /\b(2026|2025|2024|2023|2022|2021|2020)\b/.test(
      question
    )
  ) {
    return await playerSeasonQuery(
      player,
      season || CURRENT_SEASON
    );
  }

  /*
   * Career question.
   */

  if (
    /\bcareer\b/i.test(question)
  ) {
    return await playerCareerQuery(
      player
    );
  }

  /*
   * Default to current season.
   */

  return await playerSeasonQuery(
    player,
    CURRENT_SEASON
  );
}

/* =========================================================
   MAIN QUESTION ROUTER
========================================================= */

async function answerQuestion(question) {
  const q =
    cleanQuestion(question);

  /*
   * STATCAST FIRST
   */

  if (
    detectStatcastMetric(q) ||
    /\b(statcast|barrel|exit velocity|launch angle|xwoba|xslg|xba|whiff rate|spin rate)\b/i.test(q)
  ) {
    return await statcastQuery(q);
  }

  /*
   * PLAYER COMPARISON
   */

  const comparison =
    await comparisonQuery(q);

  if (comparison) {
    return comparison;
  }

  /*
   * HISTORICAL / LEAGUE LEADER QUESTIONS
   */

  if (
    /\b(who led|who had the most|who had the highest|league leader|mlb leader|led mlb|led the league)\b/i.test(q)
  ) {
    return await answerLeaderQuestion(
      q
    );
  }

  /*
   * TEAM QUESTIONS
   */

  if (
    looksTeamQuestion(q) &&
    /\b(record|wins|losses|standings|schedule|games|season)\b/i.test(q)
  ) {
    const season =
      detectSeason(q) ||
      CURRENT_SEASON;

    const teams =
      await getTeams();

    const found =
      teams.find(team =>
        q.includes(
          team.name
            .toLowerCase()
        )
      );

    if (found) {
      const standings =
        await getStandings(
          season
        );

      const teamStanding =
        standings.find(
          t =>
            t.teamId ===
            found.id
        );

      return {
        type: "team",
        season,
        team: found.name,
        teamId: found.id,
        standings:
          teamStanding || null
      };
    }
  }

  /*
   * GENERAL LEAGUE LEADER QUESTIONS
   */

  if (
    looksLeagueQuestion(q) &&
    (
      /\bmost\b/i.test(q) ||
      /\bhighest\b/i.test(q) ||
      /\bled\b/i.test(q)
    )
  ) {
    return await answerLeaderQuestion(
      q
    );
  }

  /*
   * PLAYER QUESTIONS
   */

  const playerAnswer =
    await answerPlayerQuestion(q);

  if (playerAnswer) {
    return playerAnswer;
  }

  /*
   * FALLBACK
   */

  return {
    type: "unknown",
    question,
    message:
      "I couldn't confidently determine what type of MLB question this is yet."
  };
}

/* =========================================================
   HTTP SERVER
========================================================= */

const server =
  http.createServer(
    async (req, res) => {

      res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
      );

      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, OPTIONS"
      );

      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type"
      );

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      try {

        /* =================================================
           MAIN QUESTION ENDPOINT
        ================================================= */

        if (
          req.url.startsWith(
            "/api/mlb/query"
          )
        ) {

          const url =
            new URL(
              req.url,
              `http://${req.headers.host}`
            );

          const question =
            url.searchParams.get(
              "question"
            );

          if (!question) {
            send(
              res,
              400,
              {
                error:
                  "Please provide an MLB question."
              }
            );

            return;
          }

          const result =
            await answerQuestion(
              question
            );

          send(
            res,
            200,
            {
              question,
              ...result
            }
          );

          return;
        }


        /* =================================================
           PLAYER SEARCH
        ================================================= */

        if (
          req.url.startsWith(
            "/api/mlb/player/"
          )
        ) {

          const playerName =
            decodeURIComponent(
              req.url.replace(
                "/api/mlb/player/",
                ""
              )
            );

          const response =
            await get(
              `${MLB_API}/people/search?names=${encodeURIComponent(
                playerName
              )}`
            );

          send(
            res,
            200,
            response
          );

          return;
        }


        /* =================================================
           TEAMS
        ================================================= */

        if (
          req.url ===
          "/api/mlb/teams"
        ) {

          send(
            res,
            200,
            {
              teams:
                await getTeams()
            }
          );

          return;
        }


        /* =================================================
           STANDINGS
        ================================================= */

        if (
          req.url.startsWith(
            "/api/mlb/standings"
          )
        ) {

          const url =
            new URL(
              req.url,
              `http://${req.headers.host}`
            );

          const season =
            Number(
              url.searchParams.get(
                "season"
              )
            ) ||
            CURRENT_SEASON;

          send(
            res,
            200,
            {
              season,
              standings:
                await getStandings(
                  season
                )
            }
          );

          return;
        }


        /* =================================================
           LEAGUE LEADERS
        ================================================= */

        if (
          req.url.startsWith(
            "/api/mlb/leaders"
          )
        ) {

          const url =
            new URL(
              req.url,
              `http://${req.headers.host}`
            );

          const season =
            Number(
              url.searchParams.get(
                "season"
              )
            ) ||
            CURRENT_SEASON;

          const group =
            url.searchParams.get(
              "group"
            ) ||
            "hitting";

          const leaders =
            await leagueLeaders(
              season,
              null,
              group
            );

          send(
            res,
            200,
            {
              season,
              group,
              leaders
            }
          );

          return;
        }


        /* =================================================
           PLAYER SEASON
        ================================================= */

        if (
          req.url.startsWith(
            "/api/mlb/player-season/"
          )
        ) {

          const url =
            new URL(
              req.url,
              `http://${req.headers.host}`
            );

          const playerName =
            decodeURIComponent(
              req.url
                .split("/api/mlb/player-season/")[1]
                ?.split("?")[0] || ""
            );

          const season =
            Number(
              url.searchParams.get(
                "season"
              )
            ) ||
            CURRENT_SEASON;

          const player =
            await findPlayer(
              playerName
            );

          if (!player) {
            send(
              res,
              404,
              {
                error:
                  `Could not find MLB player: ${playerName}`
              }
            );

            return;
          }

          send(
            res,
            200,
            await playerSeasonQuery(
              player,
              season
            )
          );

          return;
        }


        /* =================================================
           PLAYER CAREER
        ================================================= */

        if (
          req.url.startsWith(
            "/api/mlb/player-career/"
          )
        ) {

          const playerName =
            decodeURIComponent(
              req.url.replace(
                "/api/mlb/player-career/",
                ""
              )
            );

          const player =
            await findPlayer(
              playerName
            );

          if (!player) {
            send(
              res,
              404,
              {
                error:
                  `Could not find MLB player: ${playerName}`
              }
            );

            return;
          }

          send(
            res,
            200,
            await playerCareerQuery(
              player
            )
          );

          return;
        }


        /* =================================================
           STATCAST
        ================================================= */

        if (
          req.url.startsWith(
            "/api/mlb/statcast"
          )
        ) {

          const url =
            new URL(
              req.url,
              `http://${req.headers.host}`
            );

          const question =
            url.searchParams.get(
              "question"
            ) || "";

          send(
            res,
            200,
            await statcastQuery(
              cleanQuestion(
                question
              )
            )
          );

          return;
        }


        /* =================================================
           HEALTH CHECK
        ================================================= */

        send(
          res,
          200,
          {
            message:
              "MLB Research Engine backend is working!",
            season:
              CURRENT_SEASON,
            capabilities: [
              "player stats",
              "game logs",
              "season stats",
              "career stats",
              "league leaders",
              "team standings",
              "team data",
              "comparisons",
              "historical question routing",
              "Statcast foundation"
            ]
          }
        );

      } catch (error) {

        console.error(
          "MLB server error:",
          error.response?.data ||
          error.message ||
          error
        );

        if (!res.headersSent) {
          send(
            res,
            500,
            {
              error:
                "Unable to process MLB question.",
              details:
                error.message
            }
          );
        }
      }
    }
  );


const PORT =
  process.env.PORT || 3000;

server.listen(
  PORT,
  () => {
    console.log(
      `MLB Research Engine running on port ${PORT}`
    );
  }
);
