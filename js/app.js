const API_URL = "https://mlb-research-engine.onrender.com";

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


function statLine(label, value, requestedStat) {
  if (value === undefined || value === null) {
    return `${label}: —<br>`;
  }

  if (label === requestedStat) {
    return `<strong>${label}: ${value}</strong><br>`;
  }

  return `${label}: ${value}<br>`;
}


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

  const singles = H - doubles - triples - HR;

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

  const sbAttempts = SB + CS;

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


function showAdvancedStats(data, answer) {
  const advanced = calculateAdvancedStats(data);

  const existingAdvanced = document.getElementById("advancedStats");

  if (existingAdvanced) {
    existingAdvanced.remove();
  }

  const advancedDiv = document.createElement("div");

  advancedDiv.id = "advancedStats";

  advancedDiv.innerHTML = `
    <br>
    <strong>Advanced Stats</strong><br><br>

    PA: ${advanced.PA}<br>
    BB%: ${advanced.BBPercent}<br>
    K%: ${advanced.KPercent}<br>
    ISO: ${advanced.ISO}<br>
    BABIP: ${advanced.BABIP}<br>
    SB%: ${advanced.SBPercent}<br>
  `;

  answer.appendChild(advancedDiv);
}


async function askQuestion() {
  const question = document.getElementById("question").value;
  const answer = document.getElementById("answer");

  if (!question.trim()) {
    answer.textContent = "Please enter an MLB question.";
    return;
  }

  answer.textContent = "Researching MLB data...";

  try {
    const response = await fetch(
      `${API_URL}/api/mlb/query?question=${encodeURIComponent(question)}`
    );

    const data = await response.json();

    if (!response.ok) {
      answer.textContent =
        data.error || "Something went wrong.";
      return;
    }

    const requestedStat = getRequestedStat(question);

    // PITCHING RESULTS
    if (data.ERA !== undefined) {

      answer.innerHTML = `
        <strong>${data.player}</strong><br><br>

        ${statLine("Games", data.games, requestedStat)}
        ${statLine("IP", data.inningsPitched, requestedStat)}
        ${statLine("ER", data.earnedRuns, requestedStat)}
        ${statLine("H", data.hitsAllowed, requestedStat)}
        ${statLine("BB", data.walks, requestedStat)}
        ${statLine("K", data.strikeOuts, requestedStat)}
        ${statLine("HR", data.homeRuns, requestedStat)}

        <br>

        ${statLine("ERA", data.ERA, requestedStat)}
        ${statLine("WHIP", data.WHIP, requestedStat)}

        <br>

        <button id="advancedButton">
          View Advanced Stats
        </button>
      `;

      const advancedButton =
        document.getElementById("advancedButton");

      advancedButton.addEventListener("click", () => {
        advancedButton.textContent =
          "Advanced Stats Coming Soon";
      });

      return;
    }


    // HITTING RESULTS
    answer.innerHTML = `
      <strong>${data.player}</strong><br><br>

      ${statLine("Games", data.games, requestedStat)}
      ${statLine("AB", data.atBats, requestedStat)}
      ${statLine("H", data.hits, requestedStat)}
      ${statLine("R", data.runs, requestedStat)}
      ${statLine("2B", data.doubles, requestedStat)}
      ${statLine("3B", data.triples, requestedStat)}
      ${statLine("HR", data.homeRuns, requestedStat)}
      ${statLine("RBI", data.rbi, requestedStat)}
      ${statLine("BB", data.walks, requestedStat)}
      ${statLine("K", data.strikeOuts, requestedStat)}
      ${statLine("SB", data.stolenBases, requestedStat)}
      ${statLine("CS", data.caughtStealing, requestedStat)}

      <br>

      ${statLine("AVG", data.battingAverage, requestedStat)}
      ${statLine("OBP", data.onBasePercentage, requestedStat)}
      ${statLine("SLG", data.sluggingPercentage, requestedStat)}
      ${statLine("OPS", data.OPS, requestedStat)}

      <br>

      <button id="advancedButton">
        View Advanced Stats
      </button>
    `;

    const advancedButton =
      document.getElementById("advancedButton");

    advancedButton.addEventListener("click", () => {
      showAdvancedStats(data, answer);
      advancedButton.textContent = "Advanced Stats";
    });

  } catch (error) {

    console.error(error);

    answer.textContent =
      "Unable to connect to the MLB Research Engine.";
  }
}
