const API_URL = "https://mlb-research-engine.onrender.com";

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
      OPS: ${data.OPS}
    `;
  } catch (error) {
    answer.textContent =
      "Unable to connect to the MLB Research Engine.";
  }
}
