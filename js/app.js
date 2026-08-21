function askQuestion() {
  const question = document.getElementById("question").value;
  const answer = document.getElementById("answer");

  if (!question.trim()) {
    answer.textContent = "Please enter an MLB question.";
    return;
  }

  answer.textContent = "Your question was: " + question;
}
