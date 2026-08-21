const http = require("http");
const axios = require("axios");

const server = http.createServer(async (req, res) => {
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
