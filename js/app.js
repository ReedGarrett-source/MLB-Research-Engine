const API_URL = "https://mlb-research-engine.onrender.com";


/* =========================
   REQUESTED STAT
========================= */

function getRequestedStat(question) {
  const q = question.toLowerCase();

  if (/\b(ops)\b/.test(q)) return "OPS";
  if (/\b(avg|average|batting average)\b/.test(q)) return "AVG";
  if (/\b(obp|on base|on-base)\b/.test(q)) return "OBP";
  if (/\b(slg|slugging)\b/.test(q)) return "SLG";

  if (/\b(hr|hrs|homer|homers|home run|home runs)\b/.test(q)) return "HR";
  if (/\b(rbi|rbis|runs batted in)\b/.test(q)) return "RBI";
  if (/\b(bb|walk|walks)\b/.test(q)) return "BB";
  if (/\b(k|ks|so|strikeout|strikeouts)\b/.test(q)) return "K";
  if (/\b(sb|stolen base|stolen bases|steal|steals)\b/.test(q)) return "SB";
  if (/\b(cs|caught stealing)\b/.test(q)) return "CS";
  if (/\b(2b|double|doubles)\b/.test(q)) return "2B";
  if (/\b(3b|triple|triples)\b/.test(q)) return "3B";
  if (/\b(h|hit|hits)\b/.test(q)) return "H";
  if (/\b(r|run|runs)\b/.test(q)) return "R";
  if (/\b(ab|at bat|at bats|at-bats)\b/.test(q)) return "AB";

  if (/\b(era)\b/.test(q)) return "ERA";
  if (/\b(whip)\b/.test(q)) return "WHIP";
  if (/\b(ip|innings|innings pitched)\b/.test(q)) return "IP";
  if (/\b(er|earned runs)\b/.test(q)) return "ER";

  return null;
}


/* =========================
   STAT CARD
========================= */

function statCard(label, value, requestedStat) {

  if (value === undefined || value === null) {
    value = "—";
  }

  const highlight =
    label === requestedStat
      ? "highlight"
      : "";

  return `
    <div class="stat-card ${highlight}">
      <div class="stat-label">${label}</div>
      <div class="stat-value">${value}</div>
    </div>
  `;
}


/* =========================
   ADVANCED STATS
========================= */

function calculateAdvancedStats(data) {

  const AB = Number(data.atBats || 0);
  const H = Number(data.hits || 0);
  const BB = Number(data.walks || 0);
  const K = Number(data.strikeOuts || 0);
  const HR = Number(data.homeRuns || 0);
  const SB = Number(data.stolenBases || 0);
  const CS = Number(data.caughtStealing || 0);

  const doubles = Number(data.doubles || 0);
  const triples = Number(data.triples || 0);

  const HBP = Number(data.hitByPitch || 0);
  const SF = Number(data.sacrificeFlies || 0);

  const PA = AB + BB + HBP + SF;

  const totalBases =
    H +
    doubles +
    (2 * triples) +
    (3 * HR);

  const iso =
    AB > 0
      ? (totalBases / AB) - (H / AB)
      : 0;

  const bbPercent =
    PA > 0
      ? BB / PA
      : 0;

  const kPercent =
    PA > 0
      ? K / PA
      : 0;

  const babipDenominator =
    AB - K - HR + SF;

  const babip =
    babipDenominator > 0
      ? (H - HR) / babipDenominator
      : 0;

  const sbAttempts =
    SB + CS;

  const stolenBasePercentage =
    sbAttempts > 0
      ? SB / sbAttempts
      : 0;

  return {
    PA,
    ISO: iso.toFixed(3),
    BBPercent: (bbPercent * 100).toFixed(1) + "%",
    KPercent: (kPercent * 100).toFixed(1) + "%",
    BABIP: babip.toFixed(3),
    SBPercent: (stolenBasePercentage * 100).toFixed(1) + "%"
  };
}


/* =========================
   ADVANCED STATS DISPLAY
========================= */

function toggleAdvancedStats(data) {

  const advancedContainer =
    document.getElementById("advancedStats");

  const button =
    document.getElementById("advancedButton");

  if (!advancedContainer) {
    return;
  }

  if (advancedContainer.classList.contains("open")) {

    advancedContainer.classList.remove("open");

    button.textContent =
      "View Advanced Stats";

    return;
  }

  const advanced =
    calculateAdvancedStats(data);

  advancedContainer.innerHTML = `

    <div class="stat-section">

      <div class="stat-section-title">
        Advanced Stats
      </div>

      <div class="stat-grid">

        ${statCard("PA", advanced.PA)}

        ${statCard("BB%", advanced.BBPercent)}

        ${statCard("K%", advanced.KPercent)}

        ${statCard("ISO", advanced.ISO)}

        ${statCard("BABIP", advanced.BABIP)}

        ${statCard("SB%", advanced.SBPercent)}

      </div>

    </div>

  `;

  advancedContainer.classList.add("open");

  button.textContent =
    "Hide Advanced Stats";
}


/* =========================
   RENDER HITTING RESULTS
========================= */

function renderHittingResults(data, requestedStat) {

  return `

    <div class="player-header">

      <div class="player-name">
        ${data.player}
      </div>

      <div class="sample-size">
        ${data.games} games
      </div>

    </div>


    <div class="stat-section">

      <div class="stat-section-title">
        Basic Stats
      </div>

      <div class="stat-grid">

        ${statCard("AB", data.atBats, requestedStat)}
        ${statCard("H", data.hits, requestedStat)}
        ${statCard("R", data.runs, requestedStat)}
        ${statCard("2B", data.doubles, requestedStat)}

        ${statCard("3B", data.triples, requestedStat)}
        ${statCard("HR", data.homeRuns, requestedStat)}
        ${statCard("RBI", data.rbi, requestedStat)}
        ${statCard("BB", data.walks, requestedStat)}

        ${statCard("K", data.strikeOuts, requestedStat)}
        ${statCard("SB", data.stolenBases, requestedStat)}
        ${statCard("CS", data.caughtStealing, requestedStat)}

      </div>

    </div>


    <div class="stat-section">

      <div class="stat-section-title">
        Slash Line
      </div>

      <div class="stat-grid">

        ${statCard("AVG", data.battingAverage, requestedStat)}
        ${statCard("OBP", data.onBasePercentage, requestedStat)}
        ${statCard("SLG", data.sluggingPercentage, requestedStat)}
        ${statCard("OPS", data.OPS, requestedStat)}

      </div>

    </div>


    <button
      id="advancedButton"
      class="advanced-toggle"
    >
      View Advanced Stats
    </button>


    <div
      id="advancedStats"
      class="advanced-stats"
    ></div>

  `;
}


/* =========================
   RENDER PITCHING RESULTS
========================= */

function renderPitchingResults(data, requestedStat) {

  return `

    <div class="player-header">

      <div class="player-name">
        ${data.player}
      </div>

      <div class="sample-size">
        ${data.games} games
      </div>

    </div>


    <div class="stat-section">

      <div class="stat-section-title">
        Basic Stats
      </div>

      <div class="stat-grid">

        ${statCard("IP", data.inningsPitched, requestedStat)}
        ${statCard("ER", data.earnedRuns, requestedStat)}
        ${statCard("H", data.hitsAllowed, requestedStat)}
        ${statCard("BB", data.walks, requestedStat)}

        ${statCard("K", data.strikeOuts, requestedStat)}
        ${statCard("HR", data.homeRuns, requestedStat)}

      </div>

    </div>


    <div class="stat-section">

      <div class="stat-section-title">
        Pitching Line
      </div>

      <div class="stat-grid">

        ${statCard("ERA", data.ERA, requestedStat)}
        ${statCard("WHIP", data.WHIP, requestedStat)}

      </div>

    </div>


    <button
      id="advancedButton"
      class="advanced-toggle"
    >
      View Advanced Stats
    </button>


    <div
      id="advancedStats"
      class="advanced-stats"
    >

      <div class="stat-section">

        <div class="stat-section-title">
          Advanced Stats
        </div>

        <div class="stat-grid">

          ${statCard("K", data.strikeOuts)}
          ${statCard("BB", data.walks)}
          ${statCard("HR", data.homeRuns)}

        </div>

      </div>

    </div>

  `;
}


/* =========================
   ASK QUESTION
========================= */

async function askQuestion() {

  const question =
    document.getElementById("question").value;

  const answer =
    document.getElementById("answer");


  if (!question.trim()) {

    answer.textContent =
      "Please enter an MLB question.";

    return;
  }


  answer.textContent =
    "Researching MLB data...";


  try {

    const response =
      await fetch(
        `${API_URL}/api/mlb/query?question=${encodeURIComponent(question)}`
      );


    const data =
      await response.json();


    if (!response.ok) {

      answer.textContent =
        data.error ||
        "Something went wrong.";

      return;
    }


    const requestedStat =
      getRequestedStat(question);


    /* =========================
       PITCHING
    ========================= */

    if (data.ERA !== undefined) {

      answer.innerHTML =
        renderPitchingResults(
          data,
          requestedStat
        );

      const advancedButton =
        document.getElementById(
          "advancedButton"
        );

      advancedButton.addEventListener(
        "click",
        () => {

          const advanced =
            document.getElementById(
              "advancedStats"
            );

          advanced.classList.toggle("open");

          advancedButton.textContent =
            advanced.classList.contains("open")
              ? "Hide Advanced Stats"
              : "View Advanced Stats";
        }
      );

      return;
    }


    /* =========================
       HITTING
    ========================= */

    answer.innerHTML =
      renderHittingResults(
        data,
        requestedStat
      );


    const advancedButton =
      document.getElementById(
        "advancedButton"
      );


    advancedButton.addEventListener(
      "click",
      () => {

        toggleAdvancedStats(
          data
        );

      }
    );


  } catch (error) {

    console.error(error);

    answer.textContent =
      "Unable to connect to the MLB Research Engine.";

  }

}
