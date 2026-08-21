const API_URL = "https://mlb-research-engine.onrender.com/";


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
      answer.textContent = data.error || "Something went wrong.";
      return;
    }

answer.innerHTML = `
  <strong>${data.player}</strong><br><br>

  Games: ${data.games}<br>
  AB: ${data.atBats}<br>
  H: ${data.hits}<br>
  R: ${data.runs}<br>
  2B: ${data.doubles}<br>
  3B: ${data.triples}<br>
  HR: ${data.homeRuns}<br>
  RBI: ${data.rbi}<br>
  BB: ${data.walks}<br>
  K: ${data.strikeOuts}<br>
  SB: ${data.stolenBases}<br>
  CS: ${data.caughtStealing}<br><br>

  AVG: ${data.battingAverage}<br>
  OBP: ${data.onBasePercentage}<br>
  SLG: ${data.sluggingPercentage}<br>
  <strong>OPS: ${data.OPS}</strong>
`;
  } catch (error) {
    answer.textContent =
      "Unable to connect to the MLB Research Engine.";
  }
}
